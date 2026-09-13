import type { ThemeId } from "../types";
import { themeStyle } from "../utils/theme-style";
import { THEME_IDS, THEMES } from "../utils/themes";

type ThemeSelectorProps = {
  value: ThemeId;
  onChange: (themeId: ThemeId) => void;
};

/** Radio group of theme swatches; arrow keys move between themes. */
export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  return (
    <fieldset>
      <legend className="sr-only">Theme</legend>
      <div className="flex items-center gap-1.5">
        {THEME_IDS.map((themeId) => {
          const theme = THEMES[themeId];
          return (
            <label
              key={themeId}
              title={theme.name}
              className="cursor-pointer rounded-md p-0.5 has-checked:ring-2 has-checked:ring-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
            >
              <input
                type="radio"
                name="deck-theme"
                value={themeId}
                checked={value === themeId}
                onChange={() => onChange(themeId)}
                className="sr-only"
              />
              <span className="sr-only">{theme.name}</span>
              <span
                aria-hidden
                style={themeStyle(theme)}
                className="flex h-7 w-11 items-end justify-end rounded border border-foreground/15 p-1 [background:var(--slide-background)]"
              >
                <span className="h-2 w-4 rounded-sm [background:var(--slide-accent)]" />
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
