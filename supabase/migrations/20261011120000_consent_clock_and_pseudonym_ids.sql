-- ---------------------------------------------------------------------------
-- Время отзыва и занятые id ребёнка (AUDIT.md, раунд 2 — 2026-10-11, Р1 и Р2; решение
-- владельца №90; спецификация `child-privacy-compliance` и `backend-auditor` 2026-10-11)
-- ---------------------------------------------------------------------------
--
-- Р2. Отзыв с client_at из будущего — устройство ставит отзыв не раньше последнего события
-- журнала, и одно событие при часах вперёд тянет за собой все следующие — отвергал CHECK
-- consent_client_at_not_future (_140000) с 23514. Журнал неизменяем, повтор не помогает:
-- облако и согласие оставались, удаление ребёнка не начиналось, отзывы companion_ai и
-- telemetry не доходили. Теперь сервер ограничивает время отзыва своим временем получения.
-- Как доказательство это допустимо (`child-privacy-compliance`): действие отзыва определяет
-- серверный порядок seq, а не client_at; время из будущего невозможно, и записанное время
-- отзыва лежит между настоящим и заявленным устройством: позже настоящего не более чем на
-- задержку доставки (сервер и не мог узнать об отзыве раньше), раньше — никогда. Исходное время
-- остаётся в журнале устройства; на сервере его не храним (минимизация). Отдельной отметки
-- нет: у события с устройства client_at = received_at до микросекунды практически означает
-- ограничение, но серверный вызов с now() даёт то же — однозначным признаком это не считать.
-- Выдача (grant) по-прежнему 23514: отказ безопасный, данные не идут.
--
-- Р1. create_child вставлял любой отсутствующий id. Псевдоним P удалённого ребёнка виден
-- автору согласий и любому из журнала доступа: create_child(P) делал вызвавшего владельцем
-- журналов удалённого, старые согласия снова «жили», а такого P нельзя было удалить
-- (вторая псевдонимизация запрещена). То же с id взрослого U из auth.users: id_is_real(U)
-- становится истинным при живом ребёнке U, и удаление аккаунта U падает на
-- pseudonym_change_allowed — чужое право на удаление заблокировано (uuid взрослых владелец
-- видит в заявках). Теперь id ребёнка не может совпадать ни с id пользователя, ни с
-- псевдонимом из журналов — детским и взрослым.
--
-- Сознательно не делается:
-- - отдельный код для «id занят»: сейчас 42501 'child id taken', как у чужого живого
--   ребёнка в create_child (_20261010120000), текст и код совпадают — по ответу не
--   отличить псевдоним, пользователя и чужого ребёнка. Свой код (В2 `backend-auditor`) —
--   при свёртке миграций (№87), в обоих местах сразу;
-- - правило «новая выдача не раньше последнего события» (П1): на сервере оно вернуло бы ту
--   же вечную блокировку; исправляется на устройстве (`domain/consent.ts`, placeConsentEvent);
-- - обратное направление — новый пользователь с id живого ребёнка: GoTrue задаёт id сам,
--   явный id возможен только через admin API. Появится импорт или перенос аккаунтов с
--   заданным id — нужна симметричная проверка на auth.users;
-- - различие веток 42501 в поле CONTEXT: PostgREST его не отдаёт; на шаге 7 сравнить тела
--   ответов rpc('create_child') для псевдонима, пользователя и чужого ребёнка побайтно;
-- - индексы под user_id / by_user в child_access_log: create_child — раз на ребёнка,
--   таблица мала (тот же seq scan уже есть при удалении аккаунта, _180000); EXISTS по
--   child_id идёт по consent_events_child_scope_seq и child_access_log_child, по actor_id —
--   по consent_events_actor. Обычные индексы (user_id), (by_user) — при свёртке (№87).
-- Ожидаемое расхождение: локальный отзыв хранит время устройства, серверный — received_at.

-- ---------------------------------------------------------------------------
-- Р2. Время отзыва — не позже получения сервером
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.consent_events_clamp_revoke_time() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Только отзыв: ограничение ослабляет проверку, новое действие должно получать его
  -- осознанно. received_at, а не now(): CHECK держится и при явно заданном received_at.
  IF NEW.action = 'revoke' AND NEW.client_at > NEW.received_at THEN
    NEW.client_at := NEW.received_at;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER consent_events_clamp_revoke_time BEFORE INSERT ON public.consent_events
  FOR EACH ROW EXECUTE FUNCTION public.consent_events_clamp_revoke_time();

COMMENT ON COLUMN public.consent_events.client_at IS
  'Время события на устройстве. У отзыва не позже received_at: время из будущего сервер '
  'ограничивает своим (20261011120000, Р2); исходное время — только в журнале устройства; '
  'равенство client_at = received_at ограничение не доказывает. Порядок событий — seq, не client_at.';

-- ---------------------------------------------------------------------------
-- Р1. id ребёнка не может быть занят пользователем или псевдонимом
-- ---------------------------------------------------------------------------

-- Ребёнок, созданный через эту дыру до миграции, триггером не исправится, а удалить его
-- нельзя — миграция должна упасть явно, а не оставить его молча.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.children c
    WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.id)
       OR EXISTS (SELECT 1 FROM public.consent_events e WHERE e.child_id = c.id AND e.child_pseudonymized_at IS NOT NULL)
       OR EXISTS (SELECT 1 FROM public.consent_events e WHERE e.actor_id = c.id AND e.actor_pseudonymized_at IS NOT NULL)
       OR EXISTS (SELECT 1 FROM public.child_access_log l WHERE l.child_id = c.id AND l.child_pseudonymized_at IS NOT NULL)
       OR EXISTS (SELECT 1 FROM public.child_access_log l WHERE l.user_id = c.id AND l.user_pseudonymized_at IS NOT NULL)
       OR EXISTS (SELECT 1 FROM public.child_access_log l WHERE l.by_user = c.id AND l.by_pseudonymized_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'children with taken ids exist: resolve them before 20261011120000';
  END IF;
END;
$$;

-- SECURITY DEFINER: authenticated не читает child_access_log и чужие строки consent_events.
-- Срабатывает до разрешения ON CONFLICT в create_child, то есть и для живого ребёнка:
-- поэтому проверяются только строки с отметкой псевдонима — у живого ребёнка его
-- собственные события лежат под настоящим id. Одна ошибка на все ветки, без DETAIL и HINT.
CREATE FUNCTION public.children_id_not_taken() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id)
     OR EXISTS (SELECT 1 FROM public.consent_events WHERE child_id = NEW.id AND child_pseudonymized_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.consent_events WHERE actor_id = NEW.id AND actor_pseudonymized_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.child_access_log WHERE child_id = NEW.id AND child_pseudonymized_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.child_access_log WHERE user_id = NEW.id AND user_pseudonymized_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.child_access_log WHERE by_user = NEW.id AND by_pseudonymized_at IS NOT NULL) THEN
    RAISE EXCEPTION 'child id taken' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
-- UPDATE OF id — путь service-role: клиенту менять id не дано (_160000, GRANT UPDATE).
CREATE TRIGGER children_id_not_taken BEFORE INSERT OR UPDATE OF id ON public.children
  FOR EACH ROW EXECUTE FUNCTION public.children_id_not_taken();

REVOKE ALL ON FUNCTION public.consent_events_clamp_revoke_time() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.children_id_not_taken() FROM PUBLIC, anon, authenticated;
