import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import type { Deck } from "@/features/deck/types";
import { useDecksStore } from "@/features/decks/hooks/use-decks-store";
import { contentSlide, deckWith } from "@/testing/fixtures";
import { mockChatRoute, mockOpenChatStream } from "@/testing/msw/ai-routes";
import { seedDecks } from "@/testing/stores";
import { AiErrorCode, AiPhase, type AiStreamEvent, AiStreamEventType } from "../../types";
import { ChatPanel } from "../ChatPanel";

function renderChat(deck: Deck) {
  seedDecks(deck);
  const user = userEvent.setup();
  const { unmount } = render(<ChatPanel deckId={deck.id} selectedSlideId={null} />);

  async function sendMessage(text: string) {
    await user.type(screen.getByLabelText("Message to the AI"), text);
    await user.click(screen.getByRole("button", { name: "Send" }));
  }

  return { user, sendMessage, unmount, currentDeck: () => useDecksStore.getState().decks[0] };
}

const updateTitle: AiStreamEvent = {
  type: AiStreamEventType.Operation,
  operation: { type: "slide.update", slideId: "slide_a", baseRevision: 0, patch: { title: "Pricing" } },
};

const done: AiStreamEvent = { type: AiStreamEventType.Done };

function reply(text: string): AiStreamEvent {
  return { type: AiStreamEventType.Message, text };
}

describe("ChatPanel", () => {
  test("sends the deck with the message and applies streamed changes to the slides", async () => {
    const deck = deckWith(contentSlide("slide_a"));
    const { requests } = mockChatRoute([
      { type: AiStreamEventType.Status, phase: AiPhase.UpdatingSlides },
      updateTitle,
      reply("Shortened the title of slide 1."),
      done,
    ]);
    const { sendMessage, currentDeck } = renderChat(deck);

    await sendMessage("Shorten slide 1");

    expect(await screen.findByText("Shortened the title of slide 1.")).toBeInTheDocument();
    expect(currentDeck().slides[0].title).toBe("Pricing");
    expect(requests[0]).toMatchObject({
      deck: { id: deck.id },
      messages: [{ role: "user", content: "Shorten slide 1" }],
      selectedSlideId: null,
    });
    expect(screen.getByLabelText("Message to the AI")).toHaveValue("");
  });

  test("restores the conversation when the chat is opened again", async () => {
    const deck = deckWith(contentSlide("slide_a"));
    mockChatRoute([reply("Slide 1 is about pricing."), done]);
    const { sendMessage, unmount } = renderChat(deck);
    await sendMessage("What is slide 1 about?");
    await screen.findByText("Slide 1 is about pricing.");

    unmount();
    render(<ChatPanel deckId={deck.id} selectedSlideId={null} />);

    expect(screen.getByText("What is slide 1 about?")).toBeInTheDocument();
    expect(screen.getByText("Slide 1 is about pricing.")).toBeInTheDocument();
  });

  test("skips a change to a slide the user edited while the AI was working", async () => {
    const editedDuringTurn = contentSlide("slide_a", [], 1);
    mockChatRoute([updateTitle, reply("Updated slide 1."), done]);
    const { sendMessage, currentDeck } = renderChat(deckWith(editedDuringTurn));

    await sendMessage("Shorten slide 1");

    expect(await screen.findByText(/Skipped a change to slide 1 because you edited it/)).toBeInTheDocument();
    expect(currentDeck().slides[0].title).toBe(editedDuringTurn.title);
  });

  test("shows a failed turn and retries the same message", async () => {
    const { requests } = mockChatRoute(
      [
        {
          type: AiStreamEventType.Error,
          code: AiErrorCode.RateLimited,
          message: "The AI is busy right now.",
          retryable: true,
        },
      ],
      [reply("Here you go."), done],
    );
    const { user, sendMessage } = renderChat(deckWith(contentSlide("slide_a")));

    await sendMessage("Shorten slide 1");
    expect(await screen.findByRole("alert")).toHaveTextContent("The AI is busy right now.");
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Here you go.")).toBeInTheDocument();
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({ messages: [{ role: "user", content: "Shorten slide 1" }] });
    expect(screen.getAllByText("Shorten slide 1")).toHaveLength(1);
  });

  test("keeps received changes and offers a retry when the stream ends early", async () => {
    mockChatRoute([{ type: AiStreamEventType.Status, phase: AiPhase.UpdatingSlides }, updateTitle]);
    const { sendMessage, currentDeck } = renderChat(deckWith(contentSlide("slide_a")));

    await sendMessage("Shorten slide 1");

    expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost. Changes received so far were kept.");
    expect(currentDeck().slides[0].title).toBe("Pricing");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  test("shows the reply while the AI is writing it", async () => {
    const stream = mockOpenChatStream({ type: AiStreamEventType.MessageDelta, text: "Shortened the " });
    const { sendMessage } = renderChat(deckWith(contentSlide("slide_a")));

    await sendMessage("Shorten slide 1");
    expect(await screen.findByText("Shortened the")).toBeInTheDocument();

    stream.send(reply("Shortened the title of slide 1."), done);
    stream.close();

    expect(await screen.findByText("Shortened the title of slide 1.")).toBeInTheDocument();
    expect(screen.queryByText("Shortened the")).not.toBeInTheDocument();
  });

  test("stops a running turn and keeps the reply written so far", async () => {
    mockOpenChatStream(
      { type: AiStreamEventType.Status, phase: AiPhase.WritingReply },
      { type: AiStreamEventType.MessageDelta, text: "Half a reply" },
    );
    const { user, sendMessage } = renderChat(deckWith(contentSlide("slide_a")));

    await sendMessage("Shorten slide 1");
    expect(await screen.findByText("Writing reply…")).toBeInTheDocument();
    await screen.findByText("Half a reply");
    await user.click(screen.getByRole("button", { name: "Stop" }));

    expect(await screen.findByText("Stopped. Changes made before stopping were kept.")).toBeInTheDocument();
    expect(screen.getByText("Half a reply")).toBeInTheDocument();
  });
});
