/**
 * Карта региона на чистой установке (§2 дизайн-дока): полоса с названием, узлы «повторение» + открытый +
 * два замка + хвост, Tali у открытого узла; открытый узел ведёт в урок, замок отвечает голосом, «ползунки» —
 * родительский раздел (№141); без сеанса — редирект на первый запуск.
 */
import MapScreen from '../map';
import { regionLessons } from '../../src/content';
import { mapLane, taliSize } from '../../src/design/tokens';
import { nodeCenter, taliAnchor } from '../../src/domain/mapLane';
import { gameDay } from '../../src/domain/mapProgress';
import { emptySkill } from '../../src/domain/mastery';
import { voice } from '../../src/services/voice';
import { useChildSession } from '../../src/state/childSession';
import { buildMapModel } from '../../src/state/mapModel';
import { fireEvent, renderWithProviders, screen } from '../../src/test/render';
import { LANE_GEOMETRY } from '../../src/ui/map/MapLane';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
  return {
    __router: router,
    useRouter: () => router,
    useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]),
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
  };
});
const mockPush = (jest.requireMock('expo-router') as { __router: { push: jest.Mock } }).__router.push;
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
const KID = '00000000-0000-4000-8000-000000000002';
const lessons = regionLessons('numbers');
const start = () => useChildSession.getState().startNoRecordSession({ childId: KID, now: NOW, interfaceLang: 'ru' });

beforeEach(() => {
  mockPush.mockClear();
  voice.stop();
  useChildSession.getState().reset();
});

describe('карта региона', () => {
  it('без сеанса — редирект на первый запуск', async () => {
    await renderWithProviders(<MapScreen />);
    expect(screen.getByTestId('redirect').props.children).toBe('/');
  });

  it('чистая установка: полоса, узлы review + 1 + два замка, Tali у открытого', async () => {
    start();
    await renderWithProviders(<MapScreen />);
    expect(screen.getByTestId('map-title').props.children).toBe('Числовая долина');
    expect(screen.getByTestId('map-node-review')).toBeTruthy();
    expect(screen.getByTestId('map-node-1')).toBeTruthy();
    expect(screen.getByTestId('map-node-2')).toBeTruthy();
    expect(screen.getByTestId('map-node-3')).toBeTruthy();
    expect(screen.queryByTestId('map-node-4')).toBeNull();
    expect(screen.getByTestId('map-tali')).toBeTruthy();
    // Единственная подушка среди узлов — у открытого урока.
    expect(screen.getByTestId('map-node-1-cushion')).toBeTruthy();
    expect(screen.queryByTestId('map-node-2-cushion')).toBeNull();
  });

  it('открытый узел ведёт в урок; замок и «повторение» отвечают голосом и никуда не ведут', async () => {
    start();
    await renderWithProviders(<MapScreen />);
    await fireEvent.press(screen.getByTestId('map-node-2'));
    expect(voice.last?.key).toBe('map.lockedInOrder');
    await fireEvent.press(screen.getByTestId('map-node-review'));
    expect(voice.last?.key).toBe('map.reviewLater');
    expect(mockPush).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('map-node-1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/lesson/[lessonId]', params: { lessonId: lessons[0].id } });
  });

  it('Tali называет регион и следующий шаг; «ползунки» ведут в родительский раздел; «к атласу» скрыта до атласа-коллекции', async () => {
    start();
    await renderWithProviders(<MapScreen />);
    await fireEvent.press(screen.getByTestId('map-tali-press'));
    expect(voice.last).toEqual({ key: 'map.taliTap', params: { region: 'в Числовой долине' } });
    // вопрос 60: кнопка с вечной голосовой заглушкой — мёртвая цель; место под неё остаётся, название по центру
    expect(screen.queryByTestId('map-atlas')).toBeNull();
    expect(screen.getByTestId('map-atlas-slot')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('map-settings'));
    expect(mockPush).toHaveBeenCalledWith('/parent');
  });

  it('focus: виден текущий узел с соседом и полоса целиком', async () => {
    start();
    await renderWithProviders(<MapScreen />, { focusMode: true });
    expect(screen.getByTestId('map-node-1')).toBeTruthy();
    expect(screen.getByTestId('map-node-2')).toBeTruthy();
    expect(screen.queryByTestId('map-node-3')).toBeNull();
    expect(screen.getByTestId('map-atlas-slot')).toBeTruthy();
    expect(screen.getByTestId('map-settings')).toBeTruthy();
  });

  it('есть открытый урок: Tali указывает (point) на него', async () => {
    start();
    await renderWithProviders(<MapScreen />);
    expect(screen.getByTestId('map-tali-svg').props.accessibilityHint).toBe('pose:point');
  });

  it('порция потрачена и повторять нечего (pointer === null): Tali остаётся на карте в позе idle у последнего пройденного, тап — «на сегодня всё»', async () => {
    start();
    // два урока пройдены сегодня, порция на день кончилась, навыкам срок повторения не подошёл
    const entry = (i: number) => ({ lessonId: lessons[i].id, atlasEntryKey: lessons[i].atlasEntryKey, stars: 3 as const, firstLesson: i + 1 });
    const s = useChildSession.getState();
    useChildSession.setState({ portion: { left: 0, grantedDay: gameDay(NOW) }, progress: { ...s.progress, atlas: [entry(0), entry(1)], lessonCounter: 2 } });
    const model = buildMapModel(useChildSession.getState(), NOW);
    expect(model.pointer).toBeNull();
    expect(model.states.slice(0, 3)).toEqual(['done', 'done', 'sleeping']);

    await renderWithProviders(<MapScreen />);
    expect(screen.getByTestId('map-tali')).toBeTruthy();
    expect(screen.getByTestId('map-tali-svg').props.accessibilityHint).toBe('pose:idle');
    // у последнего пройденного узла (урок 2 — позиция 2 на ленте), а не у первого и не у «спящего»
    const g = LANE_GEOMETRY;
    const anchorX = (index: number) => Math.max(0, taliAnchor(nodeCenter(index, 0, g), { nodeSize: g.node, tali: taliSize.map, gap: mapLane.taliNodeGap }).x);
    expect(screen.getByTestId('map-tali-slot')).toHaveStyle({ left: anchorX(2) });
    expect(anchorX(2)).not.toBe(anchorX(1));
    await fireEvent.press(screen.getByTestId('map-tali-press'));
    expect(voice.last).toEqual({ key: 'map.taliRest', params: { region: 'в Числовой долине' } });
    // «спящий» урок без подушки; страницы в атласе есть — «к атласу» (книга) ведёт в коллекцию (D2)
    expect(screen.getByTestId('map-node-3')).toBeTruthy();
    expect(screen.queryByTestId('map-node-3-cushion')).toBeNull();
    expect(screen.queryByTestId('map-atlas-slot')).toBeNull();
    await fireEvent.press(screen.getByTestId('map-atlas'));
    expect(mockPush).toHaveBeenCalledWith('/atlas');
  });

  it('до первой страницы атласа «к атласу» — только пустое место той же ширины (не мёртвая цель)', async () => {
    start();
    await renderWithProviders(<MapScreen />);
    expect(screen.queryByTestId('map-atlas')).toBeNull();
    expect(screen.getByTestId('map-atlas-slot')).toBeTruthy();
  });

  describe('узел «повторение» (вопрос 56)', () => {
    const entry = (i: number) => ({ lessonId: lessons[i].id, atlasEntryKey: lessons[i].atlasEntryKey, stars: 3 as const, firstLesson: i });
    /** Урок 1 пройден; его навык виден вчера на уроке 0 — на счётчике 1 в срок. */
    const afterLesson = (lastSeenDay: string) => {
      const s = useChildSession.getState();
      useChildSession.setState({
        progress: { ...s.progress, skills: [{ ...emptySkill(lessons[0].tasks[0].skill), lastSeenLesson: 0, lastSeenDay, attempts: 1, correct: 1 }], atlas: [entry(0)], lessonCounter: 1 },
      });
    };

    it('узел повторения активен → push(/review), голос не звучит', async () => {
      start();
      afterLesson('2026-10-23');
      expect(buildMapModel(useChildSession.getState(), new Date()).review).toBe('active');
      await renderWithProviders(<MapScreen />);
      await fireEvent.press(screen.getByTestId('map-node-review'));
      expect(mockPush).toHaveBeenCalledWith('/review');
      expect(voice.last).toBeNull();
    });

    it('урок пройден, срок повторения не подошёл — узел тихий, голос map.reviewNothing, перехода нет', async () => {
      start();
      // экран карты живёт по настоящим часам: «встречен сегодня» — по реальному игровому дню
      const today = new Date();
      afterLesson(gameDay(today));
      expect(buildMapModel(useChildSession.getState(), today).review).toBe('quiet');
      await renderWithProviders(<MapScreen />);
      await fireEvent.press(screen.getByTestId('map-node-review'));
      expect(voice.last?.key).toBe('map.reviewNothing');
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
