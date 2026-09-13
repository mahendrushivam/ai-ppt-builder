import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import type { Deck } from "@/features/deck/types";
import { bullets, contentSlide, deckWith } from "@/testing/fixtures";
import { mockSarvamRounds, sarvamSse } from "@/testing/msw/sarvam";
import { server } from "@/testing/msw/server";
import { AiErrorCode, AiPhase, type AiStreamEvent, AiStreamEventType } from "../../types";
import { runChatTurn } from "../agent";
import { SARVAM_CHAT_URL } from "../sarvam-client";
import { ChatToolName } from "../tools";

const sentMessagesSchema = z.object({
  messages: z.array(
    z.object({ role: z.string(), content: z.string().nullable(), tool_call_id: z.string().optional() }),
  ),
});

function sentMessages(request: unknown) {
  return sentMessagesSchema.parse(request).messages;
}

function reasoningEffort(request: unknown) {
  return z.object({ reasoning_effort: z.string().nullable() }).parse(request).reasoning_effort;
}

function eventsOfType<T extends AiStreamEventType>(events: AiStreamEvent[], type: T) {
  return events.filter((event): event is Extract<AiStreamEvent, { type: T }> => event.type === type);
}

async function runTurn(deck: Deck, message = "Shorten the title of slide 1") {
  const events: AiStreamEvent[] = [];
  await runChatTurn({
    deck,
    messages: [{ role: "user", content: message }],
    selectedSlideId: null,
    signal: new AbortController().signal,
    emit: (event) => events.push(event),
    retryDelayMs: 0,
  });
  return events;
}

function updateTitleRound(title: string, callId = "call_1") {
  return sarvamSse([
    { reasoning: "The user wants a shorter title." },
    {
      toolCall: { id: callId, name: ChatToolName.UpdateSlide, arguments: JSON.stringify({ slideId: "slide_a", title }) },
    },
    { finish: "tool_calls" },
  ]);
}

const deck = deckWith(contentSlide("slide_a", [bullets("block_1", ["Starter", "Pro"])]));

beforeEach(() => {
  vi.stubEnv("SARVAM_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("runChatTurn", () => {
  test("applies tool calls, feeds the results back and ends with the model's reply", async () => {
    const { requests } = mockSarvamRounds(
      updateTitleRound("Pricing"),
      sarvamSse([{ content: "Shortened the title of slide 1." }, { finish: "stop" }]),
    );

    const events = await runTurn(deck);

    expect(eventsOfType(events, AiStreamEventType.Operation)).toEqual([
      {
        type: AiStreamEventType.Operation,
        operation: { type: "slide.update", slideId: "slide_a", baseRevision: 0, patch: expect.objectContaining({ title: "Pricing" }) },
      },
    ]);
    expect(events).toContainEqual({ type: AiStreamEventType.Status, phase: AiPhase.Thinking });
    expect(events.slice(-2)).toEqual([
      { type: AiStreamEventType.Message, text: "Shortened the title of slide 1." },
      { type: AiStreamEventType.Done },
    ]);

    const secondRound = sentMessages(requests[1]);
    expect(secondRound).toContainEqual({ role: "tool", tool_call_id: "call_1", content: "Updated slide 1 (slide_a)." });
    expect(secondRound[0].content).toContain('title: "Pricing"');
    expect(requests.map(reasoningEffort)).toEqual(["low", null]);
  });

  test("does not apply a change that is already on the slide", async () => {
    const { requests } = mockSarvamRounds(
      updateTitleRound("Slide slide_a", "call_repeat"),
      sarvamSse([{ content: "The title was already right." }, { finish: "stop" }]),
    );

    const events = await runTurn(deck);

    expect(eventsOfType(events, AiStreamEventType.Operation)).toHaveLength(0);
    const feedback = sentMessages(requests[1]).find((message) => message.tool_call_id === "call_repeat");
    expect(feedback?.content).toMatch(/^Error: Nothing was changed/);
    expect(requests.map(reasoningEffort)).toEqual(["low", null]);
  });

  test("returns invalid tool arguments to the model so it can correct them", async () => {
    const { requests } = mockSarvamRounds(
      updateTitleRound("", "call_bad"),
      updateTitleRound("Pricing", "call_fixed"),
      sarvamSse([{ content: "Done." }, { finish: "stop" }]),
    );

    const events = await runTurn(deck);

    expect(eventsOfType(events, AiStreamEventType.Operation)).toHaveLength(1);
    const feedback = sentMessages(requests[1]).find((message) => message.tool_call_id === "call_bad");
    expect(feedback?.content).toMatch(/^Error: Invalid arguments/);
    expect(requests.map(reasoningEffort)).toEqual(["low", "low", null]);
  });

  test("never applies a tool call from a response that was cut off", async () => {
    mockSarvamRounds(
      sarvamSse([
        { toolCall: { id: "call_1", name: ChatToolName.UpdateSlide, arguments: '{"slideId": "slide_a", "title": "Pri' } },
        { finish: "length" },
      ]),
    );

    const events = await runTurn(deck);

    expect(eventsOfType(events, AiStreamEventType.Operation)).toHaveLength(0);
    expect(events.at(-1)).toMatchObject({
      type: AiStreamEventType.Error,
      code: AiErrorCode.IncompleteResponse,
      retryable: true,
    });
  });

  test("keeps applied changes and summarizes them when a later round is cut off", async () => {
    mockSarvamRounds(updateTitleRound("Pricing"), sarvamSse([{ reasoning: "Let me double-check…" }, { finish: "length" }]));

    const events = await runTurn(deck);

    expect(eventsOfType(events, AiStreamEventType.Operation)).toHaveLength(1);
    expect(events.slice(-3)).toEqual([
      expect.objectContaining({ type: AiStreamEventType.Warning }),
      { type: AiStreamEventType.Message, text: "Updated slide 1." },
      { type: AiStreamEventType.Done },
    ]);
  });

  test("refers to slides by number when the model's reply mentions slide ids", async () => {
    mockSarvamRounds(
      sarvamSse([{ content: "slide_0123456789ab is the intro; slide_ffffffffffff was removed." }, { finish: "stop" }]),
    );

    const events = await runTurn(deckWith(contentSlide("slide_0123456789ab")), "Which slide is the intro?");

    expect(events).toContainEqual({
      type: AiStreamEventType.Message,
      text: "slide 1 is the intro; a removed slide was removed.",
    });
  });

  test("streams the reply in whole words with slide ids replaced", async () => {
    mockSarvamRounds(
      sarvamSse([{ content: "Updated slide_0123" }, { content: "456789ab and " }, { content: "done." }, { finish: "stop" }]),
    );

    const events = await runTurn(deckWith(contentSlide("slide_0123456789ab")), "Update slide 1");

    const deltas = eventsOfType(events, AiStreamEventType.MessageDelta).map((event) => event.text);
    expect(deltas).toEqual(["Updated ", "slide 1 and ", "done."]);
    expect(events).toContainEqual({ type: AiStreamEventType.Status, phase: AiPhase.WritingReply });
    expect(events.slice(-2)).toEqual([
      { type: AiStreamEventType.Message, text: "Updated slide 1 and done." },
      { type: AiStreamEventType.Done },
    ]);
  });

  test("reports an empty response as a retryable error", async () => {
    mockSarvamRounds(sarvamSse([{ reasoning: "Hmm." }, { finish: "stop" }]));

    const events = await runTurn(deck);

    expect(events.at(-1)).toMatchObject({ type: AiStreamEventType.Error, code: AiErrorCode.EmptyResponse, retryable: true });
  });

  test("stops after the maximum number of rounds with a warning", async () => {
    const { requests } = mockSarvamRounds(...["One", "Two", "Three", "Four"].map((title) => updateTitleRound(title)));

    const events = await runTurn(deck);

    expect(requests).toHaveLength(4);
    expect(eventsOfType(events, AiStreamEventType.Operation)).toHaveLength(4);
    expect(events.slice(-2)).toEqual([
      expect.objectContaining({ type: AiStreamEventType.Warning }),
      { type: AiStreamEventType.Done },
    ]);
  });

  test("retries a rate-limited request before reporting it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let attempts = 0;
    server.use(
      http.post(SARVAM_CHAT_URL, () => {
        attempts++;
        return HttpResponse.json({ error: { message: "Too many requests", code: "rate_limit_exceeded_error" } }, { status: 429 });
      }),
    );

    const events = await runTurn(deck);

    expect(attempts).toBe(3);
    expect(events).toEqual([
      expect.objectContaining({ type: AiStreamEventType.Error, code: AiErrorCode.RateLimited, retryable: true }),
    ]);
  });
});
