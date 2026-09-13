"use client";

import { useRouter } from "next/navigation";
import { ColorModeMenu } from "@/components/ColorModeMenu";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { Deck } from "@/features/deck/types";
import { DecksStatus, useDecksStore } from "../hooks/use-decks-store";
import { DeckCard } from "./DeckCard";

export function DeckDashboard() {
  const router = useRouter();
  const status = useDecksStore((state) => state.status);
  const decks = useDecksStore((state) => state.decks);
  const loadWarning = useDecksStore((state) => state.loadWarning);
  const saveError = useDecksStore((state) => state.saveError);
  const dismissLoadWarning = useDecksStore((state) => state.dismissLoadWarning);

  function createPresentation() {
    const deck = useDecksStore.getState().createDeck();
    router.push(`/decks/${deck.id}`);
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Presentations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Saved in this browser.</p>
        </div>
        <div className="flex items-center gap-2">
          <ColorModeMenu />
          <Button variant="primary" onClick={createPresentation} disabled={status === DecksStatus.Loading}>
            New presentation
          </Button>
        </div>
      </header>

      <div className="mb-6 space-y-3 empty:hidden">
        {loadWarning && (
          <Notice tone="warning" onDismiss={dismissLoadWarning}>
            {loadWarning}
          </Notice>
        )}
        {saveError && <Notice tone="error">{saveError}</Notice>}
      </div>

      <DeckList status={status} decks={decks} onCreate={createPresentation} />
    </main>
  );
}

type DeckListProps = {
  status: DecksStatus;
  decks: Deck[];
  onCreate: () => void;
};

function DeckList({ status, decks, onCreate }: DeckListProps) {
  if (status === DecksStatus.Loading) {
    return (
      <ul aria-busy="true" aria-label="Loading presentations" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((placeholder) => (
          <li key={placeholder} className="aspect-[4/3] animate-pulse rounded-xl bg-muted" />
        ))}
      </ul>
    );
  }

  if (decks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-input bg-card px-6 py-16 text-center">
        <h2 className="text-lg font-medium">No presentations yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">Create a presentation to start adding slides.</p>
        <Button variant="primary" onClick={onCreate} className="mt-6">
          Create your first presentation
        </Button>
      </div>
    );
  }

  const recentFirst = decks.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {recentFirst.map((deck) => (
        <DeckCard key={deck.id} deck={deck} />
      ))}
    </ul>
  );
}
