import { LineChart } from "./line-chart";
import type { ChartProps } from "./types";

/** Lines where each series adds its values on top of the series before it. */
export function StackedLineChart(props: ChartProps) {
  return <LineChart {...props} stacked />;
}
