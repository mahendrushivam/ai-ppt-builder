import { z } from "zod";
import { deckOperationSchema, deckSchema } from "@/features/deck/utils/schema";
import { AiErrorCode, AiPhase, type AiStreamEvent, AiStreamEventType } from "../types";

/*
 * Events streamed from the AI route handlers to the browser as NDJSON: one JSON event per
 * line, identified by `type`. The browser validates every line with the same schema,
 * because the network is an untrusted boundary too.
 */

export const aiStreamEventSchema = z.discriminatedUnion("type", [
  /** Progress shown to the user. Never contains raw model reasoning. */
  z.object({ type: z.literal(AiStreamEventType.Status), phase: z.enum(AiPhase) }),
  z.object({ type: z.literal(AiStreamEventType.Operation), operation: deckOperationSchema }),
  /** Part of the assistant's reply, streamed in whole words as the model writes it. */
  z.object({ type: z.literal(AiStreamEventType.MessageDelta), text: z.string().max(4000) }),
  /** The complete reply. It replaces any `message_delta` text streamed before it. */
  z.object({ type: z.literal(AiStreamEventType.Message), text: z.string().max(4000) }),
  /** Something was skipped but the turn continued, e.g. an invalid tool call. */
  z.object({ type: z.literal(AiStreamEventType.Warning), message: z.string().max(500) }),
  z.object({
    type: z.literal(AiStreamEventType.Error),
    code: z.enum(AiErrorCode),
    message: z.string().max(500),
    retryable: z.boolean(),
  }),
  z.object({ type: z.literal(AiStreamEventType.Done) }),
]);

export const NDJSON_CONTENT_TYPE = "application/x-ndjson";

export const CHAT_LIMITS = { messageLength: 4000, historyMessages: 12 } as const;

/** Body of `POST /api/ai/chat`. The browser owns the deck, so every turn sends a snapshot. */
export const chatRequestSchema = z.object({
  deck: deckSchema,
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(CHAT_LIMITS.messageLength),
      }),
    )
    .min(1)
    .max(CHAT_LIMITS.historyMessages)
    .refine((messages) => messages.at(-1)?.role === "user", { error: "The last message must be from the user." }),
  selectedSlideId: z.string().max(64).nullable(),
});

export function encodeStreamEvent(event: AiStreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

type ParsedStreamLine = { ok: true; event: AiStreamEvent } | { ok: false; line: string; message: string };

function parseStreamLine(line: string): ParsedStreamLine {
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    return { ok: false, line, message: "The line is not valid JSON." };
  }
  const parsed = aiStreamEventSchema.safeParse(json);
  return parsed.success
    ? { ok: true, event: parsed.data }
    : { ok: false, line, message: z.prettifyError(parsed.error) };
}

/**
 * Yields complete lines from a byte stream. Chunks can end mid-line (or mid-character),
 * so the unfinished tail is kept until the next chunk arrives. Used for both the NDJSON
 * stream to the browser and the SSE stream from the model provider.
 *
 * Aborting `signal` cancels the reader, so reading stops even when the underlying stream
 * never reports the abort itself.
 */
export async function* readLines(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const onAbort = () => {
    // The stream is being abandoned; a failed cancel leaves nothing to clean up.
    reader.cancel(signal?.reason).catch(() => undefined);
  };
  if (signal?.aborted) onAbort();
  signal?.addEventListener("abort", onAbort, { once: true });

  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) yield line.replace(/\r$/, "");
    }
    buffer += decoder.decode();
    if (buffer !== "") yield buffer.replace(/\r$/, "");
  } finally {
    signal?.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}

/** Parses every non-empty NDJSON line of a response body, including invalid ones. */
export async function* readStreamEvents(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<ParsedStreamLine> {
  for await (const line of readLines(body, signal)) {
    if (line.trim() !== "") yield parseStreamLine(line);
  }
}
