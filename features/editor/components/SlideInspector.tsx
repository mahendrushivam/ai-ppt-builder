import {
  type Announcements,
  closestCorners,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  type UniqueIdentifier,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button, buttonClassName } from "@/design-system/components/button";
import { ConfirmDialog } from "@/design-system/components/confirm-dialog";
import { Field, fieldClassName } from "@/design-system/components/field";
import type { Block, Slide, SlideLayout, SlidePatch } from "@/features/deck/types";
import { blockSizesOf } from "@/features/deck/utils/block-sizes";
import { COLUMN_SPLIT, LIMITS, SLIDE_LAYOUTS } from "@/features/deck/utils/schema";
import type { SlideActions } from "../hooks/use-slide-actions";
import { moveIntoColumn, moveOntoBlock } from "../utils/block-drop";
import { LAYOUT_LABELS } from "@/features/deck/utils/labels";
import {
  appendBlock,
  createBlock,
  editFieldId,
  layoutChangeRemovesContent,
  NEW_BLOCK_LABELS,
  NEW_BLOCK_TYPES,
  removeBlock,
  replaceBlock,
  setColumnHeading,
} from "../utils/slide-editing";
import { BlockEditor } from "./BlockEditor";

/** Droppable ids of columns start with this, so they can't be confused with block ids. */
const COLUMN_DROP_PREFIX = "column-drop:";

/**
 * The block under the pointer wins over the column around it, so dropping on a block takes its
 * place and a column only catches drops below its blocks. Keyboard drags have no pointer and use
 * the closest corners.
 */
const detectBlockDrop: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const blockHit = hits.find((hit) => !String(hit.id).startsWith(COLUMN_DROP_PREFIX));
  if (blockHit) return [blockHit];
  return hits.length > 0 ? hits : closestCorners(args);
};

const COLUMN_SPLIT_PRESETS = [
  { split: COLUMN_SPLIT.equal, label: "Equal" },
  { split: COLUMN_SPLIT.widerLeft, label: "Wider left" },
  { split: COLUMN_SPLIT.widerRight, label: "Wider right" },
] as const;

type SlideInspectorProps = {
  slide: Slide;
  position: number;
  actions: SlideActions;
};

/** Editing controls for the selected slide. Every change is applied as a DeckOperation. */
export function SlideInspector({ slide, position, actions }: SlideInspectorProps) {
  const [pendingLayout, setPendingLayout] = useState<SlideLayout | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const update = (patch: SlidePatch) => actions.updateSlide(slide.id, patch);

  const blockName = (block: Block) => {
    const columnIndex = slide.columns.findIndex((column) => column.blocks.includes(block));
    const column = slide.columns[columnIndex];
    return `${NEW_BLOCK_LABELS[block.type]} ${column.blocks.indexOf(block) + 1} in ${columnLabel(slide, columnIndex).toLowerCase()}`;
  };
  const nameOf = (id: UniqueIdentifier) => {
    const text = String(id);
    if (text.startsWith(COLUMN_DROP_PREFIX)) {
      const columnIndex = slide.columns.findIndex((column) => column.id === text.slice(COLUMN_DROP_PREFIX.length));
      return `the end of ${columnLabel(slide, columnIndex).toLowerCase()}`;
    }
    const block = slide.columns.flatMap((column) => column.blocks).find((candidate) => candidate.id === text);
    return block ? blockName(block) : "the block";
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} is over ${nameOf(over.id)}.` : `${nameOf(active.id)} is not over a place to drop.`,
    onDragEnd: ({ active, over }) =>
      over ? `${nameOf(active.id)} was moved to ${nameOf(over.id)}.` : `${nameOf(active.id)} was dropped.`,
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} was cancelled.`,
  };

  function moveDroppedBlock({ active, over }: DragEndEvent) {
    if (!over) return;
    const blockId = String(active.id);
    const overId = String(over.id);
    const move = overId.startsWith(COLUMN_DROP_PREFIX)
      ? moveIntoColumn(slide, blockId, overId.slice(COLUMN_DROP_PREFIX.length))
      : moveOntoBlock(slide, blockId, overId);
    if (move) actions.moveBlock(slide.id, blockId, move.toColumnId, move.toIndex);
  }

  function requestLayout(value: string) {
    const layout = SLIDE_LAYOUTS.find((candidate) => candidate === value);
    if (!layout) return;
    if (layoutChangeRemovesContent(slide, layout)) setPendingLayout(layout);
    else actions.changeLayout(slide.id, layout);
  }

  return (
    <div className="space-y-5 p-4">
      <h2 className="text-sm font-semibold">Slide {position}</h2>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Layout" htmlFor="slide-layout">
          <select
            id="slide-layout"
            value={slide.layout}
            onChange={(event) => requestLayout(event.target.value)}
            className={fieldClassName}
          >
            {SLIDE_LAYOUTS.map((layout) => (
              <option key={layout} value={layout}>
                {LAYOUT_LABELS[layout]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Alignment" htmlFor="slide-align">
          <select
            id="slide-align"
            value={slide.hints.align}
            onChange={(event) =>
              update({ hints: { ...slide.hints, align: event.target.value === "center" ? "center" : "left" } })
            }
            className={fieldClassName}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
          </select>
        </Field>
      </div>

      <Field label="Title" htmlFor={editFieldId("title")}>
        <input
          id={editFieldId("title")}
          value={slide.title}
          maxLength={LIMITS.slideTitle}
          onChange={(event) => update({ title: event.target.value })}
          className={fieldClassName}
        />
      </Field>

      <Field label="Subtitle" htmlFor={editFieldId("subtitle")}>
        <input
          id={editFieldId("subtitle")}
          value={slide.subtitle ?? ""}
          maxLength={LIMITS.subtitle}
          onChange={(event) => update({ subtitle: event.target.value === "" ? null : event.target.value })}
          className={fieldClassName}
        />
      </Field>

      {slide.columns.length === 2 && (
        <Field label="Column widths" htmlFor="slide-column-split" hint="Or drag the gap between the columns on the slide.">
          <select
            id="slide-column-split"
            value={String(slide.hints.columnSplit)}
            onChange={(event) => {
              const preset = COLUMN_SPLIT_PRESETS.find(({ split }) => String(split) === event.target.value);
              if (preset) actions.resizeSlide(slide.id, { columnSplit: preset.split });
            }}
            className={fieldClassName}
          >
            {!COLUMN_SPLIT_PRESETS.some(({ split }) => split === slide.hints.columnSplit) && (
              <option value={String(slide.hints.columnSplit)}>
                Custom ({Math.round(slide.hints.columnSplit)}% left)
              </option>
            )}
            {COLUMN_SPLIT_PRESETS.map(({ split, label }) => (
              <option key={split} value={String(split)}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={detectBlockDrop}
        onDragEnd={moveDroppedBlock}
        accessibility={{ announcements }}
      >
      {slide.columns.map((column, index) => (
        <DroppableColumn key={column.id} columnId={column.id}>
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {columnLabel(slide, index)}
          </legend>

          {slide.layout === "comparison" && (
            <Field label="Heading" htmlFor={editFieldId(`heading-${column.id}`)}>
              <input
                id={editFieldId(`heading-${column.id}`)}
                value={column.heading ?? ""}
                maxLength={LIMITS.columnHeading}
                onChange={(event) => update({ columns: setColumnHeading(slide, column.id, event.target.value) })}
                className={fieldClassName}
              />
            </Field>
          )}

          {column.blocks.length === 0 && <p className="text-sm text-muted-foreground">No content yet.</p>}

          <SortableContext items={column.blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
            {column.blocks.map((block) => (
              <SortableBlockEditor
                key={block.id}
                block={block}
                name={blockName(block)}
                onChange={(updated) => update({ columns: replaceBlock(slide, updated) })}
                onChangeLatest={(change) => actions.updateBlock(slide.id, block.id, change)}
                onRemove={() => update({ columns: removeBlock(slide, block.id) })}
              />
            ))}
          </SortableContext>

          {blockSizesOf(column) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                actions.resizeSlide(slide.id, {
                  blockSizes: column.blocks.map((block) => ({ blockId: block.id, size: null })),
                })
              }
            >
              Reset block heights
            </Button>
          )}

          <div className="flex flex-wrap gap-1.5">
            {NEW_BLOCK_TYPES.map((type) => (
              <Button
                key={type}
                size="sm"
                disabled={column.blocks.length >= LIMITS.blocksPerColumn}
                onClick={() => update({ columns: appendBlock(slide, column.id, createBlock(type)) })}
              >
                + {NEW_BLOCK_LABELS[type]}
              </Button>
            ))}
          </div>
        </DroppableColumn>
      ))}
      </DndContext>

      <Field label="Speaker notes" htmlFor="slide-notes">
        <textarea
          id="slide-notes"
          rows={4}
          value={slide.notes}
          maxLength={LIMITS.notes}
          onChange={(event) => update({ notes: event.target.value })}
          className={fieldClassName}
        />
      </Field>

      {pendingLayout && (
        <ConfirmDialog
          title="Remove slide content?"
          description={`The ${LAYOUT_LABELS[pendingLayout]} layout only has a title and subtitle, so the content on this slide will be removed.`}
          confirmLabel="Change layout"
          onConfirm={() => {
            actions.changeLayout(slide.id, pendingLayout);
            setPendingLayout(null);
          }}
          onCancel={() => setPendingLayout(null)}
        />
      )}
    </div>
  );
}

/** A column's fieldset, which also accepts blocks dropped below its last block. */
function DroppableColumn({ columnId, children }: { columnId: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_DROP_PREFIX}${columnId}` });
  return (
    <fieldset
      ref={setNodeRef}
      className={`space-y-3 rounded-lg border p-3 ${isOver ? "border-ring bg-accent/40" : "border-border"}`}
    >
      {children}
    </fieldset>
  );
}

type SortableBlockEditorProps = Omit<React.ComponentProps<typeof BlockEditor>, "dragHandle"> & { name: string };

function SortableBlockEditor({ name, ...editorProps }: SortableBlockEditorProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: editorProps.block.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? "relative z-10 opacity-60" : undefined}
    >
      <BlockEditor
        {...editorProps}
        dragHandle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Drag ${name}`}
            className={`${buttonClassName({ variant: "ghost", size: "icon" })} cursor-grab active:cursor-grabbing`}
          >
            <GripVerticalIcon aria-hidden className="size-4" />
          </button>
        }
      />
    </div>
  );
}

function columnLabel(slide: Slide, index: number): string {
  if (slide.columns.length === 1) return "Content";
  const side = index === 0 ? "Left" : "Right";
  return slide.layout === "comparison" ? `${side} side` : `${side} column`;
}
