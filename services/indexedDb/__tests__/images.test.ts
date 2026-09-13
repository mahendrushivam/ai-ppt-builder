import { describe, expect, test } from "vitest";
import { deleteUnusedImages, loadImage, saveImage } from "../images";

describe("uploaded image storage", () => {
  test("stores an image and reads it back", async () => {
    await saveImage("upload_000000000001", new Blob(["pixels"], { type: "image/webp" }));

    const image = await loadImage("upload_000000000001");

    expect(image?.type).toBe("image/webp");
    expect(new TextDecoder().decode(await image?.arrayBuffer())).toBe("pixels");
    expect(await loadImage("upload_00000000dead")).toBeNull();
  });

  test("deletes only images that no deck uses and that are older than the cutoff", async () => {
    const blob = new Blob(["pixels"], { type: "image/png" });
    await saveImage("upload_old_unused", blob, 1_000);
    await saveImage("upload_old_used", blob, 1_000);
    await saveImage("upload_new_unused", blob, 5_000);

    const deletedCount = await deleteUnusedImages(new Set(["upload_old_used"]), 2_000);

    expect(deletedCount).toBe(1);
    expect(await loadImage("upload_old_unused")).toBeNull();
    expect(await loadImage("upload_old_used")).not.toBeNull();
    expect(await loadImage("upload_new_unused")).not.toBeNull();
  });
});
