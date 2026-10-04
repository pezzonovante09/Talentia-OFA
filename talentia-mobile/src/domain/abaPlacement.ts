/**
 * Автоподбор старта без специалиста (решение №56), допуск формата в «сам» (№60) и предложение
 * перехода в основное приложение (№59). Спецификация — ABA.md, «Спецификация первой версии»
 * (`aba-pedagogy-specialist`, 2026-10-02). Чистая логика без I/O.
 *
 * **Лестница** — цепочка `prerequisiteTargetIds` внутри одной области и одного формата.
 * **Проверка сверху вниз**: на свежей лестнице (все цели на базовой линии) сначала пробуется
 * верхняя цель — та, от которой внутри лестницы ничего не зависит. Прошла — освоена по базовой
 * линии, её предпосылки по лестнице — `inferred` с проверкой поддержания со следующей сессии.
 * Не прошла — отметка `placementTriedAt`, на пробу идёт прямая предпосылка, и так вниз. Потом —
 * обычная базовая линия снизу вверх. Предпосылки из других областей не выводятся никогда;
 * наборы `identify` под проверку не попадают (5/5 там даёт старт L0, а не «освоено»).
 */
import { BASELINE_CHAIN_RUNS, BASELINE_TRIALS, markMastered, MATCH_BASELINE } from './abaCriterion';
import type { AbaConfig, AbaFormat, AbaTarget, AbaTargetState, AbaTrial } from '../types/aba';

const MASTERED: ReadonlySet<AbaTargetState['phase']> = new Set(['mastered', 'maintenance']);

/** Предпосылки цели в той же лестнице: та же область и тот же формат. */
function ladderPrerequisites(t: AbaTarget, byId: ReadonlyMap<string, AbaTarget>): AbaTarget[] {
  return (t.prerequisiteTargetIds ?? [])
    .map((id) => byId.get(id))
    .filter((p): p is AbaTarget => !!p && p.area === t.area && p.format === t.format);
}

/** Все предпосылки по лестнице вниз, без повторов. */
export function ladderBelow(t: AbaTarget, targets: readonly AbaTarget[]): AbaTarget[] {
  const byId = new Map(targets.map((x) => [x.id, x]));
  const out = new Map<string, AbaTarget>();
  const walk = (x: AbaTarget) => {
    for (const p of ladderPrerequisites(x, byId)) {
      if (out.has(p.id)) continue;
      out.set(p.id, p);
      walk(p);
    }
  };
  walk(t);
  return [...out.values()];
}

/** Лестница цели целиком — она сама, всё ниже и всё выше по той же области и формату. */
function ladderOf(t: AbaTarget, targets: readonly AbaTarget[]): AbaTarget[] {
  const same = targets.filter((x) => x.area === t.area && x.format === t.format && x.format !== 'identify');
  const ids = new Set<string>([t.id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const x of same) {
      if (ids.has(x.id)) continue;
      const linked = (x.prerequisiteTargetIds ?? []).some((id) => ids.has(id)) || same.some((y) => ids.has(y.id) && (y.prerequisiteTargetIds ?? []).includes(x.id));
      if (linked) {
        ids.add(x.id);
        grew = true;
      }
    }
  }
  return same.filter((x) => ids.has(x.id));
}

/**
 * Цели на проверку сверху вниз в эту сессию — по одной на лестницу, в порядке программы. Лестница
 * свежая: все её цели на базовой линии и без проверки ниже по лестнице уже пройденной.
 */
export function placementCandidates(targets: readonly AbaTarget[], states: Readonly<Record<string, AbaTargetState | undefined>>): AbaTarget[] {
  const phase = (t: AbaTarget) => states[t.id]?.phase ?? 'baseline';
  const out: AbaTarget[] = [];
  const seen = new Set<string>();
  for (const t of targets) {
    if (seen.has(t.id) || t.format === 'identify') continue;
    const ladder = ladderOf(t, targets);
    ladder.forEach((x) => seen.add(x.id));
    if (ladder.length < 2 || !ladder.every((x) => phase(x) === 'baseline')) continue;
    const byId = new Map(targets.map((x) => [x.id, x]));
    // верхняя — от неё внутри лестницы ничего не зависит
    let cur: AbaTarget | undefined = ladder.find((x) => !ladder.some((y) => (y.prerequisiteTargetIds ?? []).includes(x.id)));
    // одно условие спуска: уже пробованная или не осваиваемая по базовой линии (match с полем 2,
    // сортировка) — ниже по лестнице. Двумя циклами подряд пробованная цель ниже неосваиваемой
    // бралась снова каждую сессию (проверка методиста). При ветвлении — по первой предпосылке:
    // первой авторы ставят ближайшую к вершине. `visited` — защита от цикла предпосылок.
    const visited = new Set<string>();
    while (cur && !visited.has(cur.id) && (states[cur.id]?.placementTriedAt !== undefined || !masterableByBaseline(cur))) {
      visited.add(cur.id);
      cur = ladderPrerequisites(cur, byId)[0];
    }
    if (cur && visited.has(cur.id)) cur = undefined;
    // дошли до низа лестницы — дальше обычная базовая линия снизу вверх
    if (cur && ladderPrerequisites(cur, byId).length > 0) out.push(cur);
  }
  return out;
}

/**
 * Можно ли освоить цель по базовой линии: у `match` с полем 2 и у сортировки 5/5 угадывается в 3%
 * случаев — они только начинают обучение с L0, поэтому вершиной проверки не бывают (методист).
 */
export function masterableByBaseline(t: AbaTarget): boolean {
  return !(t.format === 'match' && (t.matchMode === 'sort' || (t.fieldSize ?? 2) < MATCH_BASELINE.minFieldForMastery));
}

/**
 * Прошла ли проверка: пороги базовой линии — 3/3, касанием 5/5 при поле ≥ 3, цепочка — 2 прогона.
 * Первая ошибка решает сразу: проверка сверху вниз требует 100%, и остаток проб — провалы без
 * пользы для измерения (сессия снимает их, `stopPlacementOnFailure`).
 */
export function placementPassed(t: AbaTarget, trials: readonly AbaTrial[]): boolean | null {
  const own = trials.filter((x) => x.targetId === t.id && x.kind === 'baseline' && x.response !== 'interrupted');
  if (own.some((x) => x.response !== 'independent')) return false;
  if (t.steps?.length) {
    const byStep = t.steps.map((st) => own.filter((x) => x.stepId === st.id));
    if (byStep.some((x) => x.length < BASELINE_CHAIN_RUNS)) return null;
    return byStep.every((x) => x.every((y) => y.response === 'independent'));
  }
  const need = t.format === 'match' ? MATCH_BASELINE.trials : BASELINE_TRIALS;
  if (own.length < need) return null;
  if (t.format === 'match' && (t.fieldSize ?? 2) < 3) return false;
  return own.every((x) => x.response === 'independent');
}

/**
 * Итог проверки сверху вниз. Прошла — цель освоена по базовой линии, предпосылки по лестнице —
 * `inferred` (проверка поддержания со следующей сессии). Не прошла — `placementTriedAt`, старт
 * с этой пробы не берётся: к обучению он устареет. Нет решения (проб мало) — без изменений.
 */
export function applyPlacementProbe(
  states: Readonly<Record<string, AbaTargetState>>,
  targets: readonly AbaTarget[],
  t: AbaTarget,
  trials: readonly AbaTrial[],
  sessionIndex: number,
  config: AbaConfig,
): Record<string, AbaTargetState> {
  const passed = placementPassed(t, trials);
  const out = { ...states };
  if (passed === null) return out;
  if (!passed) {
    out[t.id] = { ...out[t.id], placementTriedAt: sessionIndex };
    return out;
  }
  out[t.id] = markMastered(out[t.id], sessionIndex, 'baseline', config);
  for (const p of ladderBelow(t, targets)) {
    const s = out[p.id];
    if (s && s.phase === 'baseline') out[p.id] = markMastered(s, sessionIndex, 'inferred');
  }
  return out;
}

/**
 * Пройдена ли хоть одна проба поддержания: индекс интервала растёт только после пройденной и
 * обнуляется при провале, а фаза `maintenance` ставится и после первого провала.
 */
export function passedMaintenance(s: AbaTargetState): boolean {
  return s.phase === 'maintenance' && s.maintenanceGapIndex > 0;
}

/** Цель на проверке сверху вниз: на базовой линии, а предпосылки ещё не освоены. */
export function isPlacementProbe(t: AbaTarget, states: Readonly<Record<string, AbaTargetState | undefined>>): boolean {
  return (states[t.id]?.phase ?? 'baseline') === 'baseline' && (t.prerequisiteTargetIds ?? []).some((id) => !MASTERED.has(states[id]?.phase ?? 'baseline'));
}

/**
 * Открыт ли формат для обучения в «сам» (№60): есть цель того же формата, освоенная со взрослым,
 * — по критерию, «дома» или по базовой линии с пройденной пробой поддержания. Выведенная
 * (`inferred`) формат не открывает.
 */
export function formatUnlockedAlone(
  format: AbaFormat,
  targets: readonly AbaTarget[],
  states: Readonly<Record<string, AbaTargetState | undefined>>,
): boolean {
  return targets.some((t) => {
    const s = states[t.id];
    if (t.format !== format || !s || !MASTERED.has(s.phase) || s.masteredConfig !== 'with_adult') return false;
    if (s.masteredBy === 'criterion' || s.masteredBy === 'home_unverified') return true;
    return s.masteredBy === 'baseline' && passedMaintenance(s);
  });
}

/** Через сколько сессий повторить предложение перехода после отказа. */
export const TRANSITION_RETRY_SESSIONS = 10;

/** Доля освоенных целей ступеней 1–2 для перехода. */
export const TRANSITION_LOWER_SHARE = 0.9;

/**
 * Предложить ли переход в основное приложение после ступени 3 (№59): решает взрослый, приложение
 * только предлагает. `reasons` — чего не хватает, для отладки и специалиста.
 */
export function transitionOffer(
  targets: readonly AbaTarget[],
  states: Readonly<Record<string, AbaTargetState | undefined>>,
  opts: { promptDependentInLast3: boolean; declinedAtSession?: number; sessionIndex: number },
): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const solid = (t: AbaTarget) => {
    const s = states[t.id];
    if (!s || !MASTERED.has(s.phase)) return false;
    return s.masteredBy === 'criterion' || (s.masteredBy === 'baseline' && passedMaintenance(s));
  };
  // в долю ступеней 1–2 не идут выведенные и освоенные по базовой линии без проверки
  const mastered = (t: AbaTarget) => {
    const s = states[t.id];
    return !!s && MASTERED.has(s.phase) && s.masteredBy !== 'inferred' && !(s.masteredBy === 'baseline' && !passedMaintenance(s));
  };
  // процедурный order ступени 3 и пробы на появление в счёт не идут — их в v1 нет среди целей
  const third = targets.filter((t) => t.level === 3);
  if (!third.length) reasons.push('ступени 3 нет');
  else if (!third.every(solid)) reasons.push('не все цели ступени 3 освоены по критерию');
  const lower = targets.filter((t) => t.level === 1 || t.level === 2);
  if (lower.length && lower.filter(mastered).length / lower.length < TRANSITION_LOWER_SHARE) reasons.push('ступени 1–2 освоены меньше чем на 90%');
  if (targets.some((t) => (states[t.id]?.maintenanceFailsInRow ?? 0) > 0)) reasons.push('есть провал поддержания');
  // повторное обучение: цель уже была освоена (masteredBy сохраняется) и снова учится
  const reteaching = (t: AbaTarget) => {
    const s = states[t.id];
    return !!s && (s.phase === 'acquisition' || s.phase === 'generalization_check') && s.masteredBy !== undefined;
  };
  if (targets.some(reteaching)) reasons.push('есть цели в повторном обучении');
  if (opts.promptDependentInLast3) reasons.push('зависимость от подсказки в последних трёх сессиях');
  if (opts.declinedAtSession !== undefined && opts.sessionIndex - opts.declinedAtSession < TRANSITION_RETRY_SESSIONS) {
    reasons.push('недавно отказались');
  }
  return { eligible: reasons.length === 0, reasons };
}
