import { vi } from "vitest";

/** Makes every localStorage write throw, like a full or blocked browser storage. */
export function failStorageWrites(
  error: Error = new DOMException("The quota has been exceeded.", "QuotaExceededError"),
) {
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw error;
  });
}
