import "server-only";
import { z } from "zod";
import { collectCompletion } from "@/features/ai/utils/sarvam-stream";
import { type SarvamMessage, type SarvamTool, streamCompletion } from "../api/sarvam-client";

const MAX_ATTEMPTS = 2;
/** Sarvam's output cap on the Starter plan. */
const MAX_TOKENS = 4096;

type ForcedToolCallOptions<S extends z.ZodType> = {
  messages: SarvamMessage[];
  tool: SarvamTool;
  /** Validates the tool arguments. */
  schema: S;
  /** Checks beyond the schema; returns a message for the model when the input doesn't fit. */
  validate?: (input: z.output<S>) => string | null;
  signal: AbortSignal;
  retryDelayMs?: number;
};

type ForcedToolCallResult<T> = { ok: true; input: T } | { ok: false; problem: string };

/**
 * Forces the model to call `tool` and validates the arguments. An invalid call is sent back
 * once with the validation error, so the model can correct it. Reasoning is off: with a forced
 * tool call it used up the output budget without calling the tool. Provider errors are thrown;
 * a result that stays invalid comes back as `problem`, which is meant for logs, not users.
 */
export async function requestToolInput<S extends z.ZodType>({
  messages,
  tool,
  schema,
  validate,
  signal,
  retryDelayMs,
}: ForcedToolCallOptions<S>): Promise<ForcedToolCallResult<z.output<S>>> {
  const conversation = [...messages];
  let problem = "The AI did not call the tool.";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const completion = await collectCompletion(
      streamCompletion({
        messages: conversation,
        tools: [tool],
        toolChoice: { name: tool.function.name },
        reasoning: "off",
        maxTokens: MAX_TOKENS,
        signal,
        retryDelayMs,
      }),
    );

    const call = completion.toolCalls.find((candidate) => candidate.name === tool.function.name);
    if (!call || completion.finishReason === null || completion.finishReason === "length") {
      // A missing or cut-off call has nothing to correct, so the same request is simply repeated.
      problem = completion.finishReason === "length" ? "The AI response was cut off." : "The AI did not call the tool.";
      continue;
    }

    const checked = checkInput(call.arguments, schema, validate);
    if (checked.ok) return checked;

    problem = checked.problem;
    const callId = call.id || `call_${attempt}`;
    conversation.push(
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: callId, type: "function", function: { name: call.name, arguments: call.arguments } }],
      },
      {
        role: "tool",
        tool_call_id: callId,
        content: `Error: ${problem}\nCall ${tool.function.name} again with corrected arguments.`,
      },
    );
  }

  return { ok: false, problem };
}

function checkInput<S extends z.ZodType>(
  rawArguments: string,
  schema: S,
  validate: ((input: z.output<S>) => string | null) | undefined,
): ForcedToolCallResult<z.output<S>> {
  let json: unknown;
  try {
    json = JSON.parse(rawArguments);
  } catch {
    return { ok: false, problem: "The arguments are not valid JSON." };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return { ok: false, problem: `Invalid arguments:\n${z.prettifyError(parsed.error)}` };
  const issue = validate?.(parsed.data) ?? null;
  return issue === null ? { ok: true, input: parsed.data } : { ok: false, problem: issue };
}
