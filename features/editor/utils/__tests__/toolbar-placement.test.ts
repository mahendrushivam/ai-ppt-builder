import { describe, expect, test } from "vitest";
import { type Box, placeToolbar, ToolbarAlign, ToolbarSide } from "../toolbar-placement";

const bounds: Box = { left: 0, top: 0, width: 1000, height: 600 };
const toolbar = { width: 200, height: 40 };
const target: Box = { left: 300, top: 200, width: 300, height: 100 };
const gap = 6;

function place(options: { target?: Box; obstacles?: Box[] } = {}) {
  return placeToolbar({ target: options.target ?? target, toolbar, bounds, obstacles: options.obstacles ?? [], gap });
}

describe("toolbar placement", () => {
  test("puts the toolbar above the target when nothing is there", () => {
    expect(place()).toEqual({ side: ToolbarSide.Above, align: ToolbarAlign.Start, left: 300, top: 154, ...toolbar });
  });

  test("lines up with the target's right edge when short text is above its left edge", () => {
    const shortTitle: Box = { left: 300, top: 150, width: 90, height: 30 };

    expect(place({ obstacles: [shortTitle] })).toMatchObject({ side: ToolbarSide.Above, align: ToolbarAlign.End, left: 400 });
  });

  test("moves below when the toolbar would cover content above the target", () => {
    const lineAbove: Box = { left: 300, top: 150, width: 300, height: 30 };

    expect(place({ obstacles: [lineAbove] }).side).toBe(ToolbarSide.Below);
  });

  test("moves to the right, then the left, when content is above and below", () => {
    const lineAbove: Box = { left: 300, top: 150, width: 300, height: 30 };
    const lineBelow: Box = { left: 300, top: 310, width: 300, height: 30 };
    const blockOnRight: Box = { left: 620, top: 200, width: 300, height: 100 };

    expect(place({ obstacles: [lineAbove, lineBelow] })).toMatchObject({ side: ToolbarSide.Right, left: 606, top: 200 });
    expect(place({ obstacles: [lineAbove, lineBelow, blockOnRight] })).toMatchObject({
      side: ToolbarSide.Left,
      left: 94,
      top: 200,
    });
  });

  test("skips sides that would put the toolbar outside the visible area", () => {
    const targetAtTop: Box = { left: 300, top: 10, width: 300, height: 100 };

    expect(place({ target: targetAtTop }).side).toBe(ToolbarSide.Below);
  });

  test("keeps the toolbar inside the visible area when the target starts near an edge", () => {
    const targetNearRightEdge: Box = { left: 900, top: 200, width: 100, height: 100 };

    expect(place({ target: targetNearRightEdge })).toMatchObject({ side: ToolbarSide.Above, left: 800 });
  });

  test("covers as little as possible when every side covers content", () => {
    const everythingAbove: Box = { left: 0, top: 0, width: 1000, height: 200 };
    const thinLineBelow: Box = { left: 0, top: 300, width: 1000, height: 10 };
    const contentOnLeft: Box = { left: 0, top: 200, width: 300, height: 100 };
    const contentOnRight: Box = { left: 600, top: 200, width: 400, height: 100 };

    const placement = place({ obstacles: [everythingAbove, thinLineBelow, contentOnLeft, contentOnRight] });

    expect(placement).toMatchObject({ side: ToolbarSide.Below, align: ToolbarAlign.Start });
  });
});
