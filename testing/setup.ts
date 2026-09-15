import "@testing-library/jest-dom/vitest";
// jsdom has no IndexedDB, where uploaded images are stored.
import "fake-indexeddb/auto";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { installBlobArrayBufferPolyfill } from "./mocks/blob";
import { installDialogPolyfill } from "./mocks/dialog";
import { installMatchMediaPolyfill } from "./mocks/match-media";
import { installObjectUrlPolyfill } from "./mocks/object-url";
import { installRangePolyfill } from "./mocks/range";
import { installResizeObserverPolyfill } from "./mocks/resize-observer";
import { server } from "./msw/server";
import { resetDecksStore } from "./stores";

installBlobArrayBufferPolyfill();
installDialogPolyfill();
installMatchMediaPolyfill();
installObjectUrlPolyfill();
installRangePolyfill();
installResizeObserverPolyfill();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

afterEach(() => {
  server.resetHandlers();
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  localStorage.clear();
  resetDecksStore();
});
