import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { type Block, BlockType, type Deck } from "@/features/deck/types";
import { useDecksStore } from "@/features/decks/hooks/use-decks-store";
import { bullets, contentSlide, deckWith, paragraph } from "@/testing/fixtures";
import { seedDecks } from "@/testing/stores";
import { DeckEditor } from "../DeckEditor";

// jsdom can't draw an element into an image.
vi.mock("html-to-image", () => ({ toBlob: async () => new Blob(["png"], { type: "image/png" }) }));

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

  test("undoes and redoes an edit with the header buttons and keyboard shortcuts", async () => {
    const { user, currentDeck } = renderEditor(deckWith(contentSlide("a")));

    await user.click(screen.getByRole("tab", { name: "Slide settings" }));
    const title = screen.getByLabelText("Title");
    await user.clear(title);
    await user.type(title, "Pricing");
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(currentDeck().slides[0].title).toBe("Slide a");
    expect(canvas().getByRole("heading", { name: "Slide a" })).toBeInTheDocument();

    await user.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    expect(currentDeck().slides[0].title).toBe("Pricing");

    await user.keyboard("{Control>}z{/Control}");
    expect(currentDeck().slides[0].title).toBe("Slide a");
  });

  test("edits bullet points and shows them on the slide", async () => {
    const { user } = renderEditor(deckWith(contentSlide("a", [bullets("list", ["Old"])])));

    await user.click(screen.getByRole("tab", { name: "Slide settings" }));
    const textarea = screen.getByLabelText("Bullet points");
    await user.clear(textarea);
    await user.type(textarea, "Fast{Enter}Cheap");

    expect(canvas().getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Fast", "Cheap"]);
  });

  test("adds a chart block and changes its type", async () => {
    const { user, currentDeck } = renderEditor(deckWith(contentSlide("a")));

    await user.click(screen.getByRole("tab", { name: "Slide settings" }));
    await user.click(screen.getByRole("button", { name: "+ Chart" }));
    expect(canvas().getByRole("img", { name: "Bar chart: untitled" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Chart type"), "funnel");

    expect(canvas().getByRole("img", { name: "Funnel chart: untitled" })).toBeInTheDocument();
    expect(currentDeck().slides[0].columns[0].blocks.at(-1)).toMatchObject({ type: "chart", chartType: "funnel" });
  });

  test("adds an image block with a search query to edit", async () => {
    const { user, currentDeck } = renderEditor(deckWith(contentSlide("a")));

    await user.click(screen.getByRole("tab", { name: "Slide settings" }));
    await user.click(screen.getByRole("button", { name: "+ Image" }));

    expect(screen.getByLabelText("Image search")).toHaveValue("team working together");
    expect(canvas().getByRole("img", { name: "Team working together" })).toBeInTheDocument();
    expect(currentDeck().slides[0].columns[0].blocks.at(-1)).toMatchObject({ type: "image", image: null });
  });

  test("exports through the print view or as a PNG of the selected slide", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const deck = deckWith(contentSlide("a"), contentSlide("b"));
    const { user } = renderEditor(deck);

    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(screen.getByRole("menuitem", { name: "Print or save as PDF" })).toHaveAttribute("href", `/decks/${deck.id}/print`);
    await user.click(screen.getByRole("menuitem", { name: "Download slide 1 as PNG" }));

    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(click.mock.contexts[0]).toHaveProperty("download", "test-deck-slide-1.png");
  });

  test("starts a new line in a full bullet list and explains that it isn't saved", async () => {
    const points = Array.from({ length: 8 }, (_, index) => `Point ${index + 1}`);
    const { user, currentDeck } = renderEditor(deckWith(contentSlide("a", [bullets("list", points)])));

    await user.click(screen.getByRole("tab", { name: "Slide settings" }));
    const textarea = screen.getByLabelText("Bullet points");
    await user.type(textarea, "{Enter}Point 9");

    expect(textarea).toHaveValue(`${points.join("\n")}\nPoint 9`);
    expect(
      screen.getByText("A list shows up to 8 points, so the last line isn't saved. Add another list for more."),
    ).toBeInTheDocument();
    expect(currentDeck().slides[0].columns[0].blocks[0]).toHaveProperty("items.length", 8);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("lets the image search be cleared completely", async () => {
    const image: Block = { id: "block_image", type: BlockType.Image, query: "team", alt: "Team", image: null };
    const { user, currentDeck } = renderEditor(deckWith(contentSlide("a", [image])));

    await user.click(screen.getByRole("tab", { name: "Slide settings" }));
    await user.clear(screen.getByLabelText("Image search"));

    expect(screen.getByLabelText("Image search")).toHaveValue("");
    expect(currentDeck().slides[0].columns[0].blocks[0]).toMatchObject({ query: "" });
    expect(screen.getByRole("button", { name: "Find image" })).toBeDisabled();
  });

  test("adds, replaces and deletes blocks from the toolbar on the slide", async () => {
    const { user, currentDeck } = renderEditor(deckWith(contentSlide("a", [bullets("list", ["Fast", "Cheap"])])));
    const blocks = () => currentDeck().slides[0].columns[0].blocks;
    const toolbar = () => within(screen.getByRole("toolbar", { name: "Block actions" }));

    await user.click(canvas().getByText("Fast"));
    await user.click(toolbar().getByRole("button", { name: "Replace bullet list with another block" }));
    await user.click(screen.getByRole("menuitem", { name: "Paragraph" }));
    expect(blocks()).toEqual([{ id: "list", type: BlockType.Paragraph, text: "Fast\nCheap" }]);

    await user.click(toolbar().getByRole("button", { name: "+ Add below" }));
    await user.click(screen.getByRole("menuitem", { name: "Table" }));
    expect(blocks().map((block) => block.type)).toEqual([BlockType.Paragraph, BlockType.Table]);

    // The new table is selected, so Delete removes it.
    await user.click(toolbar().getByRole("button", { name: "Delete" }));
    expect(blocks().map((block) => block.type)).toEqual([BlockType.Paragraph]);
  });

  test("asks before replacing a block whose content would be lost", async () => {
    const { user, currentDeck } = renderEditor(deckWith(contentSlide("a", [bullets("list", ["Fast"])])));

    await user.click(canvas().getByText("Fast"));
    const toolbar = within(screen.getByRole("toolbar", { name: "Block actions" }));
    await user.click(toolbar.getByRole("button", { name: "Replace bullet list with another block" }));
    await user.click(screen.getByRole("menuitem", { name: "Chart" }));
    expect(currentDeck().slides[0].columns[0].blocks[0]).toMatchObject({ type: BlockType.Bullets });

    await user.click(screen.getByRole("button", { name: "Replace" }));

    expect(currentDeck().slides[0].columns[0].blocks[0]).toMatchObject({ id: "list", type: BlockType.Chart });
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
