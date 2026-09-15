import type { Box } from "./toolbar-placement";

/** Where a column and its blocks are drawn, measured when a drag starts. */
export type ColumnLayout = { columnId: string; box: Box; blockBoxes: Box[]; isFull: boolean };

/** A place a dragged block can be dropped: the gap before the block at `gapIndex`, or after the last one. */
export type DropSlot = {
  id: string;
  columnId: string;
  gapIndex: number;
  /** The part of the column that drops into this gap. */
  region: Box;
  /** Where the drop line is drawn. */
  lineTop: number;
  isDisabled: boolean;
  /** Position in keyboard order: top to bottom, then the next column. */
  order: number;
};

/** How far above the first block or below the last one the drop line is drawn, in pixels. */
const EDGE_LINE_OFFSET = 4;

/**
 * Splits each column into drop regions, one per gap: region i runs from the middle of block i-1 to
 * the middle of block i, so every point in a column is over exactly one gap. The gaps on either
 * side of the dragged block would leave it where it is, and full columns can't take another
 * block, so those slots are disabled.
 */
export function dropSlotsFor(columns: ColumnLayout[], source: { columnId: string; index: number }): DropSlot[] {
  let order = 0;
  return columns.flatMap(({ columnId, box, blockBoxes, isFull }) => {
    const columnBottom = box.top + box.height;
    const bounds = [box.top, ...blockBoxes.map((block) => block.top + block.height / 2), columnBottom];
    const isSourceColumn = source.columnId === columnId;

    return Array.from({ length: blockBoxes.length + 1 }, (_, gapIndex) => {
      const top = bounds[gapIndex];
      const isNoMove = isSourceColumn && (gapIndex === source.index || gapIndex === source.index + 1);
      return {
        id: `${columnId}:${gapIndex}`,
        columnId,
        gapIndex,
        region: { left: box.left, top, width: box.width, height: Math.max(0, bounds[gapIndex + 1] - top) },
        lineTop: gapLineTop(blockBoxes, gapIndex, box.top, columnBottom),
        isDisabled: isNoMove || (isFull && !isSourceColumn),
        order: order++,
      };
    });
  });
}

function gapLineTop(blocks: Box[], gapIndex: number, columnTop: number, columnBottom: number): number {
  const before = blocks.at(gapIndex - 1);
  const after = blocks.at(gapIndex);
  if (gapIndex > 0 && before && after) return (before.top + before.height + after.top) / 2;
  if (gapIndex === 0 && after) return Math.max(columnTop, after.top - EDGE_LINE_OFFSET);
  if (gapIndex > 0 && before) return Math.min(columnBottom, before.top + before.height + EDGE_LINE_OFFSET);
  return columnTop;
}
