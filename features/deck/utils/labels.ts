import type { SlideLayout } from "../types";

/** Display names for slide layouts, shared by every place that lets the user pick one. */
export const LAYOUT_LABELS: Record<SlideLayout, string> = {
  title: "Title",
  section: "Section header",
  content: "Content",
  "two-column": "Two columns",
  comparison: "Comparison",
};
