import type { ThemeId } from "@/features/themes/types";
import { DEFAULT_THEME_ID } from "@/features/themes/utils/themes";
import type { Column, Deck, LayoutHints, Slide, SlideLayout } from "../types";
import { LAYOUT_COLUMN_COUNT } from "./schema";

type IdKind = "deck" | "slide" | "column" | "block" | "item" | "upload";

/** Short ids keep AI context compact; 48 random bits is plenty for this app. */
export function createId(kind: IdKind): string {
  return `${kind}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

export function defaultHintsForLayout(layout: SlideLayout): LayoutHints {
  const centered = layout === "title" || layout === "section";
  return { align: centered ? "center" : "left", columnRatio: "1:1" };
}

export function createColumn(heading: string | null = null): Column {
  return { id: createId("column"), heading, blocks: [] };
}

export function createBlankSlide(layout: SlideLayout = "content"): Slide {
  return {
    id: createId("slide"),
    revision: 0,
    layout,
    title: "",
    subtitle: null,
    columns: Array.from({ length: LAYOUT_COLUMN_COUNT[layout] }, () => createColumn()),
    notes: "",
    hints: defaultHintsForLayout(layout),
  };
}

export function createDeck(
  options: { title?: string; themeId?: ThemeId } = {},
  now: Date = new Date(),
): Deck {
  const timestamp = now.toISOString();
  return {
    id: createId("deck"),
    title: options.title ?? "Untitled presentation",
    themeId: options.themeId ?? DEFAULT_THEME_ID,
    slides: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
