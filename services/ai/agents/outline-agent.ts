import "server-only";
import { AiErrorCode, type Outline, SlideVisual } from "@/features/ai/types";
import { outlineSchema } from "@/features/ai/utils/slide-input";
import { SLIDE_LAYOUTS } from "@/features/deck/utils/schema";
import { OUTLINE_TOOL } from "../tools/generation-tools";
import { type AiFailure, describeAiFailure } from "./errors";
import { requestToolInput } from "./forced-tool-call";

type CreateOutlineOptions = {
  prompt: string;
  slideCount: number;
  signal: AbortSignal;
  retryDelayMs?: number;
};

type CreateOutlineResult = { ok: true; outline: Outline } | { ok: false; failure: AiFailure };

/**
 * Drafts the outline the user reviews before any slide is generated: one forced tool call,
 * with one correction round when the outline is invalid or has the wrong number of slides.
 * Aborting `signal` throws.
 */
export async function createOutline({
  prompt,
  slideCount,
  signal,
  retryDelayMs,
}: CreateOutlineOptions): Promise<CreateOutlineResult> {
  try {
    const result = await requestToolInput({
      messages: [
        { role: "system", content: buildOutlinePrompt(slideCount) },
        { role: "user", content: prompt },
      ],
      tool: OUTLINE_TOOL,
      schema: outlineSchema,
      validate: (outline) =>
        outline.slides.length === slideCount
          ? null
          : `The outline must have exactly ${slideCount} slides, but it has ${outline.slides.length}.`,
      signal,
      retryDelayMs,
    });
    if (result.ok) return { ok: true, outline: result.input };

    console.error("The AI produced no valid outline:", result.problem);
    return {
      ok: false,
      failure: {
        code: AiErrorCode.IncompleteResponse,
        message: "The AI couldn't draft a usable outline. Try again or rephrase your request.",
        retryable: true,
      },
    };
  } catch (error) {
    if (signal.aborted) throw error;
    return { ok: false, failure: describeAiFailure(error) };
  }
}

function buildOutlinePrompt(slideCount: number): string {
  return [
    `You plan presentations. Call ${OUTLINE_TOOL.function.name} with an outline of exactly ${slideCount} slides for the user's request.`,
    "",
    "Rules:",
    '- Slide 1 uses the "title" layout. Use "section" only to introduce a major part of a longer deck.',
    '- Use "content" for one list or paragraph, "two-column" for two related lists and "comparison" for contrasting options.',
    "- Give title and section slides no key points. Give other slides 2 to 5 key points of under 12 words each.",
    '- visual: "table" for structured comparisons, "chart" for numbers over time or shares, "image" where a photo helps, otherwise "none".',
    `- Layouts: ${SLIDE_LAYOUTS.join(", ")}. Visuals: ${Object.values(SlideVisual).join(", ")}.`,
    "- Keep titles short and specific. Write in the language of the request.",
  ].join("\n");
}
