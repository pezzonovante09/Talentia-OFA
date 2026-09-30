import type { ErrorEvent } from "@sentry/nextjs";

/** Заголовки, которые не уходят в Sentry никогда: в них JWT пользователя и секреты. */
const SECRET_HEADERS = ["authorization", "cookie", "x-api-key", "x-api-secret"];

/**
 * Чистит событие перед отправкой в Sentry: `captureRequestError` прикладывает заголовки
 * запроса, а в `authorization` — JWT родителя. Тело запроса (сообщение ребёнка) и
 * пользователь не отправляются вовсе. После удаления аккаунта в Sentry не должно
 * остаться ничего, что оттуда не удалить.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    const headers = { ...(event.request.headers ?? {}) };
    for (const key of Object.keys(headers)) {
      if (SECRET_HEADERS.includes(key.toLowerCase())) delete headers[key];
    }
    event.request = { ...event.request, headers, data: undefined, cookies: undefined };
  }
  delete event.user;
  return event;
}
