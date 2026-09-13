import type { BlockOfType, BlockType } from "@/features/deck/types";
import { LIMITS } from "@/features/deck/utils/schema";

type TableBlock = BlockOfType<BlockType.Table>;

export function setHeaderCell(table: TableBlock, columnIndex: number, value: string): TableBlock {
  return { ...table, header: table.header.with(columnIndex, value) };
}

export function setBodyCell(
  table: TableBlock,
  rowIndex: number,
  columnIndex: number,
  value: string,
): TableBlock {
  return {
    ...table,
    rows: table.rows.with(rowIndex, table.rows[rowIndex].with(columnIndex, value)),
  };
}

export function canAddRow(table: TableBlock): boolean {
  return table.rows.length < LIMITS.tableRows;
}

export function canAddColumn(table: TableBlock): boolean {
  return table.header.length < LIMITS.tableColumns;
}

export function addRow(table: TableBlock): TableBlock {
  if (!canAddRow(table)) return table;
  return { ...table, rows: [...table.rows, table.header.map(() => "")] };
}

export function removeRow(table: TableBlock, rowIndex: number): TableBlock {
  return { ...table, rows: table.rows.toSpliced(rowIndex, 1) };
}

export function addColumn(table: TableBlock): TableBlock {
  if (!canAddColumn(table)) return table;
  return {
    ...table,
    header: [...table.header, `Column ${table.header.length + 1}`],
    rows: table.rows.map((row) => [...row, ""]),
  };
}

export function removeColumn(table: TableBlock, columnIndex: number): TableBlock {
  if (table.header.length <= 1) return table;
  return {
    ...table,
    header: table.header.toSpliced(columnIndex, 1),
    rows: table.rows.map((row) => row.toSpliced(columnIndex, 1)),
  };
}
