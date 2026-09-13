import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NDJSON_CONTENT_TYPE } from "@/features/ai/utils/stream-protocol";
import { contentSlide, deckWith } from "@/testing/fixtures";
import { mockSarvamRounds, sarvamSse } from "@/testing/msw/sarvam";
import { POST } from "../route";

function chatRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/ai/chat", {
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

describe("POST /api/ai/chat", () => {
  test("should reject a request without a deck or a user message", async () => {
    const response = await POST(chatRequest({ messages: [] }));

    expect(response.status).toBe(400);
  });

  test("should stream the chat turn as NDJSON events", async () => {
    mockSarvamRounds(
      sarvamSse([{ content: "Your deck has one slide." }, { finish: "stop" }]),
    );

    const response = await POST(
      chatRequest({
        deck: deckWith(contentSlide("slide_a")),
        messages: [{ role: "user", content: "How many slides are there?" }],
        selectedSlideId: null,
      }),
    );

    expect(response.headers.get("Content-Type")).toBe(NDJSON_CONTENT_TYPE);
    const events = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(events.slice(-2)).toEqual([
      { type: "message", text: "Your deck has one slide." },
      { type: "done" },
    ]);
  });
});
