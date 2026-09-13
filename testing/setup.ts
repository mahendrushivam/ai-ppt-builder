import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { installDialogPolyfill } from "./mocks/dialog";
import { installMatchMediaPolyfill } from "./mocks/match-media";
import { server } from "./msw/server";
import { resetDecksStore } from "./stores";

installDialogPolyfill();
installMatchMediaPolyfill();

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
