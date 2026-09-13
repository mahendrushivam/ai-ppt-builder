import { describe, expect, test } from "vitest";
import { BlockType } from "@/features/deck/types";
import { contentSlide, deckWith, resolvedImage } from "@/testing/fixtures";
import { referencedUploadIds, uploadedImageSrc, uploadIdFromSrc } from "../uploaded-image";

describe("uploaded image references", () => {
  test("reads the upload id back from an uploaded image src and ignores web images", () => {
    expect(uploadIdFromSrc(uploadedImageSrc("upload_0123456789ab"))).toBe("upload_0123456789ab");
    expect(uploadIdFromSrc(resolvedImage.src)).toBeNull();
  });

  test("collects the uploads that image blocks use across decks", () => {
    const imageBlock = (id: string, src: string | null) => ({
      id,
      type: BlockType.Image as const,
      query: "team",
      alt: "Team",
      image: src === null ? null : { ...resolvedImage, src, attribution: "", sourceUrl: null },
    });
    const decks = [
      deckWith(contentSlide("a", [imageBlock("b1", uploadedImageSrc("upload_0123456789ab")), imageBlock("b2", null)])),
      deckWith(contentSlide("b", [imageBlock("b3", resolvedImage.src), imageBlock("b4", uploadedImageSrc("upload_ffffffffffff"))])),
    ];

    expect(referencedUploadIds(decks)).toEqual(new Set(["upload_0123456789ab", "upload_ffffffffffff"]));
  });
});
