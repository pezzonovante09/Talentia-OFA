/**
 * Карта региона на чистой установке (§2 дизайн-дока): полоса с названием, узлы «повторение» + открытый +
 * два замка + хвост, Tali у открытого узла; открытый узел ведёт в урок, замок отвечает голосом, «ползунки» —
 * родительский раздел (№141); без сеанса — редирект на первый запуск.
 */
import MapScreen from '../map';
import { regionLessons } from '../../src/content';
import { voice } from '../../src/services/voice';
import { useChildSession } from '../../src/state/childSession';
import { fireEvent, renderWithProviders, screen } from '../../src/test/render';

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

  it('Tali называет регион и следующий шаг; «ползунки» ведут в родительский раздел; атлас — голос', async () => {
    start();
    await renderWithProviders(<MapScreen />);
    await fireEvent.press(screen.getByTestId('map-tali-press'));
    expect(voice.last).toEqual({ key: 'map.taliTap', params: { region: 'в Числовой долине' } });
    await fireEvent.press(screen.getByTestId('map-atlas'));
    expect(voice.last?.key).toBe('map.atlasLater');
    await fireEvent.press(screen.getByTestId('map-settings'));
    expect(mockPush).toHaveBeenCalledWith('/parent');
  });

  it('focus: виден текущий узел с соседом и полоса целиком', async () => {
    start();
    await renderWithProviders(<MapScreen />, { focusMode: true });
    expect(screen.getByTestId('map-node-1')).toBeTruthy();
    expect(screen.getByTestId('map-node-2')).toBeTruthy();
    expect(screen.queryByTestId('map-node-3')).toBeNull();
    expect(screen.getByTestId('map-atlas')).toBeTruthy();
    expect(screen.getByTestId('map-settings')).toBeTruthy();
  });
});
