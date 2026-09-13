import { Button } from "@/design-system/components/button";
import { Notice } from "@/design-system/components/notice";
import { GenerationRun, type GenerationProgressState } from "../hooks/use-generation";
import { SlideGenerationStatus } from "../types";

const STATUS_LABELS: Record<SlideGenerationStatus, string> = {
  [SlideGenerationStatus.Pending]: "Waiting",
  [SlideGenerationStatus.Generating]: "Writing…",
  [SlideGenerationStatus.Done]: "Done",
  [SlideGenerationStatus.Failed]: "Failed",
};

type GenerationProgressProps = {
  progress: GenerationProgressState;
  onStop: () => void;
  onRetrySlide: (index: number) => void;
  onResume: () => void;
  onDismiss: () => void;
};

/** Shows each planned slide while generation runs, and what can be retried or continued afterwards. */
export function GenerationProgress({ progress, onStop, onRetrySlide, onResume, onDismiss }: GenerationProgressProps) {
  const { slides, run, error } = progress;
  const isRunning = run === GenerationRun.Running;
  const canContinue =
    !isRunning &&
    slides.some((slide) => slide.status === SlideGenerationStatus.Pending) &&
    (error === null || error.retryable);

  return (
    <section aria-label="Slide generation" className="mx-auto mb-6 max-w-5xl rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm font-medium">
          {summarize(progress)}
        </p>
        <div className="flex gap-2">
          {isRunning && (
            <Button size="sm" onClick={onStop}>
              Stop
            </Button>
          )}
          {canContinue && (
            <Button size="sm" variant="primary" onClick={onResume}>
              Continue
            </Button>
          )}
          {!isRunning && (
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3">
          <Notice tone="error">{error.message}</Notice>
        </div>
      )}

      {/* The outline can't change during generation, so positions are stable keys. */}
      <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {slides.map((slide, index) => (
          <li key={index} className="rounded-md bg-muted px-3 py-1.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">
                {index + 1}. {slide.title}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                {STATUS_LABELS[slide.status]}
                {slide.status === SlideGenerationStatus.Failed && !isRunning && (
                  <Button size="sm" onClick={() => onRetrySlide(index)} aria-label={`Retry slide ${index + 1}`}>
                    Retry
                  </Button>
                )}
              </span>
            </div>
            {slide.status === SlideGenerationStatus.Failed && slide.message && (
              <p className="mt-1 text-xs text-destructive">{slide.message}</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function summarize({ slides, run }: GenerationProgressState): string {
  const total = slides.length;
  const done = slides.filter((slide) => slide.status === SlideGenerationStatus.Done).length;
  const failed = slides.filter((slide) => slide.status === SlideGenerationStatus.Failed).length;

  switch (run) {
    case GenerationRun.Running: {
      const writing = slides.findIndex((slide) => slide.status === SlideGenerationStatus.Generating);
      return writing === -1 ? `Generating slides… ${done} of ${total} done` : `Writing slide ${writing + 1} of ${total}…`;
    }
    case GenerationRun.Finished:
      return failed === 0
        ? `Generated ${total} ${total === 1 ? "slide" : "slides"}`
        : `Generated ${done} of ${total} slides. ${failed} failed.`;
    case GenerationRun.Stopped:
      return `Stopped after ${done} of ${total} slides.`;
    case GenerationRun.Failed:
      return `Generation stopped after ${done} of ${total} slides.`;
  }
}
