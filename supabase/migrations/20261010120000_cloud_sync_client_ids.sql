-- ---------------------------------------------------------------------------
-- Облачное согласие идемпотентно: id ребёнка и id события задаёт клиент
-- (AUDIT.md, аудит 2026-10-06, А6 и блокер 9; спецификация `backend-auditor` 2026-10-10)
-- ---------------------------------------------------------------------------
--
-- Прежде сервер выдавал ребёнку свой id, а синхронизация слала прохождения и навыки с
-- локальным — RLS отклоняла каждую отправку. Повтор после потерянного ответа создавал второго
-- ребёнка или второй grant в журнале, повтор отзыва для уже удалённого ребёнка падал 42501 —
-- неотличимо от «не владелец». Теперь:
-- - id ребёнка и события приходят с устройства (`uuid`), повтор того же события — 'duplicate';
-- - отзыв для ребёнка, которого уже нет, — 'gone' и на сервере ничего не пишется: строка с
--   настоящим child_id после псевдонимизации заново привязала бы журнал к id устройства;
--   отзыв как доказательство остаётся в локальном журнале;
-- - время события — с устройства (`client_at`; CHECK «не больше 5 минут в будущее» из
--   _140000); действующее согласие по-прежнему решает серверный порядок `seq`
--   (`consent_active`), часы устройства на него не влияют.
-- Старые сигнатуры удаляются: CREATE OR REPLACE с другим набором аргументов дал бы
-- перегрузку — вторую функцию с тем же именем. CASCADE не нужен и опасен.

DROP FUNCTION public.create_child(text, text, text, text);
DROP FUNCTION public.grant_cloud_sync(uuid, text, text);
DROP FUNCTION public.revoke_cloud_sync(uuid, text, text);

-- Повтор облачного события: найдено своё событие того же действия, того же ребёнка и с тем же
-- содержимым — повтор; иначе id события занят — ошибка. child_id сравнивается
-- (`child-privacy-compliance` 2026-10-10): после отзыва старые события под псевдонимом, и
-- запоздалый повтор старого create иначе вернул бы 'duplicate' — клиент решил бы, что облако
-- включено, а ребёнка на сервере нет.
CREATE FUNCTION public.cloud_event_replay(
  p_event_id uuid,
  p_action text,
  p_child_id uuid,
  p_text_version text,
  p_confirmed_via text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
BEGIN
  SELECT actor_id, scope, action, child_id, text_version, confirmed_by INTO r FROM public.consent_events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF r.actor_id = auth.uid() AND r.scope = 'cloud_sync' AND r.action = p_action AND r.child_id = p_child_id
     AND r.text_version = p_text_version AND r.confirmed_by = p_confirmed_via THEN
    RETURN true;
  END IF;
  RAISE EXCEPTION 'event id already used' USING ERRCODE = '23505';
END;
$$;

-- Ребёнок появляется в облаке только вместе с согласием — одной транзакцией. Если ребёнок
-- уже есть и вызывающий его владелец, это выдача: ошибка маршрутизации в адаптере ничего не
-- ломает. Возвращает 'created' | 'granted' | 'duplicate'.
-- Имя по умолчанию не отправляется (`child-privacy-compliance`, PARENT.md «Минимизация»): оно
-- нужно только репликам Tali на устройстве. Имя не пишется ни в журнал, ни в текст ошибок.
CREATE FUNCTION public.create_child(
  p_child_id uuid,
  p_event_id uuid,
  p_band text,
  p_text_version text,
  p_confirmed_via text,
  p_client_at timestamptz,
  p_display_name text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result text;
BEGIN
  IF NOT public.is_real_user() THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_child_id IS NULL OR p_event_id IS NULL OR p_client_at IS NULL THEN
    RAISE EXCEPTION 'child id, event id and client time are required' USING ERRCODE = '22023';
  END IF;
  IF public.cloud_event_replay(p_event_id, 'grant', p_child_id, p_text_version, p_confirmed_via) THEN
    RETURN 'duplicate';
  END IF;
  IF p_confirmed_via IS NULL OR p_confirmed_via NOT IN ('biometric', 'pin') THEN
    RAISE EXCEPTION 'cloud consent is confirmed behind the gate' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.consent_texts WHERE scope = 'cloud_sync' AND version = p_text_version AND is_current) THEN
    RAISE EXCEPTION 'outdated consent text' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.children (id, display_name, band) VALUES (p_child_id, p_display_name, p_band)
  ON CONFLICT (id) DO NOTHING;
  IF FOUND THEN
    INSERT INTO public.child_guardians (child_id, user_id, role) VALUES (p_child_id, auth.uid(), 'owner');
    result := 'created';
  ELSE
    -- ребёнок есть: строка под замком до конца транзакции, параллельный отзыв ждёт; уже
    -- удалён параллельным отзывом — повторяемая ошибка, а не 'granted' без ребёнка
    PERFORM 1 FROM public.children WHERE id = p_child_id FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'child removed concurrently' USING ERRCODE = '40001';
    END IF;
    IF NOT public.has_child_access(p_child_id, 'owner') THEN
      RAISE EXCEPTION 'child id taken' USING ERRCODE = '42501';
    END IF;
    result := 'granted';
  END IF;
  INSERT INTO public.consent_events (id, scope, action, child_id, text_version, confirmed_by, actor_id, client_at)
  VALUES (p_event_id, 'cloud_sync', 'grant', p_child_id, p_text_version, p_confirmed_via, auth.uid(), p_client_at)
  ON CONFLICT (id) DO NOTHING;
  -- параллельный вызов с тем же id события успел раньше: повтор — 'duplicate', чужое
  -- содержимое — 23505 и откат всей транзакции, ребёнок без согласия не остаётся
  IF NOT FOUND AND public.cloud_event_replay(p_event_id, 'grant', p_child_id, p_text_version, p_confirmed_via) THEN
    RETURN 'duplicate';
  END IF;
  RETURN result;
END;
$$;

-- Повторная выдача, когда сменился текст: имя заново не отправляется (минимизация).
-- Ребёнка нет — P0002, адаптер зовёт create_child с профилем. 'granted' | 'duplicate'.
CREATE FUNCTION public.grant_cloud_sync(
  p_child_id uuid,
  p_event_id uuid,
  p_text_version text,
  p_confirmed_via text,
  p_client_at timestamptz
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_real_user() THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_child_id IS NULL OR p_event_id IS NULL OR p_client_at IS NULL THEN
    RAISE EXCEPTION 'child id, event id and client time are required' USING ERRCODE = '22023';
  END IF;
  IF public.cloud_event_replay(p_event_id, 'grant', p_child_id, p_text_version, p_confirmed_via) THEN
    RETURN 'duplicate';
  END IF;
  -- строка ребёнка под замком до конца транзакции: параллельный отзыв не удалит ребёнка
  -- между проверкой и записью согласия (иначе в журнале — событие с настоящим id удалённого)
  PERFORM 1 FROM public.children WHERE id = p_child_id FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'child not in cloud' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.has_child_access(p_child_id, 'owner') THEN
    RAISE EXCEPTION 'only the owner can grant cloud sync' USING ERRCODE = '42501';
  END IF;
  IF p_confirmed_via IS NULL OR p_confirmed_via NOT IN ('biometric', 'pin') THEN
    RAISE EXCEPTION 'cloud consent is confirmed behind the gate' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.consent_texts WHERE scope = 'cloud_sync' AND version = p_text_version AND is_current) THEN
    RAISE EXCEPTION 'outdated consent text' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.consent_events (id, scope, action, child_id, text_version, confirmed_by, actor_id, client_at)
  VALUES (p_event_id, 'cloud_sync', 'grant', p_child_id, p_text_version, p_confirmed_via, auth.uid(), p_client_at)
  ON CONFLICT (id) DO NOTHING;
  IF NOT FOUND AND public.cloud_event_replay(p_event_id, 'grant', p_child_id, p_text_version, p_confirmed_via) THEN
    RETURN 'duplicate';
  END IF;
  RETURN 'granted';
END;
$$;

-- Отзыв облака — ребёнок уходит из облака целиком. Порядок проверок важен: ребёнка нет —
-- 'gone' раньше проверки повтора (повтор доставленного отзыва после удаления — тоже 'gone',
-- конечный успех для клиента, а не 23505 из-за псевдонима); 'gone' — только когда строки нет
-- совсем, чужой ребёнок — 42501. 'revoked' | 'duplicate' | 'gone'.
CREATE FUNCTION public.revoke_cloud_sync(
  p_child_id uuid,
  p_event_id uuid,
  p_text_version text,
  p_confirmed_via text,
  p_client_at timestamptz
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_real_user() THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_child_id IS NULL OR p_event_id IS NULL OR p_client_at IS NULL THEN
    RAISE EXCEPTION 'child id, event id and client time are required' USING ERRCODE = '22023';
  END IF;
  -- исключительный замок строки: параллельный повтор того же отзыва ждёт и после удаления
  -- получает 'gone', а не 23505 из-за псевдонима; параллельная выдача ждёт отзыва
  PERFORM 1 FROM public.children WHERE id = p_child_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'gone';
  END IF;
  IF public.cloud_event_replay(p_event_id, 'revoke', p_child_id, p_text_version, p_confirmed_via) THEN
    RETURN 'duplicate';
  END IF;
  IF NOT public.has_child_access(p_child_id, 'owner') THEN
    RAISE EXCEPTION 'only the owner can revoke cloud sync' USING ERRCODE = '42501';
  END IF;
  IF p_confirmed_via IS NULL OR p_confirmed_via NOT IN ('biometric', 'pin') THEN
    RAISE EXCEPTION 'revocation is confirmed behind the gate' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.consent_events (id, scope, action, child_id, text_version, confirmed_by, actor_id, client_at)
  VALUES (p_event_id, 'cloud_sync', 'revoke', p_child_id, p_text_version, p_confirmed_via, auth.uid(), p_client_at)
  ON CONFLICT (id) DO NOTHING;
  -- ребёнок удаляется только вместе с записанным отзывом (повтор под замком сюда не доходит)
  IF NOT FOUND AND public.cloud_event_replay(p_event_id, 'revoke', p_child_id, p_text_version, p_confirmed_via) THEN
    RETURN 'duplicate';
  END IF;
  DELETE FROM public.children WHERE id = p_child_id;
  RETURN 'revoked';
END;
$$;

-- ---------------------------------------------------------------------------
-- Хвост блокера 9: день последней встречи с навыком — для восстановления на новом
-- устройстве. Без него lastSeenDay = null, и повтор становится доступен сразу
-- (`domain/mastery.ts`): интервалы повторения сбиваются. Права — по колонкам, как в _180000.
-- ---------------------------------------------------------------------------

ALTER TABLE public.skill_state ADD COLUMN last_seen_day date;
GRANT INSERT (last_seen_day), UPDATE (last_seen_day) ON public.skill_state TO authenticated;

-- ---------------------------------------------------------------------------
-- Права: аноним не вызывает ничего (Supabase выдаёт EXECUTE anon по умолчанию)
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.cloud_event_replay(uuid, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_child(uuid, uuid, text, text, text, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.grant_cloud_sync(uuid, uuid, text, text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_cloud_sync(uuid, uuid, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_child(uuid, uuid, text, text, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_cloud_sync(uuid, uuid, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_cloud_sync(uuid, uuid, text, text, timestamptz) TO authenticated;
