import "server-only";
import { outlineSchema, slideInputSchema } from "@/features/ai/utils/slide-input";
import type { SarvamTool } from "../api/sarvam-client";
import { toToolParameters } from "./slide-tools";

/** Tools that deck generation forces the model to call, one call per request. */
export enum GenerationToolName {
  CreateOutline = "create_outline",
  CreateSlide = "create_slide",
}

export const OUTLINE_TOOL: SarvamTool = {
  type: "function",
  function: {
    name: GenerationToolName.CreateOutline,
    description: "Propose the outline of the presentation.",
    parameters: toToolParameters(outlineSchema),
  },
};

export const SLIDE_TOOL: SarvamTool = {
  type: "function",
  function: {
    name: GenerationToolName.CreateSlide,
    description: "Write the content of one slide.",
    parameters: toToolParameters(slideInputSchema),
  },
};
