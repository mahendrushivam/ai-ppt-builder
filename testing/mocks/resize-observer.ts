/**
 * jsdom does not implement `ResizeObserver`, which charts use to follow the size of their
 * container. This stand-in never reports a size, like an element that has no layout.
 */
export function installResizeObserverPolyfill(): void {
  if (typeof globalThis.ResizeObserver === "function") return;

  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
