import { http, HttpResponse } from "msw";
import type { AiErrorCode, AiStreamEvent, Outline } from "@/features/ai/types";
import { encodeStreamEvent, NDJSON_CONTENT_TYPE } from "@/features/ai/utils/stream-protocol";
import { server } from "./server";

const CHAT_ROUTE = "*/api/ai/chat";
const OUTLINE_ROUTE = "*/api/ai/outline";
const GENERATE_ROUTE = "*/api/ai/generate";

/**
 * Answers successive requests to a streaming AI route with one list of events per request (the
 * last list is reused if more requests arrive) and records each request body for assertions.
 */
function mockEventStreamRoute(route: string, responses: AiStreamEvent[][]): { requests: unknown[] } {
  const requests: unknown[] = [];
  server.use(
    http.post(route, async ({ request }) => {
      requests.push(await request.json());
      const events = responses[Math.min(requests.length - 1, responses.length - 1)];
      return new HttpResponse(events.map(encodeStreamEvent).join(""), {
        headers: { "Content-Type": NDJSON_CONTENT_TYPE },
      });
    }),
  );
  return { requests };
}

export function mockChatRoute(...responses: AiStreamEvent[][]): { requests: unknown[] } {
  return mockEventStreamRoute(CHAT_ROUTE, responses);
}

export function mockGenerateRoute(...responses: AiStreamEvent[][]): { requests: unknown[] } {
  return mockEventStreamRoute(GENERATE_ROUTE, responses);
}

type OutlineRouteResponse =
  | { outline: Outline }
  | { error: { code: AiErrorCode; message: string; retryable: boolean } };

/** Answers outline requests like the real route: 200 with the outline, or 502 with an AI failure. */
export function mockOutlineRoute(response: OutlineRouteResponse): { requests: unknown[] } {
  const requests: unknown[] = [];
  server.use(
    http.post(OUTLINE_ROUTE, async ({ request }) => {
      requests.push(await request.json());
      return "outline" in response ? HttpResponse.json(response) : HttpResponse.json(response, { status: 502 });
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
