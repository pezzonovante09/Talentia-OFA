/**
 * IOA — согласие двух наблюдателей. Спецификация — ABA.md, «Протокол взрослого», блок 5, и
 * «Условия приватности для блоков 4 и 5».
 *
 * Освоение по одному необученному наблюдателю (блок 12 аудита) ничего не доказывает: второй
 * наблюдатель кодирует ту же сессию независимо, и «освоено» у цели, которую оценивает
 * взрослый, ставится, только если хотя бы одна сессия серии критерия подтверждена обученным
 * наблюдателем.
 */
import {
  COUNTS_TOWARD_MASTERY,
  IOA,
  MASTERY,
  type AbaIoaItem,
  type AbaIoaResult,
  type AbaObserver,
  type AbaTarget,
  type AbaTargetState,
  type AbaTrial,
  type AbaTrialKind,
  type PromptLevel,
} from '../types/aba';
import { isMasteryMet, markMastered } from './abaCriterion';

/** Пробы, по которым принимаются решения. Коррекция, разогрев и закрывающая не кодируются. */
const IOA_KINDS: ReadonlySet<AbaTrialKind> = new Set(['baseline', 'teaching', 'transfer', 'generalization', 'maintenance']);

/** Единицы IOA сессии: проба (у цепочки — звено), оценённая взрослым, не прерванная. */
export function ioaUnits(trials: readonly AbaTrial[]): AbaTrial[] {
  return trials.filter((t) => IOA_KINDS.has(t.kind) && t.scoredBy === 'adult' && t.response !== 'interrupted');
}

/** Строка листа второго наблюдателя. Кодов основного на листе нет — это и независимость IOA. */
export type IoaSheetRow = {
  n: number;
  trialId: string;
  /** Экран показывает короткую подпись цели («Покажи: кошка») — не id и не программу. */
  targetId: string;
  exemplarId: string;
  stepId?: string;
  startPromptLevel: PromptLevel;
};

/**
 * Лист проб для второго наблюдателя — показывается на экране для переписывания, без печати
 * (решение владельца №24). На нём нет имени ребёнка, слова «ABA», программ, флагов, прошлых
 * результатов и кодов основного наблюдателя. Код сессии — её номер у ребёнка, не id.
 */
export function ioaSheet(sessionIndex: number, trials: readonly AbaTrial[]): { code: string; rows: IoaSheetRow[] } {
  return {
    code: `#${sessionIndex}`,
    rows: ioaUnits(trials).map((t, i) => ({
      n: i + 1,
      trialId: t.id,
      targetId: t.targetId,
      exemplarId: t.exemplarId,
      ...(t.stepId ? { stepId: t.stepId } : {}),
      startPromptLevel: t.startPromptLevel,
    })),
  };
}

const pct = (a: number, n: number) => (n === 0 ? 0 : (a / n) * 100);

/**
 * Согласие по целям сессии, trial-by-trial: согласие — совпали и реакция, и попытка до
 * подсказки. Кодов должно быть ровно по единицам: пропущенная или лишняя проба — ошибка
 * ввода, а не несогласие.
 */
export function computeIoa(
  trials: readonly AbaTrial[],
  items: readonly AbaIoaItem[],
): { ok: true; byTarget: Record<string, AbaIoaResult> } | { ok: false; errors: string[] } {
  const units = ioaUnits(trials);
  const byId = new Map(items.map((x) => [x.trialId, x]));
  const errors: string[] = [];
  if (byId.size !== items.length) errors.push('проба закодирована дважды');
  for (const u of units) if (!byId.has(u.id)) errors.push(`нет кода для пробы ${u.id}`);
  const ids = new Set(units.map((u) => u.id));
  for (const x of items) if (!ids.has(x.trialId)) errors.push(`код для пробы, которой нет на листе: ${x.trialId}`);
  if (errors.length) return { ok: false, errors };

  const byTarget: Record<string, AbaIoaResult> = {};
  for (const targetId of new Set(units.map((u) => u.targetId))) {
    const own = units.filter((u) => u.targetId === targetId);
    let agreements = 0;
    let indUnits = 0;
    let indAgreements = 0;
    for (const u of own) {
      const x = byId.get(u.id)!;
      if (x.response === u.response && x.emittedBeforePrompt === u.emittedBeforePrompt) agreements += 1;
      if (u.response === 'independent' || x.response === 'independent') {
        indUnits += 1;
        if (u.response === 'independent' && x.response === 'independent') indAgreements += 1;
      }
    }
    byTarget[targetId] = {
      units: own.length,
      agreements,
      percent: pct(agreements, own.length),
      independentOccurrence: {
        units: indUnits,
        agreements: indAgreements,
        percent: indUnits === 0 ? null : pct(indAgreements, indUnits),
      },
    };
  }
  return { ok: true, byTarget };
}

/** IOA по цели прошёл порог. */
export function ioaPasses(r: AbaIoaResult | undefined): boolean {
  if (!r || r.units < IOA.minUnits || r.percent < IOA.minPercent) return false;
  const ind = r.independentOccurrence.percent;
  return ind === null || ind >= IOA.minPercent;
}

/** Подтверждение этой сессии по цели: что известно о наблюдателях и IOA. */
export type SessionVerification = {
  primary: AbaObserver | null;
  /** Второй наблюдатель и его результат по цели, если IOA внесён. */
  ioa?: { secondary: AbaObserver; result: AbaIoaResult | undefined };
};

/** Подтверждена ли сессия по цели: основной обучен или IOA прошёл порог при обученном втором. */
export function isVerified(v: SessionVerification): boolean {
  if (v.primary?.trained) return true;
  return Boolean(v.ioa?.secondary.trained && ioaPasses(v.ioa.result));
}

/** Цель, которую оценивает взрослый, требует подтверждения; касание и громкость — нет. */
export function needsVerification(target: AbaTarget): boolean {
  return COUNTS_TOWARD_MASTERY[target.scoredBy] && target.scoredBy === 'adult';
}

/** Хотя бы одна сессия текущей серии критерия подтверждена. */
export function streakVerified(s: AbaTargetState): boolean {
  return (s.criterionSessions ?? []).slice(-MASTERY.sessionsInRow).some((x) => x.verified);
}

/**
 * Решение об освоении, когда критерий по долям выполнен (`isMasteryMet`):
 * - подтверждать не нужно или серия подтверждена — «освоено» по критерию;
 * - у семьи нет обученного наблюдателя — освоено «дома, без проверки»
 *   (`home_unverified`): родитель видит «получается дома», а не «освоено»; при подключении
 *   специалиста — проверочная проба;
 * - обученный есть, но серия не подтверждена — цель остаётся в обучении с флагом
 *   `needs_verification`, обучение идёт дальше, родитель видит «почти».
 */
export function masteryVerdict(
  target: AbaTarget,
  s: AbaTargetState,
  hasTrainedObserver: boolean,
): 'criterion' | 'home_unverified' | 'needs_verification' {
  if (!needsVerification(target) || streakVerified(s)) return 'criterion';
  return hasTrainedObserver ? 'needs_verification' : 'home_unverified';
}

/**
 * IOA, внесённый после итога сессии (лист переписан позже): сессия серии отмечается
 * подтверждённой; цель, ждавшая подтверждения (`needs_verification`), становится освоенной.
 * Флаг `ioa_low` — если оба обучены, а согласие ниже порога.
 */
export function applyLateIoa(
  s: AbaTargetState,
  sessionIndex: number,
  verified: boolean,
  bothTrainedButLow: boolean,
): AbaTargetState {
  const criterionSessions = (s.criterionSessions ?? []).map((x) =>
    x.sessionIndex === sessionIndex ? { ...x, verified: x.verified || verified } : x,
  );
  const flags = bothTrainedButLow && !s.flags.includes('ioa_low') ? [...s.flags, 'ioa_low' as const] : s.flags;
  const next = { ...s, criterionSessions, flags };
  // критерий уже был выполнен и ждал подтверждения — теперь «освоено»
  if (next.flags.includes('needs_verification') && isMasteryMet(next) && streakVerified(next)) {
    return markMastered(next, sessionIndex, 'criterion');
  }
  return next;
}
