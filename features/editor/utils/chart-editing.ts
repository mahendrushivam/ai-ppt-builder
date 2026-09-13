import type { BlockOfType, BlockType } from "@/features/deck/types";
import type { ChartType } from "@/features/deck/utils/labels";
import { CHART_RULES, LIMITS } from "@/features/deck/utils/schema";

type ChartBlock = BlockOfType<BlockType.Chart>;
type ChartSeries = ChartBlock["series"][number];

/**
 * Changes the chart type and fits the data to it: types that read an exact number of series
 * keep the first ones (adding empty series if needed), and types whose values are sizes or
 * flows raise negative values to 0.
 */
export function setChartType(chart: ChartBlock, chartType: ChartType): ChartBlock {
  const rules = CHART_RULES[chartType];
  const series = rules.seriesCount === null ? chart.series : fitSeriesCount(chart, rules.seriesCount);
  return { ...chart, chartType, series: rules.nonNegative ? series.map(withoutNegativeValues) : series };
}

export function setChartTitle(chart: ChartBlock, title: string): ChartBlock {
  return { ...chart, title: title === "" ? null : title };
}

export function setCategoryName(chart: ChartBlock, categoryIndex: number, name: string): ChartBlock {
  return { ...chart, categories: chart.categories.with(categoryIndex, name) };
}

export function setSeriesName(chart: ChartBlock, seriesIndex: number, name: string): ChartBlock {
  return { ...chart, series: chart.series.with(seriesIndex, { ...chart.series[seriesIndex], name }) };
}

/** Sets one value. Chart types whose values are sizes or flows turn negative values into 0. */
export function setValue(chart: ChartBlock, seriesIndex: number, categoryIndex: number, value: number): ChartBlock {
  const safeValue = CHART_RULES[chart.chartType].nonNegative ? Math.max(0, value) : value;
  const series = chart.series[seriesIndex];
  return {
    ...chart,
    series: chart.series.with(seriesIndex, { ...series, values: series.values.with(categoryIndex, safeValue) }),
  };
}

export function canAddCategory(chart: ChartBlock): boolean {
  return chart.categories.length < LIMITS.chartCategories;
}

/** Series can be added and removed only for chart types that read any number of them. */
export function canAddSeries(chart: ChartBlock): boolean {
  return CHART_RULES[chart.chartType].seriesCount === null && chart.series.length < LIMITS.chartSeries;
}

export function canRemoveSeries(chart: ChartBlock): boolean {
  return CHART_RULES[chart.chartType].seriesCount === null && chart.series.length > 1;
}

/** Adds a category at the end, with a value of 0 in every series. */
export function addCategory(chart: ChartBlock): ChartBlock {
  if (!canAddCategory(chart)) return chart;
  return {
    ...chart,
    categories: [...chart.categories, `Category ${chart.categories.length + 1}`],
    series: chart.series.map((series) => ({ ...series, values: [...series.values, 0] })),
  };
}

export function removeCategory(chart: ChartBlock, categoryIndex: number): ChartBlock {
  if (chart.categories.length <= 1) return chart;
  return {
    ...chart,
    categories: chart.categories.toSpliced(categoryIndex, 1),
    series: chart.series.map((series) => ({ ...series, values: series.values.toSpliced(categoryIndex, 1) })),
  };
}

/** Adds a series at the end, with a value of 0 for every category. */
export function addSeries(chart: ChartBlock): ChartBlock {
  if (!canAddSeries(chart)) return chart;
  return { ...chart, series: [...chart.series, emptySeries(chart, chart.series.length)] };
}

export function removeSeries(chart: ChartBlock, seriesIndex: number): ChartBlock {
  if (!canRemoveSeries(chart)) return chart;
  return { ...chart, series: chart.series.toSpliced(seriesIndex, 1) };
}

function fitSeriesCount(chart: ChartBlock, count: number): ChartSeries[] {
  const series = chart.series.slice(0, count);
  for (let index = series.length; index < count; index++) series.push(emptySeries(chart, index));
  return series;
}

function emptySeries(chart: ChartBlock, index: number): ChartSeries {
  return { name: `Series ${index + 1}`, values: chart.categories.map(() => 0) };
}

function withoutNegativeValues(series: ChartSeries): ChartSeries {
  return { ...series, values: series.values.map((value) => Math.max(0, value)) };
}
