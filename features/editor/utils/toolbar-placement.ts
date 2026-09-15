/** A rectangle in window coordinates, like the result of `getBoundingClientRect()`. */
export type Box = { left: number; top: number; width: number; height: number };

export enum ToolbarSide {
  Above = "above",
  Below = "below",
  Right = "right",
  Left = "left",
}

/** Which edge of the target the toolbar lines up with: left or right above and below it, top beside it. */
export enum ToolbarAlign {
  Start = "start",
  End = "end",
}

type ToolbarPlacementInput = {
  /** The selected element the toolbar belongs to. */
  target: Box;
  toolbar: { width: number; height: number };
  /** The area where the toolbar can be seen. */
  bounds: Box;
  /** Other content the toolbar should not cover. */
  obstacles: readonly Box[];
  /** Space between the toolbar and the target. */
  gap: number;
};

export type ToolbarPlacement = Box & { side: ToolbarSide; align: ToolbarAlign };

/** Positions in order of preference. */
const CANDIDATES: readonly { side: ToolbarSide; align: ToolbarAlign }[] = [
  { side: ToolbarSide.Above, align: ToolbarAlign.Start },
  { side: ToolbarSide.Above, align: ToolbarAlign.End },
  { side: ToolbarSide.Below, align: ToolbarAlign.Start },
  { side: ToolbarSide.Below, align: ToolbarAlign.End },
  { side: ToolbarSide.Right, align: ToolbarAlign.Start },
  { side: ToolbarSide.Left, align: ToolbarAlign.Start },
];

/**
 * Picks where the toolbar goes: the first position that fits in `bounds` and covers no obstacle.
 * When every position covers something it takes the one that covers the least, and when none
 * fits it stays above the target.
 */
export function placeToolbar(input: ToolbarPlacementInput): ToolbarPlacement {
  const candidates = CANDIDATES.map(({ side, align }) => positionAt(side, align, input));
  const visible = candidates.filter((candidate) => isInside(candidate, input.bounds));
  if (visible.length === 0) return candidates[0];

  const scored = visible.map((candidate) => ({ candidate, covered: coveredArea(candidate, input.obstacles) }));
  // `reduce` keeps the earlier candidate on ties, so preference order decides between equals.
  return scored.reduce((best, next) => (next.covered < best.covered ? next : best)).candidate;
}

function positionAt(
  side: ToolbarSide,
  align: ToolbarAlign,
  { target, toolbar, bounds, gap }: ToolbarPlacementInput,
): ToolbarPlacement {
  const base = { side, align, width: toolbar.width, height: toolbar.height };
  const edgeLeft = align === ToolbarAlign.Start ? target.left : target.left + target.width - toolbar.width;
  const alignedLeft = clamp(edgeLeft, bounds.left, bounds.left + bounds.width - toolbar.width);
  const alignedTop = clamp(target.top, bounds.top, bounds.top + bounds.height - toolbar.height);

  switch (side) {
    case ToolbarSide.Above:
      return { ...base, left: alignedLeft, top: target.top - toolbar.height - gap };
    case ToolbarSide.Below:
      return { ...base, left: alignedLeft, top: target.top + target.height + gap };
    case ToolbarSide.Right:
      return { ...base, left: target.left + target.width + gap, top: alignedTop };
    case ToolbarSide.Left:
      return { ...base, left: target.left - toolbar.width - gap, top: alignedTop };
  }
}

function isInside(box: Box, bounds: Box): boolean {
  return (
    box.left >= bounds.left &&
    box.top >= bounds.top &&
    box.left + box.width <= bounds.left + bounds.width &&
    box.top + box.height <= bounds.top + bounds.height
  );
}

/** Total area of `box` that obstacles cover. Touching edges cover nothing. */
function coveredArea(box: Box, obstacles: readonly Box[]): number {
  return obstacles.reduce((total, obstacle) => {
    const width = Math.min(box.left + box.width, obstacle.left + obstacle.width) - Math.max(box.left, obstacle.left);
    const height = Math.min(box.top + box.height, obstacle.top + obstacle.height) - Math.max(box.top, obstacle.top);
    return width > 0 && height > 0 ? total + width * height : total;
  }, 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
