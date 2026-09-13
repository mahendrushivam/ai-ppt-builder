import { describe, expect, test, vi } from "vitest";
import { failStorageWrites } from "@/testing/mocks/local-storage";
import type { ChatEntry } from "../../types";
import { CHATS_STORAGE_KEY, loadChat, saveChat } from "../chat-storage";

function entry(id: string, text: string, kind: ChatEntry["kind"] = "user"): ChatEntry {
  return { id, kind, text };
}

describe("chat storage", () => {
  test("loads the conversation saved for a deck", () => {
    const entries = [entry("1", "Shorten slide 1"), entry("2", "Done.", "assistant")];

    expect(saveChat("deck_a", entries, ["deck_a"])).toBe(true);

    expect(loadChat("deck_a")).toEqual(entries);
    expect(loadChat("deck_b")).toEqual([]);
  });

  test("removes conversations of deleted decks when saving", () => {
    saveChat("deck_old", [entry("1", "Hi")], ["deck_old"]);

    saveChat("deck_new", [entry("2", "Hello")], ["deck_new"]);

    expect(loadChat("deck_old")).toEqual([]);
    expect(loadChat("deck_new")).toEqual([entry("2", "Hello")]);
  });

  test("skips unreadable entries and treats invalid data as empty", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem(
      CHATS_STORAGE_KEY,
      JSON.stringify({ version: 1, chats: { deck_a: [entry("1", "Hi"), { kind: "robot" }] } }),
    );
    expect(loadChat("deck_a")).toEqual([entry("1", "Hi")]);

    localStorage.setItem(CHATS_STORAGE_KEY, "{not json");
    expect(loadChat("deck_a")).toEqual([]);
  });

  test("reports a save that browser storage rejected", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    failStorageWrites();

    expect(saveChat("deck_a", [entry("1", "Hi")], ["deck_a"])).toBe(false);
  });
});
