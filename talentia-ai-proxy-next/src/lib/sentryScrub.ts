import type { ErrorEvent, Event as SentryEvent } from "@sentry/nextjs";

/**
 * Заголовки запроса, которые Sentry получает: **белый список**. Всё остальное — IP
 * (`x-forwarded-for`, `x-real-ip`, `x-vercel-forwarded-for`), `user-agent`, JWT, куки, секреты
 * прокси (`x-talentia-secret`) и любые будущие заголовки — отбрасывается. Чёрный список из четырёх
 * имён пропускал всё остальное (раунд 3, `child-privacy-compliance`, В2).
 */
const SAFE_HEADERS = new Set(["content-type", "accept", "content-length"]);

/**
 * Чистит событие перед отправкой в Sentry (ошибки, транзакции, клиентские события). После удаления
 * аккаунта в Sentry не должно остаться ничего, что оттуда не удалить, поэтому туда не идут:
 * пользователь, IP, `user-agent`, куки, тело и строка запроса, окружение запроса, хлебные крошки,
 * имя хоста.
 */
export function scrubEvent<T extends SentryEvent>(event: T): T {
  if (event.request) {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(event.request.headers ?? {})) {
      if (SAFE_HEADERS.has(key.toLowerCase())) headers[key] = value;
    }
    event.request = {
      ...(event.request.method ? { method: event.request.method } : {}),
      // путь без строки запроса: в query бывают идентификаторы и токены
      ...(event.request.url ? { url: event.request.url.split(/[?#]/)[0] } : {}),
      headers,
    };
  }
  delete event.user;
  delete event.breadcrumbs;
  delete event.server_name;
  if (event.contexts) delete event.contexts.device;
  return event;
}

/** `beforeSend` для ошибок. */
export const beforeSendScrub = (event: ErrorEvent): ErrorEvent => scrubEvent(event);

/**
 * Общие настройки приватности для всех трёх `Sentry.init` (сервер, edge, клиент): без идентификаторов
 * (CLAUDE.md), без трассировки производительности (`tracesSampleRate: 0` — для запросов с детьми
 * хватает ошибок), без хлебных крошек; очистка на всех путях отправки на случай, если кто-то
 * включит трассировку.
 */
export const sentryPrivacyOptions = {
  sendDefaultPii: false,
  tracesSampleRate: 0,
  maxBreadcrumbs: 0,
  beforeSend: beforeSendScrub,
  beforeSendTransaction: scrubEvent,
} as const;
