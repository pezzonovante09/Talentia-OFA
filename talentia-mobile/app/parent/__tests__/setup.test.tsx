/**
 * Первая настройка (`app/parent/setup.tsx`): порог намерения → PIN → повтор → согласие.
 * Стор аккаунта подменяется на уровне действий (`useAccount.setState`), база не нужна; проверяется,
 * что экран зовёт нужные шаги и в нужном порядке.
 */
import SetupScreen from '../setup';
import { parentPin } from '../../../src/design/parentTokens';
import { AccountExistsError } from '../../../src/services/local/account';
import { useAccount, type AccountState } from '../../../src/state/account';
import { useChildSession } from '../../../src/state/childSession';
import { useGate } from '../../../src/state/gate';
import { ParentThemeProvider } from '../../../src/ui/parent/theme';
import { act, fireEvent, renderWithProviders, screen, waitFor } from '../../../src/test/render';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissAll: jest.fn() };
  return { useRouter: () => router, Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href), __router: router };
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

/** Экран шага — `setup-step-<шаг>`; PinPad шагов PIN — `setup-pin` / `setup-repeat` (свои ID клавиш). */
const onStep = (step: 'intent' | 'pin' | 'repeat' | 'consent') => expect(screen.getByTestId(`setup-step-${step}`)).toBeTruthy();

beforeEach(() => {
  jest.clearAllMocks();
  useGate.setState({ session: null });
  useAccount.setState({ status: 'none', accountId: null, db: null, profiles: [], consent: 'not_asked', createWithPin, grantConsent, abandonSetup });
  useChildSession.getState().reset();
});

/** Пройти шаги 1–3 до экрана согласия. */
async function toConsent() {
  const view = await render();
  await passIntent();
  await typePin('setup-pin', PIN);
  await waitFor(() => onStep('repeat'));
  await typePin('setup-repeat', PIN);
  await waitFor(() => onStep('consent'));
  return view;
}

describe('первая настройка', () => {
  it('шаг 1: порог намерения — задача, «Шаг 1 из 4», закрытие без аккаунта просто закрывает', async () => {
    await render();
    onStep('intent');
    expect(screen.getByRole('header', { name: 'Проверка для взрослых' })).toBeTruthy();
    expect(screen.getByText(/Шаг 1 из 4/)).toBeTruthy();
    expect(screen.getByTestId('intent-challenge').props.children).toMatch(/^\d+ × \d+ = \?$/);
    await fireEvent.press(screen.getByTestId('setup-close'));
    expect(abandonSetup).not.toHaveBeenCalled();
    expect(router.dismissAll).toHaveBeenCalled();
  });

  it('неверный ответ: сообщение, поле очищено, задача другая, шаг не меняется', async () => {
    // случайность по сценарию: вторая задача выпадает той же, что первая, — экран обязан взять другую
    const random = jest.spyOn(Math, 'random');
    [0, 0, 0, 0, 0.5, 0.5].forEach((v) => random.mockReturnValueOnce(v));
    try {
      await render();
      expect(screen.getByTestId('intent-challenge').props.children).toBe('13 × 13 = ?');
      await passIntent('1');
      expect(screen.getByTestId('intent-answer-error').props.children).toBe('Не сошлось. Вот другая задача');
      expect(screen.getByTestId('intent-answer').props.value).toBe('');
      onStep('intent');
      expect(screen.getByTestId('intent-challenge').props.children).toBe('21 × 21 = ?');
    } finally {
      random.mockRestore();
    }
  });

  it('верный ответ ведёт к шагу PIN; «Назад» возвращает к задаче', async () => {
    await render();
    await passIntent();
    onStep('pin');
    expect(screen.getByRole('header', { name: 'Придумайте PIN из шести цифр' })).toBeTruthy();
    await fireEvent.press(screen.getByTestId('setup-back'));
    onStep('intent');
  });

  it('testID экрана шага и PinPad не совпадают: на шагах PIN и повтора у каждого ровно один узел', async () => {
    await render();
    await passIntent();
    expect([screen.getAllByTestId('setup-step-pin'), screen.getAllByTestId('setup-pin')].map((xs) => xs.length)).toEqual([1, 1]);
    expect(screen.getByTestId('setup-step-pin')).not.toBe(screen.getByTestId('setup-pin'));
    await typePin('setup-pin', PIN);
    await waitFor(() => onStep('repeat'));
    expect([screen.getAllByTestId('setup-step-repeat'), screen.getAllByTestId('setup-repeat')].map((xs) => xs.length)).toEqual([1, 1]);
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

  /** Контрольный аудит 2026-11-09, Ж1: на устройстве уже есть аккаунт — второй не создаётся, родителя ведут ко входу по PIN. */
  describe('аккаунт на устройстве уже есть (AccountExistsError)', () => {
    const exists = () => jest.fn(async () => {
      throw new AccountExistsError('acc-existing');
    });

    async function repeatWithExisting() {
      const create = exists();
      useAccount.setState({ createWithPin: create });
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const view = await render();
      await passIntent();
      await typePin('setup-pin', PIN);
      await waitFor(() => onStep('repeat'));
      await typePin('setup-repeat', PIN);
      await waitFor(() => onStep('pin'));
      warn.mockRestore();
      return { view, create };
    }

    it('возврат на шаг PIN с текстом parent.setup.accountExists, а не «Не получилось»', async () => {
      await repeatWithExisting();
      expect(screen.getByText('Раздел «Для взрослых» на этом устройстве уже настроен. Закройте настройку и войдите по PIN.')).toBeTruthy();
      expect(screen.queryByText('Не получилось. Попробуйте ещё раз')).toBeNull();
    });

    it('аккаунт не создан: гейт не открыт, до согласия не дошли', async () => {
      const { create } = await repeatWithExisting();
      expect(create).toHaveBeenCalledTimes(1);
      expect(useGate.getState().unlocked()).toBe(false);
      expect(screen.queryByTestId('setup-step-consent')).toBeNull();
    });

    it('уход после отказа ничего не стирает (чужой живой аккаунт цел)', async () => {
      const { view } = await repeatWithExisting();
      await view.unmount();
      expect(abandonSetup).not.toHaveBeenCalled();
    });
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

  /**
   * Вопрос 84: ребёнок играл «без сохранения», взрослый завёл аккаунт с карты. После согласия порт пишет в
   * базу, а случайного `childId` этого сеанса нет ни в одном профиле — сеанс должен кончиться до выхода
   * из раздела любым путём (создание профиля или системное «назад»).
   */
  it('согласие принято при сеансе без записи: сеанс сброшен, дальше — выбор профиля', async () => {
    useChildSession.getState().startNoRecordSession({ childId: '00000000-0000-4000-8000-0000000000aa', now: new Date(), interfaceLang: 'ru' });
    await toConsent();
    expect(useChildSession.getState().mode).toBe('no_record');
    await fireEvent.press(screen.getByTestId('consent-accept'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/parent/profile/new'));
    expect(useChildSession.getState()).toMatchObject({ mode: 'none', childId: null, activeLesson: null });
  });

  it('согласие не записалось: сеанс без записи остаётся, ошибка на экране', async () => {
    useChildSession.getState().startNoRecordSession({ childId: '00000000-0000-4000-8000-0000000000aa', now: new Date(), interfaceLang: 'ru' });
    useAccount.setState({ grantConsent: jest.fn(async () => Promise.reject(new Error('внедрённый сбой записи'))) });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await toConsent();
      await fireEvent.press(screen.getByTestId('consent-accept'));
      await waitFor(() => expect(screen.getByTestId('consent-error')).toBeTruthy());
      expect(router.replace).not.toHaveBeenCalled();
      expect(useChildSession.getState()).toMatchObject({ mode: 'no_record', childId: '00000000-0000-4000-8000-0000000000aa' });
    } finally {
      warn.mockRestore();
    }
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

  /**
   * Вопрос 92: системное «назад» Android и браузера уводит с экрана без «Закрыть». Аккаунт с PIN и базой, но без
   * согласия, оставался бы до следующего запуска, а раздел родителя с ним — тупик. Стирает размонтирование.
   */
  describe('уход без согласия (вопрос 92)', () => {
    it('шаг согласия, уход без «Закрыть» (размонтирование): аккаунт стирается один раз', async () => {
      const view = await toConsent();
      expect(abandonSetup).not.toHaveBeenCalled();
      await view.unmount();
      await waitFor(() => expect(abandonSetup).toHaveBeenCalledTimes(1));
      expect(router.dismissAll).not.toHaveBeenCalled();
    });

    it('после согласия размонтирование ничего не стирает', async () => {
      const view = await toConsent();
      await fireEvent.press(screen.getByTestId('consent-accept'));
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/parent/profile/new'));
      await view.unmount();
      expect(abandonSetup).not.toHaveBeenCalled();
    });

    it('уход до создания аккаунта ничего не стирает', async () => {
      const view = await render();
      await passIntent();
      onStep('pin');
      await view.unmount();
      expect(abandonSetup).not.toHaveBeenCalled();
    });

    it('«Закрыть» на шаге согласия и затем размонтирование: стирание одно', async () => {
      useAccount.setState({
        createWithPin: jest.fn(async () => {
          useAccount.setState({ accountId: 'acc-1', status: 'ready' });
          return 'acc-1';
        }),
      });
      const view = await toConsent();
      await fireEvent.press(screen.getByTestId('setup-close'));
      await waitFor(() => expect(router.dismissAll).toHaveBeenCalled());
      await view.unmount();
      expect(abandonSetup).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['настоящий аккаунт', 'granted'],
      ['полуаккаунт', 'not_asked'],
    ] as const)('открыт поверх аккаунта (%s): сразу в раздел к гейту, ни шагов, ни стирания', async (_name, consent) => {
      useAccount.setState({ status: 'ready', accountId: 'acc-real', consent });
      const view = await render();
      expect(screen.getByTestId('redirect').props.children).toBe('/parent');
      expect(screen.queryByTestId('setup-step-intent')).toBeNull();
      await view.unmount();
      expect(abandonSetup).not.toHaveBeenCalled();
      expect(createWithPin).not.toHaveBeenCalled();
    });

    it('«Закрыть» не смогло стереть: ошибка на экране, из раздела не выходит, размонтирование пробует ещё раз', async () => {
      useAccount.setState({
        createWithPin: jest.fn(async () => {
          useAccount.setState({ accountId: 'acc-1', status: 'ready' });
          return 'acc-1';
        }),
      });
      abandonSetup.mockImplementationOnce(async () => Promise.reject(new Error('внедрённый сбой')));
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      try {
        const view = await toConsent();
        await fireEvent.press(screen.getByTestId('setup-close'));
        await waitFor(() => expect(screen.getByTestId('consent-error')).toBeTruthy());
        expect(router.dismissAll).not.toHaveBeenCalled();
        await view.unmount();
        await waitFor(() => expect(abandonSetup).toHaveBeenCalledTimes(2));
      } finally {
        warn.mockRestore();
      }
    });

    it('ушли, пока писалось согласие: стирание одно, ни сброса сеанса, ни перехода к профилю', async () => {
      let resolve: () => void = () => undefined;
      useAccount.setState({ grantConsent: jest.fn(() => new Promise<void>((r) => (resolve = r))) });
      useChildSession.getState().startNoRecordSession({ childId: '00000000-0000-4000-8000-0000000000aa', now: new Date(), interfaceLang: 'ru' });
      const view = await toConsent();
      await fireEvent.press(screen.getByTestId('consent-accept'));
      await view.unmount();
      await waitFor(() => expect(abandonSetup).toHaveBeenCalledTimes(1));
      await act(async () => resolve());
      expect(router.replace).not.toHaveBeenCalled();
      expect(useChildSession.getState().mode).toBe('no_record');
      expect(abandonSetup).toHaveBeenCalledTimes(1);
    });

    it('ушли, пока создавался аккаунт: он стирается сразу после создания', async () => {
      let resolve: (id: string) => void = () => undefined;
      useAccount.setState({ createWithPin: jest.fn(() => new Promise<string>((r) => (resolve = r))) });
      const view = await render();
      await passIntent();
      await typePin('setup-pin', PIN);
      await waitFor(() => onStep('repeat'));
      await typePin('setup-repeat', PIN);
      await view.unmount();
      expect(abandonSetup).not.toHaveBeenCalled();
      await act(async () => resolve('acc-1'));
      await waitFor(() => expect(abandonSetup).toHaveBeenCalledTimes(1));
    });
  });

  it('en: строки шагов переведены', async () => {
    await renderWithProviders(<ParentThemeProvider><SetupScreen /></ParentThemeProvider>, { lng: 'en' });
    expect(screen.getByText(/Step 1 of 4/)).toBeTruthy();
  });
});
