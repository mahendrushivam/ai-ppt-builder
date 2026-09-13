import { z } from "zod";
import type { ChatEntry } from "../types";

export const CHATS_STORAGE_KEY = "ai-ppt-builder:chats";
/** Older entries are dropped from storage; they are no longer sent to the model anyway. */
const MAX_SAVED_ENTRIES = 50;

export const chatEntrySchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(["user", "assistant", "notice"]),
  text: z.string().max(4000),
});

const storedChatsSchema = z.object({
  version: z.literal(1),
  chats: z.record(z.string(), z.array(z.unknown())),
});

/** Reads the saved conversation of one deck. Saved data is untrusted, so invalid entries are skipped. */
export function loadChat(deckId: string): ChatEntry[] {
  return (readStoredChats()[deckId] ?? []).flatMap((candidate) => {
    const parsed = chatEntrySchema.safeParse(candidate);
    return parsed.success ? [parsed.data] : [];
  });
}

/**
 * Saves one deck's conversation and removes the conversations of decks that no longer
 * exist. Returns `false` when browser storage rejects the write.
 */
export function saveChat(deckId: string, entries: ChatEntry[], existingDeckIds: string[]): boolean {
  const chats = Object.fromEntries(
    Object.entries(readStoredChats()).filter(([id]) => id !== deckId && existingDeckIds.includes(id)),
  );
  if (entries.length > 0) chats[deckId] = entries.slice(-MAX_SAVED_ENTRIES);

  try {
    localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify({ version: 1, chats }));
    return true;
  } catch (error) {
    console.error("Could not save the chat history", error);
    return false;
  }
}

/** Unreadable chat history shouldn't block the editor, so it is logged and treated as empty. */
function readStoredChats(): Record<string, unknown[]> {
  try {
    const raw = localStorage.getItem(CHATS_STORAGE_KEY);
    if (raw === null) return {};
    const parsed = storedChatsSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data.chats;
    console.error("Saved chat history has an unexpected shape and was ignored.");
    return {};
  } catch (error) {
    console.error("Saved chat history could not be read", error);
    return {};
  }
}
