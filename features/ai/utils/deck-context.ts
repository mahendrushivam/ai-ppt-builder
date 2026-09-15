import { type Block, BlockType, type Deck, type Slide } from "@/features/deck/types";

/**
 * Compact, line-based description of a deck for the model's context.
 *
 * Slides are numbered so the model can map "slide 3" to an id, and ids are included
 * because tools address slides by id. Plain text is used instead of JSON because it
 * costs far fewer tokens. Revisions and internal column/block ids are left out; the
 * server tracks those itself.
 */
export function serializeDeckForModel(deck: Deck): string {
  const lines = [
    `Deck title: ${quote(deck.title)}`,
    `Theme: ${deck.themeId}`,
    `Slides: ${deck.slides.length}`,
  ];
  deck.slides.forEach((slide, index) => lines.push(...serializeSlide(slide, index + 1)));
  return lines.join("\n");
}

function serializeSlide(slide: Slide, position: number): string[] {
  const lines = [
    `${position}. id=${slide.id} layout=${slide.layout} align=${slide.hints.align} columnSplit=${slide.hints.columnSplit}`,
    `   title: ${quote(slide.title)}`,
  ];
  if (slide.subtitle !== null) lines.push(`   subtitle: ${quote(slide.subtitle)}`);

  slide.columns.forEach((column, index) => {
    const heading = column.heading === null ? "" : ` heading=${quote(column.heading)}`;
    lines.push(`   column ${index + 1}${heading}:`);
    if (column.blocks.length === 0) lines.push("     (empty)");
    for (const block of column.blocks) {
      const height = block.size === undefined ? "" : `[height ${block.size}%] `;
      lines.push(`     - ${height}${serializeBlock(block)}`);
    }
  });

  if (slide.notes !== "") lines.push(`   notes: ${quote(slide.notes)}`);
  return lines;
}

function serializeBlock(block: Block): string {
  switch (block.type) {
    case BlockType.Bullets: {
      const items = block.items.map((item) => `${item.level === 1 ? "(sub) " : ""}${quote(item.text)}`);
      return `bullets: ${items.join(", ")}`;
    }
    case BlockType.Paragraph:
      return `paragraph: ${quote(block.text)}`;
    case BlockType.Table:
      return `table: header=${JSON.stringify(block.header)} rows=${JSON.stringify(block.rows)}`;
    case BlockType.Chart: {
      const title = block.title === null ? "" : ` title=${quote(block.title)}`;
      const series = block.series
        .map((entry) => `${quote(entry.name)}=${JSON.stringify(entry.values)}`)
        .join(" ");
      return `chart ${block.chartType}${title}: categories=${JSON.stringify(block.categories)} series: ${series}`;
    }
    case BlockType.Image:
      return `image: query=${quote(block.query)} alt=${quote(block.alt)}`;
  }
}

/** JSON string quoting escapes quotes and newlines so every value stays on one line. */
function quote(text: string): string {
  return JSON.stringify(text);
}
