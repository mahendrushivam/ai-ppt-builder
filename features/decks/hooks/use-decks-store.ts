import { create } from "zustand";
import { type Deck, type DeckOperation, OperationFailureCode, type OperationResult } from "@/features/deck/types";
import { createDeck } from "@/features/deck/utils/create";
import { applyOperation as applyOperationToDeck } from "@/features/deck/utils/operations";
import type { LoadDecksResult } from "../services/deck-storage";

export enum DecksStatus {
  /** Saved decks have not been read from browser storage yet. */
  Loading = "loading",
  Ready = "ready",
}

type DecksState = {
  status: DecksStatus;
  decks: Deck[];
  loadWarning: string | null;
  saveError: string | null;

  hydrate: (result: LoadDecksResult) => void;
  createDeck: () => Deck;
  deleteDeck: (deckId: string) => void;
  /** The only way deck content changes: applies a DeckOperation and stamps `updatedAt`. */
  applyOperation: (deckId: string, operation: DeckOperation) => OperationResult;
  setSaveError: (message: string | null) => void;
  dismissLoadWarning: () => void;
};

export const useDecksStore = create<DecksState>()((set, get) => ({
  status: DecksStatus.Loading,
  decks: [],
  loadWarning: null,
  saveError: null,

  hydrate: ({ decks, warning }) => set({ status: DecksStatus.Ready, decks, loadWarning: warning }),

  createDeck: () => {
    const deck = createDeck();
    set((state) => ({ decks: [deck, ...state.decks] }));
    return deck;
  },

  deleteDeck: (deckId) =>
    set((state) => ({ decks: state.decks.filter((deck) => deck.id !== deckId) })),

  applyOperation: (deckId, operation) => {
    const deck = get().decks.find((candidate) => candidate.id === deckId);
    if (!deck) {
      return { ok: false, code: OperationFailureCode.NotFound, message: "This presentation no longer exists." };
    }

    const result = applyOperationToDeck(deck, operation);
    if (!result.ok || result.deck === deck) return result;

    const updated: Deck = { ...result.deck, updatedAt: new Date().toISOString() };
    set((state) => ({
      decks: state.decks.map((candidate) => (candidate.id === deckId ? updated : candidate)),
    }));
    return { ok: true, deck: updated };
  },

  setSaveError: (message) => {
    if (get().saveError !== message) set({ saveError: message });
  },

  dismissLoadWarning: () => set({ loadWarning: null }),
}));
