/**
 * Экран урока на оркестраторе (SCREENS.md 1–3; скилл `format-screen`, шаг 4): завязка → пример →
 * задания; `choose` — выбор, верно с первой попытки, «Дальше» через 900; первая ошибка — крест,
 * блокировка, снятый вариант и подсказка; вторая — показ с треугольником и активный ответ; `match` —
 * пары и единое правило; выход через слой подтверждения оставляет урок ждать.
 */
import { BackHandler } from 'react-native';

import LessonScreen from '../lesson/[lessonId]';
import { regionLessons } from '../../src/content';
import { lessonTiming } from '../../src/design/tokens';
import { voice } from '../../src/services/voice';
import { newProfile } from '../../src/services/local/profiles';
import { EMPTY_PROGRESS } from '../../src/services/progressPort';
import { useChildSession } from '../../src/state/childSession';
import { SHOW_AFTER_MS, UNLOCK_AFTER_MS } from '../../src/ui/lesson/useLessonController';
import { act, fireEvent, renderWithProviders, screen } from '../../src/test/render';
import type { ChooseTask, MatchTask } from '../../src/types/task';

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
const router = (jest.requireMock('expo-router') as { __router: { replace: jest.Mock; push: jest.Mock; navigate: jest.Mock } }).__router;

// Все svg в Jest — один мок; позы Tali помечаются именем, как в atlas.test.tsx.
jest.mock('../../src/assets/registry', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const actual = jest.requireActual<typeof import('../../src/assets/registry')>('../../src/assets/registry');
  const poses = Object.fromEntries(
    Object.keys(actual.TALI_POSES).map((pose) => [pose, (props: Record<string, unknown>) => React.createElement(View, { ...props, accessibilityHint: `pose:${pose}` })]),
  );
  return { ...actual, TALI_POSES: poses };
});

/**
 * В jest-окружении (платформа ios) `BackHandler` — пустышка: подписки собираем сами и зовём, как Android, —
 * с последней подписавшейся, пока кто-то не вернёт true.
 */
type BackFn = () => boolean | null | undefined;
let backSubs: BackFn[] = [];
const pressBack = async (): Promise<boolean> => {
  let handled = false;
  await act(async () => {
    for (const h of [...backSubs].reverse()) {
      if (h()) {
        handled = true;
        break;
      }
    }
  });
  return handled;
};

// Таймлайн экрана идёт в реальном времени (блокировка 1040, «Дальше» 900, демо 2000): под нагрузкой
// полного прогона 5 с не хватает.
jest.setTimeout(40000);

const NOW = new Date('2026-10-24T10:00:00.000Z');
const KID = '00000000-0000-4000-8000-000000000003';
const lesson = regionLessons('numbers')[0];

const start = () => useChildSession.getState().startNoRecordSession({ childId: KID, now: NOW, interfaceLang: 'ru' });
const press = (id: string) => fireEvent.press(screen.getByTestId(id));
/** Кнопки каркаса защищены от двойного тапа (`guardMs` = `motion.slow`): между нажатиями — пауза. */
const pressAction = async (id: string) => {
  // шаг примера: «Дальше» занята первые modelStepMin мс (вопрос 61) — на примере ждём реплику
  if (id === 'lesson-action-next' && screen.queryByTestId('lesson-action-busy') !== null) await new Promise((r) => setTimeout(r, lessonTiming.modelStepMin + 50));
  await press(id);
  await new Promise((r) => setTimeout(r, 380));
};
const actionId = () => screen.getAllByTestId(/^lesson-action-(checkDisabled|check|busy|next)$/)[0].props.testID as string;
/** Реальное время: RNTL 14 ждёт микрозадачи и таймеры, фиктивные таймеры Jest вешают `render`. */
const advance = async (ms: number) => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms + 30));
  });
};

/** Завязка и разобранный пример до первого задания. */
async function throughIntro() {
  await pressAction('hook-help');
  for (let i = 0; i < 6 && screen.queryByText('Теперь ты') === null; i++) await pressAction('lesson-action-next');
  const correct = (lesson.model!.example as ChooseTask).options.find((o) => o.correct)!.id;
  await press(`option-${correct}`);
}

beforeEach(() => {
  backSubs = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_name, handler) => {
    backSubs.push(handler as BackFn);
    return { remove: () => void (backSubs = backSubs.filter((x) => x !== handler)) };
  });
  router.replace.mockClear();
  router.navigate.mockClear();
  voice.stop();
  useChildSession.getState().reset();
  start();
});

describe('экран урока', () => {
  it('открывается на завязке, «Помочь Tali» ведёт в пример, пример — к первому заданию', async () => {
    await renderWithProviders(<LessonScreen />);
    expect(screen.getByTestId('lesson-hook')).toBeTruthy();
    expect(screen.getByText(/Рисую долину/)).toBeTruthy();
    await throughIntro();
    expect(screen.getByTestId('task-choose')).toBeTruthy();
    expect(screen.getAllByTestId('progress-current')).toHaveLength(1);
    expect(screen.getAllByTestId('progress-upcoming')).toHaveLength(lesson.tasks.length - 1);
    expect(actionId()).toBe('lesson-action-checkDisabled');
    expect(voice.last?.key).toBe(lesson.tasks[0].promptKey);
  });

  it('choose: верно с первой попытки — галочка, Tali радуется, «Дальше» через 900', async () => {
    await renderWithProviders(<LessonScreen />);
    await throughIntro();
    const task = useChildSession.getState().activeLesson!.queue[0].task as ChooseTask;
    const correct = task.options.find((o) => o.correct)!.id;
    await press(`option-${correct}`);
    expect(actionId()).toBe('lesson-action-check');
    await pressAction('lesson-action-check');
    expect(screen.getByTestId(`option-${correct}-badge-check`)).toBeTruthy();
    expect(actionId()).toBe('lesson-action-busy');
    await advance(lessonTiming.nextUnlock);
    expect(actionId()).toBe('lesson-action-next');
  });

  it('choose: первая ошибка — крест и блокировка, затем вариант снят, подсказка в пузыре; вторая — показ и активный ответ', async () => {
    await renderWithProviders(<LessonScreen />);
    await throughIntro();
    const task = useChildSession.getState().activeLesson!.queue[0].task as ChooseTask;
    const wrong = task.options.filter((o) => !o.correct).map((o) => o.id);
    const correct = task.options.find((o) => o.correct)!.id;

    await press(`option-${wrong[0]}`);
    await pressAction('lesson-action-check');
    expect(screen.getByTestId(`option-${wrong[0]}-badge-x`)).toBeTruthy();
    expect(actionId()).toBe('lesson-action-busy');
    // Касание во время блокировки — «тук», черновик не меняется.
    await press(`option-${correct}`);
    expect(voice.last?.key).toBe('lesson.busy');

    await advance(UNLOCK_AFTER_MS);
    // Снятый вариант скрыт от скринридера — запрос с учётом скрытых.
    expect(screen.getByTestId(`option-${wrong[0]}-face`, { includeHiddenElements: true })).toHaveStyle({ borderStyle: 'dashed' });
    expect(screen.getByTestId('lesson-bubble-body')).toBeTruthy();
    expect(actionId()).toBe('lesson-action-checkDisabled');

    await press(`option-${wrong[1]}`);
    await pressAction('lesson-action-check');
    await advance(SHOW_AFTER_MS);
    expect(screen.getByTestId(`option-${correct}-badge-triangle`)).toBeTruthy();
    expect(actionId()).toBe('lesson-action-checkDisabled');
    await pressAction('lesson-action-checkDisabled');
    expect(voice.last?.key).toBe('lesson.chooseFirst');
    await press(`option-${correct}`);
    expect(actionId()).toBe('lesson-action-next');
    expect(screen.getByText('Вот так')).toBeTruthy();
  });

  it('двойной тап по «Проверить» — один ответ', async () => {
    await renderWithProviders(<LessonScreen />);
    await throughIntro();
    const task = useChildSession.getState().activeLesson!.queue[0].task as ChooseTask;
    const correct = task.options.find((o) => o.correct)!.id;
    await press(`option-${correct}`);
    await press('lesson-action-check');
    await press('lesson-action-busy');
    expect(useChildSession.getState().activeLesson!.task?.stage).toBe('next');
    expect(useChildSession.getState().activeLesson!.played).toHaveLength(0);
  });

  it('match: демо выбирает первую плитку, пары ставятся тапом по другой стороне, верно — линии и «Дальше»', async () => {
    await renderWithProviders(<LessonScreen />);
    await throughIntro();
    const t1 = useChildSession.getState().activeLesson!.queue[0].task as ChooseTask;
    await press(`option-${t1.options.find((o) => o.correct)!.id}`);
    await pressAction('lesson-action-check');
    await advance(lessonTiming.nextUnlock);
    await pressAction('lesson-action-next');
    const match = useChildSession.getState().activeLesson!.queue[1].task as MatchTask;
    expect(screen.getByTestId('task-match')).toBeTruthy();
    await advance(2000);
    expect(screen.getByTestId(`left-${match.pairs[0].id}`)).toBeSelected();
    for (const p of match.pairs) {
      await press(`left-${p.id}`);
      await press(`right-${p.id}`);
    }
    expect(actionId()).toBe('lesson-action-check');
    await pressAction('lesson-action-check');
    await advance(lessonTiming.nextUnlock);
    expect(actionId()).toBe('lesson-action-next');
  });

  it('выход: слой подтверждения, «Остаться» закрывает, «Выйти» оставляет урок ждать и ведёт на карту', async () => {
    await renderWithProviders(<LessonScreen />);
    await throughIntro();
    await press('lesson-exit');
    expect(screen.getByTestId('exit-layer')).toBeTruthy();
    expect(screen.queryByTestId('exit-persists')).toBeNull();
    await press('exit-stay');
    expect(screen.queryByTestId('exit-layer')).toBeNull();
    await press('lesson-exit');
    await press('exit-leave');
    expect(router.navigate).toHaveBeenCalledWith('/map');
    expect(useChildSession.getState().activeLesson?.lessonId).toBe(lesson.id);
  });

  /** Контрольный аудит 2026-11-09, Ж7 (этап B1): системная «назад» не уводит из урока мимо подтверждения. */
  describe('системная «назад» (Android)', () => {
    it('на задании: «назад» открывает слой выхода и перехвачена; роутер не звался, урок ждёт', async () => {
      await renderWithProviders(<LessonScreen />);
      await throughIntro();
      expect(screen.getByTestId('task-choose')).toBeTruthy();
      expect(await pressBack()).toBe(true);
      expect(screen.getByTestId('exit-layer')).toBeTruthy();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
      expect(useChildSession.getState().activeLesson?.lessonId).toBe(lesson.id);
    });

    it('на завязке: «назад» открывает тот же слой выхода', async () => {
      await renderWithProviders(<LessonScreen />);
      expect(screen.getByTestId('lesson-hook')).toBeTruthy();
      expect(await pressBack()).toBe(true);
      expect(screen.getByTestId('exit-layer')).toBeTruthy();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('на завязке: «Выйти» из слоя ведёт на карту, урок ждёт', async () => {
      await renderWithProviders(<LessonScreen />);
      await pressBack();
      await press('exit-leave');
      expect(router.navigate).toHaveBeenCalledWith('/map');
      expect(useChildSession.getState().activeLesson?.lessonId).toBe(lesson.id);
    });

    it('открытие слоя говорит lesson.exitConfirm', async () => {
      await renderWithProviders(<LessonScreen />);
      await throughIntro();
      voice.stop();
      await pressBack();
      expect(voice.last?.key).toBe('lesson.exitConfirm');
    });

    it('при открытом слое «назад» — «остаться»: слой закрыт, задание на месте, на карту не ушли', async () => {
      await renderWithProviders(<LessonScreen />);
      await throughIntro();
      await pressBack();
      expect(await pressBack()).toBe(true);
      expect(screen.queryByTestId('exit-layer')).toBeNull();
      expect(screen.getByTestId('task-choose')).toBeTruthy();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('после размонтирования экрана подписок на «назад» не остаётся', async () => {
      const { unmount } = await renderWithProviders(<LessonScreen />);
      await throughIntro();
      await unmount();
      expect(backSubs).toHaveLength(0);
    });
  });

  it('сеанс с аккаунтом: в слое выхода подпись «прогресс сохранится» (persists)', async () => {
    useChildSession.getState().reset();
    useChildSession.getState().startAccountSession({
      profile: newProfile({ childId: KID, band: '5-6', interfaceLang: 'ru', createdAt: NOW.toISOString() }),
      snapshot: { ...EMPTY_PROGRESS },
      now: NOW,
    });
    await renderWithProviders(<LessonScreen />);
    await throughIntro();
    await press('lesson-exit');
    expect(screen.getByTestId('exit-persists')).toBeTruthy();
  });

  /** Аудит 2026-11-09, `child-ux-specialist` п. 8 (B6): ребёнок ждёт после «верно» — Tali указывает на «Дальше». */
  it('после «верно» и nudgeAfter без нажатия Tali переходит в point', async () => {
    await renderWithProviders(<LessonScreen />);
    await throughIntro();
    const task = useChildSession.getState().activeLesson!.queue[0].task as ChooseTask;
    await press(`option-${task.options.find((o) => o.correct)!.id}`);
    await pressAction('lesson-action-check');
    await advance(lessonTiming.nextUnlock);
    expect(screen.getByTestId('lesson-tali-svg').props.accessibilityHint).toBe('pose:cheer');
    await advance(lessonTiming.nudgeAfter);
    expect(screen.getByTestId('lesson-tali-svg').props.accessibilityHint).toBe('pose:point');
    expect(actionId()).toBe('lesson-action-next');
  });
});
