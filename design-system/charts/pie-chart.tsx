import { Legend, Pie, PieChart as RechartsPieChart } from "recharts";
import { ChartFrame } from "./chart-frame";
import type { ChartProps } from "./types";
import { CHART_FRAME, colorAt } from "./utils";

/** Slices of a whole: each category is a slice sized by the first series' value. */
export function PieChart({ data, colors }: ChartProps) {
  // Slice colors are part of the data, so every category gets its own color.
  const slices = data.categories.map((category, index) => ({
    name: category,
    value: data.series[0]?.values[index] ?? 0,
    fill: colorAt(colors, index),
  }));

  return (
    <ChartFrame>
      <RechartsPieChart {...CHART_FRAME}>
        <Pie data={slices} dataKey="value" nameKey="name" outerRadius="80%" stroke="none" isAnimationActive={false} />
        <Legend itemSorter={null} />
      </RechartsPieChart>
    </ChartFrame>
  );
}
