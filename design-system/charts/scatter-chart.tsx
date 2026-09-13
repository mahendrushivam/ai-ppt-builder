import { CartesianGrid, LabelList, ScatterChart as RechartsScatterChart, Scatter, XAxis, YAxis } from "recharts";
import { ChartFrame } from "./chart-frame";
import type { ChartProps } from "./types";
import { CHART_FRAME, colorAt, formatNumber } from "./utils";

/** Labelled points: each category is a point, placed by the first series (X) and the second (Y). */
export function ScatterChart({ data, colors }: ChartProps) {
  const [xSeries, ySeries] = data.series;
  const points = data.categories.map((category, index) => ({
    label: category,
    x: xSeries?.values[index] ?? 0,
    y: ySeries?.values[index] ?? 0,
  }));

  return (
    <ChartFrame>
      <RechartsScatterChart {...CHART_FRAME}>
        <CartesianGrid />
        <XAxis type="number" dataKey="x" name={xSeries?.name} tickLine={false} tickFormatter={formatNumber} />
        <YAxis
          type="number"
          dataKey="y"
          name={ySeries?.name}
          width={40}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatNumber}
        />
        <Scatter data={points} fill={colorAt(colors, 0)} isAnimationActive={false}>
          <LabelList dataKey="label" position="top" />
        </Scatter>
      </RechartsScatterChart>
    </ChartFrame>
  );
}
