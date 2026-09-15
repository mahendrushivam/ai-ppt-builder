import type { Column, Slide, SlideResize } from "../types";

/**
 * The heights of a column's blocks, as shares of the column in percent, when every block has
 * one. Otherwise `null`: the blocks take the height of their content, as before any resize.
 */
export function blockSizesOf(column: Column): number[] | null {
  const sizes = column.blocks.flatMap((block) => (block.size === undefined ? [] : [block.size]));
  return sizes.length > 0 && sizes.length === column.blocks.length ? sizes : null;
}

/**
 * The slide with a new column split and block heights. Untouched columns keep their identity.
 * No validation: `slide.resize` checks the sizes, and the editor uses this to preview a drag.
 */
export function applyResize(slide: Slide, { columnSplit, blockSizes }: SlideResize): Slide {
  const sizes = new Map(blockSizes?.map(({ blockId, size }) => [blockId, size]));
  const columns = slide.columns.map((column) =>
    column.blocks.some((block) => sizes.has(block.id))
      ? {
          ...column,
          blocks: column.blocks.map((block) =>
            sizes.has(block.id) ? { ...block, size: sizes.get(block.id) ?? undefined } : block,
          ),
        }
      : column,
  );
  return {
    ...slide,
    hints: columnSplit === undefined ? slide.hints : { ...slide.hints, columnSplit },
    columns: sizes.size === 0 ? slide.columns : columns,
  };
}
