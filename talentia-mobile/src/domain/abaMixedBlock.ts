/**
 * Смешанный блок (решение методиста 43, 2026-11-18): цели, освоенные по отдельности и связанные `mixWith` (форма ↔
 * цвет), проверяются вперемешку — по 5 проб на цель, одна цель не больше двух раз подряд, со старта L0 без подсказок
 * (проба `verification`). «Освоено» окончательно — ≥ 80 % самостоятельных по цели в двух сессиях в разные дни; меньше
 * в двух блоках подряд — цель назад в обучение, партнёр остаётся освоенным и сохраняет свои дни. Цели — любые с
 * `mixWith`: код не знает конкретных id.
 *
 * Ревью методиста 2026-11-18: первый промах наблюдения цели в блоке заменяется пробой в конце блока
 * (`abaSession.ts`); две сессии подряд без итога блока — блок группы снимается с плана, флаг `mixed_not_established`
 * специалисту; повтор блока в день, уже засчитанный цели, её не судит.
 */
import { MAINTENANCE_GAP, MASTERY, MIXED_BLOCK, type AbaTarget, type AbaTargetState, type AbaTrial, type PromptLevel } from '../types/aba';
import { arrange, MAX_SAME_SD } from './abaIdentifySet';
import { answerLevel } from './abaPrompting';
import type { Rng } from './abaTokens';

const MASTERED = new Set(['mastered', 'maintenance']);

/**
 * Группы смешанного блока: связные компоненты по `mixWith` (связь симметрична), в порядке программы. Неизвестные id
 * пропускаются — их ловит `programErrors`.
 */
export function mixGroups(targets: readonly AbaTarget[]): AbaTarget[][] {
  const byId = new Map(targets.map((t) => [t.id, t]));
  const links = new Map<string, Set<string>>();
  const link = (a: string, b: string) => links.set(a, (links.get(a) ?? new Set()).add(b));
  for (const t of targets) {
    for (const id of t.mixWith ?? []) {
      if (!byId.has(id) || id === t.id) continue;
      link(t.id, id);
      link(id, t.id);
    }
  }
  const seen = new Set<string>();
  const groups: AbaTarget[][] = [];
  for (const t of targets) {
    if (seen.has(t.id) || !links.has(t.id)) continue;
    const ids = new Set<string>();
    const stack = [t.id];
    while (stack.length) {
      const id = stack.pop()!;
      if (ids.has(id)) continue;
      ids.add(id);
      stack.push(...(links.get(id) ?? []));
    }
    ids.forEach((id) => seen.add(id));
    groups.push(targets.filter((x) => ids.has(x.id)));
  }
  return groups;
}

/** Ошибки `mixWith`: связь только между целями одной области и формата, без цепочек и `identify`. */
export function mixErrors(targets: readonly AbaTarget[]): string[] {
  const byId = new Map(targets.map((t) => [t.id, t]));
  const errors: string[] = [];
  for (const t of targets) {
    for (const id of t.mixWith ?? []) {
      const other = byId.get(id);
      if (id === t.id) errors.push(`${t.id}: смешанный блок с самой собой`);
      else if (!other) errors.push(`${t.id}: смешанный блок с неизвестной целью ${id}`);
      else if (other.area !== t.area || other.format !== t.format || other.matchMode !== t.matchMode) {
        errors.push(`${t.id}: смешанный блок с ${id} — другая область, формат или вид сопоставления`);
      } else if (t.format === 'identify' || t.steps?.length || other.steps?.length) {
        errors.push(`${t.id}: смешанный блок — не для identify и цепочек`);
      }
    }
  }
  return errors;
}

/**
 * Освоена по отдельности так, что может идти в смешанный блок: фаза освоения, не «дома, без проверки» и не выведена
 * проверкой сверху вниз — у тех своё подтверждение первым.
 */
function readyForMix(s: AbaTargetState | undefined): boolean {
  return s !== undefined && MASTERED.has(s.phase) && s.masteredBy !== 'home_unverified' && s.masteredBy !== 'inferred';
}

/**
 * Группа на смешанный блок этой сессии: первая по программе, где все участники освоены по отдельности, а кто-то ещё
 * не прошёл блок и сегодня зачёта не имеет (дни должны быть разными). `allowed` — цель можно ставить в эту сессию.
 * Группа с флагом `mixed_not_established` не планируется: блок без итога решает специалист — флаг снимает только его
 * действие «Назначить проверку вперемешку» (`abaSpecialist.assignMixedCheck`), код здесь его не снимает. Пропуск по
 * потолку нейтральных (`mixedCheck.yieldAt`) решает старт сессии: он знает её номер. Группа, где участник сегодня уже провалил
 * блок (`mixedCheck.failedDay`), в этот день не планируется снова: провал за день — один (финальная рецензия).
 */
export function mixedGroupDue(
  groups: readonly AbaTarget[][],
  states: Readonly<Record<string, AbaTargetState>>,
  day: string,
  allowed: (t: AbaTarget) => boolean,
): AbaTarget[] | null {
  return (
    groups.find(
      (g) =>
        g.every(
          (t) =>
            allowed(t) &&
            readyForMix(states[t.id]) &&
            !states[t.id].flags.includes('mixed_not_established') &&
            states[t.id].mixedCheck?.failedDay !== day,
        ) &&
        g.some((t) => !states[t.id].mixedCheck?.done && !(states[t.id].mixedCheck?.days ?? []).includes(day)),
    ) ?? null
  );
}

/**
 * Пробы блока: по `MIXED_BLOCK.trialsPerTarget` на цель, экземпляры — `exemplarAt` цели по кругу; порядок — `arrange`
 * (не больше двух подряд одной цели).
 */
export function mixedBlockTrials(
  group: readonly AbaTarget[],
  exemplarAt: (t: AbaTarget) => (i: number) => string,
  rng: Rng,
): { kind: 'verification'; targetId: string; exemplarId: string }[] {
  const items = group.flatMap((t) => {
    const at = exemplarAt(t);
    return Array.from({ length: MIXED_BLOCK.trialsPerTarget }, (_, i) => ({ kind: 'verification' as const, targetId: t.id, exemplarId: at(i) }));
  });
  return arrange(items, rng);
}

/**
 * Место замены промаха наблюдения в смешанном блоке (финальная рецензия решения 43): самое позднее до конца блока,
 * где цель замены не идёт больше `MAX_SAME_SD` раз подряд. `shown` — цели проб, показанных с начала блока, по порядку
 * (промах — последней), `ahead` — цели проб, оставшихся до конца блока. Ответ — сколько из `ahead` идёт до замены;
 * `null` — места нет (например, промах — последняя проба и перед ним та же цель): замены нет, правило «не больше двух
 * подряд» сильнее, у цели меньше 5 проб — блок без итога по промаху наблюдения.
 */
export function replacementSlot(shown: readonly string[], ahead: readonly string[], id: string): number | null {
  const seq = [...shown, ...ahead];
  for (let p = ahead.length; p >= 0; p -= 1) {
    const at = shown.length + p;
    let run = 1;
    for (let i = at - 1; i >= 0 && seq[i] === id; i -= 1) run += 1;
    for (let i = at; i < seq.length && seq[i] === id; i += 1) run += 1;
    if (run <= MAX_SAME_SD) return p;
  }
  return null;
}

/** Id конца блока: у блока нет своей цели, участники — в `members`. */
export const mixedBlockId = (group: readonly Pick<AbaTarget, 'id'>[]): string => `mixed:${group.map((t) => t.id).join('+')}`;

/**
 * Итог смешанного блока по одной цели. `own` — засчитываемые пробы цели в сессии (без промахов наблюдения). День,
 * уже засчитанный цели или уже проваленный ею (`failedDay`), повтором блока не судится: пробы пишутся, итога нет. Меньше `trialsPerTarget` непрерванных
 * проб блока — не решает ничего. ≥ 80 % самостоятельных — день в зачёт, второй день — `done`; блок — ещё и пройденная
 * проба поддержания. Меньше — первый раз цель остаётся освоенной со своими днями; второй блок подряд — обучение:
 * при 0–2 из 5 со старта первого уровня, несущего ответ, иначе с последнего успешного, но не выше того (как проверка
 * `home_unverified`); серия критерия и доли — заново, как после распада на поддержании, пробы переноса остаются.
 */
export function mixedVerdict(
  s: AbaTargetState,
  target: AbaTarget,
  own: readonly AbaTrial[],
  idx: number,
  day: string,
): { state: AbaTargetState; reason: 'mixed_passed' | 'mixed_failed' | null } | null {
  const before = s.mixedCheck?.days ?? [];
  // провал за день — один (финальная рецензия): повтор блока в день провала цель не судит, как и в день зачёта
  if (before.includes(day) || s.mixedCheck?.failedDay === day) return null;
  const v = own.filter((t) => t.kind === 'verification' && t.response !== 'interrupted');
  if (v.length < MIXED_BLOCK.trialsPerTarget) return null;
  const independent = v.filter((t) => t.response === 'independent').length;
  if (independent / v.length >= MASTERY.minIndependentRate) {
    const days = [...before, day];
    const done = days.length >= MIXED_BLOCK.days;
    return {
      state: {
        ...s,
        mixedCheck: { days, ...(done ? { done: true as const } : {}) },
        lastMaintenanceSessionIndex: idx,
        maintenanceGapIndex: Math.min(s.maintenanceGapIndex + 1, MAINTENANCE_GAP.length - 1) as AbaTargetState['maintenanceGapIndex'],
        maintenanceFailsInRow: 0,
      },
      reason: done ? 'mixed_passed' : null,
    };
  }
  const fails = (s.mixedCheck?.failsInRow ?? 0) + 1;
  if (fails < MIXED_BLOCK.failsToReacquire) {
    // первый провал: цель освоена, засчитанные дни остаются — иначе «зачёт, провал, зачёт, провал» не кончался бы ни
    // `done`, ни обучением и держал бы оба слота без предела; повтор — следующей сессией, как после первого провала
    // поддержания
    const { noVerdict: _n, ...check } = s.mixedCheck ?? { days: [] };
    return { state: { ...s, mixedCheck: { ...check, failsInRow: fails, failedDay: day } }, reason: null };
  }
  // не выше первого уровня, несущего ответ: у освоенной по базовой линии «последний успех» мог остаться стартовым L3
  const start: PromptLevel = independent <= 2 ? answerLevel(target) : (Math.min(answerLevel(target), s.lastSuccessfulPromptLevel) as PromptLevel);
  const { mixedCheck: _m, masteredBy: _b, ...rest } = s;
  return {
    state: {
      ...rest,
      phase: 'acquisition',
      startPromptLevel: start,
      consecutiveIndependentAtStart: 0,
      consecutiveAboveStart: 0,
      consecutiveFailures: 0,
      recentIndependentRates: [],
      sessionsAtCriterion: 0,
      criterionDays: [],
      exemplarsAtCriterion: [],
      criterionSessions: [],
      maintenanceGapIndex: 0,
      maintenanceFailsInRow: 0,
      lastMaintenanceSessionIndex: idx,
    },
    reason: 'mixed_failed',
  };
}
