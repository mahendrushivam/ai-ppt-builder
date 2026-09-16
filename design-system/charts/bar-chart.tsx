import {
  Bar,
  CartesianGrid,
  Legend,
  BarChart as RechartsBarChart,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "./chart-frame";
import type { ChartProps } from "./types";
import {
  CATEGORY_KEY,
  CHART_FRAME,
  colorAt,
  formatNumber,
  seriesKey,
  toRows,
} from "./utils";

type BarChartProps = ChartProps & {
  stacked?: boolean;
};

/** Vertical bars: categories along the x axis, one bar per series side by side, or stacked. */
export function BarChart({ data, colors, stacked = false }: BarChartProps) {
  return (
    <ChartFrame>
      <RechartsBarChart {...CHART_FRAME} data={toRows(data)}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={CATEGORY_KEY} tickLine={false} />
        <YAxis
          width={40}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatNumber}
        />
        {data.series.map((series, index) => (
          <Bar
            key={index}
            dataKey={seriesKey(index)}
            name={series.name}
            fill={colorAt(colors, index)}
            stackId={stacked ? "stack" : undefined}
            isAnimationActive={false}
          />
        ))}
        {data.series.length > 1 && <Legend itemSorter={null} />}
      </RechartsBarChart>
    </ChartFrame>
  );
}
