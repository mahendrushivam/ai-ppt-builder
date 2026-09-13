import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mockSarvamRounds, sarvamSse } from "@/testing/msw/sarvam";
import { POST } from "../route";

function outlineRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/ai/outline", {
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

describe("POST /api/ai/outline", () => {
  test("rejects a slide count outside the allowed range", async () => {
    const response = await POST(outlineRequest({ prompt: "Our Q3 roadmap", slideCount: 40 }));

    expect(response.status).toBe(400);
  });

  test("returns the drafted outline", async () => {
    mockSarvamRounds(
      sarvamSse([
        {
          toolCall: {
            id: "call_1",
            name: "create_outline",
            arguments: JSON.stringify({ deckTitle: "Q3 Roadmap", slides: [{ title: "Q3 Roadmap", layout: "title" }] }),
          },
        },
        { finish: "tool_calls" },
      ]),
    );

    const response = await POST(outlineRequest({ prompt: "Our Q3 roadmap", slideCount: 1 }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      outline: { deckTitle: "Q3 Roadmap", slides: [{ title: "Q3 Roadmap", layout: "title", keyPoints: [], visual: "none" }] },
    });
  });
});
