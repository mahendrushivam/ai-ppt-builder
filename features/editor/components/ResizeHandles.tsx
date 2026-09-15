import { Fragment, type RefObject, useEffect, useRef, useState } from "react";
import { Group, type Layout, Panel, Separator, useGroupRef } from "react-resizable-panels";
import type { Column, Slide, SlideResize } from "@/features/deck/types";
import { blockSizesOf } from "@/features/deck/utils/block-sizes";
import { COLUMN_SPLIT, MIN_BLOCK_SIZE } from "@/features/deck/utils/schema";
import { blockSharesFromSizes, snapColumnSplit, splitFromSizes } from "../utils/resize";
import type { Box } from "../utils/toolbar-placement";

type ResizeHandlesProps = {
  slide: Slide;
  /** The drawn slide, measured to place the handles. */
  slideRef: RefObject<HTMLDivElement | null>;
  /** The element the handles are positioned in. */
  originRef: RefObject<HTMLDivElement | null>;
  /** Sizes to show while a handle is dragged, or `null` when the drag is over. */
  onPreview: (resize: SlideResize | null) => void;
  /** Saves sizes after a drag or key press; returns whether they were accepted. */
  onResize: (resize: SlideResize) => boolean;
};

type ColumnsGeometry = { box: Box; gap: number };
type BlocksGeometry = { column: Column; box: Box; gaps: number[]; shares: number[] };
type SlideGeometry = { columns: ColumnsGeometry | null; blocks: BlocksGeometry[] };

const LEFT_PANEL = "left-column";
const RIGHT_PANEL = "right-column";

/** Differences smaller than this, in percent, are rounding, not a size change. */
const LAYOUT_TOLERANCE = 0.05;

const SEPARATOR_CLASSES =
  "group/separator pointer-events-auto flex items-center justify-center outline-none data-[separator]:focus-visible:[&>div]:bg-ring";
const SEPARATOR_LINE_CLASSES =
  "rounded-full bg-transparent transition-colors group-hover/canvas:bg-ring/25 group-hover/separator:bg-ring/70 group-active/separator:bg-ring";

/**
 * Handles laid over the slide for resizing, as an editor-only layer so the renderer stays the same
 * everywhere: the gap between two columns sets the column split, and the gaps between blocks set
 * their share of the column's height. Handles work with a pointer or with arrow keys once focused.
 */
export function ResizeHandles({ slide, slideRef, originRef, onPreview, onResize }: ResizeHandlesProps) {
  const [geometry, setGeometry] = useState<SlideGeometry | null>(null);

  // Measured again whenever the slide changes or the canvas is resized; the observer reports right away.
  // A passive effect, because the origin is a parent element whose ref isn't set yet during layout effects.
  useEffect(() => {
    const slideElement = slideRef.current;
    const origin = originRef.current;
    if (!slideElement || !origin) return;
    const observer = new ResizeObserver(() => setGeometry(measureSlide(slideElement, origin, slide)));
    observer.observe(origin);
    return () => observer.disconnect();
  }, [slide, slideRef, originRef]);

  if (!geometry) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[5]">
      {geometry.columns && (
        <ColumnSplitHandle
          key={slide.id}
          split={slide.hints.columnSplit}
          geometry={geometry.columns}
          onPreview={onPreview}
          onResize={onResize}
        />
      )}
      {geometry.blocks.map((blocks) => (
        <BlockHeightHandles
          key={`${blocks.column.id}:${blocks.column.blocks.map((block) => block.id).join(",")}`}
          geometry={blocks}
          columnName={columnName(slide, blocks.column.id)}
          onPreview={onPreview}
          onResize={onResize}
        />
      ))}
    </div>
  );
}

type ColumnSplitHandleProps = {
  split: number;
  geometry: ColumnsGeometry;
  onPreview: (resize: SlideResize | null) => void;
  onResize: (resize: SlideResize) => boolean;
};

function ColumnSplitHandle({ split, geometry, onPreview, onResize }: ColumnSplitHandleProps) {
  const groupRef = useGroupRef();
  // Set when the separator is pressed, so only the user's own changes are previewed, not layouts set in code.
  const isUserResizingRef = useRef(false);
  const splitOf = (layout: Layout) => splitFromSizes(layout[LEFT_PANEL] ?? 0, layout[RIGHT_PANEL] ?? 0);

  // Follows splits saved elsewhere, such as undo or the width presets, without remounting a focused handle.
  // Only a saved split changes this, so a drag in progress, which re-renders with a preview, isn't reset.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const layout = group.getLayout();
    if (Math.abs(splitFromSizes(layout[LEFT_PANEL] ?? 0, layout[RIGHT_PANEL] ?? 0) - split) > LAYOUT_TOLERANCE) {
      isUserResizingRef.current = false;
      group.setLayout({ [LEFT_PANEL]: split, [RIGHT_PANEL]: 100 - split });
    }
  }, [split, groupRef]);

  return (
    <div className="absolute" style={boxStyle(geometry.box)}>
      <Group
        groupRef={groupRef}
        orientation="horizontal"
        disableCursor
        className="size-full"
        onLayoutChange={(layout) => {
          if (isUserResizingRef.current) onPreview({ columnSplit: splitOf(layout) });
        }}
        onLayoutChanged={(layout, { isUserInteraction }) => {
          if (!isUserInteraction) return;
          isUserResizingRef.current = false;
          onPreview(null);
          onResize({ columnSplit: snapColumnSplit(splitOf(layout)) });
        }}
      >
        <Panel id={LEFT_PANEL} defaultSize={String(split)} minSize={String(COLUMN_SPLIT.min)} maxSize={String(COLUMN_SPLIT.max)} />
        <Separator
          aria-label="Column widths"
          onPointerDown={() => (isUserResizingRef.current = true)}
          onKeyDown={() => (isUserResizingRef.current = true)}
          className={`${SEPARATOR_CLASSES} cursor-col-resize`}
          style={{ width: geometry.gap }}
        >
          <div className={`h-full w-0.5 ${SEPARATOR_LINE_CLASSES}`} />
        </Separator>
        <Panel
          id={RIGHT_PANEL}
          defaultSize={String(100 - split)}
          minSize={String(100 - COLUMN_SPLIT.max)}
          maxSize={String(100 - COLUMN_SPLIT.min)}
        />
      </Group>
    </div>
  );
}

type BlockHeightHandlesProps = {
  geometry: BlocksGeometry;
  columnName: string;
  onPreview: (resize: SlideResize | null) => void;
  onResize: (resize: SlideResize) => boolean;
};

function BlockHeightHandles({ geometry, columnName, onPreview, onResize }: BlockHeightHandlesProps) {
  const groupRef = useGroupRef();
  // Set when a separator is pressed, so only the user's own changes are previewed, not layouts set in code.
  const isUserResizingRef = useRef(false);
  const { column, shares } = geometry;
  const sizesOf = (layout: Layout) => column.blocks.map((block) => layout[panelId(block.id)] ?? 0);
  const resizeFor = (sizes: number[]): SlideResize => ({
    blockSizes: column.blocks.map((block, index) => ({ blockId: block.id, size: sizes[index] })),
  });

  // Follows heights saved elsewhere, such as undo, without remounting a focused handle. `shares` only
  // changes when the slide is measured again, so a drag in progress, which re-renders with a preview, isn't reset.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const layout = group.getLayout();
    const isDifferent = column.blocks.some(
      (block, index) => Math.abs(shares[index] - (layout[panelId(block.id)] ?? 0)) > LAYOUT_TOLERANCE,
    );
    if (isDifferent) {
      isUserResizingRef.current = false;
      group.setLayout(Object.fromEntries(column.blocks.map((block, index) => [panelId(block.id), shares[index]])));
    }
  }, [shares, column, groupRef]);

  return (
    <div className="absolute" style={boxStyle(geometry.box)}>
      <Group
        groupRef={groupRef}
        orientation="vertical"
        disableCursor
        className="size-full"
        onLayoutChange={(layout) => {
          if (isUserResizingRef.current) onPreview(resizeFor(sizesOf(layout)));
        }}
        onLayoutChanged={(layout, { isUserInteraction }) => {
          if (!isUserInteraction) return;
          isUserResizingRef.current = false;
          onPreview(null);
          onResize(resizeFor(blockSharesFromSizes(sizesOf(layout))));
        }}
      >
        {column.blocks.map((block, index) => (
          <Fragment key={block.id}>
            {index > 0 && (
              <Separator
                aria-label={`Heights of blocks ${index} and ${index + 1} in ${columnName}`}
                onPointerDown={() => (isUserResizingRef.current = true)}
                onKeyDown={() => (isUserResizingRef.current = true)}
                className={`${SEPARATOR_CLASSES} cursor-row-resize`}
                style={{ height: geometry.gaps[index - 1] }}
              >
                <div className={`h-0.5 w-full ${SEPARATOR_LINE_CLASSES}`} />
              </Separator>
            )}
            <Panel id={panelId(block.id)} defaultSize={String(shares[index])} minSize={String(MIN_BLOCK_SIZE)} />
          </Fragment>
        ))}
      </Group>
    </div>
  );
}

function panelId(blockId: string): string {
  return `height-${blockId}`;
}

function boxStyle(box: Box) {
  return { left: box.left, top: box.top, width: box.width, height: box.height };
}

function columnName(slide: Slide, columnId: string): string {
  if (slide.columns.length === 1) return "the column";
  return slide.columns[0].id === columnId ? "the left column" : "the right column";
}

/**
 * Where the handles go, relative to `origin`: the area spanning both columns with the gap between
 * them, and for each column with two or more blocks, the area from its first block to its bottom.
 * Blocks without saved heights start from their drawn heights, the last one taking the space below.
 */
function measureSlide(slideElement: HTMLElement, origin: HTMLElement, slide: Slide): SlideGeometry {
  const originRect = origin.getBoundingClientRect();
  const relative = (left: number, top: number, right: number, bottom: number): Box => ({
    left: left - originRect.left,
    top: top - originRect.top,
    width: right - left,
    height: bottom - top,
  });

  const sectionRects = slide.columns.flatMap((column) => {
    const section = slideElement.querySelector(`[data-column-id="${column.id}"]`);
    return section ? [section.getBoundingClientRect()] : [];
  });

  let columns: ColumnsGeometry | null = null;
  if (slide.columns.length === 2 && sectionRects.length === 2) {
    const [left, right] = sectionRects;
    columns = {
      box: relative(left.left, Math.min(left.top, right.top), right.right, Math.max(left.bottom, right.bottom)),
      gap: Math.max(0, right.left - left.right),
    };
  }

  const blocks = slide.columns.flatMap((column, index): BlocksGeometry[] => {
    const section = sectionRects.at(index);
    const blockRects = column.blocks.flatMap((block) => {
      // A block with a saved height is drawn inside a slot element that takes up its space.
      const element =
        slideElement.querySelector(`[data-block-slot="${block.id}"]`) ??
        slideElement.querySelector(`[data-edit-target="block-${block.id}"]`);
      return element ? [element.getBoundingClientRect()] : [];
    });
    if (!section || column.blocks.length < 2 || blockRects.length !== column.blocks.length) return [];

    const top = blockRects[0].top;
    const heights = blockRects.map((rect, blockIndex) =>
      blockIndex === blockRects.length - 1 ? section.bottom - rect.top : rect.height,
    );
    return [
      {
        column,
        box: relative(section.left, top, section.right, section.bottom),
        gaps: blockRects.slice(1).map((rect, blockIndex) => Math.max(0, rect.top - blockRects[blockIndex].bottom)),
        shares: blockSharesFromSizes(blockSizesOf(column) ?? heights),
      },
    ];
  });

  return { columns, blocks };
}
