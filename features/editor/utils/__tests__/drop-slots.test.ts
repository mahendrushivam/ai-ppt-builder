import { describe, expect, test } from "vitest";
import { type ColumnLayout, dropSlotsFor } from "../drop-slots";
import type { Box } from "../toolbar-placement";

const box = (top: number, height: number, left = 0): Box => ({ left, top, width: 100, height });

describe("drop slots", () => {
  test("splits columns into one region per gap and disables gaps that can't take the block", () => {
    const left: ColumnLayout = { columnId: "left", box: box(0, 300), blockBoxes: [box(0, 100), box(120, 100)], isFull: false };
    const fullRight: ColumnLayout = { columnId: "right", box: box(0, 300, 200), blockBoxes: [box(0, 50, 200)], isFull: true };

    const slots = dropSlotsFor([left, fullRight], { columnId: "left", index: 0 });

    expect(slots.map(({ id, region, lineTop, isDisabled, order }) => [id, region.top, region.height, lineTop, isDisabled, order])).toEqual([
      ["left:0", 0, 50, 0, true, 0],
      ["left:1", 50, 120, 110, true, 1],
      ["left:2", 170, 130, 224, false, 2],
      ["right:0", 0, 25, 0, true, 3],
      ["right:1", 25, 275, 54, true, 4],
    ]);
  });

  test("gives an empty column a single slot covering all of it", () => {
    const empty: ColumnLayout = { columnId: "right", box: box(40, 200), blockBoxes: [], isFull: false };

    expect(dropSlotsFor([empty], { columnId: "left", index: 0 })).toEqual([
      { id: "right:0", columnId: "right", gapIndex: 0, region: box(40, 200), lineTop: 40, isDisabled: false, order: 0 },
    ]);
  });
});
