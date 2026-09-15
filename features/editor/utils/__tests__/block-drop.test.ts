import { describe, expect, test } from "vitest";
import { applyOperation } from "@/features/deck/utils/operations";
import { expectOk } from "@/testing/assertions";
import { deckWith, paragraph, twoColumnSlide } from "@/testing/fixtures";
import { type BlockMove, moveIntoColumn, moveOntoBlock, moveToGap } from "../block-drop";

const slide = twoColumnSlide("s", [paragraph("a"), paragraph("b"), paragraph("c")], [paragraph("d")]);

/** Block ids per column after applying the move, to check the operation lands where the drop points. */
function afterMove(blockId: string, move: BlockMove | null): string[][] {
  if (!move) throw new Error("Expected a move.");
  const deck = expectOk(applyOperation(deckWith(slide), { type: "block.move", slideId: "s", baseRevision: 0, blockId, ...move }));
  return deck.slides[0].columns.map((column) => column.blocks.map((block) => block.id.replace("block_", "")));
}

describe("block drops", () => {
  test("dropping on a block takes its place in either direction and across columns", () => {
    expect(afterMove("block_a", moveOntoBlock(slide, "block_a", "block_c"))).toEqual([["b", "c", "a"], ["d"]]);
    expect(afterMove("block_c", moveOntoBlock(slide, "block_c", "block_a"))).toEqual([["c", "a", "b"], ["d"]]);
    expect(afterMove("block_b", moveOntoBlock(slide, "block_b", "block_d"))).toEqual([["a", "c"], ["b", "d"]]);
    expect(moveOntoBlock(slide, "block_a", "block_a")).toBeNull();
  });

  test("dropping on a column appends the block, unless it is already last there", () => {
    expect(afterMove("block_a", moveIntoColumn(slide, "block_a", "s_right"))).toEqual([["b", "c"], ["d", "a"]]);
    expect(afterMove("block_a", moveIntoColumn(slide, "block_a", "s_left"))).toEqual([["b", "c", "a"], ["d"]]);
    expect(moveIntoColumn(slide, "block_c", "s_left")).toBeNull();
  });

  test("dropping in a gap inserts there, and the gaps around the block itself change nothing", () => {
    expect(afterMove("block_a", moveToGap(slide, "block_a", "s_left", 3))).toEqual([["b", "c", "a"], ["d"]]);
    expect(afterMove("block_c", moveToGap(slide, "block_c", "s_left", 1))).toEqual([["a", "c", "b"], ["d"]]);
    expect(afterMove("block_b", moveToGap(slide, "block_b", "s_right", 1))).toEqual([["a", "c"], ["d", "b"]]);
    expect(moveToGap(slide, "block_b", "s_left", 1)).toBeNull();
    expect(moveToGap(slide, "block_b", "s_left", 2)).toBeNull();
  });
});
