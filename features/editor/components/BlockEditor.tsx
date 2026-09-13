import { useState } from "react";
import { Button } from "@/design-system/components/button";
import { Field, fieldClassName } from "@/design-system/components/field";
import { type Block, type BlockOfType, BlockType } from "@/features/deck/types";
import { LIMITS } from "@/features/deck/utils/schema";
import { bulletsFromText, bulletsToText, editFieldId } from "../utils/slide-editing";
import { ChartEditor } from "./ChartEditor";
import { ImageEditor } from "./ImageEditor";
import { ReplaceBlockMenu } from "./ReplaceBlockMenu";
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
  /** Changes the block as it is now, for changes that finish after an async step. */
  onChangeLatest: (update: (block: Block) => Block) => void;
  onRemove: () => void;
};

export function BlockEditor({ block, onChange, onChangeLatest, onRemove }: BlockEditorProps) {
  const name = BLOCK_NAMES[block.type];

  return (
    <div className="space-y-2 rounded-md bg-muted p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{name}</span>
        <div className="flex items-center gap-0.5">
          <ReplaceBlockMenu block={block} onReplace={onChange} />
          <Button size="sm" variant="ghost" onClick={onRemove} aria-label={`Remove ${name.toLowerCase()}`}>
            Remove
          </Button>
        </div>
      </div>
      <BlockFields
        block={block}
        fieldId={editFieldId(`block-${block.id}`)}
        onChange={onChange}
        onChangeLatest={onChangeLatest}
      />
    </div>
  );
}

type BulletsFieldProps = {
  block: BlockOfType<BlockType.Bullets>;
  fieldId: string;
  onChange: (block: Block) => void;
};

/**
 * Bullets edited as text. What is typed is kept as a draft, so a new line always appears even
 * when the list is full; the slide saves what fits and a message explains the rest.
 */
function BulletsField({ block, fieldId, onChange }: BulletsFieldProps) {
  const savedText = bulletsToText(block.items);
  const [draft, setDraft] = useState(savedText);
  const typed = bulletsFromText(draft, block.items);

  // The list changed elsewhere, for example by an AI edit, so show what the slide holds now.
  if (bulletsToText(typed.items) !== savedText) setDraft(savedText);

  return (
    <Field
      label="Bullet points"
      htmlFor={fieldId}
      hint={`One per line, up to ${LIMITS.bulletsPerBlock}. Start a line with two spaces for a sub-point.`}
    >
      <textarea
        id={fieldId}
        rows={Math.max(3, draft.split("\n").length + 1)}
        value={draft}
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          const { items } = bulletsFromText(text, block.items);
          if (bulletsToText(items) !== savedText) onChange({ ...block, items });
        }}
        className={fieldClassName}
      />
      {typed.overflow && (
        <p role="status" className="text-xs text-destructive">
          {typed.overflow}
        </p>
      )}
    </Field>
  );
}

type BlockFieldsProps = {
  block: Block;
  fieldId: string;
  onChange: (block: Block) => void;
  onChangeLatest: (update: (block: Block) => Block) => void;
};

function BlockFields({ block, fieldId, onChange, onChangeLatest }: BlockFieldsProps) {
  switch (block.type) {
    case BlockType.Bullets:
      return <BulletsField block={block} fieldId={fieldId} onChange={onChange} />;

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
      return <ChartEditor chart={block} fieldId={fieldId} onChange={onChange} />;

    case BlockType.Image:
      return (
        <ImageEditor
          image={block}
          fieldId={fieldId}
          onChange={onChange}
          onImageFound={(image) =>
            onChangeLatest((current) => (current.type === BlockType.Image ? { ...current, image } : current))
          }
        />
      );
  }
}
