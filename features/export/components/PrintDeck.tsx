"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, buttonClassName } from "@/design-system/components/button";
import { Notice } from "@/design-system/components/notice";
import type { Deck, Slide } from "@/features/deck/types";
import { DecksStatus, useDecksStore } from "@/features/decks/hooks/use-decks-store";
import { SlideRenderer } from "@/features/renderer/components/SlideRenderer";
import { THEMES } from "@/features/themes/utils/themes";
import { EXPORT_SLIDE_SIZE, exportSlidePng, slideFileName, waitForSlideAssets } from "../utils/slide-export";

/**
 * Every slide of a deck at export size, one per printed page. Printing is enabled once images
 * and charts are ready; each slide can also be downloaded as a PNG.
 */
export function PrintDeck({ deckId }: { deckId: string }) {
  const status = useDecksStore((state) => state.status);
  const deck = useDecksStore((state) => state.decks.find((candidate) => candidate.id === deckId));

  const slidesRef = useRef<HTMLOListElement>(null);
  // The deck version whose images and charts have finished loading.
  const [readyDeck, setReadyDeck] = useState<Deck | null>(null);
  const [downloadingSlideId, setDownloadingSlideId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const root = slidesRef.current;
    if (!deck || !root) return;
    let isCurrent = true;
    void waitForSlideAssets(root).then(() => {
      if (isCurrent) setReadyDeck(deck);
    });
    return () => {
      isCurrent = false;
    };
  }, [deck]);

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

  const theme = THEMES[deck.themeId];
  const isReady = readyDeck === deck;

  async function downloadSlide(slide: Slide, slideNumber: number, deckTitle: string) {
    const node = slidesRef.current?.querySelector<HTMLElement>(`[data-export-slide="${slide.id}"]`);
    if (!node) return;
    setDownloadingSlideId(slide.id);
    setError(null);
    try {
      await exportSlidePng(node, slideFileName(deckTitle, slideNumber));
    } catch (exportError) {
      console.error("Slide PNG export failed:", exportError);
      setError("The slide couldn't be saved as a PNG. Try again.");
    } finally {
      setDownloadingSlideId(null);
    }
  }

  return (
    <div className="min-h-dvh bg-muted/40 print:bg-transparent">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2 print:hidden">
        <Link href={`/decks/${deck.id}`} className={buttonClassName({ variant: "ghost", size: "sm" })}>
          ← Back to editor
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-medium">{deck.title}</h1>
        <p className="text-xs text-muted-foreground max-lg:hidden">
          To save a PDF, choose “Save as PDF” as the destination in the print dialog.
        </p>
        <Button variant="primary" disabled={!isReady || deck.slides.length === 0} onClick={() => window.print()}>
          {isReady ? "Print or save as PDF" : "Preparing slides…"}
        </Button>
      </header>

      {error && (
        <div className="px-4 pt-3 print:hidden">
          <Notice tone="error" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        </div>
      )}

      {deck.slides.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted-foreground">This presentation has no slides to export.</p>
      ) : (
        <div className="overflow-x-auto print:overflow-visible">
          <ol
            ref={slidesRef}
            aria-label="Slides"
            className="mx-auto flex w-max flex-col gap-8 p-6 print:block print:w-auto print:p-0"
          >
            {deck.slides.map((slide, index) => (
              <li key={slide.id} className="print:break-after-page print:last:break-after-auto">
                <div
                  data-export-slide={slide.id}
                  style={{ width: EXPORT_SLIDE_SIZE.width }}
                  className="shadow-md print:shadow-none"
                >
                  <SlideRenderer slide={slide} theme={theme} imageLoading="eager" />
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground print:hidden">
                  <span>Slide {index + 1}</span>
                  <Button
                    size="sm"
                    aria-label={`Download slide ${index + 1} as PNG`}
                    disabled={!isReady || downloadingSlideId !== null}
                    onClick={() => void downloadSlide(slide, index + 1, deck.title)}
                  >
                    {downloadingSlideId === slide.id ? "Saving PNG…" : "Download PNG"}
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
