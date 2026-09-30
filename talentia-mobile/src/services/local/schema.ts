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

/** Удаление строк ребёнка разрешено, пока в `purge_gate` есть его id (или `*` — всё). */
const gated = (table: string) => `
CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table}
BEGIN SELECT RAISE(ABORT, '${table}: только дописывание'); END;
CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table}
WHEN NOT EXISTS (SELECT 1 FROM purge_gate WHERE child_id IN (OLD.child_id, '*'))
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
];

/** Накатить недостающие миграции. Каждая — своей транзакцией вместе с номером версии. */
export async function migrate(db: SqlDb): Promise<void> {
  const [{ user_version: current }] = await db.all<{ user_version: number }>('PRAGMA user_version');
  for (let v = current; v < MIGRATIONS.length; v += 1) {
    await db.transaction(async () => {
      await db.exec(MIGRATIONS[v]);
      await db.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
}
