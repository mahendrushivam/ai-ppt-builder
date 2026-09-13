import { http, HttpResponse } from "msw";
import type { AiStreamEvent } from "@/features/ai/types";
import { encodeStreamEvent, NDJSON_CONTENT_TYPE } from "@/features/ai/utils/stream-protocol";
import { server } from "./server";

const CHAT_ROUTE = "*/api/ai/chat";

/**
 * Answers successive chat requests with one list of stream events per request (the last list
 * is reused if more requests arrive) and records each request body for assertions.
 */
export function mockChatRoute(...responses: AiStreamEvent[][]): { requests: unknown[] } {
  const requests: unknown[] = [];
  server.use(
    http.post(CHAT_ROUTE, async ({ request }) => {
      requests.push(await request.json());
      const events = responses[Math.min(requests.length - 1, responses.length - 1)];
      return new HttpResponse(events.map(encodeStreamEvent).join(""), {
        headers: { "Content-Type": NDJSON_CONTENT_TYPE },
      });
    }),
  );
  return { requests };
}

/**
 * Answers a chat request with a stream that stays open, so a test can check the UI in the
 * middle of a turn and then send the rest of the events.
 */
export function mockOpenChatStream(...initialEvents: AiStreamEvent[]) {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;

  const enqueue = (events: AiStreamEvent[]) => {
    for (const event of events) controller?.enqueue(encoder.encode(encodeStreamEvent(event)));
  };

  server.use(
    http.post(
      CHAT_ROUTE,
      () =>
        new HttpResponse(
          new ReadableStream<Uint8Array>({
            start(streamController) {
              controller = streamController;
              enqueue(initialEvents);
            },
          }),
          { headers: { "Content-Type": NDJSON_CONTENT_TYPE } },
        ),
    ),
  );

  return {
    send: (...events: AiStreamEvent[]) => enqueue(events),
    close: () => controller?.close(),
  };
}
