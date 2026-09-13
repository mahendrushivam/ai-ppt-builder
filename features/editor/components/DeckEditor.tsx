"use client";

import Link from "next/link";
import { useState } from "react";
import { flushSync } from "react-dom";
import { ColorModeMenu } from "@/components/ColorModeMenu";
import { buttonClassName } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Notice } from "@/components/ui/Notice";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatPanel } from "@/features/ai/components/ChatPanel";
import type { Slide, SlideLayout } from "@/features/deck/types";
import { DeckTitleField } from "@/features/decks/components/DeckTitleField";
import { DecksStatus, useDecksStore } from "@/features/decks/hooks/use-decks-store";
import { ThemeSelector } from "@/features/themes/components/ThemeSelector";
import { THEMES } from "@/features/themes/utils/themes";
import { useSlideActions } from "../hooks/use-slide-actions";
import { editFieldId, selectionAfterDelete } from "../utils/slide-editing";
import { AddSlideMenu } from "./AddSlideMenu";
import { SlideCanvas } from "./SlideCanvas";
import { SlideInspector } from "./SlideInspector";
import { SlideList } from "./SlideList";

export function DeckEditor({ deckId }: { deckId: string }) {
  const status = useDecksStore((state) => state.status);
  const deck = useDecksStore((state) => state.decks.find((candidate) => candidate.id === deckId));
  const saveError = useDecksStore((state) => state.saveError);

  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [slidePendingDelete, setSlidePendingDelete] = useState<Slide | null>(null);
  const [sidePanel, setSidePanel] = useState<"chat" | "slide">("chat");
  const [actionError, setActionError] = useState<string | null>(null);
  const actions = useSlideActions(deckId, setActionError);

  if (status === DecksStatus.Loading) {
    return (
      <div role="status" className="flex h-dvh items-center justify-center text-sm text-muted-foreground">
        Loading presentation…
      </div>
    );
  }

  if (!deck) {
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">Presentation not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been deleted, or it was created in a different browser.
        </p>
        <Link href="/" className={`${buttonClassName({ variant: "primary" })} mt-6`}>
          Back to presentations
        </Link>
      </main>
    );
  }

  const { slides } = deck;
  const theme = THEMES[deck.themeId];
  const selectedIndex = Math.max(0, slides.findIndex((slide) => slide.id === selectedSlideId));
  const selectedSlide = slides.at(selectedIndex);

  // Settings need a slide to show, so the chat is shown whenever nothing is selected.
  const activePanel = selectedSlide ? sidePanel : "chat";

  function addSlide(layout: SlideLayout) {
    const slideId = actions.addSlide(layout, selectedSlide?.id ?? null);
    if (!slideId) return;
    setSelectedSlideId(slideId);
    setSidePanel("slide");
  }

  function editTarget(target: string) {
    // Render the settings tab synchronously so the field exists before it is focused.
    flushSync(() => setSidePanel("slide"));
    document.getElementById(editFieldId(target))?.focus();
  }

  function confirmDelete(slide: Slide) {
    const nextSelection = selectionAfterDelete(slides, slide.id);
    if (actions.deleteSlide(slide.id)) setSelectedSlideId(nextSelection);
    setSlidePendingDelete(null);
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2">
        <Link href="/" className={buttonClassName({ variant: "ghost", size: "sm" })}>
          ← Presentations
        </Link>
        <DeckTitleField
          key={deck.title}
          title={deck.title}
          label="Presentation title"
          onRename={(title) => actions.renameDeck(title)}
          className="max-w-md min-w-40 flex-1 font-medium"
        />
        <div className="ml-auto flex items-center gap-3">
          <ThemeSelector value={deck.themeId} onChange={(themeId) => actions.setTheme(themeId)} />
          <ColorModeMenu />
        </div>
      </header>

      {(actionError || saveError) && (
        <div className="space-y-2 px-4 pt-3">
          {actionError && (
            <Notice tone="error" onDismiss={() => setActionError(null)}>
              {actionError}
            </Notice>
          )}
          {saveError && <Notice tone="error">{saveError}</Notice>}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="max-h-64 border-b border-border bg-card lg:max-h-none lg:w-60 lg:border-r lg:border-b-0">
          <SlideList
            deck={deck}
            selectedSlideId={selectedSlide?.id ?? null}
            onSelect={setSelectedSlideId}
            onAdd={addSlide}
            onMove={(slideId, { afterSlideId }) => actions.moveSlide(slideId, afterSlideId)}
            onDelete={setSlidePendingDelete}
          />
        </aside>

        <main className="min-h-0 flex-1 overflow-auto p-6">
          {selectedSlide ? (
            <SlideCanvas
              slide={selectedSlide}
              theme={theme}
              onEditTarget={editTarget}
            />
          ) : (
            <div className="mx-auto mt-16 max-w-md rounded-xl border border-dashed border-input bg-card px-6 py-12 text-center">
              <h2 className="text-lg font-medium">This presentation has no slides</h2>
              <p className="mt-1 text-sm text-muted-foreground">Add a slide to start editing.</p>
              <div className="mt-6 flex justify-center">
                <AddSlideMenu onAdd={addSlide} label="Add first slide" />
              </div>
            </div>
          )}
        </main>

        <aside className="flex h-[28rem] min-h-0 flex-col border-t border-border bg-card lg:h-auto lg:w-80 lg:border-t-0 lg:border-l">
          <Tabs
            value={activePanel}
            onValueChange={(value) => setSidePanel(value === "slide" ? "slide" : "chat")}
            className="min-h-0 flex-1 gap-0"
          >
            <TabsList className="mx-3 mt-3 w-auto">
              <TabsTrigger value="chat">AI chat</TabsTrigger>
              <TabsTrigger value="slide" disabled={!selectedSlide}>
                Slide settings
              </TabsTrigger>
            </TabsList>
            {/* Kept mounted while hidden, so switching tabs never loses the conversation or stops a running turn. */}
            <TabsContent value="chat" forceMount className="min-h-0 data-[state=inactive]:hidden">
              <ChatPanel key={deck.id} deckId={deck.id} selectedSlideId={selectedSlide?.id ?? null} />
            </TabsContent>
            <TabsContent value="slide" className="min-h-0 overflow-y-auto">
              {selectedSlide && (
                <SlideInspector
                  key={selectedSlide.id}
                  slide={selectedSlide}
                  position={selectedIndex + 1}
                  actions={actions}
                />
              )}
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      {slidePendingDelete && (
        <ConfirmDialog
          title="Delete slide?"
          description={`"${slidePendingDelete.title || "Untitled slide"}" will be permanently deleted.`}
          confirmLabel="Delete slide"
          onConfirm={() => confirmDelete(slidePendingDelete)}
          onCancel={() => setSlidePendingDelete(null)}
        />
      )}
    </div>
  );
}
