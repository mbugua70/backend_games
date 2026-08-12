import dotenv from "dotenv";
import { z } from "zod";
import { logger } from "../logger/logger";

dotenv.config({ quiet: true });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  CLIENT_URL: z.string().min(1, "CLIENT_URL is required"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  // Signs/verifies admin dashboard JWTs (src/utils/jwt.ts). Bearer-token
  // auth rather than a cookie - the admin dashboard and this API are on
  // different domains, so a session cookie would be third-party and liable
  // to be blocked by the browser.
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().min(1).default("12h"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  logger.error(
    { issues: parsed.error.issues },
    "Invalid environment configuration"
  );
  process.exit(1);
}

// CLIENT_URL may be a single origin or a comma-separated list (e.g. separate
// facilitator/display frontend domains in production).
const clientUrls = parsed.data.CLIENT_URL.split(",")
  .map((url) => url.trim())
  .filter((url) => url.length > 0);

export const env = {
  ...parsed.data,
  CLIENT_URLS: clientUrls,
};
export type Env = typeof env;
