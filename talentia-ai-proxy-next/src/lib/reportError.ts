import * as Sentry from "@sentry/nextjs";

/**
 * Пойманная ошибка маршрута — в Sentry, **без идентификаторов** (CLAUDE.md; раунд 3, В-11).
 * `onRequestError` ловит только необработанные исключения: сбои, превращённые в 500 / 502 / 503 в
 * `catch`, до Sentry иначе не доходят. В событие кладутся тег области и класс ошибки; текст
 * сообщения (в нём бывают id ребёнка, адреса, куски запроса) не передаётся, из стека — только
 * строки кадров (пути кода). Дальше событие проходит `scrubEvent` (`sentryPrivacyOptions`).
 * Без `setUser`, тела запроса и контекста.
 */
export function reportError(scope: string, e: unknown): void {
  const name = e instanceof Error ? e.name : typeof e;
  const safe = new Error(`${scope}: ${name}`);
  safe.name = "HandledRouteError";
  if (e instanceof Error && e.stack) {
    const frames = e.stack.split("\n").filter((line) => line.trim().startsWith("at "));
    safe.stack = [`${safe.name}: ${safe.message}`, ...frames].join("\n");
  }
  Sentry.captureException(safe, { tags: { scope } });
}
