-- Дети как строки, а не учётные записи. Спецификация — PARENT.md, «Решение, от
-- которого зависят остальные» и «Разграничение доступа».
--
-- auth.users — только взрослые. У ребёнка нет e-mail, пароля и JWT: нечего угнать
-- и нечего фишить. Связь взрослого с ребёнком создаётся ТОЛЬКО функциями ниже —
-- create_child (владелец) и redeem_child_invite (второй взрослый по коду).
-- Прямого INSERT в child_guardians нет намеренно: политика вида
-- WITH CHECK (user_id = auth.uid()) позволила бы любому аккаунту привязать к себе
-- чужого ребёнка, вписав его идентификатор.
--
-- Прежние таблицы (profiles, parent_child, user_progress, …) не трогаются: новое
-- приложение собирается рядом со старым.

-- ---------------------------------------------------------------------------
-- Таблицы
-- ---------------------------------------------------------------------------

CREATE TABLE public.children (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- «Как называть ребёнка в игре». Необязательное: настоящее имя + полоса + город
  -- из магазина = идентификация ребёнка, а продукту это не даёт ничего.
  display_name text CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 40),
  -- Полоса, а не дата рождения. Даты рождения в схеме нет и не будет.
  band         text NOT NULL CHECK (band IN ('5-6', '7', '8', '9-10')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.child_guardians (
  child_id   uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Удалить ребёнка и выдать доступ третьему может только owner: иначе развод
  -- превращается в гонку удалений. specialist в схеме есть, потому что задним
  -- числом роль не добавить, но выдача в первой версии выключена (см. инвайты).
  role       text NOT NULL CHECK (role IN ('owner', 'guardian', 'specialist')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (child_id, user_id),
  -- Доступ постороннего взрослого всегда со сроком.
  CHECK (role <> 'specialist' OR expires_at IS NOT NULL)
);

-- Ровно один владелец на ребёнка.
CREATE UNIQUE INDEX child_guardians_one_owner ON public.child_guardians (child_id) WHERE role = 'owner';
CREATE INDEX child_guardians_user ON public.child_guardians (user_id);

CREATE TABLE public.child_access_invites (
  -- Хранится хеш, не сам код: утечка таблицы не даёт действующих кодов.
  code_hash   bytea PRIMARY KEY,
  child_id    uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  -- Только guardian. specialist через код в первой версии не выдаётся.
  role        text NOT NULL DEFAULT 'guardian' CHECK (role = 'guardian'),
  created_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '72 hours',
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at timestamptz
);

-- Коробки Лейтнера (src/domain/mastery.ts). Разделены по ребёнку: иначе двое детей
-- на одном планшете делят одни коробки, и отчёт врёт про обоих.
CREATE TABLE public.skill_state (
  child_id         uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  skill            text NOT NULL,
  box              smallint NOT NULL CHECK (box BETWEEN 1 AND 4),
  correct_in_row   integer NOT NULL DEFAULT 0 CHECK (correct_in_row >= 0),
  attempts         integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  correct          integer NOT NULL DEFAULT 0 CHECK (correct BETWEEN 0 AND attempts),
  last_seen_lesson integer NOT NULL DEFAULT -1,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (child_id, skill)
);

-- Прохождения (src/domain/parentReport.ts, LessonRun). Секунды хранятся как
-- измерены; потолок 120 с на задание применяется при подсчёте, а не при записи.
-- Ретеншн 12 месяцев — задача планировщика, здесь не реализована.
CREATE TABLE public.lesson_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id     uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  lesson_id    text NOT NULL,
  started_at   timestamptz NOT NULL,
  task_seconds integer[] NOT NULL DEFAULT '{}',
  review_tasks smallint NOT NULL DEFAULT 0 CHECK (review_tasks >= 0),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lesson_runs_child_started ON public.lesson_runs (child_id, started_at DESC);

-- Журнал согласий (src/domain/consent.ts). APPEND-ONLY.
--
-- У этой таблицы НЕТ политик UPDATE и DELETE — намеренно. Запись согласия, которую
-- можно отредактировать, ничего не доказывает. Не «дочинивать».
--
-- child_id и actor_id без внешних ключей тоже намеренно: журнал переживает
-- удаление ребёнка и аккаунта как доказательство, что согласие было получено и
-- отозвано. При удалении идентификаторы заменяются псевдонимом функцией удаления
-- с service-role, а не каскадом.
CREATE TABLE public.consent_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope        text NOT NULL CHECK (scope IN ('account_local', 'cloud_sync', 'companion_ai', 'voice_asr', 'telemetry')),
  action       text NOT NULL CHECK (action IN ('grant', 'revoke')),
  child_id     uuid,
  text_version text NOT NULL CHECK (text_version <> ''),
  confirmed_by text NOT NULL CHECK (confirmed_by IN ('signup', 'biometric', 'pin')),
  actor_id     uuid NOT NULL,
  at           timestamptz NOT NULL DEFAULT now(),
  -- Те же правила, что consentEventErrors в клиенте: согласие аккаунта — без
  -- ребёнка и только оно подтверждается регистрацией; остальное — за гейтом.
  CHECK ((scope = 'account_local') = (child_id IS NULL)),
  CHECK (confirmed_by <> 'signup' OR (scope = 'account_local' AND action = 'grant'))
);
CREATE INDEX consent_events_child ON public.consent_events (child_id, scope, at);
CREATE INDEX consent_events_actor ON public.consent_events (actor_id, at);

-- ---------------------------------------------------------------------------
-- Доступ
-- ---------------------------------------------------------------------------

-- Одна функция на все политики. SECURITY DEFINER обязательно: политика на
-- child_guardians, читающая child_guardians, иначе рекурсивно вызовет саму себя.
--
-- min_role: 'owner' — только владелец; 'guardian' — владелец и второй родитель;
-- 'specialist' — любой действующий доступ. Специалист проходит только туда, где
-- политика явно просит 'specialist' — в этой миграции таких мест нет: данных ABA
-- здесь ещё нет, а к навыкам и прохождениям специалист не допускается.
CREATE FUNCTION public.has_child_access(target_child uuid, min_role text DEFAULT 'guardian')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.child_guardians g
    WHERE g.child_id = target_child
      AND g.user_id = auth.uid()
      AND (g.expires_at IS NULL OR g.expires_at > now())
      AND CASE min_role
            WHEN 'owner'      THEN g.role = 'owner'
            WHEN 'guardian'   THEN g.role IN ('owner', 'guardian')
            WHEN 'specialist' THEN true
            ELSE false
          END
  );
$$;

-- Ребёнок и его владелец создаются одной транзакцией. Это единственный путь
-- появления строки owner.
CREATE FUNCTION public.create_child(child_display_name text, child_band text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.children (display_name, band) VALUES (child_display_name, child_band)
  RETURNING id INTO new_id;
  INSERT INTO public.child_guardians (child_id, user_id, role) VALUES (new_id, auth.uid(), 'owner');
  RETURN new_id;
END;
$$;

-- Код из 8 символов алфавита без I, O, 0, 1: его диктуют голосом и переписывают
-- с экрана. 32 символа — байт делится на алфавит без перекоса. Случайность берётся
-- из gen_random_uuid (криптографический генератор), а не из random().
CREATE FUNCTION public.create_child_invite(target_child uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw bytea;
  code text := '';
  i int;
BEGIN
  IF NOT public.has_child_access(target_child, 'owner') THEN
    RAISE EXCEPTION 'only the owner can invite' USING ERRCODE = '42501';
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

-- Одноразово, 72 часа. Взрослый, у которого уже есть доступ, код не расходует.
CREATE FUNCTION public.redeem_child_invite(invite_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.child_access_invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO inv
  FROM public.child_access_invites
  WHERE code_hash = sha256(convert_to(upper(trim(invite_code)), 'UTF8'))
  FOR UPDATE;
  -- Одна ошибка на все причины: по ответу нельзя понять, существует ли код.
  IF NOT FOUND OR inv.redeemed_at IS NOT NULL OR inv.expires_at <= now() THEN
    RAISE EXCEPTION 'invalid or expired code' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.child_guardians WHERE child_id = inv.child_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'already has access' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.child_guardians (child_id, user_id, role) VALUES (inv.child_id, auth.uid(), inv.role);
  UPDATE public.child_access_invites
  SET redeemed_by = auth.uid(), redeemed_at = now()
  WHERE code_hash = inv.code_hash;
  RETURN inv.child_id;
END;
$$;

REVOKE ALL ON FUNCTION public.has_child_access(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_child(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_child_invite(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_child_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_child_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_child(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_child_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_child_invite(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_access_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_events ENABLE ROW LEVEL SECURITY;

-- children: INSERT нет — только create_child.
CREATE POLICY "children: guardian select" ON public.children
  FOR SELECT TO authenticated USING (public.has_child_access(id, 'guardian'));
CREATE POLICY "children: guardian update" ON public.children
  FOR UPDATE TO authenticated
  USING (public.has_child_access(id, 'guardian'))
  WITH CHECK (public.has_child_access(id, 'guardian'));
CREATE POLICY "children: owner delete" ON public.children
  FOR DELETE TO authenticated USING (public.has_child_access(id, 'owner'));

-- child_guardians: INSERT и UPDATE нет — связь создаётся только функциями, роль и
-- срок не меняются из клиента. Каждый видит свою строку; владелец видит всех —
-- родителю видно, кто и до какого числа смотрит.
CREATE POLICY "child_guardians: self or owner select" ON public.child_guardians
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_child_access(child_id, 'owner'));
-- Владелец отзывает чужой доступ; любой, кроме владельца, может выйти сам.
-- Строку владельца так не удалить: ребёнок без владельца — сирота, которого
-- некому удалить.
CREATE POLICY "child_guardians: owner revokes, others leave" ON public.child_guardians
  FOR DELETE TO authenticated
  USING (role <> 'owner' AND (user_id = auth.uid() OR public.has_child_access(child_id, 'owner')));

-- child_access_invites: политик нет вовсе — только функции.

CREATE POLICY "skill_state: guardian select" ON public.skill_state
  FOR SELECT TO authenticated USING (public.has_child_access(child_id, 'guardian'));
CREATE POLICY "skill_state: guardian insert" ON public.skill_state
  FOR INSERT TO authenticated WITH CHECK (public.has_child_access(child_id, 'guardian'));
CREATE POLICY "skill_state: guardian update" ON public.skill_state
  FOR UPDATE TO authenticated
  USING (public.has_child_access(child_id, 'guardian'))
  WITH CHECK (public.has_child_access(child_id, 'guardian'));
-- «Очистить прогресс»: профиль остаётся, навыки уходят.
CREATE POLICY "skill_state: guardian delete" ON public.skill_state
  FOR DELETE TO authenticated USING (public.has_child_access(child_id, 'guardian'));

CREATE POLICY "lesson_runs: guardian select" ON public.lesson_runs
  FOR SELECT TO authenticated USING (public.has_child_access(child_id, 'guardian'));
CREATE POLICY "lesson_runs: guardian insert" ON public.lesson_runs
  FOR INSERT TO authenticated WITH CHECK (public.has_child_access(child_id, 'guardian'));
CREATE POLICY "lesson_runs: guardian delete" ON public.lesson_runs
  FOR DELETE TO authenticated USING (public.has_child_access(child_id, 'guardian'));

-- consent_events: только SELECT и INSERT. UPDATE и DELETE нет — см. комментарий у таблицы.
CREATE POLICY "consent_events: actor or guardian select" ON public.consent_events
  FOR SELECT TO authenticated
  USING (actor_id = auth.uid() OR (child_id IS NOT NULL AND public.has_child_access(child_id, 'guardian')));
CREATE POLICY "consent_events: self insert" ON public.consent_events
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (child_id IS NULL OR public.has_child_access(child_id, 'guardian'))
  );
