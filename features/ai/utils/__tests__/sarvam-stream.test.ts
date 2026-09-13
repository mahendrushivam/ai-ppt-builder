import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { type AssembledToolCall, collectCompletion, mergeToolCallDeltas, readSarvamChunks } from "../sarvam-stream";

// Vitest runs from the project root.
const recording = readFileSync(join(process.cwd(), "testing/recordings/sarvam-tool-calls.sse"), "utf8");

function streamOf(text: string, chunkSize = 97): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      for (let start = 0; start < bytes.length; start += chunkSize) {
        controller.enqueue(bytes.slice(start, start + chunkSize));
      }
      controller.close();
    },
  });
}

describe("readSarvamChunks", () => {
  test("assembles parallel tool calls from a recorded Sarvam stream", async () => {
    let calls: AssembledToolCall[] = [];
    let content = "";
    const finishReasons: string[] = [];

    for await (const chunk of readSarvamChunks(streamOf(recording))) {
      for (const choice of chunk.choices) {
        if (choice.delta?.tool_calls) calls = mergeToolCallDeltas(calls, choice.delta.tool_calls);
        content += choice.delta?.content ?? "";
        if (choice.finish_reason) finishReasons.push(choice.finish_reason);
      }
    }

    expect(calls.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "call_d8a6664d93274eca88e9c1a6", name: "update_slide" },
      { id: "call_060ae3de581f4bbf8f268e51", name: "add_slide" },
    ]);
    expect(calls.map((call) => JSON.parse(call.arguments))).toEqual([
      { slideId: "slide_a", title: "Pricing Plans" },
      { afterSlideId: "slide_a", title: "FAQ" },
    ]);
    expect(finishReasons).toEqual(["tool_calls"]);
    expect(content.trim()).toBe("");
  });

  test("stops at [DONE] and ignores comments and blank lines", async () => {
    const chunk = JSON.stringify({ choices: [{ delta: { content: "Hi" }, finish_reason: null }] });
    const text = `: keep-alive\n\ndata: ${chunk}\n\ndata: [DONE]\n\ndata: ${chunk}\n\n`;

    const chunks = [];
    for await (const parsed of readSarvamChunks(streamOf(text, 5))) chunks.push(parsed);

    expect(chunks).toHaveLength(1);
  });

  test("throws when a chunk is not valid JSON", async () => {
    const consume = async () => {
      for await (const chunk of readSarvamChunks(streamOf('data: {"choices": [\n\n'))) void chunk;
    };

    await expect(consume()).rejects.toThrow("not valid JSON");
  });
});

describe("collectCompletion", () => {
  test("collects the tool calls and finish reason of a recorded stream", async () => {
    const completion = await collectCompletion(readSarvamChunks(streamOf(recording)));

    expect(completion.toolCalls.map((call) => call.name)).toEqual(["update_slide", "add_slide"]);
    expect(completion.finishReason).toBe("tool_calls");
  });
});
