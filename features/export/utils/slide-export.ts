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

/** Styles that chart SVGs get from CSS rules: theme colors, grid lines and label fonts. */
const SVG_STYLE_PROPERTIES = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "stroke-dasharray",
  "opacity",
  "color",
  "font-family",
  "font-size",
  "font-weight",
] as const;

/** Draws a slide element as a PNG at twice its size. */
export async function captureSlidePng(node: HTMLElement): Promise<Blob> {
  const restoreSvgStyles = inlineSvgStyles(node);
  try {
    const blob = await toBlob(node, { pixelRatio: PNG_PIXEL_RATIO, imagePlaceholder: BLOCKED_IMAGE_PLACEHOLDER });
    if (!blob) throw new Error("The slide could not be drawn.");
    return blob;
  } finally {
    restoreSvgStyles();
  }
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

/**
 * `html-to-image` copies an `<svg>` with its attributes only, so the styles CSS rules give chart
 * contents would be lost and Recharts' default grey would show instead. Writes the computed
 * styles onto the SVG elements for the capture; the returned function puts the old styles back.
 */
function inlineSvgStyles(root: HTMLElement): () => void {
  const elements = [...root.querySelectorAll<SVGElement>("svg *")];
  const previousStyles = elements.map((element) => element.getAttribute("style"));
  const computedStyles = elements.map((element) => {
    const computed = getComputedStyle(element);
    return SVG_STYLE_PROPERTIES.map((property) => [property, computed.getPropertyValue(property)] as const);
  });

  elements.forEach((element, index) => {
    for (const [property, value] of computedStyles[index]) {
      if (value) element.style.setProperty(property, value);
    }
  });

  return () => {
    elements.forEach((element, index) => {
      const previous = previousStyles[index];
      if (previous === null) element.removeAttribute("style");
      else element.setAttribute("style", previous);
    });
  };
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
