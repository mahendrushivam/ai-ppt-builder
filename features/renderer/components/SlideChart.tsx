import type { ComponentType } from "react";
import {
  AreaChart,
  BarChart,
  type ChartProps,
  FunnelChart,
  LineChart,
  PieChart,
  SankeyChart,
  ScatterChart,
  StackedAreaChart,
  StackedBarChart,
  StackedLineChart,
  SunburstChart,
  TreemapChart,
} from "@/design-system/charts";
import type { BlockOfType, BlockType } from "@/features/deck/types";
import type { ChartType } from "@/features/deck/utils/labels";

type ChartBlock = BlockOfType<BlockType.Chart>;

type SlideChartProps = {
  chart: ChartBlock;
  /** Colors from the deck theme, in order. */
  colors: readonly string[];
};

const CHART_COMPONENTS: Record<ChartType, ComponentType<ChartProps>> = {
  bar: BarChart,
  "stacked-bar": StackedBarChart,
  line: LineChart,
  "stacked-line": StackedLineChart,
  area: AreaChart,
  "stacked-area": StackedAreaChart,
  pie: PieChart,
  funnel: FunnelChart,
  treemap: TreemapChart,
  sunburst: SunburstChart,
  sankey: SankeyChart,
  scatter: ScatterChart,
};

/** Maps the slide theme onto the chart variables, so charts scale and take their colors from the slide. */
const SLIDE_CHART_VARIABLES = [
  "h-full w-full",
  "[--chart-text:var(--slide-text)]",
  "[--chart-muted:var(--slide-muted)]",
  "[--chart-grid:var(--slide-border)]",
  "[--chart-on-color:var(--slide-on-accent)]",
  "[--chart-font-size:calc(var(--slide-body-size)*0.6)]",
].join(" ");

/** Read-only rendering of a chart block. The surrounding block provides its accessible name. */
export function SlideChart({ chart, colors }: SlideChartProps) {
  const Chart = CHART_COMPONENTS[chart.chartType];

  return (
    <div className={SLIDE_CHART_VARIABLES}>
      <Chart data={chart} colors={colors} />
    </div>
  );
}
