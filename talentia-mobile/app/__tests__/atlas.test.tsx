/**
 * Страница атласа (D1 дизайн-дока этапа D): записывает итог ровно один раз через порт прогресса; без записи
 * (`LessonConsentRequiredError`) страница та же и итог в памяти; в рамке — стимул первого задания навыка с
 * метками «сосчитано»; печать `regionsInk` ложится через `stampAfterMs`, Tali `write` → `cheer`; лента — 3 слота
 * и хвост с голосом; «К карте» ведёт на карту; без завершённого урока — редирект. `readOnly` — без записи,
 * печать сразу, Tali `idle`, без ленты, «К атласу».
 */
import AtlasScreen from '../atlas/[lessonId]';
import { regionLessons } from '../../src/content';
import { atlasPage, palettes } from '../../src/design/tokens';
import { applyLessonEvent, lessonStepOf, type LessonAnswer } from '../../src/domain/lessonSession';
import { LessonConsentRequiredError } from '../../src/services/local/accountConsent';
import { voice } from '../../src/services/voice';
import { newProfile } from '../../src/services/local/profiles';
import { EMPTY_PROGRESS, type ProgressPort } from '../../src/services/progressPort';
import { useChildSession } from '../../src/state/childSession';
import { setProgressPort } from '../../src/state/port';
import { act, fireEvent, renderWithProviders, screen, waitFor } from '../../src/test/render';
import type { Task } from '../../src/types/task';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), navigate: jest.fn() };
  const params: { lessonId: string; readOnly?: string } = { lessonId: 'nv-count-l1' };
  return {
    __router: router,
    __params: params,
    useRouter: () => router,
    useLocalSearchParams: () => ({ ...params }),
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
  };
});
const mocked = jest.requireMock('expo-router') as { __router: { replace: jest.Mock; navigate: jest.Mock }; __params: { lessonId: string; readOnly?: string } };
const router = mocked.__router;
const params = mocked.__params;
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

/** Открыть урок и пройти его до фазы `done` прямо в сторе. Пишущий порт вызывается только с аккаунтом (вопрос 84). */
function finishInStore(mode: 'account' | 'no_record' = 'account') {
  const s = useChildSession.getState();
  if (mode === 'no_record') s.startNoRecordSession({ childId: KID, now: NOW, interfaceLang: 'ru' });
  else s.startAccountSession({ profile: newProfile({ childId: KID, band: '5-6', interfaceLang: 'ru', createdAt: NOW.toISOString() }), snapshot: { ...EMPTY_PROGRESS }, now: NOW });
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
const stampDelay = Math.min(atlasPage.stampAfterMs, atlasPage.stampMaxWaitMs);
const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });

beforeEach(() => {
  router.replace.mockClear();
  router.navigate.mockClear();
  params.lessonId = 'nv-count-l1';
  delete params.readOnly;
  voice.stop();
  useChildSession.getState().reset();
});

describe('страница атласа', () => {
  it('без записи: пишущий порт не тронут, итог в памяти; в рамке — кучка первого задания с метками; печать после stampAfterMs, Tali write → cheer', async () => {
    const commit = jest.fn(() => Promise.resolve());
    setProgressPort(port(commit));
    finishInStore('no_record');
    await renderWithProviders(<AtlasScreen />);
    await waitFor(() => expect(screen.getByTestId('atlas-screen')).toBeTruthy());
    expect(commit).not.toHaveBeenCalled();
    const s = useChildSession.getState();
    expect(s.activeLesson).toBeNull();
    expect(s.progress.atlas.map((e) => e.lessonId)).toEqual([lesson.id]);
    expect(screen.getByTestId('atlas-entry').props.children).toBeTruthy();
    expect(voice.last?.key).toBe(lesson.atlasEntryKey);
    // nv-count-l1: первое задание навыка — два камня в ряд → Pile стимульного размера, метки на обеих фигурах
    expect(screen.getByTestId('atlas-finding-stimulus')).toBeTruthy();
    expect(screen.getAllByTestId(/^atlas-finding-pile-mark-\d$/)).toHaveLength(2);
    expect(screen.queryByTestId('atlas-finding-fallback')).toBeNull();
    // печать — событие после фразы, не сразу
    expect(screen.queryByTestId('atlas-stamp')).toBeNull();
    expect(screen.getByTestId('atlas-tali-svg').props.accessibilityHint).toBe('pose:write');
    await wait(stampDelay - 200);
    expect(screen.queryByTestId('atlas-stamp')).toBeNull();
    await wait(400);
    expect(screen.getByTestId('atlas-stamp')).toBeTruthy();
    expect(screen.getByTestId('atlas-tali-svg').props.accessibilityHint).toBe('pose:cheer');
    // цвет печати — regionsInk региона урока, не text
    const stampSvg = screen.getByTestId('atlas-stamp').children[0] as unknown as { props: { color: string } };
    expect(stampSvg.props.color).toBe(palettes.light.normal.regionsInk.numbers);
    expect(stampSvg.props.color).not.toBe(palettes.light.normal.text);
    // лента: 3 слота + хвост, который тоже отвечает голосом
    expect(screen.getAllByTestId(/^atlas-slot-\d$/)).toHaveLength(3);
    expect(screen.getByTestId('atlas-trail')).toBeTruthy();
    expect(screen.queryByTestId('atlas-tail-cushion')).toBeNull();
  });

  it('аккаунт без согласия: порт отвечает LessonConsentRequiredError один раз, страница та же, итог в памяти', async () => {
    const commit = jest.fn(() => Promise.reject(new LessonConsentRequiredError('not_asked')));
    setProgressPort(port(commit));
    finishInStore();
    await renderWithProviders(<AtlasScreen />);
    await waitFor(() => expect(screen.getByTestId('atlas-screen')).toBeTruthy());
    expect(commit).toHaveBeenCalledTimes(1);
    expect(useChildSession.getState().progress.atlas.map((e) => e.lessonId)).toEqual([lesson.id]);
    expect(screen.getByTestId('atlas-entry').props.children).toBeTruthy();
  });

  /** Контрольный аудит 2026-11-09, UX п. 13 (B6): сбой базы — не редирект на карту, а та же страница; ошибку видит взрослый. */
  it('сбой записи итога (обычная Error порта): страница атласа показывается, редиректа на карту нет, lastWriteError в сторе', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const commit = jest.fn(() => Promise.reject(new Error('database is locked')));
    setProgressPort(port(commit));
    finishInStore();
    await renderWithProviders(<AtlasScreen />);
    await waitFor(() => expect(screen.getByTestId('atlas-screen')).toBeTruthy());
    expect(commit).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('redirect')).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByTestId('atlas-entry').props.children).toBeTruthy();
    expect(useChildSession.getState().lastWriteError).toBe('database is locked');
    expect(useChildSession.getState().progress.atlas.map((e) => e.lessonId)).toEqual([lesson.id]);
    warn.mockRestore();
  });

  it('с записью: порт записал, страница та же; слот ленты, хвост и «К карте» отвечают', async () => {
    const commit = jest.fn(() => Promise.resolve());
    setProgressPort(port(commit));
    finishInStore();
    await renderWithProviders(<AtlasScreen />);
    await waitFor(() => expect(screen.getByTestId('atlas-screen')).toBeTruthy());
    expect(commit).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('atlas-slot-2'));
    expect(voice.last?.key).toBe('atlas.pageAhead');
    voice.stop();
    await fireEvent.press(screen.getByTestId('atlas-tail'));
    expect(voice.last?.key).toBe('atlas.pageAhead');
    await fireEvent.press(screen.getByTestId('atlas-to-map'));
    expect(router.navigate).toHaveBeenCalledWith('/map');
    expect(screen.queryByTestId('atlas-to-atlas')).toBeNull();
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

  it('calm: те же три слота — число слотов от режима не зависит', async () => {
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

  describe('readOnly (из коллекции)', () => {
    it('без записи итога: порт не тронут, печать стоит сразу, Tali idle, ленты нет, «К атласу» → /atlas', async () => {
      const commit = jest.fn(() => Promise.resolve());
      setProgressPort(port(commit));
      useChildSession.getState().startNoRecordSession({ childId: KID, now: NOW, interfaceLang: 'ru' });
      params.readOnly = '1';
      await renderWithProviders(<AtlasScreen />);
      expect(screen.getByTestId('atlas-screen')).toBeTruthy();
      expect(commit).not.toHaveBeenCalled();
      expect(screen.getByTestId('atlas-stamp')).toBeTruthy();
      expect(screen.getByTestId('atlas-tali-svg').props.accessibilityHint).toBe('pose:idle');
      expect(screen.queryByTestId('atlas-future')).toBeNull();
      expect(screen.queryByTestId('atlas-slot-0')).toBeNull();
      expect(voice.last?.key).toBe(lesson.atlasEntryKey);
      expect(screen.queryByTestId('atlas-to-map')).toBeNull();
      await fireEvent.press(screen.getByTestId('atlas-to-atlas'));
      expect(router.navigate).toHaveBeenCalledWith('/atlas');
      expect(useChildSession.getState().progress.atlas).toEqual([]);
    });

    it('урок с кучкой ≥ 6 — в рамке карточка-цифра, не кучка', async () => {
      setProgressPort(port(() => Promise.resolve()));
      useChildSession.getState().startNoRecordSession({ childId: KID, now: NOW, interfaceLang: 'ru' });
      params.lessonId = 'nv-count-l3';
      params.readOnly = '1';
      await renderWithProviders(<AtlasScreen />);
      expect(screen.getByTestId('atlas-finding-numeral')).toBeTruthy();
      expect(screen.getByText('7')).toBeTruthy();
      expect(screen.queryByTestId('atlas-finding-pile')).toBeNull();
    });
  });
});
