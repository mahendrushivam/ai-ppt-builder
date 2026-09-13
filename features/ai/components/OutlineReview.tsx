import { Button } from "@/design-system/components/button";
import { Field, fieldClassName } from "@/design-system/components/field";
import { LAYOUT_LABELS } from "@/features/deck/utils/labels";
import { LIMITS, SLIDE_LAYOUTS } from "@/features/deck/utils/schema";
import { SlideVisual } from "../types";
import {
  addOutlineItem,
  type EditableOutline,
  keyPointsToText,
  moveOutlineItem,
  outlineForGeneration,
  removeOutlineItem,
  textToKeyPoints,
  updateOutlineItem,
} from "../utils/outline-editing";
import { GENERATION_LIMITS } from "../utils/slide-input";

const VISUAL_LABELS: Record<SlideVisual, string> = {
  [SlideVisual.None]: "None",
  [SlideVisual.Image]: "Image",
  [SlideVisual.Chart]: "Chart",
  [SlideVisual.Table]: "Table",
};

type OutlineReviewProps = {
  outline: EditableOutline;
  onChange: (outline: EditableOutline) => void;
  onGenerate: () => void;
  onStartOver: () => void;
};

/** Lets the user fix the plan before any slide is written: titles, layouts, key points, visuals and order. */
export function OutlineReview({ outline, onChange, onGenerate, onStartOver }: OutlineReviewProps) {
  const isValid = outlineForGeneration(outline) !== null;
  const slideCount = outline.slides.length;

  return (
    <section aria-labelledby="outline-review-heading" className="mx-auto mt-6 max-w-2xl space-y-4">
      <div>
        <h2 id="outline-review-heading" className="text-lg font-medium">
          Review the outline
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit, reorder or remove slides. Nothing is written until you generate.
        </p>
      </div>

      <Field label="Presentation title" htmlFor="outline-deck-title">
        <input
          id="outline-deck-title"
          value={outline.deckTitle}
          maxLength={LIMITS.deckTitle}
          onChange={(event) => onChange({ ...outline, deckTitle: event.target.value })}
          className={fieldClassName}
        />
      </Field>

      <ol className="space-y-3">
        {outline.slides.map((item, index) => {
          const name = `slide ${index + 1}`;
          const fieldId = (field: string) => `outline-${field}-${item.id}`;

          return (
            <li key={item.id} className="space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Slide {index + 1}</h3>
                <div className="flex gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Move ${name} up`}
                    disabled={index === 0}
                    onClick={() => onChange(moveOutlineItem(outline, item.id, "up"))}
                  >
                    ↑
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Move ${name} down`}
                    disabled={index === slideCount - 1}
                    onClick={() => onChange(moveOutlineItem(outline, item.id, "down"))}
                  >
                    ↓
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${name}`}
                    disabled={slideCount === 1}
                    onClick={() => onChange(removeOutlineItem(outline, item.id))}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    ×
                  </Button>
                </div>
              </div>

              <Field label="Title" htmlFor={fieldId("title")}>
                <input
                  id={fieldId("title")}
                  value={item.title}
                  maxLength={LIMITS.slideTitle}
                  onChange={(event) => onChange(updateOutlineItem(outline, item.id, { title: event.target.value }))}
                  className={fieldClassName}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Layout" htmlFor={fieldId("layout")}>
                  <select
                    id={fieldId("layout")}
                    value={item.layout}
                    onChange={(event) => {
                      const layout = SLIDE_LAYOUTS.find((candidate) => candidate === event.target.value);
                      if (layout) onChange(updateOutlineItem(outline, item.id, { layout }));
                    }}
                    className={fieldClassName}
                  >
                    {SLIDE_LAYOUTS.map((layout) => (
                      <option key={layout} value={layout}>
                        {LAYOUT_LABELS[layout]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Visual" htmlFor={fieldId("visual")}>
                  <select
                    id={fieldId("visual")}
                    value={item.visual}
                    onChange={(event) => {
                      const visual = Object.values(SlideVisual).find((candidate) => candidate === event.target.value);
                      if (visual) onChange(updateOutlineItem(outline, item.id, { visual }));
                    }}
                    className={fieldClassName}
                  >
                    {Object.values(SlideVisual).map((visual) => (
                      <option key={visual} value={visual}>
                        {VISUAL_LABELS[visual]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Key points" htmlFor={fieldId("key-points")} hint="One per line.">
                <textarea
                  id={fieldId("key-points")}
                  rows={Math.max(2, item.keyPoints.length + 1)}
                  value={keyPointsToText(item.keyPoints)}
                  onChange={(event) =>
                    onChange(updateOutlineItem(outline, item.id, { keyPoints: textToKeyPoints(event.target.value) }))
                  }
                  className={fieldClassName}
                />
              </Field>
            </li>
          );
        })}
      </ol>

      <Button onClick={() => onChange(addOutlineItem(outline))} disabled={slideCount >= GENERATION_LIMITS.maxSlides}>
        + Add slide
      </Button>

      {!isValid && (
        <p className="text-sm text-destructive">The presentation and every slide need a title before generating.</p>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button onClick={onStartOver}>Start over</Button>
        <Button variant="primary" disabled={!isValid} onClick={onGenerate}>
          Generate {slideCount} {slideCount === 1 ? "slide" : "slides"}
        </Button>
      </div>
    </section>
  );
}
