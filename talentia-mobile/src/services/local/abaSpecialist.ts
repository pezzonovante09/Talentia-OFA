/**
 * Раздел «Для специалиста» (методист 2026-11-18): что экран показывает — одним чтением, и «Награда от взрослого» с
 * событием журнала. Запись остального — `commit.ts`.
 */
import { ABA_TARGETS } from '../../content/aba';
import { mixGroups } from '../../domain/abaMixedBlock';
import { deepEqual } from '../../domain/deepEqual';
import { sanitizeSessionParams, type AbaSessionParams } from '../../domain/abaSessionParams';
import { adultRewardChange, type SpecialistEvent } from '../../domain/abaSpecialist';
import { initialTokenTraining, type TokenTrainingFlag } from '../../domain/abaTokenTraining';
import type { BreakCardFlag } from '../../domain/abaBreakCard';
import type { AbaFlag, AbaObserver, AbaPhase, MixedNoVerdictReason, PromptLevel } from '../../types/aba';
import type { AgeBand } from '../../types/task';
import { sessionsOf } from './abaLog';
import { loadChildState } from './childState';
import { abaSpecialistEventsOf, appendAbaSpecialistEvents } from './commit';
import type { ChildProfile } from './profiles';
import type { SqlDb } from './sql';

/** Событие сессии, которое специалист видит словами: смешанный блок без итога, внимание к образцу не установлено. */
export type SpecialistSessionNote =
  | { kind: 'mixed_no_verdict'; day: string; targetIds: string[]; reason: MixedNoVerdictReason; counted: boolean; dropped: boolean; yielded: boolean }
  | { kind: 'observing_not_established'; day: string; targetIds: string[]; then: 'placement_dropped' | 'teaching_from_l1' };

export type SpecialistView = {
  /** Действующие параметры (`{}` — по умолчанию полосы). */
  params: AbaSessionParams;
  /** В хранилище есть поля, которые не годятся при полосе профиля: старт их пропускает (годные — берёт). */
  paramsIgnored: boolean;
  observers: AbaObserver[];
  pairingDone: boolean;
  /** Обученный наблюдатель ребёнка — ему доступно «Подтвердить сопряжение». */
  trainedObserverId: string | null;
  boardStage: number;
  tokenFlags: TokenTrainingFlag[];
  breakCardFlags: BreakCardFlag[];
  /** Цели с состоянием, в порядке программы. */
  targets: { id: string; phase: AbaPhase; startPromptLevel: PromptLevel; currentDelayMs: number | null; flags: AbaFlag[] }[];
  /** Группы смешанного блока, снятые с плана (`mixed_not_established`): действие «Назначить проверку вперемешку». */
  mixedHeld: string[][];
  /** Последние события сессий, свежие первыми. */
  notes: SpecialistSessionNote[];
  /** Последние изменения раздела, свежие первыми. */
  changes: SpecialistEvent[];
};

const NOTES_SHOWN = 6;
const CHANGES_SHOWN = 6;

export async function loadSpecialistView(db: SqlDb, childId: string, band: AgeBand): Promise<SpecialistView> {
  const stored = await loadChildState(db, childId, 'abaSessionParams');
  const params = sanitizeSessionParams(stored, band);
  const observers = (await loadChildState(db, childId, 'abaObservers')) ?? [];
  const token = (await loadChildState(db, childId, 'tokenTraining')) ?? initialTokenTraining();
  const card = await loadChildState(db, childId, 'breakCard');
  const states = (await loadChildState(db, childId, 'abaTargets')) ?? {};
  const targets = ABA_TARGETS.filter((t) => states[t.id]).map((t) => {
    const s = states[t.id];
    return { id: t.id, phase: s.phase, startPromptLevel: s.startPromptLevel, currentDelayMs: s.currentDelayMs ?? null, flags: s.flags };
  });
  const mixedHeld = mixGroups(ABA_TARGETS)
    .filter((g) => g.some((t) => states[t.id]?.flags.includes('mixed_not_established')))
    .map((g) => g.map((t) => t.id));
  const notes: SpecialistSessionNote[] = [];
  for (const s of (await sessionsOf(db, childId)).reverse()) {
    const day = s.day ?? s.startedAt.slice(0, 10);
    for (const e of [...s.events].reverse()) {
      if (e.kind !== 'measurement') continue;
      if (e.action === 'mixed_no_verdict') {
        notes.push({ kind: 'mixed_no_verdict', day, targetIds: e.targetIds, reason: e.reason, counted: e.counted, dropped: e.dropped === true, yielded: e.yielded === true });
      } else if (e.action === 'observing_not_established') {
        notes.push({ kind: 'observing_not_established', day, targetIds: e.targetIds, then: e.then });
      }
    }
    if (notes.length >= NOTES_SHOWN) break;
  }
  return {
    params: params ?? {},
    // снято хоть одно поле (по полю, `sanitizeSessionParams`): старт идёт без него — предупреждение на экране
    paramsIgnored: stored !== undefined && Object.keys(stored ?? {}).length > 0 && !deepEqual(stored, params ?? {}),
    observers,
    pairingDone: token.pairingDone,
    trainedObserverId: observers.find((o) => o.trained)?.id ?? null,
    boardStage: token.stage,
    tokenFlags: token.flags,
    breakCardFlags: card?.flags ?? [],
    targets,
    mixedHeld,
    notes: notes.slice(0, NOTES_SHOWN),
    changes: (await abaSpecialistEventsOf(db, childId)).reverse().slice(0, CHANGES_SHOWN),
  };
}

/**
 * «Награда от взрослого» из раздела специалиста. Поле — в профиле на устройстве (`profiles.ts`), событие — в SQLite:
 * одной транзакцией их не записать. Порядок: событие (проверяет согласие и паузу) → профиль; профиль не записался —
 * обратное событие, чтобы журнал не утверждал перемену, которой нет. Значение то же — ничего.
 */
export async function setAdultRewardAsSpecialist(
  db: SqlDb,
  profile: ChildProfile,
  to: boolean,
  save: (p: ChildProfile) => Promise<void>,
  at: string,
): Promise<boolean> {
  const from = profile.adultReward === true;
  const events = adultRewardChange(from, to, at);
  if (!events.length) return false;
  await appendAbaSpecialistEvents(db, profile.childId, events);
  try {
    await save({ ...profile, adultReward: to });
  } catch (e) {
    await appendAbaSpecialistEvents(db, profile.childId, adultRewardChange(to, from, at)).catch(() => undefined);
    throw e;
  }
  return true;
}
