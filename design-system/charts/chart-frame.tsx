import type { ReactNode } from "react";

/**
 * Text, grid lines and legend take their look from CSS variables set by whoever places the
 * chart: `--chart-text`, `--chart-muted`, `--chart-grid`, `--chart-on-color` and
 * `--chart-font-size`. CSS overrides the size and color attributes Recharts writes on its SVG.
 */
const FRAME_CLASSES = [
  "h-full w-full",
  "[&_.recharts-text]:fill-(--chart-muted)",
  "[&_.recharts-text]:[font-size:var(--chart-font-size)]",
  "[&_.recharts-cartesian-grid_line]:stroke-(--chart-grid)",
  "[&_.recharts-cartesian-axis-line]:stroke-(--chart-grid)",
  "[&_.recharts-default-legend]:[font-size:var(--chart-font-size)]",
  "[&_.recharts-legend-item-text]:text-(--chart-text)!",
].join(" ");

/** Fills its container and styles the chart inside it. */
export function ChartFrame({ children }: { children: ReactNode }) {
  return <div className={FRAME_CLASSES}>{children}</div>;
}
