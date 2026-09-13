import { buttonClassName } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SlideLayout } from "@/features/deck/types";
import { SLIDE_LAYOUTS } from "@/features/deck/utils/schema";
import { LAYOUT_LABELS } from "../utils/slide-editing";

type AddSlideMenuProps = {
  onAdd: (layout: SlideLayout) => void;
  label?: string;
};

/** Menu for choosing the layout of a new slide. Radix flips it above the trigger when there is no room below. */
export function AddSlideMenu({
  onAdd,
  label = "Add slide",
}: AddSlideMenuProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className={buttonClassName({ variant: "primary" })}>
        + {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent collisionPadding={8} className="w-48">
        {SLIDE_LAYOUTS.map((layout) => (
          <DropdownMenuItem
            key={layout}
            onSelect={() => onAdd(layout)}
            className="cursor-pointer"
          >
            {LAYOUT_LABELS[layout]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
