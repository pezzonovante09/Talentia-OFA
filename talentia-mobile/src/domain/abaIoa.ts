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
  type AbaIoaRecord,
  type AbaIoaResult,
  type AbaObserver,
  type AbaPhase,
  type AbaSession,
  type AbaTarget,
  type AbaTargetState,
  type AbaTrial,
  type AbaTrialKind,
  type PromptLevel,
} from '../types/aba';
import { isMasteryMet, markMastered } from './abaCriterion';
import { clearDependenceOnMastery } from './abaPrompting';

/** Пробы, по которым принимаются решения. Коррекция, разогрев и закрывающая не кодируются. */
const IOA_KINDS: ReadonlySet<AbaTrialKind> = new Set([
  'baseline',
  'teaching',
  'transfer',
  'generalization',
  'maintenance',
  'verification',
]);

/**
 * Строки листа: пробы, по которым принимаются решения, оценённые взрослым, — и прерванные
 * тоже (прерывание кодирует и второй наблюдатель). Порядок — предъявления.
 */
function sheetTrials(trials: readonly AbaTrial[]): AbaTrial[] {
  // прерванное взрослым или приложением по технической причине — не ход процедуры, кода нет
  return trials.filter(
    (t) => IOA_KINDS.has(t.kind) && t.scoredBy === 'adult' && t.interruptedBy !== 'adult' && t.interruptedBy !== 'app',
  );
}

/** Строки, которые сравниваются: все, кроме перерыва по карточке — его фиксирует устройство. */
export function ioaUnits(trials: readonly AbaTrial[]): AbaTrial[] {
  return sheetTrials(trials).filter((t) => t.interruptedBy !== 'child_break');
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
  /** Повтор снятой пробы — новая строка с пометкой «повтор строки N». */
  repeatOfRow?: number;
  /**
   * Перерыв по карточке (на листе «ПР»), его фиксирует устройство; второй наблюдатель строку не
   * кодирует. В данных — id, а не подпись: подпись берёт экран из ключа `aba.ioa.device.<id>`
   * (раунд 3, локализация В2).
   */
  deviceMark?: 'child_break';
};

/**
 * Лист проб для второго наблюдателя — показывается на экране для переписывания, без печати
 * (решение владельца №24). На нём нет имени ребёнка, слова «ABA», программ, флагов, прошлых
 * результатов и кодов основного наблюдателя. Код сессии — её номер у ребёнка, не id. Номера
 * строк — по порядку предъявления, одинаково на листе и в приложении.
 */
export function ioaSheet(sessionIndex: number, trials: readonly AbaTrial[]): { code: string; rows: IoaSheetRow[] } {
  const rowOf = new Map<string, number>();
  const rows = sheetTrials(trials).map((t, i) => {
    rowOf.set(t.id, i + 1);
    const origin = t.requeuedFromTrialId ? rowOf.get(t.requeuedFromTrialId) : undefined;
    return {
      n: i + 1,
      trialId: t.id,
      targetId: t.targetId,
      exemplarId: t.exemplarId,
      ...(t.stepId ? { stepId: t.stepId } : {}),
      startPromptLevel: t.startPromptLevel,
      ...(origin !== undefined ? { repeatOfRow: origin } : {}),
      ...(t.interruptedBy === 'child_break' ? { deviceMark: 'child_break' as const } : {}),
    };
  });
  return { code: `#${sessionIndex}`, rows };
}

const pct = (a: number, n: number) => (n === 0 ? 0 : (a / n) * 100);

/** Прерывание основной записи в кодах листа: «ОТ» или «СТ»; остальное — исход. */
const primaryMark = (t: AbaTrial) =>
  t.interruptedBy === 'assent' || t.interruptedBy === 'l4_resisted' ? t.interruptedBy : undefined;

/**
 * Согласие по целям сессии (решение методиста 2026-10-01):
 * - по исходам, trial-by-trial — только строки, где оба поставили исход без прерывания;
 *   согласие — совпали и реакция, и попытка до подсказки;
 * - по прерываниям — отдельно, по всем строкам кроме «ПР»: оба отметили одно и то же или оба
 *   ничего; «ОТ» у одного и исход у другого — расхождение здесь, и строка не в исходах.
 *
 * Кодов должно быть ровно по строкам: пропущенная или лишняя — ошибка ввода, а не несогласие.
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
  for (const x of items) {
    if (!ids.has(x.trialId)) errors.push(`код для пробы, которой нет на листе: ${x.trialId}`);
    if ((x.interruption !== undefined) !== (x.response === 'interrupted')) errors.push(`строка ${x.trialId}: прерывание без кода или код без прерывания`);
  }
  if (errors.length) return { ok: false, errors };

  const byTarget: Record<string, AbaIoaResult> = {};
  for (const targetId of new Set(units.map((u) => u.targetId))) {
    const own = units.filter((u) => u.targetId === targetId);
    let outcomeUnits = 0;
    let agreements = 0;
    let indUnits = 0;
    let indAgreements = 0;
    let markAgreements = 0;
    let marked = 0;
    for (const u of own) {
      const x = byId.get(u.id)!;
      const mine = primaryMark(u);
      if (mine === x.interruption) markAgreements += 1;
      if (mine !== undefined || x.interruption !== undefined) marked += 1;
      if (u.response === 'interrupted' || x.response === 'interrupted') continue;
      outcomeUnits += 1;
      if (x.response === u.response && x.emittedBeforePrompt === u.emittedBeforePrompt) agreements += 1;
      if (u.response === 'independent' || x.response === 'independent') {
        indUnits += 1;
        if (u.response === 'independent' && x.response === 'independent') indAgreements += 1;
      }
    }
    byTarget[targetId] = {
      units: outcomeUnits,
      agreements,
      percent: pct(agreements, outcomeUnits),
      independentOccurrence: {
        units: indUnits,
        agreements: indAgreements,
        percent: indUnits === 0 ? null : pct(indAgreements, indUnits),
      },
      interruptions: {
        units: own.length,
        agreements: markAgreements,
        marked,
        percent: marked < IOA.minUnits ? null : pct(markAgreements, own.length),
      },
    };
  }
  return { ok: true, byTarget };
}

/** IOA по цели прошёл порог — и по исходам, и по прерываниям (когда их хватает для процента). */
export function ioaPasses(r: AbaIoaResult | undefined): boolean {
  if (!r || r.units < IOA.minUnits || r.percent < IOA.minPercent) return false;
  const ind = r.independentOccurrence.percent;
  if (ind !== null && ind < IOA.minPercent) return false;
  const marks = r.interruptions.percent;
  return marks === null || marks >= IOA.minPercent;
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
  // критерий уже был выполнен и ждал подтверждения — теперь «освоено»; освоение снимает
  // зависимость от подсказки, как в итоге сессии (раунд 4, В3)
  if (next.flags.includes('needs_verification') && isMasteryMet(next) && streakVerified(next)) {
    return clearDependenceOnMastery(s.phase, markMastered(next, sessionIndex, 'criterion'), sessionIndex);
  }
  return next;
}

/** Покрытие IOA по фазе цели: сессий «Со взрослым» с целью и сколько из них с IOA. */
export type IoaCoverage = { sessions: number; withIoa: number; ratio: number; below: boolean };

/**
 * Покрытие IOA по цели в фазах базовой линии и обучения (не меньше `IOA.coverage` сессий
 * «Со взрослым»). Метрика отчёта и подсказка планировщику, не гейт. Фаза на сессию —
 * по событиям смены фазы в записях сессий.
 */
export function ioaCoverage(
  targetId: string,
  sessions: readonly AbaSession[],
  ioaSessionIds: ReadonlySet<string>,
): Record<'baseline' | 'acquisition', IoaCoverage> {
  const counts = { baseline: { sessions: 0, withIoa: 0 }, acquisition: { sessions: 0, withIoa: 0 } };
  let phase: AbaPhase = 'baseline';
  for (const s of [...sessions].sort((a, b) => a.index - b.index)) {
    const bucket = phase === 'baseline' ? counts.baseline : phase === 'acquisition' ? counts.acquisition : null;
    if (bucket && s.config === 'with_adult' && s.targetIds.includes(targetId)) {
      bucket.sessions += 1;
      if (ioaSessionIds.has(s.id)) bucket.withIoa += 1;
    }
    for (const e of s.events) if (e.kind === 'phase' && e.targetId === targetId) phase = e.to;
  }
  const of = (c: { sessions: number; withIoa: number }): IoaCoverage => {
    const ratio = c.sessions === 0 ? 0 : c.withIoa / c.sessions;
    return { ...c, ratio, below: c.sessions > 0 && ratio < IOA.coverage };
  };
  return { baseline: of(counts.baseline), acquisition: of(counts.acquisition) };
}

/**
 * Подсказка: следующей сессии с этой целью нужна проверка вторым наблюдателем — покрытие ниже
 * нормы или проверка «получается дома» только что провалилась (`ioaDueSessions`).
 */
export function ioaDueNext(
  phase: AbaPhase,
  coverage: Record<'baseline' | 'acquisition', IoaCoverage>,
  s?: Pick<AbaTargetState, 'ioaDueSessions'>,
): boolean {
  if ((s?.ioaDueSessions ?? 0) > 0) return true;
  if (phase === 'baseline') return coverage.baseline.below || coverage.baseline.sessions === 0;
  if (phase === 'acquisition') return coverage.acquisition.below || coverage.acquisition.sessions === 0;
  return false;
}

const RECORD_KEYS = new Set(['id', 'sessionId', 'secondaryObserverId', 'source', 'enteredAt', 'items', 'byTarget']);
const ITEM_KEYS = new Set(['trialId', 'response', 'emittedBeforePrompt', 'interruption']);

/**
 * Запись IOA перед сохранением: только поля схемы — без комментариев, свободного текста и
 * фото листа (условия приватности). Тип этого не гарантирует: в хранилище уходит JSON.
 */
export function ioaRecordErrors(record: AbaIoaRecord): string[] {
  const errors: string[] = [];
  for (const k of Object.keys(record)) if (!RECORD_KEYS.has(k)) errors.push(`лишнее поле записи IOA: ${k}`);
  if (record.source !== 'paper_entry') errors.push('источник IOA — только бумажный лист');
  for (const item of record.items) {
    for (const k of Object.keys(item)) if (!ITEM_KEYS.has(k)) errors.push(`лишнее поле строки IOA: ${k}`);
  }
  return errors;
}
