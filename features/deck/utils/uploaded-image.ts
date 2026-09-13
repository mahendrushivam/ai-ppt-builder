import { BlockType, type Deck } from "../types";

/**
 * Images the user uploads are kept in this browser's IndexedDB rather than in the deck. The deck
 * refers to them with an `upload:` src, so decks stay small in localStorage and in AI requests.
 */
const UPLOADED_SRC_PREFIX = "upload:";

export const UPLOADED_IMAGE_SRC_PATTERN = /^upload:upload_[0-9a-f]{12}$/;

export function uploadedImageSrc(uploadId: string): string {
  return `${UPLOADED_SRC_PREFIX}${uploadId}`;
}

/** The upload an image src refers to, or `null` for an image on the web. */
export function uploadIdFromSrc(src: string): string | null {
  return UPLOADED_IMAGE_SRC_PATTERN.test(src) ? src.slice(UPLOADED_SRC_PREFIX.length) : null;
}

/** Every upload that an image block in these decks shows. */
export function referencedUploadIds(decks: readonly Deck[]): Set<string> {
  const uploadIds = decks
    .flatMap((deck) => deck.slides)
    .flatMap((slide) => slide.columns)
    .flatMap((column) => column.blocks)
    .flatMap((block) => (block.type === BlockType.Image && block.image ? [uploadIdFromSrc(block.image.src)] : []));
  return new Set(uploadIds.filter((uploadId) => uploadId !== null));
}
