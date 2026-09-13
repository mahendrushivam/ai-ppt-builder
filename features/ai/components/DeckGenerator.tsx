import type { ReactNode } from "react";
import { type GenerationController, GenerationStep } from "../hooks/use-generation";
import { OutlineReview } from "./OutlineReview";
import { PromptForm } from "./PromptForm";

type DeckGeneratorProps = {
  generation: GenerationController;
  /** The alternative to generating, such as a menu to add a blank slide. */
  blankSlideAction: ReactNode;
};

/**
 * Plans slides for a deck: the prompt, then the outline review. Progress while slides are
 * written is shown separately, next to the slides as they arrive.
 */
export function DeckGenerator({ generation, blankSlideAction }: DeckGeneratorProps) {
  const { state } = generation;

  if (state.step === GenerationStep.ReviewingOutline) {
    return (
      <OutlineReview
        outline={state.outline}
        onChange={generation.editOutline}
        onGenerate={() => void generation.generate()}
        onStartOver={generation.startOver}
      />
    );
  }
  if (state.step === GenerationStep.Generating) return null;

  return (
    <div className="mx-auto mt-10 max-w-xl rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-medium">This presentation has no slides</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Describe it, and the AI drafts an outline you can edit before any slide is written.
      </p>
      <PromptForm
        initialRequest={state.request}
        isDrafting={state.step === GenerationStep.DraftingOutline}
        error={state.step === GenerationStep.Prompt ? state.error : null}
        onSubmit={(request) => void generation.draftOutline(request)}
        onCancel={generation.cancel}
      />
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 border-t border-border pt-5 text-sm text-muted-foreground">
        <span>Or start from scratch:</span>
        {blankSlideAction}
      </div>
    </div>
  );
}
