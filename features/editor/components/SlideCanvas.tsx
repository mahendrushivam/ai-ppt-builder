import type { Slide } from "@/features/deck/types";
import { SlideRenderer } from "@/features/renderer/components/SlideRenderer";
import type { Theme } from "@/features/themes/types";

type SlideCanvasProps = {
  slide: Slide;
  theme: Theme;
  /** Called with the `data-edit-target` of the slide element the user clicked. */
  onEditTarget: (target: string) => void;
};

/**
 * Shows the selected slide. Editing happens in the settings panel; clicking text on the
 * slide is a shortcut to the matching field, so the renderer itself stays read-only.
 */
export function SlideCanvas({ slide, theme, onEditTarget }: SlideCanvasProps) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div
        onClick={(event) => {
          const element = event.target instanceof Element ? event.target.closest("[data-edit-target]") : null;
          const target = element?.getAttribute("data-edit-target");
          if (target) onEditTarget(target);
        }}
        className="overflow-hidden rounded-lg shadow-lg ring-1 ring-foreground/10 [&_[data-edit-target]]:cursor-text [&_[data-edit-target]:hover]:outline-2 [&_[data-edit-target]:hover]:outline-offset-4 [&_[data-edit-target]:hover]:outline-ring/60 [&_[data-edit-target]:hover]:outline-dashed"
      >
        <SlideRenderer slide={slide} theme={theme} />
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">Click text on the slide to edit it.</p>
    </div>
  );
}
