import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test } from "vitest";
import { type BlockOfType, BlockType } from "@/features/deck/types";
import { ChartEditor } from "../ChartEditor";

type ChartBlock = BlockOfType<BlockType.Chart>;

const revenueChart: ChartBlock = {
  id: "chart",
  type: BlockType.Chart,
  chartType: "bar",
  title: "Revenue",
  categories: ["Q1", "Q2"],
  series: [
    { name: "2025", values: [10, 20] },
    { name: "2026", values: [15, 25] },
  ],
};

function renderEditor() {
  const changes: ChartBlock[] = [];

  function EditableChart() {
    const [chart, setChart] = useState(revenueChart);
    return (
      <ChartEditor
        chart={chart}
        fieldId="chart-field"
        onChange={(next) => {
          changes.push(next);
          setChart(next);
        }}
      />
    );
  }

  render(<EditableChart />);
  return { user: userEvent.setup(), latest: () => changes.at(-1) };
}

describe("ChartEditor", () => {
  test("edits a value and a category name", async () => {
    const { user, latest } = renderEditor();

    const value = screen.getByLabelText("2026, Q2");
    await user.clear(value);
    await user.type(value, "40");
    await user.clear(screen.getByLabelText("Category 1"));
    await user.type(screen.getByLabelText("Category 1"), "Jan");

    expect(latest()?.series[1].values).toEqual([15, 40]);
    expect(latest()?.categories).toEqual(["Jan", "Q2"]);
  });

  test("keeps only the first series after switching to a pie chart", async () => {
    const { user, latest } = renderEditor();

    await user.selectOptions(screen.getByLabelText("Chart type"), "pie");

    expect(latest()?.series.map((series) => series.name)).toEqual(["2025"]);
    expect(screen.queryByLabelText("Series 2 name")).not.toBeInTheDocument();
    expect(screen.getByText(/A pie chart shows one series/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add series" })).toBeDisabled();
  });
});
