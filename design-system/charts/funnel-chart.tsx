import { Funnel, LabelList, FunnelChart as RechartsFunnelChart } from "recharts";
import { ChartFrame } from "./chart-frame";
import type { ChartProps } from "./types";
import { CHART_FRAME, colorAt } from "./utils";

/** Room to the right of the funnel for the stage names. */
const LABEL_SPACE = 96;

/** Stages from top to bottom: each category is a stage sized by the first series' value. */
export function FunnelChart({ data, colors }: ChartProps) {
  const stages = data.categories.map((category, index) => ({
    name: category,
    value: data.series[0]?.values[index] ?? 0,
    fill: colorAt(colors, index),
  }));

  return (
    <ChartFrame>
      <RechartsFunnelChart {...CHART_FRAME} margin={{ ...CHART_FRAME.margin, right: LABEL_SPACE }}>
        <Funnel data={stages} dataKey="value" nameKey="name" lastShapeType="rectangle" isAnimationActive={false}>
          <LabelList dataKey="name" position="right" />
        </Funnel>
      </RechartsFunnelChart>
    </ChartFrame>
  );
}
