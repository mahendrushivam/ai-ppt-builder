/**
 * jsdom does not implement `URL.createObjectURL`, which shows uploaded images. This stand-in
 * returns a unique `blob:` URL for each call.
 */
export function installObjectUrlPolyfill(): void {
  if (typeof URL.createObjectURL === "function") return;

  let nextId = 0;
  URL.createObjectURL = () => `blob:test/${++nextId}`;
  URL.revokeObjectURL = () => {};
}
