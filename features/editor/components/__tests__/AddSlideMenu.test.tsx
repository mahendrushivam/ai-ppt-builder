import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { AddSlideMenu } from "../AddSlideMenu";

describe("AddSlideMenu", () => {
  test("adds a slide with the layout picked from the menu", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddSlideMenu onAdd={onAdd} />);

    await user.click(screen.getByRole("button", { name: "+ Add slide" }));
    await user.click(screen.getByRole("menuitem", { name: "Content" }));

    expect(onAdd).toHaveBeenCalledWith("content");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  test("opens from the keyboard and closes on Escape without adding a slide", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddSlideMenu onAdd={onAdd} />);

    screen.getByRole("button", { name: "+ Add slide" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add slide" })).toHaveFocus();
    expect(onAdd).not.toHaveBeenCalled();
  });
});
