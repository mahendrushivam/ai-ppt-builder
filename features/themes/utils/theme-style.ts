import type { CSSProperties } from "react";
import type { Theme } from "../types";

/**
 * Exposes theme tokens as CSS custom properties, so slide components can be styled
 * with CSS classes that read `var(--slide-*)` instead of theme-specific values.
 */
export function themeStyle(theme: Theme): CSSProperties {
  return {
    "--slide-background": theme.background,
    "--slide-text": theme.colors.text,
    "--slide-muted": theme.colors.mutedText,
    "--slide-accent": theme.colors.accent,
    "--slide-on-accent": theme.colors.onAccent,
    "--slide-surface": theme.colors.surface,
    "--slide-border": theme.colors.border,
    "--slide-heading-font": theme.typography.headingFont,
    "--slide-body-font": theme.typography.bodyFont,
    "--slide-heading-weight": theme.typography.headingWeight,
    "--slide-title-size": theme.typography.titleSize,
    "--slide-heading-size": theme.typography.headingSize,
    "--slide-body-size": theme.typography.bodySize,
    "--slide-padding": theme.spacing.slidePadding,
    "--slide-gap": theme.spacing.blockGap,
    "--slide-radius": theme.radius,
  };
}
