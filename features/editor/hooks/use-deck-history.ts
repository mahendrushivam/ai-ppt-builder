import { type RefObject, useEffect, useRef, useState } from "react";
import type { Deck } from "@/features/deck/types";
import { useDecksStore } from "@/features/decks/hooks/use-decks-store";
import { type DeckHistory, EMPTY_HISTORY, type HistoryOutcome, recordChange, redo, undo } from "../utils/history";

type HistoryMove = (history: DeckHistory, current: Deck) => HistoryOutcome | null;

const SKIPPED_MESSAGE = "Some slides were left as they are because they changed after that step.";

/**
 * Undo and redo for one deck while it is open in the editor; the history is not saved. Every
 * change to the deck is recorded, whether it came from the editor or the AI. Cmd/Ctrl+Z and
 * Shift+Cmd/Ctrl+Z work everywhere except in text fields, which keep their own undo.
 */
export function useDeckHistory(deckId: string, onError: (message: string) => void) {
  const [history, setHistory] = useState<DeckHistory>(EMPTY_HISTORY);
  // The store listener and keyboard handler run between renders, so they read and write this copy.
  const historyRef = useRef(history);

  useEffect(() => {
    const unsubscribe = useDecksStore.subscribe((state, previous) => {
      const change = state.lastChange;
      if (!change || change === previous.lastChange || change.deckId !== deckId) return;
      historyRef.current = recordChange(historyRef.current, change, Date.now());
      setHistory(historyRef.current);
    });

    function handleKeyDown(event: KeyboardEvent) {
      const isShortcut = (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "z";
      if (!isShortcut || isTextField(event.target)) return;
      event.preventDefault();
      moveThroughHistory(deckId, historyRef, setHistory, onError, event.shiftKey ? redo : undo);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      unsubscribe();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [deckId, onError]);

  return {
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undo: () => moveThroughHistory(deckId, historyRef, setHistory, onError, undo),
    redo: () => moveThroughHistory(deckId, historyRef, setHistory, onError, redo),
  };
}

function moveThroughHistory(
  deckId: string,
  historyRef: RefObject<DeckHistory>,
  setHistory: (history: DeckHistory) => void,
  onError: (message: string) => void,
  move: HistoryMove,
) {
  const deck = useDecksStore.getState().decks.find((candidate) => candidate.id === deckId);
  const outcome = deck ? move(historyRef.current, deck) : null;
  if (!outcome) return;
  historyRef.current = outcome.history;
  setHistory(outcome.history);
  if (outcome.deck) useDecksStore.getState().restoreDeck(outcome.deck);
  if (outcome.skippedSlideCount > 0) onError(SKIPPED_MESSAGE);
}

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.matches("input, textarea, select");
}
