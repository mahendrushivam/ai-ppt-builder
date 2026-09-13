import { useEffect } from "react";
import { loadDecks, saveDecks } from "@/services/localStorage/decks";
import { DecksStatus, useDecksStore } from "./use-decks-store";

const SAVE_DELAY_MS = 300;

/** Loads decks from browser storage once, then saves them shortly after every change. */
export function useDeckPersistence(): void {
  useEffect(() => {
    const store = useDecksStore;
    if (store.getState().status === DecksStatus.Loading) store.getState().hydrate(loadDecks());

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
