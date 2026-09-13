import { vi } from "vitest";

/**
 * Stand-in for `next/navigation` in component tests, which render outside the Next.js
 * app router. Register it in a test file with:
 *
 *   vi.mock("next/navigation", () => import("@/testing/mocks/next-navigation"));
 */
export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

export function useRouter() {
  return routerMock;
}
