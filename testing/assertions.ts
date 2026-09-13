import { expect } from "vitest";
import type { Deck, OperationFailure, OperationResult } from "@/features/deck/types";

export function expectOk(result: OperationResult): Deck {
  if (!result.ok) throw new Error(`Expected success but got ${result.code}: ${result.message}`);
  return result.deck;
}

export function expectFailure(
  result: OperationResult,
  code: OperationFailure["code"],
): OperationFailure {
  if (result.ok) throw new Error(`Expected ${code} but the operation succeeded`);
  expect(result.code).toBe(code);
  return result;
}
