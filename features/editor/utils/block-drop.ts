import type { Slide } from "@/features/deck/types";

/** Where a dropped block goes, as a `block.move` operation needs it: the index is counted without the block. */
export type BlockMove = { toColumnId: string; toIndex: number };

/** Dropping on another block in a sortable list takes that block's place. */
export function moveOntoBlock(slide: Slide, blockId: string, overBlockId: string): BlockMove | null {
  const from = locateBlock(slide, blockId);
  const over = locateBlock(slide, overBlockId);
  if (!from || !over || blockId === overBlockId) return null;
  return { toColumnId: over.columnId, toIndex: over.index };
}

/** Dropping on a column outside its blocks puts the block at the end of that column. */
export function moveIntoColumn(slide: Slide, blockId: string, columnId: string): BlockMove | null {
  const from = locateBlock(slide, blockId);
  const column = slide.columns.find((candidate) => candidate.id === columnId);
  if (!from || !column) return null;
  const toIndex = column.blocks.filter((block) => block.id !== blockId).length;
  if (from.columnId === columnId && from.index === toIndex) return null;
  return { toColumnId: columnId, toIndex };
}

/** Dropping in a gap between blocks: gap 0 is before the first block, the last gap after the last one. */
export function moveToGap(slide: Slide, blockId: string, columnId: string, gapIndex: number): BlockMove | null {
  const from = locateBlock(slide, blockId);
  if (!from || !slide.columns.some((column) => column.id === columnId)) return null;
  const isSameColumn = from.columnId === columnId;
  const toIndex = isSameColumn && gapIndex > from.index ? gapIndex - 1 : gapIndex;
  if (isSameColumn && toIndex === from.index) return null;
  return { toColumnId: columnId, toIndex };
}

function locateBlock(slide: Slide, blockId: string): { columnId: string; index: number } | null {
  for (const column of slide.columns) {
    const index = column.blocks.findIndex((block) => block.id === blockId);
    if (index !== -1) return { columnId: column.id, index };
  }
  return null;
}
