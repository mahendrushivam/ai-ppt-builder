import { useEffect, useState } from "react";
import { uploadIdFromSrc } from "@/features/deck/utils/uploaded-image";
import { loadImage } from "@/services/indexedDb/images";

export enum ImageUrlStatus {
  Loading = "loading",
  Ready = "ready",
  /** The image was uploaded in another browser, or its storage was cleared. */
  Missing = "missing",
}

export type ImageUrl =
  | { status: ImageUrlStatus.Loading }
  | { status: ImageUrlStatus.Ready; url: string }
  | { status: ImageUrlStatus.Missing };

/**
 * Object URLs for uploads, shared by the canvas, thumbnails and editor. An upload never changes
 * under its id, so each is read from storage once and its URL kept while the page is open.
 */
const uploadUrls = new Map<string, Promise<string | null>>();

function uploadUrl(uploadId: string): Promise<string | null> {
  let url = uploadUrls.get(uploadId);
  if (!url) {
    url = loadImage(uploadId).then(
      (blob) => (blob ? URL.createObjectURL(blob) : null),
      (error: unknown) => {
        // Not cached, so the next render of the image tries again.
        uploadUrls.delete(uploadId);
        console.error(`Uploaded image ${uploadId} could not be read:`, error);
        return null;
      },
    );
    uploadUrls.set(uploadId, url);
  }
  return url;
}

/** The URL to show an image from: web images as they are, uploads from browser storage. */
export function useImageUrl(src: string): ImageUrl {
  const uploadId = uploadIdFromSrc(src);
  const [loaded, setLoaded] = useState<{ uploadId: string; url: string | null } | null>(null);

  useEffect(() => {
    if (uploadId === null) return;
    let isCurrent = true;
    void uploadUrl(uploadId).then((url) => {
      if (isCurrent) setLoaded({ uploadId, url });
    });
    return () => {
      isCurrent = false;
    };
  }, [uploadId]);

  if (uploadId === null) return { status: ImageUrlStatus.Ready, url: src };
  if (loaded?.uploadId !== uploadId) return { status: ImageUrlStatus.Loading };
  return loaded.url === null ? { status: ImageUrlStatus.Missing } : { status: ImageUrlStatus.Ready, url: loaded.url };
}
