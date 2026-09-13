import type { z } from "zod";
import type { chatEntrySchema } from "./services/chat-storage";
import type {
  blockInputSchema,
  columnInputSchema,
  slideInputSchema,
  slidePatchInputSchema,
} from "./utils/slide-input";
import type { aiStreamEventSchema, chatRequestSchema } from "./utils/stream-protocol";

/** Event types of the NDJSON stream from the AI routes to the browser, sent as `type`. */
export enum AiStreamEventType {
  Status = "status",
  Operation = "operation",
  MessageDelta = "message_delta",
  Message = "message",
  Warning = "warning",
  Error = "error",
  Done = "done",
}

/** What the AI is doing, sent in `status` events. The browser decides how to describe it. */
export enum AiPhase {
  Thinking = "thinking",
  UpdatingSlides = "updating_slides",
  ApplyingChanges = "applying_changes",
  WritingReply = "writing_reply",
}

/** Why an AI turn could not finish, sent in `error` events. */
export enum AiErrorCode {
  RateLimited = "rate_limited",
  AiUnavailable = "ai_unavailable",
  EmptyResponse = "empty_response",
  IncompleteResponse = "incomplete_response",
}

export type BlockInput = z.infer<typeof blockInputSchema>;
export type ColumnInput = z.infer<typeof columnInputSchema>;
export type SlideInput = z.infer<typeof slideInputSchema>;
export type SlidePatchInput = z.infer<typeof slidePatchInputSchema>;

export type AiStreamEvent = z.infer<typeof aiStreamEventSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatHistoryMessage = ChatRequest["messages"][number];
export type ChatEntry = z.infer<typeof chatEntrySchema>;
