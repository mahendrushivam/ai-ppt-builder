import { describe, expect, test } from "vitest";
import { SLIDE_LAYOUTS, slideSchema } from "@/features/deck/utils/schema";
import { contentSlide, paragraph, twoColumnSlide } from "@/testing/fixtures";
import {
  bulletsToText,
  createStarterSlide,
  layoutChangeRemovesContent,
  positionForDrop,
  positionForStep,
  selectionAfterDelete,
  textToBullets,
} from "../slide-editing";

const slides = ["a", "b", "c"].map((id) => contentSlide(id));

describe("createStarterSlide", () => {
  test("creates a valid slide for every layout with an empty list in each column", () => {
    for (const layout of SLIDE_LAYOUTS) {
      const slide = createStarterSlide(layout);

      expect(slideSchema.safeParse(slide).success, layout).toBe(true);
      expect(slide.columns.every((column) => column.blocks[0]?.type === "bullets"), layout).toBe(true);
    }
  });
});

describe("bullet text", () => {
  test("round-trips sub-points and keeps item ids by position", () => {
    const items = textToBullets("First\n  Detail\nSecond", []);

    expect(items.map(({ text, level }) => ({ text, level }))).toEqual([
      { text: "First", level: 0 },
      { text: "Detail", level: 1 },
      { text: "Second", level: 0 },
    ]);
    expect(bulletsToText(items)).toBe("First\n  Detail\nSecond");

    const edited = textToBullets("First!\n  Detail\nSecond\nThird", items);
    expect(edited.slice(0, 3).map((item) => item.id)).toEqual(items.map((item) => item.id));
    expect(items.map((item) => item.id)).not.toContain(edited[3].id);
  });
});

describe("slide positions", () => {
  test("moves a slide one step up or down", () => {
    expect(positionForStep(slides, "b", "up")).toEqual({ afterSlideId: null });
    expect(positionForStep(slides, "c", "up")).toEqual({ afterSlideId: "a" });
    expect(positionForStep(slides, "a", "down")).toEqual({ afterSlideId: "b" });
    expect(positionForStep(slides, "a", "up")).toBeNull();
    expect(positionForStep(slides, "c", "down")).toBeNull();
  });

  test("puts a dropped slide in the place of the slide it was dropped on", () => {
    expect(positionForDrop(slides, "a", "c")).toEqual({ afterSlideId: "c" });
    expect(positionForDrop(slides, "c", "a")).toEqual({ afterSlideId: null });
    expect(positionForDrop(slides, "c", "b")).toEqual({ afterSlideId: "a" });
    expect(positionForDrop(slides, "b", "b")).toBeNull();
  });

  test("selects the next slide after a delete, or the previous one at the end", () => {
    expect(selectionAfterDelete(slides, "a")).toBe("b");
    expect(selectionAfterDelete(slides, "c")).toBe("b");
    expect(selectionAfterDelete([slides[0]], "a")).toBeNull();
  });
});

test("flags a layout change only when it would remove content", () => {
  expect(layoutChangeRemovesContent(contentSlide("a", [paragraph("x")]), "title")).toBe(true);
  expect(layoutChangeRemovesContent(contentSlide("a"), "title")).toBe(false);
  expect(layoutChangeRemovesContent(twoColumnSlide("a", [paragraph("x")], []), "content")).toBe(false);
});
