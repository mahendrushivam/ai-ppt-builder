import { useState } from "react";
import { Button } from "@/design-system/components/button";
import type { Deck, Slide, SlideLayout } from "@/features/deck/types";
import { SlideRenderer } from "@/features/renderer/components/SlideRenderer";
import { THEMES } from "@/features/themes/utils/themes";
import { positionForDrop, positionForStep, type SlidePosition } from "../utils/slide-editing";
import { AddSlideMenu } from "./AddSlideMenu";

type SlideListProps = {
  deck: Deck;
  selectedSlideId: string | null;
  onSelect: (slideId: string) => void;
  onAdd: (layout: SlideLayout) => void;
  onMove: (slideId: string, position: SlidePosition) => void;
  onDelete: (slide: Slide) => void;
};

/** Slide thumbnails with selection, drag-and-drop reordering and keyboard-friendly move buttons. */
export function SlideList({ deck, selectedSlideId, onSelect, onAdd, onMove, onDelete }: SlideListProps) {
  const [draggedSlideId, setDraggedSlideId] = useState<string | null>(null);
  const theme = THEMES[deck.themeId];

  function move(slideId: string, position: SlidePosition | null) {
    if (position) onMove(slideId, position);
  }

  return (
    <nav aria-label="Slides" className="flex h-full flex-col">
      {/* At the top so the layout menu opens into visible space, however many slides there are. */}
      <div className="border-b border-border p-3">
        <AddSlideMenu onAdd={onAdd} />
      </div>
      <ol className="flex-1 space-y-3 overflow-y-auto p-3">
        {deck.slides.map((slide, index) => {
          const isSelected = slide.id === selectedSlideId;
          const name = `Slide ${index + 1}: ${slide.title || "Untitled slide"}`;

          return (
            <li
              key={slide.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", slide.id);
                setDraggedSlideId(slide.id);
              }}
              onDragEnd={() => setDraggedSlideId(null)}
              onDragOver={(event) => {
                if (draggedSlideId) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedSlideId) move(draggedSlideId, positionForDrop(deck.slides, draggedSlideId, slide.id));
                setDraggedSlideId(null);
              }}
              className={`group flex gap-2 ${draggedSlideId === slide.id ? "opacity-40" : ""}`}
            >
              <span aria-hidden className="w-5 pt-1 text-right text-xs tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className={`relative overflow-hidden rounded-md border-2 ${isSelected ? "border-primary" : "border-border hover:border-muted-foreground"}`}
                >
                  <div aria-hidden className="pointer-events-none">
                    <SlideRenderer slide={slide} theme={theme} />
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelect(slide.id)}
                    aria-label={name}
                    aria-current={isSelected ? "true" : undefined}
                    className="absolute inset-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  />
                </div>
                <div
                  className={`mt-1 flex justify-end gap-0.5 group-focus-within:opacity-100 group-hover:opacity-100 ${isSelected ? "opacity-100" : "opacity-0"}`}
                >
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Move ${name} up`}
                    disabled={index === 0}
                    onClick={() => move(slide.id, positionForStep(deck.slides, slide.id, "up"))}
                  >
                    ↑
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Move ${name} down`}
                    disabled={index === deck.slides.length - 1}
                    onClick={() => move(slide.id, positionForStep(deck.slides, slide.id, "down"))}
                  >
                    ↓
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${name}`}
                    onClick={() => onDelete(slide)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    ×
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
