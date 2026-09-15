import { describe, expect, test } from "vitest";
import { blockSharesFromSizes, snapColumnSplit, splitFromSizes } from "../resize";

describe("resize values", () => {
  test("turns two panel sizes into a column split within 25–75%", () => {
    expect(splitFromSizes(60, 40)).toBe(60);
    expect(splitFromSizes(1, 2)).toBe(33.33);
    expect(splitFromSizes(90, 10)).toBe(75);
    expect(splitFromSizes(0, 0)).toBe(50);
  });

  test("snaps splits close to a third, a half or two thirds", () => {
    expect(snapColumnSplit(48.5)).toBe(50);
    expect(snapColumnSplit(65)).toBe(66.67);
    expect(snapColumnSplit(40)).toBe(40);
  });

  test("turns block heights into shares with the minimum block size", () => {
    expect(blockSharesFromSizes([100, 300])).toEqual([25, 75]);
    expect(blockSharesFromSizes([5, 95])).toEqual([10, 95]);
    expect(blockSharesFromSizes([0, 0])).toEqual([50, 50]);
  });
});
