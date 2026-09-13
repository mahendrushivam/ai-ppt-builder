import { parseRequestBody } from "@/lib/request";
import { findImage } from "@/services/images/openverse";
import { imageSearchRequestSchema } from "@/services/images/types";

/** One Openverse search with an 8 second timeout. */
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  const body = await parseRequestBody(request, imageSearchRequestSchema);
  if (!body.ok) return body.response;

  try {
    return Response.json(await findImage(body.data.query, request.signal));
  } catch (error) {
    // Only an aborted request throws; the browser is no longer waiting for a response.
    if (request.signal.aborted) return new Response(null, { status: 499 });
    throw error;
  }
}
