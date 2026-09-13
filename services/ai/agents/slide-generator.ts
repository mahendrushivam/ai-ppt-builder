import "server-only";
import {
  type AiStreamEvent,
  AiStreamEventType,
  type GenerateRequest,
  type Outline,
  type OutlineItem,
  SlideGenerationStatus,
  type SlideInput,
  SlideVisual,
} from "@/features/ai/types";
import { materializeSlide, slideInputSchema } from "@/features/ai/utils/slide-input";
import { BlockType, type Slide } from "@/features/deck/types";
import { type FindImage, findImage as findOpenverseImage, resolveColumnImages } from "@/services/images/openverse";
import { LAYOUT_COLUMN_COUNT, LIMITS } from "@/features/deck/utils/schema";
import type { SarvamMessage } from "../api/sarvam-client";
import { SLIDE_TOOL } from "../tools/generation-tools";
import { describeAiFailure } from "./errors";
import { requestToolInput } from "./forced-tool-call";

type GenerateSlidesOptions = GenerateRequest & {
  signal: AbortSignal;
  emit: (event: AiStreamEvent) => void;
  retryDelayMs?: number;
  /** Image search for image blocks in generated slides. */
  findImage?: FindImage;
};

/**
 * Generates outline items one at a time, in order, each with the full outline as context so
 * the slides stay coherent. Every finished slide is emitted as a `slide.add` operation right
 * away: the first goes after `afterSlideId`, each next one after the previous generated slide.
 *
 * A slide that stays invalid after one correction is reported as failed and skipped, keeping
 * the others. A provider error ends the run with `error`; aborting ends it without events.
 */
export async function generateSlides({
  prompt,
  outline,
  outlineIndexes,
  afterSlideId,
  signal,
  emit,
  retryDelayMs,
  findImage = findOpenverseImage,
}: GenerateSlidesOptions): Promise<void> {
  let anchor = afterSlideId;

  for (const outlineIndex of outlineIndexes) {
    emit({ type: AiStreamEventType.SlideProgress, outlineIndex, status: SlideGenerationStatus.Generating });

    let result: Awaited<ReturnType<typeof requestSlide>>;
    try {
      result = await requestSlide(prompt, outline, outlineIndex, signal, retryDelayMs);
    } catch (error) {
      if (signal.aborted) return;
      emit({ type: AiStreamEventType.Error, ...describeAiFailure(error) });
      return;
    }

    if (!result.ok) {
      console.error(`Outline item ${outlineIndex + 1} could not be generated:`, result.problem);
      emit({
        type: AiStreamEventType.SlideProgress,
        outlineIndex,
        status: SlideGenerationStatus.Failed,
        message: "This slide couldn't be generated. Retry it, or add it by hand.",
      });
      continue;
    }

    let slide: Slide;
    try {
      const materialized = materializeSlide(result.input);
      slide = { ...materialized, columns: await resolveColumnImages(materialized.columns, findImage, signal) };
    } catch (error) {
      // Image searches only throw when the request was aborted.
      if (signal.aborted) return;
      throw error;
    }
    emit({ type: AiStreamEventType.Operation, operation: { type: "slide.add", slide, afterSlideId: anchor } });
    emit({
      type: AiStreamEventType.SlideProgress,
      outlineIndex,
      status: SlideGenerationStatus.Done,
      slideId: slide.id,
    });
    anchor = slide.id;
  }

  emit({ type: AiStreamEventType.Done });
}

function requestSlide(
  prompt: string,
  outline: Outline,
  outlineIndex: number,
  signal: AbortSignal,
  retryDelayMs: number | undefined,
) {
  const item = outline.slides[outlineIndex];
  return requestToolInput({
    messages: buildSlideMessages(prompt, outline, outlineIndex),
    tool: SLIDE_TOOL,
    schema: slideInputSchema,
    validate: (slide) => checkAgainstOutline(slide, item),
    signal,
    retryDelayMs,
  });
}

const VISUAL_BLOCK_TYPES: Record<SlideVisual, BlockType | null> = {
  [SlideVisual.None]: null,
  [SlideVisual.Image]: BlockType.Image,
  [SlideVisual.Chart]: BlockType.Chart,
  [SlideVisual.Table]: BlockType.Table,
};

/** Checks what the schema can't: the slide uses the outline's layout and includes its planned visual. */
function checkAgainstOutline(slide: SlideInput, item: OutlineItem): string | null {
  if (slide.layout !== item.layout) {
    return `Use the "${item.layout}" layout from the outline, not "${slide.layout}".`;
  }
  const blockType = VISUAL_BLOCK_TYPES[item.visual];
  // Title and section slides have no columns that could hold a visual.
  if (blockType === null || LAYOUT_COLUMN_COUNT[item.layout] === 0) return null;
  const hasVisual = slide.columns.some((column) => column.blocks.some((block) => block.type === blockType));
  return hasVisual ? null : `The outline plans a ${item.visual} for this slide. Add a ${blockType} block.`;
}

function buildSlideMessages(prompt: string, outline: Outline, outlineIndex: number): SarvamMessage[] {
  const item = outline.slides[outlineIndex];
  const plan = outline.slides.map(
    (slide, index) => `${index + 1}. [${slide.layout}] ${JSON.stringify(slide.title)}${describeOutlineItem(slide)}`,
  );

  const system = [
    `You write one slide of a presentation at a time by calling ${SLIDE_TOOL.function.name}.`,
    `The user's request: ${JSON.stringify(prompt)}`,
    `Presentation title: ${JSON.stringify(outline.deckTitle)}`,
    "Outline of the whole presentation, for context:",
    ...plan,
    "",
    "Rules:",
    "- Write only the requested slide, with the layout and title from the outline. Don't repeat content that belongs on other slides.",
    '- "title" and "section" slides have no columns, "content" has 1 column, "two-column" and "comparison" have 2 (comparison columns get short headings).',
    `- Plain text without markdown. At most ${LIMITS.bulletsPerBlock} bullets per block and ${LIMITS.blocksPerColumn} blocks per column. Keep bullets under 15 words.`,
    '- Visuals: for "table" add a table block. For "chart" add a chart block of the type that fits the data (the chartType description says how each type reads the series), using clearly illustrative numbers unless the request gave data, and say so in the speaker notes. For "image" add an image block with a short stock-photo search query and alt text.',
    "- Add 1 to 3 sentences of speaker notes.",
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: `Write slide ${outlineIndex + 1}: ${JSON.stringify(item.title)}${describeOutlineItem(item)}` },
  ];
}

function describeOutlineItem(item: OutlineItem): string {
  const keyPoints = item.keyPoints.length > 0 ? ` - key points: ${item.keyPoints.join("; ")}` : "";
  const visual = item.visual === SlideVisual.None ? "" : ` (visual: ${item.visual})`;
  return `${keyPoints}${visual}`;
}
