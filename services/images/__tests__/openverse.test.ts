import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";
import { BlockType, type Column } from "@/features/deck/types";
import { resolvedImage } from "@/testing/fixtures";
import { server } from "@/testing/msw/server";
import { findImage, OPENVERSE_IMAGES_URL, resolveColumnImages } from "../openverse";
import { ImageSearchStatus } from "../types";

function openverseResult(overrides: Record<string, unknown> = {}) {
  return {
    url: "https://images.example.com/team.jpg",
    width: 1200,
    height: 800,
    attribution: '"Team" by someone is licensed under CC BY 2.0.',
    foreign_landing_url: "https://example.com/photo",
    ...overrides,
  };
}

function mockOpenverse(response: { results: unknown[] } | { status: number }) {
  const requests: URL[] = [];
  server.use(
    http.get(OPENVERSE_IMAGES_URL, ({ request }) => {
      requests.push(new URL(request.url));
      return "results" in response ? HttpResponse.json(response) : new HttpResponse(null, { status: response.status });
    }),
  );
  return { requests };
}

function search(query: string) {
  return findImage(query, new AbortController().signal);
}

// Completed searches are cached for the whole process, so each test uses its own query.
describe("findImage", () => {
  test("returns the first usable image and searches only licenses that allow commercial use and changes", async () => {
    const { requests } = mockOpenverse({
      results: [openverseResult({ url: "http://insecure.example.com/team.jpg" }), openverseResult()],
    });

    const result = await search("Team Meeting");

    expect(result).toEqual({
      status: ImageSearchStatus.Found,
      image: {
        src: "https://images.example.com/team.jpg",
        width: 1200,
        height: 800,
        attribution: '"Team" by someone is licensed under CC BY 2.0.',
        sourceUrl: "https://example.com/photo",
      },
    });
    expect(requests[0].searchParams.get("q")).toBe("team meeting");
    expect(requests[0].searchParams.get("license_type")).toBe("commercial,modification");
    expect(requests[0].searchParams.get("mature")).toBe("false");
  });

  test("remembers a completed search", async () => {
    const { requests } = mockOpenverse({ results: [openverseResult()] });

    await search("office desk");
    await search("  Office desk ");

    expect(requests).toHaveLength(1);
  });

  test("tells a search without matches apart from an unavailable service", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockOpenverse({ results: [] });
    expect(await search("no such photo")).toEqual({ status: ImageSearchStatus.NotFound });

    mockOpenverse({ status: 429 });
    expect(await search("rate limited photo")).toEqual({ status: ImageSearchStatus.Unavailable });
  });
});

describe("resolveColumnImages", () => {
  test("fills in only image blocks without an image", async () => {
    const columns: Column[] = [
      {
        id: "column",
        heading: null,
        blocks: [
          { id: "resolved", type: BlockType.Image, query: "kept", alt: "Kept", image: resolvedImage },
          { id: "missing", type: BlockType.Image, query: "office", alt: "Office", image: null },
        ],
      },
    ];
    const searches: string[] = [];

    const resolved = await resolveColumnImages(
      columns,
      async (query) => {
        searches.push(query);
        return { status: ImageSearchStatus.Found, image: { ...resolvedImage, src: "https://images.example.com/office.jpg" } };
      },
      new AbortController().signal,
    );

    expect(searches).toEqual(["office"]);
    expect(resolved[0].blocks.map((block) => (block.type === BlockType.Image ? block.image?.src : null))).toEqual([
      resolvedImage.src,
      "https://images.example.com/office.jpg",
    ]);
  });

  test("returns the same columns when nothing needs an image", async () => {
    const columns: Column[] = [{ id: "column", heading: null, blocks: [] }];

    expect(await resolveColumnImages(columns, async () => ({ status: ImageSearchStatus.NotFound }), new AbortController().signal)).toBe(
      columns,
    );
  });
});
