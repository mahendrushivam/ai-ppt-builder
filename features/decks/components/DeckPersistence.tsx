"use client";

import { useDeckPersistence } from "../hooks/use-deck-persistence";

/** Keeps decks in sync with browser storage for the whole app. Renders nothing. */
export function DeckPersistence() {
  useDeckPersistence();
  return null;
}
