import { describe, expect, test } from "vitest";
import { LIMITS } from "@/features/deck/utils/schema";
import { THEME_IDS, THEMES } from "../themes";

describe("themes", () => {
  test("every theme id has a matching theme with enough chart colors", () => {
    for (const id of THEME_IDS) {
      expect(THEMES[id].id).toBe(id);
      expect(THEMES[id].chartColors.length).toBeGreaterThanOrEqual(LIMITS.chartSeries);
    }
  });
});
