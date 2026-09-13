import { Button } from "@/components/ui/Button";
import { fieldClassName } from "@/components/ui/Field";
import type { BlockOfType, BlockType } from "@/features/deck/types";
import { LIMITS } from "@/features/deck/utils/schema";
import {
  addColumn,
  addRow,
  canAddColumn,
  canAddRow,
  removeColumn,
  removeRow,
  setBodyCell,
  setHeaderCell,
} from "../utils/table-editing";

type TableBlock = BlockOfType<BlockType.Table>;

type TableEditorProps = {
  table: TableBlock;
  /** Id for the first header cell, so the table can be focused from the slide canvas. */
  fieldId: string;
  onChange: (table: TableBlock) => void;
};

export function TableEditor({ table, fieldId, onChange }: TableEditorProps) {
  const cellClassName = `${fieldClassName} min-w-20 px-1.5 py-1`;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {table.header.map((cell, columnIndex) => (
                <th key={columnIndex} scope="col" className="p-0.5">
                  <input
                    id={columnIndex === 0 ? fieldId : undefined}
                    aria-label={`Header, column ${columnIndex + 1}`}
                    value={cell}
                    maxLength={LIMITS.tableCell}
                    onChange={(event) => onChange(setHeaderCell(table, columnIndex, event.target.value))}
                    className={`${cellClassName} font-semibold`}
                  />
                </th>
              ))}
              <td />
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, columnIndex) => (
                  <td key={columnIndex} className="p-0.5">
                    <input
                      aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
                      value={cell}
                      maxLength={LIMITS.tableCell}
                      onChange={(event) =>
                        onChange(setBodyCell(table, rowIndex, columnIndex, event.target.value))
                      }
                      className={cellClassName}
                    />
                  </td>
                ))}
                <td className="p-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove row ${rowIndex + 1}`}
                    onClick={() => onChange(removeRow(table, rowIndex))}
                  >
                    ×
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              {table.header.map((_, columnIndex) => (
                <td key={columnIndex} className="p-0.5 text-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove column ${columnIndex + 1}`}
                    disabled={table.header.length <= 1}
                    onClick={() => onChange(removeColumn(table, columnIndex))}
                  >
                    Remove
                  </Button>
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={!canAddRow(table)} onClick={() => onChange(addRow(table))}>
          Add row
        </Button>
        <Button size="sm" disabled={!canAddColumn(table)} onClick={() => onChange(addColumn(table))}>
          Add column
        </Button>
      </div>
    </div>
  );
}
