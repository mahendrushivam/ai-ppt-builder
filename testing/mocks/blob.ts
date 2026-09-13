/**
 * jsdom's `Blob` has no `arrayBuffer()`, which uploaded images are stored with. This stand-in
 * reads the blob with jsdom's `FileReader`, as browsers did before the method existed.
 */
export function installBlobArrayBufferPolyfill(): void {
  if (typeof Blob.prototype.arrayBuffer === "function") return;

  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}
