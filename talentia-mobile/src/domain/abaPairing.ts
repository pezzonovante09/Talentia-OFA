/**
 * Сессия сопряжения — оркестратор (этап 11, блокер Д1 `docs/design/aba-screens-spec-2026-10-25.md`).
 * Правила — `ABA.md`, «Сопряжение и обучение доске»; числа — `PAIRING` (`abaTokenTraining.ts`).
 *
 * Без проб и без требований: выбор подкрепителя из трёх (через 30 с выбирает взрослый) → Tali
 * кладёт жетон на доску из одной ячейки **по таймеру**, через 10 с после выбора или прошлого доступа,
 * а не после действия ребёнка → сразу обмен → доступ 20 с → снова выбор из тех же трёх. Четыре
 * цикла; конец — сразу после четвёртого доступа. Таймеры ведёт экран, домен проверяет, что событие
 * пришло не раньше срока.
 *
 * Итог (`pairingResultOf`) идёт в `commitPairingSession`: `applyPairingSession` по ребёнку и
 * выборы — в историю подкрепителей (насыщение считается по любому выбору, методист 2026-10-12).
 * Жетоны сопряжения в рабочую доску не идут. Запись о самой сессии (конфигурация, исход, циклы) —
 * журнал `aba_pairing_sessions` (№164).
 */
import type { AbaConfig, AbaPairingEndReason } from '../types/aba';
import { PAIRING } from './abaTokenTraining';
import { reinforcerChoices, type Rng } from './abaTokens';

export type PairingPhase = 'choose' | 'wait_token' | 'access' | 'done';

/**
 * Исход сопряжения — закрытый словарь (№164): `completed`, `adult_stopped`, `abandoned` (ребёнок удержал выход),
 * `no_choice` («Сам», 60 с без выбора, №165) и `app_backgrounded` — приложение свернули или погас экран посреди
 * сопряжения. Свёрнутое, как остановка взрослым, не засчитывается и серию не рвёт, но в данных различимо.
 */
export type PairingEndReason = AbaPairingEndReason;

/**
 * `latencyMs` (№165) — от начала фазы выбора до первого касания карточки (у взрослого — полосы). `firstTappedId`
 * (№166) — только если первым коснулись другой карточки: латентность тогда относится к ней.
 */
export type PairingChoice = { reinforcerId: string; by: 'child' | 'adult'; at: number; latencyMs: number; firstTappedId?: string };

export type PairingState = {
  v: 1;
  /** Случайный UUIDv4 — `source_id` выборов в истории. */
  sessionId: string;
  startedAt: number;
  /** С кем шло сопряжение — в записи сессии (№164): «Сам» и «Со взрослым» специалист различает. */
  config: AbaConfig;
  phase: PairingPhase;
  /** Три варианта на всю сессию: «можно выбрать заново из тех же трёх». */
  options: string[];
  /** Законченных циклов «жетон → обмен → доступ». */
  cycles: number;
  /** С какого момента идёт текущая фаза: от него считаются 30 с выбора, 10 с до жетона, 20 с доступа. */
  phaseSince: number;
  reinforcerId: string | null;
  choices: PairingChoice[];
  endReason: PairingEndReason | null;
};

export class PairingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PairingError';
  }
}

function assert(ok: boolean, what: string): void {
  if (!ok) throw new PairingError(what);
}

export function startPairing(input: {
  sessionId: string;
  config: AbaConfig;
  pool: string[];
  history: string[];
  /** Пары каталога, которые не ставятся в одну тройку (`apartPairs`, №164). */
  apart: readonly [string, string][];
  rng: Rng;
  now: number;
}): PairingState {
  return {
    v: 1,
    sessionId: input.sessionId,
    startedAt: input.now,
    config: input.config,
    phase: 'choose',
    options: reinforcerChoices(input.pool, input.history, input.rng, input.apart),
    cycles: 0,
    phaseSince: input.now,
    reinforcerId: null,
    choices: [],
    endReason: null,
  };
}

export type PairingEvent =
  /**
   * Ребёнок выбрал; `adult` — только после `PAIRING.choiceTimeoutMs` без выбора. `now` — выбор засчитан (конец
   * удержания), `tappedAt` — первое касание; нет — латентность до `now`.
   */
  | { type: 'choose'; reinforcerId: string; by: 'child' | 'adult'; now: number; tappedAt?: number; firstTappedId?: string }
  /** Таймер жетона истёк: жетон на доску и сразу обмен — начинается доступ. */
  | { type: 'token'; now: number }
  /** Доступ кончился (приложение по таймеру). */
  | { type: 'access_done'; now: number }
  /** Взрослый остановил, ребёнок ушёл, в «Сам» не выбрал или приложение свернули. */
  | { type: 'stop'; reason: 'adult_stopped' | 'abandoned' | 'no_choice' | 'app_backgrounded'; now: number };

/** Шаг по событию. Событие не по фазе или раньше срока — ошибка программы экрана. */
export function applyPairingEvent(s: PairingState, e: PairingEvent): PairingState {
  if (e.type === 'stop') {
    assert(s.phase !== 'done', 'stop после конца');
    assert(e.reason !== 'no_choice' || (s.phase === 'choose' && s.config === 'alone'), 'без выбора кончается только выбор в «Сам»');
    return { ...s, phase: 'done', endReason: e.reason, phaseSince: e.now };
  }
  switch (e.type) {
    case 'choose':
      assert(s.phase === 'choose', `choose в фазе ${s.phase}`);
      assert(s.options.includes(e.reinforcerId), `Подкрепитель ${e.reinforcerId} не предлагался`);
      assert(e.by === 'child' || e.now - s.phaseSince >= PAIRING.choiceTimeoutMs, 'взрослый выбирает только после таймаута');
      const tappedAt = e.tappedAt ?? e.now;
      assert(tappedAt >= s.phaseSince && tappedAt <= e.now, 'касание вне фазы выбора');
      assert(e.firstTappedId === undefined || s.options.includes(e.firstTappedId), `Подкрепитель ${e.firstTappedId} не предлагался`);
      const switched = e.firstTappedId !== undefined && e.firstTappedId !== e.reinforcerId;
      return {
        ...s,
        phase: 'wait_token',
        phaseSince: e.now,
        reinforcerId: e.reinforcerId,
        choices: [...s.choices, { reinforcerId: e.reinforcerId, by: e.by, at: e.now, latencyMs: tappedAt - s.phaseSince, ...(switched ? { firstTappedId: e.firstTappedId } : {}) }],
      };
    case 'token':
      assert(s.phase === 'wait_token', `token в фазе ${s.phase}`);
      assert(e.now - s.phaseSince >= PAIRING.tokenAfterMs, 'жетон раньше таймера');
      return { ...s, phase: 'access', phaseSince: e.now };
    case 'access_done': {
      assert(s.phase === 'access', `access_done в фазе ${s.phase}`);
      assert(e.now - s.phaseSince >= PAIRING.accessMs, 'доступ короче срока');
      const cycles = s.cycles + 1;
      if (cycles >= PAIRING.cycles) return { ...s, cycles, phase: 'done', endReason: 'completed', phaseSince: e.now };
      return { ...s, cycles, phase: 'choose', phaseSince: e.now, reinforcerId: null };
    }
  }
}

/** Когда экрану послать следующее событие по таймеру; `null` — ждём ребёнка или конец. */
export function pairingDueAt(s: PairingState): { event: 'adult_may_choose' | 'token' | 'access_done'; at: number } | null {
  switch (s.phase) {
    case 'choose':
      return { event: 'adult_may_choose', at: s.phaseSince + PAIRING.choiceTimeoutMs };
    case 'wait_token':
      return { event: 'token', at: s.phaseSince + PAIRING.tokenAfterMs };
    case 'access':
      return { event: 'access_done', at: s.phaseSince + PAIRING.accessMs };
    case 'done':
      return null;
  }
}

export type PairingResult = {
  sessionId: string;
  config: AbaConfig;
  /** Предложенная тройка (№165). */
  options: string[];
  endReason: PairingEndReason;
  /** Законченных циклов «жетон → обмен → доступ»: «ушёл после трёх» и «не выбрал ни разу» различимы. */
  cycles: number;
  startedAt: number;
  endedAt: number;
  /**
   * Критерий сопряжения: выбор сделал ребёнок — каждый выбор сессии; хотя бы один выбор взрослого
   * по таймауту — `adult`. Без выборов (остановили до первого) — `adult`: предпочтение не показано.
   */
  chosenBy: 'child' | 'adult';
  choices: PairingChoice[];
};

export function pairingResultOf(s: PairingState): PairingResult {
  assert(s.phase === 'done' && s.endReason !== null, 'итог незавершённого сопряжения');
  const chosenBy = s.choices.length > 0 && s.choices.every((c) => c.by === 'child') ? 'child' : 'adult';
  return {
    sessionId: s.sessionId,
    config: s.config,
    options: s.options,
    endReason: s.endReason!,
    cycles: s.cycles,
    startedAt: s.startedAt,
    endedAt: s.phaseSince,
    chosenBy,
    choices: s.choices,
  };
}
