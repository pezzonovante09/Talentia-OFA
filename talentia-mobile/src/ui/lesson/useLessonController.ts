/**
 * Контроллер экрана урока: связывает оркестратор (`state/childSession` → `lessonStepOf`) с черновиком
 * формата и таймлайном экрана (SCREENS.md 1.5, 2.4): «Проверить» → блокировка 0…1040 с крестами →
 * сужение с подсказкой или показ с активным ответом → «Дальше» (после верного — через 900).
 * Голос — `voice.say` (в срезе молчит), поза Tali и пузырь — по разделу 5.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler } from 'react-native';

import type { TaliPose } from '../../assets/registry';
import { lessonTiming } from '../../design/tokens';
import { lessonById } from '../../content';
import { correctSituation } from '../../domain/companionSituations';
import { isReviewSession, lessonStepOf, type LessonEvent, type LessonSessionState, type LessonStep } from '../../domain/lessonSession';
import { placeVoice } from '../../domain/taskDraft';
import { voice } from '../../services/voice';
import { useChildSession } from '../../state/childSession';
import { companionLine } from '../../state/companionMemory';
import type { Task } from '../../types/task';
import { FORMATS } from './formats';
import type { FormatPhase, FormatSpec, FormatTap, TaskStep } from './formats/types';
import type { ActionState } from './LessonChrome';
import { speaksOnTap } from './MediaContent';

/** Форма обращения ребёнка — в момент реплики (родовая надстройка банка, №71). */
const addressForm = () => useChildSession.getState().settings.addressForm;

export const LISTEN_STEP_MS = 700;
export const DEMO_DELAY_MS = 600;
export const DEMO_HOLD_MS = 1200;
export const SHOW_AFTER_MS = 820;
export const UNLOCK_AFTER_MS = 1040;

export type LessonUi = {
  draft: unknown;
  phase: FormatPhase;
  wrong: string[];
  /** Ключи `listeningCue`: один при перечислении, все исправленные после показа (№140). */
  listening: string[];
  bubble: string | null;
  speaking: boolean;
  pose: TaliPose;
  pulse: number;
  marksKey: number;
  nextReady: boolean;
  replaying: boolean;
  exitOpen: boolean;
  /** Шаг примера: реплика прозвучала, «Дальше» доступна (`lessonTiming.modelStepMin`). */
  modelReady: boolean;
};

const initialUi = (): LessonUi => ({
  draft: null,
  phase: 'answer',
  wrong: [],
  listening: [],
  bubble: null,
  speaking: false,
  pose: 'idle',
  pulse: 0,
  marksKey: 0,
  nextReady: false,
  replaying: false,
  exitOpen: false,
  modelReady: false,
});

export function useLessonController(lessonId: string, onFinished: () => void, onLeave: () => void) {
  const { t } = useTranslation();
  const lesson = useMemo(() => lessonById(lessonId), [lessonId]);
  const activeLesson = useChildSession((s) => s.activeLesson);
  const dispatchStore = useChildSession((s) => s.dispatch);
  const [ui, setUi] = useState<LessonUi>(initialUi);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nudge = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uiRef = useRef(ui);
  uiRef.current = ui;

  const state: LessonSessionState | null = activeLesson?.lessonId === lessonId ? activeLesson : null;
  const step: LessonStep | null = state ? lessonStepOf(state) : null;
  const taskStep = step?.kind === 'task' ? (step as TaskStep) : null;
  const task: Task | null = taskStep?.task ?? null;
  const spec: FormatSpec<unknown> | null = task ? (FORMATS[task.format] as FormatSpec<unknown> | undefined) ?? null : null;

  const later = useCallback((ms: number, fn: () => void) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  }, []);
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  const patch = useCallback((p: Partial<LessonUi> | ((u: LessonUi) => Partial<LessonUi>)) => {
    setUi((u) => ({ ...u, ...(typeof p === 'function' ? p(u) : p) }));
  }, []);

  const dispatch = useCallback((e: LessonEvent): LessonStep => lessonStepOf(dispatchStore(e)), [dispatchStore]);

  /** Перечисление с подсветкой (карточки-числа, первое место) — прерывается касанием. */
  const playListening = useCallback(
    (ids: string[]) => {
      ids.forEach((id, i) => later(i * LISTEN_STEP_MS, () => patch({ listening: [id] })));
      later(ids.length * LISTEN_STEP_MS, () => patch({ listening: [] }));
    },
    [later, patch],
  );

  const resetNudge = useCallback(() => {
    if (nudge.current) clearTimeout(nudge.current);
    nudge.current = null;
    const u = uiRef.current;
    if (!spec || !task || !taskStep || u.phase !== 'answer' || u.draft === null || !spec.answerOf(u.draft, task)) return;
    nudge.current = setTimeout(() => patch((x) => ({ pulse: x.pulse + 1, pose: 'point' })), lessonTiming.nudgeAfter);
  }, [spec, task, taskStep, patch]);

  // Новое задание: сброс черновика, перечисление, демо первой встречи.
  const taskKey = task ? `${task.id}:${taskStep?.transferProbe ? 'probe' : ''}:${state?.index}` : step?.kind ?? 'none';
  // Смена задания сбрасывает черновик синхронно, в рендере: касание, пришедшее до эффекта, не
  // должно застать черновик прошлого задания или `null`. Урок, в который вернулись с карты
  // (SCREENS.md 1.6), открывается на той же стадии задания: после показа ждём активный ответ,
  // после верного ответа — «Дальше»; иначе «Проверить» ушло бы в домен не в ожидании ответа.
  const [uiKey, setUiKey] = useState<string | null>(null);
  if (uiKey !== taskKey || (ui.draft === null && task && spec && taskStep)) {
    setUiKey(taskKey);
    setUi(task && spec && taskStep ? resumedUi(spec, task, taskStep, t) : initialUi());
  }
  const lastTaskKey = useRef<string | null>(null);
  useEffect(() => {
    if (lastTaskKey.current === taskKey) return;
    lastTaskKey.current = taskKey;
    clearTimers();
    if (!task || !spec || !taskStep) return;
    if (taskStep.stage !== 'answer') {
      // возврат в задание после показа или итога: вопрос не повторяем, подсветка исправленных гаснет сама
      if (taskStep.stage === 'active_response') later(LISTEN_STEP_MS * 2, () => patch({ listening: [] }));
      return;
    }
    // повторение из чужого урока и проба переноса — сначала связка Tali из банка (ситуации `review-intro`,
    // `probe-intro`; вопрос 71, Ж14), вопрос — следом; в сессии повторения связка уже прозвучала на входе
    const introSituation = taskStep.transferProbe ? 'probe-intro' : taskStep.review && !isReviewSession(state!) ? 'review-intro' : null;
    const intro = introSituation ? companionLine(introSituation, addressForm()) : null;
    if (intro) {
      voice.say(intro);
      patch({ bubble: t(intro), pose: 'point' });
      later(LISTEN_STEP_MS * 2, () => voice.say(task.promptKey));
    } else voice.say(task.promptKey);
    const seq = spec.listeningSequence(task, taskStep);
    if (seq.length) playListening(seq);
    if (taskStep.demo) {
      later(seq.length * LISTEN_STEP_MS + DEMO_DELAY_MS, () => {
        const u = uiRef.current;
        if (u.phase !== 'answer') return;
        const first: FormatTap | null =
          task.format === 'match' ? { kind: 'element', id: (task as Extract<Task, { format: 'match' }>).pairs[0].id, side: 'left' } : task.format === 'order' ? { kind: 'tray', id: (task as Extract<Task, { format: 'order' }>).items[0].id } : null;
        if (!first) return;
        const r = spec.tap(u.draft, first, taskStep);
        if (!r) return;
        // Tali называет, что делает (№35): молчаливо выбранная плитка ребёнку непонятна — ситуация `demo-composite`
        const key = companionLine('demo-composite', addressForm());
        voice.say(key);
        patch({ draft: r.draft, pose: 'point', bubble: t(key) });
        later(DEMO_HOLD_MS, () => patch({ pose: 'idle' }));
      });
    }
  }, [taskKey, clearTimers, later, patch, playListening, spec, task, taskStep, state, t]);

  // Завязка и шаги разобранного примера звучат сами (SCREENS.md 1.1, 1.3); кнопка повтора — та же реплика.
  const stepKey = step?.kind === 'hook' ? 'hook' : step?.kind === 'model' ? `model:${step.step}:${step.nowYou}` : null;
  const modelLineKey = useCallback(
    (s: Extract<LessonStep, { kind: 'model' }>) => {
      const m = lesson?.model;
      return s.nowYou || !m ? 'lesson.nowYou' : m.steps[Math.min(s.step, m.steps.length - 1)].lineKey;
    },
    [lesson],
  );
  const replayHook = useCallback(() => {
    if (!lesson || !step) return;
    if (step.kind === 'hook') voice.say(lesson.hook.lineKey);
    else if (step.kind === 'model') voice.say(modelLineKey(step));
  }, [lesson, step, modelLineKey]);
  // Звучит на смену шага, не на каждый рендер: эффект читает актуальный `replayHook` через ref.
  // Шаг примера: «Дальше» занята, пока реплика не прозвучала (вопрос 61) — иначе пример пролистывается
  // двумя тапами и ничему не учит.
  const replayHookRef = useRef(replayHook);
  replayHookRef.current = replayHook;
  useEffect(() => {
    if (!stepKey) return;
    replayHookRef.current();
    if (!stepKey.startsWith('model:')) return;
    patch({ modelReady: false, bubble: null });
    // «теперь ты» без тапа — через `nudgeAfter` Tali указывает заметнее (напоминание, не ведомый тап №35)
    const nudgeId = stepKey.endsWith(':true') ? setTimeout(() => patch((x) => ({ pulse: x.pulse + 1, pose: 'point' })), lessonTiming.nudgeAfter) : null;
    const id = setTimeout(() => patch({ modelReady: true }), lessonTiming.modelStepMin);
    return () => {
      clearTimeout(id);
      if (nudgeId) clearTimeout(nudgeId);
    };
  }, [stepKey, patch]);

  /** Тап в примере: на «теперь ты» верный вариант завершает пример, любой другой — реплика-подсказка. */
  const onModelTap = useCallback(
    (tap: FormatTap) => {
      if (step?.kind !== 'model' || !step.nowYou || !lesson?.model) return;
      const example = lesson.model.example;
      const correct = example.format === 'choose' ? example.options.find((o) => o.correct)?.id : null;
      if (tap.kind === 'element' && correct && tap.id === correct) {
        dispatch({ type: 'model_done', at: new Date().toISOString() });
        return;
      }
      voice.say('lesson.nowYouTap');
      patch({ bubble: t('lesson.nowYouTap'), pose: 'point' });
    },
    [step, lesson, dispatch, patch, t],
  );

  useEffect(() => () => {
    clearTimers();
    if (nudge.current) clearTimeout(nudge.current);
  }, [clearTimers]);

  const onTouch = useCallback(() => {
    patch({ listening: [] });
    resetNudge();
  }, [patch, resetNudge]);

  /** Подсветка исправленных на время реплики «Покажи, что исправили» (№140). */
  const cueCorrected = useCallback(
    (s: TaskStep) => {
      if (!spec || !task) return;
      patch({ listening: spec.correctedCues(task, s) });
      later(LISTEN_STEP_MS * 2, () => patch({ listening: [] }));
    },
    [spec, task, patch, later],
  );

  const onTap = useCallback(
    (tap: FormatTap) => {
      if (!spec || !task || !taskStep) return;
      const u = uiRef.current;
      if (u.draft === null) return;
      patch({ listening: [] });
      if (u.phase === 'locked') {
        voice.say('lesson.busy');
        return;
      }
      if (u.phase === 'done') return;
      const elementId = tap.kind === 'slot' ? (u.draft as { slots?: (string | null)[] }).slots?.[tap.index] ?? null : tap.id;
      if (u.phase === 'shownWait') {
        if (elementId && spec.correctedOf(task, taskStep).includes(elementId)) {
          const next = dispatch({ type: 'active_response', at: new Date().toISOString() });
          if (next.kind === 'task' && next.stage === 'next') {
            if (task.format === 'choose') patch({ draft: { selected: elementId } });
            patch({ phase: 'done', nextReady: true, pose: 'idle', bubble: t('lesson.thatsHow') });
          }
        } else {
          voice.say('lesson.busy');
        }
        return;
      }
      const r = spec.tap(u.draft, tap, taskStep);
      if (!r) return;
      switch (r.effect) {
        case 'locked':
          voice.say('lesson.pinnedHere');
          return;
        case 'emptyPlace': {
          const slots = (u.draft as { slots: (string | null)[] }).slots;
          const i = tap.kind === 'slot' ? tap.index : 0;
          voice.say(`lesson.place${placeVoice(i, slots.length)[0].toUpperCase()}${placeVoice(i, slots.length).slice(1)}`);
          voice.say('lesson.chooseWhatToPlace');
          return;
        }
        default: {
          const media = elementId ? mediaOf(task, elementId) : null;
          if (media && speaksOnTap(media) && r.effect !== 'repeat') voice.say(media.labelKey);
          patch({ draft: r.draft, pose: 'idle' });
          setTimeout(resetNudge, 0);
        }
      }
    },
    [spec, task, taskStep, patch, dispatch, t, resetNudge],
  );

  const runCheck = useCallback(() => {
    if (!spec || !task || !taskStep) return;
    const u = uiRef.current;
    if (u.draft === null) return;
    const answer = spec.answerOf(u.draft, task);
    if (!answer) {
      voice.say(spec.chooseFirstKey);
      patch({ bubble: t(spec.chooseFirstKey), pose: 'point' });
      return;
    }
    if (nudge.current) clearTimeout(nudge.current);
    const next = dispatch({ type: 'answer', answer, at: new Date().toISOString() });
    if (next.kind !== 'task') return;
    if (next.stage === 'answer' && next.mirrored) {
      // зеркальный ряд на 5-6 (№151): без крестов, собрать заново с первого места
      patch((x) => ({ draft: spec.emptyDraft(task, next as TaskStep), wrong: [], pose: 'point', bubble: t('lesson.orderMirrored'), marksKey: x.marksKey + 1 }));
      voice.say('lesson.orderMirrored');
      playListening(spec.listeningSequence(task, next as TaskStep));
      return;
    }
    if (next.stage === 'next') {
      // реплика на итог — не на каждый верный ответ (`correctSituation`, Ж14): первый верный, третий подряд, со второй попытки
      const before = useChildSession.getState().activeLesson?.played.map((p) => p.attempt) ?? [];
      const situation = correctSituation(before, next.attempt, next.transferProbe);
      const line = situation ? companionLine(situation, addressForm()) : null;
      if (line) voice.say(line);
      patch({ phase: 'done', pose: next.feedback === 'neutral' ? 'idle' : 'cheer', bubble: line ? t(line) : null, nextReady: false });
      later(lessonTiming.nextUnlock, () => patch({ nextReady: true }));
      // ребёнок 5–6 после «верно» может просто ждать: через `nudgeAfter` Tali указывает на «Дальше»
      // (контрольный аудит 2026-11-09, `child-ux-specialist` п. 8)
      later(lessonTiming.nextUnlock + lessonTiming.nudgeAfter, () => patch((x) => (x.phase === 'done' && x.nextReady ? { pulse: x.pulse + 1, pose: 'point' } : {})));
      return;
    }
    const wrong = spec.wrongOf(u.draft, task);
    patch({ phase: 'locked', wrong, pose: 'puzzled', bubble: null });
    if (next.stage === 'active_response') {
      later(SHOW_AFTER_MS, () => {
        patch({ draft: spec.shown(task), phase: 'shownWait', wrong: [], pose: 'point', bubble: task.explainKey?.[0] ? t(task.explainKey[0]) : null, marksKey: uiRef.current.marksKey + 1 });
        voice.say(task.explainKey?.[0] ?? task.promptKey);
        cueCorrected(next as TaskStep);
      });
      return;
    }
    later(UNLOCK_AFTER_MS, () => {
      patch((x) => ({ draft: spec.afterNarrowing(x.draft, task, next as TaskStep), phase: 'answer', wrong: [], pose: 'point', bubble: t(task.hintKey), marksKey: x.marksKey + 1 }));
      voice.say(task.hintKey);
    });
  }, [spec, task, taskStep, patch, dispatch, t, later, playListening, cueCorrected]);

  const action: ActionState = useMemo(() => {
    // пример: «Дальше» по шагам после реплики; на «теперь ты» кнопка пример не завершает (вопрос 61)
    if (step?.kind === 'model') return step.nowYou ? 'checkDisabled' : ui.modelReady ? 'next' : 'busy';
    if (!spec || !task || ui.draft === null) return 'checkDisabled';
    switch (ui.phase) {
      case 'answer':
        return spec.answerOf(ui.draft, task) ? 'check' : 'checkDisabled';
      case 'locked':
        return 'busy';
      case 'shownWait':
        return 'checkDisabled';
      case 'done':
        return ui.nextReady ? 'next' : 'busy';
    }
  }, [step, spec, task, ui.phase, ui.draft, ui.nextReady, ui.modelReady]);

  const onAction = useCallback(() => {
    if (step?.kind === 'hook') {
      dispatch({ type: 'hook_done', at: new Date().toISOString() });
      return;
    }
    if (step?.kind === 'model') {
      if (step.nowYou) {
        // кнопка пример не завершает — только тап по верному варианту (`onModelTap`)
        voice.say('lesson.nowYouTap');
        patch({ bubble: t('lesson.nowYouTap'), pose: 'point' });
        return;
      }
      if (!ui.modelReady) {
        voice.say('lesson.busy');
        return;
      }
      dispatch({ type: 'model_step', at: new Date().toISOString() });
      return;
    }
    switch (action) {
      case 'checkDisabled':
        if (ui.phase === 'shownWait') {
          const key = task?.format === 'choose' ? 'lesson.chooseFirst' : 'lesson.tapCorrectedFirst';
          voice.say(key);
          patch({ bubble: t(key), pose: 'point' });
          if (taskStep) cueCorrected(taskStep);
        } else runCheck();
        return;
      case 'check':
        runCheck();
        return;
      case 'busy':
        voice.say('lesson.busy');
        return;
      case 'next': {
        const next = dispatch({ type: 'next', at: new Date().toISOString() });
        if (next.kind === 'done') onFinished();
      }
    }
  }, [step, action, ui.phase, ui.modelReady, task, taskStep, dispatch, patch, runCheck, t, onFinished, cueCorrected]);

  const replayPrompt = useCallback(() => {
    if (!task || !spec || !taskStep) return;
    voice.say(task.promptKey);
    patch({ replaying: true });
    later(LISTEN_STEP_MS * 2, () => patch({ replaying: false }));
    // после показа повтор повторяет и подсветку исправленных (№140)
    if (uiRef.current.phase === 'shownWait') {
      cueCorrected(taskStep);
      return;
    }
    const seq = spec.listeningSequence(task, taskStep);
    if (seq.length) playListening(seq);
  }, [task, spec, taskStep, patch, later, playListening, cueCorrected]);

  const onTali = useCallback(() => {
    if (ui.bubble) {
      voice.say(ui.bubble);
      patch({ speaking: true });
      later(LISTEN_STEP_MS, () => patch({ speaking: false }));
      if (ui.phase === 'shownWait' && taskStep) cueCorrected(taskStep);
    } else replayPrompt();
  }, [ui.bubble, ui.phase, taskStep, patch, later, replayPrompt, cueCorrected]);

  const openExit = useCallback(() => patch({ exitOpen: true }), [patch]);
  const stay = useCallback(() => patch({ exitOpen: false }), [patch]);
  // Системная «назад» на Android (кнопка, свайп от края) — не выход на карту мимо подтверждения, а слой выхода:
  // иначе урок оставался в `activeLesson`, а ребёнок выпадал из пути (контрольный аудит 2026-11-09, Ж7).
  // При открытом слое «назад» перехватывает сам `ExitLayer` («остаться»).
  const stepKind = step?.kind;
  useEffect(() => {
    // только на шагах урока: на «Повторили!» и при загрузке слоя выхода нет, и нажатие пропадало бы без отклика
    if (ui.exitOpen || (stepKind !== 'hook' && stepKind !== 'model' && stepKind !== 'task')) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      openExit();
      return true;
    });
    return () => sub.remove();
  }, [ui.exitOpen, stepKind, openExit]);
  const leave = useCallback(() => {
    clearTimers();
    useChildSession.getState().leaveLesson();
    patch({ exitOpen: false });
    onLeave();
  }, [clearTimers, patch, onLeave]);

  return { lesson, state, step, taskStep, task, spec, ui, action, onTap, onModelTap, onTouch, onAction, onTali, replayPrompt, replayHook, openExit, stay, leave, t };
}

/** Экран задания по его стадии в домене — при открытии и при возврате в урок (SCREENS.md 1.6). */
function resumedUi(spec: FormatSpec<unknown>, task: Task, step: TaskStep, t: (key: string) => string): LessonUi {
  const fresh = initialUi();
  switch (step.stage) {
    case 'active_response':
      return { ...fresh, draft: spec.shown(task), phase: 'shownWait', pose: 'point', bubble: task.explainKey?.[0] ? t(task.explainKey[0]) : null, listening: spec.correctedCues(task, step) };
    case 'next':
      return { ...fresh, draft: spec.shown(task), phase: 'done', nextReady: true };
    case 'answer':
      return { ...fresh, draft: step.attempt === 'second' ? spec.afterNarrowing(spec.emptyDraft(task, step), task, step) : spec.emptyDraft(task, step) };
  }
}

function mediaOf(task: Task, id: string) {
  switch (task.format) {
    case 'choose':
      return task.options.find((o) => o.id === id) ?? null;
    case 'match': {
      const p = task.pairs.find((x) => x.id === id);
      return p ? p.left : null;
    }
    case 'order':
      return task.items.find((i) => i.id === id) ?? null;
    default:
      return null;
  }
}
