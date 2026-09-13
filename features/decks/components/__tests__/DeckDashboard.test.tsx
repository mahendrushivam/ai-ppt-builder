import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { contentSlide, deckWith } from "@/testing/fixtures";
import { routerMock } from "@/testing/mocks/next-navigation";
import { useDecksStore } from "../../hooks/use-decks-store";
import { DECKS_STORAGE_KEY, loadDecks, saveDecks } from "../../services/deck-storage";
import { DeckDashboard } from "../DeckDashboard";
import { DeckPersistence } from "../DeckPersistence";

vi.mock("next/navigation", () => import("@/testing/mocks/next-navigation"));

function renderDashboard() {
  const user = userEvent.setup();
  render(
    <>
      <DeckPersistence />
      <DeckDashboard />
    </>,
  );
  return { user };
}

function saveDeckTitled(title: string) {
  const deck = { ...deckWith(contentSlide("a")), title };
  saveDecks([deck]);
  return deck;
}

describe("DeckDashboard", () => {
  test("lists presentations saved in browser storage", async () => {
    const deck = saveDeckTitled("Q3 Roadmap");

    renderDashboard();

    expect(await screen.findByRole("link", { name: "Q3 Roadmap" })).toHaveAttribute("href", `/decks/${deck.id}`);
    expect(screen.getByText(/^1 slide ·/)).toBeInTheDocument();
  });

  test("creates a presentation from the empty state, opens it and saves it", async () => {
    const { user } = renderDashboard();

    expect(await screen.findByRole("heading", { name: "No presentations yet" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create your first presentation" }));

    const [created] = useDecksStore.getState().decks;
    expect(routerMock.push).toHaveBeenCalledWith(`/decks/${created.id}`);
    await waitFor(() => expect(loadDecks().decks.map((deck) => deck.id)).toEqual([created.id]));
  });

  test("renames a presentation", async () => {
    saveDeckTitled("Q3 Roadmap");
    const { user } = renderDashboard();

    await user.click(await screen.findByRole("button", { name: "Rename Q3 Roadmap" }));
    const titleField = screen.getByRole("textbox", { name: "Presentation title" });
    await user.clear(titleField);
    await user.type(titleField, "Q4 Plan{Enter}");

    expect(screen.getByRole("link", { name: "Q4 Plan" })).toBeInTheDocument();
  });

  test("deletes a presentation only after confirmation", async () => {
    saveDeckTitled("Q3 Roadmap");
    const { user } = renderDashboard();

    await user.click(await screen.findByRole("button", { name: "Delete Q3 Roadmap" }));
    await user.click(within(screen.getByRole("dialog", { name: "Delete presentation?" })).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("link", { name: "Q3 Roadmap" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete Q3 Roadmap" }));
    await user.click(screen.getByRole("button", { name: "Delete presentation" }));

    expect(screen.getByRole("heading", { name: "No presentations yet" })).toBeInTheDocument();
  });

  test("warns when saved data could not be read", async () => {
    localStorage.setItem(DECKS_STORAGE_KEY, "{broken");

    renderDashboard();

    expect(await screen.findByRole("status")).toHaveTextContent("could not be read");
  });
});
