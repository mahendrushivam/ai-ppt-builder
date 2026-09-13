import { useEffect, useRef, useState } from "react";
import { type DeckOperation, type OperationFailure, OperationFailureCode } from "@/features/deck/types";
import { useDecksStore } from "@/features/decks/hooks/use-decks-store";
import { AiRequestError, streamChat } from "@/services/ai/api/api";
import { loadChat, saveChat } from "@/services/localStorage/chat";
import { type AiPhase, AiStreamEventType, type ChatEntry, type ChatHistoryMessage } from "../types";
import { CHAT_LIMITS } from "../utils/stream-protocol";

export enum ChatState {
  Idle = "idle",
  Running = "running",
  Stopped = "stopped",
  Failed = "failed",
}

type ChatStatus =
  | { state: ChatState.Idle }
  /** `phase` is `null` until the server reports what the AI is doing. */
  | { state: ChatState.Running; phase: AiPhase | null }
  | { state: ChatState.Stopped }
  | { state: ChatState.Failed; message: string; retryable: boolean };

/**
 * Chat with the AI about one deck. Streamed operations are applied through the decks store
 * as they arrive, with the same revision checks as manual edits, so a slide the user edited
 * during the turn is skipped instead of overwritten. The conversation is saved per deck in
 * browser storage; the request status is not.
 */
export function useChat(deckId: string, selectedSlideId: string | null) {
  // The chat only mounts in the browser once decks have loaded, so storage can be read here.
  const [entries, setEntries] = useState<ChatEntry[]>(() => loadChat(deckId));
  const [historySaveFailed, setHistorySaveFailed] = useState(false);
  const [status, setStatus] = useState<ChatStatus>({ state: ChatState.Idle });
  /** Reply text streamed so far in the running turn, or `null` when nothing is being written. */
  const [replyDraft, setReplyDraft] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  /** Latest entries for handlers that keep running across renders during a streamed turn. */
  const entriesRef = useRef(entries);

  // Leaving the editor cancels a running turn, and with it the model request.
  useEffect(() => () => controllerRef.current?.abort(), []);

  function addEntry(kind: ChatEntry["kind"], text: string) {
    const next = [...entriesRef.current, { id: crypto.randomUUID(), kind, text }];
    entriesRef.current = next;
    setEntries(next);
    const deckIds = useDecksStore.getState().decks.map((deck) => deck.id);
    setHistorySaveFailed(!saveChat(deckId, next, deckIds));
  }

  async function send(text: string) {
    const content = text.trim();
    if (content === "" || status.state === ChatState.Running) return;
    const history = toHistory(entriesRef.current);
    addEntry("user", content);
    await run([...history, { role: "user", content }]);
  }

  async function retry() {
    if (status.state !== ChatState.Failed || !status.retryable) return;
    const history = toHistory(entriesRef.current);
    const lastUserIndex = history.findLastIndex((message) => message.role === "user");
    if (lastUserIndex !== -1) await run(history.slice(0, lastUserIndex + 1));
  }

  function stop() {
    controllerRef.current?.abort();
  }

  async function run(history: ChatHistoryMessage[]) {
    const deck = useDecksStore.getState().decks.find((candidate) => candidate.id === deckId);
    if (!deck) {
      setStatus({ state: ChatState.Failed, message: "This presentation no longer exists.", retryable: false });
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus({ state: ChatState.Running, phase: null });

    const skipped: string[] = [];
    let finished = false;
    let streamedReply = "";
    try {
      const request = { deck, messages: history.slice(-CHAT_LIMITS.historyMessages), selectedSlideId };
      for await (const event of streamChat(request, controller.signal)) {
        switch (event.type) {
          case AiStreamEventType.Status:
            setStatus({ state: ChatState.Running, phase: event.phase });
            break;
          case AiStreamEventType.Operation: {
            const skippedChange = applyAiOperation(deckId, event.operation);
            if (skippedChange) skipped.push(skippedChange);
            break;
          }
          case AiStreamEventType.MessageDelta:
            streamedReply += event.text;
            setReplyDraft(streamedReply);
            break;
          case AiStreamEventType.Message:
            streamedReply = "";
            setReplyDraft(null);
            addEntry("assistant", event.text);
            break;
          case AiStreamEventType.Warning:
            addEntry("notice", event.message);
            break;
          case AiStreamEventType.Error:
            finished = true;
            setStatus({ state: ChatState.Failed, message: event.message, retryable: event.retryable });
            break;
          case AiStreamEventType.Done:
            finished = true;
            setStatus({ state: ChatState.Idle });
            break;
        }
      }
      if (!finished) {
        setStatus({
          state: ChatState.Failed,
          message: "Connection lost. Changes received so far were kept.",
          retryable: true,
        });
      }
    } catch (error) {
      if (controller.signal.aborted) {
        setStatus({ state: ChatState.Stopped });
      } else if (error instanceof AiRequestError) {
        setStatus({ state: ChatState.Failed, message: error.message, retryable: error.retryable });
      } else {
        console.error("Chat request failed:", error);
        setStatus({
          state: ChatState.Failed,
          message: "Couldn't reach the server. Check your connection and try again.",
          retryable: true,
        });
      }
    } finally {
      // A turn that ended before its complete reply keeps the text the user already saw.
      if (streamedReply.trim() !== "") addEntry("assistant", streamedReply.trim());
      setReplyDraft(null);
      if (skipped.length > 0) addEntry("notice", skipped.join(" "));
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }

  return { entries, replyDraft, historySaveFailed, status, send, retry, stop };
}

function toHistory(entries: ChatEntry[]): ChatHistoryMessage[] {
  return entries.flatMap((entry) => (entry.kind === "notice" ? [] : [{ role: entry.kind, content: entry.text }]));
}

/** Applies one AI change. Returns an explanation when it had to be skipped. */
function applyAiOperation(deckId: string, operation: DeckOperation): string | null {
  const store = useDecksStore.getState();
  const result = store.applyOperation(deckId, operation);
  return result.ok ? null : describeSkippedChange(deckId, operation, result);
}

function describeSkippedChange(deckId: string, operation: DeckOperation, failure: OperationFailure): string {
  switch (failure.code) {
    case OperationFailureCode.NotFound:
      return "Skipped a change to a slide that no longer exists.";
    case OperationFailureCode.Invalid:
      return `Skipped a change that couldn't be applied: ${failure.message}`;
    case OperationFailureCode.Conflict: {
      const slideId = "slideId" in operation ? operation.slideId : null;
      const slides = useDecksStore.getState().decks.find((deck) => deck.id === deckId)?.slides ?? [];
      const position = slides.findIndex((slide) => slide.id === slideId) + 1;
      const slideName = position > 0 ? `slide ${position}` : "a slide";
      return `Skipped a change to ${slideName} because you edited it while the AI was working. Ask again to apply it.`;
    }
  }
}
