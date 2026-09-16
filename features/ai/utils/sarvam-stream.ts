import { z } from "zod";
import { readLines } from "./stream-protocol";

/*
 * Parsing of Sarvam's OpenAI-style streaming chat response. The shape was recorded from the
 * live API (see `testing/recordings/sarvam-tool-calls.sse`):
 * - every delta repeats all keys, with `null` for values that are absent;
 * - tool calls arrive as fragments sharing an `index`; only the first carries `id` and `name`;
 * - a last chunk has empty `choices` and carries `usage`, followed by `data: [DONE]`.
 */

const toolCallDeltaSchema = z.object({
  index: z.int().min(0),
  id: z.string().nullish(),
  function: z.object({ name: z.string().nullish(), arguments: z.string().nullish() }).nullish(),
});

const sarvamChunkSchema = z.object({
  choices: z.array(
    z.object({
      delta: z
        .object({
          content: z.string().nullish(),
          reasoning_content: z.string().nullish(),
          tool_calls: z.array(toolCallDeltaSchema).nullish(),
        })
        .nullish(),
      finish_reason: z.string().nullish(),
    }),
  ),
});

export type SarvamChunk = z.infer<typeof sarvamChunkSchema>;
type ToolCallDelta = z.infer<typeof toolCallDeltaSchema>;
export type AssembledToolCall = { id: string; name: string; arguments: string };

/**
 * Yields validated chunks until `data: [DONE]`. A stream that ends without `[DONE]` simply
 * stops yielding; callers detect that from the missing `finish_reason`. A malformed chunk
 * throws, because the rest of the response can no longer be trusted.
 */
export async function* readSarvamChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<SarvamChunk> {
  for await (const line of readLines(body)) {
    // Skips blank event separators, `:` comments and SSE fields other than data.
    if (!line.startsWith("data:")) continue;

    const data = line.slice("data:".length).trim();
    if (data === "[DONE]") return;

    let json: unknown;
    try {
      json = JSON.parse(data);
    } catch {
      throw new Error("The AI stream contained a chunk that is not valid JSON.");
    }
    const parsed = sarvamChunkSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`The AI stream contained an unexpected chunk: ${z.prettifyError(parsed.error)}`);
    }
    yield parsed.data;
  }
}

export type CompletionResult = { content: string; toolCalls: AssembledToolCall[]; finishReason: string | null };

/** Reads a whole streamed completion, for calls whose result is only used once it is complete. */
export async function collectCompletion(chunks: AsyncIterable<SarvamChunk>): Promise<CompletionResult> {
  const result: CompletionResult = { content: "", toolCalls: [], finishReason: null };
  for await (const chunk of chunks) {
    for (const { delta, finish_reason: finishReason } of chunk.choices) {
      if (delta?.tool_calls) result.toolCalls = mergeToolCallDeltas(result.toolCalls, delta.tool_calls);
      result.content += delta?.content ?? "";
      if (finishReason) result.finishReason = finishReason;
    }
  }
  return result;
}

/** Adds streamed fragments to the tool calls assembled so far, matching fragments by `index`. */
export function mergeToolCallDeltas(calls: AssembledToolCall[], deltas: ToolCallDelta[]): AssembledToolCall[] {
  const merged = [...calls];
  for (const delta of deltas) {
    while (merged.length <= delta.index) merged.push({ id: "", name: "", arguments: "" });
    const current = merged[delta.index];
    merged[delta.index] = {
      id: delta.id || current.id,
      name: current.name + (delta.function?.name ?? ""),
      arguments: current.arguments + (delta.function?.arguments ?? ""),
    };
  }
  return merged;
}
