export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export const UPLOAD_LIMITS = {
  fileBytes: 15 * 1024 * 1024,
  /** Longest side of the stored copy, enough for a full-screen slide. */
  dimension: 1920,
} as const;

const WEBP_QUALITY = 0.85;

/** Why a file can't be uploaded, or `null` when it can. */
export function uploadProblem(file: Pick<File, "type" | "size">): string | null {
  if (!ACCEPTED_IMAGE_TYPES.some((type) => type === file.type)) return "Choose a JPEG, PNG, WebP or GIF image.";
  if (file.size > UPLOAD_LIMITS.fileBytes) return "Choose an image smaller than 15 MB.";
  return null;
}

/** Scales a size down, keeping its proportions, so neither side is longer than `maxDimension`. */
export function fitWithin(width: number, height: number, maxDimension: number): { width: number; height: number } {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Makes the copy of an image that is stored: scaled down to UPLOAD_LIMITS.dimension and
 * re-encoded as WebP (browsers that can't encode WebP produce PNG). Needs a browser canvas.
 */
export async function compressImage(file: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    const size = fitWithin(bitmap.width, bitmap.height, UPLOAD_LIMITS.dimension);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas drawing is not available.");
    context.drawImage(bitmap, 0, 0, size.width, size.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY));
    if (!blob) throw new Error("The image could not be encoded.");
    return { blob, ...size };
  } finally {
    bitmap.close();
  }
}
