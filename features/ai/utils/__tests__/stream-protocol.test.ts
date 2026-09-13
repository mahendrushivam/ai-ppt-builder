import { describe, expect, test } from "vitest";
import { AiPhase, type AiStreamEvent, AiStreamEventType } from "../../types";
import { encodeStreamEvent, readLines, readStreamEvents } from "../stream-protocol";

function streamOf(chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
      controller.close();
    },
  });
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}

describe("readStreamEvents", () => {
  test("reads events whose lines are split across chunks", async () => {
    const events: AiStreamEvent[] = [
      { type: AiStreamEventType.Status, phase: AiPhase.UpdatingSlides },
      { type: AiStreamEventType.Message, text: "Shortened the title of slide 1." },
      { type: AiStreamEventType.Done },
    ];
    const text = events.map(encodeStreamEvent).join("");
    const chunks = [text.slice(0, 7), text.slice(7, 50), text.slice(50)];

    const lines = await collect(readStreamEvents(streamOf(chunks)));

    expect(lines).toEqual(events.map((event) => ({ ok: true, event })));
  });

  test("reports invalid lines and keeps reading", async () => {
    const body = streamOf([
      "not json\n",
      '{"type":"launch_rockets"}\n',
      "\n",
      encodeStreamEvent({ type: AiStreamEventType.Done }),
    ]);

    const lines = await collect(readStreamEvents(body));

    expect(lines.map((line) => line.ok)).toEqual([false, false, true]);
    expect(lines[0]).toMatchObject({ ok: false, line: "not json" });
  });
});

describe("readLines", () => {
  test("keeps a multi-byte character split between chunks and yields a final unterminated line", async () => {
    const bytes = new TextEncoder().encode("Slide “one”\nlast");
    const splitInsideQuote = 7;

    const lines = await collect(readLines(streamOf([bytes.slice(0, splitInsideQuote), bytes.slice(splitInsideQuote)])));

    expect(lines).toEqual(["Slide “one”", "last"]);
  });
});
