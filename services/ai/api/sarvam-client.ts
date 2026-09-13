import "server-only";
import { getServerEnv } from "@/lib/env";
import { readSarvamChunks, type SarvamChunk } from "@/features/ai/utils/sarvam-stream";

export const SARVAM_CHAT_URL = "https://api.sarvam.ai/v1/chat/completions";
const MODEL = "sarvam-105b";
const MAX_RETRIES = 2;

export type SarvamToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type SarvamMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: SarvamToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type SarvamTool = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export enum SarvamErrorKind {
  /** Still rate limited after retries. */
  RateLimited = "rate_limited",
  /** Network failure or provider error; worth retrying later. */
  Unavailable = "unavailable",
  /** The provider refused the request (bad key, invalid request); retrying won't help. */
  Rejected = "rejected",
}

export class SarvamError extends Error {
  constructor(
    message: string,
    readonly kind: SarvamErrorKind,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "SarvamError";
  }
}

type StreamCompletionOptions = {
  messages: SarvamMessage[];
  tools: SarvamTool[];
  /** Includes reasoning tokens, which Sarvam counts as completion tokens. */
  maxTokens: number;
  /**
   * `off` skips reasoning entirely. Measured on 2026-09-13 for a reply-only follow-up round:
   * about 0.6s without reasoning, about 22s with low reasoning. Forced tool calls need `off`:
   * on 2026-09-14 a forced outline call with low reasoning spent all 4096 output tokens
   * reasoning and never called the tool.
   */
  reasoning: "low" | "off";
  /** `auto` lets the model decide; naming a tool forces exactly that call. */
  toolChoice?: "auto" | { name: string };
  signal: AbortSignal;
  /** Base delay for exponential backoff between retries. */
  retryDelayMs?: number;
};

/**
 * Streams one chat completion. Rate limits, server errors and network failures are retried
 * with exponential backoff before streaming starts; aborting `signal` cancels the upstream
 * request, including a pending retry.
 */
export async function* streamCompletion({
  messages,
  tools,
  maxTokens,
  reasoning,
  toolChoice = "auto",
  signal,
  retryDelayMs = 1000,
}: StreamCompletionOptions): AsyncGenerator<SarvamChunk> {
  const body = JSON.stringify({
    model: MODEL,
    messages,
    tools,
    tool_choice: toolChoice === "auto" ? "auto" : { type: "function", function: { name: toolChoice.name } },
    stream: true,
    // Sarvam disables reasoning with `null`; low effort keeps it from using up the output budget.
    reasoning_effort: reasoning === "off" ? null : "low",
    max_tokens: maxTokens,
  });
  const response = await requestWithRetry(body, signal, retryDelayMs);
  if (!response.body) throw new SarvamError("The AI service returned an empty response.", SarvamErrorKind.Unavailable, response.status);
  yield* readSarvamChunks(response.body);
}

async function requestWithRetry(body: string, signal: AbortSignal, retryDelayMs: number): Promise<Response> {
  const { SARVAM_API_KEY } = getServerEnv();

  for (let attempt = 0; ; attempt++) {
    const isLastAttempt = attempt >= MAX_RETRIES;
    let response: Response;
    try {
      response = await fetch(SARVAM_CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-subscription-key": SARVAM_API_KEY },
        body,
        signal,
      });
    } catch (error) {
      if (signal.aborted || isLastAttempt) throw signal.aborted ? error : networkError(error);
      await delay(retryDelayMs * 2 ** attempt, signal);
      continue;
    }

    if (response.ok) return response;
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || isLastAttempt) throw await errorFromResponse(response);
    // Reading the small error body releases the connection; if that fails, the retry still proceeds.
    await response.text().catch(() => "");
    await delay(retryDelayMs * 2 ** attempt, signal);
  }
}

function networkError(cause: unknown): SarvamError {
  console.error("Could not reach Sarvam:", cause);
  return new SarvamError("Could not reach the AI service.", SarvamErrorKind.Unavailable, null);
}

async function errorFromResponse(response: Response): Promise<SarvamError> {
  const detail = await response.text().catch(() => "");
  // Logged server-side only: provider messages can mention keys or quotas and are not shown to users.
  console.error(`Sarvam request failed with ${response.status}:`, detail.slice(0, 500));

  if (response.status === 429) {
    return new SarvamError("The AI service is rate limited.", SarvamErrorKind.RateLimited, 429);
  }
  if (response.status >= 500) {
    return new SarvamError("The AI service is unavailable.", SarvamErrorKind.Unavailable, response.status);
  }
  return new SarvamError("The AI service rejected the request.", SarvamErrorKind.Rejected, response.status);
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
