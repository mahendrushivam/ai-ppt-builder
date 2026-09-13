import { describe, expect, test } from "vitest";
import { contentSlide, deckWith } from "@/testing/fixtures";
import { ChatToolName, executeToolCall } from "../slide-tools";

const deck = deckWith(contentSlide("slide_a"), contentSlide("slide_b"));

function call(name: string, args: unknown) {
  return executeToolCall(deck, name, JSON.stringify(args));
}

describe("executeToolCall", () => {
  test("applies a valid call and describes the slide by position", () => {
    const result = call(ChatToolName.UpdateSlide, { slideId: "slide_b", title: "Pricing" });

    expect(result).toMatchObject({
      ok: true,
      operation: { type: "slide.update", slideId: "slide_b", baseRevision: 0, patch: { title: "Pricing" } },
      summary: "Updated slide 2 (slide_b).",
    });
    if (result.ok) expect(result.deck.slides[1].title).toBe("Pricing");
  });

  test("returns fixable errors for invalid arguments, unknown slides and unknown tools", () => {
    const failures = [
      call(ChatToolName.UpdateSlide, { slideId: "slide_a", title: "" }),
      call(ChatToolName.DeleteSlide, { slideId: "slide_missing" }),
      call("launch_rockets", {}),
      executeToolCall(deck, ChatToolName.UpdateSlide, '{"slideId": "slide_a", "title": "Pri'),
    ];

    for (const failure of failures) {
      expect(failure).toMatchObject({ ok: false, needsCorrection: true });
    }
  });

  test("reports changes that are already done instead of applying them again", () => {
    const repeated = [
      call(ChatToolName.UpdateSlide, { slideId: "slide_a", title: "Slide slide_a" }),
      call(ChatToolName.MoveSlide, { slideId: "slide_b", afterSlideId: "slide_a" }),
      call(ChatToolName.ChangeLayout, { slideId: "slide_a", layout: "content" }),
    ];

    for (const result of repeated) {
      expect(result).toMatchObject({ ok: false, needsCorrection: false, message: expect.stringContaining("Nothing was changed") });
    }
  });
});
