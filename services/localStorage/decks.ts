import { z } from "zod";
import type { Deck } from "@/features/deck/types";
import { deckSchema } from "@/features/deck/utils/schema";

export const DECKS_STORAGE_KEY = "ai-ppt-builder:decks";
export const DECKS_BACKUP_STORAGE_KEY = `${DECKS_STORAGE_KEY}:backup`;

const storedDecksSchema = z.object({
  version: z.literal(1),
  decks: z.array(z.unknown()),
});

export type LoadDecksResult = {
  decks: Deck[];
  /** Explains why some or all saved data could not be used. The app continues with `decks`. */
  warning: string | null;
};

type SaveDecksResult = { ok: true } | { ok: false; error: string };

/**
 * Reads decks from browser storage. Saved data is untrusted: every deck is validated,
 * and unreadable data is copied to a backup key before the app can overwrite it.
 */
export function loadDecks(): LoadDecksResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(DECKS_STORAGE_KEY);
  } catch (error) {
    return {
      decks: [],
      warning: `Saved presentations can't be loaded because browser storage is unavailable (${describeError(error)}).`,
    };
  }
  if (raw === null) return { decks: [], warning: null };

  const stored = storedDecksSchema.safeParse(parseJson(raw));
  if (!stored.success) {
    return {
      decks: [],
      warning: `Saved presentations could not be read, so the app started empty. ${backupNotice(raw)}`,
    };
  }

  const decks = stored.data.decks.flatMap((candidate) => {
    const parsed = deckSchema.safeParse(candidate);
    return parsed.success ? [parsed.data] : [];
  });
  const skippedCount = stored.data.decks.length - decks.length;
  if (skippedCount === 0) return { decks, warning: null };

  return {
    decks,
    warning: `${skippedCount} saved presentation(s) could not be read and were skipped. ${backupNotice(raw)}`,
  };
}

export function saveDecks(decks: Deck[]): SaveDecksResult {
  try {
    localStorage.setItem(DECKS_STORAGE_KEY, JSON.stringify({ version: 1, decks }));
    return { ok: true };
  } catch (error) {
    const storageFull = error instanceof DOMException && error.name === "QuotaExceededError";
    return {
      ok: false,
      error: storageFull
        ? "Browser storage is full, so recent changes were not saved. Delete a presentation to free up space."
        : `Recent changes could not be saved (${describeError(error)}).`,
    };
  }
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // Invalid JSON is reported by the schema check that follows.
    return undefined;
  }
}

function backupNotice(raw: string): string {
  try {
    localStorage.setItem(DECKS_BACKUP_STORAGE_KEY, raw);
    return "The original data was kept as a backup in browser storage.";
  } catch (error) {
    console.error("Could not back up unreadable presentation data", error);
    return "The original data could not be backed up.";
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
