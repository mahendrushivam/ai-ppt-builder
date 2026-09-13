import { describe, expect, test } from "vitest";
import { BlockType } from "@/features/deck/types";
import { type FindImage } from "@/services/images/openverse";
import { ImageSearchStatus } from "@/services/images/types";
import { contentSlide, deckWith, resolvedImage } from "@/testing/fixtures";
import { ChatToolName, executeToolCall } from "../slide-tools";

const deck = deckWith(contentSlide("slide_a"), contentSlide("slide_b"));

const findNothing: FindImage = async () => ({ status: ImageSearchStatus.NotFound });

function call(name: string, args: unknown, findImage: FindImage = findNothing) {
  return executeToolCall(deck, name, JSON.stringify(args), { findImage, signal: new AbortController().signal });
}

describe("executeToolCall", () => {
  test("applies a valid call and describes the slide by position", async () => {
    const result = await call(ChatToolName.UpdateSlide, { slideId: "slide_b", title: "Pricing" });

    expect(result).toMatchObject({
      ok: true,
      operation: { type: "slide.update", slideId: "slide_b", baseRevision: 0, patch: { title: "Pricing" } },
      summary: "Updated slide 2 (slide_b).",
    });
    if (result.ok) expect(result.deck.slides[1].title).toBe("Pricing");
  });

  test("looks up images for image blocks before applying the change", async () => {
    const searches: string[] = [];
    const findTeamPhoto: FindImage = async (query) => {
      searches.push(query);
      return { status: ImageSearchStatus.Found, image: resolvedImage };
    };

    const result = await call(
      ChatToolName.AddSlide,
      {
        afterSlideId: "slide_a",
        slide: {
          layout: "content",
          title: "Our team",
          columns: [{ blocks: [{ type: "image", query: "team meeting", alt: "The team" }] }],
        },
      },
      findTeamPhoto,
    );

    expect(searches).toEqual(["team meeting"]);
    if (!result.ok) throw new Error(result.message);
    expect(result.deck.slides[1].columns[0].blocks[0]).toMatchObject({ type: BlockType.Image, image: resolvedImage });
    expect(result.operation).toMatchObject({ slide: { columns: [{ blocks: [{ image: resolvedImage }] }] } });
  });

  test("returns fixable errors for invalid arguments, unknown slides and unknown tools", async () => {
    const failures = await Promise.all([
      call(ChatToolName.UpdateSlide, { slideId: "slide_a", title: "" }),
      call(ChatToolName.DeleteSlide, { slideId: "slide_missing" }),
      call("launch_rockets", {}),
      executeToolCall(deck, ChatToolName.UpdateSlide, '{"slideId": "slide_a", "title": "Pri', {
        findImage: findNothing,
        signal: new AbortController().signal,
      }),
    ]);

    for (const failure of failures) {
      expect(failure).toMatchObject({ ok: false, needsCorrection: true });
    }
  });

  test("reports changes that are already done instead of applying them again", async () => {
    const repeated = await Promise.all([
      call(ChatToolName.UpdateSlide, { slideId: "slide_a", title: "Slide slide_a" }),
      call(ChatToolName.MoveSlide, { slideId: "slide_b", afterSlideId: "slide_a" }),
      call(ChatToolName.ChangeLayout, { slideId: "slide_a", layout: "content" }),
    ]);

    for (const result of repeated) {
      expect(result).toMatchObject({ ok: false, needsCorrection: false, message: expect.stringContaining("Nothing was changed") });
    }
  });
});
