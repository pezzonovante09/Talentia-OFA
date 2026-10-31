/**
 * Экран сессии повторения с узла карты (вопрос 56): нечего повторять — на карту; с навыком в срок —
 * реплика `review.intro`, каркас задания без завязки и примера, после последнего задания — `ReviewDone`
 * с «К карте»; итог пишется один раз: порция дня цела, атлас прежний, счётчик уроков +1.
 */
import ReviewScreen from '../review';
import { regionLessons } from '../../src/content';
import { lessonTiming } from '../../src/design/tokens';
import { gameDay } from '../../src/domain/mapProgress';
import { emptySkill } from '../../src/domain/mastery';
import { voice } from '../../src/services/voice';
import { useChildSession } from '../../src/state/childSession';
import { act, fireEvent, renderWithProviders, screen, waitFor } from '../../src/test/render';
import type { ChooseTask } from '../../src/types/task';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), navigate: jest.fn() };
  return {
    __router: router,
    useRouter: () => router,
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
  };
});
const router = (jest.requireMock('expo-router') as { __router: { replace: jest.Mock; push: jest.Mock; navigate: jest.Mock } }).__router;

// Таймлайн экрана идёт в реальном времени («Дальше» через 900): под нагрузкой полного прогона 5 с мало.
jest.setTimeout(30000);

const NOW = new Date('2026-10-24T10:00:00.000Z');
const KID = '00000000-0000-4000-8000-000000000005';
const lessons = regionLessons('numbers');

const start = () => useChildSession.getState().startNoRecordSession({ childId: KID, now: NOW, interfaceLang: 'ru' });
const press = (id: string) => fireEvent.press(screen.getByTestId(id));
/** Кнопки каркаса защищены от двойного тапа (`guardMs` = `motion.slow`): между нажатиями — пауза. */
const pressAction = async (id: string) => {
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

/**
 * Пройден второй урок (`nv-count-l2`); навык первого урока `subitize-1-3` встречен вчера на уроке 0 и
 * ждёт повторения. Пул — из пройденных уроков по атласу: во втором уроке у этого навыка ровно одно
 * задание, и оно `choose` — очередь повторения из одного задания известного формата.
 */
function dueAfterSecondLesson() {
  const second = lessons[1];
  const skill = lessons[0].tasks[0].skill;
  const ownTasks = second.tasks.filter((t) => t.skill === skill);
  expect(ownTasks).toHaveLength(1);
  expect(ownTasks[0].format).toBe('choose');
  const s = useChildSession.getState();
  useChildSession.setState({
    progress: {
      ...s.progress,
      skills: [{ ...emptySkill(skill), lastSeenLesson: 0, lastSeenDay: '2026-10-23', attempts: 1, correct: 1 }],
      atlas: [{ lessonId: second.id, atlasEntryKey: second.atlasEntryKey, stars: 3, firstLesson: 0 }],
      lessonCounter: 1,
    },
  });
  return ownTasks[0] as ChooseTask;
}

let say: jest.SpyInstance;

beforeEach(() => {
  router.replace.mockClear();
  router.push.mockClear();
  router.navigate.mockClear();
  voice.stop();
  say = jest.spyOn(voice, 'say');
  useChildSession.getState().reset();
});

afterEach(() => {
  say.mockRestore();
});

describe('экран повторения', () => {
  it('без сеанса — редирект на первый запуск', async () => {
    await renderWithProviders(<ReviewScreen />);
    expect(screen.getByTestId('redirect').props.children).toBe('/');
  });

  it('нечего повторять — редирект на карту, стор не меняется, реплики нет', async () => {
    start();
    const before = useChildSession.getState();
    await renderWithProviders(<ReviewScreen />);
    expect(screen.getByTestId('redirect').props.children).toBe('/map');
    expect(useChildSession.getState()).toBe(before);
    expect(say).not.toHaveBeenCalledWith('review.intro');
  });

  it('с навыком в срок: review.intro, каркас задания сразу (без завязки и примера), одно задание — повторение', async () => {
    start();
    const expected = dueAfterSecondLesson();
    await renderWithProviders(<ReviewScreen />);
    expect(say).toHaveBeenCalledWith('review.intro');
    expect(screen.getByTestId('review-screen')).toBeTruthy();
    expect(screen.queryByTestId('lesson-hook')).toBeNull();
    expect(screen.queryByTestId('lesson-screen')).toBeNull();
    expect(screen.getByTestId('task-choose')).toBeTruthy();
    expect(screen.getAllByTestId('progress-current')).toHaveLength(1);
    expect(screen.queryByTestId('progress-upcoming')).toBeNull();
    const active = useChildSession.getState().activeLesson!;
    expect(active.lessonId).toBe('review');
    expect(active.queue.map((q) => q.task.id)).toEqual([expected.id]);
    expect(active.queue[0].review).toBe(true);
    // вопрос задания звучит после вступления
    expect(say).toHaveBeenLastCalledWith(expected.promptKey);
    expect(actionId()).toBe('lesson-action-checkDisabled');
  });

  it('после последнего задания — review-done с репликой review.done; «К карте» ведёт на карту; порция цела, атлас прежний, счётчик +1', async () => {
    start();
    dueAfterSecondLesson();
    const before = useChildSession.getState();
    await renderWithProviders(<ReviewScreen />);
    const task = useChildSession.getState().activeLesson!.queue[0].task as ChooseTask;
    const correct = task.options.find((o) => o.correct)!.id;
    await press(`option-${correct}`);
    expect(actionId()).toBe('lesson-action-check');
    await pressAction('lesson-action-check');
    await advance(lessonTiming.nextUnlock);
    expect(actionId()).toBe('lesson-action-next');
    await pressAction('lesson-action-next');

    await waitFor(() => expect(screen.getByTestId('review-done')).toBeTruthy());
    expect(screen.getByTestId('review-done-text').props.children).toBe('Повторили!');
    expect(say).toHaveBeenCalledWith('review.done');

    const s = useChildSession.getState();
    expect(s.activeLesson).toBeNull();
    expect(s.portion).toEqual(before.portion);
    expect(s.progress.atlas).toEqual(before.progress.atlas);
    expect(s.progress.lessonCounter).toBe(before.progress.lessonCounter + 1);
    expect(s.pendingResult?.run.lessonId).toBe('review');
    expect(s.pendingResult?.run.reviewTasks).toBe(1);
    // экран открывает повторение по настоящим часам — день встречи реальный
    expect(s.progress.skills[0]).toMatchObject({ box: 2, lastSeenLesson: 1, lastSeenDay: gameDay(new Date()) });

    await press('review-to-map');
    expect(router.navigate).toHaveBeenCalledWith('/map');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('выход посреди повторения: слой подтверждения, «Выйти» ведёт на карту, повторение ждёт и продолжается при возврате', async () => {
    start();
    dueAfterSecondLesson();
    await renderWithProviders(<ReviewScreen />);
    await press('lesson-exit');
    expect(screen.getByTestId('exit-layer')).toBeTruthy();
    await press('exit-leave');
    expect(router.navigate).toHaveBeenCalledWith('/map');
    const waiting = useChildSession.getState().activeLesson;
    expect(waiting?.lessonId).toBe('review');
    expect(useChildSession.getState().portion.left).toBe(3);

    // возврат на экран — то же повторение, без повторного вступления
    say.mockClear();
    await renderWithProviders(<ReviewScreen />);
    expect(screen.getByTestId('review-screen')).toBeTruthy();
    expect(useChildSession.getState().activeLesson).toBe(waiting);
    expect(say).not.toHaveBeenCalledWith('review.intro');
  });
});
