import * as Sentry from "@sentry/nextjs";

// No Sentry account is configured for this project by default — SENTRY_DSN is
// intentionally absent so the proxy runs (and builds) fine without it. Set it
// in the deployment environment to start receiving server-side error reports.
// Explicit guard (mirrors talentia-mobile/src/services/sentry.ts) rather than
// relying on the SDK's own no-op-without-DSN behavior, so a missing DSN is
// visible in logs instead of silently doing nothing.
if (!process.env.SENTRY_DSN) {
  console.warn("[Sentry] SENTRY_DSN is not set — server-side error monitoring is disabled.");
} else {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  });
}
