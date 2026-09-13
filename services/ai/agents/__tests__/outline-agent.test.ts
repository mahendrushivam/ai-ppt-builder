import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AiErrorCode, SlideVisual } from "@/features/ai/types";
import { mockSarvamRounds, sarvamSse } from "@/testing/msw/sarvam";
import { server } from "@/testing/msw/server";
import { SARVAM_CHAT_URL } from "../../api/sarvam-client";
import { GenerationToolName } from "../../tools/generation-tools";
import { createOutline } from "../outline-agent";

function outlineRound(slideTitles: string[], callId = "call_outline") {
  const slides = slideTitles.map((title, index) => ({
    title,
    layout: index === 0 ? "title" : "content",
    keyPoints: index === 0 ? [] : ["Ship faster"],
  }));
  return sarvamSse([
    {
      toolCall: {
        id: callId,
        name: GenerationToolName.CreateOutline,
        arguments: JSON.stringify({ deckTitle: "Q3 Roadmap", slides }),
      },
    },
    { finish: "tool_calls" },
  ]);
}

function draft(slideCount: number) {
  return createOutline({
    prompt: "Our Q3 product roadmap",
    slideCount,
    signal: new AbortController().signal,
    retryDelayMs: 0,
  });
}

beforeEach(() => {
  vi.stubEnv("SARVAM_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createOutline", () => {
  test("forces the outline tool without reasoning and fills in defaults", async () => {
    const { requests } = mockSarvamRounds(outlineRound(["Q3 Roadmap", "Themes", "Timeline"]));

    const result = await draft(3);

    expect(result).toEqual({
      ok: true,
      outline: {
        deckTitle: "Q3 Roadmap",
        slides: [
          { title: "Q3 Roadmap", layout: "title", keyPoints: [], visual: SlideVisual.None },
          { title: "Themes", layout: "content", keyPoints: ["Ship faster"], visual: SlideVisual.None },
          { title: "Timeline", layout: "content", keyPoints: ["Ship faster"], visual: SlideVisual.None },
        ],
      },
    });
    expect(requests[0]).toMatchObject({
      tool_choice: { type: "function", function: { name: GenerationToolName.CreateOutline } },
      reasoning_effort: null,
    });
  });

  test("sends a wrong slide count back to the model and accepts the corrected outline", async () => {
    const { requests } = mockSarvamRounds(
      outlineRound(["Q3 Roadmap", "Themes"]),
      outlineRound(["Q3 Roadmap", "Themes", "Timeline"], "call_fixed"),
    );

    const result = await draft(3);

    expect(result.ok).toBe(true);
    expect(JSON.stringify(requests[1])).toContain("must have exactly 3 slides");
  });

  test("reports a failure when the outline is still invalid after a correction", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockSarvamRounds(outlineRound(["Only one slide"]));

    const result = await draft(3);

    expect(result).toMatchObject({ ok: false, failure: { code: AiErrorCode.IncompleteResponse, retryable: true } });
  });

  test("reports a rate limit as a retryable failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.post(SARVAM_CHAT_URL, () => HttpResponse.json({ error: { message: "Slow down" } }, { status: 429 })));

    const result = await draft(3);

    expect(result).toMatchObject({ ok: false, failure: { code: AiErrorCode.RateLimited, retryable: true } });
  });
});
