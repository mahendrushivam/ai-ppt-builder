import type { z } from "zod";
import type {
  blockSchema,
  columnSchema,
  deckOperationSchema,
  deckSchema,
  layoutHintsSchema,
  resolvedImageSchema,
  slideLayoutSchema,
  slidePatchSchema,
  slideSchema,
} from "./utils/schema";

/** Kinds of content block. The values are saved in decks, so existing values must not change. */
export enum BlockType {
  Bullets = "bullets",
  Paragraph = "paragraph",
  Table = "table",
  Chart = "chart",
  Image = "image",
}

/** Why an operation was rejected. */
export enum OperationFailureCode {
  /** The slide or deck does not exist. */
  NotFound = "not_found",
  /** The slide changed after the operation was prepared. */
  Conflict = "conflict",
  /** The result would break a validation rule. */
  Invalid = "invalid",
}

export type SlideLayout = z.infer<typeof slideLayoutSchema>;
export type ResolvedImage = z.infer<typeof resolvedImageSchema>;
export type Block = z.infer<typeof blockSchema>;
export type BlockOfType<T extends BlockType> = Extract<Block, { type: T }>;
export type BulletItem = BlockOfType<BlockType.Bullets>["items"][number];
export type Column = z.infer<typeof columnSchema>;
export type LayoutHints = z.infer<typeof layoutHintsSchema>;
export type Slide = z.infer<typeof slideSchema>;
export type Deck = z.infer<typeof deckSchema>;

export type SlidePatch = z.infer<typeof slidePatchSchema>;
export type DeckOperation = z.infer<typeof deckOperationSchema>;

export type OperationFailure = {
  ok: false;
  code: OperationFailureCode;
  message: string;
};
export type OperationResult = { ok: true; deck: Deck } | OperationFailure;
