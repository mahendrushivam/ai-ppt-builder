import { type Block, BlockType, type Column, type Deck, type ResolvedImage, type Slide } from "@/features/deck/types";
import { createBlankSlide, createDeck } from "@/features/deck/utils/create";

/** Paragraph block whose id is derived from its text, for readable assertions. */
export function paragraph(text: string): Block {
  return { id: `block_${text}`, type: BlockType.Paragraph, text };
}

export function bullets(id: string, texts: string[]): Block {
  return {
    id,
    type: BlockType.Bullets,
    items: texts.map((text, index) => ({ id: `${id}_item${index}`, text, level: 0 })),
  };
}

export function column(id: string, blocks: Block[], heading: string | null = null): Column {
  return { id, heading, blocks };
}

export function contentSlide(id: string, blocks: Block[] = [], revision = 0): Slide {
  return {
    ...createBlankSlide("content"),
    id,
    title: `Slide ${id}`,
    revision,
    columns: [column(`${id}_col`, blocks)],
  };
}

export function twoColumnSlide(id: string, left: Block[], right: Block[]): Slide {
  return {
    ...createBlankSlide("two-column"),
    id,
    columns: [column(`${id}_left`, left), column(`${id}_right`, right)],
  };
}

export function deckWith(...slides: Slide[]): Deck {
  return { ...createDeck({ title: "Test deck" }), slides };
}

export const resolvedImage: ResolvedImage = {
  src: "https://images.example.com/team.jpg",
  width: 1200,
  height: 800,
  attribution: "Photo by someone, CC BY 2.0",
  sourceUrl: "https://example.com/photo",
};
