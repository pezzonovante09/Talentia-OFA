/**
 * Журнал проб и сессий ABA на устройстве. Спецификация — ABA.md, «Данные» и «Хранение».
 *
 * Каждая проба пишется сразу, отдельной строкой, без троттлинга и без пачек: прогресс
 * считается только отсюда, а не из сводных полей живой сессии — они приблизительны по
 * построению. Противоречивая проба (`trialInvariantErrors`) в журнал не попадает.
 *
 * **Без согласия на данные ABA не пишется ничего** (`aba_processing`, решение владельца
 * 2026-10-01, №1), и на паузе тоже. Экраны пишут только через `commit.ts`: он вызывает
 * `withAbaWrite`, который проверяет согласие и паузу внутри той же эксклюзивной
 * транзакции, что и запись, — отзыв не проскочит между проверкой и вставкой. На время
 * записи открываются ворота `aba_write_gate`; без них вставку проб, сессий и состояния ABA
 * отклоняет сама база (`schema.ts`, миграция 3). `appendTrial` и `appendSession` —
 * кирпичи для `commit.ts`, а не вход для экранов.
 *
 * Обе ошибки — штатный ход, а не сбой: в отчёты об ошибках их не отправлять, само сообщение
 * связывает устройство с ABA-режимом (ABA.md, «Согласие `aba_processing`»).
 */
import { leaksTime } from '../../domain/ids';
import { COUNTS_TOWARD_MASTERY, type AbaIoaRecord, type AbaPairingSession, type AbaRoutineRun, type AbaSession, type AbaTrial } from '../../types/aba';
import { trialInvariantErrors, type SessionTrials } from '../../domain/abaPrompting';
import { isGranted } from '../../domain/consent';
import { openRoutineOffer, type RoutineOffer } from '../../domain/abaTokens';
import type { RoutineHistory } from '../../domain/abaRoutineRun';
import { CURRENT_CONSENT_TEXTS } from '../../domain/consentTexts';
import { loadChildState } from './childState';
import { readConsentLog } from './consentLog';
import type { SqlDb } from './sql';

/** Согласия на данные ABA нет, оно отозвано или дано на прежний текст. Экран закрывает режим. */
export class AbaConsentRequiredError extends Error {
  constructor(readonly childId: string) {
    super('Нет согласия на данные ABA: проба не записана');
  }
}

/** Режим на паузе: сессию не начать, пробы не пишутся. */
export class AbaPausedError extends Error {
  constructor(readonly childId: string) {
    super('ABA на паузе: проба не записана');
  }
}

/**
 * IOA для сессии, которой нет на устройстве (не записана, удалена отзывом или сроком хранения).
 * Срок хранения IOA считается по дате сессии — без сессии запись пережила бы её; экран
 * предлагает выбрать сессию заново.
 */
export class AbaSessionMissingError extends Error {
  constructor(readonly sessionId: string) {
    super('Нет сессии для IOA: запись не сделана');
  }
}

/**
 * Доску изменила другая процедура (рутина) между сверкой сессии и этой записью: не записано
 * ничего. Экран возобновляет сессию (`resumeAbaSession`) и повторяет шаг по живой доске.
 */
export class AbaBoardConflictError extends Error {
  constructor(
    readonly expectedRev: number,
    readonly actualRev: number,
  ) {
    super('Доска жетонов изменилась: шаг не записан, сессию нужно возобновить');
  }
}

/**
 * Обмен после рутины закрыт: предложения нет, выбор уже сделан, доска не полна (сессия обменяла
 * раньше) или подкрепитель не из предложенных. Экран молча идёт дальше, без доступа.
 */
export class ExchangeNotOpenError extends Error {
  constructor() {
    super('Обмен после рутины уже закрыт');
  }
}

/** Рутина уже пройдена в этот день (локальный `YYYY-MM-DD`): второй прогон в тот же день не записывается. */
export class RoutineAlreadyRunError extends Error {
  constructor() {
    super('Рутина сегодня уже пройдена: прогон не записан');
  }
}

/**
 * Состояние рутины изменилось, пока шёл прогон (другая запись той же цели): итог посчитан от
 * устаревшего состояния и не записан. Экран предлагает начать прогон заново.
 */
export class RoutineStateConflictError extends Error {
  constructor() {
    super('Состояние рутины изменилось во время прогона: итог не записан');
  }
}

/**
 * Форма места или исправление звена рутины уже закрыты: прогон не тот, форма закрыта (другой
 * прогон, другой день, «как обычно») или прогона нет (раунд 4, Д2, В7). Не записано ничего; экран
 * молча идёт дальше — место остаётся «как обычно».
 */
export class RoutineRunClosedError extends Error {
  constructor() {
    super('Прогон рутины уже закрыт: отметка не записана');
  }
}

/**
 * Итог сессии посчитан без учёта обмена рутины в её окне: с нулём обменов такая сессия ложно
 * опустила бы ступень доски. Экран считает признак (`routineExchangeInSessionWindow`) и передаёт его
 * в `finishAbaSession`.
 */
export class RoutineWindowNotAccountedError extends Error {
  constructor() {
    super('Не учтён обмен рутины в окне сессии: итог не записан');
  }
}

/**
 * Согласие на текущий текст (любой язык) и не на паузе. Вызывать внутри транзакции записи.
 * Нужно и `account_local` (№124): без согласия на аккаунт на устройство не пишется ничего о
 * ребёнке, и ABA тоже — экран закрывает режим так же, как без `aba_processing`.
 */
export async function requireAbaConsent(tx: SqlDb, childId: string): Promise<void> {
  const log = await readConsentLog(tx);
  if (
    !isGranted(log, 'account_local', null, CURRENT_CONSENT_TEXTS.account_local) ||
    !isGranted(log, 'aba_processing', childId, CURRENT_CONSENT_TEXTS.aba_processing)
  ) {
    throw new AbaConsentRequiredError(childId);
  }
  if (await loadChildState(tx, childId, 'abaPaused')) throw new AbaPausedError(childId);
}

/**
 * Запись данных ABA ребёнка: проверка согласия и паузы, ворота открыты только на время
 * `fn` и закрываются в той же транзакции. Транзакцию открывает сама — вызов на `tx`
 * идёт в той же, вызов на базе открывает свою: сбой внутри откатывает и ворота.
 */
export async function withAbaWrite(db: SqlDb, childId: string, fn: (tx: SqlDb) => Promise<void>): Promise<void> {
  await db.transaction(async (tx) => {
    await requireAbaConsent(tx, childId);
    await tx.run('INSERT INTO aba_write_gate (child_id) VALUES (?)', [childId]);
    await fn(tx);
    await tx.run('DELETE FROM aba_write_gate WHERE child_id = ?', [childId]);
  });
}

/**
 * Время записи журнала — всегда UTC ISO с миллисекундами (`2026-10-12T10:00:00.000Z`): срок хранения
 * (`retained` в `schema.ts`) сравнивает `recorded_at` как строки, а строка с поясом или без долей
 * секунды сравнилась бы неверно (аудит раунда 3, В-4). Не дата — ошибка, а не молчаливая запись.
 */
export function recordedAtIso(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) throw new Error('Время записи — не дата');
  return d.toISOString();
}

/**
 * Идентификатор записи ABA, из которого читается время (UUID v1/v6/v7, ULID, метка, дата), не пишется: в
 * экспорт специалисту ушёл бы режим дня ребёнка (В11, №95, №96). Экраны берут id из `newAbaId()`
 * (`services/abaIds.ts`, UUIDv4); короткие id кода и тестов (`s`, `tr-1`) времени не несут и проходят.
 */
export const abaIdGuard = {
  /**
   * Выключается только в тестах подстраховки экспорта (`specialistExport.test.ts`): там нарочно пишутся id
   * со временем — как данные, записанные до гарда, — чтобы проверить, что экспорт их заменит метками.
   */
  enabled: true,
};

function assertNoTimeInIds(what: string, ...ids: (string | undefined)[]): void {
  if (!abaIdGuard.enabled) return;
  for (const id of ids) if (id !== undefined && leaksTime(id)) throw new Error(`${what}: из id «${id}» читается время — нужен newAbaId()`);
}

export async function appendTrial(db: SqlDb, childId: string, trial: AbaTrial, recordedAt: string): Promise<void> {
  assertNoTimeInIds('Проба', trial.id, trial.sessionId);
  const errors = trialInvariantErrors(trial);
  if (errors.length) throw new Error(`Проба ${trial.id} не записана: ${errors.join('; ')}`);
  await db.run(
    'INSERT INTO aba_trials (child_id, id, session_id, target_id, body, recorded_at) VALUES (?, ?, ?, ?, ?, ?)',
    [childId, trial.id, trial.sessionId, trial.targetId, JSON.stringify(trial), recordedAtIso(recordedAt)],
  );
}

export async function appendSession(db: SqlDb, childId: string, session: AbaSession, recordedAt: string): Promise<void> {
  assertNoTimeInIds('Сессия', session.id);
  await db.run(
    'INSERT INTO aba_sessions (child_id, id, session_index, body, recorded_at) VALUES (?, ?, ?, ?, ?)',
    [childId, session.id, session.index, JSON.stringify(session), recordedAtIso(recordedAt)],
  );
}

/** Локальный день `YYYY-MM-DD` — день сессии и сопряжения в журналах. */
export function abaLocalDay(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Запись сессии сопряжения (№164) — кирпич для `commit.ts`. */
export async function appendPairingSession(db: SqlDb, childId: string, rec: AbaPairingSession, recordedAt: string): Promise<void> {
  assertNoTimeInIds('Сопряжение', rec.id);
  await db.run(
    'INSERT INTO aba_pairing_sessions (child_id, id, day, body, recorded_at) VALUES (?, ?, ?, ?, ?)',
    [childId, rec.id, rec.day, JSON.stringify(rec), recordedAtIso(recordedAt)],
  );
}

/** Прогон рутины — кирпич для `commit.ts` (раунд 2, Р3). */
export async function appendRoutineRun(db: SqlDb, childId: string, run: AbaRoutineRun, recordedAt: string): Promise<void> {
  assertNoTimeInIds('Прогон', run.id);
  await db.run(
    'INSERT INTO aba_routine_runs (child_id, id, target_id, day, body, recorded_at) VALUES (?, ?, ?, ?, ?, ?)',
    [childId, run.id, run.targetId, run.day, JSON.stringify(run), recordedAtIso(recordedAt)],
  );
}

/**
 * Поправка записанного прогона (раунд 4, Д2, В7): место «где и с кем» после пересчёта (`setting`)
 * или исправление последнего звена (`correction`) — итоговые место и смена фазы. Журнал прогонов
 * только дописывается, поэтому поправка — отдельной строкой; читатели берут последнюю.
 */
export type RoutineRunAmendment = {
  runId: string;
  reason: 'setting' | 'correction';
  setting: AbaRoutineRun['setting'];
  phase: AbaRoutineRun['phase'];
};

/** Поправка прогона — кирпич для `commit.ts`. */
export async function appendRoutineAmendment(db: SqlDb, childId: string, a: RoutineRunAmendment, recordedAt: string): Promise<void> {
  await db.run('INSERT INTO aba_routine_run_amendments (child_id, run_id, body, recorded_at) VALUES (?, ?, ?, ?)', [
    childId,
    a.runId,
    JSON.stringify(a),
    recordedAtIso(recordedAt),
  ]);
}

/** Прогоны с последними поправками: место и смена фазы — итоговые. */
export function withAmendments(runs: readonly AbaRoutineRun[], amendments: readonly RoutineRunAmendment[]): AbaRoutineRun[] {
  const last = new Map(amendments.map((a) => [a.runId, a]));
  return runs.map((r) => {
    const a = last.get(r.id);
    return a ? { ...r, setting: a.setting, phase: a.phase } : r;
  });
}

async function amendmentsOf(db: SqlDb, childId: string): Promise<RoutineRunAmendment[]> {
  return parse(
    await db.all<{ body: string }>('SELECT body FROM aba_routine_run_amendments WHERE child_id = ? ORDER BY seq', [childId]),
  );
}

export type TrialCorrectionRow = {
  trialId: string;
  replacementId: string;
  sessionId: string;
  msSinceOriginal: number;
  fromResponse: string;
  toResponse: string;
  tokenKept: 0 | 1;
  tokenAdded: 0 | 1;
};

/** Исправление отметки — кирпич для `commit.ts`: только дописывание, причина одна, без свободного текста. */
export async function appendTrialCorrection(db: SqlDb, childId: string, c: TrialCorrectionRow, recordedAt: string): Promise<void> {
  assertNoTimeInIds('Исправление', c.trialId, c.replacementId, c.sessionId);
  await db.run(
    `INSERT INTO aba_trial_corrections
       (child_id, trial_id, replacement_id, session_id, recorded_at, ms_since_original, from_response, to_response, token_kept, token_added, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'adult_misentry')`,
    [childId, c.trialId, c.replacementId, c.sessionId, recordedAtIso(recordedAt), c.msSinceOriginal, c.fromResponse, c.toResponse, c.tokenKept, c.tokenAdded],
  );
}

export type ReinforcerChoice = {
  source: 'session' | 'routine';
  sourceId: string;
  reinforcerId: string;
  chosenBy: 'child' | 'adult';
  /** Сколько жетонов ушло в обмен с этим выбором (только `routine`; для сессии сумма в `events`). */
  tokens?: number;
};

/**
 * Выбор подкрепителя — в историю в момент выбора (только дописывание). Кирпич для `commit.ts`.
 * Пустой `reinforcerId` (выбора не было) не пишется.
 */
export async function appendReinforcerChoice(db: SqlDb, childId: string, c: ReinforcerChoice, chosenAt: string): Promise<void> {
  if (!c.reinforcerId) throw new Error('Выбор без подкрепителя в историю не пишется');
  // формат chosen_at один (UTC, миллисекунды): его сравнивает routineExchangedSince; порядок истории — по seq, часы назад его не собьют
  const at = new Date(chosenAt);
  if (Number.isNaN(at.getTime())) throw new Error('Время выбора — не дата');
  await db.run(
    'INSERT INTO aba_reinforcer_choices (child_id, chosen_at, source, source_id, reinforcer_id, chosen_by, tokens) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [childId, at.toISOString(), c.source, c.sourceId, c.reinforcerId, c.chosenBy, c.tokens ?? null],
  );
}

/**
 * История выборов подкрепителя, свежие в конце: по порядку записи (seq), а не по часам — время на устройстве может уйти назад (аудит раунда 3, В-5). Входит
 * любой выбор, в том числе взрослого. Читать в той же транзакции, где считаются варианты.
 */
export async function reinforcerHistoryOf(db: SqlDb, childId: string): Promise<string[]> {
  return (
    await db.all<{ reinforcer_id: string }>(
      'SELECT reinforcer_id FROM aba_reinforcer_choices WHERE child_id = ? ORDER BY seq',
      [childId],
    )
  ).map((r) => r.reinforcer_id);
}

/**
 * Был ли после `sinceMs` обмен рутины — реальный выбор подкрепителя после прогона
 * (`source = 'routine'`), а не предложение: жетоны уходят вместе с выбором. По времени выбора
 * (`chosen_at`), поэтому сессия, возобновлённая между прогоном и выбором, обмена не пропустит.
 */
export async function routineExchangedSince(db: SqlDb, childId: string, sinceMs: number): Promise<boolean> {
  const rows = await db.all<{ n: number }>(
    "SELECT 1 AS n FROM aba_reinforcer_choices WHERE child_id = ? AND source = 'routine' AND chosen_at > ? LIMIT 1",
    [childId, new Date(sinceMs).toISOString()],
  );
  return rows.length > 0;
}

/**
 * Открытое предложение обмена после рутины (`openRoutineOffer`): последний прогон с
 * `exchangeOffer`, по нему нет выбора, доска всё ещё полна, локальный день прежний. `today` —
 * локальная дата `YYYY-MM-DD`, её считает вызывающий код.
 */
export async function openRoutineOfferOf(db: SqlDb, childId: string, today: string): Promise<RoutineOffer | null> {
  const [row] = await db.all<{ body: string }>(
    "SELECT body FROM aba_routine_runs WHERE child_id = ? AND json_extract(body, '$.exchangeOffer') IS NOT NULL ORDER BY seq DESC LIMIT 1",
    [childId],
  );
  const run = row ? (JSON.parse(row.body) as AbaRoutineRun) : null;
  const chosen = await db.all<{ source_id: string }>(
    "SELECT source_id FROM aba_reinforcer_choices WHERE child_id = ? AND source = 'routine'",
    [childId],
  );
  const board = (await loadChildState(db, childId, 'abaBoard')) ?? { earned: 0, nonContingent: 0 };
  return openRoutineOffer({
    lastOffer: run?.exchangeOffer ? { runId: run.id, day: run.day, ...run.exchangeOffer } : null,
    chosenRunIds: chosen.map((r) => r.source_id),
    board,
    today,
  });
}

/**
 * «Действующие пробы»: исходная проба, которую заменило исправление отметки (`aba_trial_corrections`),
 * не читается. Все читатели проб идут через это условие (таблица `t`); сырое чтение — только
 * `purge.ts` (срок хранения, удаление, выгрузки «сырое + исправления»).
 */
export const EFFECTIVE =
  'AND NOT EXISTS (SELECT 1 FROM aba_trial_corrections c WHERE c.child_id = t.child_id AND c.trial_id = t.id)';

const parse = <T>(rows: { body: string }[]): T[] => rows.map((r) => JSON.parse(r.body) as T);

/** Пробы цели ребёнка в порядке записи. */
export async function trialsOfTarget(db: SqlDb, childId: string, targetId: string): Promise<AbaTrial[]> {
  return parse(
    await db.all<{ body: string }>(
      `SELECT t.body FROM aba_trials t WHERE t.child_id = ? AND t.target_id = ? ${EFFECTIVE} ORDER BY t.seq`,
      [childId, targetId],
    ),
  );
}

export async function trialsOfSession(db: SqlDb, childId: string, sessionId: string): Promise<AbaTrial[]> {
  return parse(
    await db.all<{ body: string }>(
      `SELECT t.body FROM aba_trials t WHERE t.child_id = ? AND t.session_id = ? ${EFFECTIVE} ORDER BY t.seq`,
      [childId, sessionId],
    ),
  );
}

export async function sessionsOf(db: SqlDb, childId: string): Promise<AbaSession[]> {
  return parse(
    await db.all<{ body: string }>('SELECT body FROM aba_sessions WHERE child_id = ? ORDER BY session_index', [childId]),
  );
}

/**
 * Прошлые сессии цели для проверки зависимости от подсказки (`isPromptDependent`),
 * свежие в конце: номер сессии и пробы этой цели в ней. Сессии без проб цели не
 * попадают.
 */
export async function pastSessionsOfTarget(
  db: SqlDb,
  childId: string,
  targetId: string,
  limit = 10,
): Promise<SessionTrials[]> {
  const rows = await db.all<{ session_index: number; body: string }>(
    `SELECT s.session_index, t.body
       FROM aba_trials t JOIN aba_sessions s ON s.id = t.session_id AND s.child_id = t.child_id
      WHERE t.child_id = ? AND t.target_id = ? ${EFFECTIVE}
      ORDER BY s.session_index, t.seq`,
    [childId, targetId],
  );
  const bySession = new Map<number, AbaTrial[]>();
  for (const r of rows) {
    const trial = JSON.parse(r.body) as AbaTrial;
    // как `own` в `finishAbaSession`: оценка, не идущая в освоение, и в зависимость не идёт
    if (COUNTS_TOWARD_MASTERY[trial.scoredBy]) bySession.set(r.session_index, [...(bySession.get(r.session_index) ?? []), trial]);
  }
  return [...bySession.entries()].map(([index, trials]) => ({ index, trials })).slice(-limit);
}

/** Запись IOA — отдельный журнал (вносится после сессии). Кирпич для `commit.ts`. */
export async function appendIoa(db: SqlDb, childId: string, record: AbaIoaRecord, recordedAt: string): Promise<void> {
  assertNoTimeInIds('IOA', record.id, record.sessionId);
  await db.run('INSERT INTO aba_ioa (child_id, id, session_id, body, recorded_at) VALUES (?, ?, ?, ?, ?)', [
    childId,
    record.id,
    record.sessionId,
    JSON.stringify(record),
    recordedAtIso(recordedAt),
  ]);
}

/** Записи IOA сессии ребёнка. */
export async function ioaOfSession(db: SqlDb, childId: string, sessionId: string): Promise<AbaIoaRecord[]> {
  return parse(
    await db.all<{ body: string }>('SELECT body FROM aba_ioa WHERE child_id = ? AND session_id = ? ORDER BY seq', [
      childId,
      sessionId,
    ]),
  );
}

/**
 * Прошлые прогоны обучения рутины для детектора зависимости от подсказки (`finishRoutineRun`),
 * свежие в конце. `index` — сквозной номер прогона из его записи (`runNo`), а не позиция в
 * журнале: срок хранения удаляет старые прогоны, позиции сдвигаются, и флаг (он хранит `runNo`)
 * отсекал бы новые прогоны. Номер следующего прогона — `routineRunSeq` в состоянии цели. Прогон
 * без `runNo` (записан до счётчика) получает позицию. Входят только **записанные** прогоны обучения
 * (пробы свёрнутого, ещё не записанного прогона сюда не попадают), не отменённые извне (состояние
 * откатывается), не оборванные срывом и не кончившиеся отказом (не промах навыка); `exclude` — прогон,
 * который пересчитывается (Т2: он уже записан Т1);
 * пробы — только идущие в освоение (как `own` в `finishRoutineRun`); прогон без таких проб не входит.
 */
export async function routineHistoryOf(
  db: SqlDb,
  childId: string,
  targetId: string,
  limit = 10,
  exclude?: string,
): Promise<RoutineHistory> {
  const runs = await db.all<{ id: string; body: string }>(
    'SELECT id, body FROM aba_routine_runs WHERE child_id = ? AND target_id = ? ORDER BY seq',
    [childId, targetId],
  );
  const rows = await db.all<{ session_id: string; body: string }>(
    `SELECT t.session_id, t.body FROM aba_trials t WHERE t.child_id = ? AND t.target_id = ? ${EFFECTIVE} ORDER BY t.seq`,
    [childId, targetId],
  );
  const byRun = new Map<string, AbaTrial[]>();
  for (const r of rows) {
    const trial = JSON.parse(r.body) as AbaTrial;
    if (COUNTS_TOWARD_MASTERY[trial.scoredBy]) byRun.set(r.session_id, [...(byRun.get(r.session_id) ?? []), trial]);
  }
  const past = runs
    .map((r, i) => {
      const run = JSON.parse(r.body) as AbaRoutineRun;
      return { index: run.runNo ?? i + 1, run, trials: byRun.get(r.id) ?? [] };
    })
    .filter((x) => x.run.kind === 'teaching' && x.run.interrupted === null && x.trials.length > 0)
    .filter((x) => x.run.id !== exclude)
    .map(({ index, trials }) => ({ index, trials }))
    .slice(-limit);
  return { runs: past };
}

/** Прогоны рутины ребёнка в порядке записи — с поправками места и фазы (`withAmendments`). */
export async function routineRunsOf(db: SqlDb, childId: string, targetId?: string): Promise<AbaRoutineRun[]> {
  const runs = parse<AbaRoutineRun>(
    targetId
      ? await db.all<{ body: string }>('SELECT body FROM aba_routine_runs WHERE child_id = ? AND target_id = ? ORDER BY seq', [childId, targetId])
      : await db.all<{ body: string }>('SELECT body FROM aba_routine_runs WHERE child_id = ? ORDER BY seq', [childId]),
  );
  return withAmendments(runs, await amendmentsOf(db, childId));
}
