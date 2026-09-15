import {
  type Announcements,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  type DroppableContainer,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  type UniqueIdentifier,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { GripVerticalIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button, buttonClassName } from "@/design-system/components/button";
import type { Block, Column, Slide, SlideResize } from "@/features/deck/types";
import { applyResize } from "@/features/deck/utils/block-sizes";
import { LIMITS } from "@/features/deck/utils/schema";
import { SlideRenderer } from "@/features/renderer/components/SlideRenderer";
import type { Theme } from "@/features/themes/types";
import { moveToGap } from "../utils/block-drop";
import { type ColumnLayout, type DropSlot, dropSlotsFor } from "../utils/drop-slots";
import {
  appendBlock,
  createBlock,
  insertBlockAfter,
  NEW_BLOCK_LABELS,
  type NewBlockType,
  removeBlock,
  replaceBlock,
} from "../utils/slide-editing";
import { type Box, placeToolbar } from "../utils/toolbar-placement";
import { AddBlockMenu } from "./AddBlockMenu";
import { ResizeHandles } from "./ResizeHandles";
import { ReplaceBlockMenu } from "./ReplaceBlockMenu";

type SlideCanvasProps = {
  slide: Slide;
  theme: Theme;
  /** Called with the `data-edit-target` of the slide element the user clicked. */
  onEditTarget: (target: string) => void;
  /** Applies new columns to the slide; returns whether the change was accepted. */
  onChangeColumns: (columns: Column[]) => boolean;
  /** Moves a block to `toIndex` in a column, counted without the moved block. */
  onMoveBlock: (blockId: string, toColumnId: string, toIndex: number) => boolean;
  /** Saves a new column split or block heights; returns whether they were accepted. */
  onResize: (resize: SlideResize) => boolean;
};

enum SelectionKind {
  Block = "block",
  Column = "column",
}

type CanvasSelection = { kind: SelectionKind.Block; blockId: string } | { kind: SelectionKind.Column; columnId: string };

const BLOCK_TARGET_PREFIX = "block-";
/** Space between the floating toolbar and the element it belongs to, clear of the selection outline. */
const TOOLBAR_GAP_PX = 8;

const KEY_STEPS: Partial<Record<string, number>> = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 };

const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    "To move the block, press space. Use the arrow keys to choose a place between blocks, then press space to drop it there, or escape to cancel.",
};

/**
 * Dropping into gaps between blocks. A pointer drops into the gap under it. A keyboard drag has no
 * pointer, so arrow keys step through the enabled gaps in order, starting before the first one, and
 * the drag drops into the gap they reached.
 */
function createDropSlotDetection() {
  /** Index into the enabled gaps in keyboard order; -1 until an arrow key is pressed. */
  let keyboardIndex = -1;
  const inKeyboardOrder = (containers: DroppableContainer[]) =>
    containers.toSorted((a, b) => Number(a.data.current?.order) - Number(b.data.current?.order));

  const collisionDetection: CollisionDetection = (args) => {
    if (args.pointerCoordinates) return pointerWithin(args);
    const slot = keyboardIndex === -1 ? undefined : inKeyboardOrder(args.droppableContainers)[keyboardIndex];
    return slot ? [{ id: slot.id, data: { droppableContainer: slot, value: 0 } }] : [];
  };

  const coordinateGetter: KeyboardCoordinateGetter = (event, { context }) => {
    const step = KEY_STEPS[event.code];
    const { collisionRect, droppableRects, droppableContainers } = context;
    if (step === undefined || !collisionRect) return undefined;
    event.preventDefault();

    const slots = inKeyboardOrder(droppableContainers.getEnabled());
    if (slots.length === 0) return undefined;
    keyboardIndex =
      keyboardIndex === -1 ? (step > 0 ? 0 : slots.length - 1) : Math.min(Math.max(keyboardIndex + step, 0), slots.length - 1);
    // The dragged handle is moved over the gap, so the drag overlay shows where the block will go.
    const rect = droppableRects.get(slots[keyboardIndex].id);
    if (!rect) return undefined;
    return { x: rect.left + rect.width / 2 - collisionRect.width / 2, y: rect.top + rect.height / 2 - collisionRect.height / 2 };
  };

  return { collisionDetection, coordinateGetter, reset: () => (keyboardIndex = -1) };
}

/**
 * Shows the selected slide. Clicking text is a shortcut to its field in the settings panel;
 * clicking a block, or empty space in a column, opens a floating toolbar to add, replace, move or
 * delete blocks. Blocks are moved by dragging the toolbar's handle into a gap between blocks, and
 * resized by dragging the gaps between columns and blocks. The renderer itself stays read-only.
 */
export function SlideCanvas({ slide, theme, onEditTarget, onChangeColumns, onMoveBlock, onResize }: SlideCanvasProps) {
  const [selection, setSelection] = useState<CanvasSelection | null>(null);
  /** The places the dragged block can go, while a block is being dragged. */
  const [dropSlots, setDropSlots] = useState<DropSlot[] | null>(null);
  /**
   * Sizes shown while a resize handle is dragged. They belong to the slide revision they were made on,
   * so any saved change to the slide, including the resize itself, replaces the preview.
   */
  const [resizePreview, setResizePreview] = useState<{ revision: number; resize: SlideResize } | null>(null);
  const shownSlide =
    resizePreview?.revision === slide.revision ? applyResize(slide, resizePreview.resize) : slide;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [dropSlotDetection] = useState(createDropSlotDetection);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: dropSlotDetection.coordinateGetter }),
  );

  // A selection whose block or column is gone, or belongs to another slide, shows nothing.
  const selectedColumn = slide.columns.find((column) =>
    selection?.kind === SelectionKind.Block
      ? column.blocks.some((block) => block.id === selection.blockId)
      : column.id === selection?.columnId,
  );
  const selectedBlock =
    selection?.kind === SelectionKind.Block
      ? selectedColumn?.blocks.find((block) => block.id === selection.blockId)
      : undefined;
  const selector = selectedBlock
    ? `[data-edit-target="${BLOCK_TARGET_PREFIX}${selectedBlock.id}"]`
    : selectedColumn && `[data-column-id="${selectedColumn.id}"]`;

  // Outlines the selected element and places the toolbar on a side where it covers no other
  // slide content, following layout changes, scrolling and window resizes.
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const toolbar = toolbarRef.current;
    const slideElement = slideRef.current;
    const element = selector ? slideElement?.querySelector<HTMLElement>(selector) : null;
    if (!wrapper || !toolbar || !slideElement || !element) return;

    element.setAttribute("data-canvas-selected", "");
    const place = () => {
      const wrapperRect = wrapper.getBoundingClientRect();
      const placement = placeToolbar({
        target: element.getBoundingClientRect(),
        toolbar: { width: toolbar.offsetWidth, height: toolbar.offsetHeight },
        bounds: visibleArea(wrapper),
        obstacles: contentBoxes(slideElement, element),
        gap: TOOLBAR_GAP_PX,
      });
      toolbar.style.left = `${placement.left - wrapperRect.left}px`;
      toolbar.style.top = `${placement.top - wrapperRect.top}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(wrapper);
    document.addEventListener("scroll", place, { capture: true, passive: true });
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      document.removeEventListener("scroll", place, { capture: true });
      window.removeEventListener("resize", place);
      element.removeAttribute("data-canvas-selected");
    };
  }, [selector, slide]);

  // Clicking anywhere outside the slide and its menus closes the toolbar.
  useEffect(() => {
    if (!selection) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (wrapperRef.current?.contains(target) || target.closest('[data-slot="dropdown-menu-content"]')) return;
      setSelection(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [selection]);

  const blocks = slide.columns.flatMap((column) => column.blocks);
  const draggedName = (id: UniqueIdentifier) => {
    const block = blocks.find((candidate) => candidate.id === id);
    return block ? `the ${NEW_BLOCK_LABELS[block.type].toLowerCase()}` : "the block";
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${draggedName(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${draggedName(active.id)} would move to ${describeDropSlot(slide, dropSlots, over.id)}.`
        : `${draggedName(active.id)} is not over a place to drop.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${draggedName(active.id)} was moved to ${describeDropSlot(slide, dropSlots, over.id)}.`
        : `${draggedName(active.id)} was not moved.`,
    onDragCancel: ({ active }) => `Moving ${draggedName(active.id)} was cancelled.`,
  };

  function selectFromClick(target: EventTarget) {
    if (!(target instanceof Element)) return;
    const editTarget = target.closest("[data-edit-target]")?.getAttribute("data-edit-target") ?? null;
    const columnId = target.closest("[data-column-id]")?.getAttribute("data-column-id") ?? null;

    if (editTarget?.startsWith(BLOCK_TARGET_PREFIX)) {
      setSelection({ kind: SelectionKind.Block, blockId: editTarget.slice(BLOCK_TARGET_PREFIX.length) });
    } else if (columnId && !editTarget) {
      setSelection({ kind: SelectionKind.Column, columnId });
    } else {
      setSelection(null);
    }
    if (editTarget) onEditTarget(editTarget);
  }

  function addBlock(type: NewBlockType) {
    if (!selectedColumn) return;
    const block = createBlock(type);
    const columns = selectedBlock
      ? insertBlockAfter(slide, selectedBlock.id, block)
      : appendBlock(slide, selectedColumn.id, block);
    if (!onChangeColumns(columns)) return;
    setSelection({ kind: SelectionKind.Block, blockId: block.id });
    onEditTarget(`${BLOCK_TARGET_PREFIX}${block.id}`);
  }

  function startDrag({ active }: DragStartEvent) {
    const wrapper = wrapperRef.current;
    const slideElement = slideRef.current;
    const sourceColumn = slide.columns.find((column) => column.blocks.some((block) => block.id === active.id));
    if (!wrapper || !slideElement || !sourceColumn) return;

    const origin = wrapper.getBoundingClientRect();
    const layouts = slide.columns.flatMap((column) => measureColumn(slideElement, column, origin));
    const index = sourceColumn.blocks.findIndex((block) => block.id === active.id);
    dropSlotDetection.reset();
    setDropSlots(dropSlotsFor(layouts, { columnId: sourceColumn.id, index }));
    slideElement.querySelector(blockSelector(String(active.id)))?.setAttribute("data-canvas-dragging", "");
  }

  function stopDrag() {
    setDropSlots(null);
    slideRef.current?.querySelector("[data-canvas-dragging]")?.removeAttribute("data-canvas-dragging");
  }

  function dropBlock({ active, over }: DragEndEvent) {
    const slot = dropSlots?.find((candidate) => candidate.id === over?.id);
    stopDrag();
    if (!slot) return;
    const move = moveToGap(slide, String(active.id), slot.columnId, slot.gapIndex);
    if (move) onMoveBlock(String(active.id), move.toColumnId, move.toIndex);
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <DndContext
        sensors={sensors}
        collisionDetection={dropSlotDetection.collisionDetection}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={startDrag}
        onDragEnd={dropBlock}
        onDragCancel={stopDrag}
        accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
      >
        <div ref={wrapperRef} className="group/canvas relative">
          <div
            ref={slideRef}
            onClick={(event) => selectFromClick(event.target)}
            className="overflow-hidden rounded-lg shadow-lg ring-1 ring-foreground/10 [&_[data-edit-target]]:cursor-text [&_[data-edit-target]:hover]:outline-2 [&_[data-edit-target]:hover]:outline-offset-4 [&_[data-edit-target]:hover]:outline-ring/60 [&_[data-edit-target]:hover]:outline-dashed [&_[data-canvas-selected]]:outline-2 [&_[data-canvas-selected]]:outline-offset-4 [&_[data-canvas-selected]]:outline-ring [&_[data-canvas-selected]]:outline-solid [&_[data-canvas-dragging]]:opacity-40"
          >
            <SlideRenderer slide={shownSlide} theme={theme} />
          </div>

          {!dropSlots && (
            <ResizeHandles
              slide={slide}
              slideRef={slideRef}
              originRef={wrapperRef}
              onPreview={(resize) => setResizePreview(resize && { revision: slide.revision, resize })}
              onResize={onResize}
            />
          )}

          {dropSlots && (
            <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
              {dropSlots.map((slot) => (
                <DropSlotTarget key={slot.id} slot={slot} />
              ))}
            </div>
          )}

          {selectedColumn && (
            <div
              ref={toolbarRef}
              role="toolbar"
              aria-label={selectedBlock ? "Block actions" : "Column actions"}
              onKeyDown={(event) => {
                // While dragging, escape cancels the drag and keeps the selection.
                if (event.key === "Escape" && !dropSlots) setSelection(null);
              }}
              className="absolute top-0 left-0 z-10 flex items-center gap-0.5 whitespace-nowrap rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
            >
              {selectedBlock && <BlockDragHandle block={selectedBlock} />}
              <AddBlockMenu
                label={selectedBlock ? "Add below" : "Add block"}
                disabled={selectedColumn.blocks.length >= LIMITS.blocksPerColumn}
                onAdd={addBlock}
              />
              {selectedBlock && (
                <>
                  <ReplaceBlockMenu block={selectedBlock} onReplace={(block) => onChangeColumns(replaceBlock(slide, block))} />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onChangeColumns(removeBlock(slide, selectedBlock.id))}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {dropSlots && (
            <div className="w-max rounded-md bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md ring-1 ring-border">
              Moving block…
            </div>
          )}
        </DragOverlay>
      </DndContext>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Click text to edit it. Click a block or an empty part of a column to add, move, replace or delete blocks. Drag
        the gaps between columns and blocks to resize them.
      </p>
    </div>
  );
}

/** The toolbar's handle for dragging the selected block to another place. */
function BlockDragHandle({ block }: { block: Block }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: block.id });
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Move ${NEW_BLOCK_LABELS[block.type].toLowerCase()}`}
      className={`${buttonClassName({ variant: "ghost", size: "sm" })} cursor-grab active:cursor-grabbing`}
    >
      <GripVerticalIcon aria-hidden className="size-4" />
      Move
    </button>
  );
}

/** A gap between blocks that takes drops, drawn as a line while the dragged block is over it. */
function DropSlotTarget({ slot }: { slot: DropSlot }) {
  const { setNodeRef, isOver } = useDroppable({ id: slot.id, disabled: slot.isDisabled, data: { order: slot.order } });
  const { region } = slot;
  return (
    <div
      ref={setNodeRef}
      className="absolute"
      style={{ left: region.left, top: region.top, width: region.width, height: region.height }}
    >
      {!slot.isDisabled && (
        <div
          className={`absolute inset-x-0 -translate-y-1/2 rounded-full ${isOver ? "h-1 bg-ring" : "h-0.5 bg-ring/30"}`}
          style={{ top: slot.lineTop - region.top }}
        />
      )}
    </div>
  );
}

function blockSelector(blockId: string): string {
  return `[data-block-slot="${blockId}"], [data-edit-target="${BLOCK_TARGET_PREFIX}${blockId}"]`;
}

/** Where a column and its blocks are drawn, relative to `origin`. Skipped when a block isn't drawn. */
function measureColumn(slideElement: HTMLElement, column: Column, origin: DOMRect): ColumnLayout[] {
  const section = slideElement.querySelector(`[data-column-id="${column.id}"]`);
  // A resized block is drawn inside a slot element, which is what takes up its space in the column.
  const blockElements = column.blocks.flatMap((block) => {
    const element =
      slideElement.querySelector(`[data-block-slot="${block.id}"]`) ??
      slideElement.querySelector(`[data-edit-target="${BLOCK_TARGET_PREFIX}${block.id}"]`);
    return element ? [element] : [];
  });
  if (!section || blockElements.length !== column.blocks.length) return [];

  const relative = (rect: DOMRect): Box => ({
    left: rect.left - origin.left,
    top: rect.top - origin.top,
    width: rect.width,
    height: rect.height,
  });
  return [
    {
      columnId: column.id,
      box: relative(section.getBoundingClientRect()),
      blockBoxes: blockElements.map((element) => relative(element.getBoundingClientRect())),
      isFull: column.blocks.length >= LIMITS.blocksPerColumn,
    },
  ];
}

/** "the top of the left column", for screen reader announcements while dragging. */
function describeDropSlot(slide: Slide, slots: DropSlot[] | null, id: UniqueIdentifier): string {
  const slot = slots?.find((candidate) => candidate.id === id);
  const columnIndex = slide.columns.findIndex((column) => column.id === slot?.columnId);
  if (!slot || columnIndex === -1) return "another place";
  const column = slide.columns.length === 1 ? "the column" : columnIndex === 0 ? "the left column" : "the right column";
  const blockCount = slide.columns[columnIndex].blocks.length;
  if (slot.gapIndex === 0) return `the top of ${column}`;
  if (slot.gapIndex >= blockCount) return `the end of ${column}`;
  return `between blocks ${slot.gapIndex} and ${slot.gapIndex + 1} of ${column}`;
}

/**
 * Boxes of the text lines and graphics on the slide outside the selected element, which the
 * toolbar should not cover. Text is measured line by line, so a short title only claims its words.
 */
function contentBoxes(slideElement: HTMLElement, selected: HTMLElement): DOMRect[] {
  const boxes: DOMRect[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(slideElement, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (selected.contains(node) || !node.textContent?.trim()) continue;
    range.selectNodeContents(node);
    boxes.push(...range.getClientRects());
  }
  for (const graphic of slideElement.querySelectorAll("svg, img")) {
    if (!selected.contains(graphic)) boxes.push(graphic.getBoundingClientRect());
  }
  return boxes;
}

/** The part of the window where the toolbar can be seen: inside the viewport and every ancestor that clips or scrolls. */
function visibleArea(element: HTMLElement): Box {
  let left = 0;
  let top = 0;
  let right = window.innerWidth;
  let bottom = window.innerHeight;

  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(ancestor);
    if (overflowX === "visible" && overflowY === "visible") continue;
    const rect = ancestor.getBoundingClientRect();
    left = Math.max(left, rect.left);
    top = Math.max(top, rect.top);
    right = Math.min(right, rect.right);
    bottom = Math.min(bottom, rect.bottom);
  }

  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}
