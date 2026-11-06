/**
 * Гейт окна `app/aba/index.tsx` (этап G1): без конфигурации — к родителю; с конфигурацией — в сессию или сопряжение по
 * `mode`, как только измерено окно; окно мало — экран «слишком мал» с кнопками 56, «Назад» — к родителю, окно выросло —
 * пропускает сам. Интерфейса выбора здесь больше нет — он на `parent/aba`.
 */
import MapScreen from '../../map';
import AbaGateScreen from '../index';
import { abaWindowPolicy } from '../../../src/design/abaTokens';
import { useAbaRun } from '../../../src/state/abaRun';
import { useChildSession } from '../../../src/state/childSession';
import { fireEvent, renderWithProviders, screen, waitFor } from '../../../src/test/render';

let mockParams: { mode?: string } = {};
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
  return {
    __router: router,
    useRouter: () => router,
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]),
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
  };
});
const router = (jest.requireMock('expo-router') as { __router: { replace: jest.Mock; push: jest.Mock } }).__router;

const layout = async (height: number) =>
  fireEvent(screen.getByTestId('aba-config').children[0] as never, 'layout', { nativeEvent: { layout: { height, width: 375, x: 0, y: 0 } } });

async function mount(height = 627) {
  await renderWithProviders(<AbaGateScreen />);
  await layout(height);
}

beforeEach(() => {
  router.replace.mockClear();
  router.push.mockClear();
  mockParams = {};
  useChildSession.getState().reset();
  useAbaRun.getState().set({ config: 'with_adult', observers: [{ id: 'obs-1', role: 'parent', trained: false }], primaryObserverId: 'obs-1' });
});

it('без конфигурации (пришли не через родителя) — редирект на parent/aba, окно не измеряется', async () => {
  useAbaRun.getState().reset();
  await renderWithProviders(<AbaGateScreen />);
  expect(screen.getByTestId('redirect').props.children).toBe('/parent/aba');
  expect(screen.queryByTestId('aba-config')).toBeNull();
  expect(router.replace).not.toHaveBeenCalled();
});

it('с конфигурацией и обычным окном — сразу в сессию, без push', async () => {
  await mount();
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/aba/session'));
  expect(router.push).not.toHaveBeenCalled();
  expect(screen.queryByTestId('aba-too-small')).toBeNull();
});

it('mode=pairing — в сопряжение', async () => {
  mockParams = { mode: 'pairing' };
  await mount();
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/aba/pairing'));
});

it('до измерения окна перехода нет: экран пустой на детском фоне', async () => {
  await renderWithProviders(<AbaGateScreen />);
  expect(router.replace).not.toHaveBeenCalled();
  expect(screen.queryByTestId('aba-too-small')).toBeNull();
  expect(screen.getByTestId('aba-config')).toBeTruthy();
});

it('окно меньше любого тира — экран «слишком мал», в сессию не идёт, кнопки 56', async () => {
  await mount(300);
  expect(screen.getByTestId('aba-too-small')).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();
  expect(screen.getByTestId('aba-regular').props.style.height).toBe(abaWindowPolicy.belowMinButtonHeight);
  expect(screen.getByTestId('aba-too-small-back').props.style.height).toBe(abaWindowPolicy.belowMinButtonHeight);
});

it('«слишком мал»: «Назад» — к родителю, «Обычные уроки» — на карту', async () => {
  await mount(300);
  await fireEvent.press(screen.getByTestId('aba-too-small-back'));
  expect(router.replace).toHaveBeenCalledWith('/parent/aba');
  await fireEvent.press(screen.getByTestId('aba-regular'));
  expect(router.replace).toHaveBeenCalledWith('/map');
});

it('«слишком мал»: занятие открыто ради другого ребёнка — «Обычные уроки» ведут к выбору профиля, а не на карту', async () => {
  useChildSession.setState({ childId: 'other', mode: 'account', openedForAba: true });
  await mount(300);
  await fireEvent.press(screen.getByTestId('aba-regular'));
  expect(router.replace.mock.calls).toEqual([['/']]);
  expect(useChildSession.getState()).toMatchObject({ childId: null, openedForAba: false });
});

describe('«слишком мал», занятие открыто ради другого ребёнка: все три выхода кончаются выбором профиля', () => {
  beforeEach(() => {
    useChildSession.setState({ childId: 'other', mode: 'account', openedForAba: true });
  });
  /** Экран гейта ушёл, навигатор отдал фокус карте под ним. */
  async function mapFocused() {
    await screen.unmount();
    router.replace.mockClear();
    await renderWithProviders(<MapScreen />);
  }
  const atProfiles = () => {
    expect(router.replace.mock.calls).toEqual([['/']]);
    expect(useChildSession.getState()).toMatchObject({ childId: null, mode: 'none', openedForAba: false });
  };

  it('«Обычные уроки»', async () => {
    await mount(300);
    await fireEvent.press(screen.getByTestId('aba-regular'));
    atProfiles();
  });

  it('«Назад»: родительский экран получает сессию и флаг целыми', async () => {
    await mount(300);
    await fireEvent.press(screen.getByTestId('aba-too-small-back'));
    expect(router.replace.mock.calls).toEqual([['/parent/aba']]);
    expect(useChildSession.getState()).toMatchObject({ childId: 'other', mode: 'account', openedForAba: true });
  });

  it('«Назад», затем уход от родителя на карту', async () => {
    await mount(300);
    await fireEvent.press(screen.getByTestId('aba-too-small-back'));
    await mapFocused();
    atProfiles();
  });

  it('системный «назад»: кнопок не нажимали, фокус вернулся карте', async () => {
    await mount(300);
    await mapFocused();
    atProfiles();
  });

  it('контроль: без флага «Обычные уроки» и фокус карты сессию не сбрасывают', async () => {
    useChildSession.setState({ openedForAba: false });
    await mount(300);
    await fireEvent.press(screen.getByTestId('aba-regular'));
    expect(router.replace.mock.calls).toEqual([['/map']]);
    await mapFocused();
    expect(router.replace).not.toHaveBeenCalled();
    expect(useChildSession.getState().childId).toBe('other');
  });
});

it('окно выросло — экран пропускает сам, без кнопки', async () => {
  await mount(300);
  expect(screen.getByTestId('aba-too-small')).toBeTruthy();
  await layout(627);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/aba/session'));
});
