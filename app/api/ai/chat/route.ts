import { chatRequestSchema, eventStreamResponse, parseRequestBody } from "@/features/ai/utils/stream-protocol";
import { runChatTurn } from "@/services/ai/agents/chat-agent";

/** A turn can take several model rounds; each is usually a few seconds. */
export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  const body = await parseRequestBody(request, chatRequestSchema);
  if (!body.ok) return body.response;

  // `request.signal` aborts when the browser disconnects or presses Stop, which also cancels the Sarvam request.
  return eventStreamResponse((emit) => runChatTurn({ ...body.data, signal: request.signal, emit }));
}
