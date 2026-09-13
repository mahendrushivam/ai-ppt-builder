import { Button } from "@/design-system/components/button";
import { Field, fieldClassName } from "@/design-system/components/field";
import type { BlockOfType, BlockType } from "@/features/deck/types";
import { CHART_TYPE_LABELS, type ChartType } from "@/features/deck/utils/labels";
import { CHART_RULES, CHART_TYPES, LIMITS } from "@/features/deck/utils/schema";
import {
  addCategory,
  addSeries,
  canAddCategory,
  canAddSeries,
  canRemoveSeries,
  removeCategory,
  removeSeries,
  setCategoryName,
  setChartTitle,
  setChartType,
  setSeriesName,
  setValue,
} from "../utils/chart-editing";

type ChartBlock = BlockOfType<BlockType.Chart>;

/** How the grid is read, for chart types where that isn't obvious. */
const CHART_DATA_HINTS: Record<ChartType, string | null> = {
  bar: null,
  line: null,
  area: null,
  "stacked-bar": "Each category's bar stacks every series.",
  "stacked-line": "Each line adds its values on top of the lines before it.",
  "stacked-area": "Each area adds its values on top of the areas before it.",
  pie: "A pie chart shows one series, and values can't be negative.",
  funnel: "Each category is a stage of the funnel. It shows one series, and values can't be negative.",
  treemap: "Each category is a tile sized by its value. It shows one series, and values can't be negative.",
  sunburst: "Each series is an inner-ring group, split into the categories on the outer ring. Values can't be negative.",
  sankey: "Each series is a source and each category a target; values are the flows between them and can't be negative.",
  scatter: "Each category is a point: the first series holds its X value, the second its Y value.",
};

type ChartEditorProps = {
  chart: ChartBlock;
  /** Id for the chart type field, so the chart can be focused from the slide canvas. */
  fieldId: string;
  onChange: (chart: ChartBlock) => void;
};

/** Edits a chart's type, title and data as a grid: categories down the side, one column per series. */
export function ChartEditor({ chart, fieldId, onChange }: ChartEditorProps) {
  const cellClassName = `${fieldClassName} min-w-20 px-1.5 py-1`;
  const hint = CHART_DATA_HINTS[chart.chartType];
  const allowsNegativeValues = !CHART_RULES[chart.chartType].nonNegative;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Chart type" htmlFor={fieldId}>
          <select
            id={fieldId}
            value={chart.chartType}
            onChange={(event) => {
              const chartType = CHART_TYPES.find((candidate) => candidate === event.target.value);
              if (chartType) onChange(setChartType(chart, chartType));
            }}
            className={fieldClassName}
          >
            {CHART_TYPES.map((chartType) => (
              <option key={chartType} value={chartType}>
                {CHART_TYPE_LABELS[chartType]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Chart title" htmlFor={`${fieldId}-title`}>
          <input
            id={`${fieldId}-title`}
            value={chart.title ?? ""}
            maxLength={LIMITS.chartTitle}
            onChange={(event) => onChange(setChartTitle(chart, event.target.value))}
            className={fieldClassName}
          />
        </Field>
      </div>

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      {/* Categories and series are positional in the chart data, so positions are their keys. */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="p-0.5 text-left text-xs font-medium text-muted-foreground">
                Category
              </th>
              {chart.series.map((series, seriesIndex) => (
                <th key={seriesIndex} scope="col" className="p-0.5">
                  <input
                    aria-label={`Series ${seriesIndex + 1} name`}
                    value={series.name}
                    maxLength={LIMITS.chartLabel}
                    onChange={(event) => onChange(setSeriesName(chart, seriesIndex, event.target.value))}
                    className={`${cellClassName} font-semibold`}
                  />
                </th>
              ))}
              <td />
            </tr>
          </thead>
          <tbody>
            {chart.categories.map((category, categoryIndex) => (
              <tr key={categoryIndex}>
                <th scope="row" className="p-0.5">
                  <input
                    aria-label={`Category ${categoryIndex + 1}`}
                    value={category}
                    maxLength={LIMITS.chartLabel}
                    onChange={(event) => onChange(setCategoryName(chart, categoryIndex, event.target.value))}
                    className={cellClassName}
                  />
                </th>
                {chart.series.map((series, seriesIndex) => (
                  <td key={seriesIndex} className="p-0.5">
                    <input
                      type="number"
                      step="any"
                      min={allowsNegativeValues ? undefined : 0}
                      aria-label={`${series.name || `Series ${seriesIndex + 1}`}, ${category || `category ${categoryIndex + 1}`}`}
                      value={series.values[categoryIndex]}
                      onChange={(event) => {
                        // An emptied field counts as 0; other unfinished input keeps the last valid value.
                        const value = event.target.value === "" ? 0 : event.target.valueAsNumber;
                        if (Number.isFinite(value)) onChange(setValue(chart, seriesIndex, categoryIndex, value));
                      }}
                      className={cellClassName}
                    />
                  </td>
                ))}
                <td className="p-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove category ${categoryIndex + 1}`}
                    disabled={chart.categories.length <= 1}
                    onClick={() => onChange(removeCategory(chart, categoryIndex))}
                  >
                    ×
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          {canRemoveSeries(chart) && (
            <tfoot>
              <tr>
                <td />
                {chart.series.map((_, seriesIndex) => (
                  <td key={seriesIndex} className="p-0.5 text-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove series ${seriesIndex + 1}`}
                      onClick={() => onChange(removeSeries(chart, seriesIndex))}
                    >
                      Remove
                    </Button>
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="flex gap-2">
        <Button size="sm" disabled={!canAddCategory(chart)} onClick={() => onChange(addCategory(chart))}>
          Add category
        </Button>
        <Button size="sm" disabled={!canAddSeries(chart)} onClick={() => onChange(addSeries(chart))}>
          Add series
        </Button>
      </div>
    </div>
  );
}
