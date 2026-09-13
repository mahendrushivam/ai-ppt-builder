import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { Deck } from "@/features/deck/types";
import { contentSlide, deckWith } from "@/testing/fixtures";
import { seedDecks } from "@/testing/stores";
import { PrintDeck } from "../PrintDeck";

// jsdom can't draw an element into an image.
vi.mock("html-to-image", () => ({ toBlob: async () => new Blob(["png"], { type: "image/png" }) }));

function renderPrintView(deck: Deck) {
  seedDecks(deck);
  render(<PrintDeck deckId={deck.id} />);
  return userEvent.setup();
}

describe("PrintDeck", () => {
  test("shows every slide in order and prints once the slides are ready", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const user = renderPrintView(deckWith(contentSlide("a"), contentSlide("b")));

    expect(screen.getByRole("button", { name: "Preparing slides…" })).toBeDisabled();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Slide a",
      "Slide b",
    ]);

    await user.click(await screen.findByRole("button", { name: "Print or save as PDF" }));

    expect(print).toHaveBeenCalledOnce();
  });

  test("downloads one slide as a PNG named after the presentation", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const user = renderPrintView(deckWith(contentSlide("a"), contentSlide("b")));

    const download = screen.getByRole("button", { name: "Download slide 2 as PNG" });
    await waitFor(() => expect(download).toBeEnabled());
    await user.click(download);

    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(click.mock.contexts[0]).toHaveProperty("download", "test-deck-slide-2.png");
  });

  test("explains when the presentation does not exist", () => {
    seedDecks();

    render(<PrintDeck deckId="deck_missing" />);

    expect(screen.getByRole("heading", { name: "Presentation not found" })).toBeInTheDocument();
  });
});
