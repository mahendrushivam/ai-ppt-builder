import { z } from "zod";
import {
  type Block,
  BlockType,
  type Column,
  type LayoutHints,
  type ResolvedImage,
  type Slide,
  type SlidePatch,
} from "@/features/deck/types";
import { createId, defaultHintsForLayout } from "@/features/deck/utils/create";
import {
  blockSizeSchema,
  chartFields,
  chartShapeIssues,
  columnCountIssues,
  LIMITS,
  layoutHintsSchema,
  reportIssues,
  slideLayoutSchema,
  tableFields,
  tableShapeIssues,
} from "@/features/deck/utils/schema";
import { type BlockInput, type ColumnInput, type SlideInput, type SlidePatchInput, SlideVisual } from "../types";

/*
 * Model-facing input schemas. The model never supplies ids, revisions or image URLs:
 * it describes content, and the `materialize*` functions turn that into domain objects.
 * Tool parameter JSON Schemas are generated from these schemas in the AI layer.
 */

const requiredText = (max: number) => z.string().trim().min(1).max(max);

/** Lets the model keep heights the user set by dragging when it rewrites a column. */
const blockSizeInput = {
  size: blockSizeSchema
    .optional()
    .describe(
      "Share of the column height in percent. Repeat the height shown for a block in the deck context when rewriting its column; leave out for automatic height.",
    ),
};

export const blockInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(BlockType.Bullets),
    items: z.array(requiredText(LIMITS.bulletText)).min(1).max(LIMITS.bulletsPerBlock),
    ...blockSizeInput,
  }),
  z.object({
    type: z.literal(BlockType.Paragraph),
    text: requiredText(LIMITS.paragraph),
    ...blockSizeInput,
  }),
  z
    .object({ type: z.literal(BlockType.Table), ...tableFields, ...blockSizeInput })
    .superRefine(reportIssues(tableShapeIssues)),
  z
    .object({
      type: z.literal(BlockType.Chart),
      title: requiredText(LIMITS.chartTitle).nullable().default(null),
      ...chartFields,
      ...blockSizeInput,
    })
    .superRefine(reportIssues(chartShapeIssues)),
  z.object({
    type: z.literal(BlockType.Image),
    /** Search query for a stock image; the server resolves it to a real image. */
    query: requiredText(LIMITS.imageQuery),
    alt: requiredText(LIMITS.imageAlt),
    ...blockSizeInput,
  }),
]);

export const columnInputSchema = z.object({
  heading: requiredText(LIMITS.columnHeading).nullable().default(null),
  blocks: z.array(blockInputSchema).min(1).max(LIMITS.blocksPerColumn),
});

const columnsInputSchema = z.array(columnInputSchema).max(2);
const hintsInputSchema = layoutHintsSchema.partial();

export const slideInputSchema = z
  .object({
    layout: slideLayoutSchema,
    title: requiredText(LIMITS.slideTitle),
    subtitle: requiredText(LIMITS.subtitle).nullable().default(null),
    columns: columnsInputSchema.default([]),
    notes: z.string().trim().max(LIMITS.notes).default(""),
    hints: hintsInputSchema.default({}),
  })
  .superRefine(reportIssues(columnCountIssues));

/** Only the fields present are changed; `subtitle: null` removes the subtitle. */
export const slidePatchInputSchema = z.object({
  title: requiredText(LIMITS.slideTitle).optional(),
  subtitle: requiredText(LIMITS.subtitle).nullable().optional(),
  columns: columnsInputSchema.optional(),
  notes: z.string().trim().max(LIMITS.notes).optional(),
  hints: hintsInputSchema.optional(),
});

/** Limits for generating a deck from a prompt. They also keep the cost of one request bounded. */
export const GENERATION_LIMITS = {
  prompt: 2000,
  maxSlides: 12,
  keyPointsPerSlide: 6,
  keyPoint: 160,
} as const;

/** One planned slide. The user reviews and edits the outline before any slide is generated. */
export const outlineItemSchema = z.object({
  title: requiredText(LIMITS.slideTitle),
  layout: slideLayoutSchema,
  keyPoints: z.array(requiredText(GENERATION_LIMITS.keyPoint)).max(GENERATION_LIMITS.keyPointsPerSlide).default([]),
  visual: z.enum(SlideVisual).default(SlideVisual.None),
});

export const outlineSchema = z.object({
  deckTitle: requiredText(LIMITS.deckTitle),
  slides: z.array(outlineItemSchema).min(1).max(GENERATION_LIMITS.maxSlides),
});

export function materializeSlide(input: SlideInput): Slide {
  return {
    id: createId("slide"),
    revision: 0,
    layout: input.layout,
    title: input.title,
    subtitle: input.subtitle,
    columns: materializeColumns(input.columns),
    notes: input.notes,
    hints: mergeHints(defaultHintsForLayout(input.layout), input.hints),
  };
}

/**
 * Builds columns from model input. When `current` is given, image blocks whose query
 * matches an image already on that slide keep the resolved image instead of losing it.
 */
export function materializeColumns(inputs: ColumnInput[], current?: Slide): Column[] {
  const knownImages = current ? resolvedImagesByQuery(current) : new Map<string, ResolvedImage>();
  return inputs.map((column) => ({
    id: createId("column"),
    heading: column.heading,
    blocks: column.blocks.map((block) => ({ ...materializeBlock(block, knownImages), size: block.size })),
  }));
}

/**
 * Builds a patch from model input, leaving out every field that already matches the slide.
 * Models often resend unchanged content alongside the edit they mean; dropping it keeps
 * column, block and item ids stable and makes a patch that changes nothing recognisable.
 */
export function materializeSlidePatch(input: SlidePatchInput, current: Slide): SlidePatch {
  const columns = input.columns && materializeColumns(input.columns, current);
  const hints = input.hints && mergeHints(current.hints, input.hints);
  return {
    title: input.title === current.title ? undefined : input.title,
    subtitle: input.subtitle === current.subtitle ? undefined : input.subtitle,
    notes: input.notes === current.notes ? undefined : input.notes,
    columns: columns && contentKey(columns) === contentKey(current.columns) ? undefined : columns,
    hints:
      hints && hints.align === current.hints.align && hints.columnSplit === current.hints.columnSplit ? undefined : hints,
  };
}

/** Serializes columns without ids and with sorted keys, so equal content gives equal keys. */
function contentKey(columns: Column[]): string {
  return JSON.stringify(columns, (key, value: unknown) => {
    if (key === "id") return undefined;
    if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
  });
}

function materializeBlock(input: BlockInput, knownImages: Map<string, ResolvedImage>): Block {
  const id = createId("block");
  switch (input.type) {
    case BlockType.Bullets:
      return {
        id,
        type: BlockType.Bullets,
        items: input.items.map((text) => ({ id: createId("item"), text, level: 0 })),
      };
    case BlockType.Paragraph:
      return { id, type: BlockType.Paragraph, text: input.text };
    case BlockType.Table:
      return { id, type: BlockType.Table, header: input.header, rows: input.rows };
    case BlockType.Chart:
      return {
        id,
        type: BlockType.Chart,
        chartType: input.chartType,
        title: input.title,
        categories: input.categories,
        series: input.series,
      };
    case BlockType.Image:
      return {
        id,
        type: BlockType.Image,
        query: input.query,
        alt: input.alt,
        image: knownImages.get(normalizeQuery(input.query)) ?? null,
      };
  }
}

function mergeHints(base: LayoutHints, overrides: Partial<LayoutHints>): LayoutHints {
  return {
    align: overrides.align ?? base.align,
    columnSplit: overrides.columnSplit ?? base.columnSplit,
  };
}

function resolvedImagesByQuery(slide: Slide): Map<string, ResolvedImage> {
  const images = new Map<string, ResolvedImage>();
  for (const block of slide.columns.flatMap((column) => column.blocks)) {
    if (block.type === BlockType.Image && block.image) images.set(normalizeQuery(block.query), block.image);
  }
  return images;
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}
