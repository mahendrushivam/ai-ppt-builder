import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  SARVAM_API_KEY: z.string().trim().min(1, "SARVAM_API_KEY is not set. Add it to .env.local."),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Server-only environment. Read on use rather than at import time, so a missing key fails
 * the AI request that needs it instead of the whole build.
 */
export function getServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) throw new Error(z.prettifyError(parsed.error));
  return parsed.data;
}
