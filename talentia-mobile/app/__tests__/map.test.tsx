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
import { DEFAULT_SETTINGS, useChildSession } from '../../src/state/childSession';
import { buildMapModel } from '../../src/state/mapModel';
import { useParentView } from '../../src/state/parentView';
import { act, fireEvent, renderWithProviders, screen } from '../../src/test/render';
import * as abaLeave from '../../src/ui/aba/leaveAba';
import { LANE_GEOMETRY } from '../../src/ui/map/MapLane';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };
  /** Последний колбэк фокуса: «вернулись на экран» — вызвать его снова, как навигатор при возврате. */
  const focus: { current: (() => void) | null } = { current: null };
  return {
    __router: router,
    __focus: focus,
    useRouter: () => router,
    useFocusEffect: (cb: () => void) => {
      focus.current = cb;
      return React.useEffect(cb, [cb]);
    },
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
  };
});
const { __router: mockRouter, __focus: mockFocus } = jest.requireMock('expo-router') as {
  __router: { push: jest.Mock; replace: jest.Mock; dismissTo: jest.Mock };
  __focus: { current: (() => void) | null };
};
const mockPush = mockRouter.push;
/** Ленте карты приходит `focusKey`: по нему она центруется при каждом появлении экрана. Оборачиваем, чтобы видеть его. */
const mockFocusKeys: number[] = [];
jest.mock('../../src/ui/map/MapLane', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const actual = jest.requireActual<typeof import('../../src/ui/map/MapLane')>('../../src/ui/map/MapLane');
  return {
    ...actual,
    MapLane: (props: Parameters<typeof actual.MapLane>[0]) => {
      mockFocusKeys.push(props.focusKey);
      return React.createElement(actual.MapLane, props);
    },
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

const NOW = new Date('2026-10-24T10:00:00.000Z');
const KID = '00000000-0000-4000-8000-000000000002';
const lessons = regionLessons('numbers');
const start = () => useChildSession.getState().startNoRecordSession({ childId: KID, now: NOW, interfaceLang: 'ru' });

beforeEach(() => {
  mockPush.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.dismissTo.mockClear();
  mockFocus.current = null;
  mockFocusKeys.length = 0;
  voice.stop();
  useChildSession.getState().reset();
});

describe('фокус карты: сессию сменили ради занятия ABA, а вышли мимо него (`openedForAba`)', () => {
  const lastFocusKey = () => mockFocusKeys[mockFocusKeys.length - 1];
  const flagged = () => {
    start();
    useChildSession.setState({ mode: 'account', openedForAba: true });
  };
  /** Навигатор вернул фокус на смонтированную карту. */
  const refocus = () => act(async () => mockFocus.current!());

  it('с флагом: ведёт на «/» заменой, на карту не остаётся', async () => {
    flagged();
    await renderWithProviders(<MapScreen />);
    expect(mockRouter.replace.mock.calls).toEqual([['/']]);
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  });

  it('с флагом: детская сессия сброшена вместе с флагом', async () => {
    flagged();
    await renderWithProviders(<MapScreen />);
    expect(useChildSession.getState()).toMatchObject({ childId: null, mode: 'none', openedForAba: false });
  });

  describe('фокус с флагом только уводит: лента не получает нового `focusKey`', () => {
    // настоящий `leaveAba` снимает экран сбросом сессии, и `focusKey` уже не виден: подмена оставляет экран стоять
    let stay: jest.SpyInstance;
    beforeEach(() => {
      stay = jest.spyOn(abaLeave, 'leaveAba').mockImplementation(() => undefined);
    });
    afterEach(() => {
      stay.mockRestore();
    });

    it('на первом фокусе', async () => {
      flagged();
      await renderWithProviders(<MapScreen />);
      expect(stay).toHaveBeenCalledTimes(1);
      expect(Math.max(...mockFocusKeys)).toBe(0);
    });

    it('на возврате к карте', async () => {
      start();
      await renderWithProviders(<MapScreen />);
      const before = lastFocusKey();
      useChildSession.setState({ openedForAba: true });
      await refocus();
      expect(stay).toHaveBeenCalledTimes(1);
      expect(lastFocusKey()).toBe(before);
    });
  });

  it('с флагом: режимы calm и focus не теряются', async () => {
    flagged();
    useChildSession.getState().setSettings({ calmMode: true, focusMode: true });
    await renderWithProviders(<MapScreen />);
    expect(useChildSession.getState().settings).toEqual({ ...DEFAULT_SETTINGS, calmMode: true, focusMode: true });
  });

  it('флаг поставлен, пока карта лежала под другими экранами: на возврате — к выбору профиля', async () => {
    start();
    useChildSession.setState({ mode: 'account' });
    await renderWithProviders(<MapScreen />);
    useChildSession.setState({ openedForAba: true });
    await refocus();
    expect(mockRouter.replace.mock.calls).toEqual([['/']]);
  });

  it('контроль: без флага переходов нет, сессия на месте', async () => {
    start();
    await renderWithProviders(<MapScreen />);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(useChildSession.getState().childId).toBe(KID);
  });

  it('контроль: без флага `focusKey` растёт на каждом фокусе', async () => {
    start();
    await renderWithProviders(<MapScreen />);
    const first = lastFocusKey();
    await refocus();
    await refocus();
    expect(lastFocusKey()).toBe(first + 2);
  });
});

describe('карта региона', () => {
  it('без сеанса — редирект на первый запуск', async () => {
    await renderWithProviders(<MapScreen />);
    expect(screen.getByTestId('redirect').props.children).toBe('/');
  });

  it('чистая установка: полоса, узлы review + 1 + два замка, Tali у открытого', async () => {
    start();
    await renderWithProviders(<MapScreen />);
    expect(screen.getByTestId('map-title').props.children).toBe('Мир чисел');
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
    expect(voice.last).toEqual({ key: 'map.taliTap', params: { region: 'в Мире чисел' } });
    // вопрос 60: кнопка с вечной голосовой заглушкой — мёртвая цель; место под неё остаётся, название по центру
    expect(screen.queryByTestId('map-atlas')).toBeNull();
    expect(screen.getByTestId('map-atlas-slot')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('map-settings'));
    expect(mockPush).toHaveBeenCalledWith('/parent');
  });

  describe('«ползунки»: раздел родителя открывается на ребёнке этой карты', () => {
    const OTHER = '00000000-0000-4000-8000-000000000003';
    beforeEach(() => {
      useParentView.setState({ childId: OTHER });
    });
    afterEach(() => {
      useParentView.setState({ childId: null });
    });

    it('с аккаунтом: выбран ребёнок сессии', async () => {
      start();
      useChildSession.setState({ mode: 'account' });
      await renderWithProviders(<MapScreen />);
      await fireEvent.press(screen.getByTestId('map-settings'));
      expect(useParentView.getState().childId).toBe(KID);
    });

    it('с аккаунтом: выбор сделан до перехода', async () => {
      start();
      useChildSession.setState({ mode: 'account' });
      const seen: { id: string | null } = { id: null };
      mockPush.mockImplementationOnce(() => {
        seen.id = useParentView.getState().childId;
      });
      await renderWithProviders(<MapScreen />);
      await fireEvent.press(screen.getByTestId('map-settings'));
      expect(seen.id).toBe(KID);
    });

    it('без записи (no_record): выбор не трогается, переход тот же', async () => {
      start();
      await renderWithProviders(<MapScreen />);
      await fireEvent.press(screen.getByTestId('map-settings'));
      expect(useParentView.getState().childId).toBe(OTHER);
      expect(mockPush).toHaveBeenCalledWith('/parent');
    });
  });

  it('обычный вид: название-наклейка, одна заливка поверх контура, для скринридера один заголовок', async () => {
    start();
    await renderWithProviders(<MapScreen />);
    expect(screen.getByTestId('map-title-sticker')).toBeTruthy();
    expect(screen.getAllByText('Мир чисел', { includeHiddenElements: false })).toHaveLength(1);
    expect(screen.queryByTestId('map-atlas-slot')).toBeTruthy();
  });

  it('calm: без наклейки, плоская надпись и ориентир на песке', async () => {
    start();
    await renderWithProviders(<MapScreen />, { calmMode: true });
    expect(screen.queryByTestId('map-title-sticker')).toBeNull();
    expect(screen.getByTestId('map-title').props.children).toBe('Мир чисел');
    expect(screen.getByTestId('map-landmark-sand')).toBeTruthy();
  });

  it('focus: без наклейки, плоская надпись', async () => {
    start();
    await renderWithProviders(<MapScreen />, { focusMode: true });
    expect(screen.queryByTestId('map-title-sticker')).toBeNull();
    expect(screen.getByTestId('map-title').props.children).toBe('Мир чисел');
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
    expect(voice.last).toEqual({ key: 'map.taliRest', params: { region: 'в Мире чисел' } });
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
