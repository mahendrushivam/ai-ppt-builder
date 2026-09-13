import { useState } from "react";
import { buttonClassName } from "@/design-system/components/button";
import { ConfirmDialog } from "@/design-system/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/design-system/components/dropdown-menu";
import type { Block } from "@/features/deck/types";
import {
  convertBlock,
  NEW_BLOCK_LABELS,
  NEW_BLOCK_TYPES,
  type NewBlockType,
  replacementLosesContent,
} from "../utils/slide-editing";

type ReplaceBlockMenuProps = {
  block: Block;
  /** Receives the replacement, which keeps the block's id. */
  onReplace: (block: Block) => void;
};

/** Menu for turning a block into another type. Asks first when content would be lost. */
export function ReplaceBlockMenu({ block, onReplace }: ReplaceBlockMenuProps) {
  const [pendingType, setPendingType] = useState<NewBlockType | null>(null);
  const name = NEW_BLOCK_LABELS[block.type].toLowerCase();

  function choose(type: NewBlockType) {
    if (replacementLosesContent(block, type)) setPendingType(type);
    else onReplace(convertBlock(block, type));
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          aria-label={`Replace ${name} with another block`}
          className={buttonClassName({ variant: "ghost", size: "sm" })}
        >
          Replace
        </DropdownMenuTrigger>
        <DropdownMenuContent collisionPadding={8} className="w-40">
          {NEW_BLOCK_TYPES.filter((type) => type !== block.type).map((type) => (
            <DropdownMenuItem key={type} onSelect={() => choose(type)} className="cursor-pointer">
              {NEW_BLOCK_LABELS[type]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {pendingType && (
        <ConfirmDialog
          title="Replace this block?"
          description={`The ${name} and its content will be replaced by an empty ${NEW_BLOCK_LABELS[pendingType].toLowerCase()}.`}
          confirmLabel="Replace"
          onConfirm={() => {
            onReplace(convertBlock(block, pendingType));
            setPendingType(null);
          }}
          onCancel={() => setPendingType(null)}
        />
      )}
    </>
  );
}
