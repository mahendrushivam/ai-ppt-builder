import { BarChart } from "./bar-chart";
import type { ChartProps } from "./types";

/** Bars with the series stacked on top of each other, showing the total per category. */
export function StackedBarChart(props: ChartProps) {
  return <BarChart {...props} stacked />;
}
