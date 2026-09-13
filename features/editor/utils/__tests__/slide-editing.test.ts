import { describe, expect, test } from "vitest";
import { BlockType } from "@/features/deck/types";
import { blockSchema, LIMITS, SLIDE_LAYOUTS, slideSchema } from "@/features/deck/utils/schema";
import { bullets, contentSlide, paragraph, twoColumnSlide } from "@/testing/fixtures";
import {
  bulletsFromText,
  bulletsToText,
  convertBlock,
  createBlock,
  insertBlockAfter,
  replacementLosesContent,
  createStarterSlide,
  NEW_BLOCK_LABELS,
  type NewBlockType,
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

describe("createBlock", () => {
  test("creates a valid block of every type the editor can add", () => {
    for (const type of Object.keys(NEW_BLOCK_LABELS) as NewBlockType[]) {
      expect(blockSchema.safeParse(createBlock(type)).success, type).toBe(true);
    }
  });
});

describe("bullets saved from typed text", () => {
  const points = (count: number) => Array.from({ length: count }, (_, index) => `Point ${index + 1}`);

  test("keeps the points a list can hold and explains which lines aren't saved", () => {
    const { items, overflow } = bulletsFromText(points(LIMITS.bulletsPerBlock + 2).join("\n"), []);

    expect(items).toHaveLength(LIMITS.bulletsPerBlock);
    expect(overflow).toBe("A list shows up to 8 points, so the last 2 lines aren't saved. Add another list for more.");
    // A new, still empty line in a full list loses nothing.
    expect(bulletsFromText(`${points(LIMITS.bulletsPerBlock).join("\n")}\n`, []).overflow).toBeNull();
  });

  test("cuts points that are too long", () => {
    const { items, overflow } = bulletsFromText("x".repeat(LIMITS.bulletText + 5), []);

    expect(items[0].text).toHaveLength(LIMITS.bulletText);
    expect(overflow).toBe("Points can be up to 220 characters, so longer text isn't saved.");
  });
});

describe("replacing blocks", () => {
  test("turns bullets into a paragraph and back without losing text", () => {
    const list = bullets("list", ["Fast", "Cheap"]);

    const text = convertBlock(list, BlockType.Paragraph);

    expect(replacementLosesContent(list, BlockType.Paragraph)).toBe(false);
    expect(text).toEqual({ id: "list", type: BlockType.Paragraph, text: "Fast\nCheap" });
    expect(convertBlock(text, BlockType.Bullets)).toMatchObject({
      id: "list",
      type: BlockType.Bullets,
      items: [
        { text: "Fast", level: 0 },
        { text: "Cheap", level: 0 },
      ],
    });
  });

  test("only asks before replacing content that can't be converted", () => {
    const list = bullets("list", ["Fast"]);

    expect(replacementLosesContent(list, BlockType.Chart)).toBe(true);
    expect(replacementLosesContent(bullets("empty", [""]), BlockType.Chart)).toBe(false);
    expect(convertBlock(list, BlockType.Chart)).toMatchObject({ id: "list", type: BlockType.Chart });
    expect(blockSchema.safeParse(convertBlock(list, BlockType.Chart)).success).toBe(true);
  });

  test("inserts a new block right after another one", () => {
    const slide = contentSlide("a", [paragraph("one"), paragraph("two")]);

    const [column] = insertBlockAfter(slide, "block_one", paragraph("new"));

    expect(column.blocks.map((block) => block.id)).toEqual(["block_one", "block_new", "block_two"]);
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
