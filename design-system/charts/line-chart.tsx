import { CartesianGrid, Legend, Line, LineChart as RechartsLineChart, XAxis, YAxis } from "recharts";
import { ChartFrame } from "./chart-frame";
import type { ChartProps } from "./types";
import { CATEGORY_KEY, CHART_FRAME, colorAt, formatNumber, seriesKey, toRows } from "./utils";

type LineChartProps = ChartProps & {
  /** Draws each series on top of the previous ones. Recharts doesn't stack lines, so values are summed first. */
  stacked?: boolean;
};

/** Lines across the categories, one per series. */
export function LineChart({ data, colors, stacked = false }: LineChartProps) {
  return (
    <ChartFrame>
      <RechartsLineChart {...CHART_FRAME} data={toRows(data, stacked)}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={CATEGORY_KEY} tickLine={false} />
        <YAxis width={40} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
        {data.series.map((series, index) => (
          <Line
            key={index}
            type="monotone"
            dataKey={seriesKey(index)}
            name={series.name}
            stroke={colorAt(colors, index)}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        ))}
        {data.series.length > 1 && <Legend itemSorter={null} />}
      </RechartsLineChart>
    </ChartFrame>
  );
}
