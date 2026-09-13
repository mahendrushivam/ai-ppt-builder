import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import {
  AiErrorCode,
  type AiStreamEvent,
  AiStreamEventType,
  type Outline,
  SlideGenerationStatus,
  SlideVisual,
} from "@/features/ai/types";
import type { Slide } from "@/features/deck/types";
import { useDecksStore } from "@/features/decks/hooks/use-decks-store";
import { contentSlide, deckWith } from "@/testing/fixtures";
import { mockGenerateRoute, mockOutlineRoute } from "@/testing/msw/ai-routes";
import { seedDecks } from "@/testing/stores";
import { DeckEditor } from "../DeckEditor";

type User = ReturnType<typeof userEvent.setup>;

const outline: Outline = {
  deckTitle: "Q3 Roadmap",
  slides: [
    { title: "Q3 Roadmap", layout: "title", keyPoints: [], visual: SlideVisual.None },
    { title: "Pricing", layout: "content", keyPoints: ["Starter", "Pro"], visual: SlideVisual.None },
  ],
};

function renderEmptyEditor() {
  const deck = deckWith();
  seedDecks(deck);
  const user = userEvent.setup();
  render(<DeckEditor deckId={deck.id} />);
  return { user, currentDeck: () => useDecksStore.getState().decks[0] };
}

async function draftOutline(user: User, prompt = "Our Q3 roadmap") {
  await user.type(screen.getByLabelText("What is the presentation about?"), prompt);
  await user.selectOptions(screen.getByLabelText("Number of slides"), "3");
  await user.click(screen.getByRole("button", { name: "Draft outline" }));
}

function slideTitled(id: string, title: string): Slide {
  return { ...contentSlide(id), title };
}

function progress(
  outlineIndex: number,
  status: SlideGenerationStatus.Generating | SlideGenerationStatus.Done,
  slideId?: string,
): AiStreamEvent {
  return { type: AiStreamEventType.SlideProgress, outlineIndex, status, slideId };
}

function added(slide: Slide, afterSlideId: string | null): AiStreamEvent {
  return { type: AiStreamEventType.Operation, operation: { type: "slide.add", slide, afterSlideId } };
}

const done: AiStreamEvent = { type: AiStreamEventType.Done };

describe("generating a deck from a prompt", () => {
  test("drafts an outline, applies the user's edits and adds the generated slides in order", async () => {
    const { requests: outlineRequests } = mockOutlineRoute({ outline });
    const { requests } = mockGenerateRoute([
      progress(0, SlideGenerationStatus.Generating),
      added(slideTitled("slide_one", "Q3 Roadmap"), null),
      progress(0, SlideGenerationStatus.Done, "slide_one"),
      progress(1, SlideGenerationStatus.Generating),
      added(slideTitled("slide_two", "Pricing plans"), "slide_one"),
      progress(1, SlideGenerationStatus.Done, "slide_two"),
      done,
    ]);
    const { user, currentDeck } = renderEmptyEditor();

    await draftOutline(user);
    expect(await screen.findByRole("heading", { name: "Review the outline" })).toBeInTheDocument();
    const secondTitle = screen.getAllByLabelText("Title")[1];
    await user.clear(secondTitle);
    await user.type(secondTitle, "Pricing plans");
    await user.click(screen.getByRole("button", { name: "Generate 2 slides" }));

    expect(await screen.findByText("Generated 2 slides")).toBeInTheDocument();
    expect(outlineRequests[0]).toEqual({ prompt: "Our Q3 roadmap", slideCount: 3 });
    expect(requests[0]).toMatchObject({
      prompt: "Our Q3 roadmap",
      outlineIndexes: [0, 1],
      afterSlideId: null,
      outline: { slides: [{ title: "Q3 Roadmap" }, { title: "Pricing plans" }] },
    });
    expect(currentDeck().title).toBe("Q3 Roadmap");
    expect(currentDeck().slides.map((slide) => slide.title)).toEqual(["Q3 Roadmap", "Pricing plans"]);
  });

  test("retries a slide that failed without regenerating the others", async () => {
    mockOutlineRoute({ outline });
    const { requests } = mockGenerateRoute(
      [
        progress(0, SlideGenerationStatus.Generating),
        added(slideTitled("slide_one", "Q3 Roadmap"), null),
        progress(0, SlideGenerationStatus.Done, "slide_one"),
        progress(1, SlideGenerationStatus.Generating),
        {
          type: AiStreamEventType.SlideProgress,
          outlineIndex: 1,
          status: SlideGenerationStatus.Failed,
          message: "This slide couldn't be generated.",
        },
        done,
      ],
      [
        progress(1, SlideGenerationStatus.Generating),
        added(slideTitled("slide_two", "Pricing"), "slide_one"),
        progress(1, SlideGenerationStatus.Done, "slide_two"),
        done,
      ],
    );
    const { user, currentDeck } = renderEmptyEditor();

    await draftOutline(user);
    await user.click(await screen.findByRole("button", { name: "Generate 2 slides" }));
    expect(await screen.findByText("Generated 1 of 2 slides. 1 failed.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry slide 2" }));

    expect(await screen.findByText("Generated 2 slides")).toBeInTheDocument();
    expect(requests[1]).toMatchObject({ outlineIndexes: [1], afterSlideId: "slide_one" });
    expect(currentDeck().slides.map((slide) => slide.id)).toEqual(["slide_one", "slide_two"]);
  });

  test("explains why an outline couldn't be drafted and keeps the prompt", async () => {
    mockOutlineRoute({
      error: { code: AiErrorCode.RateLimited, message: "The AI is busy right now.", retryable: true },
    });
    const { user } = renderEmptyEditor();

    await draftOutline(user, "Team offsite agenda");

    expect(await screen.findByRole("alert")).toHaveTextContent("The AI is busy right now.");
    expect(screen.getByLabelText("What is the presentation about?")).toHaveValue("Team offsite agenda");
  });
});
