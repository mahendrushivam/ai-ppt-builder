import type { DeckOperation, Slide, SlideLayout, SlidePatch } from "@/features/deck/types";
import { useDecksStore } from "@/features/decks/hooks/use-decks-store";
import type { ThemeId } from "@/features/themes/types";
import { createStarterSlide } from "../utils/slide-editing";

/**
 * Editing commands for one deck. Each command becomes a DeckOperation, using the slide's
 * revision from the store at the moment of the edit. Rejected operations are passed to
 * `onError` so the editor can explain them.
 */
export function useSlideActions(deckId: string, onError: (message: string) => void) {
  function apply(operation: DeckOperation): boolean {
    const result = useDecksStore.getState().applyOperation(deckId, operation);
    if (!result.ok) onError(result.message);
    return result.ok;
  }

  function applyToSlide(slideId: string, buildOperation: (slide: Slide) => DeckOperation): boolean {
    const slide = useDecksStore
      .getState()
      .decks.find((deck) => deck.id === deckId)
      ?.slides.find((candidate) => candidate.id === slideId);
    if (!slide) {
      onError("That slide no longer exists.");
      return false;
    }
    return apply(buildOperation(slide));
  }

  return {
    /** Returns the new slide's id, or `null` when it could not be added. */
    addSlide(layout: SlideLayout, afterSlideId: string | null): string | null {
      const slide = createStarterSlide(layout);
      return apply({ type: "slide.add", slide, afterSlideId }) ? slide.id : null;
    },
    updateSlide(slideId: string, patch: SlidePatch): boolean {
      return applyToSlide(slideId, (slide) => ({
        type: "slide.update",
        slideId,
        baseRevision: slide.revision,
        patch,
      }));
    },
    deleteSlide(slideId: string): boolean {
      return applyToSlide(slideId, (slide) => ({ type: "slide.delete", slideId, baseRevision: slide.revision }));
    },
    moveSlide(slideId: string, afterSlideId: string | null): boolean {
      return apply({ type: "slide.move", slideId, afterSlideId });
    },
    changeLayout(slideId: string, layout: SlideLayout): boolean {
      return applyToSlide(slideId, (slide) => ({
        type: "slide.changeLayout",
        slideId,
        baseRevision: slide.revision,
        layout,
      }));
    },
    renameDeck(title: string): boolean {
      return apply({ type: "deck.rename", title });
    },
    setTheme(themeId: ThemeId): boolean {
      return apply({ type: "deck.setTheme", themeId });
    },
  };
}

export type SlideActions = ReturnType<typeof useSlideActions>;
