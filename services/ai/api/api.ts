import { z } from "zod";
import type { AiStreamEvent, ChatRequest, GenerateRequest, Outline, OutlineRequest } from "@/features/ai/types";
import { outlineSchema } from "@/features/ai/utils/slide-input";
import { readStreamEvents } from "@/features/ai/utils/stream-protocol";

export class AiRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "AiRequestError";
  }
}

/** Sends one chat turn and yields its validated stream events. */
export function streamChat(request: ChatRequest, signal: AbortSignal): AsyncGenerator<AiStreamEvent> {
  return streamEvents("/api/ai/chat", request, signal);
}

/** Generates outline items and yields validated stream events as slides are written. */
export function streamGeneration(request: GenerateRequest, signal: AbortSignal): AsyncGenerator<AiStreamEvent> {
  return streamEvents("/api/ai/generate", request, signal);
}

const outlineResponseSchema = z.object({ outline: outlineSchema });
const aiFailureResponseSchema = z.object({
  error: z.object({ message: z.string().max(500), retryable: z.boolean() }),
});

/** Drafts an outline for the user to review. The response is validated like any AI output. */
export async function requestOutline(request: OutlineRequest, signal: AbortSignal): Promise<Outline> {
  const response = await post("/api/ai/outline", request, signal);
  const body: unknown = await response.json().catch(() => null);

  if (response.ok) {
    const parsed = outlineResponseSchema.safeParse(body);
    if (parsed.success) return parsed.data.outline;
    console.error("The outline response was invalid:", z.prettifyError(parsed.error));
    throw new AiRequestError("The AI returned an outline that couldn't be used. Try again.", true);
  }

  const failure = aiFailureResponseSchema.safeParse(body);
  if (failure.success) throw new AiRequestError(failure.data.error.message, failure.data.error.retryable);
  throw unexpectedResponse(response.status, body);
}

/**
 * Posts a request and yields its validated NDJSON events. Lines that fail validation are
 * logged and skipped. The generator ends when the response ends; callers decide what a
 * stream without `done` or `error` means.
 */
async function* streamEvents(path: string, body: unknown, signal: AbortSignal): AsyncGenerator<AiStreamEvent> {
  const response = await post(path, body, signal);
  if (!response.ok || !response.body) {
    throw unexpectedResponse(response.status, await response.text().catch(() => ""));
  }

  for await (const line of readStreamEvents(response.body, signal)) {
    if (line.ok) yield line.event;
    else console.error("Ignored an invalid AI stream event:", line.message);
  }
  // A stopped request ends the stream early; report it as an abort, not as a lost connection.
  signal.throwIfAborted();
}

function post(path: string, body: unknown, signal: AbortSignal): Promise<Response> {
  return fetch(new URL(path, window.location.href), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

function unexpectedResponse(status: number, detail: unknown): AiRequestError {
  console.error(`AI request failed with ${status}:`, typeof detail === "string" ? detail.slice(0, 500) : detail);
  return status >= 500
    ? new AiRequestError("The server couldn't handle the request. Try again.", true)
    : new AiRequestError("The request was rejected. Reload the page and try again.", false);
}
