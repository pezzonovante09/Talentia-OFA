/**
 * Первая настройка (`app/parent/setup.tsx`): порог намерения → PIN → повтор → согласие.
 * Стор аккаунта подменяется на уровне действий (`useAccount.setState`), база не нужна; проверяется,
 * что экран зовёт нужные шаги и в нужном порядке.
 */
import SetupScreen from '../setup';
import { parentPin } from '../../../src/design/parentTokens';
import { useAccount, type AccountState } from '../../../src/state/account';
import { useGate } from '../../../src/state/gate';
import { ParentThemeProvider } from '../../../src/ui/parent/theme';
import { act, fireEvent, renderWithProviders, screen, waitFor } from '../../../src/test/render';

jest.mock('expo-router', () => {
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissAll: jest.fn() };
  return { useRouter: () => router, Redirect: () => null, __router: router };
});
const router = (jest.requireMock('expo-router') as { __router: { replace: jest.Mock; push: jest.Mock; dismissAll: jest.Mock } }).__router;

const PIN = '295173';
const createWithPin = jest.fn<Promise<string>, Parameters<AccountState['createWithPin']>>(async () => 'acc-1');
const grantConsent = jest.fn(async () => undefined);
const abandonSetup = jest.fn(async () => undefined);

const render = () => renderWithProviders(<ParentThemeProvider><SetupScreen /></ParentThemeProvider>);

/** Ответ на задачу порога намерения берётся из текста экрана: задача случайна. */
function challengeAnswer(): string {
  const text = String(screen.getByTestId('intent-challenge').props.children);
  const m = /(\d+) × (\d+)/.exec(text);
  if (!m) throw new Error(`не разобрать задачу: ${text}`);
  return String(Number(m[1]) * Number(m[2]));
}

async function passIntent(answer = challengeAnswer()) {
  for (const d of answer) await fireEvent.press(screen.getByTestId(`intent-keypad-${d}`));
  await fireEvent.press(screen.getByTestId('intent-next'));
}

async function typePin(keypad: string, pin: string) {
  for (const d of pin) await fireEvent.press(screen.getByTestId(`${keypad}-keypad-${d}`));
}

/** PinPad после ошибки держит «вспышку» и игнорирует ввод — ждём её конца на реальных таймерах. */
const afterFlash = () => act(() => new Promise<void>((r) => setTimeout(r, parentPin.errorFlashMs + 60)));

/** На шаге PIN `testID` экрана и PinPad совпадают (`setup-pin`) — проверяем наличие, не единственность. */
const onStep = (step: 'intent' | 'pin' | 'repeat' | 'consent') => expect(screen.getAllByTestId(`setup-${step}`).length).toBeGreaterThan(0);

beforeEach(() => {
  jest.clearAllMocks();
  useGate.setState({ session: null });
  useAccount.setState({ status: 'none', accountId: null, db: null, profiles: [], consent: 'not_asked', createWithPin, grantConsent, abandonSetup });
});

describe('первая настройка', () => {
  it('шаг 1: порог намерения — задача, «Шаг 1 из 4», закрытие без аккаунта просто закрывает', async () => {
    await render();
    onStep('intent');
    expect(screen.getByRole('header', { name: 'Проверка, что вы взрослый' })).toBeTruthy();
    expect(screen.getByText(/Шаг 1 из 4/)).toBeTruthy();
    expect(screen.getByTestId('intent-challenge').props.children).toMatch(/^\d+ × \d+ = \?$/);
    await fireEvent.press(screen.getByTestId('setup-close'));
    expect(abandonSetup).not.toHaveBeenCalled();
    expect(router.dismissAll).toHaveBeenCalled();
  });

  it('неверный ответ: сообщение, поле очищено, задача другая, шаг не меняется', async () => {
    await render();
    const before = screen.getByTestId('intent-challenge').props.children;
    await passIntent('1');
    expect(screen.getByTestId('intent-answer-error').props.children).toBe('Не сошлось. Вот другая задача');
    expect(screen.getByTestId('intent-answer').props.value).toBe('');
    onStep('intent');
    // новая задача (совпадение возможно, но крайне редко: 17×17 вариантов)
    expect(screen.getByTestId('intent-challenge').props.children === before).toBe(false);
  });

  it('верный ответ ведёт к шагу PIN; «Назад» возвращает к задаче', async () => {
    await render();
    await passIntent();
    onStep('pin');
    expect(screen.getByRole('header', { name: 'Придумайте PIN из шести цифр' })).toBeTruthy();
    await fireEvent.press(screen.getByTestId('setup-back'));
    onStep('intent');
  });

  it('слабый PIN отклонён с сообщением, аккаунт не создаётся, шаг тот же', async () => {
    await render();
    await passIntent();
    await typePin('setup-pin', '111111');
    await waitFor(() => expect(screen.getByTestId('setup-pin-error').props.children).toBe('Слишком простой PIN'));
    onStep('pin');
    expect(createWithPin).not.toHaveBeenCalled();
    await afterFlash();
    // после вспышки точки пусты — можно вводить заново
    expect(screen.queryAllByTestId('setup-pin-dots-on')).toHaveLength(0);
  });

  it('принятый PIN → шаг повтора; аккаунт ещё не создан', async () => {
    await render();
    await passIntent();
    await typePin('setup-pin', PIN);
    await waitFor(() => onStep('repeat'));
    expect(screen.getByRole('header', { name: 'Повторите PIN' })).toBeTruthy();
    expect(createWithPin).not.toHaveBeenCalled();
  });

  it('повтор не совпал: возврат к вводу PIN, аккаунт не создан', async () => {
    await render();
    await passIntent();
    await typePin('setup-pin', PIN);
    await waitFor(() => onStep('repeat'));
    await typePin('setup-repeat', '295174');
    await waitFor(() => onStep('pin'));
    expect(createWithPin).not.toHaveBeenCalled();
    // первый PIN забыт: новый ввод снова ведёт на повтор, а не создаёт аккаунт
    await typePin('setup-pin', PIN);
    await waitFor(() => onStep('repeat'));
    expect(createWithPin).not.toHaveBeenCalled();
  });

  /**
   * Баг: сообщение «Не совпало, попробуйте ещё раз» возвращается из `onComplete` PinPad'а шага
   * повтора, но `setStep('pin')` уже размонтировал этот PinPad — новый PinPad шага PIN пуст, и
   * родитель видит просто откат без объяснения. См. отчёт.
   */
  it('повтор не совпал: родитель видит сообщение о несовпадении', async () => {
    await render();
    await passIntent();
    await typePin('setup-pin', PIN);
    await waitFor(() => onStep('repeat'));
    await typePin('setup-repeat', '295174');
    await waitFor(() => onStep('pin'));
    expect(screen.getByText('Не совпало, попробуйте ещё раз')).toBeTruthy();
  });

  it('повтор совпал: createWithPin с этим PIN, гейт открыт, шаг согласия с текстом и версией', async () => {
    await render();
    await passIntent();
    await typePin('setup-pin', PIN);
    await waitFor(() => onStep('repeat'));
    await typePin('setup-repeat', PIN);
    await waitFor(() => onStep('consent'));
    expect(createWithPin).toHaveBeenCalledTimes(1);
    expect(createWithPin.mock.calls[0][0]).toBe(PIN);
    expect(typeof createWithPin.mock.calls[0][1]).toBe('function');
    expect(useGate.getState().unlocked()).toBe(true);
    expect(screen.getByRole('header', { name: 'Всё хранится на этом устройстве' })).toBeTruthy();
    expect(screen.getByTestId('consent-body').props.children).toMatch(/Ничего не уходит в интернет/);
    expect(screen.getByText(/Текст ru-draft-1 · /)).toBeTruthy();
    expect(screen.getByText('Шаг 4 из 4')).toBeTruthy();
    expect(grantConsent).not.toHaveBeenCalled();
  });

  it('согласие принято: grantConsent на языке экрана и переход к новому профилю', async () => {
    await render();
    await passIntent();
    await typePin('setup-pin', PIN);
    await waitFor(() => onStep('repeat'));
    await typePin('setup-repeat', PIN);
    await waitFor(() => onStep('consent'));
    await fireEvent.press(screen.getByTestId('consent-accept'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/parent/profile/new'));
    expect(grantConsent).toHaveBeenCalledWith('ru');
    expect(abandonSetup).not.toHaveBeenCalled();
  });

  it('ссылка на политику открывает /parent/policy, не сбрасывая шаг', async () => {
    await render();
    await passIntent();
    await typePin('setup-pin', PIN);
    await waitFor(() => onStep('repeat'));
    await typePin('setup-repeat', PIN);
    await waitFor(() => onStep('consent'));
    await fireEvent.press(screen.getByTestId('consent-policy'));
    expect(router.push).toHaveBeenCalledWith('/parent/policy');
    onStep('consent');
  });

  it('закрытие на шаге согласия = abandonSetup и выход из раздела (отказ после PIN не оставляет аккаунта)', async () => {
    useAccount.setState({
      createWithPin: jest.fn(async () => {
        useAccount.setState({ accountId: 'acc-1', status: 'ready' });
        return 'acc-1';
      }),
    });
    await render();
    await passIntent();
    await typePin('setup-pin', PIN);
    await waitFor(() => onStep('repeat'));
    await typePin('setup-repeat', PIN);
    await waitFor(() => onStep('consent'));
    await fireEvent.press(screen.getByTestId('setup-close'));
    await waitFor(() => expect(abandonSetup).toHaveBeenCalledTimes(1));
    expect(router.dismissAll).toHaveBeenCalled();
    expect(grantConsent).not.toHaveBeenCalled();
  });

  it('en: строки шагов переведены', async () => {
    await renderWithProviders(<ParentThemeProvider><SetupScreen /></ParentThemeProvider>, { lng: 'en' });
    expect(screen.getByText(/Step 1 of 4/)).toBeTruthy();
  });
});
