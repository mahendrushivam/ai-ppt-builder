import {
  type Block,
  type BlockOfType,
  BlockType,
  type BulletItem,
  type Column,
  type Slide,
  type SlideLayout,
} from "@/features/deck/types";
import { createBlankSlide, createId } from "@/features/deck/utils/create";
import { LAYOUT_COLUMN_COUNT, LIMITS } from "@/features/deck/utils/schema";

/** Blocks the editor can add by hand. */
export type NewBlockType = BlockType.Bullets | BlockType.Paragraph | BlockType.Table | BlockType.Chart | BlockType.Image;

export const NEW_BLOCK_LABELS: Record<NewBlockType, string> = {
  [BlockType.Bullets]: "Bullet list",
  [BlockType.Paragraph]: "Paragraph",
  [BlockType.Table]: "Table",
  [BlockType.Chart]: "Chart",
  [BlockType.Image]: "Image",
};

export const NEW_BLOCK_TYPES: readonly NewBlockType[] = [
  BlockType.Bullets,
  BlockType.Paragraph,
  BlockType.Table,
  BlockType.Chart,
  BlockType.Image,
];

export function createBlock(type: NewBlockType): Block {
  const id = createId("block");
  switch (type) {
    case BlockType.Bullets:
      return { id, type, items: [{ id: createId("item"), text: "", level: 0 }] };
    case BlockType.Paragraph:
      return { id, type, text: "" };
    case BlockType.Table:
      return { id, type, header: ["Column 1", "Column 2"], rows: [["", ""]] };
    case BlockType.Chart:
      // Sample data shows the chart right away; the chart editor changes its type and values.
      return {
        id,
        type,
        chartType: "bar",
        title: null,
        categories: ["Category 1", "Category 2", "Category 3"],
        series: [{ name: "Series 1", values: [10, 20, 30] }],
      };
    case BlockType.Image:
      // A search query is required, so the block starts with a sample the user replaces before finding an image.
      return { id, type, query: "team working together", alt: "Team working together", image: null };
  }
}

/** A blank slide that is ready to type into: each content column starts with an empty list. */
export function createStarterSlide(layout: SlideLayout): Slide {
  const slide = createBlankSlide(layout);
  return {
    ...slide,
    columns: slide.columns.map((column, index) => ({
      ...column,
      heading: layout === "comparison" ? `Option ${String.fromCharCode(65 + index)}` : null,
      blocks: [createBlock(BlockType.Bullets)],
    })),
  };
}

// ---------------------------------------------------------------------------
// Bullets as editable text: one bullet per line, two leading spaces for a sub-point
// ---------------------------------------------------------------------------

const SUB_POINT_INDENT = "  ";

export function bulletsToText(items: BulletItem[]): string {
  return items.map((item) => (item.level === 1 ? SUB_POINT_INDENT : "") + item.text).join("\n");
}

/** Keeps existing item ids by position so list items stay stable while typing. */
export function textToBullets(text: string, previous: BulletItem[]): BulletItem[] {
  return text.split("\n").map((line, index) => {
    const isSubPoint = line.startsWith(SUB_POINT_INDENT) || line.startsWith("\t");
    return {
      id: previous.at(index)?.id ?? createId("item"),
      text: isSubPoint ? line.trimStart() : line,
      level: isSubPoint ? 1 : 0,
    };
  });
}

/**
 * The bullets to save for text typed in the editor: the first LIMITS.bulletsPerBlock lines, each
 * cut to LIMITS.bulletText characters. `overflow` explains typed text that the slide doesn't keep.
 */
export function bulletsFromText(
  text: string,
  previous: BulletItem[],
): { items: BulletItem[]; overflow: string | null } {
  const typed = textToBullets(text, previous);
  const kept = typed.slice(0, LIMITS.bulletsPerBlock);
  const extraLines = typed.slice(LIMITS.bulletsPerBlock).filter((item) => item.text.trim() !== "").length;
  const isCut = kept.some((item) => item.text.length > LIMITS.bulletText);
  const items = isCut ? kept.map((item) => ({ ...item, text: item.text.slice(0, LIMITS.bulletText) })) : kept;

  if (extraLines > 0) {
    const lost = extraLines === 1 ? "line isn't" : `${extraLines} lines aren't`;
    return {
      items,
      overflow: `A list shows up to ${LIMITS.bulletsPerBlock} points, so the last ${lost} saved. Add another list for more.`,
    };
  }
  if (isCut) return { items, overflow: `Points can be up to ${LIMITS.bulletText} characters, so longer text isn't saved.` };
  return { items, overflow: null };
}

// ---------------------------------------------------------------------------
// Column changes (each returns the new columns for a `slide.update` patch)
// ---------------------------------------------------------------------------

export function replaceBlock(slide: Slide, updated: Block): Column[] {
  return slide.columns.map((column) =>
    column.blocks.some((block) => block.id === updated.id)
      ? { ...column, blocks: column.blocks.map((block) => (block.id === updated.id ? updated : block)) }
      : column,
  );
}

export function removeBlock(slide: Slide, blockId: string): Column[] {
  return slide.columns.map((column) =>
    column.blocks.some((block) => block.id === blockId)
      ? { ...column, blocks: column.blocks.filter((block) => block.id !== blockId) }
      : column,
  );
}

export function appendBlock(slide: Slide, columnId: string, block: Block): Column[] {
  return slide.columns.map((column) =>
    column.id === columnId ? { ...column, blocks: [...column.blocks, block] } : column,
  );
}

export function insertBlockAfter(slide: Slide, afterBlockId: string, block: Block): Column[] {
  return slide.columns.map((column) => {
    const index = column.blocks.findIndex((candidate) => candidate.id === afterBlockId);
    return index === -1 ? column : { ...column, blocks: column.blocks.toSpliced(index + 1, 0, block) };
  });
}

// ---------------------------------------------------------------------------
// Replacing a block with another type
// ---------------------------------------------------------------------------

/**
 * The block as another type, keeping its id so it stays selected and its height. Bullets and paragraphs keep
 * their text, cut to the new type's limits; any other change starts the new type empty.
 */
export function convertBlock(block: Block, type: NewBlockType): Block {
  if (block.type === type) return block;
  if (block.type === BlockType.Bullets && type === BlockType.Paragraph) {
    return { id: block.id, size: block.size, type, text: bulletLines(block).join("\n").slice(0, LIMITS.paragraph) };
  }
  if (block.type === BlockType.Paragraph && type === BlockType.Bullets) {
    return { id: block.id, size: block.size, type, items: bulletsFromText(paragraphLines(block.text).join("\n"), []).items };
  }
  return { ...createBlock(type), id: block.id, size: block.size };
}

/** True when replacing the block with `type` would throw away content the user wrote. */
export function replacementLosesContent(block: Block, type: NewBlockType): boolean {
  if (block.type === type || !hasContent(block)) return false;
  if (block.type === BlockType.Bullets && type === BlockType.Paragraph) {
    return bulletLines(block).join("\n").length > LIMITS.paragraph;
  }
  if (block.type === BlockType.Paragraph && type === BlockType.Bullets) {
    const lines = paragraphLines(block.text);
    return lines.length > LIMITS.bulletsPerBlock || lines.some((line) => line.length > LIMITS.bulletText);
  }
  return true;
}

function hasContent(block: Block): boolean {
  switch (block.type) {
    case BlockType.Bullets:
      return bulletLines(block).length > 0;
    case BlockType.Paragraph:
      return block.text.trim() !== "";
    case BlockType.Table:
      // A new table's header is placeholder text, so only filled-in rows count.
      return block.rows.flat().some((cell) => cell.trim() !== "");
    case BlockType.Chart:
      return true;
    case BlockType.Image:
      return block.image !== null;
  }
}

function bulletLines(block: BlockOfType<BlockType.Bullets>): string[] {
  return block.items.map((item) => item.text.trim()).filter((text) => text !== "");
}

function paragraphLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

export function setColumnHeading(slide: Slide, columnId: string, heading: string): Column[] {
  return slide.columns.map((column) =>
    column.id === columnId ? { ...column, heading: heading === "" ? null : heading } : column,
  );
}

/** True when switching layouts would remove content blocks (title and section slides have no columns). */
export function layoutChangeRemovesContent(slide: Slide, layout: SlideLayout): boolean {
  return LAYOUT_COLUMN_COUNT[layout] === 0 && slide.columns.some((column) => column.blocks.length > 0);
}

// ---------------------------------------------------------------------------
// Slide order and selection
// ---------------------------------------------------------------------------

export type SlidePosition = { afterSlideId: string | null };

/** Where a slide goes when moved one step up or down; `null` when it cannot move that way. */
export function positionForStep(
  slides: Slide[],
  slideId: string,
  direction: "up" | "down",
): SlidePosition | null {
  const index = slides.findIndex((slide) => slide.id === slideId);
  if (index === -1) return null;
  if (direction === "up") {
    if (index === 0) return null;
    return { afterSlideId: index === 1 ? null : slides[index - 2].id };
  }
  return index === slides.length - 1 ? null : { afterSlideId: slides[index + 1].id };
}

/** Where a dragged slide goes when dropped on another slide: it takes the target's place. */
export function positionForDrop(slides: Slide[], draggedId: string, targetId: string): SlidePosition | null {
  const from = slides.findIndex((slide) => slide.id === draggedId);
  const to = slides.findIndex((slide) => slide.id === targetId);
  if (from === -1 || to === -1 || from === to) return null;
  if (from < to) return { afterSlideId: targetId };
  return { afterSlideId: to === 0 ? null : slides[to - 1].id };
}

/** The slide to select after deleting one: the next slide, or the previous one at the end. */
export function selectionAfterDelete(slides: Slide[], deletedId: string): string | null {
  const index = slides.findIndex((slide) => slide.id === deletedId);
  const remaining = slides.filter((slide) => slide.id !== deletedId);
  if (index === -1 || remaining.length === 0) return null;
  return remaining[Math.min(index, remaining.length - 1)].id;
}

/** Id of the editing field for an element marked with `data-edit-target` on the slide. */
export function editFieldId(target: string): string {
  return `slide-edit-${target}`;
}
