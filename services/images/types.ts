import { z } from "zod";
import { LIMITS, resolvedImageSchema } from "@/features/deck/utils/schema";

export enum ImageSearchStatus {
  Found = "found",
  /** The search worked but nothing usable matched. */
  NotFound = "not_found",
  /** The image service could not be reached or refused the request; trying later may work. */
  Unavailable = "unavailable",
}

/** Result of an image search. Also the body of `POST /api/images/search`, validated in the browser. */
export const imageSearchResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal(ImageSearchStatus.Found), image: resolvedImageSchema }),
  z.object({ status: z.literal(ImageSearchStatus.NotFound) }),
  z.object({ status: z.literal(ImageSearchStatus.Unavailable) }),
]);

export type ImageSearchResult = z.infer<typeof imageSearchResultSchema>;

/** Body of `POST /api/images/search`. */
export const imageSearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(LIMITS.imageQuery),
});
