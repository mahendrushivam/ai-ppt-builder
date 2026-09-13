import { describe, expect, test } from "vitest";
import { contentSlide, deckWith } from "@/testing/fixtures";
import { failStorageWrites } from "@/testing/mocks/local-storage";
import { DECKS_BACKUP_STORAGE_KEY, DECKS_STORAGE_KEY, loadDecks, saveDecks } from "../deck-storage";

describe("deck storage", () => {
  test("loads the decks it saved", () => {
    const deck = deckWith(contentSlide("a"));

    expect(saveDecks([deck])).toEqual({ ok: true });
    expect(loadDecks()).toEqual({ decks: [deck], warning: null });
  });

  test("starts empty without a warning when nothing was saved", () => {
    expect(loadDecks()).toEqual({ decks: [], warning: null });
  });

  test("keeps readable decks, skips broken ones and backs up the original data", () => {
    const valid = deckWith(contentSlide("a"));
    const raw = JSON.stringify({ version: 1, decks: [valid, { id: "broken" }] });
    localStorage.setItem(DECKS_STORAGE_KEY, raw);

    const result = loadDecks();

    expect(result.decks).toEqual([valid]);
    expect(result.warning).toContain("1 saved presentation(s) could not be read");
    expect(localStorage.getItem(DECKS_BACKUP_STORAGE_KEY)).toBe(raw);
  });

  test("starts empty with a warning when saved data is not valid JSON", () => {
    localStorage.setItem(DECKS_STORAGE_KEY, "{not json");

    const result = loadDecks();

    expect(result.decks).toEqual([]);
    expect(result.warning).toContain("could not be read");
    expect(localStorage.getItem(DECKS_BACKUP_STORAGE_KEY)).toBe("{not json");
  });

  test("reports full storage instead of throwing", () => {
    failStorageWrites();

    expect(saveDecks([deckWith()])).toEqual({
      ok: false,
      error: expect.stringContaining("Browser storage is full"),
    });
  });
});
