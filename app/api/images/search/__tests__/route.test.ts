import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { OPENVERSE_IMAGES_URL } from "@/services/images/openverse";
import { server } from "@/testing/msw/server";
import { POST } from "../route";

function searchRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/images/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/images/search", () => {
  test("rejects an empty search", async () => {
    const response = await POST(searchRequest({ query: "  " }));

    expect(response.status).toBe(400);
  });

  test("returns the image found for the search", async () => {
    server.use(
      http.get(OPENVERSE_IMAGES_URL, () =>
        HttpResponse.json({
          results: [
            {
              url: "https://images.example.com/whiteboard.jpg",
              width: 1024,
              height: 768,
              attribution: '"Whiteboard" by someone is licensed under CC BY 2.0.',
              foreign_landing_url: "https://example.com/whiteboard",
            },
          ],
        }),
      ),
    );

    const response = await POST(searchRequest({ query: "team at a whiteboard" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "found",
      image: { src: "https://images.example.com/whiteboard.jpg", sourceUrl: "https://example.com/whiteboard" },
    });
  });
});
