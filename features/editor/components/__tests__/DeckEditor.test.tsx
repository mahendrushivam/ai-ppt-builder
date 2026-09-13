import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import type { Deck } from "@/features/deck/types";
import { useDecksStore } from "@/features/decks/hooks/use-decks-store";
import { bullets, contentSlide, deckWith, paragraph } from "@/testing/fixtures";
import { seedDecks } from "@/testing/stores";
import { DeckEditor } from "../DeckEditor";

function renderEditor(deck: Deck) {
  seedDecks(deck);
  const user = userEvent.setup();
  render(<DeckEditor deckId={deck.id} />);
  return { user, currentDeck: () => useDecksStore.getState().decks[0] };
}

const canvas = () => within(screen.getByRole("main"));

describe("DeckEditor", () => {
  test("explains when the presentation does not exist", () => {
    seedDecks();

    render(<DeckEditor deckId="deck_missing" />);

    expect(screen.getByRole("heading", { name: "Presentation not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to presentations" })).toHaveAttribute("href", "/");
  });

  test("adds the first slide to an empty presentation and edits its title", async () => {
    const { user, currentDeck } = renderEditor(deckWith());

    expect(canvas().getByRole("heading", { name: "This presentation has no slides" })).toBeInTheDocument();
    await user.click(canvas().getByRole("button", { name: "+ Add first slide" }));
    await user.click(screen.getByRole("menuitem", { name: "Content" }));
    await user.type(screen.getByLabelText("Title"), "Pricing");

    expect(canvas().getByRole("heading", { name: "Pricing" })).toBeInTheDocument();
    expect(currentDeck().slides.map((slide) => slide.title)).toEqual(["Pricing"]);
  });

  test("edits bullet points and shows them on the slide", async () => {
    const { user } = renderEditor(deckWith(contentSlide("a", [bullets("list", ["Old"])])));

    await user.click(screen.getByRole("tab", { name: "Slide settings" }));
    const textarea = screen.getByLabelText("Bullet points");
    await user.clear(textarea);
    await user.type(textarea, "Fast{Enter}Cheap");

    expect(canvas().getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Fast", "Cheap"]);
  });

  test("focuses the matching field when text on the slide is clicked", async () => {
    const { user } = renderEditor(deckWith(contentSlide("a")));

    await user.click(canvas().getByRole("heading", { name: "Slide a" }));

    expect(screen.getByLabelText("Title")).toHaveFocus();
  });

  test("reorders slides with the move buttons", async () => {
    const { user, currentDeck } = renderEditor(deckWith(contentSlide("a"), contentSlide("b")));

    await user.click(screen.getByRole("button", { name: "Move Slide 2: Slide b up" }));

    expect(currentDeck().slides.map((slide) => slide.id)).toEqual(["b", "a"]);
    expect(screen.getByRole("button", { name: "Slide 1: Slide b" })).toBeInTheDocument();
  });

  test("deletes a slide after confirmation and selects the next one", async () => {
    const { user, currentDeck } = renderEditor(deckWith(contentSlide("a"), contentSlide("b")));

    await user.click(screen.getByRole("button", { name: "Delete Slide 1: Slide a" }));
    await user.click(screen.getByRole("button", { name: "Delete slide" }));

    expect(currentDeck().slides.map((slide) => slide.id)).toEqual(["b"]);
    expect(canvas().getByRole("heading", { name: "Slide b" })).toBeInTheDocument();
  });

  test("asks before switching to a layout that removes content", async () => {
    const { user, currentDeck } = renderEditor(deckWith(contentSlide("a", [paragraph("Keep me")])));

    await user.click(screen.getByRole("tab", { name: "Slide settings" }));
    await user.selectOptions(screen.getByLabelText("Layout"), "title");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(currentDeck().slides[0].layout).toBe("content");

    await user.selectOptions(screen.getByLabelText("Layout"), "title");
    await user.click(screen.getByRole("button", { name: "Change layout" }));
    expect(currentDeck().slides[0]).toMatchObject({ layout: "title", columns: [] });
  });

  test("changes the presentation theme", async () => {
    const { user, currentDeck } = renderEditor(deckWith(contentSlide("a")));

    await user.click(screen.getByRole("radio", { name: "Midnight" }));

    expect(currentDeck().themeId).toBe("midnight");
  });

  test("renames the presentation from the header", async () => {
    const { user, currentDeck } = renderEditor(deckWith());

    const titleField = screen.getByRole("textbox", { name: "Presentation title" });
    await user.clear(titleField);
    await user.type(titleField, "Board update{Enter}");

    expect(currentDeck().title).toBe("Board update");
  });
});
