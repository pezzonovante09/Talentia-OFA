/**
 * Страница атласа (§4 дизайн-дока): записывает итог ровно один раз через порт прогресса; без записи
 * (`LessonConsentRequiredError`) страница та же и итог в памяти; печать появляется после задержки;
 * слоты ленты отвечают голосом; «К карте» ведёт на карту; без завершённого урока — редирект.
 */
import AtlasScreen from '../atlas/[lessonId]';
import { regionLessons } from '../../src/content';
import { applyLessonEvent, lessonStepOf, type LessonAnswer } from '../../src/domain/lessonSession';
import { LessonConsentRequiredError } from '../../src/services/local/accountConsent';
import { voice } from '../../src/services/voice';
import type { ProgressPort } from '../../src/services/progressPort';
import { useChildSession } from '../../src/state/childSession';
import { setProgressPort } from '../../src/state/port';
import { act, fireEvent, renderWithProviders, screen, waitFor } from '../../src/test/render';
import type { Task } from '../../src/types/task';

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
const router = (jest.requireMock('expo-router') as { __router: { replace: jest.Mock; navigate: jest.Mock } }).__router;

const NOW = new Date('2026-10-24T10:00:00.000Z');
const KID = '00000000-0000-4000-8000-000000000004';
const lesson = regionLessons('numbers')[0];
const at = (s: number) => new Date(NOW.getTime() + s * 1000).toISOString();

function correctAnswer(task: Task): LessonAnswer {
  switch (task.format) {
    case 'choose':
      return { format: 'choose', optionId: task.options.find((o) => o.correct)!.id };
    case 'match':
      return { format: 'match', pairs: task.pairs.map((p) => ({ left: p.id, right: p.id })) };
    case 'order':
      return { format: 'order', slots: [...task.items].sort((a, b) => a.position - b.position).map((i) => i.id) };
    default:
      throw new Error('формат вне среза');
  }
}

/** Открыть урок и пройти его до фазы `done` прямо в сторе. */
function finishInStore() {
  const s = useChildSession.getState();
  s.startNoRecordSession({ childId: KID, now: NOW, interfaceLang: 'ru' });
  let state = s.openLesson({ lessonId: lesson.id, now: NOW, seed: 5, nodeState: 'open' });
  state = applyLessonEvent(state, { type: 'hook_done', at: at(1) });
  let sec = 2;
  while (lessonStepOf(state).kind === 'model') {
    const step = lessonStepOf(state);
    state = applyLessonEvent(state, { type: step.kind === 'model' && step.nowYou ? 'model_done' : 'model_step', at: at(sec++) });
  }
  while (lessonStepOf(state).kind === 'task') {
    const step = lessonStepOf(state);
    if (step.kind !== 'task') break;
    state = applyLessonEvent(state, { type: 'answer', answer: correctAnswer(step.task), at: at(sec + 3) });
    state = applyLessonEvent(state, { type: 'next', at: at(sec + 5) });
    sec += 6;
  }
  useChildSession.setState({ activeLesson: state });
}

const port = (commit: ProgressPort['commit']): ProgressPort => ({ load: () => Promise.resolve({ skills: [], atlas: [], lessonCounter: 0, formatsSeen: [] }), commit });

beforeEach(() => {
  router.replace.mockClear();
  router.navigate.mockClear();
  voice.stop();
  useChildSession.getState().reset();
});

describe('страница атласа', () => {
  it('без записи: порт вызван один раз, итог в памяти, страница с выводом и печатью', async () => {
    const commit = jest.fn(() => Promise.reject(new LessonConsentRequiredError('not_asked')));
    setProgressPort(port(commit));
    finishInStore();
    await renderWithProviders(<AtlasScreen />);
    await waitFor(() => expect(screen.getByTestId('atlas-screen')).toBeTruthy());
    expect(commit).toHaveBeenCalledTimes(1);
    const s = useChildSession.getState();
    expect(s.activeLesson).toBeNull();
    expect(s.progress.atlas.map((e) => e.lessonId)).toEqual([lesson.id]);
    expect(screen.getByTestId('atlas-entry').props.children).toBeTruthy();
    expect(voice.last?.key).toBe(lesson.atlasEntryKey);
    expect(screen.queryByTestId('atlas-stamp')).toBeNull();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    expect(screen.getByTestId('atlas-stamp')).toBeTruthy();
    expect(screen.getAllByTestId(/^atlas-slot-\d$/)).toHaveLength(6);
  });

  it('с записью: порт записал, страница та же; слот ленты и «К карте» отвечают', async () => {
    const commit = jest.fn(() => Promise.resolve());
    setProgressPort(port(commit));
    finishInStore();
    await renderWithProviders(<AtlasScreen />);
    await waitFor(() => expect(screen.getByTestId('atlas-screen')).toBeTruthy());
    expect(commit).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('atlas-slot-2'));
    expect(voice.last?.key).toBe('atlas.pageAhead');
    await fireEvent.press(screen.getByTestId('atlas-to-map'));
    expect(router.navigate).toHaveBeenCalledWith('/map');
  });

  it('повторный рендер с готовым итогом не пишет второй раз', async () => {
    const commit = jest.fn(() => Promise.resolve());
    setProgressPort(port(commit));
    finishInStore();
    const first = await renderWithProviders(<AtlasScreen />);
    await waitFor(() => expect(screen.getByTestId('atlas-screen')).toBeTruthy());
    await first.unmount();
    const second = await renderWithProviders(<AtlasScreen />);
    await waitFor(() => expect(screen.getByTestId('atlas-screen')).toBeTruthy());
    expect(commit).toHaveBeenCalledTimes(1);
    await second.unmount();
  });

  it('calm: три слота в ленте', async () => {
    setProgressPort(port(() => Promise.resolve()));
    finishInStore();
    await renderWithProviders(<AtlasScreen />, { calmMode: true });
    await waitFor(() => expect(screen.getByTestId('atlas-screen')).toBeTruthy());
    expect(screen.getAllByTestId(/^atlas-slot-\d$/)).toHaveLength(3);
  });

  it('focus: без ленты и Tali', async () => {
    setProgressPort(port(() => Promise.resolve()));
    finishInStore();
    await renderWithProviders(<AtlasScreen />, { focusMode: true });
    await waitFor(() => expect(screen.getByTestId('atlas-screen')).toBeTruthy());
    expect(screen.queryByTestId('atlas-future')).toBeNull();
    expect(screen.queryByTestId('atlas-tali')).toBeNull();
  });

  it('без завершённого урока — на карту', async () => {
    useChildSession.getState().startNoRecordSession({ childId: KID, now: NOW, interfaceLang: 'ru' });
    await renderWithProviders(<AtlasScreen />);
    expect(screen.getByTestId('redirect').props.children).toBe('/map');
  });
});
