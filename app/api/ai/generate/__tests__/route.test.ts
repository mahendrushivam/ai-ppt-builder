import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NDJSON_CONTENT_TYPE } from "@/features/ai/utils/stream-protocol";
import { mockSarvamRounds, sarvamSse } from "@/testing/msw/sarvam";
import { POST } from "../route";

const outline = { deckTitle: "Q3 Roadmap", slides: [{ title: "Q3 Roadmap", layout: "title" }] };

function generateRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("SARVAM_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/ai/generate", () => {
  test("rejects outline indexes that are not in the outline", async () => {
    const response = await POST(
      generateRequest({ prompt: "Our Q3 roadmap", outline, outlineIndexes: [3], afterSlideId: null }),
    );

    expect(response.status).toBe(400);
  });

  test("streams the generated slides as NDJSON events", async () => {
    mockSarvamRounds(
      sarvamSse([
        {
          toolCall: {
            id: "call_1",
            name: "create_slide",
            arguments: JSON.stringify({ layout: "title", title: "Q3 Roadmap" }),
          },
        },
        { finish: "tool_calls" },
      ]),
    );

    const response = await POST(
      generateRequest({ prompt: "Our Q3 roadmap", outline, outlineIndexes: [0], afterSlideId: null }),
    );

    expect(response.headers.get("Content-Type")).toBe(NDJSON_CONTENT_TYPE);
    const events = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(events.map((event) => event.type)).toEqual(["slide_progress", "operation", "slide_progress", "done"]);
    expect(events[1]).toMatchObject({ operation: { type: "slide.add", afterSlideId: null, slide: { title: "Q3 Roadmap" } } });
  });
});
