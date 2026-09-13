import Link from "next/link";
import { useState } from "react";
import { Button } from "@/design-system/components/button";
import { ConfirmDialog } from "@/design-system/components/confirm-dialog";
import type { Deck } from "@/features/deck/types";
import { SlideRenderer } from "@/features/renderer/components/SlideRenderer";
import { themeStyle } from "@/features/themes/utils/theme-style";
import { THEMES } from "@/features/themes/utils/themes";
import { useDecksStore } from "../hooks/use-decks-store";
import { DeckTitleField } from "./DeckTitleField";

const updatedAtFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function DeckCard({ deck }: { deck: Deck }) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const theme = THEMES[deck.themeId];
  const firstSlide = deck.slides.at(0);
  const slideCount = `${deck.slides.length} ${deck.slides.length === 1 ? "slide" : "slides"}`;
  const href = `/decks/${deck.id}`;

  function rename(title: string) {
    const result = useDecksStore.getState().applyOperation(deck.id, { type: "deck.rename", title });
    setRenameError(result.ok ? null : result.message);
  }

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <Link href={href} tabIndex={-1} aria-hidden className="block border-b border-border">
        {firstSlide ? (
          <SlideRenderer slide={firstSlide} theme={theme} />
        ) : (
          <div
            style={themeStyle(theme)}
            className="flex aspect-video items-center justify-center text-sm [background:var(--slide-background)] text-(--slide-muted)"
          >
            No slides yet
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-4">
        {isRenaming ? (
          <DeckTitleField
            title={deck.title}
            label="Presentation title"
            onRename={rename}
            onDone={() => setIsRenaming(false)}
            autoFocus
          />
        ) : (
          <Link href={href} className="truncate font-medium text-card-foreground hover:underline">
            {deck.title}
          </Link>
        )}
        <p className="text-sm text-muted-foreground">
          {slideCount} · Updated {updatedAtFormat.format(new Date(deck.updatedAt))}
        </p>
        {renameError && (
          <p role="alert" className="text-sm text-destructive">
            {renameError}
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => setIsRenaming(true)} aria-label={`Rename ${deck.title}`}>
            Rename
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsConfirmingDelete(true)}
            aria-label={`Delete ${deck.title}`}
            className="text-destructive hover:bg-destructive/10"
          >
            Delete
          </Button>
        </div>
      </div>

      {isConfirmingDelete && (
        <ConfirmDialog
          title="Delete presentation?"
          description={`"${deck.title}" and its ${slideCount} will be permanently deleted. This can't be undone.`}
          confirmLabel="Delete presentation"
          onConfirm={() => useDecksStore.getState().deleteDeck(deck.id)}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}
    </li>
  );
}
