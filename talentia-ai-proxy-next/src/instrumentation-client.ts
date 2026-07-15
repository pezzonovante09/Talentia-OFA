import * as Sentry from "@sentry/nextjs";

// This proxy is API-only for the most part (one static status page), but we
// still wire up client-side monitoring for completeness. Safe no-op without
// NEXT_PUBLIC_SENTRY_DSN.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
