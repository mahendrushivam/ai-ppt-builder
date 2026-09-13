import { useEffect } from "react";
import type { Deck } from "@/features/deck/types";
import { referencedUploadIds } from "@/features/deck/utils/uploaded-image";
import { deleteUnusedImages } from "@/services/indexedDb/images";
import { loadDecks, saveDecks } from "@/services/localStorage/decks";
import { DecksStatus, useDecksStore } from "./use-decks-store";

const SAVE_DELAY_MS = 300;
/**
 * Uploads are kept a day after no deck uses them: another open tab may have added one to a deck
 * it hasn't saved yet.
 */
const UNUSED_UPLOAD_KEEP_MS = 24 * 60 * 60 * 1000;

function removeUnusedUploads(decks: Deck[]): void {
  deleteUnusedImages(referencedUploadIds(decks), Date.now() - UNUSED_UPLOAD_KEEP_MS).catch((error: unknown) => {
    console.error("Unused uploaded images could not be removed:", error);
  });
}

/** Loads decks from browser storage once, then saves them shortly after every change. */
export function useDeckPersistence(): void {
  useEffect(() => {
    const store = useDecksStore;
    if (store.getState().status === DecksStatus.Loading) {
      const loaded = loadDecks();
      store.getState().hydrate(loaded);
      // Decks that couldn't be read may still use uploads, so nothing is removed after a load warning.
      if (loaded.warning === null) removeUnusedUploads(loaded.decks);
    }

    let pendingSave: ReturnType<typeof setTimeout> | undefined;

    const save = () => {
      pendingSave = undefined;
      const result = saveDecks(store.getState().decks);
      store.getState().setSaveError(result.ok ? null : result.error);
    };

    const flushPendingSave = () => {
      if (pendingSave === undefined) return;
      clearTimeout(pendingSave);
      save();
    };

    const unsubscribe = store.subscribe((state, previous) => {
      if (state.status !== DecksStatus.Ready || state.decks === previous.decks) return;
      clearTimeout(pendingSave);
      pendingSave = setTimeout(save, SAVE_DELAY_MS);
    });
    window.addEventListener("pagehide", flushPendingSave);

    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", flushPendingSave);
      flushPendingSave();
    };
  }, []);
}
