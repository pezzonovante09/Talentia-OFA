-- Исправления по повторной проверке child-privacy-compliance. Отдельным файлом:
-- существующие миграции не редактируются.
--
-- Решения владельца продукта:
--   1. Второй родитель может запросить отзыв согласия, которое даёт только
--      владелец (облако, ИИ, голос). Запрос видит владелец и решает сам.
--   2. После передачи ребёнка новый владелец обязан дать собственное согласие в
--      течение 7 дней. Пока не дал — действует согласие прежнего владельца; после
--      срока запись в облако и ИИ/голос закрыты.

-- ---------------------------------------------------------------------------
-- Порядок событий согласия — серверный, а не клиентский
-- ---------------------------------------------------------------------------

-- При одинаковом received_at (пачка [grant, revoke] одним запросом) порядок решал
-- client_at, то есть клиент, и отзыв можно было перекрыть.
ALTER TABLE public.consent_events ADD COLUMN seq bigint GENERATED ALWAYS AS IDENTITY;
CREATE INDEX consent_events_child_scope_seq ON public.consent_events (child_id, scope, seq DESC);

-- ---------------------------------------------------------------------------
-- Передача владения: семь дней на собственное согласие
-- ---------------------------------------------------------------------------

ALTER TABLE public.children ADD COLUMN consent_grace_until timestamptz;

-- Второй родитель правит только имя и полосу. Без этого он мог бы продлить себе
-- срок на согласие или любое будущее служебное поле.
REVOKE UPDATE ON public.children FROM authenticated;
GRANT UPDATE (display_name, band) ON public.children TO authenticated;

-- Правка имени и полосы — тоже запись в облако, и тоже только при согласии.
DROP POLICY "children: guardian update" ON public.children;
CREATE POLICY "children: guardian update with consent" ON public.children
  FOR UPDATE TO authenticated
  USING (public.has_child_access(id, 'guardian'))
  WITH CHECK (public.has_child_access(id, 'guardian') AND public.has_consent(id, 'cloud_sync'));

-- Действует ли согласие. Три условия:
--   · последнее событие области (по серверному порядку) — grant на текущий текст;
--   · для областей, которыми распоряжается только владелец, grant дал нынешний
--     владелец — или идут семь дней после передачи;
--   · спрашивает тот, у кого есть доступ к ребёнку: иначе бывший второй родитель по
--     uuid узнавал бы, есть ли у ребёнка облако и ИИ. Политики вызывают функцию от
--     имени пользователя, у которого доступ уже проверен, — для них это ничего не
--     меняет; функции с service-role её не вызывают.
CREATE OR REPLACE FUNCTION public.has_consent(target_child uuid, consent_scope text) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.has_child_access(target_child, 'guardian') AND coalesce((
    SELECT e.action = 'grant'
       AND e.text_version = (SELECT t.version FROM public.consent_texts t WHERE t.scope = consent_scope AND t.is_current)
       AND (
         consent_scope NOT IN ('cloud_sync', 'companion_ai', 'voice_asr')
         OR EXISTS (SELECT 1 FROM public.child_guardians g
                    WHERE g.child_id = target_child AND g.user_id = e.actor_id AND g.role = 'owner')
         OR (SELECT c.consent_grace_until > now() FROM public.children c WHERE c.id = target_child)
       )
    FROM public.consent_events e
    WHERE e.child_id = target_child AND e.scope = consent_scope
    ORDER BY e.seq DESC
    LIMIT 1
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.transfer_child_ownership(target_child uuid, new_owner uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_real_user() OR NOT public.has_child_access(target_child, 'owner') THEN
    RAISE EXCEPTION 'only the owner can transfer' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.child_guardians
                 WHERE child_id = target_child AND user_id = new_owner
                   AND role = 'guardian' AND status = 'active'
                   AND (expires_at IS NULL OR expires_at > now())) THEN
    RAISE EXCEPTION 'new owner must be an active guardian' USING ERRCODE = '22023';
  END IF;
  -- Порядок важен: уникальный индекс «один владелец» не допускает двух сразу.
  UPDATE public.child_guardians SET role = 'guardian' WHERE child_id = target_child AND user_id = auth.uid();
  UPDATE public.child_guardians SET role = 'owner' WHERE child_id = target_child AND user_id = new_owner;
  -- Новый владелец живёт на чужом согласии не дольше недели.
  UPDATE public.children SET consent_grace_until = now() + interval '7 days' WHERE id = target_child;
  INSERT INTO public.child_access_log (child_id, user_id, role, event, by_user) VALUES
    (target_child, auth.uid(), 'guardian', 'transferred_out', auth.uid()),
    (target_child, new_owner, 'owner', 'transferred_in', auth.uid());
END;
$$;

-- ---------------------------------------------------------------------------
-- Запрос второго родителя на отзыв
-- ---------------------------------------------------------------------------

-- Облако, ИИ и голос отзывает только владелец. Второй родитель с равной
-- родительской ответственностью не должен оставаться без голоса: он подаёт запрос,
-- владелец его видит и решает. Текст согласия говорит об этом прямо.
CREATE TABLE public.consent_revoke_requests (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  child_id     uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  scope        text NOT NULL CHECK (scope IN ('cloud_sync', 'companion_ai', 'voice_asr')),
  -- Без внешнего ключа: запрос переживает удаление аккаунта автора под псевдонимом.
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  resolution   text CHECK (resolution IN ('revoked', 'kept')),
  CHECK ((resolved_at IS NULL) = (resolution IS NULL))
);
CREATE UNIQUE INDEX consent_revoke_requests_open ON public.consent_revoke_requests (child_id, scope, requested_by)
  WHERE resolved_at IS NULL;
ALTER TABLE public.consent_revoke_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consent_revoke_requests FROM anon, authenticated;
GRANT SELECT ON public.consent_revoke_requests TO authenticated;
CREATE POLICY "consent_revoke_requests: owner or author select" ON public.consent_revoke_requests
  FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.has_child_access(child_id, 'owner'));

CREATE FUNCTION public.request_consent_revoke(target_child uuid, consent_scope text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_real_user() OR NOT public.has_child_access(target_child, 'guardian') THEN
    RAISE EXCEPTION 'no access' USING ERRCODE = '42501';
  END IF;
  -- Владельцу просить некого — он отзывает сам.
  IF public.has_child_access(target_child, 'owner') THEN
    RAISE EXCEPTION 'the owner revokes directly' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.consent_revoke_requests (child_id, scope, requested_by)
  VALUES (target_child, consent_scope, auth.uid())
  ON CONFLICT DO NOTHING;
END;
$$;

-- Владелец оставляет согласие. Отзыв закрывает запросы сам — ниже, в триггере.
CREATE FUNCTION public.dismiss_consent_revoke(target_child uuid, consent_scope text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_real_user() OR NOT public.has_child_access(target_child, 'owner') THEN
    RAISE EXCEPTION 'only the owner decides' USING ERRCODE = '42501';
  END IF;
  UPDATE public.consent_revoke_requests SET resolved_at = now(), resolution = 'kept'
  WHERE child_id = target_child AND scope = consent_scope AND resolved_at IS NULL;
END;
$$;

CREATE FUNCTION public.resolve_revoke_requests() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.action = 'revoke' AND NEW.child_id IS NOT NULL THEN
    UPDATE public.consent_revoke_requests SET resolved_at = now(), resolution = 'revoked'
    WHERE child_id = NEW.child_id AND scope = NEW.scope AND resolved_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER consent_events_resolve_requests AFTER INSERT ON public.consent_events
  FOR EACH ROW EXECUTE FUNCTION public.resolve_revoke_requests();

-- ---------------------------------------------------------------------------
-- Заявки второго родителя: владелец видит, кто просится
-- ---------------------------------------------------------------------------

-- По одному uuid владелец не отличит второго родителя от того, кто подобрал код.
-- Почта маскируется: владельцу хватает узнать своего, остальное ему не нужно.
CREATE FUNCTION public.pending_requests(target_child uuid)
RETURNS TABLE (user_id uuid, email_hint text, requested_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_real_user() OR NOT public.has_child_access(target_child, 'owner') THEN
    RAISE EXCEPTION 'only the owner sees requests' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT g.user_id,
         CASE WHEN u.email IS NULL OR position('@' IN u.email) < 2 THEN NULL
              ELSE left(u.email, 1) || '***' || substr(u.email, position('@' IN u.email))
         END,
         g.created_at
  FROM public.child_guardians g
  JOIN auth.users u ON u.id = g.user_id
  WHERE g.child_id = target_child AND g.status = 'pending'
  ORDER BY g.created_at;
END;
$$;

-- ---------------------------------------------------------------------------
-- Журнал доступа: переживает удаление ребёнка, причина удаления строки явная
-- ---------------------------------------------------------------------------

-- История того, кто видел данные ребёнка, не уходит каскадом вместе с ним —
-- остаётся под псевдонимом со сроком, как согласия.
ALTER TABLE public.child_access_log DROP CONSTRAINT child_access_log_child_id_fkey;
ALTER TABLE public.child_access_log ADD COLUMN retain_until timestamptz;
ALTER TABLE public.child_access_log DROP CONSTRAINT child_access_log_event_check;
ALTER TABLE public.child_access_log ADD CONSTRAINT child_access_log_event_check
  CHECK (event IN ('requested', 'granted', 'revoked', 'left', 'expired', 'transferred_in', 'transferred_out'));

-- Причина удаления строки доступа. Без неё любое удаление без auth.uid() — и
-- истёкшая заявка, и административный отзыв — писалось бы как «вышел сам».
-- Ставится вызывающим на время транзакции: set_config('talentia.removal', …, true).
CREATE OR REPLACE FUNCTION public.child_guardians_audit() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  reason text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.child_access_log (child_id, user_id, role, event, by_user)
    VALUES (NEW.child_id, NEW.user_id, NEW.role,
            CASE WHEN NEW.status = 'pending' THEN 'requested' ELSE 'granted' END, auth.uid());
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'pending' AND NEW.status = 'active' THEN
      INSERT INTO public.child_access_log (child_id, user_id, role, event, by_user)
      VALUES (NEW.child_id, NEW.user_id, NEW.role, 'granted', auth.uid());
    END IF;
    RETURN NEW;
  END IF;
  -- DELETE. Строки удаляемого ребёнка уходят каскадом — их не пишем: удаление
  -- ребёнка видно по псевдониму в самом журнале.
  IF EXISTS (SELECT 1 FROM public.children WHERE id = OLD.child_id) THEN
    reason := nullif(current_setting('talentia.removal', true), '');
    INSERT INTO public.child_access_log (child_id, user_id, role, event, by_user)
    VALUES (OLD.child_id, OLD.user_id, OLD.role,
            coalesce(reason, CASE WHEN OLD.user_id = auth.uid() THEN 'left' ELSE 'revoked' END),
            auth.uid());
  END IF;
  -- Ребёнок без владельца — сирота, которого некому удалить. Передача владения идёт
  -- функцией до удаления; если её не было — ребёнок удаляется.
  IF OLD.role = 'owner' THEN
    DELETE FROM public.children WHERE id = OLD.child_id;
  END IF;
  RETURN OLD;
END;
$$;

-- ---------------------------------------------------------------------------
-- Псевдонимы: только настоящий идентификатор, только однажды, только на свежий
-- ---------------------------------------------------------------------------

-- Удаление ребёнка: согласия и журнал доступа — под одним псевдонимом со сроком.
CREATE OR REPLACE FUNCTION public.children_pseudonymize_consent() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  pseudonym constant uuid := gen_random_uuid();
BEGIN
  UPDATE public.consent_events
  SET child_id = pseudonym, retain_until = coalesce(retain_until, now() + interval '3 years')
  WHERE child_id = OLD.id;
  UPDATE public.child_access_log
  SET child_id = pseudonym, retain_until = coalesce(retain_until, now() + interval '3 years')
  WHERE child_id = OLD.id;
  RETURN OLD;
END;
$$;

-- Удаление аккаунта. Срок хранения получают только события, которые больше
-- ничему не служат: согласие аккаунта и согласия уже удалённых детей. Согласие на
-- ребёнка, которого передали другому родителю, остаётся бессрочным, пока жив
-- ребёнок, — иначе через три года очистка стёрла бы основание для данных, которые
-- продолжают лежать в облаке.
CREATE OR REPLACE FUNCTION public.users_pseudonymize() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  pseudonym constant uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('talentia.removal', 'left', true);
  DELETE FROM public.child_guardians WHERE user_id = OLD.id;
  PERFORM set_config('talentia.removal', '', true);
  UPDATE public.consent_events e
  SET actor_id = pseudonym,
      retain_until = CASE
        WHEN e.child_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.children c WHERE c.id = e.child_id)
          THEN coalesce(e.retain_until, now() + interval '3 years')
        ELSE e.retain_until
      END
  WHERE e.actor_id = OLD.id;
  UPDATE public.child_access_log SET user_id = pseudonym WHERE user_id = OLD.id;
  UPDATE public.child_access_log SET by_user = pseudonym WHERE by_user = OLD.id;
  UPDATE public.consent_revoke_requests SET requested_by = pseudonym WHERE requested_by = OLD.id;
  RETURN OLD;
END;
$$;

-- Защита журналов от роли, обходящей RLS. Разрешено ровно то, что делает
-- псевдонимизация:
--   · заменить идентификатор можно, только пока он настоящий (есть в children или
--     auth.users) — второй раз уже не выйдет; и только на свежий, которого нет
--     нигде, — перевесить запись на живого ребёнка нельзя;
--   · срок хранения ставится только из пустого и не короче трёх лет — сдвинуть его
--     в прошлое, чтобы затем удалить, нельзя;
--   · удалить — только по истечении срока; TRUNCATE — никогда.
-- От суперпользователя это не защищает: он отключит триггер. Защищает от ошибки и
-- от service-role.
CREATE FUNCTION public.id_is_real(x uuid) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.children WHERE id = x) OR EXISTS (SELECT 1 FROM auth.users WHERE id = x);
$$;

CREATE FUNCTION public.id_change_allowed(old_id uuid, new_id uuid) RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT old_id IS NOT DISTINCT FROM new_id
      OR (old_id IS NOT NULL AND new_id IS NOT NULL AND public.id_is_real(old_id) AND NOT public.id_is_real(new_id));
$$;

CREATE FUNCTION public.retain_change_allowed(old_until timestamptz, new_until timestamptz) RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT old_until IS NOT DISTINCT FROM new_until
      OR (old_until IS NULL AND new_until >= now() + interval '3 years' - interval '1 day');
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
     OR NOT public.id_change_allowed(OLD.child_id, NEW.child_id)
     OR NOT public.id_change_allowed(OLD.actor_id, NEW.actor_id)
     OR NOT public.retain_change_allowed(OLD.retain_until, NEW.retain_until) THEN
    RAISE EXCEPTION 'consent_events is append-only' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.child_access_log_guard() RETURNS trigger
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
     OR NOT public.id_change_allowed(OLD.child_id, NEW.child_id)
     OR NOT public.id_change_allowed(OLD.user_id, NEW.user_id)
     OR NOT public.id_change_allowed(OLD.by_user, NEW.by_user)
     OR NOT public.retain_change_allowed(OLD.retain_until, NEW.retain_until) THEN
    RAISE EXCEPTION 'child_access_log is append-only' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER child_access_log_append_only
  BEFORE UPDATE OR DELETE ON public.child_access_log
  FOR EACH ROW EXECUTE FUNCTION public.child_access_log_guard();

CREATE FUNCTION public.forbid_truncate() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER consent_events_no_truncate BEFORE TRUNCATE ON public.consent_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.forbid_truncate();
CREATE TRIGGER child_access_log_no_truncate BEFORE TRUNCATE ON public.child_access_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.forbid_truncate();

-- ---------------------------------------------------------------------------
-- Лимиты без гонок
-- ---------------------------------------------------------------------------

-- Параллельные вставки считали бы по одному снимку и проходили вдвоём.
-- Блокировка на ребёнка и на владельца — до конца транзакции.
CREATE OR REPLACE FUNCTION public.guardian_limits() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('child:' || NEW.child_id::text));
  IF NEW.role = 'owner' THEN
    PERFORM pg_advisory_xact_lock(hashtext('owner:' || NEW.user_id::text));
    IF (SELECT count(*) FROM public.child_guardians WHERE user_id = NEW.user_id AND role = 'owner') >= 10 THEN
      RAISE EXCEPTION 'too many children for one account' USING ERRCODE = '54000';
    END IF;
  END IF;
  IF (SELECT count(*) FROM public.child_guardians WHERE child_id = NEW.child_id) >= 4 THEN
    RAISE EXCEPTION 'too many adults for one child' USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_child_invite(target_child uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw bytea;
  code text := '';
  i int;
BEGIN
  IF NOT public.is_real_user() OR NOT public.has_child_access(target_child, 'owner') THEN
    RAISE EXCEPTION 'only the owner can invite' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('invites:' || target_child::text));
  IF (SELECT count(*) FROM public.child_access_invites
      WHERE child_id = target_child AND redeemed_at IS NULL AND expires_at > now()) >= 3 THEN
    RAISE EXCEPTION 'too many active invites' USING ERRCODE = '54000';
  END IF;
  raw := uuid_send(gen_random_uuid());
  -- байты 6 и 8 несут версию и вариант UUID — берём только полностью случайные
  FOREACH i IN ARRAY ARRAY[0, 1, 2, 3, 4, 5, 10, 11] LOOP
    code := code || substr(alphabet, get_byte(raw, i) % 32 + 1, 1);
  END LOOP;
  INSERT INTO public.child_access_invites (code_hash, child_id, created_by)
  VALUES (sha256(convert_to(code, 'UTF8')), target_child, auth.uid());
  RETURN code;
END;
$$;

-- ---------------------------------------------------------------------------
-- Прохождения: дата не из будущего — иначе ею уходят от очистки
-- ---------------------------------------------------------------------------

ALTER TABLE public.lesson_runs
  ADD CONSTRAINT started_at_not_future CHECK (started_at <= created_at + interval '1 day');

-- ---------------------------------------------------------------------------
-- Ретеншн: неподтверждённые заявки, журнал доступа; расписание можно поставить позже
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.purge_expired() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.lesson_runs WHERE started_at < now() - interval '12 months';
  DELETE FROM public.child_access_invites WHERE expires_at < now() - interval '7 days';
  DELETE FROM public.invite_attempts WHERE at < now() - interval '1 day';
  -- Неподтверждённая заявка живёт 72 часа, как код: иначе висит вечно и занимает
  -- место в лимите взрослых на ребёнка.
  PERFORM set_config('talentia.removal', 'expired', true);
  DELETE FROM public.child_guardians WHERE status = 'pending' AND created_at < now() - interval '72 hours';
  PERFORM set_config('talentia.removal', '', true);
  DELETE FROM public.consent_events WHERE retain_until IS NOT NULL AND retain_until < now();
  DELETE FROM public.child_access_log WHERE retain_until IS NOT NULL AND retain_until < now();
  DELETE FROM public.consent_revoke_requests WHERE resolved_at < now() - interval '12 months';
END;
$$;

-- Если pg_cron включат в панели уже после накатки, задание не появилось бы
-- никогда. Эта функция ставит его в любой момент: после включения pg_cron —
-- `SELECT public.ensure_purge_scheduled();` из SQL-редактора.
CREATE FUNCTION public.ensure_purge_scheduled() RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE WARNING 'pg_cron не установлен: purge_expired() не запланирована';
    RETURN false;
  END IF;
  EXECUTE $cron$SELECT cron.schedule('talentia-purge-expired', '17 3 * * *', 'SELECT public.purge_expired()')$cron$;
  RETURN true;
END;
$$;
SELECT public.ensure_purge_scheduled();

-- ---------------------------------------------------------------------------
-- Права
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.request_consent_revoke(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dismiss_consent_revoke(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pending_requests(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_consent_revoke(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_consent_revoke(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pending_requests(uuid) TO authenticated;

-- Служебные — не вызываются клиентом вовсе.
REVOKE ALL ON FUNCTION public.resolve_revoke_requests() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.id_is_real(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.id_change_allowed(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retain_change_allowed(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.child_access_log_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.forbid_truncate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_purge_scheduled() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON public.consent_revoke_requests FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.consent_revoke_requests, public.child_access_log FROM authenticated;
