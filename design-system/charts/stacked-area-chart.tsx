import { AreaChart } from "./area-chart";
import type { ChartProps } from "./types";

/** Areas stacked on top of each other, showing how each series adds to the total. */
export function StackedAreaChart(props: ChartProps) {
  return <AreaChart {...props} stacked />;
}
