import { type Block, BlockType, type BulletItem, type Column, type Slide, type SlideLayout } from "@/features/deck/types";
import { createBlankSlide, createId } from "@/features/deck/utils/create";
import { LAYOUT_COLUMN_COUNT } from "@/features/deck/utils/schema";

export const LAYOUT_LABELS: Record<SlideLayout, string> = {
  title: "Title",
  section: "Section header",
  content: "Content",
  "two-column": "Two columns",
  comparison: "Comparison",
};

/** Blocks the editor can add by hand. Charts and images are only created by the AI for now. */
export type NewBlockType = BlockType.Bullets | BlockType.Paragraph | BlockType.Table;

export const NEW_BLOCK_LABELS: Record<NewBlockType, string> = {
  [BlockType.Bullets]: "Bullet list",
  [BlockType.Paragraph]: "Paragraph",
  [BlockType.Table]: "Table",
};

export function createBlock(type: NewBlockType): Block {
  const id = createId("block");
  switch (type) {
    case BlockType.Bullets:
      return { id, type, items: [{ id: createId("item"), text: "", level: 0 }] };
    case BlockType.Paragraph:
      return { id, type, text: "" };
    case BlockType.Table:
      return { id, type, header: ["Column 1", "Column 2"], rows: [["", ""]] };
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
