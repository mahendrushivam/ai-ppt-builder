import type { z } from "zod";
import type { themeIdSchema } from "./utils/themes";

export type ThemeId = z.infer<typeof themeIdSchema>;

/**
 * Design tokens for rendering slides. Sizes use container query units (`cqw`) so a
 * slide scales the same way on the canvas, in thumbnails and in print.
 */
export type Theme = {
  id: ThemeId;
  name: string;
  /** CSS `background` for the slide; may be a gradient. */
  background: string;
  colors: {
    text: string;
    mutedText: string;
    accent: string;
    onAccent: string;
    /** Table cells, cards and other raised areas. */
    surface: string;
    border: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    headingWeight: number;
    titleSize: string;
    headingSize: string;
    bodySize: string;
  };
  spacing: {
    slidePadding: string;
    blockGap: string;
  };
  radius: string;
  /** One color per chart series, in order. */
  chartColors: readonly string[];
};
