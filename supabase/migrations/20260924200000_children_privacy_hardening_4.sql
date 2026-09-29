-- Исправления по четвёртой проверке child-privacy-compliance. Отдельным файлом:
-- существующие миграции не редактируются.

-- ---------------------------------------------------------------------------
-- Срок хранения — только у записей того, кого уже нет
-- ---------------------------------------------------------------------------

-- Прежнее правило разрешало поставить срок из пустого на любой записи. Роль в
-- обход RLS ставила его на ОТЗЫВ живого ребёнка; через три года очистка удаляла
-- отзыв, и прежнее согласие начинало действовать снова.
--
-- Теперь срок ставится, только когда запись больше ничему не служит: ребёнка нет,
-- а для согласия аккаунта — нет взрослого. Пока сущность жива, её записи бессрочны.
CREATE FUNCTION public.retain_change_allowed_for(
  old_until timestamptz, new_until timestamptz, owner_gone boolean
) RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT old_until IS NOT DISTINCT FROM new_until
      OR (owner_gone AND old_until IS NULL AND new_until >= now() + interval '3 years' - interval '1 day');
$$;

CREATE OR REPLACE FUNCTION public.consent_events_guard() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.retain_until IS NOT NULL AND OLD.retain_until < now() THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'consent_events is append-only' USING ERRCODE = '42501';
  END IF;
  IF (NEW.id, NEW.seq, NEW.scope, NEW.action, NEW.text_version, NEW.confirmed_by, NEW.client_at, NEW.received_at)
       IS DISTINCT FROM
     (OLD.id, OLD.seq, OLD.scope, OLD.action, OLD.text_version, OLD.confirmed_by, OLD.client_at, OLD.received_at)
     OR NOT public.pseudonym_change_allowed(OLD.child_id, NEW.child_id, OLD.child_pseudonymized_at, NEW.child_pseudonymized_at)
     OR NOT public.pseudonym_change_allowed(OLD.actor_id, NEW.actor_id, OLD.actor_pseudonymized_at, NEW.actor_pseudonymized_at)
     OR NOT public.retain_change_allowed_for(
          OLD.retain_until, NEW.retain_until,
          CASE WHEN NEW.child_id IS NOT NULL THEN NOT public.id_is_real(NEW.child_id)
               ELSE NOT public.id_is_real(NEW.actor_id) END) THEN
    RAISE EXCEPTION 'consent_events is append-only' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.child_access_log_guard() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.retain_until IS NOT NULL AND OLD.retain_until < now() THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'child_access_log is append-only' USING ERRCODE = '42501';
  END IF;
  IF (NEW.id, NEW.role, NEW.event, NEW.at) IS DISTINCT FROM (OLD.id, OLD.role, OLD.event, OLD.at)
     OR NOT public.pseudonym_change_allowed(OLD.child_id, NEW.child_id, OLD.child_pseudonymized_at, NEW.child_pseudonymized_at)
     OR NOT public.pseudonym_change_allowed(OLD.user_id, NEW.user_id, OLD.user_pseudonymized_at, NEW.user_pseudonymized_at)
     OR NOT public.pseudonym_change_allowed(OLD.by_user, NEW.by_user, OLD.by_pseudonymized_at, NEW.by_pseudonymized_at)
     OR NOT public.retain_change_allowed_for(OLD.retain_until, NEW.retain_until, NOT public.id_is_real(NEW.child_id)) THEN
    RAISE EXCEPTION 'child_access_log is append-only' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP FUNCTION public.retain_change_allowed(timestamptz, timestamptz);

-- ---------------------------------------------------------------------------
-- Синхронизация навыков из клиента — upsert должен работать
-- ---------------------------------------------------------------------------

-- PostgREST превращает upsert в ON CONFLICT DO UPDATE SET по всем колонкам из
-- запроса, включая ключ. Без права на ключевые колонки синхронизация падает, и
-- первое, что сделают при починке, — вернут UPDATE на всю таблицу. Перенести
-- строку на чужого ребёнка это право не даёт: политика проверяет доступ к новому
-- child_id в WITH CHECK.
--
-- Прохождения только дописываются: повтор отправки из офлайна — upsert с
-- «resolution=ignore-duplicates» (ON CONFLICT DO NOTHING), права на UPDATE ему не
-- нужны и не выдаются.
GRANT UPDATE (child_id, skill) ON public.skill_state TO authenticated;

-- ---------------------------------------------------------------------------
-- Версия текста согласия начинается с языка
-- ---------------------------------------------------------------------------

-- Ключ таблицы — (scope, version). Одна версия на два языка сломала бы вставку
-- второго; явный префикс языка делает это невозможным и читаемым.
ALTER TABLE public.consent_texts
  ADD CONSTRAINT consent_texts_version_has_locale CHECK (version LIKE locale || '-%');

-- ---------------------------------------------------------------------------
-- Права
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.retain_change_allowed_for(timestamptz, timestamptz, boolean) FROM PUBLIC, anon, authenticated;
