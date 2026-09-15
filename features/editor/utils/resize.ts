import { COLUMN_SPLIT, MIN_BLOCK_SIZE } from "@/features/deck/utils/schema";

/** A split this many percentage points or less from a preset snaps to it. */
const SPLIT_SNAP_DISTANCE = 2;
const SPLIT_SNAP_POINTS = [COLUMN_SPLIT.widerRight, COLUMN_SPLIT.equal, COLUMN_SPLIT.widerLeft];

/** The first column's share of two panel sizes, in percent, within the allowed range. */
export function splitFromSizes(first: number, second: number): number {
  const total = first + second;
  const split = total > 0 ? (first / total) * 100 : COLUMN_SPLIT.equal;
  return roundToHundredths(clamp(split, COLUMN_SPLIT.min, COLUMN_SPLIT.max));
}

/** Snaps a split to ⅓, ½ or ⅔ when it is close, so equal and preset widths are easy to hit. */
export function snapColumnSplit(split: number): number {
  return SPLIT_SNAP_POINTS.find((point) => Math.abs(point - split) <= SPLIT_SNAP_DISTANCE) ?? split;
}

/** Heights as shares of their total in percent, rounded and no smaller than the minimum block size. */
export function blockSharesFromSizes(sizes: number[]): number[] {
  const total = sizes.reduce((sum, size) => sum + size, 0);
  return sizes.map((size) =>
    clamp(roundToHundredths(total > 0 ? (size / total) * 100 : 100 / sizes.length), MIN_BLOCK_SIZE, 100),
  );
}

function roundToHundredths(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
