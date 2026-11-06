/**
 * Разобранный пример на экране урока (разбор 2026-10-31, вопросы 61 и 70; этап C).
 *
 * C1: на шаге примера «Дальше» занята первые `lessonTiming.modelStepMin` мс — пример нельзя пролистать
 * двумя тапами; на «теперь ты» кнопка пример не завершает, завершает только тап по верному варианту,
 * любой другой — «Покажи, где верно»; без тапа через `nudgeAfter` кнопка пульсирует.
 * C2: шаг `mistake` (третий урок темы) — над неверной плиткой знак вопроса, не крест, Tali сомневается
 * (`puzzled`), плитка не выбрана; на следующем шаге она снята (пунктир), верная выбрана, поза `point`.
 *
 * Таймлайн — в реальном времени, как в lesson.test.tsx: фиктивные таймеры Jest вешают `render` RNTL 14.
 */
import { Animated } from 'react-native';

import LessonScreen from '../lesson/[lessonId]';
import { lessonById } from '../../src/content';
import { lessonTiming } from '../../src/design/tokens';
import { voice } from '../../src/services/voice';
import { useChildSession } from '../../src/state/childSession';
import { act, fireEvent, renderWithProviders, screen } from '../../src/test/render';
import type { ChooseTask } from '../../src/types/task';

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
// Все svg в Jest — один и тот же мок, поза Tali по дереву не различима: позы реестра помечаются именем.
jest.mock('../../src/assets/registry', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const actual = jest.requireActual<typeof import('../../src/assets/registry')>('../../src/assets/registry');
  const poses = Object.fromEntries(
    Object.keys(actual.TALI_POSES).map((pose) => [pose, (props: Record<string, unknown>) => React.createElement(View, { ...props, accessibilityHint: `pose:${pose}` })]),
  );
  return { ...actual, TALI_POSES: poses };
});

// Шаг примера — 1400 мс реального времени, напоминание — 5000: под нагрузкой полного прогона 5 с мало.
jest.setTimeout(40000);

const NOW = new Date('2026-10-24T10:00:00.000Z');
const KID = '00000000-0000-4000-8000-000000000006';
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
const active = () => useChildSession.getState().activeLesson!;
const taliPose = () => screen.getByTestId('lesson-tali-svg').props.accessibilityHint as string;
const example = (id: string) => lessonById(id)!.model!.example as ChooseTask;
const correctOf = (t: ChooseTask) => t.options.find((o) => o.correct)!.id;
const wrongOf = (t: ChooseTask) => t.options.find((o) => !o.correct)!.id;

/** Завязка → шаги примера → «теперь ты» (без тапа по варианту). */
async function toNowYou() {
  await pressAction('hook-help');
  for (let i = 0; i < 6 && screen.queryByText('Теперь ты') === null; i++) await pressAction('lesson-action-next');
  expect(screen.getByText('Теперь ты')).toBeTruthy();
}

beforeEach(() => {
  mockLessonId = 'nv-count-l1';
  voice.stop();
  useChildSession.getState().reset();
  start();
});

describe('шаг примера: «Дальше» занята, пока реплика не прозвучала (вопрос 61)', () => {
  it('первые modelStepMin мс кнопка занята: тап — «Занято», шаг примера не меняется; потом «Дальше» ведёт к следующему шагу', async () => {
    await renderWithProviders(<LessonScreen />);
    await pressAction('hook-help');
    expect(active().phase).toBe('model');
    expect(actionId()).toBe('lesson-action-busy');

    await pressAction('lesson-action-busy');
    expect(voice.last?.key).toBe('lesson.busy');
    expect(active().model!.step).toBe(0);

    await advance(lessonTiming.modelStepMin - 380);
    expect(actionId()).toBe('lesson-action-next');
    await pressAction('lesson-action-next');
    expect(active().model!.step).toBe(1);
    // новый шаг — снова занята
    expect(actionId()).toBe('lesson-action-busy');
  });
});

describe('«теперь ты»: пример завершает только тап по верному варианту (вопрос 61)', () => {
  it('кнопка недоступна, её тап — «Покажи, где верно» в голосе и пузыре, домен остаётся на примере', async () => {
    await renderWithProviders(<LessonScreen />);
    await toNowYou();
    expect(actionId()).toBe('lesson-action-checkDisabled');

    await pressAction('lesson-action-checkDisabled');
    expect(voice.last?.key).toBe('lesson.nowYouTap');
    expect(screen.getByText('Покажи, где верно')).toBeTruthy();
    expect(active().phase).toBe('model');
    expect(active().task).toBeNull();
  });

  it('тап по неверному варианту — та же реплика, пример не завершён; тап по верному — первое задание', async () => {
    await renderWithProviders(<LessonScreen />);
    await toNowYou();
    const ex = example('nv-count-l1');

    await press(`option-${wrongOf(ex)}`);
    expect(voice.last?.key).toBe('lesson.nowYouTap');
    expect(screen.getByText('Покажи, где верно')).toBeTruthy();
    expect(active().phase).toBe('model');

    await press(`option-${correctOf(ex)}`);
    expect(active().phase).toBe('task');
    expect(active().index).toBe(0);
    expect(voice.last?.key).toBe(active().queue[0].task.promptKey);
    expect(screen.getAllByTestId('progress-current')).toHaveLength(1);
  });

  it('без тапа через nudgeAfter кнопка пульсирует (анимация масштаба запускается один раз), пример не завершён', async () => {
    const sequence = jest.spyOn(Animated, 'sequence');
    try {
      await renderWithProviders(<LessonScreen />);
      await toNowYou();
      sequence.mockClear();
      // до срока — тихо
      await advance(lessonTiming.nudgeAfter / 2);
      expect(sequence).not.toHaveBeenCalled();
      await advance(lessonTiming.nudgeAfter / 2);
      expect(sequence).toHaveBeenCalledTimes(1);
      expect(active().phase).toBe('model');
      expect(screen.getByText('Теперь ты')).toBeTruthy();
    } finally {
      sequence.mockRestore();
    }
  });
});

describe('шаг «Tali ошибся» в третьем уроке темы (вопрос 70)', () => {
  beforeEach(() => {
    mockLessonId = 'nv-count-l3';
  });

  it('шаг 1: над неверной плиткой знак вопроса (не крест), Tali в позе puzzled, плитка не выбрана', async () => {
    await renderWithProviders(<LessonScreen />);
    const steps = lessonById('nv-count-l3')!.model!.steps;
    expect(steps[0].mistake).toBe(true);
    const mistaken = steps[0].reveal as string;
    expect(mistaken).not.toBe(correctOf(example('nv-count-l3')));

    await pressAction('hook-help');
    expect(screen.getByTestId(`option-${mistaken}-badge-question`)).toBeTruthy();
    expect(screen.queryByTestId(`option-${mistaken}-badge-x`)).toBeNull();
    expect(screen.getByTestId(`option-${mistaken}`)).not.toBeSelected();
    expect(taliPose()).toBe('pose:puzzled');
    expect(voice.last?.key).toBe(steps[0].lineKey);
  });

  it('шаг 2: ошибочная плитка снята (пунктир), верная выбрана, поза point; на «теперь ты» снятая остаётся снятой и верный тап ведёт в задание', async () => {
    await renderWithProviders(<LessonScreen />);
    const steps = lessonById('nv-count-l3')!.model!.steps;
    const mistaken = steps[0].reveal as string;
    const correct = correctOf(example('nv-count-l3'));
    expect(steps[1].reveal).toBe(correct);

    await pressAction('hook-help');
    await pressAction('lesson-action-next');
    expect(active().model!.step).toBe(1);
    expect(screen.queryByTestId(`option-${mistaken}-badge-question`)).toBeNull();
    expect(screen.getByTestId(`option-${mistaken}-face`, HIDDEN)).toHaveStyle({ borderStyle: 'dashed' });
    expect(screen.getByTestId(`option-${correct}`)).toBeSelected();
    expect(taliPose()).toBe('pose:point');

    await pressAction('lesson-action-next');
    expect(screen.getByText('Теперь ты')).toBeTruthy();
    expect(screen.getByTestId(`option-${mistaken}-face`, HIDDEN)).toHaveStyle({ borderStyle: 'dashed' });
    expect(taliPose()).toBe('pose:point');

    await press(`option-${correct}`);
    expect(active().phase).toBe('task');
    expect(active().queue[0].task.id).toBe('nv-count-l3-t1');
  });
});
