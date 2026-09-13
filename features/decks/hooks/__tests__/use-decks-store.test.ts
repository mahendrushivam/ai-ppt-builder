import { describe, expect, test } from "vitest";
import { contentSlide, deckWith } from "@/testing/fixtures";
import { seedDecks } from "@/testing/stores";
import { useDecksStore } from "../use-decks-store";

describe("decks store", () => {
  test("applies an operation to one deck and stamps updatedAt", () => {
    const deck = { ...deckWith(contentSlide("a")), updatedAt: "2020-01-01T00:00:00.000Z" };
    const other = deckWith();
    seedDecks(deck, other);

    const result = useDecksStore.getState().applyOperation(deck.id, { type: "deck.rename", title: "Renamed" });

    expect(result.ok).toBe(true);
    const [updated, untouched] = useDecksStore.getState().decks;
    expect(updated.title).toBe("Renamed");
    expect(updated.updatedAt).not.toBe(deck.updatedAt);
    expect(untouched).toBe(other);
  });

  test("leaves state unchanged when an operation is rejected", () => {
    const deck = deckWith(contentSlide("a", [], 2));
    seedDecks(deck);

    const result = useDecksStore
      .getState()
      .applyOperation(deck.id, { type: "slide.delete", slideId: "a", baseRevision: 0 });

    expect(result).toMatchObject({ ok: false, code: "conflict" });
    expect(useDecksStore.getState().decks[0]).toBe(deck);
  });

  test("reports a deck that does not exist", () => {
    seedDecks();

    expect(
      useDecksStore.getState().applyOperation("missing", { type: "deck.rename", title: "Renamed" }),
    ).toMatchObject({ ok: false, code: "not_found" });
  });

  test("creates new decks first and deletes decks", () => {
    const existing = deckWith();
    seedDecks(existing);

    const created = useDecksStore.getState().createDeck();
    expect(useDecksStore.getState().decks.map((deck) => deck.id)).toEqual([created.id, existing.id]);

    useDecksStore.getState().deleteDeck(existing.id);
    expect(useDecksStore.getState().decks).toEqual([created]);
  });
});
