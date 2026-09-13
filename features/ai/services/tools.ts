import "server-only";
import { z } from "zod";
import type { Deck, DeckOperation, Slide } from "@/features/deck/types";
import { applyOperation } from "@/features/deck/utils/operations";
import { slideLayoutSchema } from "@/features/deck/utils/schema";
import {
  columnInputSchema,
  materializeColumns,
  materializeSlide,
  materializeSlidePatch,
  slideInputSchema,
  slidePatchInputSchema,
} from "../utils/slide-input";
import type { SarvamTool } from "./sarvam-client";

/** Names of the tools the chat model can call. They appear in model requests and responses. */
export enum ChatToolName {
  AddSlide = "add_slide",
  UpdateSlide = "update_slide",
  DeleteSlide = "delete_slide",
  MoveSlide = "move_slide",
  ChangeLayout = "change_layout",
}

const slideIdArgument = z.string().min(1).max(64).describe("Id of an existing slide, as listed in the deck.");
const anchorArgument = z
  .string()
  .min(1)
  .max(64)
  .nullable()
  .describe("Id of the slide to place it after, or null to make it the first slide.");

/** Tool definitions. Parameter JSON Schemas are generated from these zod schemas. */
const TOOLS = {
  [ChatToolName.AddSlide]: {
    description: "Insert one new slide.",
    input: z.object({ afterSlideId: anchorArgument, slide: slideInputSchema }),
  },
  [ChatToolName.UpdateSlide]: {
    description:
      "Change fields of one slide. Include only the fields to change. `columns` replaces all of the slide's content, so send every block the slide should keep.",
    input: slidePatchInputSchema.extend({ slideId: slideIdArgument }),
  },
  [ChatToolName.DeleteSlide]: {
    description: "Delete one slide.",
    input: z.object({ slideId: slideIdArgument }),
  },
  [ChatToolName.MoveSlide]: {
    description: "Move one slide to a new position.",
    input: z.object({ slideId: slideIdArgument, afterSlideId: anchorArgument }),
  },
  [ChatToolName.ChangeLayout]: {
    description: "Change the layout of one slide.",
    input: z.object({
      slideId: slideIdArgument,
      layout: slideLayoutSchema,
      columns: z
        .array(columnInputSchema)
        .max(2)
        .optional()
        .describe("Content for the new layout. Omit to keep the existing blocks and redistribute them."),
    }),
  },
} satisfies Record<ChatToolName, { description: string; input: z.ZodType }>;

export const CHAT_TOOLS: SarvamTool[] = Object.entries(TOOLS).map(([name, tool]) => ({
  type: "function",
  function: { name, description: tool.description, parameters: toParameters(tool.input) },
}));

type ToolCallFailure = {
  ok: false;
  message: string;
  /** False when the call was valid but would change nothing, so the model has nothing to fix. */
  needsCorrection: boolean;
};

type ToolCallResult = { ok: true; deck: Deck; operation: DeckOperation; summary: string } | ToolCallFailure;

/**
 * Validates one tool call against the working deck and applies it. Failures come back as
 * messages written for the model, so it can correct the call in the next round.
 */
export function executeToolCall(deck: Deck, name: string, rawArguments: string): ToolCallResult {
  let args: unknown;
  try {
    args = rawArguments.trim() === "" ? {} : JSON.parse(rawArguments);
  } catch {
    return { ok: false, message: "The arguments are not valid JSON.", needsCorrection: true };
  }

  const planned = planOperation(deck, name, args);
  if (!planned.ok) return planned;

  const result = applyOperation(deck, planned.operation);
  if (!result.ok) return { ok: false, message: result.message, needsCorrection: true };
  return {
    ok: true,
    deck: result.deck,
    operation: planned.operation,
    summary: summarize(deck, result.deck, planned.operation),
  };
}

type PlannedOperation = { ok: true; operation: DeckOperation } | ToolCallFailure;

function planOperation(deck: Deck, name: string, args: unknown): PlannedOperation {
  switch (name) {
    case ChatToolName.AddSlide: {
      const input = parseArguments(TOOLS[ChatToolName.AddSlide].input, args);
      if (!input.ok) return input;
      const slide = materializeSlide(input.value.slide);
      return { ok: true, operation: { type: "slide.add", slide, afterSlideId: input.value.afterSlideId } };
    }
    case ChatToolName.UpdateSlide: {
      const input = parseArguments(TOOLS[ChatToolName.UpdateSlide].input, args);
      if (!input.ok) return input;
      const { slideId, ...changes } = input.value;
      const slide = findSlide(deck, slideId);
      if (!slide) return unknownSlide(slideId);
      const patch = materializeSlidePatch(changes, slide);
      if (Object.values(patch).every((value) => value === undefined)) {
        return unchanged(deck, slideId, "already has this content");
      }
      return { ok: true, operation: { type: "slide.update", slideId, baseRevision: slide.revision, patch } };
    }
    case ChatToolName.DeleteSlide: {
      const input = parseArguments(TOOLS[ChatToolName.DeleteSlide].input, args);
      if (!input.ok) return input;
      const slide = findSlide(deck, input.value.slideId);
      if (!slide) return unknownSlide(input.value.slideId);
      return { ok: true, operation: { type: "slide.delete", slideId: slide.id, baseRevision: slide.revision } };
    }
    case ChatToolName.MoveSlide: {
      const input = parseArguments(TOOLS[ChatToolName.MoveSlide].input, args);
      if (!input.ok) return input;
      const { slideId, afterSlideId } = input.value;
      const index = deck.slides.findIndex((slide) => slide.id === slideId);
      if (index === -1) return unknownSlide(slideId);
      const currentAnchor = index === 0 ? null : deck.slides[index - 1].id;
      if (currentAnchor === afterSlideId) return unchanged(deck, slideId, "is already in that position");
      return { ok: true, operation: { type: "slide.move", slideId, afterSlideId } };
    }
    case ChatToolName.ChangeLayout: {
      const input = parseArguments(TOOLS[ChatToolName.ChangeLayout].input, args);
      if (!input.ok) return input;
      const { slideId, layout, columns } = input.value;
      const slide = findSlide(deck, slideId);
      if (!slide) return unknownSlide(slideId);
      if (layout === slide.layout && columns === undefined) return unchanged(deck, slideId, "already uses that layout");
      return {
        ok: true,
        operation: {
          type: "slide.changeLayout",
          slideId,
          baseRevision: slide.revision,
          layout,
          columns: columns && materializeColumns(columns, slide),
        },
      };
    }
    default:
      return {
        ok: false,
        message: `Unknown tool "${name}". Use one of: ${Object.values(ChatToolName).join(", ")}.`,
        needsCorrection: true,
      };
  }
}

function parseArguments<T extends z.ZodType>(schema: T, args: unknown): { ok: true; value: z.output<T> } | ToolCallFailure {
  const parsed = schema.safeParse(args);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, message: `Invalid arguments:\n${z.prettifyError(parsed.error)}`, needsCorrection: true };
}

function findSlide(deck: Deck, slideId: string): Slide | undefined {
  return deck.slides.find((slide) => slide.id === slideId);
}

function unknownSlide(slideId: string): ToolCallFailure {
  return { ok: false, message: `Slide "${slideId}" does not exist. Use an id from the deck.`, needsCorrection: true };
}

/** A repeated change is reported instead of applied, so it can't bump revisions or add rounds. */
function unchanged(deck: Deck, slideId: string, reason: string): ToolCallFailure {
  return {
    ok: false,
    message: `Nothing was changed: ${describeSlide(deck, slideId)} ${reason}. Earlier successful changes in this request are still applied; don't repeat them.`,
    needsCorrection: false,
  };
}

/** Positions come from the deck after the change, except for a deleted slide. */
function summarize(before: Deck, after: Deck, operation: DeckOperation): string {
  switch (operation.type) {
    case "slide.add":
      return `Added ${describeSlide(after, operation.slide.id)}.`;
    case "slide.update":
      return `Updated ${describeSlide(after, operation.slideId)}.`;
    case "slide.changeLayout":
      return `Changed ${describeSlide(after, operation.slideId)} to the ${operation.layout} layout.`;
    case "slide.move":
      return `Moved the slide; it is now ${describeSlide(after, operation.slideId)}.`;
    case "slide.delete":
      return `Deleted ${describeSlide(before, operation.slideId)}.`;
    case "deck.rename":
    case "deck.setTheme":
      return "Updated the deck.";
  }
}

function describeSlide(deck: Deck, slideId: string): string {
  return `slide ${deck.slides.findIndex((slide) => slide.id === slideId) + 1} (${slideId})`;
}

function toParameters(schema: z.ZodType): Record<string, unknown> {
  const parameters: Record<string, unknown> = { ...z.toJSONSchema(schema, { io: "input", target: "draft-7" }) };
  // The provider only needs the schema itself, not the draft identifier.
  delete parameters.$schema;
  return parameters;
}
