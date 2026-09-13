import { describe, expect, test } from "vitest";
import type { Slide } from "../../types";
import { createBlankSlide, createDeck } from "../create";
import { blockSchema, deckSchema, LIMITS, SLIDE_LAYOUTS, slideSchema } from "../schema";

const chart = {
  id: "block_chart",
  type: "chart",
  chartType: "bar",
  title: "Revenue",
  categories: ["Q1", "Q2"],
  series: [{ name: "2026", values: [10, 12.5] }],
};

const table = {
  id: "block_table",
  type: "table",
  header: ["Plan", "Price"],
  rows: [
    ["Basic", "$10"],
    ["Pro", "$25"],
  ],
};

function errorMessages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe("deck schema", () => {
  test("accepts a new deck and a blank slide for every layout", () => {
    const deck = { ...createDeck(), slides: SLIDE_LAYOUTS.map((layout) => createBlankSlide(layout)) };

    expect(deckSchema.safeParse(deck).success).toBe(true);
  });

  test("accepts every block type", () => {
    const blocks = [
      { id: "b1", type: "bullets", items: [{ id: "i1", text: "Point", level: 0 }] },
      { id: "b2", type: "paragraph", text: "Some text" },
      table,
      chart,
      {
        id: "b5",
        type: "image",
        query: "team meeting",
        alt: "Team in a meeting",
        image: {
          src: "https://images.example.com/team.jpg",
          width: 1200,
          height: 800,
          attribution: "Photo by someone, CC BY 2.0",
          sourceUrl: "http://example.com/photo",
        },
      },
    ];

    for (const block of blocks) {
      expect(blockSchema.safeParse(block).success, `block type ${block.type}`).toBe(true);
    }
  });

  test("rejects a slide whose column count does not match its layout", () => {
    const slide: Slide = { ...createBlankSlide("two-column"), layout: "content" };

    const result = slideSchema.safeParse(slide);

    expect(errorMessages(result)).toContain('Layout "content" needs 1 column(s) but has 2.');
  });

  test("rejects table rows that do not match the header", () => {
    const result = blockSchema.safeParse({ ...table, rows: [["Basic"]] });

    expect(errorMessages(result)).toContain("Table row 1 has 1 cells but the header has 2.");
  });

  test("rejects chart series whose values do not match the categories", () => {
    const result = blockSchema.safeParse({ ...chart, series: [{ name: "2026", values: [1] }] });

    expect(errorMessages(result)).toContain(
      'Chart series "2026" has 1 values but there are 2 categories.',
    );
  });

  test("rejects pie charts with several series or negative values", () => {
    const result = blockSchema.safeParse({
      ...chart,
      chartType: "pie",
      series: [
        { name: "A", values: [1, -2] },
        { name: "B", values: [3, 4] },
      ],
    });

    expect(errorMessages(result)).toEqual(
      expect.arrayContaining([
        "A pie chart must have exactly one series.",
        "Pie chart values cannot be negative.",
      ]),
    );
  });

  test("applies each chart type's rules for the number of series and negative values", () => {
    const twoSeries = [
      { name: "A", values: [1, 2] },
      { name: "B", values: [3, 4] },
    ];

    expect(
      blockSchema.safeParse({ ...chart, chartType: "stacked-bar", series: [...twoSeries, { name: "C", values: [-1, 2] }] })
        .success,
    ).toBe(true);
    expect(blockSchema.safeParse({ ...chart, chartType: "sunburst", series: twoSeries }).success).toBe(true);
    expect(errorMessages(blockSchema.safeParse({ ...chart, chartType: "funnel", series: twoSeries }))).toContain(
      "A funnel chart must have exactly one series.",
    );
    expect(errorMessages(blockSchema.safeParse({ ...chart, chartType: "scatter", series: [twoSeries[0]] }))).toContain(
      "A scatter chart must have exactly two series.",
    );
    expect(
      errorMessages(blockSchema.safeParse({ ...chart, chartType: "sankey", series: [{ name: "A", values: [1, -2] }] })),
    ).toContain("Sankey chart values cannot be negative.");
  });

  test("rejects non-finite chart values", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = blockSchema.safeParse({ ...chart, series: [{ name: "2026", values: [1, value] }] });
      expect(result.success, String(value)).toBe(false);
    }
  });

  test("rejects image sources that are not https", () => {
    const result = blockSchema.safeParse({
      id: "b1",
      type: "image",
      query: "team",
      alt: "Team",
      image: {
        src: "http://images.example.com/team.jpg",
        width: 10,
        height: 10,
        attribution: "",
        sourceUrl: "https://example.com",
      },
    });

    expect(result.success).toBe(false);
  });

  test("accepts an image block whose search hasn't been typed yet", () => {
    expect(blockSchema.safeParse({ id: "b1", type: "image", query: "", alt: "", image: null }).success).toBe(true);
  });

  test("accepts references to uploaded images but no other kind of image source", () => {
    const uploadedImageBlock = (src: string) => ({
      id: "b1",
      type: "image",
      query: "team",
      alt: "Team",
      image: { src, width: 10, height: 10, attribution: "", sourceUrl: null },
    });

    expect(blockSchema.safeParse(uploadedImageBlock("upload:upload_0123456789ab")).success).toBe(true);
    for (const src of ["upload:../secret", "blob:https://example.com/1", "data:image/png;base64,AAAA"]) {
      expect(blockSchema.safeParse(uploadedImageBlock(src)).success, src).toBe(false);
    }
  });

  test("rejects blank deck titles and duplicate slide ids", () => {
    const slide = createBlankSlide();
    const deck = { ...createDeck(), title: "   ", slides: [slide, slide] };

    const messages = errorMessages(deckSchema.safeParse(deck));

    expect(messages).toEqual(
      expect.arrayContaining([
        "Deck title cannot be empty.",
        `Slide id "${slide.id}" is used more than once.`,
      ]),
    );
  });

  test("rejects text over its limit", () => {
    const slide = { ...createBlankSlide(), title: "x".repeat(LIMITS.slideTitle + 1) };

    expect(slideSchema.safeParse(slide).success).toBe(false);
  });
});
