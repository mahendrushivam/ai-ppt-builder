import { describe, expect, test } from "vitest";
import { expectFailure, expectOk } from "@/testing/assertions";
import { column, contentSlide, deckWith, paragraph, twoColumnSlide } from "@/testing/fixtures";
import { type Deck, OperationFailureCode, type Slide } from "../../types";
import { createBlankSlide } from "../create";
import { applyOperation } from "../operations";
import { deckOperationSchema } from "../schema";

const slideIds = (deck: Deck) => deck.slides.map((slide) => slide.id);

describe("slide.add", () => {
  test("inserts after the anchor without touching other slides or the input deck", () => {
    const deck = deckWith(contentSlide("a"), contentSlide("b"));

    const next = expectOk(
      applyOperation(deck, { type: "slide.add", slide: contentSlide("new"), afterSlideId: "a" }),
    );

    expect(slideIds(next)).toEqual(["a", "new", "b"]);
    expect(next.slides[0]).toBe(deck.slides[0]);
    expect(slideIds(deck)).toEqual(["a", "b"]);
  });

  test("inserts at the start when afterSlideId is null", () => {
    const deck = deckWith(contentSlide("a"));

    const next = expectOk(
      applyOperation(deck, { type: "slide.add", slide: contentSlide("new"), afterSlideId: null }),
    );

    expect(slideIds(next)).toEqual(["new", "a"]);
  });

  test("appends when the anchor slide no longer exists", () => {
    const deck = deckWith(contentSlide("a"), contentSlide("b"));

    const next = expectOk(
      applyOperation(deck, { type: "slide.add", slide: contentSlide("new"), afterSlideId: "gone" }),
    );

    expect(slideIds(next)).toEqual(["a", "b", "new"]);
  });

  test("rejects a duplicate slide id", () => {
    const deck = deckWith(contentSlide("a"));

    expectFailure(
      applyOperation(deck, { type: "slide.add", slide: contentSlide("a"), afterSlideId: null }),
      OperationFailureCode.Invalid,
    );
  });

  test("rejects a slide that breaks schema rules", () => {
    const deck = deckWith();
    const broken: Slide = { ...contentSlide("a"), columns: [] };

    const failure = expectFailure(
      applyOperation(deck, { type: "slide.add", slide: broken, afterSlideId: null }),
      OperationFailureCode.Invalid,
    );

    expect(failure.message).toContain('Layout "content" needs 1 column(s)');
  });

  test("rejects adding beyond the slide limit", () => {
    const deck = deckWith(...Array.from({ length: 30 }, (_, index) => contentSlide(`s${index}`)));

    expectFailure(
      applyOperation(deck, { type: "slide.add", slide: contentSlide("new"), afterSlideId: null }),
      OperationFailureCode.Invalid,
    );
  });
});

describe("slide.update", () => {
  test("changes only the patched fields and bumps the revision", () => {
    const deck = deckWith(contentSlide("a"), contentSlide("b", [paragraph("keep")]));

    const next = expectOk(
      applyOperation(deck, {
        type: "slide.update",
        slideId: "b",
        baseRevision: 0,
        patch: { title: "Shorter" },
      }),
    );

    const [first, updated] = next.slides;
    expect(updated.title).toBe("Shorter");
    expect(updated.revision).toBe(1);
    expect(updated.columns).toBe(deck.slides[1].columns);
    expect(first).toBe(deck.slides[0]);
  });

  test("removes the subtitle when patched with null", () => {
    const deck = deckWith({ ...contentSlide("a"), subtitle: "Old subtitle" });

    const next = expectOk(
      applyOperation(deck, {
        type: "slide.update",
        slideId: "a",
        baseRevision: 0,
        patch: { subtitle: null },
      }),
    );

    expect(next.slides[0].subtitle).toBeNull();
  });

  test("rejects an edit prepared against a stale revision", () => {
    const deck = deckWith(contentSlide("a", [], 2));

    const failure = expectFailure(
      applyOperation(deck, {
        type: "slide.update",
        slideId: "a",
        baseRevision: 1,
        patch: { title: "AI rewrite" },
      }),
      OperationFailureCode.Conflict,
    );

    expect(failure.message).toContain("revision 2, expected 1");
  });

  test("rejects unknown slides and empty patches", () => {
    const deck = deckWith(contentSlide("a"));

    expectFailure(
      applyOperation(deck, { type: "slide.update", slideId: "x", baseRevision: 0, patch: { title: "t" } }),
      OperationFailureCode.NotFound,
    );
    expectFailure(
      applyOperation(deck, { type: "slide.update", slideId: "a", baseRevision: 0, patch: {} }),
      OperationFailureCode.Invalid,
    );
  });

  test("rejects a patch that would make the slide invalid", () => {
    const deck = deckWith(contentSlide("a"));

    expectFailure(
      applyOperation(deck, {
        type: "slide.update",
        slideId: "a",
        baseRevision: 0,
        patch: { columns: [] },
      }),
      OperationFailureCode.Invalid,
    );
  });
});

describe("slide.delete", () => {
  test("removes the slide", () => {
    const deck = deckWith(contentSlide("a"), contentSlide("b"));

    const next = expectOk(applyOperation(deck, { type: "slide.delete", slideId: "a", baseRevision: 0 }));

    expect(slideIds(next)).toEqual(["b"]);
  });

  test("rejects deleting a slide that changed or does not exist", () => {
    const deck = deckWith(contentSlide("a", [], 3));

    expectFailure(applyOperation(deck, { type: "slide.delete", slideId: "a", baseRevision: 0 }), OperationFailureCode.Conflict);
    expectFailure(applyOperation(deck, { type: "slide.delete", slideId: "x", baseRevision: 0 }), OperationFailureCode.NotFound);
  });
});

describe("slide.move", () => {
  const deck = deckWith(contentSlide("a"), contentSlide("b"), contentSlide("c"));

  test("moves a slide to the start or after an anchor without changing its revision", () => {
    const toStart = expectOk(applyOperation(deck, { type: "slide.move", slideId: "c", afterSlideId: null }));
    const afterA = expectOk(applyOperation(deck, { type: "slide.move", slideId: "c", afterSlideId: "a" }));

    expect(slideIds(toStart)).toEqual(["c", "a", "b"]);
    expect(slideIds(afterA)).toEqual(["a", "c", "b"]);
    expect(afterA.slides[1]).toBe(deck.slides[2]);
  });

  test("rejects moving a slide after itself or moving an unknown slide", () => {
    expectFailure(applyOperation(deck, { type: "slide.move", slideId: "a", afterSlideId: "a" }), OperationFailureCode.Invalid);
    expectFailure(applyOperation(deck, { type: "slide.move", slideId: "x", afterSlideId: null }), OperationFailureCode.NotFound);
  });
});

describe("slide.changeLayout", () => {
  test("splits blocks across two columns in order and keeps the existing column", () => {
    const deck = deckWith(contentSlide("a", [paragraph("1"), paragraph("2"), paragraph("3")]));

    const next = expectOk(
      applyOperation(deck, { type: "slide.changeLayout", slideId: "a", baseRevision: 0, layout: "two-column" }),
    );

    const [left, right] = next.slides[0].columns;
    expect(next.slides[0].layout).toBe("two-column");
    expect(next.slides[0].revision).toBe(1);
    expect(left.id).toBe("a_col");
    expect(left.blocks.map((block) => block.id)).toEqual(["block_1", "block_2"]);
    expect(right.blocks.map((block) => block.id)).toEqual(["block_3"]);
  });

  test("merges two columns into one in order", () => {
    const deck = deckWith(twoColumnSlide("a", [paragraph("1")], [paragraph("2")]));

    const next = expectOk(
      applyOperation(deck, { type: "slide.changeLayout", slideId: "a", baseRevision: 0, layout: "content" }),
    );

    expect(next.slides[0].columns).toEqual([
      { id: "a_left", heading: null, blocks: [paragraph("1"), paragraph("2")] },
    ]);
  });

  test("drops columns for a title layout and creates empty columns when leaving it", () => {
    const deck = deckWith(contentSlide("a", [paragraph("1")]));

    const titled = expectOk(
      applyOperation(deck, { type: "slide.changeLayout", slideId: "a", baseRevision: 0, layout: "title" }),
    );
    const comparison = expectOk(
      applyOperation(titled, { type: "slide.changeLayout", slideId: "a", baseRevision: 1, layout: "comparison" }),
    );

    expect(titled.slides[0].columns).toEqual([]);
    expect(comparison.slides[0].columns).toHaveLength(2);
    expect(comparison.slides[0].columns.every((col) => col.blocks.length === 0)).toBe(true);
  });

  test("explains why a merge that exceeds the block limit is rejected", () => {
    const blocks = (prefix: string) => [1, 2, 3].map((n) => paragraph(`${prefix}${n}`));
    const deck = deckWith(twoColumnSlide("a", blocks("l"), blocks("r")));

    const failure = expectFailure(
      applyOperation(deck, { type: "slide.changeLayout", slideId: "a", baseRevision: 0, layout: "content" }),
      OperationFailureCode.Invalid,
    );

    expect(failure.message).toContain("6 blocks in one column (max 4)");
  });

  test("uses explicitly provided columns", () => {
    const deck = deckWith(contentSlide("a", [paragraph("old")]));
    const columns = [column("before", [paragraph("x")], "Before"), column("after", [paragraph("y")], "After")];

    const next = expectOk(
      applyOperation(deck, {
        type: "slide.changeLayout",
        slideId: "a",
        baseRevision: 0,
        layout: "comparison",
        columns,
      }),
    );

    expect(next.slides[0].columns).toEqual(columns);
  });

  test("returns the same deck when the layout does not change", () => {
    const deck = deckWith(contentSlide("a"));

    const result = applyOperation(deck, { type: "slide.changeLayout", slideId: "a", baseRevision: 0, layout: "content" });

    expect(expectOk(result)).toBe(deck);
  });
});

describe("deck operations", () => {
  test("renames the deck and rejects a blank title", () => {
    const deck = deckWith();

    expect(expectOk(applyOperation(deck, { type: "deck.rename", title: "Q3 Roadmap" })).title).toBe("Q3 Roadmap");
    expectFailure(applyOperation(deck, { type: "deck.rename", title: "  " }), OperationFailureCode.Invalid);
  });

  test("changes the theme without touching slides", () => {
    const deck = deckWith(contentSlide("a"));

    const next = expectOk(applyOperation(deck, { type: "deck.setTheme", themeId: "midnight" }));

    expect(next.themeId).toBe("midnight");
    expect(next.slides).toBe(deck.slides);
  });
});

describe("deckOperationSchema", () => {
  test("accepts an operation that went through JSON serialization", () => {
    const operation = { type: "slide.add", slide: createBlankSlide("two-column"), afterSlideId: null };

    const result = deckOperationSchema.safeParse(JSON.parse(JSON.stringify(operation)));

    expect(result.success).toBe(true);
  });

  test("rejects unknown operation types and malformed payloads", () => {
    expect(deckOperationSchema.safeParse({ type: "deck.replace", slides: [] }).success).toBe(false);
    expect(
      deckOperationSchema.safeParse({ type: "slide.update", slideId: "a", baseRevision: -1, patch: {} }).success,
    ).toBe(false);
  });
});

describe("block.move", () => {
  const leftAndRight = () => twoColumnSlide("s", [paragraph("a"), paragraph("b")], [paragraph("c")]);
  const blockIds = (deck: Deck, columnIndex: number) =>
    deck.slides[0].columns[columnIndex].blocks.map((block) => block.id);
  const move = (blockId: string, toColumnId: string, toIndex: number, baseRevision = 0) =>
    ({ type: "block.move", slideId: "s", baseRevision, blockId, toColumnId, toIndex }) as const;

  test("reorders a block within its column without touching the other column", () => {
    const deck = deckWith(leftAndRight());

    const next = expectOk(applyOperation(deck, move("block_a", "s_left", 1)));

    expect(blockIds(next, 0)).toEqual(["block_b", "block_a"]);
    expect(next.slides[0].revision).toBe(1);
    expect(next.slides[0].columns[1]).toBe(deck.slides[0].columns[1]);
  });

  test("moves a block into another column at the given position", () => {
    const deck = deckWith(leftAndRight());

    const next = expectOk(applyOperation(deck, move("block_b", "s_right", 0)));

    expect(blockIds(next, 0)).toEqual(["block_a"]);
    expect(blockIds(next, 1)).toEqual(["block_b", "block_c"]);
  });

  test("changes nothing when the block is dropped where it already is", () => {
    const deck = deckWith(leftAndRight());

    expect(expectOk(applyOperation(deck, move("block_a", "s_left", 0)))).toBe(deck);
  });

  test("rejects a move into a full column", () => {
    const full = twoColumnSlide("s", [paragraph("a")], ["c", "d", "e", "f"].map(paragraph));

    const failure = expectFailure(applyOperation(deckWith(full), move("block_a", "s_right", 0)), OperationFailureCode.Invalid);

    expect(failure.message).toContain("at most 4 blocks");
  });

  test("rejects a stale revision, a missing block or column and a position past the end", () => {
    const deck = deckWith(leftAndRight());

    expectFailure(applyOperation(deck, move("block_a", "s_right", 0, 3)), OperationFailureCode.Conflict);
    expectFailure(applyOperation(deck, move("block_gone", "s_right", 0)), OperationFailureCode.NotFound);
    expectFailure(applyOperation(deck, move("block_a", "s_gone", 0)), OperationFailureCode.NotFound);
    expectFailure(applyOperation(deck, move("block_a", "s_right", 2)), OperationFailureCode.Invalid);
  });
});

describe("slide.resize", () => {
  const resize = (fields: { columnSplit?: number; blockSizes?: { blockId: string; size: number | null }[] }) =>
    ({ type: "slide.resize", slideId: "s", baseRevision: 0, ...fields }) as const;

  test("sets the column split and the heights of one column's blocks", () => {
    const deck = deckWith(twoColumnSlide("s", [paragraph("a"), paragraph("b")], [paragraph("c")]));

    const next = expectOk(
      applyOperation(
        deck,
        resize({ columnSplit: 60, blockSizes: [{ blockId: "block_a", size: 70 }, { blockId: "block_b", size: 30 }] }),
      ),
    );

    const [slide] = next.slides;
    expect(slide.hints.columnSplit).toBe(60);
    expect(slide.columns[0].blocks.map((block) => block.size)).toEqual([70, 30]);
    expect(slide.columns[1]).toBe(deck.slides[0].columns[1]);
    expect(slide.revision).toBe(1);
  });

  test("returns blocks to their content height", () => {
    const sized = twoColumnSlide("s", [{ ...paragraph("a"), size: 40 }, { ...paragraph("b"), size: 60 }], []);

    const next = expectOk(
      applyOperation(
        deckWith(sized),
        resize({ blockSizes: [{ blockId: "block_a", size: null }, { blockId: "block_b", size: null }] }),
      ),
    );

    expect(next.slides[0].columns[0].blocks.map((block) => block.size)).toEqual([undefined, undefined]);
  });

  test("rejects heights for only some blocks of a column", () => {
    const deck = deckWith(twoColumnSlide("s", [paragraph("a"), paragraph("b")], []));

    expectFailure(applyOperation(deck, resize({ blockSizes: [{ blockId: "block_a", size: 50 }] })), OperationFailureCode.Invalid);
  });

  test("rejects a column split on a one-column slide and an empty resize", () => {
    const deck = deckWith(contentSlide("s", [paragraph("a")]));

    expectFailure(applyOperation(deck, resize({ columnSplit: 40 })), OperationFailureCode.Invalid);
    expectFailure(applyOperation(deck, resize({})), OperationFailureCode.Invalid);
  });

  test("rejects sizes outside the allowed ranges", () => {
    expect(deckOperationSchema.safeParse(resize({ columnSplit: 80 })).success).toBe(false);
    expect(deckOperationSchema.safeParse(resize({ blockSizes: [{ blockId: "block_a", size: 5 }] })).success).toBe(false);
  });
});
