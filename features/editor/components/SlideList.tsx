import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { Button, buttonClassName } from "@/design-system/components/button";
import type { Deck, Slide, SlideLayout } from "@/features/deck/types";
import { SlideRenderer } from "@/features/renderer/components/SlideRenderer";
import type { Theme } from "@/features/themes/types";
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

/**
 * Slide thumbnails with selection and reordering: drag a thumbnail or its handle (the handle also
 * works with the keyboard and announces moves to screen readers), or use the move buttons.
 */
export function SlideList({ deck, selectedSlideId, onSelect, onAdd, onMove, onDelete }: SlideListProps) {
  const theme = THEMES[deck.themeId];
  const sensors = useSensors(
    // Moving a few pixels before a drag starts keeps a click on a thumbnail a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const nameOf = (slideId: UniqueIdentifier) => {
    const index = deck.slides.findIndex((slide) => slide.id === slideId);
    return index === -1 ? "the slide" : slideName(deck.slides[index], index);
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} is over the place of ${nameOf(over.id)}.` : `${nameOf(active.id)} is not over a slide.`,
    onDragEnd: ({ active, over }) =>
      over ? `${nameOf(active.id)} was moved to the place of ${nameOf(over.id)}.` : `${nameOf(active.id)} was dropped.`,
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} was cancelled.`,
  };

  function move(slideId: string, position: SlidePosition | null) {
    if (position) onMove(slideId, position);
  }

  function moveDroppedSlide({ active, over }: DragEndEvent) {
    if (over) move(String(active.id), positionForDrop(deck.slides, String(active.id), String(over.id)));
  }

  return (
    <nav aria-label="Slides" className="flex h-full flex-col">
      {/* At the top so the layout menu opens into visible space, however many slides there are. */}
      <div className="border-b border-border p-3">
        <AddSlideMenu onAdd={onAdd} />
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={moveDroppedSlide}
        accessibility={{ announcements }}
      >
        <SortableContext items={deck.slides.map((slide) => slide.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex-1 space-y-3 overflow-y-auto p-3">
            {deck.slides.map((slide, index) => (
              <SlideListItem
                key={slide.id}
                slide={slide}
                name={slideName(slide, index)}
                number={index + 1}
                theme={theme}
                isSelected={slide.id === selectedSlideId}
                isFirst={index === 0}
                isLast={index === deck.slides.length - 1}
                onSelect={() => onSelect(slide.id)}
                onMoveUp={() => move(slide.id, positionForStep(deck.slides, slide.id, "up"))}
                onMoveDown={() => move(slide.id, positionForStep(deck.slides, slide.id, "down"))}
                onDelete={() => onDelete(slide)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </nav>
  );
}

type SlideListItemProps = {
  slide: Slide;
  name: string;
  number: number;
  theme: Theme;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
};

function SlideListItem({
  slide,
  name,
  number,
  theme,
  isSelected,
  isFirst,
  isLast,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
}: SlideListItemProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group relative flex gap-2 ${isDragging ? "z-10 opacity-60" : ""}`}
    >
      <span aria-hidden className="w-5 pt-1 text-right text-xs tabular-nums text-muted-foreground">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        {/* Pointer drags start anywhere on the thumbnail; keyboard drags only from the handle. */}
        <div
          {...listeners}
          className={`relative overflow-hidden rounded-md border-2 ${isSelected ? "border-primary" : "border-border hover:border-muted-foreground"}`}
        >
          <div aria-hidden className="pointer-events-none">
            <SlideRenderer slide={slide} theme={theme} />
          </div>
          <button
            type="button"
            onClick={onSelect}
            aria-label={name}
            aria-current={isSelected ? "true" : undefined}
            className="absolute inset-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </div>
        <div
          className={`mt-1 flex justify-end gap-0.5 group-focus-within:opacity-100 group-hover:opacity-100 ${isSelected || isDragging ? "opacity-100" : "opacity-0"}`}
        >
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Drag ${name}`}
            className={`${buttonClassName({ variant: "ghost", size: "icon" })} mr-auto cursor-grab active:cursor-grabbing`}
          >
            <GripVerticalIcon aria-hidden className="size-4" />
          </button>
          <Button size="icon" variant="ghost" aria-label={`Move ${name} up`} disabled={isFirst} onClick={onMoveUp}>
            ↑
          </Button>
          <Button size="icon" variant="ghost" aria-label={`Move ${name} down`} disabled={isLast} onClick={onMoveDown}>
            ↓
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Delete ${name}`}
            onClick={onDelete}
            className="text-destructive hover:bg-destructive/10"
          >
            ×
          </Button>
        </div>
      </div>
    </li>
  );
}

function slideName(slide: Slide, index: number): string {
  return `Slide ${index + 1}: ${slide.title || "Untitled slide"}`;
}
