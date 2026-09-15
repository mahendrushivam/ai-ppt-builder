import { z } from "zod";
import { UPLOADED_IMAGE_SRC_PATTERN } from "./uploaded-image";
import { themeIdSchema } from "@/features/themes/utils/themes";
import { BlockType, type SlideLayout } from "../types";

/** Content limits shared by validation, the editor and AI prompts. */
export const LIMITS = {
  deckTitle: 120,
  slideTitle: 120,
  subtitle: 200,
  notes: 2000,
  columnHeading: 60,
  blocksPerColumn: 4,
  bulletsPerBlock: 8,
  bulletText: 220,
  paragraph: 800,
  tableColumns: 6,
  tableRows: 8,
  tableCell: 120,
  chartTitle: 80,
  chartLabel: 40,
  chartCategories: 12,
  chartSeries: 4,
  imageQuery: 100,
  imageAlt: 200,
  imageAttribution: 500,
  slidesPerDeck: 30,
} as const;

/** Width of the first column on two-column slides, in percent of the content width. */
export const COLUMN_SPLIT = { min: 25, max: 75, equal: 50, widerLeft: 66.67, widerRight: 33.33 } as const;

/** Smallest share of a column's height a block can be given, in percent. */
export const MIN_BLOCK_SIZE = 10;

export const SLIDE_LAYOUTS = ["title", "section", "content", "two-column", "comparison"] as const;
export const slideLayoutSchema = z.enum(SLIDE_LAYOUTS);

/** Title and section slides only have a title and subtitle; the rest hold content columns. */
export const LAYOUT_COLUMN_COUNT = {
  title: 0,
  section: 0,
  content: 1,
  "two-column": 2,
  comparison: 2,
} as const satisfies Record<SlideLayout, number>;

export const CHART_TYPES = [
  "bar",
  "stacked-bar",
  "line",
  "stacked-line",
  "area",
  "stacked-area",
  "pie",
  "funnel",
  "treemap",
  "sunburst",
  "sankey",
  "scatter",
] as const;
type ChartType = (typeof CHART_TYPES)[number];

type ChartDataRules = {
  /** Name used in validation messages. */
  name: string;
  /** The exact number of series the chart reads, or `null` for any number. */
  seriesCount: 1 | 2 | null;
  /** Values must be 0 or more because they are sizes or flows. */
  nonNegative: boolean;
};

/**
 * How each chart type reads the shared data: categories, and series with one value per
 * category. Validation, the chart editor and the AI's tool description follow these rules.
 */
export const CHART_RULES: Record<ChartType, ChartDataRules> = {
  bar: { name: "bar", seriesCount: null, nonNegative: false },
  "stacked-bar": { name: "stacked bar", seriesCount: null, nonNegative: false },
  line: { name: "line", seriesCount: null, nonNegative: false },
  "stacked-line": { name: "stacked line", seriesCount: null, nonNegative: false },
  area: { name: "area", seriesCount: null, nonNegative: false },
  "stacked-area": { name: "stacked area", seriesCount: null, nonNegative: false },
  pie: { name: "pie", seriesCount: 1, nonNegative: true },
  funnel: { name: "funnel", seriesCount: 1, nonNegative: true },
  treemap: { name: "treemap", seriesCount: 1, nonNegative: true },
  sunburst: { name: "sunburst", seriesCount: null, nonNegative: true },
  sankey: { name: "Sankey", seriesCount: null, nonNegative: true },
  scatter: { name: "scatter", seriesCount: 2, nonNegative: false },
};

const SERIES_COUNT_WORDS = { 1: "one", 2: "two" } as const;

const idSchema = z.string().min(1).max(64);
const revisionSchema = z.int().min(0);

// ---------------------------------------------------------------------------
// Structural checks shared by stored data and model input
// ---------------------------------------------------------------------------

type IssueCollector = { addIssue: (issue: { code: "custom"; message: string }) => void };

/** Turns a check that returns messages into a zod `superRefine` callback. */
export function reportIssues<T>(check: (value: T) => string[]) {
  return (value: T, ctx: IssueCollector) => {
    for (const message of check(value)) ctx.addIssue({ code: "custom", message });
  };
}

export function tableShapeIssues(table: { header: string[]; rows: string[][] }): string[] {
  return table.rows.flatMap((row, index) =>
    row.length === table.header.length
      ? []
      : [`Table row ${index + 1} has ${row.length} cells but the header has ${table.header.length}.`],
  );
}

export function chartShapeIssues(chart: {
  chartType: ChartType;
  categories: string[];
  series: { name: string; values: number[] }[];
}): string[] {
  const issues = chart.series.flatMap((series) =>
    series.values.length === chart.categories.length
      ? []
      : [
          `Chart series "${series.name}" has ${series.values.length} values but there are ${chart.categories.length} categories.`,
        ],
  );
  const rules = CHART_RULES[chart.chartType];
  if (rules.seriesCount !== null && chart.series.length !== rules.seriesCount) {
    const article = /^[aeiou]/i.test(rules.name) ? "An" : "A";
    issues.push(`${article} ${rules.name} chart must have exactly ${SERIES_COUNT_WORDS[rules.seriesCount]} series.`);
  }
  if (rules.nonNegative && chart.series.some((series) => series.values.some((value) => value < 0))) {
    issues.push(`${rules.name[0].toUpperCase()}${rules.name.slice(1)} chart values cannot be negative.`);
  }
  return issues;
}

export function columnCountIssues(slide: { layout: SlideLayout; columns: unknown[] }): string[] {
  const expected = LAYOUT_COLUMN_COUNT[slide.layout];
  return slide.columns.length === expected
    ? []
    : [`Layout "${slide.layout}" needs ${expected} column(s) but has ${slide.columns.length}.`];
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

const tableCellSchema = z.string().max(LIMITS.tableCell);

export const tableFields = {
  header: z.array(tableCellSchema).min(1).max(LIMITS.tableColumns),
  rows: z.array(z.array(tableCellSchema)).max(LIMITS.tableRows),
};

export const chartFields = {
  chartType: z
    .enum(CHART_TYPES)
    .describe(
      "How the data is read. bar, line, area and their stacked- versions: categories along the x axis, one series per bar, line or area. pie, funnel and treemap: exactly one series; each category is a slice, stage or tile. scatter: exactly two series, X values then Y values; each category labels one point. sankey: each series is a source, each category a target, and values are the flows between them. sunburst: each series is an inner-ring group split into the categories. Values of pie, funnel, treemap, sankey and sunburst charts can't be negative.",
    ),
  categories: z.array(z.string().max(LIMITS.chartLabel)).min(1).max(LIMITS.chartCategories),
  series: z
    .array(z.object({ name: z.string().max(LIMITS.chartLabel), values: z.array(z.number()) }))
    .min(1)
    .max(LIMITS.chartSeries),
};

export const resolvedImageSchema = z.object({
  /** An https URL, or a reference to an image the user uploaded to this browser. */
  src: z.union([z.url({ protocol: /^https$/ }), z.string().regex(UPLOADED_IMAGE_SRC_PATTERN)]),
  width: z.int().positive(),
  height: z.int().positive(),
  /** Credit shown under the image; empty for uploads. */
  attribution: z.string().max(LIMITS.imageAttribution),
  /** The page the image was found on; `null` for uploads. */
  sourceUrl: z.url({ protocol: /^https?$/ }).nullable(),
});

const bulletItemSchema = z.object({
  id: idSchema,
  text: z.string().max(LIMITS.bulletText),
  level: z.literal([0, 1]),
});

/** A block's share of its column's height, in percent. */
export const blockSizeSchema = z.number().min(MIN_BLOCK_SIZE).max(100);

const blockBase = {
  id: idSchema,
  /** Blocks without a size take the height of their content; see `blockSizesOf`. */
  size: blockSizeSchema.optional(),
};

export const blockSchema = z.discriminatedUnion("type", [
  z.object({
    ...blockBase,
    type: z.literal(BlockType.Bullets),
    items: z.array(bulletItemSchema).max(LIMITS.bulletsPerBlock),
  }),
  z.object({
    ...blockBase,
    type: z.literal(BlockType.Paragraph),
    text: z.string().max(LIMITS.paragraph),
  }),
  z
    .object({ ...blockBase, type: z.literal(BlockType.Table), ...tableFields })
    .superRefine(reportIssues(tableShapeIssues)),
  z
    .object({
      ...blockBase,
      type: z.literal(BlockType.Chart),
      title: z.string().max(LIMITS.chartTitle).nullable(),
      ...chartFields,
    })
    .superRefine(reportIssues(chartShapeIssues)),
  z.object({
    ...blockBase,
    type: z.literal(BlockType.Image),
    /** Search query the image was (or will be) resolved from. Empty while the user is still typing one. */
    query: z.string().max(LIMITS.imageQuery),
    alt: z.string().max(LIMITS.imageAlt),
    /** `null` until the server has found an image for the query. */
    image: resolvedImageSchema.nullable(),
  }),
]);

// ---------------------------------------------------------------------------
// Slides and decks
// ---------------------------------------------------------------------------

export const columnSchema = z.object({
  id: idSchema,
  /** Used by comparison slides, e.g. "Before" / "After". */
  heading: z.string().max(LIMITS.columnHeading).nullable(),
  blocks: z.array(blockSchema).max(LIMITS.blocksPerColumn),
});

export const layoutHintsSchema = z.object({
  align: z.enum(["left", "center"]),
  columnSplit: z
    .number()
    .min(COLUMN_SPLIT.min)
    .max(COLUMN_SPLIT.max)
    .describe("Width of the first of two columns, in percent of the content width (25-75). 50 makes equal columns."),
});

const slideShape = {
  id: idSchema,
  /** Incremented on every content change; used to reject edits based on stale content. */
  revision: revisionSchema,
  layout: slideLayoutSchema,
  title: z.string().max(LIMITS.slideTitle),
  subtitle: z.string().max(LIMITS.subtitle).nullable(),
  columns: z.array(columnSchema).max(2),
  notes: z.string().max(LIMITS.notes),
  hints: layoutHintsSchema,
};

export const slideSchema = z.object(slideShape).superRefine(reportIssues(columnCountIssues));

export const deckTitleSchema = z
  .string()
  .max(LIMITS.deckTitle)
  .refine((title) => title.trim().length > 0, { error: "Deck title cannot be empty." });

function duplicateSlideIdIssues(deck: { slides: { id: string }[] }): string[] {
  const seen = new Set<string>();
  return deck.slides.flatMap(({ id }) => {
    if (seen.has(id)) return [`Slide id "${id}" is used more than once.`];
    seen.add(id);
    return [];
  });
}

export const deckSchema = z
  .object({
    id: idSchema,
    title: deckTitleSchema,
    themeId: themeIdSchema,
    slides: z.array(slideSchema).max(LIMITS.slidesPerDeck),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .superRefine(reportIssues(duplicateSlideIdIssues));

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export const slidePatchSchema = z
  .object({
    title: slideShape.title,
    subtitle: slideShape.subtitle,
    columns: slideShape.columns,
    notes: slideShape.notes,
    hints: slideShape.hints,
  })
  .partial();

/**
 * Every change to a deck (manual edit or AI tool call) is one of these operations.
 *
 * Operations that change existing slide content carry the `baseRevision` they were
 * prepared against, so a change based on stale content is rejected instead of
 * overwriting a newer edit. Positions use `afterSlideId` anchors rather than indexes
 * so concurrent reorders cannot misplace a slide.
 */
export const deckOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("slide.add"),
    slide: slideSchema,
    /** `null` inserts at the start. */
    afterSlideId: idSchema.nullable(),
  }),
  z.object({
    type: z.literal("slide.update"),
    slideId: idSchema,
    baseRevision: revisionSchema,
    patch: slidePatchSchema,
  }),
  z.object({
    type: z.literal("slide.delete"),
    slideId: idSchema,
    baseRevision: revisionSchema,
  }),
  z.object({
    type: z.literal("slide.move"),
    slideId: idSchema,
    afterSlideId: idSchema.nullable(),
  }),
  z.object({
    type: z.literal("slide.changeLayout"),
    slideId: idSchema,
    baseRevision: revisionSchema,
    layout: slideLayoutSchema,
    /** Explicit content for the new layout; when omitted, existing blocks are redistributed. */
    columns: z.array(columnSchema).optional(),
  }),
  z.object({
    type: z.literal("block.move"),
    slideId: idSchema,
    baseRevision: revisionSchema,
    blockId: idSchema,
    toColumnId: idSchema,
    /** Position in the target column, counted without the moved block. */
    toIndex: z.int().min(0),
  }),
  z.object({
    type: z.literal("slide.resize"),
    slideId: idSchema,
    baseRevision: revisionSchema,
    columnSplit: layoutHintsSchema.shape.columnSplit.optional(),
    /** Heights for every block of each column being resized; `null` returns a block to its content height. */
    blockSizes: z.array(z.object({ blockId: idSchema, size: blockSizeSchema.nullable() })).optional(),
  }),
  z.object({
    type: z.literal("deck.rename"),
    title: deckTitleSchema,
  }),
  z.object({
    type: z.literal("deck.setTheme"),
    themeId: themeIdSchema,
  }),
]);
