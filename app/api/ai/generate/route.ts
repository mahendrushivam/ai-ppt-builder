import { eventStreamResponse, generateRequestSchema } from "@/features/ai/utils/stream-protocol";
import { parseRequestBody } from "@/lib/request";
import { generateSlides } from "@/services/ai/agents/slide-generator";

/** Vercel Hobby's limit. Slides are generated one at a time, a few seconds each, for at most 12 slides. */
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  const body = await parseRequestBody(request, generateRequestSchema);
  if (!body.ok) return body.response;

  // `request.signal` aborts when the browser disconnects or presses Stop, which also cancels the Sarvam request.
  return eventStreamResponse((emit) => generateSlides({ ...body.data, signal: request.signal, emit }));
}
