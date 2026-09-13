import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/design-system/components/button";
import type { Column, Slide } from "@/features/deck/types";
import { LIMITS } from "@/features/deck/utils/schema";
import { SlideRenderer } from "@/features/renderer/components/SlideRenderer";
import type { Theme } from "@/features/themes/types";
import {
  appendBlock,
  createBlock,
  insertBlockAfter,
  type NewBlockType,
  removeBlock,
  replaceBlock,
} from "../utils/slide-editing";
import { AddBlockMenu } from "./AddBlockMenu";
import { ReplaceBlockMenu } from "./ReplaceBlockMenu";

type SlideCanvasProps = {
  slide: Slide;
  theme: Theme;
  /** Called with the `data-edit-target` of the slide element the user clicked. */
  onEditTarget: (target: string) => void;
  /** Applies new columns to the slide; returns whether the change was accepted. */
  onChangeColumns: (columns: Column[]) => boolean;
};

enum SelectionKind {
  Block = "block",
  Column = "column",
}

type CanvasSelection = { kind: SelectionKind.Block; blockId: string } | { kind: SelectionKind.Column; columnId: string };

const BLOCK_TARGET_PREFIX = "block-";
/** Space between the floating toolbar and the element it belongs to. */
const TOOLBAR_GAP_PX = 6;

/**
 * Shows the selected slide. Clicking text is a shortcut to its field in the settings panel;
 * clicking a block, or empty space in a column, opens a floating toolbar to add, replace or
 * delete blocks. The renderer itself stays read-only.
 */
export function SlideCanvas({ slide, theme, onEditTarget, onChangeColumns }: SlideCanvasProps) {
  const [selection, setSelection] = useState<CanvasSelection | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // A selection whose block or column is gone, or belongs to another slide, shows nothing.
  const selectedColumn = slide.columns.find((column) =>
    selection?.kind === SelectionKind.Block
      ? column.blocks.some((block) => block.id === selection.blockId)
      : column.id === selection?.columnId,
  );
  const selectedBlock =
    selection?.kind === SelectionKind.Block
      ? selectedColumn?.blocks.find((block) => block.id === selection.blockId)
      : undefined;
  const selector = selectedBlock
    ? `[data-edit-target="${BLOCK_TARGET_PREFIX}${selectedBlock.id}"]`
    : selectedColumn && `[data-column-id="${selectedColumn.id}"]`;

  // Places the toolbar above the selected element and outlines the element, following layout changes.
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const toolbar = toolbarRef.current;
    const element = selector ? wrapper?.querySelector<HTMLElement>(selector) : null;
    if (!wrapper || !toolbar || !element) return;

    element.setAttribute("data-canvas-selected", "");
    const place = () => {
      const wrapperRect = wrapper.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      toolbar.style.left = `${rect.left - wrapperRect.left}px`;
      toolbar.style.top = `${rect.top - wrapperRect.top - toolbar.offsetHeight - TOOLBAR_GAP_PX}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(wrapper);
    return () => {
      observer.disconnect();
      element.removeAttribute("data-canvas-selected");
    };
  }, [selector, slide]);

  // Clicking anywhere outside the slide and its menus closes the toolbar.
  useEffect(() => {
    if (!selection) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (wrapperRef.current?.contains(target) || target.closest('[data-slot="dropdown-menu-content"]')) return;
      setSelection(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [selection]);

  function selectFromClick(target: EventTarget) {
    if (!(target instanceof Element)) return;
    const editTarget = target.closest("[data-edit-target]")?.getAttribute("data-edit-target") ?? null;
    const columnId = target.closest("[data-column-id]")?.getAttribute("data-column-id") ?? null;

    if (editTarget?.startsWith(BLOCK_TARGET_PREFIX)) {
      setSelection({ kind: SelectionKind.Block, blockId: editTarget.slice(BLOCK_TARGET_PREFIX.length) });
    } else if (columnId && !editTarget) {
      setSelection({ kind: SelectionKind.Column, columnId });
    } else {
      setSelection(null);
    }
    if (editTarget) onEditTarget(editTarget);
  }

  function addBlock(type: NewBlockType) {
    if (!selectedColumn) return;
    const block = createBlock(type);
    const columns = selectedBlock
      ? insertBlockAfter(slide, selectedBlock.id, block)
      : appendBlock(slide, selectedColumn.id, block);
    if (!onChangeColumns(columns)) return;
    setSelection({ kind: SelectionKind.Block, blockId: block.id });
    onEditTarget(`${BLOCK_TARGET_PREFIX}${block.id}`);
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div ref={wrapperRef} className="relative">
        <div
          onClick={(event) => selectFromClick(event.target)}
          className="overflow-hidden rounded-lg shadow-lg ring-1 ring-foreground/10 [&_[data-edit-target]]:cursor-text [&_[data-edit-target]:hover]:outline-2 [&_[data-edit-target]:hover]:outline-offset-4 [&_[data-edit-target]:hover]:outline-ring/60 [&_[data-edit-target]:hover]:outline-dashed [&_[data-canvas-selected]]:outline-2 [&_[data-canvas-selected]]:outline-offset-4 [&_[data-canvas-selected]]:outline-ring [&_[data-canvas-selected]]:outline-solid"
        >
          <SlideRenderer slide={slide} theme={theme} />
        </div>

        {selectedColumn && (
          <div
            ref={toolbarRef}
            role="toolbar"
            aria-label={selectedBlock ? "Block actions" : "Column actions"}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSelection(null);
            }}
            className="absolute top-0 left-0 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
          >
            <AddBlockMenu
              label={selectedBlock ? "Add below" : "Add block"}
              disabled={selectedColumn.blocks.length >= LIMITS.blocksPerColumn}
              onAdd={addBlock}
            />
            {selectedBlock && (
              <>
                <ReplaceBlockMenu block={selectedBlock} onReplace={(block) => onChangeColumns(replaceBlock(slide, block))} />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onChangeColumns(removeBlock(slide, selectedBlock.id))}
                  className="text-destructive hover:bg-destructive/10"
                >
                  Delete
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Click text to edit it. Click a block or an empty part of a column to add, replace or delete blocks.
      </p>
    </div>
  );
}
