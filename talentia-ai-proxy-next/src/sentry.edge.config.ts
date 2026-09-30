import * as Sentry from "@sentry/nextjs";

import { scrubEvent } from "@/lib/sentryScrub";

// Same rationale as sentry.server.config.ts: safe no-op without SENTRY_DSN.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  // Без идентификаторов (CLAUDE.md): ни пользователя, ни заголовков авторизации, ни тела.
  sendDefaultPii: false,
  beforeSend: scrubEvent,
});
