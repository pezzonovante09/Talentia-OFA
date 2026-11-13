import * as Sentry from "@sentry/nextjs";

import { sentryPrivacyOptions } from "@/lib/sentryScrub";

// Same rationale as sentry.server.config.ts: safe no-op without SENTRY_DSN.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Без идентификаторов (CLAUDE.md): ни пользователя, ни IP, ни заголовков, кроме белого списка, ни тела,
  // ни трассировки (`sentryPrivacyOptions`).
  ...sentryPrivacyOptions,
});
