import type { Deck, Slide } from "@/features/deck/types";
import { type ChangeGroup, ChangeGroupKind, type DeckChange } from "@/features/decks/hooks/use-decks-store";

export const HISTORY_LIMIT = 50;

/** Typing that pauses for longer than this starts a new undo step. */
export const TYPING_MERGE_MS = 1000;

/** One undo or redo step: where the deck still looks like `expected`, it goes back to `target`. */
type HistoryStep = { expected: Deck; target: Deck; group: ChangeGroup | null; at: number };

export type DeckHistory = { past: HistoryStep[]; future: HistoryStep[] };

export const EMPTY_HISTORY: DeckHistory = { past: [], future: [] };

export type HistoryOutcome = {
  /** The deck to store, or `null` when nothing could be put back. */
  deck: Deck | null;
  history: DeckHistory;
  /** Slides left as they are because they changed after the step. */
  skippedSlideCount: number;
};

/** Adds a change as a new undo step, or merges it into the last step of the same group. */
export function recordChange(history: DeckHistory, change: DeckChange, at: number): DeckHistory {
  const last = history.past.at(-1);
  if (last && canMerge(last, change, at)) {
    return { past: history.past.with(-1, { ...last, expected: change.after, at }), future: [] };
  }
  const step: HistoryStep = { expected: change.after, target: change.before, group: change.group, at };
  return { past: [...history.past, step].slice(-HISTORY_LIMIT), future: [] };
}

export function undo(history: DeckHistory, current: Deck): HistoryOutcome | null {
  const step = history.past.at(-1);
  if (!step) return null;
  const { deck, skippedSlideIds, opposite } = applyStep(current, step);
  return {
    deck,
    // Redoing past a skipped slide could overwrite the change that made it skip, so redo starts over.
    history: { past: history.past.slice(0, -1), future: skippedSlideIds.length > 0 ? [] : [...history.future, opposite] },
    skippedSlideCount: skippedSlideIds.length,
  };
}

export function redo(history: DeckHistory, current: Deck): HistoryOutcome | null {
  const step = history.future.at(-1);
  if (!step) return null;
  const { deck, skippedSlideIds, opposite } = applyStep(current, step);
  return {
    deck,
    history: { past: [...history.past, opposite], future: history.future.slice(0, -1) },
    skippedSlideCount: skippedSlideIds.length,
  };
}

function canMerge(last: HistoryStep, change: DeckChange, at: number): boolean {
  const { group } = change;
  if (!group || !last.group || last.group.kind !== group.kind || last.group.id !== group.id) return false;
  // A step only grows from the state it ended in, so a change from somewhere else in between starts a new step.
  if (last.expected !== change.before) return false;
  return group.kind === ChangeGroupKind.Run || at - last.at <= TYPING_MERGE_MS;
}

/**
 * Puts back the slides, slide order, title and theme a step changed, wherever they are still
 * as the step left them. Slides edited since, for example by an AI change that arrived later,
 * keep their current content.
 */
function applyStep(current: Deck, step: HistoryStep) {
  const { expected, target } = step;
  const currentById = slidesById(current.slides);
  const expectedById = slidesById(expected.slides);
  const targetById = slidesById(target.slides);

  /** Slide id → the slide to put back, or `null` to remove it. */
  const replacements = new Map<string, Slide | null>();
  const skippedSlideIds: string[] = [];
  for (const id of new Set([...expectedById.keys(), ...targetById.keys()])) {
    const expectedSlide = expectedById.get(id);
    const targetSlide = targetById.get(id);
    if (expectedSlide === targetSlide) continue;

    const currentSlide = currentById.get(id);
    if (currentSlide !== expectedSlide) {
      skippedSlideIds.push(id);
      continue;
    }
    // A new revision keeps rejecting AI edits that were prepared against the content being replaced.
    replacements.set(id, targetSlide && currentSlide ? { ...targetSlide, revision: currentSlide.revision + 1 } : (targetSlide ?? null));
  }

  const orderIsUnchanged = sameSlideOrder(current.slides, expected.slides);
  const baseOrder = (orderIsUnchanged ? target.slides : current.slides).map((slide) => slide.id);
  let slides = baseOrder.flatMap((id) => {
    const slide = replacements.has(id) ? replacements.get(id) : currentById.get(id);
    return slide ? [slide] : [];
  });
  // Slides the base order doesn't contain: ones being put back, and current ones that are kept.
  for (const [id, slide] of replacements) {
    if (slide && !slides.some((candidate) => candidate.id === id)) {
      slides = slides.toSpliced(Math.min(target.slides.findIndex((candidate) => candidate.id === id), slides.length), 0, slide);
    }
  }
  current.slides.forEach((slide, index) => {
    if (!replacements.has(slide.id) && !slides.some((candidate) => candidate.id === slide.id)) {
      slides = slides.toSpliced(Math.min(index, slides.length), 0, slide);
    }
  });

  const title = current.title === expected.title ? target.title : current.title;
  const themeId = current.themeId === expected.themeId ? target.themeId : current.themeId;
  const changed =
    replacements.size > 0 || title !== current.title || themeId !== current.themeId || !sameSlideOrder(slides, current.slides);
  const deck = changed ? { ...current, title, themeId, slides } : null;

  const opposite: HistoryStep = { expected: deck ?? current, target: expected, group: null, at: step.at };
  return { deck, skippedSlideIds, opposite };
}

function slidesById(slides: Slide[]): Map<string, Slide> {
  return new Map(slides.map((slide) => [slide.id, slide]));
}

function sameSlideOrder(a: Slide[], b: Slide[]): boolean {
  return a.length === b.length && a.every((slide, index) => slide.id === b[index].id);
}
