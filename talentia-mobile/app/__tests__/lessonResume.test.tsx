/**
 * Экран урока: возврат на той же стадии задания (SCREENS.md 1.6; дефект — контроллер стартовал с `answer`,
 * и «Проверить» после возврата в `active_response` / `next` роняло домен), подсветка исправленных после
 * показа (№140), голос завязки и шагов примера, реплика к демо первой встречи с `match` / `order` (№35).
 *
 * Урок живёт в `useChildSession().activeLesson` и при размонтировании экрана не сбрасывается — возврат
 * с карты моделируется `unmount` + повторным `render`. Таймлайн — в реальном времени, как в lesson.test.tsx:
 * фиктивные таймеры Jest вешают `render` RNTL 14.
 */
import LessonScreen from '../lesson/[lessonId]';
import { lessonById, regionLessons } from '../../src/content';
import { lessonTiming } from '../../src/design/tokens';
import type { LessonAnswer } from '../../src/domain/lessonSession';
import { emptySkill } from '../../src/domain/mastery';
import i18n from '../../src/i18n';
import { voice } from '../../src/services/voice';
import { useChildSession } from '../../src/state/childSession';
import { DEMO_DELAY_MS, DEMO_HOLD_MS, LISTEN_STEP_MS, SHOW_AFTER_MS, UNLOCK_AFTER_MS } from '../../src/ui/lesson/useLessonController';
import { act, fireEvent, renderWithProviders, screen, waitFor } from '../../src/test/render';
import type { ChooseTask, MatchTask, OrderTask, Task } from '../../src/types/task';

// экран урока на реальных таймерах контроллера: тест «подсветка исправленных» под нагрузкой всего набора шёл дольше
// общего testTimeout (15 с) — прогон 2026-11-10, этап F3; файлу — прежний запас
jest.setTimeout(60_000);

/** Реплика из банка Tali (Ж14): любой из четырёх вариантов ситуации, родовой надстройки при форме «не указывать» нет. */
const bank = (situation: string) => new RegExp(`^companion\\.${situation}\\.[0-3]$`);

let mockLessonId = 'nv-count-l1';
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), navigate: jest.fn() };
  return {
    __router: router,
    useRouter: () => router,
    useLocalSearchParams: () => ({ lessonId: mockLessonId }),
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
  };
});

const NOW = new Date('2026-10-24T10:00:00.000Z');
const KID = '00000000-0000-4000-8000-000000000004';
const lesson = regionLessons('numbers')[0];
const HIDDEN = { includeHiddenElements: true };

const start = () => useChildSession.getState().startNoRecordSession({ childId: KID, now: NOW, interfaceLang: 'ru' });
const press = (id: string) => fireEvent.press(screen.getByTestId(id));
/** Кнопки каркаса защищены от двойного тапа (`guardMs` = `motion.slow`): между нажатиями — пауза. */
const pressAction = async (id: string) => {
  if (id === 'lesson-action-next' && screen.queryByTestId('lesson-action-busy') !== null) await new Promise((r) => setTimeout(r, lessonTiming.modelStepMin + 50));
  await press(id);
  await new Promise((r) => setTimeout(r, 380));
};
const actionId = () => screen.getAllByTestId(/^lesson-action-(checkDisabled|check|busy|next)$/)[0].props.testID as string;
const advance = async (ms: number) => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms + 30));
  });
};
/** Ход текущего задания (`TaskProgress`: stage, attempt, demo) и само задание из очереди. */
const activeTask = () => useChildSession.getState().activeLesson!.task!;
const currentTask = () => {
  const s = useChildSession.getState().activeLesson!;
  return s.queue[s.index].task;
};

/** Завязка и разобранный пример до первого задания. */
async function throughIntro() {
  await pressAction('hook-help');
  for (let i = 0; i < 6 && screen.queryByText('Теперь ты') === null; i++) await pressAction('lesson-action-next');
  const correct = (lesson.model!.example as ChooseTask).options.find((o) => o.correct)!.id;
  await press(`option-${correct}`);
}

const firstTask = () => useChildSession.getState().activeLesson!.queue[0].task as ChooseTask;
const wrongIds = (t: ChooseTask) => t.options.filter((o) => !o.correct).map((o) => o.id);
const correctId = (t: ChooseTask) => t.options.find((o) => o.correct)!.id;

/** Первое задание доведено до показа: две ошибки → `shownWait`, домен в `active_response`. */
async function toShown() {
  await throughIntro();
  const t = firstTask();
  const [w1, w2] = wrongIds(t);
  await press(`option-${w1}`);
  await pressAction('lesson-action-check');
  await advance(UNLOCK_AFTER_MS);
  await press(`option-${w2}`);
  await pressAction('lesson-action-check');
  await advance(SHOW_AFTER_MS);
  expect(activeTask().stage).toBe('active_response');
}

beforeEach(() => {
  mockLessonId = 'nv-count-l1';
  voice.stop();
  useChildSession.getState().reset();
  start();
});

describe('возврат в урок на той же стадии', () => {
  it('после показа: экран в shownWait — действие недоступно и говорит «Сначала выбери», тап по показанному даёт «Дальше», без исключения', async () => {
    const first = await renderWithProviders(<LessonScreen />);
    await toShown();
    const t = firstTask();
    await act(async () => first.unmount());

    voice.stop();
    await renderWithProviders(<LessonScreen />);
    expect(screen.getByTestId(`option-${correctId(t)}-badge-triangle`)).toBeTruthy();
    expect(actionId()).toBe('lesson-action-checkDisabled');
    // вопрос после показа не повторяется — при возврате звучит только «Продолжим?» (ситуация lesson-resume)
    expect(voice.last?.key).toMatch(bank('lesson-resume'));
    await pressAction('lesson-action-checkDisabled');
    expect(voice.last?.key).toBe('lesson.chooseFirst');
    expect(activeTask().stage).toBe('active_response');
    await press(`option-${correctId(t)}`);
    expect(actionId()).toBe('lesson-action-next');
    expect(screen.getByText('Вот так')).toBeTruthy();
    expect(activeTask().stage).toBe('next');
  });

  it('после показа: при возврате исправленный вариант подсвечен и гаснет через LISTEN_STEP_MS * 2', async () => {
    const first = await renderWithProviders(<LessonScreen />);
    await toShown();
    const t = firstTask();
    await act(async () => first.unmount());

    await renderWithProviders(<LessonScreen />);
    expect(screen.getByTestId(`option-${correctId(t)}-listening`)).toBeTruthy();
    await advance(LISTEN_STEP_MS * 2);
    expect(screen.queryByTestId(`option-${correctId(t)}-listening`)).toBeNull();
  });

  it('после верного ответа (стадия next до «Дальше»): «Дальше» доступна сразу, нажатие ведёт к следующему заданию', async () => {
    const first = await renderWithProviders(<LessonScreen />);
    await throughIntro();
    const t = firstTask();
    await press(`option-${correctId(t)}`);
    await pressAction('lesson-action-check');
    expect(activeTask().stage).toBe('next');
    // уходим раньше, чем «Дальше» разблокировалась бы по таймеру 900
    await act(async () => first.unmount());

    await renderWithProviders(<LessonScreen />);
    expect(actionId()).toBe('lesson-action-next');
    await pressAction('lesson-action-next');
    expect(useChildSession.getState().activeLesson!.index).toBe(1);
    expect(screen.getByTestId('task-match')).toBeTruthy();
  });

  it('после первой ошибки (answer, attempt second): снятый вариант недоступен, вопрос звучит заново', async () => {
    const first = await renderWithProviders(<LessonScreen />);
    await throughIntro();
    const t = firstTask();
    const [w1] = wrongIds(t);
    await press(`option-${w1}`);
    await pressAction('lesson-action-check');
    await advance(UNLOCK_AFTER_MS);
    expect(activeTask().attempt).toBe('second');
    await act(async () => first.unmount());

    voice.stop();
    await renderWithProviders(<LessonScreen />);
    expect(voice.last?.key).toBe(t.promptKey);
    expect(screen.getByTestId(`option-${w1}-face`, HIDDEN)).toHaveStyle({ borderStyle: 'dashed' });
    expect(actionId()).toBe('lesson-action-checkDisabled');
    // тап по снятому ничего не выбирает — «Проверить» остаётся недоступной
    await fireEvent.press(screen.getByTestId(`option-${w1}`, HIDDEN));
    expect(actionId()).toBe('lesson-action-checkDisabled');
    expect(activeTask().stage).toBe('answer');
    // верный по-прежнему выбирается и проверяется — домен не падает
    await press(`option-${correctId(t)}`);
    expect(actionId()).toBe('lesson-action-check');
    await pressAction('lesson-action-check');
    expect(activeTask().stage).toBe('next');
  });
});

describe('голос завязки и примера', () => {
  it('при открытии звучит завязка; «повторить» и тап по Tali повторяют её', async () => {
    await renderWithProviders(<LessonScreen />);
    expect(voice.last?.key).toBe(lesson.hook.lineKey);
    voice.stop();
    await press('hook-replay');
    expect(voice.last?.key).toBe(lesson.hook.lineKey);
    voice.stop();
    await press('hook-tali-press');
    expect(voice.last?.key).toBe(lesson.hook.lineKey);
  });

  it('на шагах примера звучит реплика шага, на «теперь ты» — lesson.nowYou', async () => {
    await renderWithProviders(<LessonScreen />);
    const steps = lesson.model!.steps;
    await pressAction('hook-help');
    expect(voice.last?.key).toBe(steps[0].lineKey);
    for (let i = 1; i < steps.length; i++) {
      await pressAction('lesson-action-next');
      expect(voice.last?.key).toBe(steps[i].lineKey);
    }
    await pressAction('lesson-action-next');
    expect(screen.getByText('Теперь ты')).toBeTruthy();
    expect(voice.last?.key).toBe('lesson.nowYou');
  });
});

describe('реплика к демо первой встречи (№35)', () => {
  it('match: после DEMO_DELAY_MS звучит реплика demo-composite, тот же текст в пузыре, первая плитка выбрана', async () => {
    await renderWithProviders(<LessonScreen />);
    await throughIntro();
    const t = firstTask();
    await press(`option-${correctId(t)}`);
    await pressAction('lesson-action-check');
    await advance(lessonTiming.nextUnlock);
    // Вопрос звучит DEMO_DELAY_MS реального времени, потом его сменяет демо: проверяем сразу, без паузы `pressAction`.
    await press('lesson-action-next');
    const match = useChildSession.getState().activeLesson!.queue[1].task as MatchTask;
    expect(activeTask().demo).toBe(true);
    expect(voice.last?.key).toBe(match.promptKey);
    // у пар с точками перечисления нет — демо через DEMO_DELAY_MS от открытия
    await advance(DEMO_DELAY_MS);
    expect(voice.last?.key).toMatch(bank('demo-composite'));
    expect(screen.getByText(i18n.t(voice.last!.key))).toBeTruthy();
    expect(screen.getByTestId(`left-${match.pairs[0].id}`)).toBeSelected();
    // поза «указывает» держится DEMO_HOLD_MS — дождаться, чтобы таймер не стрелял после теста
    await advance(DEMO_HOLD_MS);
  });

  it('order: после перечисления первого места и DEMO_DELAY_MS звучит реплика demo-composite, тот же текст в пузыре', async () => {
    // урок 2: до `order` — две `choose`; проходим их в сторе, экран открывается уже на `order`
    mockLessonId = 'nv-count-l2';
    const s = useChildSession.getState();
    s.openLesson({ lessonId: 'nv-count-l2', now: NOW, seed: 7, nodeState: 'open' });
    const at = NOW.toISOString();
    s.dispatch({ type: 'hook_done', at });
    s.dispatch({ type: 'model_done', at });
    while (currentTask().format !== 'order') {
      const task = currentTask() as ChooseTask;
      s.dispatch({ type: 'answer', answer: { format: 'choose', optionId: correctId(task) }, at });
      s.dispatch({ type: 'next', at });
    }
    const order = currentTask() as OrderTask;
    expect(lessonById('nv-count-l2')!.tasks.some((t) => t.id === order.id)).toBe(true);
    expect(activeTask().demo).toBe(true);

    await renderWithProviders(<LessonScreen />);
    expect(screen.getByTestId('task-order')).toBeTruthy();
    expect(voice.last?.key).toBe(order.promptKey);
    await advance(LISTEN_STEP_MS + DEMO_DELAY_MS);
    expect(voice.last?.key).toMatch(bank('demo-composite'));
    expect(screen.getByText(i18n.t(voice.last!.key))).toBeTruthy();
  });
});

describe('подсветка исправленных после показа (№140)', () => {
  /** `match` второго задания: три пары, все неверно → сужение с закреплением; снова неверно → показ. */
  async function matchToShown() {
    await throughIntro();
    const t = firstTask();
    await press(`option-${correctId(t)}`);
    await pressAction('lesson-action-check');
    await advance(lessonTiming.nextUnlock);
    await pressAction('lesson-action-next');
    const match = useChildSession.getState().activeLesson!.queue[1].task as MatchTask;
    const [p1, p2, p3] = match.pairs.map((p) => p.id);
    // демо выбрало левую первую и отпустило позу — дальше касания идут по известному черновику
    await advance(DEMO_DELAY_MS + DEMO_HOLD_MS);
    expect(screen.getByTestId(`left-${p1}`)).toBeSelected();
    await press(`right-${p1}`);
    await press(`left-${p2}`);
    await press(`right-${p3}`);
    await press(`left-${p3}`);
    await press(`right-${p2}`);
    await pressAction('lesson-action-check');
    await advance(UNLOCK_AFTER_MS);
    // две неверных → сужение без закрепления: p1 остаётся (kept), p2 и p3 сняты
    expect(activeTask().stage).toBe('answer');
    expect(activeTask().attempt).toBe('second');
    await press(`left-${p2}`);
    await press(`right-${p3}`);
    await press(`left-${p3}`);
    await press(`right-${p2}`);
    // Подсветка живёт LISTEN_STEP_MS * 2 реального времени от показа: ждём сам показ, а не паузу с запасом.
    // Пауза кончалась на ≈ 400 мс позже показа, и занятый воркер приходил к уже погасшей подсветке.
    await press('lesson-action-check');
    await waitFor(() => expect(screen.queryAllByTestId(/-listening$/, HIDDEN).length).toBeGreaterThan(0), { timeout: 5000 });
    expect(activeTask().stage).toBe('active_response');
    const step = useChildSession.getState().activeLesson!;
    expect(step.task!.narrowing).toEqual({ kind: 'narrow', pin: false });
    return { p1, p2, p3 };
  }

  const lit = (id: string) => screen.queryByTestId(id, HIDDEN) !== null;

  it('после показа светятся обе карточки исправленных пар, оставшаяся верной (kept) — нет; гаснут через LISTEN_STEP_MS * 2', async () => {
    await renderWithProviders(<LessonScreen />);
    const { p1, p2, p3 } = await matchToShown();
    for (const id of [p2, p3]) {
      expect(lit(`left-${id}-listening`)).toBe(true);
      expect(lit(`right-${id}-listening`)).toBe(true);
    }
    expect(lit(`left-${p1}-listening`)).toBe(false);
    expect(lit(`right-${p1}-listening`)).toBe(false);
    await advance(LISTEN_STEP_MS * 2);
    expect(screen.queryAllByTestId(/-listening$/, HIDDEN)).toHaveLength(0);
  });

  it('повтор вопроса и тап по Tali с пузырём снова зажигают исправленные', async () => {
    await renderWithProviders(<LessonScreen />);
    const { p2 } = await matchToShown();
    await advance(LISTEN_STEP_MS * 2);
    expect(screen.queryAllByTestId(/-listening$/, HIDDEN)).toHaveLength(0);

    await press('lesson-replay');
    expect(lit(`left-${p2}-listening`)).toBe(true);
    await advance(LISTEN_STEP_MS * 2);
    expect(screen.queryAllByTestId(/-listening$/, HIDDEN)).toHaveLength(0);

    // в shownWait пузырь — объяснение; тап по Tali озвучивает его и подсвечивает исправленные
    expect(screen.getByTestId('lesson-bubble-body')).toBeTruthy();
    await press('lesson-tali-press');
    expect(lit(`left-${p2}-listening`)).toBe(true);
    await advance(LISTEN_STEP_MS * 2);
    expect(screen.queryAllByTestId(/-listening$/, HIDDEN)).toHaveLength(0);

    // недоступное действие тоже: «Сначала покажи, что исправили» + подсветка
    await press('lesson-action-checkDisabled');
    expect(voice.last?.key).toBe('lesson.tapCorrectedFirst');
    expect(lit(`left-${p2}-listening`)).toBe(true);
  });
});

/* ------------------------------------------------------------------------ */
/* Связки Tali перед заданием (разбор 2026-10-31, вопрос 71; этап E)          */
/* ------------------------------------------------------------------------ */

/** Верный ответ на задание в формате домена — чтобы провести урок в сторе до нужного места. */
function correctAnswer(task: Task): LessonAnswer {
  switch (task.format) {
    case 'choose':
      return { format: 'choose', optionId: correctId(task) };
    case 'order':
      return { format: 'order', slots: [...task.items].sort((a, b) => a.position - b.position).map((i) => i.id) };
    case 'match':
      return { format: 'match', pairs: task.pairs.map((p) => ({ left: p.id, right: p.id })) };
    case 'point':
      return { format: 'point', targetId: task.targets.find((x) => x.correct)!.id };
    default:
      throw new Error(`correctAnswer: формат ${task.format} в этих уроках не ждём`);
  }
}

/** Задания до индекса `upTo` отвечены верно и закрыты «Дальше»; задание `upTo - 1` остановлено на стадии `next`. */
function playUntil(upTo: number) {
  const s = useChildSession.getState();
  const at = NOW.toISOString();
  for (let i = 0; i < upTo; i++) {
    expect(useChildSession.getState().activeLesson!.index).toBe(i);
    s.dispatch({ type: 'answer', answer: correctAnswer(currentTask()), at });
    if (i < upTo - 1) s.dispatch({ type: 'next', at });
  }
  expect(activeTask().stage).toBe('next');
}

describe('связки Tali перед заданием (вопрос 71)', () => {
  let say: jest.SpyInstance;
  beforeEach(() => {
    say = jest.spyOn(voice, 'say');
  });
  afterEach(() => {
    say.mockRestore();
  });
  const keys = () => say.mock.calls.map((c) => c[0] as string);

  it('повторение из прошлого урока внутри урока: реплика review-intro голосом и в пузыре, вопрос — через LISTEN_STEP_MS * 2', async () => {
    // урок 1 пройден, его навык виден на уроке 0; к уроку 3 (счётчик 2) зазор 2 ≥ REVIEW_GAP коробки 1 — в срок.
    // Составные форматы уже встречены: иначе демо `match` перебило бы вопрос повторения.
    mockLessonId = 'nv-count-l3';
    const first = lessonById('nv-count-l1')!;
    const skill = first.tasks[0].skill;
    const s = useChildSession.getState();
    useChildSession.setState({
      progress: {
        skills: [{ ...emptySkill(skill), lastSeenLesson: 0, lastSeenDay: '2026-10-23', attempts: 4, correct: 4 }],
        atlas: [{ lessonId: first.id, atlasEntryKey: first.atlasEntryKey, stars: 3, firstLesson: 0 }],
        lessonCounter: 2,
        formatsSeen: ['match', 'order', 'group'],
      },
    });
    s.openLesson({ lessonId: 'nv-count-l3', now: NOW, seed: 7, nodeState: 'open' });
    const queue = useChildSession.getState().activeLesson!.queue;
    const ri = queue.findIndex((q) => q.review);
    expect(ri).toBeGreaterThan(0);
    expect(ri).toBeLessThan(queue.length - 1);
    const reviewTask = queue[ri].task;
    expect(reviewTask.skill).toBe(skill);
    expect(first.tasks.some((t) => t.id === reviewTask.id)).toBe(true);

    const at = NOW.toISOString();
    s.dispatch({ type: 'hook_done', at });
    s.dispatch({ type: 'model_done', at });
    playUntil(ri);

    await renderWithProviders(<LessonScreen />);
    expect(actionId()).toBe('lesson-action-next');
    say.mockClear();
    await pressAction('lesson-action-next');
    expect(useChildSession.getState().activeLesson!.index).toBe(ri);
    expect(keys()).toEqual([expect.stringMatching(bank('review-intro'))]);
    expect(screen.getByText(i18n.t(keys()[0]))).toBeTruthy();
    expect(screen.getByTestId('lesson-bubble-body')).toBeTruthy();
    await advance(LISTEN_STEP_MS * 2 - 380);
    expect(keys()).toEqual([expect.stringMatching(bank('review-intro')), reviewTask.promptKey]);
  });

  it('обычное задание урока связки не получает: сразу вопрос', async () => {
    const s = useChildSession.getState();
    s.openLesson({ lessonId: 'nv-count-l1', now: NOW, seed: 7, nodeState: 'open' });
    const at = NOW.toISOString();
    s.dispatch({ type: 'hook_done', at });
    s.dispatch({ type: 'model_done', at });
    playUntil(1);
    expect(useChildSession.getState().activeLesson!.queue[1].review).toBeUndefined();

    await renderWithProviders(<LessonScreen />);
    say.mockClear();
    await pressAction('lesson-action-next');
    expect(keys()[0]).toBe(currentTask().promptKey);
    expect(keys().filter((k) => /^companion\.(review|probe)-intro\./.test(k))).toEqual([]);
  });

  it('проба переноса: реплика probe-intro голосом и в пузыре, вопрос — через LISTEN_STEP_MS * 2', async () => {
    const s = useChildSession.getState();
    s.openLesson({ lessonId: 'nv-count-l1', now: NOW, seed: 7, nodeState: 'open' });
    const at = NOW.toISOString();
    s.dispatch({ type: 'hook_done', at });
    s.dispatch({ type: 'model_done', at });
    // две ошибки на первом задании → показ → отклик → «Дальше» ставит пробу через два задания
    const t1 = currentTask() as ChooseTask;
    const [w1, w2] = wrongIds(t1);
    s.dispatch({ type: 'answer', answer: { format: 'choose', optionId: w1 }, at });
    s.dispatch({ type: 'answer', answer: { format: 'choose', optionId: w2 }, at });
    expect(activeTask().stage).toBe('active_response');
    s.dispatch({ type: 'active_response', at });
    s.dispatch({ type: 'next', at });
    const queue = useChildSession.getState().activeLesson!.queue;
    const pi = queue.findIndex((q) => q.transferProbe);
    expect(pi).toBe(3);
    expect(queue[pi].task.promptKey).toBe(t1.promptKey);
    // задания между показом и пробой — верно
    for (let i = 1; i < pi; i++) {
      s.dispatch({ type: 'answer', answer: correctAnswer(currentTask()), at });
      if (i < pi - 1) s.dispatch({ type: 'next', at });
    }
    expect(activeTask().stage).toBe('next');

    await renderWithProviders(<LessonScreen />);
    say.mockClear();
    await pressAction('lesson-action-next');
    expect(useChildSession.getState().activeLesson!.index).toBe(pi);
    expect(keys()).toEqual([expect.stringMatching(bank('probe-intro'))]);
    expect(screen.getByText(i18n.t(keys()[0]))).toBeTruthy();
    await advance(LISTEN_STEP_MS * 2 - 380);
    expect(keys()).toEqual([expect.stringMatching(bank('probe-intro')), t1.promptKey]);
  });

  it('возврат в урок на стадии answer: сначала реплика lesson-resume («Продолжим?»), затем вопрос задания', async () => {
    const first = await renderWithProviders(<LessonScreen />);
    await throughIntro();
    const t = firstTask();
    expect(activeTask().stage).toBe('answer');
    await act(async () => first.unmount());

    say.mockClear();
    await renderWithProviders(<LessonScreen />);
    expect(keys()).toEqual([expect.stringMatching(bank('lesson-resume')), t.promptKey]);
    expect(actionId()).toBe('lesson-action-checkDisabled');
    expect(activeTask().stage).toBe('answer');
  });

  it('первое открытие урока — без «Продолжим?»', async () => {
    await renderWithProviders(<LessonScreen />);
    expect(keys().filter((k) => k.startsWith('companion.lesson-resume.'))).toEqual([]);
    expect(keys()[0]).toBe(lesson.hook.lineKey);
  });
});
