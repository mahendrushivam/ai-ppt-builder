export type ChartSeries = { name: string; values: number[] };

/** Chart data as a grid: one value per category in every series. Each chart type reads it its own way. */
export type ChartData = { categories: string[]; series: ChartSeries[] };

export type ChartProps = {
  data: ChartData;
  /** Colors for series, slices or tiles, in order; reused from the start when there are more items. */
  colors: readonly string[];
};
