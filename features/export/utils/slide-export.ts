import { toBlob } from "html-to-image";

/** Slides are printed and exported at one fixed size, so charts and text lay out the same every time. */
export const EXPORT_SLIDE_SIZE = { width: 1280, height: 720 } as const;

const ASSET_TIMEOUT_MS = 10_000;
const PNG_PIXEL_RATIO = 2;
/** A transparent pixel, drawn in place of an image whose host doesn't allow it to be copied. */
const BLOCKED_IMAGE_PLACEHOLDER = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** A file name like `q3-roadmap-slide-2.png`. */
export function slideFileName(deckTitle: string, slideNumber: number): string {
  const base = deckTitle
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "presentation"}-slide-${slideNumber}.png`;
}

/**
 * Resolves once the slides in `root` are ready to print or capture: uploads have been read
 * from storage, every image has loaded or failed, and charts have had frames to measure their
 * size. Gives up after `timeoutMs`, so one stuck image never blocks exporting.
 */
export async function waitForSlideAssets(root: HTMLElement, timeoutMs: number = ASSET_TIMEOUT_MS): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  await nextFrame();
  while (root.querySelector("[data-image-loading]") && Date.now() < deadline) await nextFrame();

  const images = [...root.querySelectorAll("img")];
  await untilDeadline(Promise.all(images.map(imageSettled)), deadline);

  // Charts lay out again in the frame after images change the size of their container.
  await nextFrame();
}

/** Draws a slide element as a PNG at twice its size. */
export async function captureSlidePng(node: HTMLElement): Promise<Blob> {
  const blob = await toBlob(node, { pixelRatio: PNG_PIXEL_RATIO, imagePlaceholder: BLOCKED_IMAGE_PLACEHOLDER });
  if (!blob) throw new Error("The slide could not be drawn.");
  return blob;
}

export function downloadFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked later, because some browsers start reading the file after `click()` returns.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Waits for a slide element's images and charts, then downloads it as a PNG. */
export async function exportSlidePng(node: HTMLElement, fileName: string): Promise<void> {
  await waitForSlideAssets(node);
  downloadFile(await captureSlidePng(node), fileName);
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function imageSettled(image: HTMLImageElement): Promise<void> {
  if (image.complete) return Promise.resolve();
  return new Promise((resolve) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener("error", () => resolve(), { once: true });
  });
}

async function untilDeadline(promise: Promise<unknown>, deadline: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, Math.max(0, deadline - Date.now()));
  });
  await Promise.race([promise, timeout]);
  clearTimeout(timer);
}
