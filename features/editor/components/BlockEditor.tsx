import { Button } from "@/design-system/components/button";
import { Field, fieldClassName } from "@/design-system/components/field";
import { type Block, BlockType } from "@/features/deck/types";
import { LIMITS } from "@/features/deck/utils/schema";
import { bulletsToText, editFieldId, textToBullets } from "../utils/slide-editing";
import { TableEditor } from "./TableEditor";

const BLOCK_NAMES: Record<BlockType, string> = {
  [BlockType.Bullets]: "Bullet list",
  [BlockType.Paragraph]: "Paragraph",
  [BlockType.Table]: "Table",
  [BlockType.Chart]: "Chart",
  [BlockType.Image]: "Image",
};

type BlockEditorProps = {
  block: Block;
  onChange: (block: Block) => void;
  onRemove: () => void;
};

export function BlockEditor({ block, onChange, onRemove }: BlockEditorProps) {
  const name = BLOCK_NAMES[block.type];

  return (
    <div className="space-y-2 rounded-md bg-muted p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{name}</span>
        <Button size="sm" variant="ghost" onClick={onRemove} aria-label={`Remove ${name.toLowerCase()}`}>
          Remove
        </Button>
      </div>
      <BlockFields block={block} fieldId={editFieldId(`block-${block.id}`)} onChange={onChange} />
    </div>
  );
}

type BlockFieldsProps = {
  block: Block;
  fieldId: string;
  onChange: (block: Block) => void;
};

function BlockFields({ block, fieldId, onChange }: BlockFieldsProps) {
  switch (block.type) {
    case BlockType.Bullets:
      return (
        <Field
          label="Bullet points"
          htmlFor={fieldId}
          hint={`One per line, up to ${LIMITS.bulletsPerBlock}. Start a line with two spaces for a sub-point.`}
        >
          <textarea
            id={fieldId}
            rows={Math.max(3, block.items.length + 1)}
            value={bulletsToText(block.items)}
            onChange={(event) => onChange({ ...block, items: textToBullets(event.target.value, block.items) })}
            className={fieldClassName}
          />
        </Field>
      );

    case BlockType.Paragraph:
      return (
        <Field label="Text" htmlFor={fieldId}>
          <textarea
            id={fieldId}
            rows={4}
            value={block.text}
            maxLength={LIMITS.paragraph}
            onChange={(event) => onChange({ ...block, text: event.target.value })}
            className={fieldClassName}
          />
        </Field>
      );

    case BlockType.Table:
      return <TableEditor table={block} fieldId={fieldId} onChange={onChange} />;

    case BlockType.Chart:
      return (
        <p id={fieldId} tabIndex={-1} className="text-sm text-muted-foreground">
          {block.title ?? "Untitled chart"}: chart data can&apos;t be edited yet.
        </p>
      );

    case BlockType.Image:
      return (
        <p id={fieldId} tabIndex={-1} className="text-sm text-muted-foreground">
          Image of &ldquo;{block.alt}&rdquo;. Images can&apos;t be changed yet.
        </p>
      );
  }
}
