import { describe, expect, test } from "vitest";
import { slideFileName, waitForSlideAssets } from "../slide-export";

describe("slide export", () => {
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
});
