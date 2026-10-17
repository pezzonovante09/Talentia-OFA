import * as Sentry from "@sentry/nextjs";

import { sentryPrivacyOptions } from "@/lib/sentryScrub";

// This proxy is API-only for the most part (one static status page), but we
// still wire up client-side monitoring for completeness. Safe no-op without
// NEXT_PUBLIC_SENTRY_DSN.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Та же очистка, что на сервере: клиентский init раньше работал без неё (раунд 3, В2).
  ...sentryPrivacyOptions,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
