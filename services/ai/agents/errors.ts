import "server-only";
import { AiErrorCode } from "@/features/ai/types";
import { SarvamError, SarvamErrorKind } from "../api/sarvam-client";

export type AiFailure = { code: AiErrorCode; message: string; retryable: boolean };

/** Turns a failed AI request into a message that is safe to show. Unexpected errors are logged. */
export function describeAiFailure(error: unknown): AiFailure {
  if (error instanceof SarvamError) {
    switch (error.kind) {
      case SarvamErrorKind.RateLimited:
        return {
          code: AiErrorCode.RateLimited,
          message: "The AI is busy right now. Wait a moment and try again.",
          retryable: true,
        };
      case SarvamErrorKind.Unavailable:
        return {
          code: AiErrorCode.AiUnavailable,
          message: "The AI service is unavailable. Try again in a moment.",
          retryable: true,
        };
      case SarvamErrorKind.Rejected:
        return {
          code: AiErrorCode.AiUnavailable,
          message: "The AI service couldn't process this request.",
          retryable: false,
        };
    }
  }
  console.error("AI request failed:", error);
  return {
    code: AiErrorCode.AiUnavailable,
    message: "Something went wrong while talking to the AI. Try again.",
    retryable: true,
  };
}
