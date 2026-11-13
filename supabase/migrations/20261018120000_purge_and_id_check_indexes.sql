-- Индексы под purge_expired и children_id_not_taken (раунд 3, В-13 и В-14).
--
-- Что было не так.
--  В-13. purge_expired() раз в сутки удаляет по условию на время. Индексов под эти условия
--  нет, кроме составных с другим первым столбцом (lesson_runs (child_id, started_at),
--  invite_attempts (user_id, at)): они для DELETE по одному времени не годятся, и каждый
--  запуск читает таблицы целиком. На 100 тысячах детей (десятки миллионов строк
--  lesson_runs) это минуты под нагрузкой.
--  В-14. Триггер children_id_not_taken() на каждый INSERT ребёнка и UPDATE его id ищет
--  псевдоним в child_access_log по user_id и by_user. Под child_id индекс есть
--  (child_access_log_child), под эти два столбца — нет: каждое создание ребёнка читает
--  журнал доступа целиком. consent_events покрыт (consent_events_child, consent_events_actor).
--
-- Что меняется. Только индексы. Те, что обслуживают очистку по retain_until, resolved_at и
-- status = 'pending', — частичные: в них попадает малая доля строк, и они почти ничего не
-- стоят при записи. Функции и политики не трогаются. CREATE INDEX без CONCURRENTLY: файл
-- выполняется в транзакции; до первого наката на облако таблицы пусты. Если накат будет на
-- живую базу, эти же индексы создают вручную с CONCURRENTLY до миграции — IF NOT EXISTS
-- её пропустит.
--
-- pg_cron. purge_expired() по расписанию ставит pg_cron, который в Supabase включается в
-- панели и может быть выключен (план, регион, решение владельца). Тогда очистка не идёт
-- молча, а сроки хранения (№ ретеншна: 12 месяцев, 3 года, 72 часа) не соблюдаются. Что
-- сделано раньше и остаётся: ensure_purge_scheduled() (20260924160000) ставит задание, когда
-- pg_cron есть, и возвращает false с предупреждением, когда нет; доступна только владельцу
-- базы. Что добавляется здесь: purge_schedule_status() — один безопасный вызов из SQL-
-- редактора или из мониторинга, который отвечает, на месте ли задание, без исключений.
-- Если pg_cron недоступен совсем, purge_expired() надо вызывать снаружи (Vercel Cron к
-- роуту прокси с service-role или расписание GitHub Actions); роута пока нет — это решение
-- к шагу 7, оно записано в REBUILD.md, не в миграции.
--
-- Сознательно не делается: партиционирование lesson_runs и пакетное удаление (LIMIT) —
-- объёмы нужно сначала увидеть на живой базе.

CREATE INDEX IF NOT EXISTS lesson_runs_started ON public.lesson_runs (started_at);
CREATE INDEX IF NOT EXISTS child_access_invites_expires ON public.child_access_invites (expires_at);
CREATE INDEX IF NOT EXISTS invite_attempts_at ON public.invite_attempts (at);
CREATE INDEX IF NOT EXISTS child_guardians_pending_created ON public.child_guardians (created_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS consent_events_retain ON public.consent_events (retain_until)
  WHERE retain_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS child_access_log_retain ON public.child_access_log (retain_until)
  WHERE retain_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS consent_revoke_requests_resolved ON public.consent_revoke_requests (resolved_at)
  WHERE resolved_at IS NOT NULL;

-- children_id_not_taken: ветки по user_id и by_user журнала доступа. Только строки с отметкой
-- псевдонима — как в условии триггера.
CREATE INDEX IF NOT EXISTS child_access_log_user_pseudo ON public.child_access_log (user_id)
  WHERE user_pseudonymized_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS child_access_log_by_pseudo ON public.child_access_log (by_user)
  WHERE by_pseudonymized_at IS NOT NULL;

-- Задание очистки на месте? Не бросает исключений, ничего не меняет.
CREATE FUNCTION public.purge_schedule_status() RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN 'no_pg_cron';
  END IF;
  BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'talentia-purge-expired') THEN
      RETURN 'scheduled';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'unknown';
  END;
  RETURN 'not_scheduled';
END;
$$;

REVOKE ALL ON FUNCTION public.purge_schedule_status() FROM PUBLIC, anon, authenticated;
