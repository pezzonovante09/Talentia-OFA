import * as Sentry from "@sentry/nextjs";

import { sentryPrivacyOptions } from "@/lib/sentryScrub";

// No Sentry account is configured for this project by default — SENTRY_DSN is
// intentionally absent so the proxy runs (and builds) fine without it. Set it
// in the deployment environment to start receiving server-side error reports.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Без идентификаторов (CLAUDE.md): ни пользователя, ни IP, ни заголовков, кроме белого списка, ни тела,
  // ни трассировки (`sentryPrivacyOptions`).
  ...sentryPrivacyOptions,
});
