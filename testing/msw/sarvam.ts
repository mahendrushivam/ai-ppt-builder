import { http, HttpResponse } from "msw";
import { SARVAM_CHAT_URL } from "@/features/ai/services/sarvam-client";
import { server } from "./server";

type SarvamStreamPart =
  | { reasoning: string }
  | { content: string }
  | { toolCall: { id: string; name: string; arguments: string } }
  | { finish: "stop" | "tool_calls" | "length" };

const EMPTY_DELTA = {
  content: null,
  function_call: null,
  refusal: null,
  role: null,
  tool_calls: null,
  reasoning_content: null,
};

function chunk(delta: Record<string, unknown>, finishReason: string | null = null) {
  return {
    id: "req_test",
    object: "chat.completion.chunk",
    model: "sarvam-105b",
    choices: [{ index: 0, delta: { ...EMPTY_DELTA, ...delta }, finish_reason: finishReason }],
    usage: null,
  };
}

/**
 * Builds an SSE body in the shape recorded from the live Sarvam API
 * (`testing/recordings/sarvam-tool-calls.sse`): null-filled deltas, tool calls split into
 * fragments, a trailing usage chunk and `data: [DONE]`.
 */
export function sarvamSse(parts: SarvamStreamPart[]): string {
  const chunks: object[] = [];
  let toolIndex = 0;

  for (const part of parts) {
    if ("reasoning" in part) chunks.push(chunk({ reasoning_content: part.reasoning }));
    else if ("content" in part) chunks.push(chunk({ content: part.content }));
    else if ("finish" in part) chunks.push(chunk({}, part.finish));
    else {
      const index = toolIndex++;
      const { id, name, arguments: args } = part.toolCall;
      chunks.push(chunk({ tool_calls: [{ index, id, type: "function", function: { name, arguments: "" } }] }));
      const middle = Math.ceil(args.length / 2);
      for (const fragment of [args.slice(0, middle), args.slice(middle)]) {
        chunks.push(
          chunk({ tool_calls: [{ index, id: null, type: "function", function: { name: null, arguments: fragment } }] }),
        );
      }
    }
  }
  chunks.push({
    id: "req_test",
    object: "chat.completion.chunk",
    model: "sarvam-105b",
    choices: [],
    usage: { completion_tokens: 20, prompt_tokens: 100, total_tokens: 120 },
  });

  return [...chunks.map((entry) => `data: ${JSON.stringify(entry)}\n\n`), "data: [DONE]\n\n"].join("");
}

/**
 * Answers successive Sarvam requests with one SSE body per model round (the last body is
 * reused if more requests arrive) and records each request body for assertions.
 */
export function mockSarvamRounds(...rounds: string[]): { requests: unknown[] } {
  const requests: unknown[] = [];
  server.use(
    http.post(SARVAM_CHAT_URL, async ({ request }) => {
      requests.push(await request.json());
      const body = rounds[Math.min(requests.length - 1, rounds.length - 1)];
      return new HttpResponse(body, { headers: { "Content-Type": "text/event-stream; charset=utf-8" } });
    }),
  );
  return { requests };
}
