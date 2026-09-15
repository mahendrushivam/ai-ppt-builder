import { describe, expect, test } from "vitest";
import { BlockType, type Deck } from "@/features/deck/types";
import { serializeDeckForModel } from "../deck-context";

const timestamp = "2026-09-13T10:00:00.000Z";

const deck: Deck = {
  id: "deck_1",
  title: "Q3 Roadmap",
  themeId: "midnight",
  createdAt: timestamp,
  updatedAt: timestamp,
  slides: [
    {
      id: "slide_a",
      revision: 0,
      layout: "title",
      title: "Q3 Roadmap",
      subtitle: "Product team",
      columns: [],
      notes: "Welcome everyone",
      hints: { align: "center", columnSplit: 50 },
    },
    {
      id: "slide_b",
      revision: 3,
      layout: "comparison",
      title: "Plans",
      subtitle: null,
      notes: "",
      hints: { align: "left", columnSplit: 66.67 },
      columns: [
        {
          id: "column_internal_1",
          heading: "Basic",
          blocks: [
            {
              id: "block_1",
              size: 60,
              type: BlockType.Bullets,
              items: [
                { id: "item_1", text: 'Say "hi"', level: 0 },
                { id: "item_2", text: "Detail", level: 1 },
              ],
            },
            { id: "block_2", size: 40, type: BlockType.Table, header: ["Seats", "Price"], rows: [["5", "$10"]] },
          ],
        },
        {
          id: "column_internal_2",
          heading: null,
          blocks: [
            {
              id: "block_3",
              type: BlockType.Chart,
              chartType: "bar",
              title: "Revenue",
              categories: ["Q1", "Q2"],
              series: [{ name: "2026", values: [1, 2.5] }],
            },
            { id: "block_4", type: BlockType.Image, query: "team", alt: "Team photo", image: null },
            { id: "block_5", type: BlockType.Paragraph, text: "Line one\nLine two" },
          ],
        },
      ],
    },
  ],
};

describe("serializeDeckForModel", () => {
  test("describes numbered slides with ids and every block type on single lines", () => {
    expect(serializeDeckForModel(deck)).toBe(
      [
        'Deck title: "Q3 Roadmap"',
        "Theme: midnight",
        "Slides: 2",
        "1. id=slide_a layout=title align=center columnSplit=50",
        '   title: "Q3 Roadmap"',
        '   subtitle: "Product team"',
        '   notes: "Welcome everyone"',
        "2. id=slide_b layout=comparison align=left columnSplit=66.67",
        '   title: "Plans"',
        '   column 1 heading="Basic":',
        '     - [height 60%] bullets: "Say \\"hi\\"", (sub) "Detail"',
        '     - [height 40%] table: header=["Seats","Price"] rows=[["5","$10"]]',
        "   column 2:",
        '     - chart bar title="Revenue": categories=["Q1","Q2"] series: "2026"=[1,2.5]',
        '     - image: query="team" alt="Team photo"',
        '     - paragraph: "Line one\\nLine two"',
      ].join("\n"),
    );
  });

  test("leaves out internal ids and revisions", () => {
    const text = serializeDeckForModel(deck);

    expect(text).not.toContain("column_internal_1");
    expect(text).not.toContain("block_1");
    expect(text).not.toContain("revision");
  });

  test("describes an empty deck", () => {
    expect(serializeDeckForModel({ ...deck, slides: [] })).toBe(
      'Deck title: "Q3 Roadmap"\nTheme: midnight\nSlides: 0',
    );
  });
});
