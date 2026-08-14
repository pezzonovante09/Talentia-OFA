import * as Sentry from "@sentry/nextjs";

// Same rationale as sentry.server.config.ts: explicit guard instead of relying
// on the SDK's own no-op-without-DSN behavior.
if (!process.env.SENTRY_DSN) {
  console.warn("[Sentry] SENTRY_DSN is not set — edge error monitoring is disabled.");
} else {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  });
}
