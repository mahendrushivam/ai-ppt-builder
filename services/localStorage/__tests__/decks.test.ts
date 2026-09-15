import { describe, expect, test } from "vitest";
import { contentSlide, deckWith, paragraph, twoColumnSlide } from "@/testing/fixtures";
import { failStorageWrites } from "@/testing/mocks/local-storage";
import { DECKS_BACKUP_STORAGE_KEY, DECKS_STORAGE_KEY, loadDecks, saveDecks } from "../decks";

describe("deck storage", () => {
  test("loads the decks it saved", () => {
    const deck = deckWith(contentSlide("a"));

    expect(saveDecks([deck])).toEqual({ ok: true });
    expect(loadDecks()).toEqual({ decks: [deck], warning: null });
  });

  test("turns the column ratios saved by version 1 into column splits", () => {
    const deck = deckWith(twoColumnSlide("a", [paragraph("left")], []), contentSlide("b"));
    const version1Deck = {
      ...deck,
      slides: deck.slides.map(({ hints, ...slide }, index) => ({
        ...slide,
        hints: { align: hints.align, columnRatio: index === 0 ? "2:1" : "1:1" },
      })),
    };
    localStorage.setItem(DECKS_STORAGE_KEY, JSON.stringify({ version: 1, decks: [version1Deck] }));

    const result = loadDecks();

    expect(result.warning).toBeNull();
    expect(result.decks[0].slides.map((slide) => slide.hints.columnSplit)).toEqual([66.67, 50]);
    saveDecks(result.decks);
    expect(JSON.parse(localStorage.getItem(DECKS_STORAGE_KEY) ?? "{}")).toMatchObject({ version: 2 });
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
