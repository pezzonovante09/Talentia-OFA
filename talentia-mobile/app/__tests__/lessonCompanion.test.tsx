/**
 * Реплика Tali на итог задания на экране урока (этап D5 по аудиту 2026-11-09, Ж14): `correctSituation` →
 * `companionLine` → голос и пузырь. Не на каждый верный ответ: первый верный урока, со второй попытки, ровно третий
 * подряд с первой; после показа ответа и на втором подряд — без реплики банка. Форма обращения — из профиля ребёнка.
 *
 * Таймлайн — в реальном времени, как в lessonResume.test.tsx: фиктивные таймеры Jest вешают `render` RNTL 14.
 */
import LessonScreen from '../lesson/[lessonId]';
import { regionLessons } from '../../src/content';
import type { LessonAnswer } from '../../src/domain/lessonSession';
import i18n from '../../src/i18n';
import { newProfile } from '../../src/services/local/profiles';
import { EMPTY_PROGRESS } from '../../src/services/progressPort';
import { voice } from '../../src/services/voice';
import { useChildSession } from '../../src/state/childSession';
import { SHOW_AFTER_MS, UNLOCK_AFTER_MS } from '../../src/ui/lesson/useLessonController';
import { act, fireEvent, renderWithProviders, screen } from '../../src/test/render';
import type { ChooseTask, Task } from '../../src/types/task';

/** Реплика из банка Tali: любой из четырёх вариантов ситуации, без родовой надстройки. */
const bank = (situation: string) => new RegExp(`^companion\\.${situation}\\.[0-3]$`);

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), navigate: jest.fn() };
  return {
    __router: router,
    useRouter: () => router,
    useLocalSearchParams: () => ({ lessonId: 'nv-count-l1' }),
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
  };
});

const NOW = new Date('2026-10-24T10:00:00.000Z');
const KID = '00000000-0000-4000-8000-000000000005';
const lesson = regionLessons('numbers')[0];

const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const pressAction = async (id: string) => {
  await press(id);
  await new Promise((r) => setTimeout(r, 380));
};
const advance = async (ms: number) => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms + 30));
  });
};
const activeTask = () => useChildSession.getState().activeLesson!.task!;
const currentTask = () => {
  const s = useChildSession.getState().activeLesson!;
  return s.queue[s.index].task;
};
const correctId = (t: ChooseTask) => t.options.find((o) => o.correct)!.id;
const wrongIds = (t: ChooseTask) => t.options.filter((o) => !o.correct).map((o) => o.id);

function correctAnswer(task: Task): LessonAnswer {
  switch (task.format) {
    case 'choose':
      return { format: 'choose', optionId: correctId(task) };
    case 'match':
      return { format: 'match', pairs: task.pairs.map((p) => ({ left: p.id, right: p.id })) };
    default:
      throw new Error(`correctAnswer: формат ${task.format} в nv-count-l1 не ждём`);
  }
}

/** Текст в пузыре Tali или `null`, если пузырь пуст. */
const bubbleText = (): string | null => {
  const body = screen.queryByTestId('lesson-bubble-body');
  return body ? (body.props.accessibilityLabel as string) : null;
};

/** Завязка и разобранный пример до первого задания — через экран. */
async function throughIntro() {
  await pressAction('hook-help');
  for (let i = 0; i < 6 && screen.queryByText('Теперь ты') === null; i++) {
    if (screen.queryByTestId('lesson-action-busy') !== null) await new Promise((r) => setTimeout(r, 1450));
    await pressAction('lesson-action-next');
  }
  const correct = (lesson.model!.example as ChooseTask).options.find((o) => o.correct)!.id;
  await press(`option-${correct}`);
}

/** Урок открыт в сторе на завязке, завязка и пример пройдены — экран откроется на первом задании. */
function openInStore() {
  const s = useChildSession.getState();
  s.openLesson({ lessonId: 'nv-count-l1', now: NOW, seed: 7, nodeState: 'open' });
  const at = NOW.toISOString();
  s.dispatch({ type: 'hook_done', at });
  s.dispatch({ type: 'model_done', at });
}

let say: jest.SpyInstance;
const keys = () => say.mock.calls.map((c) => c[0] as string);
const companionKeys = () => keys().filter((k) => k.startsWith('companion.'));

beforeEach(() => {
  voice.stop();
  useChildSession.getState().reset();
  useChildSession.getState().startNoRecordSession({ childId: KID, now: NOW, interfaceLang: 'ru' });
  say = jest.spyOn(voice, 'say');
});
afterEach(() => {
  say.mockRestore();
});

describe('реплика на итог задания — экран урока', () => {
  it('первое задание верно с первой попытки: реплика correct-first голосом и тот же текст в пузыре', async () => {
    await renderWithProviders(<LessonScreen />);
    await throughIntro();
    const t = currentTask() as ChooseTask;
    await press(`option-${correctId(t)}`);
    say.mockClear();
    await pressAction('lesson-action-check');

    expect(activeTask().stage).toBe('next');
    expect(companionKeys()).toEqual([expect.stringMatching(bank('correct-first'))]);
    expect(bubbleText()).toBe(i18n.t(companionKeys()[0]));
  });

  it('первое задание верно со второй попытки: реплика correct-after-hint голосом и в пузыре', async () => {
    await renderWithProviders(<LessonScreen />);
    await throughIntro();
    const t = currentTask() as ChooseTask;
    await press(`option-${wrongIds(t)[0]}`);
    await pressAction('lesson-action-check');
    await advance(UNLOCK_AFTER_MS);
    expect(activeTask().attempt).toBe('second');
    await press(`option-${correctId(t)}`);
    say.mockClear();
    await pressAction('lesson-action-check');

    expect(activeTask().stage).toBe('next');
    expect(companionKeys()).toEqual([expect.stringMatching(bank('correct-after-hint'))]);
    expect(bubbleText()).toBe(i18n.t(companionKeys()[0]));
  });

  it('после показа ответа: реплики банка нет ни в голосе, ни в пузыре — в пузыре «Вот так» (объяснение звучало при показе)', async () => {
    await renderWithProviders(<LessonScreen />);
    await throughIntro();
    const t = currentTask() as ChooseTask;
    const [w1, w2] = wrongIds(t);
    await press(`option-${w1}`);
    await pressAction('lesson-action-check');
    await advance(UNLOCK_AFTER_MS);
    await press(`option-${w2}`);
    await pressAction('lesson-action-check');
    await advance(SHOW_AFTER_MS);
    expect(activeTask().stage).toBe('active_response');
    say.mockClear();
    await press(`option-${correctId(t)}`);

    expect(activeTask().stage).toBe('next');
    expect(activeTask().attempt).toBe('shown');
    expect(companionKeys()).toEqual([]);
    expect(bubbleText()).toBe(i18n.t('lesson.thatsHow'));
    expect(bubbleText()).not.toMatch(/^companion\./);
  });

  it('ровно третье подряд с первой попытки: реплика correct-streak-3plus голосом и в пузыре', async () => {
    // задания 0 (choose) и 1 (match) — верно с первой попытки в сторе; экран открывается на «Дальше» второго
    openInStore();
    const s = useChildSession.getState();
    const at = NOW.toISOString();
    s.dispatch({ type: 'answer', answer: correctAnswer(currentTask()), at });
    s.dispatch({ type: 'next', at });
    s.dispatch({ type: 'answer', answer: correctAnswer(currentTask()), at });
    expect(activeTask().stage).toBe('next');
    expect(useChildSession.getState().activeLesson!.played.map((p) => p.attempt)).toEqual(['first']);

    await renderWithProviders(<LessonScreen />);
    await pressAction('lesson-action-next');
    expect(useChildSession.getState().activeLesson!.index).toBe(2);
    expect(useChildSession.getState().activeLesson!.played.map((p) => p.attempt)).toEqual(['first', 'first']);
    const t = currentTask() as ChooseTask;
    expect(t.format).toBe('choose');
    await press(`option-${correctId(t)}`);
    say.mockClear();
    await pressAction('lesson-action-check');

    expect(activeTask().stage).toBe('next');
    expect(companionKeys()).toEqual([expect.stringMatching(bank('correct-streak-3plus'))]);
    expect(bubbleText()).toBe(i18n.t(companionKeys()[0]));
  });

  it('второе подряд с первой попытки после подсказки на первом — молча: ни голоса банка, ни пузыря', async () => {
    // задание 0 — со второй попытки, задание 1 — с первой; третье с первой — это второе подряд, серии нет
    openInStore();
    const s = useChildSession.getState();
    const at = NOW.toISOString();
    const t0 = currentTask() as ChooseTask;
    s.dispatch({ type: 'answer', answer: { format: 'choose', optionId: wrongIds(t0)[0] }, at });
    s.dispatch({ type: 'answer', answer: correctAnswer(t0), at });
    s.dispatch({ type: 'next', at });
    s.dispatch({ type: 'answer', answer: correctAnswer(currentTask()), at });

    await renderWithProviders(<LessonScreen />);
    await pressAction('lesson-action-next');
    expect(useChildSession.getState().activeLesson!.played.map((p) => p.attempt)).toEqual(['second', 'first']);
    const t = currentTask() as ChooseTask;
    await press(`option-${correctId(t)}`);
    say.mockClear();
    await pressAction('lesson-action-check');

    expect(activeTask().stage).toBe('next');
    expect(companionKeys()).toEqual([]);
    expect(bubbleText()).toBeNull();
  });
});

describe('форма обращения из профиля доходит до реплики', () => {
  /** Родовой надстройки в банке пока нет (TALI.md): заводим её на время теста для всех вариантов correct-first. */
  const FEMININE = [0, 1, 2, 3].map((n) => `companion.correct-first.${n}_f`);
  beforeAll(() => {
    i18n.addResources('ru', 'translation', Object.fromEntries(FEMININE.map((k) => [k, `Тест: родовая ${k}`])));
  });
  afterAll(() => {
    const first = (i18n.getResourceBundle('ru', 'translation') as { companion: Record<string, Record<string, string>> }).companion['correct-first'];
    for (const n of [0, 1, 2, 3]) delete first[`${n}_f`];
  });

  it('профиль с формой feminine: на первый верный звучит и показывается родовая надстройка', async () => {
    useChildSession.getState().startAccountSession({
      profile: newProfile({ childId: KID, band: '5-6', interfaceLang: 'ru', createdAt: NOW.toISOString(), addressForm: 'feminine' }),
      snapshot: { ...EMPTY_PROGRESS },
      now: NOW,
    });
    expect(useChildSession.getState().settings.addressForm).toBe('feminine');
    openInStore();

    await renderWithProviders(<LessonScreen />);
    const t = currentTask() as ChooseTask;
    await press(`option-${correctId(t)}`);
    say.mockClear();
    await pressAction('lesson-action-check');

    expect(companionKeys()).toEqual([expect.stringMatching(/^companion\.correct-first\.[0-3]_f$/)]);
    expect(bubbleText()).toBe(i18n.t(companionKeys()[0]));
  });

  it('без записи (форма по умолчанию neutral): та же ситуация — безродовая основа', async () => {
    openInStore();
    await renderWithProviders(<LessonScreen />);
    const t = currentTask() as ChooseTask;
    await press(`option-${correctId(t)}`);
    say.mockClear();
    await pressAction('lesson-action-check');

    expect(companionKeys()).toEqual([expect.stringMatching(bank('correct-first'))]);
  });
});
