import { describe, expect, test } from "vitest";
import { type BlockOfType, BlockType } from "@/features/deck/types";
import { blockSchema, CHART_TYPES, LIMITS } from "@/features/deck/utils/schema";
import {
  addCategory,
  addSeries,
  canAddCategory,
  canAddSeries,
  removeCategory,
  removeSeries,
  setChartTitle,
  setChartType,
  setValue,
} from "../chart-editing";

const chart: BlockOfType<BlockType.Chart> = {
  id: "chart",
  type: BlockType.Chart,
  chartType: "bar",
  title: "Revenue",
  categories: ["Q1", "Q2"],
  series: [
    { name: "2025", values: [1, -2] },
    { name: "2026", values: [3, 4] },
  ],
};

describe("chart editing", () => {
  test("keeps one series without negative values when switching to a pie chart", () => {
    const pie = setChartType(chart, "pie");

    expect(pie.series).toEqual([{ name: "2025", values: [1, 0] }]);
    expect(blockSchema.safeParse(pie).success).toBe(true);
    expect(setValue(pie, 0, 0, -5).series[0].values).toEqual([0, 0]);
  });

  test("adds and removes categories and series with matching values", () => {
    const withCategory = addCategory(chart);
    expect(withCategory.categories).toEqual(["Q1", "Q2", "Category 3"]);
    expect(withCategory.series.map((series) => series.values)).toEqual([
      [1, -2, 0],
      [3, 4, 0],
    ]);

    const withSeries = addSeries(withCategory);
    expect(withSeries.series[2]).toEqual({ name: "Series 3", values: [0, 0, 0] });

    const trimmed = removeCategory(removeSeries(withSeries, 0), 0);
    expect(trimmed.categories).toEqual(["Q2", "Category 3"]);
    expect(trimmed.series.map((series) => series.name)).toEqual(["2026", "Series 3"]);
    expect(blockSchema.safeParse(trimmed).success).toBe(true);
  });

  test("keeps at least one category and series and respects the limits", () => {
    const single = { ...chart, categories: ["Q1"], series: [{ name: "2025", values: [1] }] };
    expect(removeCategory(single, 0)).toBe(single);
    expect(removeSeries(single, 0)).toBe(single);

    const full = {
      ...chart,
      categories: Array.from({ length: LIMITS.chartCategories }, (_, index) => `C${index}`),
      series: Array.from({ length: LIMITS.chartSeries }, (_, index) => ({
        name: `S${index}`,
        values: Array.from({ length: LIMITS.chartCategories }, () => 1),
      })),
    };
    expect(canAddCategory(full)).toBe(false);
    expect(canAddSeries(full)).toBe(false);
    expect(canAddSeries(setChartType(chart, "pie"))).toBe(false);
  });

  test("fits the series to chart types that read an exact number of them", () => {
    const scatter = setChartType({ ...chart, series: [chart.series[0]] }, "scatter");
    expect(scatter.series.map((series) => series.name)).toEqual(["2025", "Series 2"]);
    expect(canAddSeries(scatter)).toBe(false);
    expect(removeSeries(scatter, 0)).toBe(scatter);

    expect(setChartType(chart, "funnel").series).toEqual([{ name: "2025", values: [1, 0] }]);
  });

  test("gives data that every chart type can show after switching to it", () => {
    for (const chartType of CHART_TYPES) {
      expect(blockSchema.safeParse(setChartType(chart, chartType)).success, chartType).toBe(true);
    }
  });

  test("stores an empty title as no title", () => {
    expect(setChartTitle(chart, "").title).toBeNull();
  });
});
