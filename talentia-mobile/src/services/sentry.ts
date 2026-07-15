import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** True once a real DSN has been supplied — lets other code short-circuit Sentry calls. */
export const isSentryConfigured = Boolean(dsn);

/**
 * Initializes Sentry error/performance monitoring. This project ships with
 * no Sentry account configured, so `EXPO_PUBLIC_SENTRY_DSN` is intentionally
 * absent by default and the app must run fully without it — in that case
 * this is a no-op (besides a one-time dev warning) rather than a crash.
 */
export function initSentry(): void {
  if (!dsn) {
    if (__DEV__) {
      console.warn('[Sentry] EXPO_PUBLIC_SENTRY_DSN is not set — error monitoring is disabled.');
    }
    return;
  }
  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    // Full trace sampling in dev is cheap and useful; keep production volume modest by default.
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  });
}

/** Safe wrapper: forwards to Sentry only when configured, otherwise falls back to console. */
export function captureException(error: unknown, extra?: Record<string, unknown>): void {
  if (!dsn) {
    console.error('[error]', error, extra);
    return;
  }
  Sentry.captureException(error, extra ? { extra } : undefined);
}

export { Sentry };
