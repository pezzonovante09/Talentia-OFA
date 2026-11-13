/**
 * Коллекция атласа (D2 дизайн-дока этапа D): пустое состояние с Tali `idle`, «Атлас пока пустой» и «К карте» 88;
 * со страницами — карточки по порядку `firstLesson` и одна «?»; тап по карточке → страница `readOnly`; двойной тап
 * по двум карточкам — один переход; «К карте» в полосе → карта; focus — один столбец; без сеанса — редирект.
 */
import AtlasCollectionScreen from '../atlas/index';
import type { AtlasEntry } from '../../src/domain/lessonAssembly';
import { voice } from '../../src/services/voice';
import { useChildSession } from '../../src/state/childSession';
import { fireEvent, renderWithProviders, screen } from '../../src/test/render';

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
const router = (jest.requireMock('expo-router') as { __router: { push: jest.Mock; navigate: jest.Mock } }).__router;
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
const KID = '00000000-0000-4000-8000-000000000005';
const entry = (lessonId: string, firstLesson: number): AtlasEntry => ({ lessonId, atlasEntryKey: `content.numbers.${lessonId}.atlas`, stars: 3, firstLesson });

function startWith(atlas: AtlasEntry[]) {
  const s = useChildSession.getState();
  s.startNoRecordSession({ childId: KID, now: NOW, interfaceLang: 'ru' });
  useChildSession.setState({ progress: { ...useChildSession.getState().progress, atlas, lessonCounter: atlas.length } });
}

beforeEach(() => {
  router.push.mockClear();
  router.navigate.mockClear();
  voice.stop();
  useChildSession.getState().reset();
});

describe('коллекция атласа', () => {
  it('без сеанса — редирект на первый запуск', async () => {
    await renderWithProviders(<AtlasCollectionScreen />);
    expect(screen.getByTestId('redirect').props.children).toBe('/');
  });

  it('пусто: Tali idle, «Атлас пока пустой», одна «?», «К карте» 88; голос при открытии — «Атлас»', async () => {
    startWith([]);
    await renderWithProviders(<AtlasCollectionScreen />);
    expect(voice.last?.key).toBe('atlas.title');
    expect(screen.getByTestId('atlas-empty')).toBeTruthy();
    expect(screen.getByTestId('atlas-empty-tali-svg').props.accessibilityHint).toBe('pose:idle');
    expect(screen.getByText('Атлас пока пустой — давай начнём!')).toBeTruthy();
    expect(screen.getByTestId('atlas-future-card')).toBeTruthy();
    expect(screen.queryByTestId('atlas-grid')).toBeNull();
    await fireEvent.press(screen.getByTestId('atlas-to-map'));
    expect(router.navigate).toHaveBeenCalledWith('/map');
  });

  it('одна страница: карточка с названием урока, кучкой с метками и печатью, после неё одна «?»; тап → страница readOnly', async () => {
    startWith([entry('nv-count-l1', 1)]);
    await renderWithProviders(<AtlasCollectionScreen />);
    expect(screen.getByTestId('atlas-title').props.children).toBe('Атлас');
    expect(screen.getByTestId('atlas-card-1')).toBeTruthy();
    expect(screen.getByTestId('atlas-card-1-cushion')).toBeTruthy();
    expect(screen.getByTestId('atlas-card-1-stamp')).toBeTruthy();
    expect(screen.getByTestId('atlas-card-1-finding-tile')).toBeTruthy();
    expect(screen.getAllByTestId(/^atlas-card-1-finding-pile-mark-\d$/)).toHaveLength(2);
    expect(screen.queryByTestId('atlas-card-2')).toBeNull();
    expect(screen.getAllByTestId('atlas-future-card')).toHaveLength(1);
    expect(screen.queryByTestId('atlas-empty')).toBeNull();
    await fireEvent.press(screen.getByTestId('atlas-card-1'));
    expect(router.push).toHaveBeenCalledWith('/atlas/nv-count-l1?readOnly=1');
  });

  it('порядок по firstLesson; кучка ≥ 6 — карточка-цифра; двойной тап по двум карточкам — один переход', async () => {
    startWith([entry('nv-count-l3', 3), entry('nv-count-l1', 1)]);
    await renderWithProviders(<AtlasCollectionScreen />);
    expect(screen.getByTestId('atlas-card-1-title').props.children).toBe('Один, два, три');
    expect(screen.getByTestId('atlas-card-2-finding-numeral')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('atlas-card-1'));
    await fireEvent.press(screen.getByTestId('atlas-card-2'));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/atlas/nv-count-l1?readOnly=1');
  });

  it('«?» отвечает голосом и никуда не ведёт; «К карте» в полосе → карта', async () => {
    startWith([entry('nv-count-l1', 1)]);
    await renderWithProviders(<AtlasCollectionScreen />);
    await fireEvent.press(screen.getByTestId('atlas-future-card'));
    expect(voice.last?.key).toBe('atlas.pageAhead');
    expect(router.push).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('atlas-band-map'));
    expect(router.navigate).toHaveBeenCalledWith('/map');
  });

  it('focus: один столбец, Tali в пустом состоянии убран', async () => {
    startWith([entry('nv-count-l1', 1)]);
    const grid = await renderWithProviders(<AtlasCollectionScreen />, { focusMode: true });
    // один столбец: карточки по центру списка, без обёртки ряда
    expect(screen.getByTestId('atlas-grid').props.contentContainerStyle).toEqual(expect.objectContaining({ alignItems: 'center' }));
    await grid.unmount();
    useChildSession.getState().reset();
    startWith([]);
    await renderWithProviders(<AtlasCollectionScreen />, { focusMode: true });
    expect(screen.queryByTestId('atlas-empty-tali')).toBeNull();
  });
});
