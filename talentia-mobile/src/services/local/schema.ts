/**
 * Схема локальной базы. Версия — `PRAGMA user_version`; миграции только добавляются
 * новым элементом массива, существующие не правятся — как и серверные.
 *
 * **Журналы — только дописывание, и это держит сама база, а не код.** Пробы ABA,
 * сессии ABA, прохождения уроков и согласия нельзя ни исправить, ни удалить обычным
 * запросом: триггеры отклоняют. Запись, которую можно отредактировать, ничего не
 * доказывает, а проценты специалиста считались бы по выборке, из которой удобное
 * убрали. Удалить можно только всё о ребёнке сразу — по праву на удаление, через
 * `purge_gate` внутри одной транзакции (`purge.ts`). Журнал согласий и тогда не
 * удаляется, а получает псевдоним: он остаётся доказательством.
 *
 * Троттлинга записи нет и быть не должно: механизм прежнего `abaLiveSessionStore`
 * терял первую из двух записей за 2.5 с, а пробы идут пачками.
 */
import type { SqlDb } from './sql';

/**
 * Локальный срок хранения журналов — 12 месяцев, как на сервере (PARENT.md, «Данные на
 * устройстве»). Навыки и цели лежат в сводном состоянии `child_state` и не теряются.
 */
export const RETENTION_MONTHS = 12;
/** Скачок часов вперёд, после которого срок хранения ждёт взрослого (№147). */
export const CLOCK_JUMP_HOLD_DAYS = 45;

/** Удаление строк ребёнка разрешено, пока в `purge_gate` есть его id (или `*` — всё). */
const gated = (table: string) => `
CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table}
BEGIN SELECT RAISE(ABORT, '${table}: только дописывание'); END;
CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table}
WHEN NOT EXISTS (SELECT 1 FROM purge_gate WHERE child_id IN (OLD.child_id, '*'))
BEGIN SELECT RAISE(ABORT, '${table}: только дописывание'); END;`;

/** Удаление — по ребёнку через purge_gate или по сроку через retention_gate. */
const retained = (table: string, column: string) => `
DROP TRIGGER ${table}_no_delete;
CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table}
WHEN NOT EXISTS (SELECT 1 FROM purge_gate WHERE child_id IN (OLD.child_id, '*'))
  AND NOT EXISTS (SELECT 1 FROM retention_gate WHERE OLD.${column} < before)
BEGIN SELECT RAISE(ABORT, '${table}: только дописывание'); END;`;

export const MIGRATIONS: readonly string[] = [
  // 1 — журналы, состояние по ребёнку, курсоры синхронизации
  `
CREATE TABLE purge_gate (child_id TEXT PRIMARY KEY);

CREATE TABLE aba_trials (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id    TEXT NOT NULL,
  id          TEXT NOT NULL UNIQUE,
  session_id  TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  body        TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE INDEX aba_trials_target ON aba_trials (child_id, target_id, seq);
CREATE INDEX aba_trials_session ON aba_trials (child_id, session_id, seq);
${gated('aba_trials')}

CREATE TABLE aba_sessions (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id      TEXT NOT NULL,
  id            TEXT NOT NULL UNIQUE,
  session_index INTEGER NOT NULL,
  body          TEXT NOT NULL,
  recorded_at   TEXT NOT NULL,
  UNIQUE (child_id, session_index)
);
${gated('aba_sessions')}

CREATE TABLE lesson_runs (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id    TEXT NOT NULL,
  id          TEXT NOT NULL UNIQUE,
  lesson_id   TEXT NOT NULL,
  started_at  TEXT NOT NULL,
  body        TEXT NOT NULL
);
CREATE INDEX lesson_runs_child ON lesson_runs (child_id, started_at);
${gated('lesson_runs')}

-- Журнал согласий. child_id NULL — согласие на аккаунт. Не удаляется даже при удалении
-- ребёнка: получает псевдоним (разрешено только это и только через purge_gate).
CREATE TABLE consent_events (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  id           TEXT NOT NULL UNIQUE,
  scope        TEXT NOT NULL,
  action       TEXT NOT NULL CHECK (action IN ('grant', 'revoke')),
  child_id     TEXT,
  text_version TEXT NOT NULL CHECK (text_version <> ''),
  confirmed_by TEXT NOT NULL,
  actor_id     TEXT NOT NULL,
  at           TEXT NOT NULL
);
CREATE INDEX consent_events_child ON consent_events (child_id, scope, seq);
CREATE TRIGGER consent_events_no_update BEFORE UPDATE ON consent_events
WHEN NOT EXISTS (SELECT 1 FROM purge_gate WHERE child_id IN (OLD.child_id, OLD.actor_id, '*'))
  OR NEW.id IS NOT OLD.id OR NEW.scope IS NOT OLD.scope OR NEW.action IS NOT OLD.action
  OR NEW.text_version IS NOT OLD.text_version OR NEW.confirmed_by IS NOT OLD.confirmed_by
  OR NEW.at IS NOT OLD.at
BEGIN SELECT RAISE(ABORT, 'consent_events: только дописывание'); END;
CREATE TRIGGER consent_events_no_delete BEFORE DELETE ON consent_events
WHEN NOT EXISTS (SELECT 1 FROM purge_gate WHERE child_id = '*')
BEGIN SELECT RAISE(ABORT, 'consent_events: только дописывание'); END;

-- Изменяемое состояние ребёнка: навыки, цели ABA, доска, наборы, атлас, сессия в работе.
CREATE TABLE child_state (
  child_id   TEXT NOT NULL,
  key        TEXT NOT NULL,
  body       TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (child_id, key)
);

-- Докуда поток ушёл в облако. child_id '' — поток аккаунта.
CREATE TABLE sync_cursor (
  child_id TEXT NOT NULL,
  stream   TEXT NOT NULL,
  position TEXT NOT NULL,
  PRIMARY KEY (child_id, stream)
);
`,
  // 2 — срок хранения и доставка согласий
  //
  // Журналы можно было удалить только целиком по ребёнку, и локальный срок хранения ввести
  // было нельзя. Теперь — ещё и строки старше отметки в retention_gate, и только их.
  //
  // Согласия уходят на сервер по одному и в своём порядке (первым — событие, создающее
  // ребёнка в облаке), поэтому доставка учитывается по событию, а не курсором. Событие,
  // которое сервер отклонил по существу (устаревший текст, часы устройства), не
  // повторяется вечно, а ждёт родителя в sync_problems.
  `
CREATE TABLE retention_gate (before TEXT NOT NULL);
${['aba_trials', 'aba_sessions'].map((t) => retained(t, 'recorded_at')).join('\n')}
${retained('lesson_runs', 'started_at')}

CREATE TABLE consent_delivered (id TEXT PRIMARY KEY, delivered_at TEXT NOT NULL);

CREATE TABLE sync_problems (
  child_id   TEXT NOT NULL,
  event_id   TEXT NOT NULL,
  reason     TEXT NOT NULL,
  noticed_at TEXT NOT NULL,
  PRIMARY KEY (child_id, event_id)
);
`,
  // 3 — данные ABA пишутся только при согласии (аудит приватности 2026-10-01)
  //
  // Согласие проверяет commit.ts внутри транзакции записи и на это время открывает
  // aba_write_gate для ребёнка. Вставка проб и сессий и запись состояния ABA без открытых
  // ворот отклоняются базой: обойти проверку импортом appendTrial или saveChildState
  // нельзя. Удаление не гейтится — его держат purge_gate и retention_gate.
  `
CREATE TABLE aba_write_gate (child_id TEXT PRIMARY KEY);
${['aba_trials', 'aba_sessions']
  .map(
    (t) => `
CREATE TRIGGER ${t}_need_consent BEFORE INSERT ON ${t}
WHEN NOT EXISTS (SELECT 1 FROM aba_write_gate WHERE child_id = NEW.child_id)
BEGIN SELECT RAISE(ABORT, '${t}: запись только через commit.ts при согласии на данные ABA'); END;`,
  )
  .join('\n')}
${['INSERT', 'UPDATE']
  .map(
    (op) => `
CREATE TRIGGER child_state_aba_need_consent_${op.toLowerCase()} BEFORE ${op} ON child_state
WHEN NEW.key IN ('abaTargets', 'tokenTraining', 'identifySets', 'abaBoard', 'abaSessionIndex', 'abaSessionInProgress')
  AND NOT EXISTS (SELECT 1 FROM aba_write_gate WHERE child_id = NEW.child_id)
BEGIN SELECT RAISE(ABORT, 'child_state: состояние ABA только через commit.ts при согласии на данные ABA'); END;`,
  )
  .join('\n')}
`,
  // 4 — отзыв согласия на ABA только вместе с удалением (повторная проверка приватности)
  //
  // Отзыв без удаления оставляет данные о здоровье без основания. Отзыв aba_processing
  // база принимает, только когда у ребёнка уже нет проб, сессий и состояния ABA:
  // revokeAbaProcessing удаляет их той же транзакцией до вставки события.
  `
CREATE TRIGGER consent_events_aba_revoke_needs_purge BEFORE INSERT ON consent_events
WHEN NEW.scope = 'aba_processing' AND NEW.action = 'revoke' AND (
  EXISTS (SELECT 1 FROM aba_trials WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_sessions WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM child_state WHERE child_id = NEW.child_id AND key IN
    ('abaTargets', 'tokenTraining', 'identifySets', 'abaBoard', 'abaSessionIndex', 'abaSessionInProgress', 'abaPaused'))
)
BEGIN SELECT RAISE(ABORT, 'consent_events: отзыв согласия на ABA — только вместе с удалением данных'); END;
`,
  // 5 — разрешение физической подсказки в ABA-состоянии (условия приватности, блок 4)
  //
  // Ключ physicalPromptAllowed пишется только при согласии и только через commit.ts, а отзыв
  // при нём не принимается — как у остальных ключей ABA. Триггеры миграций 3 и 4
  // пересоздаются с новым списком.
  `
${['insert', 'update'].map((op) => `DROP TRIGGER child_state_aba_need_consent_${op};`).join('\n')}
${['INSERT', 'UPDATE']
  .map(
    (op) => `
CREATE TRIGGER child_state_aba_need_consent_${op.toLowerCase()} BEFORE ${op} ON child_state
WHEN NEW.key IN ('abaTargets', 'tokenTraining', 'identifySets', 'abaBoard', 'abaSessionIndex', 'abaSessionInProgress', 'physicalPromptAllowed')
  AND NOT EXISTS (SELECT 1 FROM aba_write_gate WHERE child_id = NEW.child_id)
BEGIN SELECT RAISE(ABORT, 'child_state: состояние ABA только через commit.ts при согласии на данные ABA'); END;`,
  )
  .join('\n')}
DROP TRIGGER consent_events_aba_revoke_needs_purge;
CREATE TRIGGER consent_events_aba_revoke_needs_purge BEFORE INSERT ON consent_events
WHEN NEW.scope = 'aba_processing' AND NEW.action = 'revoke' AND (
  EXISTS (SELECT 1 FROM aba_trials WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_sessions WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM child_state WHERE child_id = NEW.child_id AND key IN
    ('abaTargets', 'tokenTraining', 'identifySets', 'abaBoard', 'abaSessionIndex', 'abaSessionInProgress', 'abaPaused',
     'physicalPromptAllowed'))
)
BEGIN SELECT RAISE(ABORT, 'consent_events: отзыв согласия на ABA — только вместе с удалением данных'); END;
`,
  // 6 — журнал IOA и наблюдатели (условия приватности для блока 5, ABA.md)
  //
  // Записи второго наблюдателя — отдельный журнал: вносятся после сессии, а журнал сессий
  // только дописывается. Как пробы: только дописывание, удаление — по ребёнку или сроку,
  // запись — только через ворота согласия. Наблюдатели — ключ ABA-состояния abaObservers.
  // Отзыв согласия при оставшихся записях IOA или наблюдателях база не принимает.
  `
CREATE TABLE aba_ioa (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id    TEXT NOT NULL,
  id          TEXT NOT NULL UNIQUE,
  session_id  TEXT NOT NULL,
  body        TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE INDEX aba_ioa_session ON aba_ioa (child_id, session_id, seq);
CREATE TRIGGER aba_ioa_no_update BEFORE UPDATE ON aba_ioa
BEGIN SELECT RAISE(ABORT, 'aba_ioa: только дописывание'); END;
CREATE TRIGGER aba_ioa_no_delete BEFORE DELETE ON aba_ioa
WHEN NOT EXISTS (SELECT 1 FROM purge_gate WHERE child_id IN (OLD.child_id, '*'))
  AND NOT EXISTS (SELECT 1 FROM retention_gate WHERE OLD.recorded_at < before)
BEGIN SELECT RAISE(ABORT, 'aba_ioa: только дописывание'); END;
CREATE TRIGGER aba_ioa_need_consent BEFORE INSERT ON aba_ioa
WHEN NOT EXISTS (SELECT 1 FROM aba_write_gate WHERE child_id = NEW.child_id)
BEGIN SELECT RAISE(ABORT, 'aba_ioa: запись только через commit.ts при согласии на данные ABA'); END;
${['insert', 'update'].map((op) => `DROP TRIGGER child_state_aba_need_consent_${op};`).join('\n')}
${['INSERT', 'UPDATE']
  .map(
    (op) => `
CREATE TRIGGER child_state_aba_need_consent_${op.toLowerCase()} BEFORE ${op} ON child_state
WHEN NEW.key IN ('abaTargets', 'tokenTraining', 'identifySets', 'abaBoard', 'abaSessionIndex', 'abaSessionInProgress',
                 'physicalPromptAllowed', 'abaObservers')
  AND NOT EXISTS (SELECT 1 FROM aba_write_gate WHERE child_id = NEW.child_id)
BEGIN SELECT RAISE(ABORT, 'child_state: состояние ABA только через commit.ts при согласии на данные ABA'); END;`,
  )
  .join('\n')}
DROP TRIGGER consent_events_aba_revoke_needs_purge;
CREATE TRIGGER consent_events_aba_revoke_needs_purge BEFORE INSERT ON consent_events
WHEN NEW.scope = 'aba_processing' AND NEW.action = 'revoke' AND (
  EXISTS (SELECT 1 FROM aba_trials WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_sessions WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_ioa WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM child_state WHERE child_id = NEW.child_id AND key IN
    ('abaTargets', 'tokenTraining', 'identifySets', 'abaBoard', 'abaSessionIndex', 'abaSessionInProgress', 'abaPaused',
     'physicalPromptAllowed', 'abaObservers'))
)
BEGIN SELECT RAISE(ABORT, 'consent_events: отзыв согласия на ABA — только вместе с удалением данных'); END;
`,
  // 7 — проблемы синхронизации не только у событий (аудит 2026-10-06, А7)
  //
  // Сервер может отклонить по существу и данные — прохождения, навыки. Раньше такой отказ
  // уходил в бесконечные повторы. Вид проблемы: `consent` — событие (event_id — id события),
  // `lesson_runs` и `skill_state` — поток данных (event_id — имя потока), `lesson_run` — одно
  // прохождение (event_id — его id).
  // reason — стабильный код (`SyncProblemCode`), не текст сервера. Отдельное прохождение
  // (`lesson_run`) курсор уже обошёл — «повторить» ставит retry = 1, и проход отправляет его
  // снова отдельно от пачек.
  `
ALTER TABLE sync_problems ADD COLUMN kind TEXT NOT NULL DEFAULT 'consent';
ALTER TABLE sync_problems ADD COLUMN retry INTEGER NOT NULL DEFAULT 0;
`,
  // 8 — прогоны рутин самообслуживания (раунд 2, Р3; `aba-pedagogy-specialist` 2026-10-11)
  //
  // Рутина проходит в свой естественный момент, вне сессии: свой журнал прогонов (в журнале
  // сессий номер сессии уникален, а прогон его не двигает). Как пробы: только дописывание,
  // удаление — по ребёнку или сроку, запись — только через ворота согласия на данные ABA.
  // Прогон, свёрнутый посреди, — ключ ABA-состояния abaRoutineRunInProgress. Отзыв согласия
  // при оставшихся прогонах или свёрнутом прогоне база не принимает.
  `
CREATE TABLE aba_routine_runs (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id    TEXT NOT NULL,
  id          TEXT NOT NULL UNIQUE,
  target_id   TEXT NOT NULL,
  day         TEXT NOT NULL,
  body        TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE INDEX aba_routine_runs_target ON aba_routine_runs (child_id, target_id, seq);
${gated('aba_routine_runs')}
${retained('aba_routine_runs', 'recorded_at')}
CREATE TRIGGER aba_routine_runs_need_consent BEFORE INSERT ON aba_routine_runs
WHEN NOT EXISTS (SELECT 1 FROM aba_write_gate WHERE child_id = NEW.child_id)
BEGIN SELECT RAISE(ABORT, 'aba_routine_runs: запись только через commit.ts при согласии на данные ABA'); END;
${['insert', 'update'].map((op) => `DROP TRIGGER child_state_aba_need_consent_${op};`).join('\n')}
${['INSERT', 'UPDATE']
  .map(
    (op) => `
CREATE TRIGGER child_state_aba_need_consent_${op.toLowerCase()} BEFORE ${op} ON child_state
WHEN NEW.key IN ('abaTargets', 'tokenTraining', 'identifySets', 'abaBoard', 'abaSessionIndex', 'abaSessionInProgress',
                 'physicalPromptAllowed', 'abaObservers', 'abaRoutineRunInProgress')
  AND NOT EXISTS (SELECT 1 FROM aba_write_gate WHERE child_id = NEW.child_id)
BEGIN SELECT RAISE(ABORT, 'child_state: состояние ABA только через commit.ts при согласии на данные ABA'); END;`,
  )
  .join('\n')}
DROP TRIGGER consent_events_aba_revoke_needs_purge;
CREATE TRIGGER consent_events_aba_revoke_needs_purge BEFORE INSERT ON consent_events
WHEN NEW.scope = 'aba_processing' AND NEW.action = 'revoke' AND (
  EXISTS (SELECT 1 FROM aba_trials WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_sessions WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_ioa WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_routine_runs WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM child_state WHERE child_id = NEW.child_id AND key IN
    ('abaTargets', 'tokenTraining', 'identifySets', 'abaBoard', 'abaSessionIndex', 'abaSessionInProgress', 'abaPaused',
     'physicalPromptAllowed', 'abaObservers', 'abaRoutineRunInProgress'))
)
BEGIN SELECT RAISE(ABORT, 'consent_events: отзыв согласия на ABA — только вместе с удалением данных'); END;
`,
  // 9 — журнал выборов подкрепителя (раунд 2, Р3, «живая доска»; методист 2026-10-12)
  //
  // История выборов — единственный источник для «не предлагать выбранное дважды подряд»: выбирают и
  // сессия, и обмен после прогона рутины, и порядок между ними решает время выбора, а не конец
  // сессии. Входит любой выбор с подкрепителем, в том числе взрослого. Только дописывание;
  // удаление — по ребёнку или сроку; запись — только через ворота согласия на данные ABA. В облако
  // не уходит. Выбор рутины — один на прогон (частичный уникальный индекс); выборов сессии бывает
  // несколько (повторный — после обмена рутины, пока сессия свёрнута). Отзыв согласия при оставшихся
  // выборах база не принимает. Прежняя история (по одному выбору на сессию) переносится из журнала
  // сессий — до создания триггеров.
  `
CREATE TABLE aba_reinforcer_choices (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id      TEXT NOT NULL,
  chosen_at     TEXT NOT NULL,
  source        TEXT NOT NULL CHECK (source IN ('session', 'routine')),
  source_id     TEXT NOT NULL,
  reinforcer_id TEXT NOT NULL CHECK (reinforcer_id <> ''),
  chosen_by     TEXT NOT NULL CHECK (chosen_by IN ('child', 'adult'))
);
CREATE INDEX aba_reinforcer_choices_order ON aba_reinforcer_choices (child_id, chosen_at, seq);
CREATE UNIQUE INDEX aba_reinforcer_choices_one_per_run ON aba_reinforcer_choices (child_id, source_id) WHERE source = 'routine';
INSERT INTO aba_reinforcer_choices (child_id, chosen_at, source, source_id, reinforcer_id, chosen_by)
  SELECT child_id, recorded_at, 'session', id, json_extract(body, '$.reinforcerId'),
         COALESCE(json_extract(body, '$.reinforcerChosenBy'), 'child')
    FROM aba_sessions
   WHERE COALESCE(json_extract(body, '$.reinforcerId'), '') <> ''
   ORDER BY session_index;
${gated('aba_reinforcer_choices')}
${retained('aba_reinforcer_choices', 'chosen_at')}
CREATE TRIGGER aba_reinforcer_choices_need_consent BEFORE INSERT ON aba_reinforcer_choices
WHEN NOT EXISTS (SELECT 1 FROM aba_write_gate WHERE child_id = NEW.child_id)
BEGIN SELECT RAISE(ABORT, 'aba_reinforcer_choices: запись только через commit.ts при согласии на данные ABA'); END;
DROP TRIGGER consent_events_aba_revoke_needs_purge;
CREATE TRIGGER consent_events_aba_revoke_needs_purge BEFORE INSERT ON consent_events
WHEN NEW.scope = 'aba_processing' AND NEW.action = 'revoke' AND (
  EXISTS (SELECT 1 FROM aba_trials WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_sessions WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_ioa WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_routine_runs WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_reinforcer_choices WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM child_state WHERE child_id = NEW.child_id AND key IN
    ('abaTargets', 'tokenTraining', 'identifySets', 'abaBoard', 'abaSessionIndex', 'abaSessionInProgress', 'abaPaused',
     'physicalPromptAllowed', 'abaObservers', 'abaRoutineRunInProgress'))
)
BEGIN SELECT RAISE(ABORT, 'consent_events: отзыв согласия на ABA — только вместе с удалением данных'); END;
`,
  // 10 — обмен рутины вместе с выбором, исправления отметок, карточка «перерыв»
  //     (раунд 3; методист 2026-10-12)
  //
  // • aba_reinforcer_choices.tokens — сколько жетонов ушло с выбором рутины (жетоны уходят только
  //   вместе с выбором: полная доска и есть ожидающий обмен).
  // • aba_trial_corrections — отмена последней отметки взрослого в течение 5 с: исходная проба
  //   остаётся в aba_trials, замена пишется отдельной строкой, здесь — связь и причина (без
  //   свободного текста). Только дописывание, запись через ворота согласия, срок и удаление как у проб.
  // • ключ ABA-состояния breakCard (обучение карточке «перерыв» на ребёнке) — в триггерах согласия и отзыва.
  `
ALTER TABLE aba_reinforcer_choices ADD COLUMN tokens INTEGER;

CREATE TABLE aba_trial_corrections (
  seq               INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id          TEXT NOT NULL,
  trial_id          TEXT NOT NULL UNIQUE,
  replacement_id    TEXT NOT NULL UNIQUE,
  session_id        TEXT NOT NULL,
  recorded_at       TEXT NOT NULL,
  ms_since_original INTEGER NOT NULL,
  from_response     TEXT NOT NULL,
  to_response       TEXT NOT NULL,
  token_kept        INTEGER NOT NULL CHECK (token_kept IN (0, 1)),
  token_added       INTEGER NOT NULL CHECK (token_added IN (0, 1)),
  reason            TEXT NOT NULL CHECK (reason = 'adult_misentry')
);
CREATE INDEX aba_trial_corrections_session ON aba_trial_corrections (child_id, session_id, seq);
${gated('aba_trial_corrections')}
${retained('aba_trial_corrections', 'recorded_at')}
CREATE TRIGGER aba_trial_corrections_need_consent BEFORE INSERT ON aba_trial_corrections
WHEN NOT EXISTS (SELECT 1 FROM aba_write_gate WHERE child_id = NEW.child_id)
BEGIN SELECT RAISE(ABORT, 'aba_trial_corrections: запись только через commit.ts при согласии на данные ABA'); END;
${['insert', 'update'].map((op) => `DROP TRIGGER child_state_aba_need_consent_${op};`).join('\n')}
${['INSERT', 'UPDATE']
  .map(
    (op) => `
CREATE TRIGGER child_state_aba_need_consent_${op.toLowerCase()} BEFORE ${op} ON child_state
WHEN NEW.key IN ('abaTargets', 'tokenTraining', 'identifySets', 'abaBoard', 'abaSessionIndex', 'abaSessionInProgress',
                 'physicalPromptAllowed', 'abaObservers', 'abaRoutineRunInProgress', 'breakCard')
  AND NOT EXISTS (SELECT 1 FROM aba_write_gate WHERE child_id = NEW.child_id)
BEGIN SELECT RAISE(ABORT, 'child_state: состояние ABA только через commit.ts при согласии на данные ABA'); END;`,
  )
  .join('\n')}
DROP TRIGGER consent_events_aba_revoke_needs_purge;
CREATE TRIGGER consent_events_aba_revoke_needs_purge BEFORE INSERT ON consent_events
WHEN NEW.scope = 'aba_processing' AND NEW.action = 'revoke' AND (
  EXISTS (SELECT 1 FROM aba_trials WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_sessions WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_ioa WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_routine_runs WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_reinforcer_choices WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_trial_corrections WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM child_state WHERE child_id = NEW.child_id AND key IN
    ('abaTargets', 'tokenTraining', 'identifySets', 'abaBoard', 'abaSessionIndex', 'abaSessionInProgress', 'abaPaused',
     'physicalPromptAllowed', 'abaObservers', 'abaRoutineRunInProgress', 'breakCard'))
)
BEGIN SELECT RAISE(ABORT, 'consent_events: отзыв согласия на ABA — только вместе с удалением данных'); END;
`,
  // 11 — индекс журнала выборов по порядку записи (сессия 2026-10-18): история подкрепителей и
  //     экспорт читают `WHERE child_id = ? ORDER BY seq`, а индекс `_order` идёт через chosen_at.
  `
CREATE INDEX aba_reinforcer_choices_seq ON aba_reinforcer_choices (child_id, seq);
`,
  // 12 — фиксация рутины в две транзакции (раунд 4, Д2; методист 2026-10-19)
  //
  // Жетон рутины — сразу после последнего звена: прогон записывается с местом «как обычно», а
  // отметка «где и с кем» приходит позже. Журнал прогонов только дописывается, поэтому место и
  // смена фазы после пересчёта (и после исправления последнего звена) — отдельный журнал поправок:
  // читатели берут последнюю строку прогона. Как прогоны: только дописывание, удаление — по
  // ребёнку или сроку, запись — через ворота согласия. Открытая форма — ключ ABA-состояния
  // abaRoutineSettingOpen. Отзыв согласия при оставшихся поправках или открытой форме база не принимает.
  `
CREATE TABLE aba_routine_run_amendments (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id    TEXT NOT NULL,
  run_id      TEXT NOT NULL,
  body        TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE INDEX aba_routine_run_amendments_run ON aba_routine_run_amendments (child_id, run_id, seq);
${gated('aba_routine_run_amendments')}
${retained('aba_routine_run_amendments', 'recorded_at')}
CREATE TRIGGER aba_routine_run_amendments_need_consent BEFORE INSERT ON aba_routine_run_amendments
WHEN NOT EXISTS (SELECT 1 FROM aba_write_gate WHERE child_id = NEW.child_id)
BEGIN SELECT RAISE(ABORT, 'aba_routine_run_amendments: запись только через commit.ts при согласии на данные ABA'); END;
${['insert', 'update'].map((op) => `DROP TRIGGER child_state_aba_need_consent_${op};`).join('\n')}
${['INSERT', 'UPDATE']
  .map(
    (op) => `
CREATE TRIGGER child_state_aba_need_consent_${op.toLowerCase()} BEFORE ${op} ON child_state
WHEN NEW.key IN ('abaTargets', 'tokenTraining', 'identifySets', 'abaBoard', 'abaSessionIndex', 'abaSessionInProgress',
                 'physicalPromptAllowed', 'abaObservers', 'abaRoutineRunInProgress', 'breakCard', 'abaRoutineSettingOpen')
  AND NOT EXISTS (SELECT 1 FROM aba_write_gate WHERE child_id = NEW.child_id)
BEGIN SELECT RAISE(ABORT, 'child_state: состояние ABA только через commit.ts при согласии на данные ABA'); END;`,
  )
  .join('\n')}
DROP TRIGGER consent_events_aba_revoke_needs_purge;
CREATE TRIGGER consent_events_aba_revoke_needs_purge BEFORE INSERT ON consent_events
WHEN NEW.scope = 'aba_processing' AND NEW.action = 'revoke' AND (
  EXISTS (SELECT 1 FROM aba_trials WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_sessions WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_ioa WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_routine_runs WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_reinforcer_choices WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_trial_corrections WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM aba_routine_run_amendments WHERE child_id = NEW.child_id)
  OR EXISTS (SELECT 1 FROM child_state WHERE child_id = NEW.child_id AND key IN
    ('abaTargets', 'tokenTraining', 'identifySets', 'abaBoard', 'abaSessionIndex', 'abaSessionInProgress', 'abaPaused',
     'physicalPromptAllowed', 'abaObservers', 'abaRoutineRunInProgress', 'breakCard', 'abaRoutineSettingOpen'))
)
BEGIN SELECT RAISE(ABORT, 'consent_events: отзыв согласия на ABA — только вместе с удалением данных'); END;
`,
  // 13 — итоги урока пишутся только при согласии account_local (№124, PARENT.md, «Запись уроков
  //     под account_local»)
  //
  // Как ABA в миграции 3: commit.ts проверяет согласие внутри транзакции записи и на это время
  // открывает lesson_write_gate для ребёнка. Вставка прохождений и запись навыков, атласа и
  // счётчика уроков без открытых ворот отклоняются базой. Удаление не гейтится — его держат
  // purge_gate и retention_gate. Триггера «отзыв только при пустых данных» нет: account_local
  // отзывается только удалением аккаунта (consentLog.ts).
  `
CREATE TABLE lesson_write_gate (child_id TEXT PRIMARY KEY);
CREATE TRIGGER lesson_runs_need_consent BEFORE INSERT ON lesson_runs
WHEN NOT EXISTS (SELECT 1 FROM lesson_write_gate WHERE child_id = NEW.child_id)
BEGIN SELECT RAISE(ABORT, 'lesson_runs: запись только через commit.ts при согласии account_local'); END;
${['INSERT', 'UPDATE']
  .map(
    (op) => `
CREATE TRIGGER child_state_lesson_need_consent_${op.toLowerCase()} BEFORE ${op} ON child_state
WHEN NEW.key IN ('skills', 'atlas', 'lessonCounter')
  AND NOT EXISTS (SELECT 1 FROM lesson_write_gate WHERE child_id = NEW.child_id)
BEGIN SELECT RAISE(ABORT, 'child_state: итоги урока только через commit.ts при согласии account_local'); END;`,
  )
  .join('\n')}
`,
  // 14. formatsSeen — составные форматы, которые ребёнок уже встречал (демо первой встречи один раз,
  // №35) — итог урока под теми же воротами, что skills/atlas/lessonCounter (этап 10, 2026-10-25).
  `
${['INSERT', 'UPDATE']
  .map(
    (op) => `
CREATE TRIGGER child_state_formats_need_consent_${op.toLowerCase()} BEFORE ${op} ON child_state
WHEN NEW.key = 'formatsSeen'
  AND NOT EXISTS (SELECT 1 FROM lesson_write_gate WHERE child_id = NEW.child_id)
BEGIN SELECT RAISE(ABORT, 'child_state: formatsSeen только через commit.ts при согласии account_local'); END;`,
  )
  .join('\n')}
`,
  // 15. Последняя виденная дата для срока хранения (№147, `backend-auditor` 2026-10-25): одна строка,
  // время в ней только растёт — перевод часов назад не сбрасывает защиту от скачка вперёд.
  `
CREATE TABLE retention_clock (id INTEGER PRIMARY KEY CHECK (id = 1), last_seen TEXT NOT NULL);
CREATE TRIGGER retention_clock_monotonic BEFORE UPDATE ON retention_clock
WHEN NEW.last_seen < OLD.last_seen
BEGIN SELECT RAISE(ABORT, 'retention_clock: время не идёт назад'); END;
`,
];

/**
 * Ворота удаления, срока хранения, записи ABA и записи урока открываются и закрываются внутри
 * одной транзакции. Если строка всё же осталась (сбой посреди записи вне транзакции), она бы
 * пропускала записи без проверки — и после перезапуска. Поэтому при каждом открытии базы
 * ворота закрываются.
 */
async function closeGates(db: SqlDb): Promise<void> {
  await db.exec(
    'DELETE FROM aba_write_gate; DELETE FROM lesson_write_gate; DELETE FROM purge_gate; DELETE FROM retention_gate;',
  );
}

/**
 * Накатить недостающие миграции — при каждом открытии базы. Каждая — своей транзакцией
 * вместе с номером версии. После — закрыть ворота (`closeGates`).
 */
export async function migrate(db: SqlDb): Promise<void> {
  const [{ user_version: current }] = await db.all<{ user_version: number }>('PRAGMA user_version');
  for (let v = current; v < MIGRATIONS.length; v += 1) {
    await db.transaction(async (tx) => {
      await tx.exec(MIGRATIONS[v]);
      await tx.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
  await closeGates(db);
}
