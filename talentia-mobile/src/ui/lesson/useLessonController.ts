/**
 * Контроллер экрана урока: связывает оркестратор (`state/childSession` → `lessonStepOf`) с черновиком
 * формата и таймлайном экрана (SCREENS.md 1.5, 2.4): «Проверить» → блокировка 0…1040 с крестами →
 * сужение с подсказкой или показ с активным ответом → «Дальше» (после верного — через 900).
 * Голос — `voice.say` (в срезе молчит), поза Tali и пузырь — по разделу 5.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { TaliPose } from '../../assets/registry';
import { lessonTiming } from '../../design/tokens';
import { lessonById } from '../../content';
import { lessonStepOf, type LessonEvent, type LessonSessionState, type LessonStep } from '../../domain/lessonSession';
import { placeVoice } from '../../domain/taskDraft';
import { voice } from '../../services/voice';
import { useChildSession } from '../../state/childSession';
import type { Task } from '../../types/task';
import { FORMATS } from './formats';
import type { FormatPhase, FormatSpec, FormatTap, TaskStep } from './formats/types';
import type { ActionState } from './LessonChrome';
import { speaksOnTap } from './MediaContent';

export const LISTEN_STEP_MS = 700;
export const DEMO_DELAY_MS = 600;
export const DEMO_HOLD_MS = 1200;
export const SHOW_AFTER_MS = 820;
export const UNLOCK_AFTER_MS = 1040;

export type LessonUi = {
  draft: unknown;
  phase: FormatPhase;
  wrong: string[];
  listening: string | null;
  bubble: string | null;
  speaking: boolean;
  pose: TaliPose;
  pulse: number;
  marksKey: number;
  nextReady: boolean;
  replaying: boolean;
  exitOpen: boolean;
};

const initialUi = (): LessonUi => ({
  draft: null,
  phase: 'answer',
  wrong: [],
  listening: null,
  bubble: null,
  speaking: false,
  pose: 'idle',
  pulse: 0,
  marksKey: 0,
  nextReady: false,
  replaying: false,
  exitOpen: false,
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
      ids.forEach((id, i) => later(i * LISTEN_STEP_MS, () => patch({ listening: id })));
      later(ids.length * LISTEN_STEP_MS, () => patch({ listening: null }));
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
  // должно застать черновик прошлого задания или `null`.
  const [uiKey, setUiKey] = useState<string | null>(null);
  if (uiKey !== taskKey || (ui.draft === null && task && spec && taskStep)) {
    setUiKey(taskKey);
    const fresh = initialUi();
    setUi(task && spec && taskStep ? { ...fresh, draft: spec.emptyDraft(task, taskStep) } : fresh);
  }
  const lastTaskKey = useRef<string | null>(null);
  useEffect(() => {
    if (lastTaskKey.current === taskKey) return;
    lastTaskKey.current = taskKey;
    clearTimers();
    if (!task || !spec || !taskStep) return;
    voice.say(task.promptKey);
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
        if (r) patch({ draft: r.draft, pose: 'point' });
        later(DEMO_HOLD_MS, () => patch({ pose: 'idle' }));
      });
    }
  }, [taskKey, clearTimers, later, patch, playListening, spec, task, taskStep]);

  useEffect(() => () => {
    clearTimers();
    if (nudge.current) clearTimeout(nudge.current);
  }, [clearTimers]);

  const onTouch = useCallback(() => {
    patch({ listening: null });
    resetNudge();
  }, [patch, resetNudge]);

  const onTap = useCallback(
    (tap: FormatTap) => {
      if (!spec || !task || !taskStep) return;
      const u = uiRef.current;
      if (u.draft === null) return;
      patch({ listening: null });
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
      patch({ phase: 'done', pose: next.feedback === 'neutral' ? 'idle' : 'cheer', bubble: null, nextReady: false });
      later(lessonTiming.nextUnlock, () => patch({ nextReady: true }));
      return;
    }
    const wrong = spec.wrongOf(u.draft, task);
    patch({ phase: 'locked', wrong, pose: 'puzzled', bubble: null });
    if (next.stage === 'active_response') {
      later(SHOW_AFTER_MS, () => {
        patch({ draft: spec.shown(task), phase: 'shownWait', wrong: [], pose: 'point', bubble: task.explainKey?.[0] ? t(task.explainKey[0]) : null, marksKey: uiRef.current.marksKey + 1 });
        voice.say(task.explainKey?.[0] ?? task.promptKey);
      });
      return;
    }
    later(UNLOCK_AFTER_MS, () => {
      patch((x) => ({ draft: spec.afterNarrowing(x.draft, task, next as TaskStep), phase: 'answer', wrong: [], pose: 'point', bubble: t(task.hintKey), marksKey: x.marksKey + 1 }));
      voice.say(task.hintKey);
    });
  }, [spec, task, taskStep, patch, dispatch, t, later, playListening]);

  const action: ActionState = useMemo(() => {
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
  }, [spec, task, ui.phase, ui.draft, ui.nextReady]);

  const onAction = useCallback(() => {
    if (step?.kind === 'hook') {
      dispatch({ type: 'hook_done', at: new Date().toISOString() });
      return;
    }
    if (step?.kind === 'model') {
      dispatch({ type: step.nowYou ? 'model_done' : 'model_step', at: new Date().toISOString() });
      return;
    }
    switch (action) {
      case 'checkDisabled':
        if (ui.phase === 'shownWait') {
          const key = task?.format === 'choose' ? 'lesson.chooseFirst' : 'lesson.tapCorrectedFirst';
          voice.say(key);
          patch({ bubble: t(key), pose: 'point' });
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
  }, [step, action, ui.phase, task, dispatch, patch, runCheck, t, onFinished]);

  const replayPrompt = useCallback(() => {
    if (!task || !spec || !taskStep) return;
    voice.say(task.promptKey);
    patch({ replaying: true });
    later(LISTEN_STEP_MS * 2, () => patch({ replaying: false }));
    const seq = spec.listeningSequence(task, taskStep);
    if (seq.length) playListening(seq);
  }, [task, spec, taskStep, patch, later, playListening]);

  const onTali = useCallback(() => {
    if (ui.bubble) {
      voice.say(ui.bubble);
      patch({ speaking: true });
      later(LISTEN_STEP_MS, () => patch({ speaking: false }));
    } else replayPrompt();
  }, [ui.bubble, patch, later, replayPrompt]);

  const openExit = useCallback(() => patch({ exitOpen: true }), [patch]);
  const stay = useCallback(() => patch({ exitOpen: false }), [patch]);
  const leave = useCallback(() => {
    clearTimers();
    useChildSession.getState().leaveLesson();
    patch({ exitOpen: false });
    onLeave();
  }, [clearTimers, patch, onLeave]);

  return { lesson, state, step, taskStep, task, spec, ui, action, onTap, onTouch, onAction, onTali, replayPrompt, openExit, stay, leave, t };
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
