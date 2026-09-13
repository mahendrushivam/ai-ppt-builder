import { z } from "zod";

/** Reads and validates a JSON request body in a route handler. An invalid body becomes a 400 response. */
export async function parseRequestBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: z.output<S> } | { ok: false; response: Response }> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { ok: false, response: Response.json({ error: "The request body must be JSON." }, { status: 400 }) };
  }
  const parsed = schema.safeParse(json);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, response: Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 }) };
}
