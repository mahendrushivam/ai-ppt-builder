import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  AiErrorCode,
  type AiStreamEvent,
  AiStreamEventType,
  type Outline,
  SlideGenerationStatus,
  SlideVisual,
} from "@/features/ai/types";
import { BlockType } from "@/features/deck/types";
import { mockSarvamRounds, sarvamSse } from "@/testing/msw/sarvam";
import { server } from "@/testing/msw/server";
import { SARVAM_CHAT_URL } from "../../api/sarvam-client";
import { GenerationToolName } from "../../tools/generation-tools";
import { generateSlides } from "../slide-generator";

const outline: Outline = {
  deckTitle: "Q3 Roadmap",
  slides: [
    { title: "Q3 Roadmap", layout: "title", keyPoints: [], visual: SlideVisual.None },
    { title: "Themes", layout: "content", keyPoints: ["Speed", "Quality"], visual: SlideVisual.None },
    { title: "Timeline", layout: "content", keyPoints: ["July to September"], visual: SlideVisual.None },
    { title: "Pricing", layout: "content", keyPoints: ["Starter", "Pro"], visual: SlideVisual.Table },
  ],
};

const titleSlideInput = { layout: "title", title: "Q3 Roadmap", subtitle: "Product team" };
const themesSlideInput = {
  layout: "content",
  title: "Themes",
  columns: [{ blocks: [{ type: "bullets", items: ["Speed", "Quality"] }] }],
};
const timelineSlideInput = {
  layout: "content",
  title: "Timeline",
  columns: [{ blocks: [{ type: "paragraph", text: "July to September" }] }],
};

function slideRound(slide: unknown, callId = "call_slide") {
  return sarvamSse([
    { toolCall: { id: callId, name: GenerationToolName.CreateSlide, arguments: JSON.stringify(slide) } },
    { finish: "tool_calls" },
  ]);
}

async function generate(outlineIndexes: number[]) {
  const events: AiStreamEvent[] = [];
  await generateSlides({
    prompt: "Our Q3 product roadmap",
    outline,
    outlineIndexes,
    afterSlideId: "slide_existing",
    signal: new AbortController().signal,
    emit: (event) => events.push(event),
    retryDelayMs: 0,
  });
  return events;
}

function progressOf(events: AiStreamEvent[]) {
  return events.flatMap((event) =>
    event.type === AiStreamEventType.SlideProgress ? [[event.outlineIndex, event.status]] : [],
  );
}

function addedSlidesOf(events: AiStreamEvent[]) {
  return events.flatMap((event) =>
    event.type === AiStreamEventType.Operation && event.operation.type === "slide.add" ? [event.operation] : [],
  );
}

beforeEach(() => {
  vi.stubEnv("SARVAM_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("generateSlides", () => {
  test("adds slides in outline order, each placed after the previous one", async () => {
    const { requests } = mockSarvamRounds(slideRound(titleSlideInput), slideRound(themesSlideInput));

    const events = await generate([0, 1]);

    const added = addedSlidesOf(events);
    expect(added.map((operation) => operation.slide.title)).toEqual(["Q3 Roadmap", "Themes"]);
    expect(added.map((operation) => operation.afterSlideId)).toEqual(["slide_existing", added[0].slide.id]);
    expect(progressOf(events)).toEqual([
      [0, SlideGenerationStatus.Generating],
      [0, SlideGenerationStatus.Done],
      [1, SlideGenerationStatus.Generating],
      [1, SlideGenerationStatus.Done],
    ]);
    expect(events.at(-1)).toEqual({ type: AiStreamEventType.Done });
    expect(requests[0]).toMatchObject({
      tool_choice: { type: "function", function: { name: GenerationToolName.CreateSlide } },
      reasoning_effort: null,
    });
  });

  test("retries an invalid slide once, then marks it failed and keeps generating", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const missingColumns = { layout: "content", title: "Themes" };
    const { requests } = mockSarvamRounds(
      slideRound(missingColumns, "call_invalid"),
      slideRound(missingColumns, "call_still_invalid"),
      slideRound(timelineSlideInput),
    );

    const events = await generate([1, 2]);

    expect(progressOf(events)).toEqual([
      [1, SlideGenerationStatus.Generating],
      [1, SlideGenerationStatus.Failed],
      [2, SlideGenerationStatus.Generating],
      [2, SlideGenerationStatus.Done],
    ]);
    expect(addedSlidesOf(events).map((operation) => [operation.slide.title, operation.afterSlideId])).toEqual([
      ["Timeline", "slide_existing"],
    ]);
    expect(JSON.stringify(requests[1])).toContain("Error: Invalid arguments");
    expect(requests).toHaveLength(3);
  });

  test("asks for the outline's layout when the model picks a different one", async () => {
    const { requests } = mockSarvamRounds(slideRound({ ...titleSlideInput, title: "Themes" }), slideRound(themesSlideInput));

    const events = await generate([1]);

    expect(addedSlidesOf(events)[0].slide.layout).toBe("content");
    expect(JSON.stringify(requests[1])).toContain('Use the \\"content\\" layout from the outline');
  });

  test("asks for the visual the outline planned", async () => {
    const pricingWithBullets = {
      layout: "content",
      title: "Pricing",
      columns: [{ blocks: [{ type: "bullets", items: ["Starter", "Pro"] }] }],
    };
    const pricingWithTable = {
      layout: "content",
      title: "Pricing",
      columns: [{ blocks: [{ type: "table", header: ["Plan", "Price"], rows: [["Starter", "$10"]] }] }],
    };
    const { requests } = mockSarvamRounds(slideRound(pricingWithBullets), slideRound(pricingWithTable));

    const events = await generate([3]);

    expect(addedSlidesOf(events)[0].slide.columns[0].blocks[0].type).toBe(BlockType.Table);
    expect(JSON.stringify(requests[1])).toContain("Add a table block");
  });

  test("stops with a retryable error when the AI service is rate limited", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.post(SARVAM_CHAT_URL, () => HttpResponse.json({ error: { message: "Slow down" } }, { status: 429 })));

    const events = await generate([0, 1]);

    expect(events).toEqual([
      { type: AiStreamEventType.SlideProgress, outlineIndex: 0, status: SlideGenerationStatus.Generating },
      expect.objectContaining({ type: AiStreamEventType.Error, code: AiErrorCode.RateLimited, retryable: true }),
    ]);
  });
});
