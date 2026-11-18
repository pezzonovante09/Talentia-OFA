/**
 * «Где мы сейчас» для взрослого (решение владельца №202, вопрос 116): что будет на следующем занятии — простыми
 * словами, без изменения процедуры. Только описатель: план следующего занятия строит тот же `startAbaSession`, что и
 * экран занятия (превью «вхолостую» — `previewParentStage` в `services/local/abaStart.ts`); здесь он лишь переводится
 * в этап, понятный взрослому.
 *
 * Порядок выбора этапа повторяет то, что ребёнок встретит первым и что взрослому важнее понять: проверка «что уже
 * умеет» → первые пробы без жетонов → обучение с жетонами → повторение освоенного.
 */
import type { AbaTargetState } from '../types/aba';
import { MASTERED_PHASES, type AbaSessionState } from './abaSession';
import { PAIRING } from './abaTokenTraining';

export type ParentStage =
  /** Знакомство с жетонами: `n` — какое по счёту удачное подряд будет следующим; `reset` — серия уже сбрасывалась. */
  | { kind: 'pairing'; n: number; of: number; reset: boolean }
  /** Проверка «что ребёнок уже умеет»: без подсказок и жетонов, первая ошибка заканчивает проверку. */
  | { kind: 'placement'; targetId: string }
  /** Первые пробы цели без помощи и без жетонов — чтобы знать, с чего начать учить. */
  | { kind: 'baseline'; targetId: string }
  /** Обучение цели: подсказки и жетоны; `plannedBreak` — в занятии будет плановый перерыв. */
  | { kind: 'teaching'; targetId: string; plannedBreak: boolean }
  /** Только повторение освоенного. */
  | { kind: 'maintenance'; targetIds: string[] }
  /** Все цели программы освоены. */
  | { kind: 'all_mastered' }
  /** План не построился (нет целей, ошибка входа): взрослому — общий статус карточки «Занятие». */
  | { kind: 'unknown' };

export type ParentStageView = {
  stage: ParentStage;
  /**
   * Обучение в том же занятии, когда главный этап — проверка или первые пробы (смешанное занятие: сначала блоки
   * измерения, потом обучение, `buildPlan`). Иначе взрослый прочёл бы «без жетонов» и не ждал бы ни жетонов, ни перерыва.
   */
  alsoTeaching: { targetId: string; plannedBreak: boolean } | null;
  /** Перед заданиями ребёнка учат просить перерыв карточкой. */
  breakCardTraining: boolean;
  /** Будут ли жетоны: `false` — занятие-проверка без жетонов; `null` — не говорим (повторение, неизвестно). */
  tokens: boolean | null;
};

export type PairingProgress = { pairingDone: boolean; pairingStreak: number; pairingSessions: number };

/** Знакомство: какое по счёту удачное подряд будет следующим (1 из 2, 2 из 2) и сбрасывалась ли серия. */
export function pairingStage(p: PairingProgress): Extract<ParentStage, { kind: 'pairing' }> {
  const of = PAIRING.sessionsToPass;
  return { kind: 'pairing', n: Math.min(p.pairingStreak + 1, of), of, reset: p.pairingSessions > p.pairingStreak };
}

/** Плановый перерыв — перерыв в очереди без инициатора (по детской карточке, отказу или предложению — не в счёт). */
export function hasPlannedBreak(plan: Pick<AbaSessionState, 'queue'>): boolean {
  return plan.queue.some((q) => q.kind === 'break' && q.initiatedBy === undefined);
}

/** Этап по плану следующего занятия; `states` — состояния целей ребёнка до занятия (для «всё освоено»). */
export function stageOfPlan(
  plan: Pick<AbaSessionState, 'placementTargetIds' | 'baselineTargetIds' | 'teachingTargetIds' | 'maintenanceTargetIds' | 'queue' | 'mixedTargetIds'>,
  states: Readonly<Record<string, AbaTargetState>>,
  targetIds: readonly string[],
): ParentStage {
  const [placement] = plan.placementTargetIds;
  if (placement) return { kind: 'placement', targetId: placement };
  const baseline = plan.baselineTargetIds.find((id) => !plan.placementTargetIds.includes(id));
  if (baseline) return { kind: 'baseline', targetId: baseline };
  const [teaching] = plan.teachingTargetIds;
  if (teaching) return { kind: 'teaching', targetId: teaching, plannedBreak: hasPlannedBreak(plan) };
  // смешанный блок впереди или не пройден (решение методиста 43) — освоено по отдельности, ещё не «всё освоено»
  const mixedPending = (plan.mixedTargetIds?.length ?? 0) > 0 || targetIds.some((id) => states[id]?.mixedCheck && !states[id].mixedCheck?.done);
  if (!mixedPending && targetIds.length > 0 && targetIds.every((id) => states[id] !== undefined && MASTERED_PHASES.has(states[id].phase))) {
    return { kind: 'all_mastered' };
  }
  if (plan.maintenanceTargetIds.length) return { kind: 'maintenance', targetIds: [...plan.maintenanceTargetIds] };
  return { kind: 'unknown' };
}

/** Обучение рядом с проверкой или первыми пробами в одном занятии; `null` — его нет или оно и есть главный этап. */
export function alsoTeachingOf(plan: Pick<AbaSessionState, 'teachingTargetIds' | 'queue'>, stage: ParentStage): ParentStageView['alsoTeaching'] {
  if (stage.kind !== 'placement' && stage.kind !== 'baseline') return null;
  const [teaching] = plan.teachingTargetIds;
  return teaching ? { targetId: teaching, plannedBreak: hasPlannedBreak(plan) } : null;
}

/**
 * Строка о жетонах: есть обучение — будут; только проверка или первые пробы — «за задания проверки жетонов нет» (за
 * лёгкие задания на освоенное жетон бывает, поэтому строка — про задания проверки, а не про всё занятие); прочее — молчим.
 */
export function tokensOf(stage: ParentStage, alsoTeaching: ParentStageView['alsoTeaching'] = null): boolean | null {
  if (stage.kind === 'teaching' || alsoTeaching) return true;
  if (stage.kind === 'placement' || stage.kind === 'baseline') return false;
  return null;
}
