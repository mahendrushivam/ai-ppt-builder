import "server-only";
import { z } from "zod";
import { type Block, BlockType, type Column, type ResolvedImage } from "@/features/deck/types";
import { LIMITS, resolvedImageSchema } from "@/features/deck/utils/schema";
import { type ImageSearchResult, ImageSearchStatus } from "./types";

export const OPENVERSE_IMAGES_URL = "https://api.openverse.org/v1/images/";
const REQUEST_TIMEOUT_MS = 8000;
const MAX_CACHED_SEARCHES = 500;

const openverseResponseSchema = z.object({
  results: z.array(
    z.object({
      url: z.string(),
      width: z.number().nullish(),
      height: z.number().nullish(),
      attribution: z.string().nullish(),
      foreign_landing_url: z.string().nullish(),
    }),
  ),
});

type OpenverseResult = z.infer<typeof openverseResponseSchema>["results"][number];

/**
 * Completed searches by normalized query, kept for the life of the server process. Openverse
 * allows 20 anonymous requests a minute and 200 a day, and decks often repeat a query.
 * Failed searches are not kept, so they are tried again next time.
 */
const completedSearches = new Map<string, ImageSearchResult>();

export type FindImage = (query: string, signal: AbortSignal) => Promise<ImageSearchResult>;

/**
 * Finds a stock photo for a search query on Openverse. Only licenses that allow commercial use
 * and changes are searched, because slides crop images; Openverse's attribution text is kept
 * with the image. Failures come back as `Unavailable`; only an aborted `signal` throws.
 */
export async function findImage(query: string, signal: AbortSignal): Promise<ImageSearchResult> {
  const normalizedQuery = query.trim().toLowerCase();
  const completed = completedSearches.get(normalizedQuery);
  if (completed) return completed;

  const url = new URL(OPENVERSE_IMAGES_URL);
  url.search = new URLSearchParams({
    q: normalizedQuery,
    page_size: "10",
    mature: "false",
    license_type: "commercial,modification",
  }).toString();

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
    });
  } catch (error) {
    signal.throwIfAborted();
    console.error("Openverse image search failed:", error);
    return { status: ImageSearchStatus.Unavailable };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`Openverse image search failed with ${response.status}:`, detail.slice(0, 300));
    return { status: ImageSearchStatus.Unavailable };
  }

  const parsed = openverseResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    console.error("Openverse returned an unexpected response:", z.prettifyError(parsed.error));
    return { status: ImageSearchStatus.Unavailable };
  }

  const image = parsed.data.results.map(toResolvedImage).find((candidate) => candidate !== null);
  const result: ImageSearchResult = image
    ? { status: ImageSearchStatus.Found, image }
    : { status: ImageSearchStatus.NotFound };
  remember(normalizedQuery, result);
  return result;
}

/**
 * Fills in images for image blocks that don't have one yet, one search at a time so a deck
 * doesn't burst through the rate limit. Blocks without a match keep their placeholder.
 * Returns the same columns when there is nothing to look up.
 */
export async function resolveColumnImages(columns: Column[], find: FindImage, signal: AbortSignal): Promise<Column[]> {
  // A block without a search yet has nothing to look up.
  const needsImage = (block: Block) =>
    block.type === BlockType.Image && block.image === null && block.query.trim() !== "";
  if (!columns.some((column) => column.blocks.some(needsImage))) return columns;

  const resolved: Column[] = [];
  for (const column of columns) {
    const blocks: Block[] = [];
    for (const block of column.blocks) {
      if (block.type !== BlockType.Image || !needsImage(block)) {
        blocks.push(block);
        continue;
      }
      const result = await find(block.query, signal);
      blocks.push(result.status === ImageSearchStatus.Found ? { ...block, image: result.image } : block);
    }
    resolved.push({ ...column, blocks });
  }
  return resolved;
}

function toResolvedImage(result: OpenverseResult): ResolvedImage | null {
  const parsed = resolvedImageSchema.safeParse({
    src: result.url,
    width: Math.round(result.width ?? 0),
    height: Math.round(result.height ?? 0),
    attribution: (result.attribution ?? "").slice(0, LIMITS.imageAttribution),
    sourceUrl: result.foreign_landing_url ?? result.url,
  });
  return parsed.success ? parsed.data : null;
}

function remember(query: string, result: ImageSearchResult) {
  if (completedSearches.size >= MAX_CACHED_SEARCHES) {
    const oldest = completedSearches.keys().next();
    if (!oldest.done) completedSearches.delete(oldest.value);
  }
  completedSearches.set(query, result);
}
