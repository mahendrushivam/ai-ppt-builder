/**
 * jsdom does not implement `window.matchMedia`. next-themes uses it to follow the system
 * color scheme, so this reports a light system preference that never changes.
 */
export function installMatchMediaPolyfill(): void {
  if (typeof window.matchMedia === "function") return;

  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
