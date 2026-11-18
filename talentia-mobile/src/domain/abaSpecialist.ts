/**
 * Раздел «Для специалиста» (методист 2026-11-18): что специалист задаёт и какие действия у него есть — чистыми
 * функциями; запись — `commit.ts` (одна транзакция: изменение и событие журнала `aba_specialist_events`).
 *
 * Задаёт: параметры сессии (`AbaSessionParams`), «Награду от взрослого», «обучен» у наблюдателей. Не меняет: критерий,
 * размер блока, потолок задержки, эскалации, правила жетонов. Действия: «Просмотрено: отказы ребёнка»
 * (`assent_concern`), «Подтвердить знакомство с жетонами», «Назначить проверку вперемешку», «Просмотрено» для
 * `token_training_stalled`, `pairing_keeps_breaking`, `ioa_low` (флаг снимается и может вернуться).
 *
 * Событие журнала — без имён и uuid взрослых: роль `specialist` **заявленная** (телефон семьи, PIN родителя — кто держит
 * телефон, приложение не проверяет), поле, было, стало, цели и роль наблюдателя — если есть, момент `at`. Момент с
 * временем хранится только на устройстве (`aba_specialist_events`); в выгрузку специалисту уходит лишь день
 * (`exportForSpecialist`), и по дню отчёт (`specialistReportHtml.ts`) рисует таблицу «Изменения условий» и линию
 * смены условий на графиках целей — перед первым занятием этого дня или позже.
 *
 * Те же условия меняются и вне раздела (финальная рецензия методиста 2026-11-18) — тем же событием с ролью `parent`,
 * тоже заявленной: «обучен» через «Кто ведёт», «Награда от взрослого» в профиле, «Сопряжение подтверждено» в карточке
 * ABA, смена полосы профиля (`band`, с параметрами, которые при новой полосе сняты).
 */
import type { AbaFormat, AbaObserver, AbaTarget, AbaTargetState } from '../types/aba';
import type { AgeBand } from '../types/task';
import type { AbaSessionParams } from './abaSessionParams';
import { mixGroups } from './abaMixedBlock';
import type { TokenTrainingFlag, TokenTrainingState } from './abaTokenTraining';

type Value = string | number | boolean | null;

/** Что изменено. `responseWindowMs.<формат>` — окно одного формата; `flag.<флаг>` — снятый флаг. */
export type SpecialistField =
  | 'band'
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

/** Кто изменил: раздел «Для специалиста» — `specialist`; профиль, «Кто ведёт», карточка ABA — `parent`. Обе заявленные. */
export type SpecialistRole = 'specialist' | 'parent';

export type SpecialistEvent = {
  /** Роль заявленная, не проверенная: `claimed: true` всегда. */
  role: SpecialistRole;
  claimed: true;
  field: SpecialistField;
  from: Value;
  to: Value;
  at: string;
  /** Цели, которых касается изменение (флаги целей, группа смешанного блока). */
  targetIds?: string[];
  /** Роль наблюдателя для `observerTrained` — без uuid. */
  observerRole?: AbaObserver['role'];
  /** `band`: параметры специалиста, снятые при новой полосе (`pruneSessionParams`), — имена полей, как в `field`. */
  removed?: SpecialistField[];
  /** Флаг шага «коснись картинки» (`flag.assent_concern` у шага, а не у цели). */
  step?: 'sample_touch';
};

type Extra = Pick<SpecialistEvent, 'targetIds' | 'observerRole' | 'removed' | 'step'> & { role?: SpecialistRole };

const event = (field: SpecialistField, from: Value, to: Value, at: string, { role = 'specialist', ...extra }: Extra = {}): SpecialistEvent => ({
  role,
  claimed: true,
  field,
  from,
  to,
  at,
  ...extra,
});

/** События смены параметров: по одному на изменённое поле; ничего не изменилось — пусто. `null` — «по умолчанию полосы». */
export function paramsChanges(before: AbaSessionParams | undefined, after: AbaSessionParams, at: string, role: SpecialistRole = 'specialist'): SpecialistEvent[] {
  const b = before ?? {};
  const out: SpecialistEvent[] = [];
  for (const field of ['paramsBand', 'timeLimitMs', 'maxTeachingTargets'] as const) {
    const from = b[field] ?? null;
    const to = after[field] ?? null;
    if (from !== to) out.push(event(field, from, to, at, { role }));
  }
  const formats = new Set([...Object.keys(b.responseWindowMs ?? {}), ...Object.keys(after.responseWindowMs ?? {})]) as Set<AbaFormat>;
  for (const f of [...formats].sort()) {
    const from = b.responseWindowMs?.[f] ?? null;
    const to = after.responseWindowMs?.[f] ?? null;
    if (from !== to) out.push(event(`responseWindowMs.${f}`, from, to, at, { role }));
  }
  return out;
}

export const adultRewardChange = (from: boolean, to: boolean, at: string, role: SpecialistRole = 'specialist'): SpecialistEvent[] =>
  from === to ? [] : [event('adultReward', from, to, at, { role })];

/**
 * «Обучен» вне раздела — «Кто ведёт» перед занятием (`parent`): по событию на наблюдателя, у которого отметка сменилась;
 * новый наблюдатель — как был «не обучен». Без uuid — только роль наблюдателя.
 */
export function observerTrainedChanges(before: readonly AbaObserver[], after: readonly AbaObserver[], at: string, role: SpecialistRole): SpecialistEvent[] {
  return after.flatMap((o) => {
    const from = before.find((x) => x.id === o.id)?.trained ?? false;
    return from === o.trained ? [] : [event('observerTrained', from, o.trained, at, { role, observerRole: o.role })];
  });
}

/**
 * Смена полосы профиля (`parent`): событие `band` со снятыми полями и по событию на каждое снятое поле
 * (`paramsChanges`), чтобы линия смены условий у параметра была и здесь. Полоса та же — пусто.
 */
export function bandChange(from: AgeBand, to: AgeBand, before: AbaSessionParams, after: AbaSessionParams, at: string): SpecialistEvent[] {
  if (from === to) return [];
  const removed = paramsChanges(before, after, at, 'parent');
  return [event('band', from, to, at, { role: 'parent', ...(removed.length ? { removed: removed.map((e) => e.field) } : {}) }), ...removed];
}

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

export const flagReviewed = (
  flag: 'assent_concern' | 'mixed_not_established' | 'token_training_stalled' | 'pairing_keeps_breaking' | 'ioa_low',
  at: string,
  targetIds?: string[],
  step?: 'sample_touch',
): SpecialistEvent => event(`flag.${flag}`, true, false, at, { ...(targetIds ? { targetIds } : {}), ...(step ? { step } : {}) });

export const pairingConfirmedEvent = (at: string, role: SpecialistRole = 'specialist'): SpecialistEvent => event('pairingDone', false, true, at, { role });
