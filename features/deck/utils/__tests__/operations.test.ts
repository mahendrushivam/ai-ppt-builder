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
