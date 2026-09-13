import { describe, expect, test } from "vitest";
import { fitWithin, UPLOAD_LIMITS, uploadProblem } from "../image-upload";

describe("image upload", () => {
  test("accepts common image files and explains why others are refused", () => {
    expect(uploadProblem({ type: "image/png", size: 1_000 })).toBeNull();
    expect(uploadProblem({ type: "image/svg+xml", size: 1_000 })).toBe("Choose a JPEG, PNG, WebP or GIF image.");
    expect(uploadProblem({ type: "image/jpeg", size: UPLOAD_LIMITS.fileBytes + 1 })).toBe(
      "Choose an image smaller than 15 MB.",
    );
  });

  test("scales large images down to fit, keeping their proportions", () => {
    expect(fitWithin(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440 });
    expect(fitWithin(1000, 3000, 1920)).toEqual({ width: 640, height: 1920 });
    expect(fitWithin(800, 600, 1920)).toEqual({ width: 800, height: 600 });
  });
});
