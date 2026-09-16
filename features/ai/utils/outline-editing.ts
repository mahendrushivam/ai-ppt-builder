import { type Outline, type OutlineItem, SlideVisual } from "../types";
import { GENERATION_LIMITS, outlineSchema } from "./slide-input";

/** Outline item with a client-side id, so list items keep stable React keys while reordering. */
type EditableOutlineItem = OutlineItem & { id: string };
export type EditableOutline = { deckTitle: string; slides: EditableOutlineItem[] };

export function toEditableOutline(outline: Outline): EditableOutline {
  return {
    deckTitle: outline.deckTitle,
    slides: outline.slides.map((item) => ({ ...item, id: crypto.randomUUID() })),
  };
}

export function updateOutlineItem(
  outline: EditableOutline,
  id: string,
  changes: Partial<OutlineItem>,
): EditableOutline {
  return { ...outline, slides: outline.slides.map((item) => (item.id === id ? { ...item, ...changes } : item)) };
}

/** Moves an item one step. At either end the outline is returned unchanged. */
export function moveOutlineItem(outline: EditableOutline, id: string, direction: "up" | "down"): EditableOutline {
  const index = outline.slides.findIndex((item) => item.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= outline.slides.length) return outline;

  const slides = [...outline.slides];
  [slides[index], slides[target]] = [slides[target], slides[index]];
  return { ...outline, slides };
}

export function removeOutlineItem(outline: EditableOutline, id: string): EditableOutline {
  return { ...outline, slides: outline.slides.filter((item) => item.id !== id) };
}

export function addOutlineItem(outline: EditableOutline): EditableOutline {
  if (outline.slides.length >= GENERATION_LIMITS.maxSlides) return outline;
  const item: EditableOutlineItem = {
    id: crypto.randomUUID(),
    title: "New slide",
    layout: "content",
    keyPoints: [],
    visual: SlideVisual.None,
  };
  return { ...outline, slides: [...outline.slides, item] };
}

/** Key points are edited as text, one per line, and kept exactly as typed until the outline is used. */
export function keyPointsToText(keyPoints: string[]): string {
  return keyPoints.join("\n");
}

export function textToKeyPoints(text: string): string[] {
  return text === "" ? [] : text.split("\n");
}

/**
 * The outline to generate from: text trimmed, blank key points dropped and client-side ids
 * removed. Returns `null` while the outline still breaks a rule, such as a blank title.
 */
export function outlineForGeneration(outline: EditableOutline): Outline | null {
  const parsed = outlineSchema.safeParse({
    deckTitle: outline.deckTitle,
    slides: outline.slides.map((item) => ({
      ...item,
      keyPoints: item.keyPoints.map((point) => point.trim()).filter((point) => point !== ""),
    })),
  });
  return parsed.success ? parsed.data : null;
}
