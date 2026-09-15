import { describe, expect, test } from "vitest";
import type { Deck, DeckOperation } from "@/features/deck/types";
import { applyOperation } from "@/features/deck/utils/operations";
import { type ChangeGroup, ChangeGroupKind, type DeckChange } from "@/features/decks/hooks/use-decks-store";
import { expectOk } from "@/testing/assertions";
import { contentSlide, deckWith } from "@/testing/fixtures";
import { EMPTY_HISTORY, HISTORY_LIMIT, recordChange, redo, TYPING_MERGE_MS, undo } from "../history";

function change(before: Deck, operation: DeckOperation, group: ChangeGroup | null = null): DeckChange {
  return { deckId: before.id, before, after: expectOk(applyOperation(before, operation)), group };
}

function retitle(deck: Deck, slideId: string, title: string, group: ChangeGroup | null = null): DeckChange {
  const revision = deck.slides.find((slide) => slide.id === slideId)?.revision ?? 0;
  return change(deck, { type: "slide.update", slideId, baseRevision: revision, patch: { title } }, group);
}

const typing: ChangeGroup = { kind: ChangeGroupKind.Typing, id: "a:title" };
const titles = (deck: Deck | null) => deck?.slides.map((slide) => slide.title);

describe("undo history", () => {
  test("merges quick typing into one step and starts a new one after a pause", () => {
    const start = deckWith(contentSlide("a"));
    const first = retitle(start, "a", "P", typing);
    const second = retitle(first.after, "a", "Pr", typing);
    const later = retitle(second.after, "a", "Pro", typing);

    let history = recordChange(EMPTY_HISTORY, first, 0);
    history = recordChange(history, second, 500);
    expect(history.past).toHaveLength(1);

    history = recordChange(history, later, 500 + TYPING_MERGE_MS + 1);
    expect(history.past).toHaveLength(2);
  });

  test("keeps every change of one AI run in a single step", () => {
    const run: ChangeGroup = { kind: ChangeGroupKind.Run, id: "turn-1" };
    const start = deckWith(contentSlide("a"), contentSlide("b"));
    const first = retitle(start, "a", "AI title", run);
    const second = retitle(first.after, "b", "AI title too", run);

    const history = recordChange(recordChange(EMPTY_HISTORY, first, 0), second, 60_000);
    const outcome = undo(history, second.after);

    expect(history.past).toHaveLength(1);
    expect(titles(outcome?.deck ?? null)).toEqual(["Slide a", "Slide b"]);
  });

  test("undoes and redoes a change, giving restored slides a new revision", () => {
    const start = deckWith(contentSlide("a"));
    const edit = retitle(start, "a", "Pricing");
    const history = recordChange(EMPTY_HISTORY, edit, 0);

    const undone = undo(history, edit.after);
    expect(titles(undone?.deck ?? null)).toEqual(["Slide a"]);
    expect(undone?.deck?.slides[0].revision).toBe(2);
    if (!undone?.deck) throw new Error("Nothing was undone.");

    const redone = redo(undone.history, undone.deck);
    expect(titles(redone?.deck ?? null)).toEqual(["Pricing"]);
    expect(redone?.history.past).toHaveLength(1);
  });

  test("puts back a deleted slide in its place and removes an added one", () => {
    const start = deckWith(contentSlide("a"), contentSlide("b"), contentSlide("c"));
    const deleted = change(start, { type: "slide.delete", slideId: "b", baseRevision: 0 });
    const added = change(deleted.after, { type: "slide.add", slide: contentSlide("new"), afterSlideId: null });
    const history = recordChange(recordChange(EMPTY_HISTORY, deleted, 0), added, 5000);

    const withoutAdded = undo(history, added.after);
    if (!withoutAdded?.deck) throw new Error("Nothing was undone.");
    expect(withoutAdded.deck.slides.map((slide) => slide.id)).toEqual(["a", "c"]);

    const withDeleted = undo(withoutAdded.history, withoutAdded.deck);
    expect(withDeleted?.deck?.slides.map((slide) => slide.id)).toEqual(["a", "b", "c"]);
  });

  test("leaves slides that changed after the step as they are", () => {
    const start = deckWith(contentSlide("a"), contentSlide("b"));
    const mine = change(start, { type: "slide.move", slideId: "a", afterSlideId: "b" });
    const first = retitle(mine.after, "a", "Mine");
    const both = retitle(first.after, "b", "Mine too");
    const history = recordChange(EMPTY_HISTORY, both, 0);
    const aiEdit = retitle(both.after, "b", "Changed by AI");

    const outcome = undo(history, aiEdit.after);

    expect(outcome?.skippedSlideCount).toBe(1);
    expect(outcome?.deck).toBeNull();
    expect(outcome?.history.future).toEqual([]);
  });

  test(`keeps at most ${HISTORY_LIMIT} steps`, () => {
    let deck = deckWith(contentSlide("a"));
    let history = EMPTY_HISTORY;
    for (let index = 0; index < HISTORY_LIMIT + 5; index += 1) {
      const edit = retitle(deck, "a", `Title ${index}`);
      history = recordChange(history, edit, index * 10_000);
      deck = edit.after;
    }

    expect(history.past).toHaveLength(HISTORY_LIMIT);
  });
});
