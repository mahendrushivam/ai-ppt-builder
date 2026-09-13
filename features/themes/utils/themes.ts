import { z } from "zod";
import type { Theme, ThemeId } from "../types";

export const THEME_IDS = ["paper", "midnight", "editorial", "sunset"] as const;
export const themeIdSchema = z.enum(THEME_IDS);

export const DEFAULT_THEME_ID: ThemeId = "paper";

const SANS_FONT = "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif";
const SERIF_FONT = "Georgia, 'Times New Roman', serif";

const BASE_TYPOGRAPHY = {
  headingFont: SANS_FONT,
  bodyFont: SANS_FONT,
  headingWeight: 700,
  titleSize: "4.6cqw",
  headingSize: "3.2cqw",
  bodySize: "1.9cqw",
};

const BASE_SPACING = { slidePadding: "5cqw", blockGap: "1.6cqw" };

/** Single source of truth for theme styling. Add a theme here and to `THEME_IDS`. */
export const THEMES: Record<ThemeId, Theme> = {
  paper: {
    id: "paper",
    name: "Paper",
    background: "#ffffff",
    colors: {
      text: "#111827",
      mutedText: "#4b5563",
      accent: "#4f46e5",
      onAccent: "#ffffff",
      surface: "#f3f4f6",
      border: "#e5e7eb",
    },
    typography: BASE_TYPOGRAPHY,
    spacing: BASE_SPACING,
    radius: "0.6cqw",
    chartColors: ["#4f46e5", "#0891b2", "#f59e0b", "#db2777"],
  },
  midnight: {
    id: "midnight",
    name: "Midnight",
    background: "linear-gradient(135deg, #0b1120 0%, #1e293b 100%)",
    colors: {
      text: "#f8fafc",
      mutedText: "#cbd5e1",
      accent: "#38bdf8",
      onAccent: "#0b1120",
      surface: "#1e293b",
      border: "#334155",
    },
    typography: BASE_TYPOGRAPHY,
    spacing: BASE_SPACING,
    radius: "0.6cqw",
    chartColors: ["#38bdf8", "#a78bfa", "#34d399", "#fbbf24"],
  },
  editorial: {
    id: "editorial",
    name: "Editorial",
    background: "#faf7f2",
    colors: {
      text: "#1c1917",
      mutedText: "#57534e",
      accent: "#b45309",
      onAccent: "#ffffff",
      surface: "#f0ebe3",
      border: "#e7e0d5",
    },
    typography: { ...BASE_TYPOGRAPHY, headingFont: SERIF_FONT, headingWeight: 600 },
    spacing: { ...BASE_SPACING, slidePadding: "6cqw" },
    radius: "0",
    chartColors: ["#b45309", "#1d4ed8", "#15803d", "#9f1239"],
  },
  sunset: {
    id: "sunset",
    name: "Sunset",
    background: "linear-gradient(135deg, #fff7ed 0%, #ffe4e6 100%)",
    colors: {
      text: "#1f2937",
      mutedText: "#4b5563",
      accent: "#e11d48",
      onAccent: "#ffffff",
      surface: "rgba(255, 255, 255, 0.7)",
      border: "#fecdd3",
    },
    typography: { ...BASE_TYPOGRAPHY, headingWeight: 800 },
    spacing: BASE_SPACING,
    radius: "1.2cqw",
    chartColors: ["#e11d48", "#f97316", "#7c3aed", "#0d9488"],
  },
};
