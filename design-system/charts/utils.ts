import type { ChartData } from "./types";

/** Settings for charts that size themselves: fill the container, static, without animation. */
export const CHART_FRAME = {
  responsive: true,
  width: "100%",
  height: "100%",
  accessibilityLayer: false,
  margin: { top: 8, right: 8, bottom: 0, left: 0 },
} as const;

export const CATEGORY_KEY = "category";

export function colorAt(colors: readonly string[], index: number): string {
  return colors[index % colors.length];
}

const numberFormat = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** Series are keyed by position, because series names may repeat or be empty. */
export function seriesKey(index: number): string {
  return `series${index}`;
}

/**
 * One row per category with each series' value under its key, as cartesian charts expect.
 * With `cumulative`, each series adds the values of the series before it, which is how
 * stacked lines are drawn.
 */
export function toRows({ categories, series }: ChartData, cumulative = false): Record<string, string | number>[] {
  return categories.map((category, categoryIndex) => {
    let total = 0;
    const values = series.map((entry, seriesIndex) => {
      const value = entry.values[categoryIndex] ?? 0;
      total += value;
      return [seriesKey(seriesIndex), cumulative ? total : value] as const;
    });
    return { [CATEGORY_KEY]: category, ...Object.fromEntries(values) };
  });
}
