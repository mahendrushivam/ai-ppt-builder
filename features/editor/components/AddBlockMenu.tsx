import { buttonClassName } from "@/design-system/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/design-system/components/dropdown-menu";
import { NEW_BLOCK_LABELS, NEW_BLOCK_TYPES, type NewBlockType } from "../utils/slide-editing";

type AddBlockMenuProps = {
  label: string;
  disabled?: boolean;
  onAdd: (type: NewBlockType) => void;
};

/** Menu for choosing the type of a new content block. */
export function AddBlockMenu({ label, disabled = false, onAdd }: AddBlockMenuProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger disabled={disabled} className={buttonClassName({ variant: "ghost", size: "sm" })}>
        + {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent collisionPadding={8} className="w-40">
        {NEW_BLOCK_TYPES.map((type) => (
          <DropdownMenuItem key={type} onSelect={() => onAdd(type)} className="cursor-pointer">
            {NEW_BLOCK_LABELS[type]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
