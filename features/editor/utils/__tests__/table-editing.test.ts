import { describe, expect, test } from "vitest";
import { type BlockOfType, BlockType } from "@/features/deck/types";
import { LIMITS } from "@/features/deck/utils/schema";
import { addColumn, addRow, removeColumn, removeRow, setBodyCell, setHeaderCell } from "../table-editing";

const table: BlockOfType<BlockType.Table> = {
  id: "table",
  type: BlockType.Table,
  header: ["Plan", "Price"],
  rows: [["Basic", "$10"]],
};

describe("table editing", () => {
  test("edits header and body cells", () => {
    const edited = setBodyCell(setHeaderCell(table, 1, "Monthly"), 0, 1, "$12");

    expect(edited.header).toEqual(["Plan", "Monthly"]);
    expect(edited.rows).toEqual([["Basic", "$12"]]);
    expect(table.rows).toEqual([["Basic", "$10"]]);
  });

  test("keeps every row as wide as the header when columns change", () => {
    const widened = addColumn(addRow(table));

    expect(widened.header).toEqual(["Plan", "Price", "Column 3"]);
    expect(widened.rows).toEqual([
      ["Basic", "$10", ""],
      ["", "", ""],
    ]);
    expect(removeColumn(widened, 0).rows).toEqual([
      ["$10", ""],
      ["", ""],
    ]);
    expect(removeRow(widened, 0).rows).toEqual([["", "", ""]]);
  });

  test("respects the size limits", () => {
    const oneColumn = { ...table, header: ["Only"], rows: [["x"]] };
    const fullRows = { ...table, rows: Array.from({ length: LIMITS.tableRows }, () => ["", ""]) };

    expect(removeColumn(oneColumn, 0)).toBe(oneColumn);
    expect(addRow(fullRows)).toBe(fullRows);
  });
});
