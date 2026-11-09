/**
 * Сеанс ребёнка в памяти приложения (zustand, без сохранения на диск).
 *
 * Срез прототипа работает в режиме без записи (PARENT.md п. 5; решения №130, №142): профиля на
 * устройстве нет, `childId` живёт до закрытия приложения, итоги уроков применяются в память
 * **после** ответа порта прогресса — `commitLesson` без согласия отвечает
 * `LessonConsentRequiredError`, и это «сессия без записи», а не сбой. С аккаунтом (`account_local`,
 * этап 10) тот же стор получает `sqlitePort(db)` и снимок прогресса с устройства; экраны не меняются.
 * Сеанс без записи не пишет никогда, какой бы порт ни стоял (вопрос 84): взрослый может завести аккаунт,
 * пока сеанс открыт, и у его случайного `childId` нет профиля — запись легла бы мимо отчёта и `delete_child`.
 *
 * Полоса меняется только взрослым (№142) — у стора нет действия для ребёнка. Настройки
 * calm / focus / звук — здесь же, пока родительский раздел не хранит их на устройстве.
 */
import { create } from 'zustand';

import { allLessons, lessonById, lessonsBefore } from '../content';
import { buildReviewPool } from '../domain/lessonAssembly';
import {
  applyLessonEvent,
  isReviewSession,
  lessonCommitOf,
  reviewCommitOf,
  startLessonSession,
  startReviewSession,
  type LessonCommitResult,
  type LessonEvent,
  type LessonSessionState,
} from '../domain/lessonSession';
import { accruePortion, afterCompletion, gameDay, NEW_PORTION, type NodeState, type Portion } from '../domain/mapProgress';
import type { InterfaceLang } from '../domain/regionVisibility';
import { LessonConsentRequiredError } from '../services/local/accountConsent';
import type { ChildProfile } from '../services/local/profiles';
import { EMPTY_PROGRESS, noRecordPort, type ProgressPort, type ProgressSnapshot } from '../services/progressPort';
import type { AgeBand } from '../types/task';

export type ChildSettings = {
  band: AgeBand;
  calmMode: boolean;
  focusMode: boolean;
  soundEffects: boolean;
  interfaceLang: InterfaceLang;
  kyrgyzRegion: false;
};

export type SessionMode = 'none' | 'no_record' | 'account';

export type FinishOutcome = 'persisted' | 'session_only';

export type ChildSessionState = {
  mode: SessionMode;
  childId: string | null;
  settings: ChildSettings;
  progress: ProgressSnapshot;
  portion: Portion;
  /** Открытый урок — ждёт, пока ребёнок на карте или в слое выхода (SCREENS.md 1.6). */
  activeLesson: LessonSessionState | null;
  /** Каким узлом урок был открыт: только первое завершение `open` тратит порцию. */
  openedAs: NodeState | null;
  /** Начатые и брошенные уроки сеанса: пример при возврате — в полной форме (№29). */
  abandoned: readonly string[];
  /** Итог последнего завершённого урока — для страницы атласа. */
  pendingResult: LessonCommitResult | null;

  startNoRecordSession(input: { childId: string; now: Date; interfaceLang: InterfaceLang }): void;
  /** Сеанс ребёнка с аккаунтом: настройки из профиля, прогресс — снимок с устройства (`ProgressPort.load`). */
  startAccountSession(input: { profile: ChildProfile; snapshot: ProgressSnapshot; now: Date; openedForAba?: boolean }): void;
  setSettings(patch: Partial<Pick<ChildSettings, 'calmMode' | 'focusMode' | 'soundEffects'>>): void;
  /** Начать или продолжить урок. Возвращает состояние оркестратора для экрана. */
  openLesson(input: { lessonId: string; now: Date; seed: number; nodeState: NodeState }): LessonSessionState;
  /**
   * Начать или продолжить сессию повторения с узла карты (вопрос 56): пул — все пройденные уроки,
   * порция дня не тратится. `null` — повторять нечего, память не меняется.
   */
  openReview(input: { now: Date; seed: number }): LessonSessionState | null;
  dispatch(event: LessonEvent): LessonSessionState;
  /** Ребёнок вышел из урока: урок остаётся ждать, память не меняется. */
  leaveLesson(): void;
  /**
   * Урок завершён: итог → порт → память. Чужие ошибки порта пробрасываются, память не трогается.
   * В режиме без записи `port` не вызывается: итог идёт через `noRecordPort` (вопрос 84).
   */
  finishLesson(input: { port: ProgressPort; runId: string; at: string }): Promise<FinishOutcome>;
  /** Сессию сменили с другого ребёнка ради занятия ABA: выход из занятия — к выбору профиля (`leaveAba`). */
  openedForAba: boolean;
  reset(): void;
};

export const DEFAULT_SETTINGS: ChildSettings = {
  band: '5-6',
  calmMode: false,
  focusMode: false,
  soundEffects: true,
  interfaceLang: 'ru',
  kyrgyzRegion: false,
};

const EMPTY = {
  mode: 'none' as SessionMode,
  childId: null,
  settings: DEFAULT_SETTINGS,
  progress: EMPTY_PROGRESS,
  portion: NEW_PORTION,
  activeLesson: null,
  openedAs: null,
  abandoned: [] as readonly string[],
  pendingResult: null,
  openedForAba: false,
};

export const useChildSession = create<ChildSessionState>((set, get) => ({
  ...EMPTY,

  startAccountSession({ profile, snapshot, now, openedForAba }) {
    const settings: ChildSettings = {
      band: profile.band,
      calmMode: profile.calmMode,
      focusMode: profile.focusMode,
      soundEffects: profile.soundEffects,
      interfaceLang: profile.interfaceLang,
      kyrgyzRegion: false,
    };
    set({
      ...EMPTY,
      mode: 'account',
      childId: profile.childId,
      openedForAba: openedForAba ?? false,
      settings,
      progress: snapshot,
      portion: accruePortion(NEW_PORTION, gameDay(now), settings.band),
    });
  },

  startNoRecordSession({ childId, now, interfaceLang }) {
    const settings = { ...DEFAULT_SETTINGS, interfaceLang };
    set({
      ...EMPTY,
      mode: 'no_record',
      childId,
      settings,
      portion: accruePortion(NEW_PORTION, gameDay(now), settings.band),
    });
  },

  setSettings(patch) {
    set((s) => ({ settings: { ...s.settings, ...patch } }));
  },

  openLesson({ lessonId, now, seed, nodeState }) {
    const s = get();
    if (!s.childId) throw new Error('Урок без сеанса ребёнка');
    if (s.activeLesson?.lessonId === lessonId) return s.activeLesson;
    const lesson = lessonById(lessonId);
    if (!lesson) throw new Error(`Урок ${lessonId} не найден в реестре`);

    const completed = new Set(s.progress.atlas.map((e) => e.lessonId));
    const abandoned = s.activeLesson ? [...s.abandoned, s.activeLesson.lessonId] : s.abandoned;
    const priorRun = completed.has(lessonId) ? 'completed' : abandoned.includes(lessonId) ? 'abandoned' : 'none';
    const state = startLessonSession({
      childId: s.childId,
      lesson,
      skills: s.progress.skills,
      lessonNumber: s.progress.lessonCounter,
      day: gameDay(now),
      startedAt: now.toISOString(),
      pool: buildReviewPool(lessonsBefore(lessonId).filter((l) => completed.has(l.id))),
      seed,
      priorRun,
      formatsSeen: s.progress.formatsSeen,
    });
    set({ activeLesson: state, openedAs: nodeState, abandoned, pendingResult: null });
    return state;
  },

  openReview({ now, seed }) {
    const s = get();
    if (!s.childId) throw new Error('Повторение без сеанса ребёнка');
    if (s.activeLesson && isReviewSession(s.activeLesson)) return s.activeLesson;
    const completed = completedLessons(s);
    const state = startReviewSession({
      childId: s.childId,
      band: s.settings.band,
      skills: s.progress.skills,
      lessonNumber: s.progress.lessonCounter,
      day: gameDay(now),
      startedAt: now.toISOString(),
      pool: buildReviewPool(allLessons().filter((l) => completed.has(l.id))),
      seed,
      formatsSeen: s.progress.formatsSeen,
    });
    if (state.phase === 'done') return null;
    const abandoned = s.activeLesson ? [...s.abandoned, s.activeLesson.lessonId] : s.abandoned;
    set({ activeLesson: state, openedAs: null, abandoned, pendingResult: null });
    return state;
  },

  dispatch(event) {
    const s = get();
    if (!s.activeLesson) throw new Error('Событие урока без открытого урока');
    const next = applyLessonEvent(s.activeLesson, event);
    set({ activeLesson: next });
    return next;
  },

  leaveLesson() {
    // Намеренно пусто: урок остаётся в `activeLesson`, возврат с карты продолжает его.
  },

  async finishLesson({ port, runId, at }) {
    const s = get();
    const state = s.activeLesson;
    if (!s.childId || !state) throw new Error('Итог без открытого урока');
    const review = isReviewSession(state);
    let result: LessonCommitResult;
    if (review) {
      result = reviewCommitOf(state, { skills: s.progress.skills, atlas: s.progress.atlas, runId });
    } else {
      const lesson = lessonById(state.lessonId);
      if (!lesson) throw new Error(`Урок ${state.lessonId} не найден в реестре`);
      result = lessonCommitOf(state, { lesson, skills: s.progress.skills, atlas: s.progress.atlas, runId });
    }
    let outcome: FinishOutcome = 'persisted';
    // режим без записи пишет только в память, даже если глобальный порт уже `sqlitePort` (вопрос 84)
    const target = s.mode === 'no_record' ? noRecordPort : port;
    try {
      await target.commit(s.childId, { run: result.run, skills: result.skills, atlas: result.atlas, nextLessonNumber: result.nextLessonNumber, formatsSeen: state.formatsSeen }, at);
    } catch (e) {
      if (!(e instanceof LessonConsentRequiredError)) throw e;
      outcome = 'session_only';
    }

    set({
      progress: {
        skills: result.skills,
        atlas: result.atlas,
        lessonCounter: result.nextLessonNumber,
        formatsSeen: state.formatsSeen,
      },
      // повторение порцию дня не тратит: порция — про новые уроки
      portion: review ? s.portion : afterCompletion(s.portion, s.openedAs ?? 'open'),
      activeLesson: null,
      openedAs: null,
      abandoned: s.abandoned.filter((id) => id !== state.lessonId),
      pendingResult: result,
    });
    return outcome;
  },

  reset() {
    set({ ...EMPTY });
  },
}));

/** Уроки, завершённые хотя бы раз, — для `mapNodes`. */
export const completedLessons = (s: Pick<ChildSessionState, 'progress'>): ReadonlySet<string> =>
  new Set(s.progress.atlas.map((e) => e.lessonId));

/** Начатые и не завершённые — открытый урок, если он есть. */
export const startedLessons = (s: Pick<ChildSessionState, 'activeLesson'>): ReadonlySet<string> =>
  new Set(s.activeLesson && !isReviewSession(s.activeLesson) ? [s.activeLesson.lessonId] : []);
