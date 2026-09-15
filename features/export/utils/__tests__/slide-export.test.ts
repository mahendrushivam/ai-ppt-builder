import { toBlob } from "html-to-image";
import { afterEach, describe, expect, test, vi } from "vitest";
import { captureSlidePng, slideFileName, waitForSlideAssets } from "../slide-export";

vi.mock("html-to-image", () => ({ toBlob: vi.fn() }));

describe("slide export", () => {
  afterEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  test("names PNG files after the presentation and the slide number", () => {
    expect(slideFileName("Q3 Roadmap: Plans & Goals!", 3)).toBe("q3-roadmap-plans-goals-slide-3.png");
    expect(slideFileName("Café déjà vu", 2)).toBe("cafe-deja-vu-slide-2.png");
    expect(slideFileName("   ", 1)).toBe("presentation-slide-1.png");
  });

  test("waits until uploaded images have been read from storage", async () => {
    const root = document.createElement("div");
    root.innerHTML = "<div data-image-loading></div>";
    let isDone = false;

    const waiting = waitForSlideAssets(root).then(() => {
      isDone = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(isDone).toBe(false);

    root.innerHTML = "";
    await waiting;
    expect(isDone).toBe(true);
  });

  test("stops waiting after the timeout so a stuck image can't block exporting", async () => {
    const root = document.createElement("div");
    root.innerHTML = "<div data-image-loading></div>";

    await expect(waitForSlideAssets(root, 30)).resolves.toBeUndefined();
  });

  // Regression: exported charts showed Recharts' default grey grid instead of the theme's.
  test("draws chart lines with the colors CSS gives them, then restores the chart", async () => {
    const style = document.createElement("style");
    style.textContent = ".grid line { stroke: rgb(1, 2, 3); }";
    document.head.append(style);
    const slide = document.createElement("div");
    slide.innerHTML = '<svg><g class="grid"><line stroke="#ccc" style="opacity: 0.5"></line></g></svg>';
    document.body.append(slide);
    const line = slide.querySelector("line");
    if (!line) throw new Error("Test chart has no line.");

    let strokeWhileDrawing = "";
    vi.mocked(toBlob).mockImplementation(async () => {
      strokeWhileDrawing = line.style.stroke;
      return new Blob(["png"], { type: "image/png" });
    });

    await captureSlidePng(slide);

    expect(strokeWhileDrawing).toBe("rgb(1, 2, 3)");
    expect(line.getAttribute("style")).toBe("opacity: 0.5");
  });
});
