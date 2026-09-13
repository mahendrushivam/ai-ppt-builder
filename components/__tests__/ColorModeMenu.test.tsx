import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { afterEach, describe, expect, test } from "vitest";
import { ColorModeMenu } from "../ColorModeMenu";

function renderMenu() {
  const user = userEvent.setup();
  render(
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ColorModeMenu />
    </ThemeProvider>,
  );
  return { user, openMenu: () => user.click(screen.getByRole("button", { name: "Color mode" })) };
}

afterEach(() => {
  document.documentElement.removeAttribute("class");
  document.documentElement.removeAttribute("style");
});

describe("ColorModeMenu", () => {
  test("follows the system color scheme by default", async () => {
    const { openMenu } = renderMenu();

    await openMenu();

    expect(screen.getByRole("menuitemradio", { name: "System" })).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveClass("light");
  });

  test("switches to dark mode and remembers the choice", async () => {
    const { user, openMenu } = renderMenu();

    await openMenu();
    await user.click(screen.getByRole("menuitemradio", { name: "Dark" }));

    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("dark");

    await openMenu();
    expect(screen.getByRole("menuitemradio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
  });
});
