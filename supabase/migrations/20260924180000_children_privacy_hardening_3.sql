-- Исправления по третьей проверке child-privacy-compliance. Отдельным файлом:
-- существующие миграции не редактируются.

-- ---------------------------------------------------------------------------
-- Псевдонимы — только после удаления и только однажды
-- ---------------------------------------------------------------------------

-- Прежнее правило разрешало заменить идентификатор, пока он «настоящий», — то есть
-- пока ребёнок жив. Роль в обход RLS заменяла child_id в записи ОТЗЫВА, отзыв
-- отвязывался от ребёнка, и отозванное согласие начинало действовать снова.
--
-- Теперь замена разрешена, только когда сущности уже нет (ни старого, ни нового
-- идентификатора нет в children и auth.users), и только однажды: отметка
-- *_pseudonymized_at ставится из пустого и больше не меняется. Поэтому замена
-- переезжает в AFTER DELETE — к этому моменту строки уже нет.
ALTER TABLE public.consent_events
  ADD COLUMN child_pseudonymized_at timestamptz,
  ADD COLUMN actor_pseudonymized_at timestamptz;
ALTER TABLE public.child_access_log
  ADD COLUMN child_pseudonymized_at timestamptz,
  ADD COLUMN user_pseudonymized_at timestamptz,
  ADD COLUMN by_pseudonymized_at timestamptz;

CREATE FUNCTION public.pseudonym_change_allowed(
  old_id uuid, new_id uuid, old_mark timestamptz, new_mark timestamptz
) RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT (old_id IS NOT DISTINCT FROM new_id AND old_mark IS NOT DISTINCT FROM new_mark)
      OR (old_mark IS NULL AND new_mark IS NOT NULL
          AND old_id IS NOT NULL AND new_id IS NOT NULL
          AND NOT public.id_is_real(old_id) AND NOT public.id_is_real(new_id));
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
     OR NOT public.retain_change_allowed(OLD.retain_until, NEW.retain_until) THEN
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
     OR NOT public.retain_change_allowed(OLD.retain_until, NEW.retain_until) THEN
    RAISE EXCEPTION 'child_access_log is append-only' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP FUNCTION public.id_change_allowed(uuid, uuid);

-- Удаление ребёнка: замена — после удаления строки.
DROP TRIGGER children_pseudonymize_consent ON public.children;
CREATE OR REPLACE FUNCTION public.children_pseudonymize_consent() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  pseudonym constant uuid := gen_random_uuid();
BEGIN
  UPDATE public.consent_events
  SET child_id = pseudonym, child_pseudonymized_at = now(),
      retain_until = coalesce(retain_until, now() + interval '3 years')
  WHERE child_id = OLD.id;
  UPDATE public.child_access_log
  SET child_id = pseudonym, child_pseudonymized_at = now(),
      retain_until = coalesce(retain_until, now() + interval '3 years')
  WHERE child_id = OLD.id;
  RETURN OLD;
END;
$$;
CREATE TRIGGER children_pseudonymize_consent AFTER DELETE ON public.children
  FOR EACH ROW EXECUTE FUNCTION public.children_pseudonymize_consent();

-- Удаление аккаунта — в два шага. BEFORE снимает доступы, пока строка пользователя
-- есть: записи «left» появляются в журнале до замены, и срабатывает правило «без
-- сирот». AFTER заменяет идентификатор, когда пользователя уже нет.
DROP TRIGGER users_pseudonymize ON auth.users;

CREATE FUNCTION public.users_release_access() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM set_config('talentia.removal', 'left', true);
  DELETE FROM public.child_guardians WHERE user_id = OLD.id;
  PERFORM set_config('talentia.removal', '', true);
  RETURN OLD;
END;
$$;
CREATE TRIGGER users_release_access BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.users_release_access();

CREATE OR REPLACE FUNCTION public.users_pseudonymize() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  pseudonym constant uuid := gen_random_uuid();
BEGIN
  -- Срок получают только события, которые больше ничему не служат: согласие
  -- аккаунта и согласия уже удалённых детей. Согласие на переданного ребёнка
  -- остаётся бессрочным, пока ребёнок жив.
  UPDATE public.consent_events e
  SET actor_id = pseudonym, actor_pseudonymized_at = now(),
      retain_until = CASE
        WHEN e.child_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.children c WHERE c.id = e.child_id)
          THEN coalesce(e.retain_until, now() + interval '3 years')
        ELSE e.retain_until
      END
  WHERE e.actor_id = OLD.id;
  UPDATE public.child_access_log SET user_id = pseudonym, user_pseudonymized_at = now() WHERE user_id = OLD.id;
  UPDATE public.child_access_log SET by_user = pseudonym, by_pseudonymized_at = now() WHERE by_user = OLD.id;
  UPDATE public.consent_revoke_requests SET requested_by = pseudonym WHERE requested_by = OLD.id;
  RETURN OLD;
END;
$$;
CREATE TRIGGER users_pseudonymize AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.users_pseudonymize();

-- ---------------------------------------------------------------------------
-- Служебные колонки клиент не пишет
-- ---------------------------------------------------------------------------

-- created_at задавал клиент — и датой из будущего уводил прохождение от очистки.
REVOKE INSERT, UPDATE ON public.lesson_runs FROM authenticated;
GRANT INSERT (id, child_id, lesson_id, started_at, task_seconds, review_tasks) ON public.lesson_runs TO authenticated;

REVOKE INSERT, UPDATE ON public.skill_state FROM authenticated;
GRANT INSERT (child_id, skill, box, correct_in_row, attempts, correct, last_seen_lesson) ON public.skill_state TO authenticated;
GRANT UPDATE (box, correct_in_row, attempts, correct, last_seen_lesson) ON public.skill_state TO authenticated;

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER skill_state_touch BEFORE UPDATE ON public.skill_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Тексты согласий: чем доказать, что именно видел родитель
-- ---------------------------------------------------------------------------

-- Строка «v3» через два года не докажет ничего. Хеш текста, язык и дата
-- публикации — докажут. Пока таблица пуста, добавить колонки дёшево.
--
-- Версия уникальна в пределах области и включает язык («ru-2026-10»): согласие
-- ссылается на версию, по версии находится ровно один текст и его хеш.
-- Действующей может быть одна версия на область и язык.
ALTER TABLE public.consent_texts
  ADD COLUMN locale text NOT NULL CHECK (locale IN ('ru', 'en', 'ky')),
  ADD COLUMN body_sha256 bytea NOT NULL CHECK (length(body_sha256) = 32),
  ADD COLUMN published_at timestamptz NOT NULL DEFAULT now();
DROP INDEX public.consent_texts_one_current;
CREATE UNIQUE INDEX consent_texts_one_current ON public.consent_texts (scope, locale) WHERE is_current;

-- ---------------------------------------------------------------------------
-- Проверка согласия: для сервера — отдельная функция
-- ---------------------------------------------------------------------------

-- has_consent требует доступа к ребёнку, а у прокси с ключом service-role нет
-- auth.uid(): ответ был бы всегда «нет», и его «починили» бы, открыв доступ шире
-- нужного. Для сервера — consent_active без проверки доступа, только service_role.
CREATE FUNCTION public.consent_active(target_child uuid, consent_scope text) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce((
    SELECT e.action = 'grant'
       AND EXISTS (SELECT 1 FROM public.consent_texts t
                   WHERE t.scope = consent_scope AND t.version = e.text_version AND t.is_current)
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

CREATE OR REPLACE FUNCTION public.has_consent(target_child uuid, consent_scope text) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.has_child_access(target_child, 'guardian') AND public.consent_active(target_child, consent_scope);
$$;

-- ---------------------------------------------------------------------------
-- Заявки: подсказка почты различимее, почта подтверждена
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pending_requests(target_child uuid)
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
         CASE
           WHEN u.email IS NULL OR position('@' IN u.email) < 2 THEN NULL
           -- короткое имя ящика: только первая буква, иначе оно раскрыто целиком
           WHEN position('@' IN u.email) <= 4 THEN left(u.email, 1) || '***' || substr(u.email, position('@' IN u.email))
           ELSE left(u.email, 2) || '***' || substr(u.email, position('@' IN u.email) - 1)
         END,
         g.created_at
  FROM public.child_guardians g
  JOIN auth.users u ON u.id = g.user_id
  WHERE g.child_id = target_child AND g.status = 'pending'
  ORDER BY g.created_at;
END;
$$;

-- Заявка с неподтверждённой почтой не принимается: по такой почте владелец не
-- узнает своего, а завести ящик на чужое имя ничего не стоит.
CREATE OR REPLACE FUNCTION public.redeem_child_invite(invite_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inv public.child_access_invites%ROWTYPE;
BEGIN
  IF NOT public.is_real_user() THEN
    RETURN 'not_allowed';
  END IF;
  IF (SELECT email_confirmed_at FROM auth.users WHERE id = auth.uid()) IS NULL THEN
    RETURN 'email_unconfirmed';
  END IF;
  IF (SELECT count(*) FROM public.invite_attempts
      WHERE user_id = auth.uid() AND at > now() - interval '1 hour') >= 10 THEN
    RETURN 'rate_limited';
  END IF;
  SELECT * INTO inv
  FROM public.child_access_invites
  WHERE code_hash = sha256(convert_to(upper(trim(invite_code)), 'UTF8'))
  FOR UPDATE;
  IF NOT FOUND OR inv.redeemed_at IS NOT NULL OR inv.expires_at <= now() THEN
    INSERT INTO public.invite_attempts (user_id) VALUES (auth.uid());
    RETURN 'invalid';
  END IF;
  IF EXISTS (SELECT 1 FROM public.child_guardians WHERE child_id = inv.child_id AND user_id = auth.uid()) THEN
    RETURN 'already_linked';
  END IF;
  INSERT INTO public.child_guardians (child_id, user_id, role, status)
  VALUES (inv.child_id, auth.uid(), inv.role, 'pending');
  UPDATE public.child_access_invites
  SET redeemed_by = auth.uid(), redeemed_at = now()
  WHERE code_hash = inv.code_hash;
  RETURN 'pending_approval';
END;
$$;

-- ---------------------------------------------------------------------------
-- Передача: семь дней не продлеваются передачей туда-обратно
-- ---------------------------------------------------------------------------

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
  -- Срок ставится только если за 30 дней передач не было: иначе A→B→A→B
  -- продлевал бы неделю без конца, и новый владелец не давал бы своего согласия.
  IF NOT EXISTS (SELECT 1 FROM public.child_access_log
                 WHERE child_id = target_child AND event = 'transferred_in' AND at > now() - interval '30 days') THEN
    UPDATE public.children SET consent_grace_until = now() + interval '7 days' WHERE id = target_child;
  END IF;
  -- Порядок важен: уникальный индекс «один владелец» не допускает двух сразу.
  UPDATE public.child_guardians SET role = 'guardian' WHERE child_id = target_child AND user_id = auth.uid();
  UPDATE public.child_guardians SET role = 'owner' WHERE child_id = target_child AND user_id = new_owner;
  INSERT INTO public.child_access_log (child_id, user_id, role, event, by_user) VALUES
    (target_child, auth.uid(), 'guardian', 'transferred_out', auth.uid()),
    (target_child, new_owner, 'owner', 'transferred_in', auth.uid());
END;
$$;

-- ---------------------------------------------------------------------------
-- Запросы на отзыв: не чаще раза в 30 дней после отказа, отзываются при уходе
-- ---------------------------------------------------------------------------

ALTER TABLE public.consent_revoke_requests DROP CONSTRAINT consent_revoke_requests_resolution_check;
ALTER TABLE public.consent_revoke_requests ADD CONSTRAINT consent_revoke_requests_resolution_check
  CHECK (resolution IN ('revoked', 'kept', 'withdrawn'));

CREATE OR REPLACE FUNCTION public.request_consent_revoke(target_child uuid, consent_scope text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_real_user() OR NOT public.has_child_access(target_child, 'guardian') THEN
    RAISE EXCEPTION 'no access' USING ERRCODE = '42501';
  END IF;
  IF public.has_child_access(target_child, 'owner') THEN
    RAISE EXCEPTION 'the owner revokes directly' USING ERRCODE = '22023';
  END IF;
  -- Владелец ответил «оставить» — повторный запрос не раньше чем через 30 дней:
  -- запросы не должны превращаться в давление.
  IF EXISTS (SELECT 1 FROM public.consent_revoke_requests
             WHERE child_id = target_child AND scope = consent_scope AND requested_by = auth.uid()
               AND resolution = 'kept' AND resolved_at > now() - interval '30 days') THEN
    RAISE EXCEPTION 'owner has just decided; try later' USING ERRCODE = '54000';
  END IF;
  INSERT INTO public.consent_revoke_requests (child_id, scope, requested_by)
  VALUES (target_child, consent_scope, auth.uid())
  ON CONFLICT DO NOTHING;
END;
$$;

-- ---------------------------------------------------------------------------
-- Журнал доступа: отклонённая заявка — «отклонена», а не «отозвана»
-- ---------------------------------------------------------------------------

ALTER TABLE public.child_access_log DROP CONSTRAINT child_access_log_event_check;
ALTER TABLE public.child_access_log ADD CONSTRAINT child_access_log_event_check
  CHECK (event IN ('requested', 'granted', 'rejected', 'revoked', 'left', 'expired', 'transferred_in', 'transferred_out'));

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
    -- Ставший владельцем отзывает сам — его прежний запрос теряет смысл.
    IF NEW.role = 'owner' AND OLD.role <> 'owner' THEN
      UPDATE public.consent_revoke_requests SET resolved_at = now(), resolution = 'withdrawn'
      WHERE child_id = NEW.child_id AND requested_by = NEW.user_id AND resolved_at IS NULL;
    END IF;
    RETURN NEW;
  END IF;
  -- DELETE. Строки удаляемого ребёнка уходят каскадом — их не пишем.
  IF EXISTS (SELECT 1 FROM public.children WHERE id = OLD.child_id) THEN
    reason := nullif(current_setting('talentia.removal', true), '');
    INSERT INTO public.child_access_log (child_id, user_id, role, event, by_user)
    VALUES (OLD.child_id, OLD.user_id, OLD.role,
            coalesce(reason, CASE
              WHEN OLD.user_id = auth.uid() THEN 'left'
              WHEN OLD.status = 'pending' THEN 'rejected'
              ELSE 'revoked'
            END),
            auth.uid());
    -- Ушедший больше не участвует — его открытый запрос отзывается.
    UPDATE public.consent_revoke_requests SET resolved_at = now(), resolution = 'withdrawn'
    WHERE child_id = OLD.child_id AND requested_by = OLD.user_id AND resolved_at IS NULL;
  END IF;
  IF OLD.role = 'owner' THEN
    DELETE FROM public.children WHERE id = OLD.child_id;
  END IF;
  RETURN OLD;
END;
$$;

-- ---------------------------------------------------------------------------
-- Права
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.consent_active(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consent_active(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.pseudonym_change_allowed(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.users_release_access() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
