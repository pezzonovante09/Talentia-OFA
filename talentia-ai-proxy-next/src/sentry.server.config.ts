import * as Sentry from "@sentry/nextjs";

// No Sentry account is configured for this project by default — SENTRY_DSN is
// intentionally absent so the proxy runs (and builds) fine without it. Set it
// in the deployment environment to start receiving server-side error reports.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
});
