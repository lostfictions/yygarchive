/* eslint-disable node/no-process-env */
import { z, parseEnv } from "znv";
import * as Sentry from "@sentry/node";

export const isDev = process.env["NODE_ENV"] !== "production";

if (isDev) {
  console.log("loading .env file...");
  (await import("dotenv")).config();
}

export const { MASTODON_TOKEN, BSKY_USERNAME, BSKY_PASSWORD, SENTRY_DSN } =
  parseEnv(process.env, {
    PERSIST_DIR: z.string().min(1).default("persist"),
    MASTODON_TOKEN: {
      schema: z.string().min(1),
      defaults: {
        development: "dev",
      },
    },
    BSKY_USERNAME: {
      schema: z.string().min(1),
      defaults: {
        development: "unused",
      },
    },
    BSKY_PASSWORD: {
      schema: z.string().min(1),
      defaults: {
        development: "unused",
      },
    },
    SENTRY_DSN: {
      schema: z.string().min(1).optional(),
    },
  });

export const MASTODON_SERVER = "https://mastodon.social";

if (!SENTRY_DSN && !isDev) {
  console.warn(
    `Sentry DSN is invalid! Error reporting to Sentry will be disabled.`,
  );
} else {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: isDev ? "dev" : "prod",
    integrations: [
      Sentry.captureConsoleIntegration({
        levels: ["warn", "error", "debug", "assert"],
      }),
    ],
  });
}
