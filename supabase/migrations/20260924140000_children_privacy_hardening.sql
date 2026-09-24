-- Исправления по проверке child-privacy-compliance к 20260924120000_children_and_guardians.sql.
-- Отдельным файлом: существующие миграции не редактируются.
--
-- Решения владельца продукта:
--   1. Владелец, удаляя аккаунт, выбирает для каждого ребёнка: удалить или передать
--      второму родителю (transfer_child_ownership). Ребёнок без владельца не
--      остаётся никогда: если передачи не было, он удаляется вместе со строкой
--      владельца.
--   2. Второй родитель по коду попадает в «ожидание» и получает доступ только после
--      подтверждения владельцем (approve_guardian). Перебор кода не даёт ничего.
--   3. Согласия на ИИ-разговор и голос даёт и отзывает только владелец. Облачная
--      синхронизация — тоже: её отзыв удаляет ребёнка из облака целиком, а удалять
--      ребёнка может только владелец.

-- ---------------------------------------------------------------------------
-- Тексты согласий: какая версия действует сейчас. Сервер сверяет с ней, а не
-- верит клиенту.
-- ---------------------------------------------------------------------------

CREATE TABLE public.consent_texts (
  scope      text NOT NULL CHECK (scope IN ('account_local', 'cloud_sync', 'companion_ai', 'voice_asr', 'telemetry')),
  version    text NOT NULL CHECK (version <> ''),
  is_current boolean NOT NULL DEFAULT false,
  PRIMARY KEY (scope, version)
);
CREATE UNIQUE INDEX consent_texts_one_current ON public.consent_texts (scope) WHERE is_current;
ALTER TABLE public.consent_texts ENABLE ROW LEVEL SECURITY;
-- Тексты публичны для вошедших; меняются только миграцией или service-role.
CREATE POLICY "consent_texts: read" ON public.consent_texts FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Журнал согласий: время ставит сервер, автор — сервер, правка невозможна
-- ---------------------------------------------------------------------------

-- `at` был временем, которое заявляет устройство: согласие можно было записать
-- задним числом. Остаётся как client_at (нужно офлайну), рядом — серверное.
ALTER TABLE public.consent_events RENAME COLUMN at TO client_at;
ALTER TABLE public.consent_events
  ADD COLUMN received_at timestamptz NOT NULL DEFAULT now(),
  -- Заполняется при псевдонимизации: журнал живёт «жизнь аккаунта плюс три года».
  ADD COLUMN retain_until timestamptz,
  ADD CONSTRAINT consent_client_at_not_future CHECK (client_at <= received_at + interval '5 minutes');
ALTER TABLE public.consent_events ALTER COLUMN actor_id SET DEFAULT auth.uid();

-- Клиент пишет только содержательные колонки. actor_id, received_at и
-- retain_until ставит сервер.
REVOKE ALL ON public.consent_events FROM anon, authenticated;
GRANT SELECT ON public.consent_events TO authenticated;
GRANT INSERT (id, scope, action, child_id, text_version, confirmed_by, client_at) ON public.consent_events TO authenticated;

-- Append-only держится не только на отсутствии политик. Единственная допустимая
-- правка — замена идентификаторов псевдонимом при удалении; единственное
-- допустимое удаление — по истечении срока хранения.
CREATE FUNCTION public.consent_events_guard() RETURNS trigger
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
  IF (NEW.id, NEW.scope, NEW.action, NEW.text_version, NEW.confirmed_by, NEW.client_at, NEW.received_at)
     IS DISTINCT FROM
     (OLD.id, OLD.scope, OLD.action, OLD.text_version, OLD.confirmed_by, OLD.client_at, OLD.received_at) THEN
    RAISE EXCEPTION 'consent_events is append-only' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER consent_events_append_only
  BEFORE UPDATE OR DELETE ON public.consent_events
  FOR EACH ROW EXECUTE FUNCTION public.consent_events_guard();

-- ---------------------------------------------------------------------------
-- Ожидание подтверждения и журнал доступа
-- ---------------------------------------------------------------------------

ALTER TABLE public.child_guardians
  ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active')),
  -- Владелец всегда действующий: ожидать ему нечего.
  ADD CONSTRAINT owner_is_active CHECK (role <> 'owner' OR status = 'active');

-- Кто, когда и кому давал и терял доступ. Append-only: родитель должен видеть, кто
-- смотрел данные ребёнка, а задним числом это не восстановить. user_id и by_user
-- без внешних ключей — запись переживает удаление аккаунта (с псевдонимом).
CREATE TABLE public.child_access_log (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL,
  role     text NOT NULL,
  event    text NOT NULL CHECK (event IN ('requested', 'granted', 'revoked', 'left', 'transferred_in', 'transferred_out')),
  by_user  uuid,
  at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX child_access_log_child ON public.child_access_log (child_id, at);
ALTER TABLE public.child_access_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.child_access_log FROM anon, authenticated;
GRANT SELECT ON public.child_access_log TO authenticated;
CREATE POLICY "child_access_log: owner or self select" ON public.child_access_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_child_access(child_id, 'owner'));

-- ---------------------------------------------------------------------------
-- Доступ: только действующие строки, search_path пустой
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_child_access(target_child uuid, min_role text DEFAULT 'guardian')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.child_guardians g
    WHERE g.child_id = target_child
      AND g.user_id = auth.uid()
      AND g.status = 'active'
      AND (g.expires_at IS NULL OR g.expires_at > now())
      AND CASE min_role
            WHEN 'owner'      THEN g.role = 'owner'
            WHEN 'guardian'   THEN g.role IN ('owner', 'guardian')
            WHEN 'specialist' THEN true
            ELSE false
          END
  );
$$;

-- Анонимный вход Supabase выдаёт роль authenticated и auth.uid(). Такой
-- пользователь не родитель: ни ребёнка, ни доступа к чужому.
CREATE FUNCTION public.is_real_user() RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
     AND NOT coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'is_anonymous')::boolean, false);
$$;

-- Действует ли согласие: последнее событие этой области для ребёнка — grant на
-- текущую версию текста.
CREATE FUNCTION public.has_consent(target_child uuid, consent_scope text) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce((
    SELECT e.action = 'grant'
       AND e.text_version = (SELECT t.version FROM public.consent_texts t WHERE t.scope = consent_scope AND t.is_current)
    FROM public.consent_events e
    WHERE e.child_id = target_child AND e.scope = consent_scope
    ORDER BY e.received_at DESC, e.client_at DESC
    LIMIT 1
  ), false);
$$;

-- ---------------------------------------------------------------------------
-- Лимиты
-- ---------------------------------------------------------------------------

-- Не защита от целевой атаки, а потолок, за которым аккаунт явно не семья.
CREATE FUNCTION public.guardian_limits() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role = 'owner'
     AND (SELECT count(*) FROM public.child_guardians WHERE user_id = NEW.user_id AND role = 'owner') >= 10 THEN
    RAISE EXCEPTION 'too many children for one account' USING ERRCODE = '54000';
  END IF;
  IF (SELECT count(*) FROM public.child_guardians WHERE child_id = NEW.child_id) >= 4 THEN
    RAISE EXCEPTION 'too many adults for one child' USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER child_guardians_limits BEFORE INSERT ON public.child_guardians
  FOR EACH ROW EXECUTE FUNCTION public.guardian_limits();

-- ---------------------------------------------------------------------------
-- Журнал доступа и защита от сирот — триггерами, чтобы ни один путь их не обошёл
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.child_guardians_audit() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
  -- DELETE: строки удалённого ребёнка уходят каскадом вместе с журналом — не пишем.
  IF EXISTS (SELECT 1 FROM public.children WHERE id = OLD.child_id) THEN
    INSERT INTO public.child_access_log (child_id, user_id, role, event, by_user)
    VALUES (OLD.child_id, OLD.user_id, OLD.role,
            -- без auth.uid() — взрослый удаляет свой аккаунт через service-role
            CASE WHEN auth.uid() IS NULL OR OLD.user_id = auth.uid() THEN 'left' ELSE 'revoked' END, auth.uid());
  END IF;
  -- Ребёнок без владельца — сирота, которого некому удалить, а второй родитель
  -- сохранил бы полный доступ навсегда. Передача владения идёт функцией до
  -- удаления; если её не было — ребёнок удаляется.
  IF OLD.role = 'owner' THEN
    DELETE FROM public.children WHERE id = OLD.child_id;
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER child_guardians_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.child_guardians
  FOR EACH ROW EXECUTE FUNCTION public.child_guardians_audit();

-- Удаление ребёнка: согласия остаются доказательством, но под псевдонимом — одним
-- на ребёнка, чтобы журнал не терял связность, — и с этого момента у них есть срок
-- хранения.
CREATE FUNCTION public.children_pseudonymize_consent() RETURNS trigger
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
  RETURN OLD;
END;
$$;
CREATE TRIGGER children_pseudonymize_consent BEFORE DELETE ON public.children
  FOR EACH ROW EXECUTE FUNCTION public.children_pseudonymize_consent();

-- Удаление аккаунта (auth.admin.deleteUser из функции с service-role): псевдоним
-- взрослого в журналах. Свой псевдоним, не общий с ребёнком: иначе две сущности
-- склеиваются.
--
-- BEFORE, а не AFTER, и строки доступа удаляются здесь явно, до каскада: каскад
-- срабатывает раньше AFTER-триггера на auth.users, но записи «left», которые он
-- порождает в журнале доступа, появлялись бы уже после замены — и оставались бы с
-- настоящим идентификатором. Удаление строк здесь же запускает правило «без
-- сирот»: непереданные дети владельца удаляются.
CREATE FUNCTION public.users_pseudonymize() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  pseudonym constant uuid := gen_random_uuid();
BEGIN
  DELETE FROM public.child_guardians WHERE user_id = OLD.id;
  UPDATE public.consent_events
  SET actor_id = pseudonym, retain_until = coalesce(retain_until, now() + interval '3 years')
  WHERE actor_id = OLD.id;
  UPDATE public.child_access_log SET user_id = pseudonym WHERE user_id = OLD.id;
  UPDATE public.child_access_log SET by_user = pseudonym WHERE by_user = OLD.id;
  RETURN OLD;
END;
$$;
CREATE TRIGGER users_pseudonymize BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.users_pseudonymize();

-- ---------------------------------------------------------------------------
-- Ребёнок появляется в облаке только вместе с согласием на облако
-- ---------------------------------------------------------------------------

DROP FUNCTION public.create_child(text, text);

-- Имя, полоса и прогресс уходят в облако только после согласия. Ребёнок без
-- облачной синхронизации живёт на устройстве, и строки здесь у него нет вовсе.
CREATE FUNCTION public.create_child(
  child_display_name text,
  child_band text,
  cloud_text_version text,
  confirmed_via text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF NOT public.is_real_user() THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF confirmed_via NOT IN ('biometric', 'pin') THEN
    RAISE EXCEPTION 'cloud consent is confirmed behind the gate' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.consent_texts WHERE scope = 'cloud_sync' AND version = cloud_text_version AND is_current) THEN
    RAISE EXCEPTION 'outdated consent text' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.children (display_name, band) VALUES (child_display_name, child_band)
  RETURNING id INTO new_id;
  INSERT INTO public.child_guardians (child_id, user_id, role) VALUES (new_id, auth.uid(), 'owner');
  INSERT INTO public.consent_events (scope, action, child_id, text_version, confirmed_by, actor_id, client_at)
  VALUES ('cloud_sync', 'grant', new_id, cloud_text_version, confirmed_via, auth.uid(), now());
  RETURN new_id;
END;
$$;

-- Повторное согласие на облако — когда текст сменился. Прежнее согласие на
-- старый текст не переносится, и до нового запись в облако закрыта политиками.
CREATE FUNCTION public.grant_cloud_sync(target_child uuid, cloud_text_version text, confirmed_via text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_real_user() OR NOT public.has_child_access(target_child, 'owner') THEN
    RAISE EXCEPTION 'only the owner can grant cloud sync' USING ERRCODE = '42501';
  END IF;
  IF confirmed_via NOT IN ('biometric', 'pin') THEN
    RAISE EXCEPTION 'cloud consent is confirmed behind the gate' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.consent_texts WHERE scope = 'cloud_sync' AND version = cloud_text_version AND is_current) THEN
    RAISE EXCEPTION 'outdated consent text' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.consent_events (scope, action, child_id, text_version, confirmed_by, actor_id, client_at)
  VALUES ('cloud_sync', 'grant', target_child, cloud_text_version, confirmed_via, auth.uid(), now());
END;
$$;

-- Отзыв облака — не «перестать собирать», а «убрать собранное»: ребёнок уходит из
-- облака целиком, локальные данные остаются. Событие отзыва переживает удаление
-- под псевдонимом.
CREATE FUNCTION public.revoke_cloud_sync(target_child uuid, cloud_text_version text, confirmed_via text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_real_user() OR NOT public.has_child_access(target_child, 'owner') THEN
    RAISE EXCEPTION 'only the owner can revoke cloud sync' USING ERRCODE = '42501';
  END IF;
  IF confirmed_via NOT IN ('biometric', 'pin') THEN
    RAISE EXCEPTION 'revocation is confirmed behind the gate' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.consent_events (scope, action, child_id, text_version, confirmed_by, actor_id, client_at)
  VALUES ('cloud_sync', 'revoke', target_child, cloud_text_version, confirmed_via, auth.uid(), now());
  DELETE FROM public.children WHERE id = target_child;
END;
$$;

-- ---------------------------------------------------------------------------
-- Инвайты: лимит попыток, ожидание подтверждения, отзыв кода
-- ---------------------------------------------------------------------------

-- Неудачные попытки. Не через RAISE: исключение откатило бы и саму запись о
-- попытке, и лимит не работал бы никогда.
CREATE TABLE public.invite_attempts (
  user_id uuid NOT NULL,
  at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invite_attempts_user_at ON public.invite_attempts (user_id, at);
ALTER TABLE public.invite_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invite_attempts FROM anon, authenticated;

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

DROP FUNCTION public.redeem_child_invite(text);

-- Возвращает статус, а не бросает исключение: неудачная попытка должна
-- записаться. Одна формулировка на «нет такого», «истёк» и «использован» — по
-- ответу нельзя понять, существует ли код. Успех — это только заявка: доступ
-- появляется после подтверждения владельцем.
CREATE FUNCTION public.redeem_child_invite(invite_code text)
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

-- Подтверждение второго взрослого. В клиенте — за гейтом уровня 2.
CREATE FUNCTION public.approve_guardian(target_child uuid, guardian uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_real_user() OR NOT public.has_child_access(target_child, 'owner') THEN
    RAISE EXCEPTION 'only the owner can approve' USING ERRCODE = '42501';
  END IF;
  UPDATE public.child_guardians SET status = 'active'
  WHERE child_id = target_child AND user_id = guardian AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no pending request' USING ERRCODE = '22023';
  END IF;
END;
$$;

-- Код ушёл не в тот чат — владелец гасит все невыкупленные коды ребёнка.
CREATE FUNCTION public.revoke_child_invites(target_child uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  n integer;
BEGIN
  IF NOT public.is_real_user() OR NOT public.has_child_access(target_child, 'owner') THEN
    RAISE EXCEPTION 'only the owner can revoke invites' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.child_access_invites WHERE child_id = target_child AND redeemed_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Передача владения — путь, при котором удаление аккаунта владельца не удаляет
-- ребёнка. Только действующему второму родителю; прежний владелец становится
-- вторым родителем и может затем выйти или удалить аккаунт.
CREATE FUNCTION public.transfer_child_ownership(target_child uuid, new_owner uuid)
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
  INSERT INTO public.child_access_log (child_id, user_id, role, event, by_user) VALUES
    (target_child, auth.uid(), 'guardian', 'transferred_out', auth.uid()),
    (target_child, new_owner, 'owner', 'transferred_in', auth.uid());
END;
$$;

-- ---------------------------------------------------------------------------
-- Ретеншн
-- ---------------------------------------------------------------------------

-- Прохождения — 12 месяцев; выкупленные и просроченные коды — неделя после срока;
-- попытки — сутки; согласия — по retain_until. Навыки живут, пока жив профиль.
CREATE FUNCTION public.purge_expired() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.lesson_runs WHERE started_at < now() - interval '12 months';
  DELETE FROM public.child_access_invites WHERE expires_at < now() - interval '7 days';
  DELETE FROM public.invite_attempts WHERE at < now() - interval '1 day';
  DELETE FROM public.consent_events WHERE retain_until IS NOT NULL AND retain_until < now();
END;
$$;

-- В Supabase pg_cron включается в панели; без него задание не ставится, и
-- purge_expired надо вызывать иначе. Молча не пропускаем — предупреждаем.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('talentia-purge-expired', '17 3 * * *', 'SELECT public.purge_expired()');
  ELSE
    RAISE WARNING 'pg_cron не установлен: purge_expired() не запланирована';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Ограничения полей: не канал для произвольного текста
-- ---------------------------------------------------------------------------

ALTER TABLE public.children
  ADD CONSTRAINT display_name_single_line CHECK (display_name IS NULL OR display_name !~ '[[:cntrl:]]');
ALTER TABLE public.skill_state
  ADD CONSTRAINT skill_short CHECK (char_length(skill) <= 64);
ALTER TABLE public.lesson_runs
  ADD CONSTRAINT lesson_id_short CHECK (char_length(lesson_id) <= 64),
  ADD CONSTRAINT task_seconds_sane CHECK (cardinality(task_seconds) <= 50 AND 0 <= ALL (task_seconds) AND 86400 >= ALL (task_seconds));

-- ---------------------------------------------------------------------------
-- Облачные данные — только при действующем согласии на облако
-- ---------------------------------------------------------------------------

DROP POLICY "skill_state: guardian insert" ON public.skill_state;
DROP POLICY "skill_state: guardian update" ON public.skill_state;
DROP POLICY "lesson_runs: guardian insert" ON public.lesson_runs;
CREATE POLICY "skill_state: guardian insert with consent" ON public.skill_state
  FOR INSERT TO authenticated
  WITH CHECK (public.has_child_access(child_id, 'guardian') AND public.has_consent(child_id, 'cloud_sync'));
CREATE POLICY "skill_state: guardian update with consent" ON public.skill_state
  FOR UPDATE TO authenticated
  USING (public.has_child_access(child_id, 'guardian'))
  WITH CHECK (public.has_child_access(child_id, 'guardian') AND public.has_consent(child_id, 'cloud_sync'));
CREATE POLICY "lesson_runs: guardian insert with consent" ON public.lesson_runs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_child_access(child_id, 'guardian') AND public.has_consent(child_id, 'cloud_sync'));

-- Согласия: облако — только функциями; ИИ и голос — только владелец; остальное
-- (телеметрия) — любой действующий родитель. Согласие аккаунта — сам за себя.
DROP POLICY "consent_events: self insert" ON public.consent_events;
CREATE POLICY "consent_events: self insert" ON public.consent_events
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND public.is_real_user()
    AND CASE
          WHEN scope = 'account_local' THEN child_id IS NULL
          WHEN scope = 'cloud_sync' THEN false
          WHEN scope IN ('companion_ai', 'voice_asr') THEN public.has_child_access(child_id, 'owner')
          ELSE public.has_child_access(child_id, 'guardian')
        END
  );

-- Ожидающий видит свою заявку, но не ребёнка: has_child_access требует active.
-- Второй родитель больше не выходит из строки владельца и не удаляет её — это
-- по-прежнему закрыто политикой из первой миграции.

-- ---------------------------------------------------------------------------
-- Права: аноним не вызывает ничего, лишние привилегии на таблицах сняты
-- ---------------------------------------------------------------------------

-- Supabase выдаёт EXECUTE на новые функции anon и authenticated по умолчанию;
-- REVOKE FROM PUBLIC этого не снимает.
REVOKE ALL ON FUNCTION public.has_child_access(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_real_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_consent(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_child(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_child_invite(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_child_invite(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_guardian(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_child_invites(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transfer_child_ownership(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_cloud_sync(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.grant_cloud_sync(uuid, text, text) FROM PUBLIC, anon;
-- Служебные — не вызываются клиентом вовсе.
REVOKE ALL ON FUNCTION public.purge_expired() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consent_events_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guardian_limits() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.child_guardians_audit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.children_pseudonymize_consent() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.users_pseudonymize() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_child_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_real_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_consent(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_child(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_child_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_child_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_guardian(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_child_invites(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_child_ownership(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_cloud_sync(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_cloud_sync(uuid, text, text) TO authenticated;

-- Аноним к детским таблицам не прикасается вовсе, а не только через RLS.
REVOKE ALL ON public.children, public.child_guardians, public.child_access_invites,
              public.skill_state, public.lesson_runs, public.consent_texts FROM anon;
-- TRUNCATE обходит RLS; TRIGGER и REFERENCES клиенту не нужны.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.children, public.child_guardians, public.child_access_invites,
              public.skill_state, public.lesson_runs, public.consent_texts FROM authenticated;
-- Инвайты — только функциями.
REVOKE ALL ON public.child_access_invites FROM authenticated;
