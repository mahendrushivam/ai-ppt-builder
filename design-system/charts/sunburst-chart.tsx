import { Pie, type PieLabelRenderProps, PieChart as RechartsPieChart } from "recharts";
import { ChartFrame } from "./chart-frame";
import type { ChartProps } from "./types";
import { CHART_FRAME, colorAt } from "./utils";

/** Sectors narrower than this, in degrees, are left unlabelled because their name wouldn't fit. */
const MIN_LABEL_ANGLE = 18;

/**
 * Rings: each series is an inner-ring group, split into its categories on the outer ring.
 *
 * Drawn as two pies rather than Recharts' SunburstChart, which can only label sectors with
 * their values and keys sectors by name, so categories repeated across groups collide.
 */
export function SunburstChart({ data, colors }: ChartProps) {
  const groups = data.series.map((series, seriesIndex) => ({
    name: series.name,
    value: series.values.reduce((total, value) => total + value, 0),
    fill: colorAt(colors, seriesIndex),
  }));
  const segments = data.series.flatMap((series, seriesIndex) =>
    data.categories.map((category, categoryIndex) => ({
      name: category,
      value: series.values[categoryIndex] ?? 0,
      fill: colorAt(colors, seriesIndex),
    })),
  );

  return (
    <ChartFrame>
      <RechartsPieChart {...CHART_FRAME}>
        <Pie
          data={groups}
          dataKey="value"
          nameKey="name"
          innerRadius="20%"
          outerRadius="50%"
          className="stroke-(--chart-on-color) [stroke-opacity:0.5]"
          label={RingLabel}
          labelLine={false}
          isAnimationActive={false}
        />
        <Pie
          data={segments}
          dataKey="value"
          nameKey="name"
          innerRadius="52%"
          outerRadius="85%"
          fillOpacity={0.75}
          className="stroke-(--chart-on-color) [stroke-opacity:0.5]"
          label={RingLabel}
          labelLine={false}
          isAnimationActive={false}
        />
      </RechartsPieChart>
    </ChartFrame>
  );
}

/** Writes a sector's name in the middle of the sector. */
function RingLabel({ cx, cy, midAngle, middleRadius, startAngle, endAngle, name }: PieLabelRenderProps) {
  if (midAngle === undefined || middleRadius === undefined) return null;
  if (Math.abs(endAngle - startAngle) < MIN_LABEL_ANGLE) return null;

  const radians = (-midAngle * Math.PI) / 180;
  return (
    <text
      x={Number(cx) + middleRadius * Math.cos(radians)}
      y={Number(cy) + middleRadius * Math.sin(radians)}
      textAnchor="middle"
      dominantBaseline="middle"
      className="fill-(--chart-on-color) [font-size:var(--chart-font-size)]"
    >
      {name}
    </text>
  );
}
