import "server-only";
import type { Deck } from "@/features/deck/types";
import { LIMITS } from "@/features/deck/utils/schema";
import { AiErrorCode, AiPhase, type AiStreamEvent, AiStreamEventType, type ChatHistoryMessage } from "@/features/ai/types";
import { serializeDeckForModel } from "@/features/ai/utils/deck-context";
import { type CompletionResult, mergeToolCallDeltas, type SarvamChunk } from "@/features/ai/utils/sarvam-stream";
import { type SarvamMessage, streamCompletion } from "../api/sarvam-client";
import { type FindImage, findImage as findOpenverseImage } from "@/services/images/openverse";
import { CHAT_TOOLS, ChatToolName, executeToolCall } from "../tools/slide-tools";
import { describeAiFailure } from "./errors";

const MAX_ROUNDS = 4;
const MAX_OPERATIONS_PER_TURN = 20;
/** Sarvam's output cap on the Starter plan. Reasoning tokens count toward it. */
const MAX_TOKENS = 4096;
const MAX_REPLY_LENGTH = 4000;

type Emit = (event: AiStreamEvent) => void;

type ChatTurnOptions = {
  deck: Deck;
  messages: ChatHistoryMessage[];
  selectedSlideId: string | null;
  signal: AbortSignal;
  emit: Emit;
  retryDelayMs?: number;
  /** Image search for image blocks the AI adds. */
  findImage?: FindImage;
};

/**
 * Runs one chat turn. The model reads the deck and calls tools; each call is validated and
 * applied to a working copy, emitted as an operation, and its result is fed back so the
 * model can see its changes and fix mistakes, for up to MAX_ROUNDS rounds.
 *
 * Ends with `done`, or with `error` when the turn could not finish. Operations emitted
 * before an error are valid on their own and stay applied. Aborting stops without events.
 */
export async function runChatTurn(options: ChatTurnOptions): Promise<void> {
  try {
    await runRounds(options);
  } catch (error) {
    if (options.signal.aborted) return;
    options.emit({ type: AiStreamEventType.Error, ...describeAiFailure(error) });
  }
}

async function runRounds({
  deck,
  messages,
  selectedSlideId,
  signal,
  emit,
  retryDelayMs,
  findImage = findOpenverseImage,
}: ChatTurnOptions) {
  let workingDeck = deck;
  const appliedSummaries: string[] = [];
  let previousRoundNeedsCorrection = false;
  const conversation: SarvamMessage[] = messages.map(({ role, content }) => ({ role, content }));

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    // Rebuilt every round so the model sees the results of its own earlier tool calls.
    const system: SarvamMessage = { role: "system", content: buildSystemPrompt(workingDeck, selectedSlideId) };
    const response = await readRound(
      streamCompletion({
        messages: [system, ...conversation],
        tools: CHAT_TOOLS,
        maxTokens: MAX_TOKENS,
        // Reasoning plans the edits in the first round and helps fix a failed call. After
        // successful calls the model only needs to reply; reasoning there made it slow and
        // led it to redo edits that were already applied.
        reasoning: round === 1 || previousRoundNeedsCorrection ? "low" : "off",
        signal,
        retryDelayMs,
      }),
      workingDeck,
      emit,
    );

    if (response.finishReason === null || response.finishReason === "length") {
      // A cut-off response may end in a half-written tool call, so none of this round is applied.
      if (appliedSummaries.length > 0) {
        // Earlier rounds' changes are complete and already applied; only the rest of the turn was lost.
        emit({
          type: AiStreamEventType.Warning,
          message: "The AI stopped before it finished, so part of your request may be missing.",
        });
        emit({ type: AiStreamEventType.Message, text: summarizeForUser(appliedSummaries, workingDeck) });
        emit({ type: AiStreamEventType.Done });
        return;
      }
      emit({
        type: AiStreamEventType.Error,
        code: AiErrorCode.IncompleteResponse,
        message:
          response.finishReason === "length"
            ? "The AI ran out of space before finishing. Try asking for fewer changes at once."
            : "The AI response was cut off before it finished.",
        retryable: true,
      });
      return;
    }

    if (response.toolCalls.length === 0) {
      const reply = response.content.trim();
      if (reply === "" && appliedSummaries.length === 0) {
        emit({
          type: AiStreamEventType.Error,
          code: AiErrorCode.EmptyResponse,
          message: "The AI didn't respond. Try rephrasing your request.",
          retryable: true,
        });
        return;
      }
      emit({
        type: AiStreamEventType.Message,
        text: reply === "" ? "Done." : replaceSlideIds(reply, workingDeck).slice(0, MAX_REPLY_LENGTH),
      });
      emit({ type: AiStreamEventType.Done });
      return;
    }

    emit({ type: AiStreamEventType.Status, phase: AiPhase.ApplyingChanges });
    let announcedImages = false;
    const findImageWithStatus: FindImage = (query, searchSignal) => {
      if (!announcedImages) {
        announcedImages = true;
        emit({ type: AiStreamEventType.Status, phase: AiPhase.AddingImages });
      }
      return findImage(query, searchSignal);
    };
    const calls = response.toolCalls.map((call, index) => ({ ...call, id: call.id || `call_${round}_${index}` }));
    const toolResults: SarvamMessage[] = [];
    previousRoundNeedsCorrection = false;

    for (const call of calls) {
      let result: string;
      if (appliedSummaries.length >= MAX_OPERATIONS_PER_TURN) {
        result = `Error: not applied. The limit of ${MAX_OPERATIONS_PER_TURN} changes per request was reached.`;
      } else {
        const execution = await executeToolCall(workingDeck, call.name, call.arguments, {
          findImage: findImageWithStatus,
          signal,
        });
        if (execution.ok) {
          workingDeck = execution.deck;
          appliedSummaries.push(execution.summary);
          emit({ type: AiStreamEventType.Operation, operation: execution.operation });
          result = execution.summary;
        } else {
          result = `Error: ${execution.message}`;
          if (execution.needsCorrection) previousRoundNeedsCorrection = true;
        }
      }
      toolResults.push({ role: "tool", tool_call_id: call.id, content: result });
    }

    conversation.push(
      {
        role: "assistant",
        content: response.content.trim() || null,
        tool_calls: calls.map(({ id, name, arguments: args }) => ({ id, type: "function", function: { name, arguments: args } })),
      },
      ...toolResults,
    );
  }

  emit({
    type: AiStreamEventType.Warning,
    message: "The AI stopped after several rounds of changes. Check the slides and ask again if something is missing.",
  });
  emit({ type: AiStreamEventType.Done });
}

/**
 * Collects one streamed model response. Reasoning is only turned into a status, never
 * forwarded. Reply text is streamed as `message_delta` events in whole words: the unfinished
 * last word is held back because it may be the first half of a slide id, which has to be
 * replaced with a slide number before the user sees it.
 */
async function readRound(chunks: AsyncIterable<SarvamChunk>, deck: Deck, emit: Emit): Promise<CompletionResult> {
  const response: CompletionResult = { content: "", toolCalls: [], finishReason: null };
  let phase: AiPhase | null = null;
  let heldBack = "";

  const announce = (next: AiPhase) => {
    if (phase === next) return;
    phase = next;
    emit({ type: AiStreamEventType.Status, phase: next });
  };

  const sendReplyText = (text: string) => {
    const visible = phase === AiPhase.WritingReply ? text : text.trimStart();
    if (visible === "") return;
    announce(AiPhase.WritingReply);
    emit({ type: AiStreamEventType.MessageDelta, text: replaceSlideIds(visible, deck).slice(0, MAX_REPLY_LENGTH) });
  };

  for await (const chunk of chunks) {
    for (const { delta, finish_reason: finishReason } of chunk.choices) {
      // Reasoning comes before anything else in a response, so it is announced at most once.
      if (delta?.reasoning_content && phase === null) announce(AiPhase.Thinking);
      if (delta?.tool_calls) {
        announce(AiPhase.UpdatingSlides);
        response.toolCalls = mergeToolCallDeltas(response.toolCalls, delta.tool_calls);
      }
      if (delta?.content) {
        response.content += delta.content;
        heldBack += delta.content;
        const lastWhitespace = heldBack.search(/\s\S*$/);
        if (lastWhitespace !== -1) {
          sendReplyText(heldBack.slice(0, lastWhitespace + 1));
          heldBack = heldBack.slice(lastWhitespace + 1);
        }
      }
      if (finishReason) response.finishReason = finishReason;
    }
  }

  // Only a finished reply releases its last word; text from a tool round is replaced by a later reply.
  if (response.finishReason === "stop" && response.toolCalls.length === 0) sendReplyText(heldBack);
  return response;
}

function buildSystemPrompt(deck: Deck, selectedSlideId: string | null): string {
  const selectedIndex = deck.slides.findIndex((slide) => slide.id === selectedSlideId);
  const selection =
    selectedIndex === -1
      ? "No slide is selected."
      : `The user has slide ${selectedIndex + 1} (id=${deck.slides[selectedIndex].id}) selected; "this slide" means that slide.`;

  return [
    "You are the editing assistant of a presentation builder. You change the user's deck only by calling the provided tools.",
    "",
    "Rules:",
    "- Tools address slides by id. Users refer to slides by number, so map numbers to ids using the deck below.",
    "- Change only what the user asked for. Leave other slides and fields as they are.",
    `- ${ChatToolName.UpdateSlide} replaces whole fields. Send \`columns\` only when the slide's content should change, and then include every block the slide should keep.`,
    '- Layouts: "title" and "section" have no columns, "content" has 1 column, "two-column" and "comparison" have 2 columns (comparison columns have headings).',
    `- Content is plain text without markdown. Limits: ${LIMITS.bulletsPerBlock} bullets per block, ${LIMITS.blocksPerColumn} blocks per column, ${LIMITS.slideTitle} characters per title, ${LIMITS.slidesPerDeck} slides per deck.`,
    "- Every table row needs as many cells as the header. Every chart series needs one value per category.",
    "- Pick the chart type that fits the data; the chartType description says how each type reads the series.",
    "- If a tool returns an error, fix the arguments and call the tool again.",
    "- The deck below already includes your successful changes. Don't repeat them; once the request is done, stop calling tools.",
    "- Never claim a change you did not make with a tool. When finished, reply in one or two short sentences describing the changes that succeeded (tool results starting with Added, Updated, Changed, Moved or Deleted). Refer to slides by number, never by id.",
    "- If the request is unclear, ask a short question instead of calling tools.",
    "",
    selection,
    "",
    "Current deck (updated after every change you make):",
    serializeDeckForModel(deck),
  ].join("\n");
}

/** Turns tool results like "Updated slide 2 (slide_…)." into a reply without ids. */
function summarizeForUser(summaries: string[], deck: Deck): string {
  const text = summaries.map((summary) => summary.replace(/ \(slide_[^)\s]+\)/g, "")).join(" ");
  return replaceSlideIds(text, deck).slice(0, MAX_REPLY_LENGTH);
}

/** The model sometimes mentions internal slide ids; users know slides by their number. */
function replaceSlideIds(text: string, deck: Deck): string {
  return text.replace(/\bslide_[a-z0-9]{12}\b/g, (slideId) => {
    const index = deck.slides.findIndex((slide) => slide.id === slideId);
    return index === -1 ? "a removed slide" : `slide ${index + 1}`;
  });
}

