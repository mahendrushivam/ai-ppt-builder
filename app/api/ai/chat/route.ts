import { z } from "zod";
import { runChatTurn } from "@/features/ai/services/agent";
import type { AiStreamEvent } from "@/features/ai/types";
import { chatRequestSchema, encodeStreamEvent, NDJSON_CONTENT_TYPE } from "@/features/ai/utils/stream-protocol";

/** A turn can take several model rounds; each is usually a few seconds. */
export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The request body must be JSON." }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const emit = (event: AiStreamEvent) => {
        if (open) controller.enqueue(encoder.encode(encodeStreamEvent(event)));
      };
      // `request.signal` aborts when the browser disconnects or presses Stop, which also cancels the Sarvam request.
      await runChatTurn({ ...parsed.data, signal: request.signal, emit });
      open = false;
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": NDJSON_CONTENT_TYPE, "Cache-Control": "no-store" } });
}
