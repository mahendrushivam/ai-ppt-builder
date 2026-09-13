import { useEffect, useRef, useState } from "react";
import { useDecksStore } from "@/features/decks/hooks/use-decks-store";
import { AiRequestError, requestOutline, streamGeneration } from "@/services/ai/api/api";
import { AiStreamEventType, type Outline, type OutlineRequest, SlideGenerationStatus } from "../types";
import { type EditableOutline, outlineForGeneration, toEditableOutline } from "../utils/outline-editing";

export enum GenerationStep {
  Prompt = "prompt",
  DraftingOutline = "drafting_outline",
  ReviewingOutline = "reviewing_outline",
  Generating = "generating",
}

export enum GenerationRun {
  Running = "running",
  Finished = "finished",
  Stopped = "stopped",
  Failed = "failed",
}

export type SlideProgress = {
  title: string;
  status: SlideGenerationStatus;
  slideId: string | null;
  message: string | null;
};

type GenerationState =
  | { step: GenerationStep.Prompt; request: OutlineRequest; error: string | null }
  | { step: GenerationStep.DraftingOutline; request: OutlineRequest }
  | { step: GenerationStep.ReviewingOutline; request: OutlineRequest; outline: EditableOutline }
  | {
      step: GenerationStep.Generating;
      request: OutlineRequest;
      /** The validated outline the slides are generated from. */
      outline: Outline;
      slides: SlideProgress[];
      run: GenerationRun;
      error: { message: string; retryable: boolean } | null;
      /** Where the first slide was placed, so a retried first slide goes back to the same place. */
      startAfterSlideId: string | null;
    };

export type GenerationProgressState = Extract<GenerationState, { step: GenerationStep.Generating }>;

const DEFAULT_REQUEST: OutlineRequest = { prompt: "", slideCount: 6 };

/**
 * Creates slides from a prompt in two steps: draft an outline the user can edit, then generate
 * the slides one at a time. Each streamed slide is applied through the decks store as soon as it
 * arrives, so slides that were already written are kept when a later one fails or the user stops.
 */
export function useGeneration(deckId: string) {
  const [state, setState] = useState<GenerationState>({
    step: GenerationStep.Prompt,
    request: DEFAULT_REQUEST,
    error: null,
  });
  const controllerRef = useRef<AbortController | null>(null);

  // Leaving the editor cancels a running request, and with it the model call.
  useEffect(() => () => controllerRef.current?.abort(), []);

  function startRequest(): AbortController {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    return controller;
  }

  function updateGenerating(update: (current: GenerationProgressState) => GenerationProgressState) {
    setState((current) => (current.step === GenerationStep.Generating ? update(current) : current));
  }

  function updateSlide(index: number, changes: Partial<SlideProgress>) {
    updateGenerating((current) => ({
      ...current,
      slides: current.slides.map((slide, slideIndex) => (slideIndex === index ? { ...slide, ...changes } : slide)),
    }));
  }

  async function draftOutline(request: OutlineRequest) {
    const controller = startRequest();
    setState({ step: GenerationStep.DraftingOutline, request });
    try {
      const outline = await requestOutline(request, controller.signal);
      if (controllerRef.current !== controller) return;
      setState({ step: GenerationStep.ReviewingOutline, request, outline: toEditableOutline(outline) });
    } catch (error) {
      if (controllerRef.current !== controller) return;
      setState({
        step: GenerationStep.Prompt,
        request,
        error: controller.signal.aborted ? null : describeRequestError(error),
      });
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }

  function editOutline(outline: EditableOutline) {
    setState((current) => (current.step === GenerationStep.ReviewingOutline ? { ...current, outline } : current));
  }

  function startOver() {
    controllerRef.current?.abort();
    setState((current) => ({ step: GenerationStep.Prompt, request: current.request, error: null }));
  }

  function cancel() {
    controllerRef.current?.abort();
  }

  async function generate() {
    if (state.step !== GenerationStep.ReviewingOutline) return;
    const outline = outlineForGeneration(state.outline);
    const store = useDecksStore.getState();
    const deck = store.decks.find((candidate) => candidate.id === deckId);
    if (!outline || !deck) return;

    const renamed = store.applyOperation(deckId, { type: "deck.rename", title: outline.deckTitle });
    if (!renamed.ok) console.error("Could not rename the deck to the outline's title:", renamed.message);

    const startAfterSlideId = deck.slides.at(-1)?.id ?? null;
    setState({
      step: GenerationStep.Generating,
      request: state.request,
      outline,
      slides: outline.slides.map((item) => ({
        title: item.title,
        status: SlideGenerationStatus.Pending,
        slideId: null,
        message: null,
      })),
      run: GenerationRun.Running,
      error: null,
      startAfterSlideId,
    });
    await runGeneration(state.request.prompt, outline, outline.slides.map((_, index) => index), startAfterSlideId);
  }

  async function retrySlide(index: number) {
    if (state.step !== GenerationStep.Generating || state.run === GenerationRun.Running) return;
    await runGeneration(state.request.prompt, state.outline, [index], anchorBefore(state, index, deckSlideIds()));
  }

  /** Generates the items that were still waiting when a run was stopped or failed. */
  async function resume() {
    if (state.step !== GenerationStep.Generating || state.run === GenerationRun.Running) return;
    const pending = state.slides.flatMap((slide, index) => (slide.status === SlideGenerationStatus.Pending ? [index] : []));
    if (pending.length === 0) return;
    await runGeneration(state.request.prompt, state.outline, pending, anchorBefore(state, pending[0], deckSlideIds()));
  }

  function dismiss() {
    setState((current) =>
      current.step === GenerationStep.Generating && current.run === GenerationRun.Running
        ? current
        : { step: GenerationStep.Prompt, request: current.request, error: null },
    );
  }

  function deckSlideIds(): Set<string> {
    const deck = useDecksStore.getState().decks.find((candidate) => candidate.id === deckId);
    return new Set(deck?.slides.map((slide) => slide.id));
  }

  async function runGeneration(prompt: string, outline: Outline, outlineIndexes: number[], afterSlideId: string | null) {
    const controller = startRequest();
    updateGenerating((current) => ({ ...current, run: GenerationRun.Running, error: null }));

    /** Items whose slide the store rejected; a later `done` for them must not hide that. */
    const rejected = new Map<number, string>();
    let currentIndex: number | null = null;
    let finished = false;

    try {
      const request = { prompt, outline, outlineIndexes, afterSlideId };
      for await (const event of streamGeneration(request, controller.signal)) {
        switch (event.type) {
          case AiStreamEventType.SlideProgress: {
            if (event.status === SlideGenerationStatus.Generating) currentIndex = event.outlineIndex;
            const rejection = rejected.get(event.outlineIndex);
            updateSlide(
              event.outlineIndex,
              rejection === undefined
                ? { status: event.status, slideId: event.slideId ?? null, message: event.message ?? null }
                : { status: SlideGenerationStatus.Failed, slideId: null, message: rejection },
            );
            break;
          }
          case AiStreamEventType.Operation: {
            const result = useDecksStore.getState().applyOperation(deckId, event.operation);
            if (!result.ok && currentIndex !== null) {
              rejected.set(currentIndex, `The slide couldn't be added: ${result.message}`);
            }
            break;
          }
          case AiStreamEventType.Error:
            finished = true;
            updateGenerating((current) => ({
              ...waitingAgain(current),
              run: GenerationRun.Failed,
              error: { message: event.message, retryable: event.retryable },
            }));
            break;
          case AiStreamEventType.Done:
            finished = true;
            updateGenerating((current) => ({ ...current, run: GenerationRun.Finished }));
            break;
        }
      }
      if (!finished) {
        updateGenerating((current) => ({
          ...waitingAgain(current),
          run: GenerationRun.Failed,
          error: { message: "Connection lost. Slides received so far were kept.", retryable: true },
        }));
      }
    } catch (error) {
      const stopped = controller.signal.aborted;
      updateGenerating((current) => ({
        ...waitingAgain(current),
        run: stopped ? GenerationRun.Stopped : GenerationRun.Failed,
        error: stopped
          ? null
          : { message: describeRequestError(error), retryable: error instanceof AiRequestError ? error.retryable : true },
      }));
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }

  return { state, draftOutline, cancel, editOutline, startOver, generate, retrySlide, resume, dismiss };
}

export type GenerationController = ReturnType<typeof useGeneration>;

/** An item that was being written when a run ended goes back to waiting, so it can be continued. */
function waitingAgain(state: GenerationProgressState): GenerationProgressState {
  return {
    ...state,
    slides: state.slides.map((slide) =>
      slide.status === SlideGenerationStatus.Generating ? { ...slide, status: SlideGenerationStatus.Pending } : slide,
    ),
  };
}

/** The slide a regenerated item goes after: the nearest earlier generated slide that still exists. */
function anchorBefore(state: GenerationProgressState, index: number, deckSlideIds: Set<string>): string | null {
  for (let previous = index - 1; previous >= 0; previous--) {
    const slideId = state.slides[previous].slideId;
    if (slideId !== null && deckSlideIds.has(slideId)) return slideId;
  }
  return state.startAfterSlideId;
}

function describeRequestError(error: unknown): string {
  if (error instanceof AiRequestError) return error.message;
  console.error("AI request failed:", error);
  return "Couldn't reach the server. Check your connection and try again.";
}
