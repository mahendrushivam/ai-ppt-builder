import { z } from "zod";
import {
  type Column,
  type Deck,
  type DeckOperation,
  type OperationFailure,
  OperationFailureCode,
  type OperationResult,
  type Slide,
  type SlideLayout,
} from "../types";
import { createColumn } from "./create";
import { deckTitleSchema, LAYOUT_COLUMN_COUNT, LIMITS, slideSchema } from "./schema";

type OperationOf<T extends DeckOperation["type"]> = Extract<DeckOperation, { type: T }>;

/**
 * Applies one operation without mutating the input. Untouched slides and columns keep
 * their object identity. `updatedAt` is left to the caller that persists the deck.
 */
export function applyOperation(deck: Deck, operation: DeckOperation): OperationResult {
  switch (operation.type) {
    case "slide.add":
      return addSlide(deck, operation);
    case "slide.update":
      return updateSlide(deck, operation);
    case "slide.delete":
      return deleteSlide(deck, operation);
    case "slide.move":
      return moveSlide(deck, operation);
    case "slide.changeLayout":
      return changeLayout(deck, operation);
    case "deck.rename":
      return renameDeck(deck, operation);
    case "deck.setTheme":
      return { ok: true, deck: { ...deck, themeId: operation.themeId } };
  }
}

function addSlide(deck: Deck, { slide, afterSlideId }: OperationOf<"slide.add">): OperationResult {
  if (deck.slides.length >= LIMITS.slidesPerDeck) {
    return failure(OperationFailureCode.Invalid,`A deck can have at most ${LIMITS.slidesPerDeck} slides.`);
  }
  if (deck.slides.some((existing) => existing.id === slide.id)) {
    return failure(OperationFailureCode.Invalid,`Slide id "${slide.id}" is already used.`);
  }
  const parsed = slideSchema.safeParse(slide);
  if (!parsed.success) return failure(OperationFailureCode.Invalid,z.prettifyError(parsed.error));

  const slides = deck.slides.toSpliced(insertionIndex(deck.slides, afterSlideId), 0, slide);
  return { ok: true, deck: { ...deck, slides } };
}

function updateSlide(
  deck: Deck,
  { slideId, baseRevision, patch }: OperationOf<"slide.update">,
): OperationResult {
  const found = findSlideForEdit(deck, slideId, baseRevision);
  if (!found.ok) return found;
  if (Object.values(patch).every((value) => value === undefined)) {
    return failure(OperationFailureCode.Invalid,"The update does not change any field.");
  }

  const { slide, index } = found;
  return replaceSlide(deck, index, {
    ...slide,
    title: patch.title ?? slide.title,
    subtitle: patch.subtitle === undefined ? slide.subtitle : patch.subtitle,
    columns: patch.columns ?? slide.columns,
    notes: patch.notes ?? slide.notes,
    hints: patch.hints ?? slide.hints,
    revision: slide.revision + 1,
  });
}

function deleteSlide(
  deck: Deck,
  { slideId, baseRevision }: OperationOf<"slide.delete">,
): OperationResult {
  const found = findSlideForEdit(deck, slideId, baseRevision);
  if (!found.ok) return found;
  return { ok: true, deck: { ...deck, slides: deck.slides.toSpliced(found.index, 1) } };
}

function moveSlide(deck: Deck, { slideId, afterSlideId }: OperationOf<"slide.move">): OperationResult {
  const slide = deck.slides.find((candidate) => candidate.id === slideId);
  if (!slide) return failure(OperationFailureCode.NotFound,`Slide "${slideId}" does not exist.`);
  if (afterSlideId === slideId) return failure(OperationFailureCode.Invalid,"A slide cannot be moved after itself.");

  const remaining = deck.slides.filter((candidate) => candidate.id !== slideId);
  const slides = remaining.toSpliced(insertionIndex(remaining, afterSlideId), 0, slide);
  return { ok: true, deck: { ...deck, slides } };
}

function changeLayout(
  deck: Deck,
  { slideId, baseRevision, layout, columns }: OperationOf<"slide.changeLayout">,
): OperationResult {
  const found = findSlideForEdit(deck, slideId, baseRevision);
  if (!found.ok) return found;

  const { slide, index } = found;
  if (layout === slide.layout && columns === undefined) return { ok: true, deck };

  const nextColumns = columns ?? redistributeColumns(slide.columns, layout);
  const overfull = nextColumns.find((column) => column.blocks.length > LIMITS.blocksPerColumn);
  if (overfull) {
    return failure(
      OperationFailureCode.Invalid,
      `The "${layout}" layout would put ${overfull.blocks.length} blocks in one column (max ${LIMITS.blocksPerColumn}). Remove some blocks first.`,
    );
  }

  return replaceSlide(deck, index, {
    ...slide,
    layout,
    columns: nextColumns,
    revision: slide.revision + 1,
  });
}

function renameDeck(deck: Deck, { title }: OperationOf<"deck.rename">): OperationResult {
  const parsed = deckTitleSchema.safeParse(title);
  if (!parsed.success) return failure(OperationFailureCode.Invalid,z.prettifyError(parsed.error));
  return { ok: true, deck: { ...deck, title } };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function failure(code: OperationFailure["code"], message: string): OperationFailure {
  return { ok: false, code, message };
}

function findSlideForEdit(
  deck: Deck,
  slideId: string,
  baseRevision: number,
): { ok: true; slide: Slide; index: number } | OperationFailure {
  const index = deck.slides.findIndex((slide) => slide.id === slideId);
  if (index === -1) return failure(OperationFailureCode.NotFound,`Slide "${slideId}" does not exist.`);

  const slide = deck.slides[index];
  if (slide.revision !== baseRevision) {
    return failure(
      OperationFailureCode.Conflict,
      `Slide "${slideId}" changed since this edit was prepared (revision ${slide.revision}, expected ${baseRevision}).`,
    );
  }
  return { ok: true, slide, index };
}

/** Validates the changed slide so every operation source is held to the same rules. */
function replaceSlide(deck: Deck, index: number, candidate: Slide): OperationResult {
  const parsed = slideSchema.safeParse(candidate);
  if (!parsed.success) return failure(OperationFailureCode.Invalid,z.prettifyError(parsed.error));
  return { ok: true, deck: { ...deck, slides: deck.slides.with(index, candidate) } };
}

/** Index just after the anchor. `null` means the start; a missing anchor appends to the end. */
function insertionIndex(slides: Slide[], afterSlideId: string | null): number {
  if (afterSlideId === null) return 0;
  const anchorIndex = slides.findIndex((slide) => slide.id === afterSlideId);
  return anchorIndex === -1 ? slides.length : anchorIndex + 1;
}

/**
 * Fits existing blocks into the column count of a new layout, preserving block order
 * and reusing existing column ids. Switching to a title/section layout drops columns,
 * so the editor must make that explicit to the user.
 */
function redistributeColumns(columns: Column[], layout: SlideLayout): Column[] {
  const targetCount = LAYOUT_COLUMN_COUNT[layout];
  if (columns.length === targetCount) return columns;
  if (targetCount === 0) return [];

  const blocks = columns.flatMap((column) => column.blocks);
  const [first = createColumn(), second = createColumn()] = columns;
  if (targetCount === 1) return [{ ...first, heading: null, blocks }];

  const splitAt = Math.ceil(blocks.length / 2);
  return [
    { ...first, blocks: blocks.slice(0, splitAt) },
    { ...second, blocks: blocks.slice(splitAt) },
  ];
}
