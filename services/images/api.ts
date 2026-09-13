import { z } from "zod";
import { type ImageSearchResult, imageSearchResultSchema, ImageSearchStatus } from "./types";

/**
 * Searches for a stock image through the app's server, which calls Openverse. A response that
 * isn't a valid result counts as the service being unavailable. Network failures and aborts throw.
 */
export async function searchImage(query: string, signal: AbortSignal): Promise<ImageSearchResult> {
  const response = await fetch(new URL("/api/images/search", window.location.href), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal,
  });
  const body: unknown = await response.json().catch(() => null);
  const parsed = imageSearchResultSchema.safeParse(body);
  if (response.ok && parsed.success) return parsed.data;

  console.error(
    `Image search failed with ${response.status}:`,
    parsed.success ? body : z.prettifyError(parsed.error),
  );
  return { status: ImageSearchStatus.Unavailable };
}
