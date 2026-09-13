import type { AiStreamEvent, ChatRequest } from "../types";
import { readStreamEvents } from "../utils/stream-protocol";

export class AiRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "AiRequestError";
  }
}

/**
 * Sends one chat turn and yields its validated stream events. Lines that fail validation
 * are logged and skipped. The generator ends when the response ends; callers decide what
 * a stream without `done` or `error` means.
 */
export async function* streamChat(request: ChatRequest, signal: AbortSignal): AsyncGenerator<AiStreamEvent> {
  const response = await fetch(new URL("/api/ai/chat", window.location.href), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok || !response.body) throw await requestError(response);

  for await (const line of readStreamEvents(response.body, signal)) {
    if (line.ok) yield line.event;
    else console.error("Ignored an invalid AI stream event:", line.message);
  }
  // A stopped turn ends the stream early; report it as an abort, not as a lost connection.
  signal.throwIfAborted();
}

async function requestError(response: Response): Promise<AiRequestError> {
  const detail = await response.text().catch(() => "");
  console.error(`Chat request failed with ${response.status}:`, detail.slice(0, 500));
  return response.status >= 500
    ? new AiRequestError("The server couldn't handle the request. Try again.", true)
    : new AiRequestError("The chat request was rejected. Reload the page and try again.", false);
}
