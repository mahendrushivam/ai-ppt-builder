import { Area, CartesianGrid, Legend, AreaChart as RechartsAreaChart, XAxis, YAxis } from "recharts";
import { ChartFrame } from "./chart-frame";
import type { ChartProps } from "./types";
import { CATEGORY_KEY, CHART_FRAME, colorAt, formatNumber, seriesKey, toRows } from "./utils";

type AreaChartProps = ChartProps & {
  /** Stacks each area on top of the previous ones. */
  stacked?: boolean;
};

/** Filled areas across the categories, one per series. */
export function AreaChart({ data, colors, stacked = false }: AreaChartProps) {
  return (
    <ChartFrame>
      <RechartsAreaChart {...CHART_FRAME} data={toRows(data)}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={CATEGORY_KEY} tickLine={false} />
        <YAxis width={40} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
        {data.series.map((series, index) => (
          <Area
            key={index}
            type="monotone"
            dataKey={seriesKey(index)}
            name={series.name}
            stroke={colorAt(colors, index)}
            fill={colorAt(colors, index)}
            // Stacked areas don't overlap, so they can be nearly opaque; overlapping ones must stay see-through.
            fillOpacity={stacked ? 0.7 : 0.25}
            stackId={stacked ? "stack" : undefined}
            isAnimationActive={false}
          />
        ))}
        {data.series.length > 1 && <Legend itemSorter={null} />}
      </RechartsAreaChart>
    </ChartFrame>
  );
}
