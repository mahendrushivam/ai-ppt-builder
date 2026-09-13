import type { BlockOfType, BlockType, SlideLayout } from "../types";

export type ChartType = BlockOfType<BlockType.Chart>["chartType"];

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: "Bar",
  "stacked-bar": "Stacked bar",
  line: "Line",
  "stacked-line": "Stacked line",
  area: "Area",
  "stacked-area": "Stacked area",
  pie: "Pie",
  funnel: "Funnel",
  treemap: "Treemap",
  sunburst: "Sunburst",
  sankey: "Sankey",
  scatter: "Scatter",
};

/** Display names for slide layouts, shared by every place that lets the user pick one. */
export const LAYOUT_LABELS: Record<SlideLayout, string> = {
  title: "Title",
  section: "Section header",
  content: "Content",
  "two-column": "Two columns",
  comparison: "Comparison",
};
