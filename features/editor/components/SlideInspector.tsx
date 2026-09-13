import { useState } from "react";
import { Button } from "@/design-system/components/button";
import { ConfirmDialog } from "@/design-system/components/confirm-dialog";
import { Field, fieldClassName } from "@/design-system/components/field";
import type { Slide, SlideLayout, SlidePatch } from "@/features/deck/types";
import { LIMITS, SLIDE_LAYOUTS } from "@/features/deck/utils/schema";
import type { SlideActions } from "../hooks/use-slide-actions";
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

type SlideInspectorProps = {
  slide: Slide;
  position: number;
  actions: SlideActions;
};

/** Editing controls for the selected slide. Every change is applied as a DeckOperation. */
export function SlideInspector({ slide, position, actions }: SlideInspectorProps) {
  const [pendingLayout, setPendingLayout] = useState<SlideLayout | null>(null);

  const update = (patch: SlidePatch) => actions.updateSlide(slide.id, patch);

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
        <Field label="Column widths" htmlFor="slide-column-ratio">
          <select
            id="slide-column-ratio"
            value={slide.hints.columnRatio}
            onChange={(event) => {
              const columnRatio = (["1:1", "2:1", "1:2"] as const).find((ratio) => ratio === event.target.value);
              if (columnRatio) update({ hints: { ...slide.hints, columnRatio } });
            }}
            className={fieldClassName}
          >
            <option value="1:1">Equal</option>
            <option value="2:1">Wider left</option>
            <option value="1:2">Wider right</option>
          </select>
        </Field>
      )}

      {slide.columns.map((column, index) => (
        <fieldset key={column.id} className="space-y-3 rounded-lg border border-border p-3">
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

          {column.blocks.map((block) => (
            <BlockEditor
              key={block.id}
              block={block}
              onChange={(updated) => update({ columns: replaceBlock(slide, updated) })}
              onChangeLatest={(change) => actions.updateBlock(slide.id, block.id, change)}
              onRemove={() => update({ columns: removeBlock(slide, block.id) })}
            />
          ))}

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
        </fieldset>
      ))}

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

function columnLabel(slide: Slide, index: number): string {
  if (slide.columns.length === 1) return "Content";
  const side = index === 0 ? "Left" : "Right";
  return slide.layout === "comparison" ? `${side} side` : `${side} column`;
}
