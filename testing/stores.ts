import type { Deck } from "@/features/deck/types";
import { DecksStatus, useDecksStore } from "@/features/decks/hooks/use-decks-store";

const initialDecksState = useDecksStore.getState();

export function resetDecksStore(): void {
  useDecksStore.setState(initialDecksState, true);
}

/** Puts the store in the state it has after decks were loaded from storage. */
export function seedDecks(...decks: Deck[]): void {
  useDecksStore.setState({ status: DecksStatus.Ready, decks, loadWarning: null, saveError: null });
}
