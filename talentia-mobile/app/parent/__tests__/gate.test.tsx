/**
 * Гейт как слой (`app/parent/_layout.tsx`): пока раздел закрыт, вместо экранов — PinPad; без
 * аккаунта открыты только первая настройка и политика; уход в фон закрывает раздел. PIN проверяется
 * настоящим `checkPin` на `fakeDevice()` — блокировка после пяти ошибок видна на экране.
 */
import { AppState } from 'react-native';

import ParentLayout from '../_layout';
import { parentPin } from '../../../src/design/parentTokens';
import { createLocalAccount } from '../../../src/services/local/account';
import { sha256 } from '../../../src/services/digest';
import { randomBytes } from '../../../src/services/random';
import { useAccount } from '../../../src/state/account';
import { setDevice } from '../../../src/state/device';
import { useGate } from '../../../src/state/gate';
import { fakeDevice } from '../../../src/test/fakeDevice';
import { act, fireEvent, renderWithProviders, screen, waitFor } from '../../../src/test/render';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissAll: jest.fn() };
  const nav = { pathname: '/parent' };
  return {
    __router: router,
    __nav: nav,
    useRouter: () => router,
    usePathname: () => nav.pathname,
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
    Stack: () => React.createElement(Text, { testID: 'stack-content' }, 'screens'),
  };
});
const { __router: router, __nav: nav } = jest.requireMock('expo-router') as { __router: { dismissAll: jest.Mock }; __nav: { pathname: string } };

const PIN = '295173';
let device = fakeDevice();

const render = () => renderWithProviders(<ParentLayout />);
async function typePin(pin: string) {
  for (const d of pin) await fireEvent.press(screen.getByTestId(`gate-pin-keypad-${d}`));
}
const afterFlash = () => act(() => new Promise<void>((r) => setTimeout(r, parentPin.errorFlashMs + 60)));
const keyOrder = () => screen.getAllByTestId(/^gate-pin-keypad-\d$/).map((k) => String(k.props.testID).slice(-1));

async function withAccount() {
  const id = await createLocalAccount(device, PIN, { randomBytes, digest: sha256 });
  useAccount.setState({ status: 'ready', accountId: id, profiles: [], consent: 'granted' });
  return id;
}

beforeEach(() => {
  jest.clearAllMocks();
  device = fakeDevice();
  setDevice(device);
  nav.pathname = '/parent';
  useGate.setState({ session: null });
  useAccount.setState({ status: 'none', accountId: null, db: null, profiles: [], consent: 'not_asked' });
});

afterEach(() => setDevice(null));

describe('без аккаунта', () => {
  it('любой маршрут раздела → редирект на первую настройку', async () => {
    await render();
    expect(screen.getByTestId('redirect').props.children).toBe('/parent/setup');
    expect(screen.queryByTestId('stack-content')).toBeNull();
    expect(screen.queryByTestId('parent-gate')).toBeNull();
  });

  it.each(['/parent/setup', '/parent/policy', '/parent/done'])('%s открыт без аккаунта и без PIN', async (path) => {
    nav.pathname = path;
    await render();
    expect(screen.getByTestId('stack-content')).toBeTruthy();
    expect(screen.queryByTestId('redirect')).toBeNull();
    expect(screen.queryByTestId('parent-gate')).toBeNull();
  });

  it('пока аккаунт загружается — ни гейта, ни редиректа, ни экранов', async () => {
    useAccount.setState({ status: 'loading' });
    await render();
    expect(screen.queryByTestId('redirect')).toBeNull();
    expect(screen.queryByTestId('parent-gate')).toBeNull();
    expect(screen.queryByTestId('stack-content')).toBeNull();
  });
});

describe('с аккаунтом', () => {
  it('раздел закрыт: вместо экранов — PinPad с заголовком и подсказкой; «Закрыть» выходит из раздела', async () => {
    await withAccount();
    await render();
    expect(screen.getByTestId('parent-gate')).toBeTruthy();
    expect(screen.getByTestId('gate-pin')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Для взрослых' })).toBeTruthy();
    expect(screen.getByText('Раскладка меняется при каждом входе')).toBeTruthy();
    expect(screen.queryByTestId('stack-content')).toBeNull();
    await fireEvent.press(screen.getByTestId('gate-close'));
    expect(router.dismissAll).toHaveBeenCalled();
  });

  it('клавиатура: десять цифр и «стереть»; стирание убирает последнюю точку', async () => {
    await withAccount();
    await render();
    expect(keyOrder().sort()).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    await typePin('29');
    expect(screen.getAllByTestId('gate-pin-dots-on')).toHaveLength(2);
    await fireEvent.press(screen.getByTestId('gate-pin-keypad-back'));
    expect(screen.getAllByTestId('gate-pin-dots-on')).toHaveLength(1);
  });

  it('неверный PIN: «Неверный PIN», раздел закрыт, после вспышки раскладка перемешана заново', async () => {
    await withAccount();
    await render();
    const before = keyOrder();
    await typePin('000000');
    await waitFor(() => expect(screen.getByTestId('gate-pin-error').props.children).toBe('Неверный PIN'));
    expect(screen.queryByTestId('stack-content')).toBeNull();
    expect(useGate.getState().unlocked()).toBe(false);
    await afterFlash();
    expect(screen.queryAllByTestId('gate-pin-dots-on')).toHaveLength(0);
    // новая перестановка; совпадение с прежней — 1 к 3 628 800
    expect(keyOrder()).not.toEqual(before);
  });

  it('с третьей ошибки показывается число оставшихся попыток', async () => {
    await withAccount();
    await render();
    for (let i = 0; i < 3; i += 1) {
      await typePin('000000');
      await afterFlash();
    }
    await waitFor(() => expect(screen.getByTestId('gate-pin-error').props.children).toBe('Неверный PIN. Осталось попыток: 2'));
  });

  it('пять ошибок подряд: клавиатуры нет, идёт таймер блокировки', async () => {
    await withAccount();
    await render();
    for (let i = 0; i < 5; i += 1) {
      await typePin('000000');
      await afterFlash();
    }
    await waitFor(() => expect(screen.getByTestId('gate-pin-locked')).toBeTruthy());
    expect(screen.queryByTestId('gate-pin-keypad')).toBeNull();
    expect(screen.getByTestId('gate-pin-timer').props.children).toMatch(/^[01]:[0-5]\d$/);
    expect(useGate.getState().unlocked()).toBe(false);
  });

  it('верный PIN открывает раздел: экраны вместо гейта', async () => {
    await withAccount();
    await render();
    await typePin(PIN);
    await waitFor(() => expect(screen.getByTestId('stack-content')).toBeTruthy());
    expect(screen.queryByTestId('parent-gate')).toBeNull();
    expect(useGate.getState().unlocked()).toBe(true);
  });

  it('открытый раздел рендерит экраны сразу; уход приложения в фон закрывает его', async () => {
    await withAccount();
    useGate.getState().open();
    await render();
    expect(screen.getByTestId('stack-content')).toBeTruthy();
    // обработчик AppState — из штатного jest.fn RN, без подмены реализации
    const calls = (AppState.addEventListener as unknown as jest.Mock).mock.calls as [string, (st: string) => void][];
    const handlers = calls.filter(([ev]) => ev === 'change').map(([, cb]) => cb);
    expect(handlers.length).toBeGreaterThan(0);
    await act(async () => handlers.forEach((cb) => cb('background')));
    expect(useGate.getState().session).toBeNull();
    await waitFor(() => expect(screen.getByTestId('parent-gate')).toBeTruthy());
    expect(screen.queryByTestId('stack-content')).toBeNull();
  });

  it('состояние inactive (шторка, звонок) тоже закрывает раздел', async () => {
    await withAccount();
    useGate.getState().open();
    await render();
    const calls = (AppState.addEventListener as unknown as jest.Mock).mock.calls as [string, (st: string) => void][];
    await act(async () => calls.filter(([ev]) => ev === 'change').forEach(([, cb]) => cb('inactive')));
    await waitFor(() => expect(screen.getByTestId('parent-gate')).toBeTruthy());
  });

  it('размонтирование группы (выход из раздела) закрывает гейт', async () => {
    await withAccount();
    useGate.getState().open();
    const view = await render();
    expect(screen.getByTestId('stack-content')).toBeTruthy();
    await view.unmount();
    expect(useGate.getState().session).toBeNull();
  });

  it('устаревшее согласие при открытом гейте: главная и настройки → /parent/reconsent', async () => {
    await withAccount();
    useAccount.setState({ consent: 'outdated' });
    useGate.getState().open();
    await render();
    expect(screen.getByTestId('redirect').props.children).toBe('/parent/reconsent');
    expect(screen.queryByTestId('stack-content')).toBeNull();
  });

  it.each(['/parent/reconsent', '/parent/policy', '/parent/confirm/delete_account', '/parent/done'])('устаревшее согласие: %s открыт', async (path) => {
    await withAccount();
    useAccount.setState({ consent: 'outdated' });
    useGate.getState().open();
    nav.pathname = path;
    await render();
    expect(screen.getByTestId('stack-content')).toBeTruthy();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });

  it('устаревшее согласие при закрытом гейте: сначала PIN, а не редирект', async () => {
    await withAccount();
    useAccount.setState({ consent: 'outdated' });
    await render();
    expect(screen.getByTestId('parent-gate')).toBeTruthy();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });

  it('первая настройка доступна и при закрытом гейте (PIN ещё не придуман)', async () => {
    await withAccount();
    nav.pathname = '/parent/setup';
    await render();
    expect(screen.getByTestId('stack-content')).toBeTruthy();
    expect(screen.queryByTestId('parent-gate')).toBeNull();
  });
});

/**
 * Вопрос 92: PIN придуман, согласия нет, первая настройка покинута (системное «назад»). Вне её экранов такой
 * аккаунт стирается до гейта, как на старте, и раздел ведёт на первую настройку — ни главной, ни профиля, ни
 * повторного согласия по ссылке.
 */
describe('полуаккаунт (вопрос 92)', () => {
  const real = useAccount.getState().abandonSetup;
  const abandonSetup = jest.fn(async () => {
    useAccount.setState({ status: 'none', accountId: null, db: null, profiles: [], consent: 'not_asked' });
  });

  beforeEach(async () => {
    const id = await createLocalAccount(device, PIN, { randomBytes, digest: sha256 });
    useAccount.setState({ status: 'ready', accountId: id, profiles: [], consent: 'not_asked', abandonSetup });
  });
  afterEach(() => useAccount.setState({ abandonSetup: real }));

  it.each(['/parent', '/parent/reconsent', '/parent/profile/new'])('%s: стирается без PIN, затем — первая настройка', async (path) => {
    nav.pathname = path;
    await render();
    await waitFor(() => expect(screen.getByTestId('redirect').props.children).toBe('/parent/setup'));
    expect(abandonSetup).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('parent-gate')).toBeNull();
    expect(screen.queryByTestId('stack-content')).toBeNull();
  });

  it.each(['/parent/setup', '/parent/policy'])('%s: первая настройка идёт — не стирается', async (path) => {
    nav.pathname = path;
    await render();
    expect(screen.getByTestId('stack-content')).toBeTruthy();
    expect(abandonSetup).not.toHaveBeenCalled();
  });

  it('стирание не удалось: экран с «Закрыть», без гейта и экранов, повторно не стирает', async () => {
    abandonSetup.mockImplementationOnce(async () => {
      throw new Error('внедрённый сбой');
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await render();
      await waitFor(() => expect(abandonSetup).toHaveBeenCalledTimes(1));
      expect(screen.getByTestId('parent-half-account')).toBeTruthy();
      expect(screen.queryByTestId('parent-gate')).toBeNull();
      expect(screen.queryByTestId('stack-content')).toBeNull();
      await fireEvent.press(screen.getByTestId('half-account-close'));
      expect(router.dismissAll).toHaveBeenCalled();
      expect(abandonSetup).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
});

/**
 * Контрольный аудит 2026-11-09, Ж1: аккаунт есть, открыть не вышло (`status: 'error'`) — не первая настройка
 * и не гейт, а экран «Повторить»; данные не трогаются. «Повторить» зовёт `boot`, успех — обычный путь через PIN.
 */
describe('сбой открытия аккаунта (Ж1)', () => {
  const real = useAccount.getState().boot;
  afterEach(() => useAccount.setState({ boot: real }));

  it('status error: экран «Не удалось открыть данные» вместо гейта, редиректа и экранов', async () => {
    useAccount.setState({ status: 'error' });
    await render();
    expect(screen.getByTestId('parent-boot-error')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Не удалось открыть данные' })).toBeTruthy();
    expect(screen.queryByTestId('parent-gate')).toBeNull();
    expect(screen.queryByTestId('redirect')).toBeNull();
    expect(screen.queryByTestId('stack-content')).toBeNull();
  });

  it.each(['/parent/setup', '/parent/done', '/parent/confirm/delete_account'])('status error: %s тоже не открыт', async (path) => {
    useAccount.setState({ status: 'error' });
    nav.pathname = path;
    await render();
    expect(screen.getByTestId('parent-boot-error')).toBeTruthy();
    expect(screen.queryByTestId('stack-content')).toBeNull();
  });

  it('«Закрыть» выходит из раздела', async () => {
    useAccount.setState({ status: 'error' });
    await render();
    await fireEvent.press(screen.getByTestId('boot-error-close'));
    expect(router.dismissAll).toHaveBeenCalled();
  });

  it('«Повторить» зовёт boot; успех переводит в ready — дальше гейт с PIN', async () => {
    const id = await createLocalAccount(device, PIN, { randomBytes, digest: sha256 });
    const boot = jest.fn(async () => {
      useAccount.setState({ status: 'ready', accountId: id, profiles: [], consent: 'granted' });
    });
    useAccount.setState({ status: 'error', boot });
    await render();
    await fireEvent.press(screen.getByTestId('boot-error-retry'));
    expect(boot).toHaveBeenCalledTimes(1);
    expect(useAccount.getState().status).toBe('ready');
    await waitFor(() => expect(screen.getByTestId('parent-gate')).toBeTruthy());
    expect(screen.queryByTestId('parent-boot-error')).toBeNull();
    expect(screen.queryByTestId('stack-content')).toBeNull();
  });

  it('«Повторить» снова не удалось (boot бросил): остаётся error и экран «Повторить»', async () => {
    const boot = jest.fn(async () => {
      throw new Error('внедрённый сбой');
    });
    useAccount.setState({ status: 'error', boot });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await render();
      await fireEvent.press(screen.getByTestId('boot-error-retry'));
      await waitFor(() => expect(boot).toHaveBeenCalledTimes(1));
      expect(useAccount.getState().status).toBe('error');
      expect(screen.getByTestId('parent-boot-error')).toBeTruthy();
      expect(screen.queryByTestId('redirect')).toBeNull();
    } finally {
      warn.mockRestore();
    }
  });
});

/** Контрольный аудит 2026-11-09, приватность п. 8: при живом аккаунте «Удалено» и подтверждение удаления — за гейтом. */
describe('маршруты без гейта при живом аккаунте', () => {
  it.each(['/parent/confirm/delete_account', '/parent/done'])('%s при закрытом гейте → PinPad, а не экран', async (path) => {
    await withAccount();
    nav.pathname = path;
    await render();
    expect(screen.getByTestId('parent-gate')).toBeTruthy();
    expect(screen.queryByTestId('stack-content')).toBeNull();
  });

  it.each(['/parent/setup', '/parent/policy'])('%s при закрытом гейте открыт', async (path) => {
    await withAccount();
    nav.pathname = path;
    await render();
    expect(screen.getByTestId('stack-content')).toBeTruthy();
    expect(screen.queryByTestId('parent-gate')).toBeNull();
  });

  it.each(['/parent/done', '/parent/confirm/delete_account'])('без аккаунта (status none) %s открыт — удаление в полёте', async (path) => {
    nav.pathname = path;
    await render();
    expect(screen.getByTestId('stack-content')).toBeTruthy();
    expect(screen.queryByTestId('parent-gate')).toBeNull();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });
});
