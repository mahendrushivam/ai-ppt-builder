import { describe, expect, test } from "vitest";
import { resolvedImage } from "@/testing/fixtures";
import { BlockType, type Slide } from "@/features/deck/types";
import { createBlankSlide, createDeck } from "@/features/deck/utils/create";
import { applyOperation } from "@/features/deck/utils/operations";
import { slideSchema } from "@/features/deck/utils/schema";
import {
  materializeSlide,
  materializeSlidePatch,
  slideInputSchema,
  slidePatchInputSchema,
} from "../slide-input";

function collectIds(slide: Slide): string[] {
  return [
    slide.id,
    ...slide.columns.flatMap((column) => [
      column.id,
      ...column.blocks.flatMap((block) => [
        block.id,
        ...(block.type === "bullets" ? block.items.map((item) => item.id) : []),
      ]),
    ]),
  ];
}

describe("slideInputSchema", () => {
  test("applies defaults and trims model text", () => {
    const input = slideInputSchema.parse({ layout: "title", title: "  Q3 Roadmap  " });

    expect(input).toEqual({
      layout: "title",
      title: "Q3 Roadmap",
      subtitle: null,
      columns: [],
      notes: "",
      hints: {},
    });
  });

  test("rejects model output that does not fit the schema", () => {
    const invalidInputs = [
      { layout: "content", title: "Missing column" },
      { layout: "title", title: "   " },
      { layout: "content", title: "Bad block", columns: [{ blocks: [{ type: "video", url: "x" }] }] },
      {
        layout: "content",
        title: "Bad chart",
        columns: [
          {
            blocks: [{ type: "chart", chartType: "bar", categories: ["Q1", "Q2"], series: [{ name: "A", values: [1] }] }],
          },
        ],
      },
      "not an object",
    ];

    for (const input of invalidInputs) {
      expect(slideInputSchema.safeParse(input).success, JSON.stringify(input)).toBe(false);
    }
  });
});

describe("materializeSlide", () => {
  test("turns model input into a valid slide with fresh unique ids", () => {
    const input = slideInputSchema.parse({
      layout: "two-column",
      title: "Pricing",
      columns: [
        {
          blocks: [
            { type: "bullets", items: ["Monthly", "Annual"] },
            { type: "table", header: ["Plan", "Price"], rows: [["Pro", "$25"]] },
          ],
        },
        {
          blocks: [
            { type: "chart", chartType: "pie", categories: ["Pro", "Basic"], series: [{ name: "Share", values: [60, 40] }] },
            { type: "image", query: "pricing chart", alt: "Pricing illustration" },
          ],
        },
      ],
      hints: { columnRatio: "2:1" },
    });

    const slide = materializeSlide(input);

    expect(slideSchema.safeParse(slide).success).toBe(true);
    expect(slide.revision).toBe(0);
    expect(slide.hints).toEqual({ align: "left", columnRatio: "2:1" });
    const ids = collectIds(slide);
    expect(new Set(ids).size).toBe(ids.length);
    expect(slide.columns[1].blocks[1]).toMatchObject({ type: "image", image: null });
  });

  test("centers title layouts by default", () => {
    const slide = materializeSlide(slideInputSchema.parse({ layout: "title", title: "Welcome" }));

    expect(slide.hints.align).toBe("center");
  });
});

describe("materializeSlidePatch", () => {
  const current: Slide = {
    ...createBlankSlide("content"),
    title: "Team",
    columns: [
      {
        id: "column_1",
        heading: null,
        blocks: [{ id: "block_1", type: BlockType.Image, query: "Team photo", alt: "Team", image: resolvedImage }],
      },
    ],
  };

  test("keeps an already resolved image when the model repeats its query", () => {
    const input = slidePatchInputSchema.parse({
      columns: [
        {
          blocks: [
            { type: "image", query: "team PHOTO ", alt: "The team" },
            { type: "image", query: "office", alt: "Office" },
          ],
        },
      ],
    });

    const patch = materializeSlidePatch(input, current);

    const [kept, fresh] = patch.columns?.[0].blocks ?? [];
    expect(kept).toMatchObject({ type: "image", alt: "The team", image: resolvedImage });
    expect(fresh).toMatchObject({ type: "image", query: "office", image: null });
  });

  test("leaves out fields the model resent without changes, keeping column ids", () => {
    const input = slidePatchInputSchema.parse({
      title: "Team",
      notes: "Introduce the team",
      columns: [{ blocks: [{ type: "image", query: "Team photo", alt: "Team" }] }],
      hints: { align: "left" },
    });

    const patch = materializeSlidePatch(input, current);

    expect(patch).toEqual({
      title: undefined,
      subtitle: undefined,
      notes: "Introduce the team",
      columns: undefined,
      hints: undefined,
    });
  });

  test("changes only the fields the model sent when applied", () => {
    const deck = { ...createDeck(), slides: [current] };
    const patch = materializeSlidePatch(slidePatchInputSchema.parse({ title: "Our team", hints: { align: "center" } }), current);

    const result = applyOperation(deck, { type: "slide.update", slideId: current.id, baseRevision: 0, patch });

    if (!result.ok) throw new Error(result.message);
    const [updated] = result.deck.slides;
    expect(updated.title).toBe("Our team");
    expect(updated.hints).toEqual({ align: "center", columnRatio: "1:1" });
    expect(updated.columns).toBe(current.columns);
  });
});
