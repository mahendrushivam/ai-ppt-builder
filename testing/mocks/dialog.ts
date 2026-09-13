/**
 * jsdom does not implement `HTMLDialogElement.showModal()` or `close()`. This adds the
 * small part of that behavior components rely on: toggling `open` and firing `close`.
 */
export function installDialogPolyfill(): void {
  const prototype = HTMLDialogElement.prototype;
  if (typeof prototype.showModal === "function") return;

  prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
