import { useState } from "react";
import { Button } from "@/design-system/components/button";
import { Field, fieldClassName } from "@/design-system/components/field";
import { Notice } from "@/design-system/components/notice";
import type { OutlineRequest } from "../types";
import { GENERATION_LIMITS } from "../utils/slide-input";

const SLIDE_COUNTS = [3, 4, 5, 6, 8, 10, GENERATION_LIMITS.maxSlides];

const EXAMPLE_PROMPTS = [
  "Our Q3 product roadmap for the leadership team",
  "A beginner's guide to personal budgeting",
  "Pitch deck for a neighbourhood food delivery startup",
];

type PromptFormProps = {
  initialRequest: OutlineRequest;
  isDrafting: boolean;
  error: string | null;
  onSubmit: (request: OutlineRequest) => void;
  onCancel: () => void;
};

/** Collects what the presentation is about and how many slides it should have. */
export function PromptForm({ initialRequest, isDrafting, error, onSubmit, onCancel }: PromptFormProps) {
  const [prompt, setPrompt] = useState(initialRequest.prompt);
  const [slideCount, setSlideCount] = useState(initialRequest.slideCount);

  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isDrafting && prompt.trim() !== "") onSubmit({ prompt: prompt.trim(), slideCount });
      }}
    >
      <Field
        label="What is the presentation about?"
        htmlFor="generation-prompt"
        hint="Include the audience and anything the slides must cover."
      >
        <textarea
          id="generation-prompt"
          rows={4}
          value={prompt}
          maxLength={GENERATION_LIMITS.prompt}
          disabled={isDrafting}
          onChange={(event) => setPrompt(event.target.value)}
          className={`${fieldClassName} resize-y`}
        />
      </Field>

      <div role="group" aria-label="Example topics" className="flex flex-wrap gap-1.5">
        {EXAMPLE_PROMPTS.map((example) => (
          <Button
            key={example}
            size="sm"
            disabled={isDrafting}
            onClick={() => setPrompt(example)}
            className="h-auto py-1.5 text-left whitespace-normal"
          >
            {example}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-40">
          <Field label="Number of slides" htmlFor="generation-slide-count">
            <select
              id="generation-slide-count"
              value={slideCount}
              disabled={isDrafting}
              onChange={(event) => setSlideCount(Number(event.target.value))}
              className={fieldClassName}
            >
              {SLIDE_COUNTS.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {isDrafting ? (
          <div className="flex items-center gap-3">
            <p role="status" className="text-sm text-muted-foreground">
              Drafting the outline…
            </p>
            <Button onClick={onCancel}>Cancel</Button>
          </div>
        ) : (
          <Button type="submit" variant="primary" disabled={prompt.trim() === ""}>
            Draft outline
          </Button>
        )}
      </div>

      {error && <Notice tone="error">{error}</Notice>}
    </form>
  );
}
