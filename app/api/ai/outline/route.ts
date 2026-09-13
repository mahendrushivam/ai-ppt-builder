import { outlineRequestSchema } from "@/features/ai/utils/stream-protocol";
import { parseRequestBody } from "@/lib/request";
import { createOutline } from "@/services/ai/agents/outline-agent";

/** One model call, plus a correction round and provider retries in the worst case. */
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const body = await parseRequestBody(request, outlineRequestSchema);
  if (!body.ok) return body.response;

  try {
    const result = await createOutline({ ...body.data, signal: request.signal });
    return result.ok
      ? Response.json({ outline: result.outline })
      : Response.json({ error: result.failure }, { status: 502 });
  } catch (error) {
    // Only an aborted request throws; the browser is no longer waiting for a response.
    if (request.signal.aborted) return new Response(null, { status: 499 });
    throw error;
  }
}
