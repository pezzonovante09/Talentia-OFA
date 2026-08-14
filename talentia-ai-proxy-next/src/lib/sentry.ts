import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

/** True once a real DSN has been supplied — mirrors talentia-mobile/src/services/sentry.ts. */
export const isSentryConfigured = Boolean(dsn);

/** Safe wrapper: forwards to Sentry only when configured, otherwise falls back to console. */
export function captureException(error: unknown, extra?: Record<string, unknown>): void {
  if (!dsn) {
    console.error("[error]", error, extra);
    return;
  }
  Sentry.captureException(error, extra ? { extra } : undefined);
}
