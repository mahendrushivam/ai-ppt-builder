import { setupServer } from "msw/node";

/** Shared MSW server started in `testing/setup.ts`. Tests add handlers with `server.use(...)`. */
export const server = setupServer();
