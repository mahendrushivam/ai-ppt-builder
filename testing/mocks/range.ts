/**
 * jsdom does not implement `Range.getClientRects()`, which the slide canvas uses to measure text
 * lines. This stand-in reports no boxes, like text that has no layout.
 */
export function installRangePolyfill(): void {
  if (typeof Range.prototype.getClientRects === "function") return;

  Range.prototype.getClientRects = function getClientRects() {
    return Object.assign([], { item: () => null }) as unknown as DOMRectList;
  };
}
