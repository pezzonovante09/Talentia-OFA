/**
 * Раздел «Для специалиста» (методист 2026-11-18): что специалист задаёт и какие действия у него есть — чистыми
 * функциями; запись — `commit.ts` (одна транзакция: изменение и событие журнала `aba_specialist_events`).
 *
 * Задаёт: параметры сессии (`AbaSessionParams`), «Награду от взрослого», «обучен» у наблюдателей. Не меняет: критерий,
 * размер блока, потолок задержки, эскалации, правила жетонов. Действия: «Беспокойство по согласию просмотрено»,
 * «Подтвердить сопряжение», «Назначить проверку вперемешку», «Просмотрено» для `token_training_stalled`,
 * `pairing_keeps_breaking`, `ioa_low` (флаг снимается и может вернуться).
 *
 * Событие журнала — без имён и uuid взрослых: роль `specialist` **заявленная** (телефон семьи, PIN родителя — кто держит
 * телефон, приложение не проверяет), поле, было, стало, момент. По ним отчёт рисует линию смены условий.
 */
import type { AbaFormat, AbaObserver, AbaTarget, AbaTargetState } from '../types/aba';
import type { AbaSessionParams } from './abaSessionParams';
import { mixGroups } from './abaMixedBlock';
import type { TokenTrainingFlag, TokenTrainingState } from './abaTokenTraining';

type Value = string | number | boolean | null;

/** Что изменено. `responseWindowMs.<формат>` — окно одного формата; `flag.<флаг>` — снятый флаг. */
export type SpecialistField =
  | 'paramsBand'
  | 'timeLimitMs'
  | `responseWindowMs.${AbaFormat}`
  | 'maxTeachingTargets'
  | 'adultReward'
  | 'observerTrained'
  | 'pairingDone'
  | 'flag.assent_concern'
  | 'flag.mixed_not_established'
  | 'flag.token_training_stalled'
  | 'flag.pairing_keeps_breaking'
  | 'flag.ioa_low';

export type SpecialistEvent = {
  /** Роль заявленная, не проверенная: `claimed: true` всегда. */
  role: 'specialist';
  claimed: true;
  field: SpecialistField;
  from: Value;
  to: Value;
  at: string;
  /** Цели, которых касается изменение (флаги целей, группа смешанного блока). */
  targetIds?: string[];
  /** Роль наблюдателя для `observerTrained` — без uuid. */
  observerRole?: AbaObserver['role'];
};

const event = (field: SpecialistField, from: Value, to: Value, at: string, extra: Pick<SpecialistEvent, 'targetIds' | 'observerRole'> = {}): SpecialistEvent => ({
  role: 'specialist',
  claimed: true,
  field,
  from,
  to,
  at,
  ...extra,
});

/** События смены параметров: по одному на изменённое поле; ничего не изменилось — пусто. `null` — «по умолчанию полосы». */
export function paramsChanges(before: AbaSessionParams | undefined, after: AbaSessionParams, at: string): SpecialistEvent[] {
  const b = before ?? {};
  const out: SpecialistEvent[] = [];
  for (const field of ['paramsBand', 'timeLimitMs', 'maxTeachingTargets'] as const) {
    const from = b[field] ?? null;
    const to = after[field] ?? null;
    if (from !== to) out.push(event(field, from, to, at));
  }
  const formats = new Set([...Object.keys(b.responseWindowMs ?? {}), ...Object.keys(after.responseWindowMs ?? {})]) as Set<AbaFormat>;
  for (const f of [...formats].sort()) {
    const from = b.responseWindowMs?.[f] ?? null;
    const to = after.responseWindowMs?.[f] ?? null;
    if (from !== to) out.push(event(`responseWindowMs.${f}`, from, to, at));
  }
  return out;
}

export const adultRewardChange = (from: boolean, to: boolean, at: string): SpecialistEvent[] => (from === to ? [] : [event('adultReward', from, to, at)]);

/** «Обучен» у наблюдателя: новый список и событие без uuid; наблюдателя нет или значение то же — `null`. */
export function setObserverTrained(
  observers: readonly AbaObserver[],
  observerId: string,
  trained: boolean,
  at: string,
): { observers: AbaObserver[]; event: SpecialistEvent } | null {
  const o = observers.find((x) => x.id === observerId);
  if (!o || o.trained === trained) return null;
  return {
    observers: observers.map((x) => (x.id === observerId ? { ...x, trained } : x)),
    event: event('observerTrained', o.trained, trained, at, { observerRole: o.role }),
  };
}

/**
 * «Назначить проверку вперемешку»: группа цели (`mixGroups`) снова идёт в план — флаг `mixed_not_established` снят у
 * всех участников (план требует всех без флага), счётчики «без итога» и пропуск сняты. Флага ни у кого нет — `null`.
 */
export function assignMixedCheck(
  targets: readonly AbaTarget[],
  states: Readonly<Record<string, AbaTargetState>>,
  targetId: string,
): Record<string, AbaTargetState> | null {
  const group = mixGroups(targets).find((g) => g.some((t) => t.id === targetId));
  if (!group) return null;
  const members = group.filter((t) => states[t.id]);
  if (!members.some((t) => states[t.id].flags.includes('mixed_not_established'))) return null;
  return Object.fromEntries(
    members.map((t) => {
      const s = states[t.id];
      const { noVerdict: _n, neutralNoVerdict: _nn, yieldAt: _y, ...check } = s.mixedCheck ?? { days: [] };
      return [t.id, { ...s, flags: s.flags.filter((f) => f !== 'mixed_not_established'), ...(s.mixedCheck ? { mixedCheck: check } : {}) }];
    }),
  );
}

/** «Просмотрено» для флага цели (`ioa_low`): снимается, может вернуться. Флага нет — `null`. */
export function reviewTargetFlag(s: AbaTargetState, flag: 'ioa_low'): AbaTargetState | null {
  return s.flags.includes(flag) ? { ...s, flags: s.flags.filter((f) => f !== flag) } : null;
}

/** «Просмотрено» для флага доски (`token_training_stalled`, `pairing_keeps_breaking`): снимается, может вернуться. */
export function reviewTokenFlag(t: TokenTrainingState, flag: Exclude<TokenTrainingFlag, 'pairing_not_established'>): TokenTrainingState | null {
  return t.flags.includes(flag) ? { ...t, flags: t.flags.filter((f) => f !== flag) } : null;
}

export const flagReviewed = (flag: 'assent_concern' | 'mixed_not_established' | 'token_training_stalled' | 'pairing_keeps_breaking' | 'ioa_low', at: string, targetIds?: string[]): SpecialistEvent =>
  event(`flag.${flag}`, true, false, at, targetIds ? { targetIds } : {});

export const pairingConfirmedEvent = (at: string): SpecialistEvent => event('pairingDone', false, true, at);
