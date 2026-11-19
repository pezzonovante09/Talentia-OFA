/**
 * Первый запуск на чистой установке (docs/design/slice-screens-2026-10-24.md §1): одна карточка
 * «+ Добавить», одна `primary`, тап ребёнка открывает сеанс без записи и ведёт на карту; путь
 * взрослого ведёт в родительский раздел (гейт — слой его `_layout`); focus убирает Tali.
 * С аккаунтом: карточки детей, кнопки без записи нет, тап по карточке читает прогресс через порт.
 */
import FirstRunScreen from '../index';
import { newProfile } from '../../src/services/local/profiles';
import { EMPTY_PROGRESS, noRecordPort } from '../../src/services/progressPort';
import { voice } from '../../src/services/voice';
import { useAccount } from '../../src/state/account';
import { useChildSession } from '../../src/state/childSession';
import { setProgressPort } from '../../src/state/port';
import { Animated } from 'react-native';

import { act, fireEvent, renderWithProviders, screen } from '../../src/test/render';
import { firstRun, profileCard } from '../../src/design/tokens';

jest.mock('expo-router', () => {
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
  return { useRouter: () => router, Redirect: () => null, __router: router };
});
// Все svg в Jest — один мок; позы Tali помечаются именем, как в atlas.test.tsx.
jest.mock('../../src/assets/registry', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const actual = jest.requireActual<typeof import('../../src/assets/registry')>('../../src/assets/registry');
  const poses = Object.fromEntries(
    Object.keys(actual.TALI_POSES).map((pose) => [pose, (props: Record<string, unknown>) => React.createElement(View, { ...props, accessibilityHint: `pose:${pose}` })]),
  );
  return { ...actual, TALI_POSES: poses };
});
const { replace: mockReplace, push: mockPush } = (jest.requireMock('expo-router') as { __router: { replace: jest.Mock; push: jest.Mock } }).__router;

const KID = '00000000-0000-4000-8000-000000000031';
const profile = (childId: string, name = '') => newProfile({ childId, name, band: '5-6', interfaceLang: 'ru', createdAt: '2026-10-25T00:00:00.000Z' });
const withAccount = (profiles = [profile(KID, 'Айдар')], consent: 'granted' | 'outdated' = 'granted') =>
  useAccount.setState({ status: 'ready', accountId: 'acc', profiles, consent });

beforeEach(() => {
  mockReplace.mockClear();
  mockPush.mockClear();
  voice.stop();
  useChildSession.getState().reset();
  useAccount.setState({ status: 'none', accountId: null, db: null, profiles: [], consent: 'not_asked' });
  setProgressPort(noRecordPort);
});

describe('первый запуск', () => {
  it('состав: Tali, заголовок, одна карточка «добавить», одна главная кнопка, подпись, вход для взрослых', async () => {
    await renderWithProviders(<FirstRunScreen />);
    expect(screen.getByTestId('tali')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Кто сегодня исследует?' })).toBeTruthy();
    expect(screen.getAllByTestId('profile-add')).toHaveLength(1);
    expect(screen.getByTestId('try-without-saving')).toBeTruthy();
    expect(screen.getByText('Прогресс не сохранится после закрытия')).toBeTruthy();
    expect(screen.getByTestId('for-adults')).toBeTruthy();
    // Единственная подушка у кнопки ребёнка: карточка пунктирная, вход для взрослых плоский.
    expect(screen.getAllByTestId(/-cushion$/)).toHaveLength(1);
    expect(voice.last?.key).toBe('firstRun.title');
  });

  it('«Попробовать без сохранения» открывает сеанс 5-6 без записи и ведёт на карту', async () => {
    await renderWithProviders(<FirstRunScreen />);
    await fireEvent.press(screen.getByTestId('try-without-saving'));
    const s = useChildSession.getState();
    expect(s.mode).toBe('no_record');
    expect(s.childId).toMatch(/^[0-9a-f-]{36}$/);
    expect(s.settings.band).toBe('5-6');
    expect(s.settings.interfaceLang).toBe('ru');
    expect(mockReplace).toHaveBeenCalledWith('/map');
  });

  it('«+ Добавить» без аккаунта: первый тап — голос «позови взрослого», замок и подпись «Для взрослых»; второй в 3 с — родительский раздел', async () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    await renderWithProviders(<FirstRunScreen />);
    expect(screen.getByTestId('profile-add-lock')).toBeTruthy();
    expect(screen.getAllByText('Для взрослых')).toHaveLength(2);
    await fireEvent.press(screen.getByTestId('profile-add'));
    expect(voice.last?.key).toBe('firstRun.callAdult');
    expect(mockPush).not.toHaveBeenCalled();
    now.mockReturnValue(1_000_000 + firstRun.adultSecondTapMinMs + 1);
    await fireEvent.press(screen.getByTestId('profile-add'));
    expect(mockPush).toHaveBeenCalledWith('/parent');
    expect(useChildSession.getState().mode).toBe('none');
    expect(mockReplace).not.toHaveBeenCalled();
    now.mockRestore();
  });

  /** Контрольный аудит 2026-11-09, Ж8: без голоса ребёнок тапает дважды подряд — второй тап раньше 800 мс не считается. */
  it('«+ Добавить»: ранний второй тап не считается и перезапускает окно — стук без паузы в PIN не проходит', async () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    await renderWithProviders(<FirstRunScreen />);
    await fireEvent.press(screen.getByTestId('profile-add'));
    // стук: 250, 500, 750, 1000 мс от первого — каждый раньше 800 от предыдущего, ни один не открывает
    for (const at of [250, 500, 750, 1000]) {
      now.mockReturnValue(1_000_000 + at);
      await fireEvent.press(screen.getByTestId('profile-add'));
    }
    expect(mockPush).not.toHaveBeenCalled();
    // пауза ≥ 800 мс после последнего тапа — открывает
    now.mockReturnValue(1_000_000 + 1000 + firstRun.adultSecondTapMinMs + 1);
    await fireEvent.press(screen.getByTestId('profile-add'));
    expect(mockPush).toHaveBeenCalledWith('/parent');
    now.mockRestore();
  });

  it('«+ Добавить»: второй тап позже adultSecondTapMs — снова только голос, без перехода', async () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    await renderWithProviders(<FirstRunScreen />);
    await fireEvent.press(screen.getByTestId('profile-add'));
    now.mockReturnValue(1_000_000 + firstRun.adultSecondTapMs + 1);
    await fireEvent.press(screen.getByTestId('profile-add'));
    expect(mockPush).not.toHaveBeenCalled();
    expect(voice.last?.key).toBe('firstRun.callAdult');
    now.mockRestore();
  });

  it('порядок: детская кнопка стоит выше ряда карточек (childActionFirst)', async () => {
    await renderWithProviders(<FirstRunScreen />);
    const order = screen.getAllByTestId(/^(try-without-saving|profile-row)$/).map((el) => el.props.testID);
    expect(order).toEqual(['try-without-saving', 'profile-row']);
  });

  it('«Для взрослых» тоже ведёт в родительский раздел', async () => {
    await renderWithProviders(<FirstRunScreen />);
    await fireEvent.press(screen.getByTestId('for-adults'));
    expect(mockPush).toHaveBeenCalledWith('/parent');
  });

  describe('с аккаунтом на устройстве', () => {
    it('карточки детей и «+ Добавить»; кнопки без записи нет; безымянный — «Профиль N»', async () => {
      withAccount([profile(KID, 'Айдар'), profile('00000000-0000-4000-8000-000000000032')]);
      await renderWithProviders(<FirstRunScreen />);
      expect(screen.getByText('Айдар')).toBeTruthy();
      expect(screen.getByText('Профиль 2')).toBeTruthy();
      expect(screen.getByTestId('profile-add')).toBeTruthy();
      expect(screen.queryByTestId('try-without-saving')).toBeNull();
      expect(screen.queryByText('Прогресс не сохранится после закрытия')).toBeNull();
      // «+» — последним в ряду, после детей
      const row = screen.getAllByTestId(/^(profile-\d|profile-add)$/).map((el) => el.props.testID);
      expect(row).toEqual(['profile-1', 'profile-2', 'profile-add']);
      const now = jest.spyOn(Date, 'now');
      now.mockReturnValue(1_000_000);
      await fireEvent.press(screen.getByTestId('profile-add'));
      expect(mockPush).not.toHaveBeenCalled();
      now.mockReturnValue(1_000_000 + firstRun.adultSecondTapMinMs + 1);
      await fireEvent.press(screen.getByTestId('profile-add'));
      expect(mockPush).toHaveBeenCalledWith('/parent/profile/new');
      now.mockRestore();
    });

    it('тап по карточке: прогресс из порта → сеанс с записью → карта', async () => {
      withAccount();
      const load = jest.fn(async () => ({ ...EMPTY_PROGRESS, lessonCounter: 2 }));
      setProgressPort({ load, commit: noRecordPort.commit });
      await renderWithProviders(<FirstRunScreen />);
      await fireEvent.press(screen.getByTestId('profile-1'));
      await screen.findByTestId('first-run');
      expect(load).toHaveBeenCalledWith(KID);
      const s = useChildSession.getState();
      expect(s.mode).toBe('account');
      expect(s.childId).toBe(KID);
      expect(s.progress.lessonCounter).toBe(2);
      expect(mockReplace).toHaveBeenCalledWith('/map');
    });

    it('устаревший текст согласия: вместо карты — повторное согласие, сеанс не открыт', async () => {
      withAccount(undefined, 'outdated');
      await renderWithProviders(<FirstRunScreen />);
      await fireEvent.press(screen.getByTestId('profile-1'));
      expect(mockPush).toHaveBeenCalledWith('/parent/reconsent');
      expect(useChildSession.getState().mode).toBe('none');
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('focus: Tali нет, остальное на месте', async () => {
    await renderWithProviders(<FirstRunScreen />, { focusMode: true });
    expect(screen.queryByTestId('tali')).toBeNull();
    expect(screen.getByTestId('try-without-saving')).toBeTruthy();
  });

  it('en: строки переведены', async () => {
    await renderWithProviders(<FirstRunScreen />, { lng: 'en' });
    expect(screen.getByText('Try without saving')).toBeTruthy();
  });

  /** Контрольный аудит 2026-11-09, Ж8 (этап B2): видимый отклик первого тапа. */
  describe('отклик первого тапа по «+»', () => {
    const pose = () => screen.getByTestId('tali-svg').props.accessibilityHint;
    const lockScale = () => {
      const t = screen.getByTestId('profile-add-lock').props.style.transform as Record<string, unknown>[];
      return t.find((x) => 'scale' in x)!.scale as number;
    };
    const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

    it('первый тап: Tali в point, через lockNudge.holdMs снова hello', async () => {
      await renderWithProviders(<FirstRunScreen />);
      expect(pose()).toBe('pose:hello');
      await fireEvent.press(screen.getByTestId('profile-add'));
      expect(pose()).toBe('pose:point');
      await wait(firstRun.lockNudge.holdMs + 50);
      expect(pose()).toBe('pose:hello');
    });

    it('calm (still): замок сразу в lockNudge.to / addBadge, через holdMs — 1', async () => {
      await renderWithProviders(<FirstRunScreen />, { calmMode: true });
      expect(lockScale()).toBe(1);
      await fireEvent.press(screen.getByTestId('profile-add'));
      expect(lockScale()).toBeCloseTo(firstRun.lockNudge.to / profileCard.addBadge);
      await wait(firstRun.lockNudge.holdMs + 50);
      expect(lockScale()).toBe(1);
    });

    // С движением анимация идёт на нативном драйвере — в Jest значение в дереве не меняется; проверяем, что рост запущен.
    it('с движением: запущена анимация роста замка до lockNudge.to / addBadge и возврата к 1', async () => {
      const timing = jest.spyOn(Animated, 'timing');
      try {
        await renderWithProviders(<FirstRunScreen />);
        timing.mockClear();
        await fireEvent.press(screen.getByTestId('profile-add'));
        const targets = timing.mock.calls.map((c) => (c[1] as { toValue: number }).toValue);
        expect(targets).toContain(firstRun.lockNudge.to / profileCard.addBadge);
        expect(targets[targets.length - 1]).toBe(1);
      } finally {
        timing.mockRestore();
      }
    });

    it('с движением: повторный рендер без нового тапа анимацию не запускает', async () => {
      const timing = jest.spyOn(Animated, 'timing');
      try {
        await renderWithProviders(<FirstRunScreen />);
        const peak = firstRun.lockNudge.to / profileCard.addBadge;
        expect(timing.mock.calls.some((c) => (c[1] as { toValue: number }).toValue === peak)).toBe(false);
      } finally {
        timing.mockRestore();
      }
    });
  });

  /** Вопрос 93 (этап B5): ребёнку нечем ответить на «Кто сегодня исследует?» — зовём взрослого. */
  describe('нужен взрослый', () => {
    it('аккаунт без профилей: заголовок и голос «Позови взрослого», Tali point', async () => {
      withAccount([]);
      await renderWithProviders(<FirstRunScreen />);
      expect(screen.getByTestId('first-run-title').props.children).toBe('Позови взрослого');
      expect(voice.last?.key).toBe('firstRun.callAdult');
      expect(screen.getByTestId('tali-svg').props.accessibilityHint).toBe('pose:point');
    });

    it('аккаунт без профилей: тап по Tali повторяет «Позови взрослого»', async () => {
      withAccount([]);
      await renderWithProviders(<FirstRunScreen />);
      voice.stop();
      await fireEvent.press(screen.getByTestId('tali-press'));
      expect(voice.last?.key).toBe('firstRun.callAdult');
    });

    it('аккаунт не открылся (error): «Позови взрослого», Tali point, кнопки без сохранения нет', async () => {
      useAccount.setState({ status: 'error', accountId: null, profiles: [], consent: 'not_asked' });
      await renderWithProviders(<FirstRunScreen />);
      expect(screen.getByTestId('first-run-title').props.children).toBe('Позови взрослого');
      expect(voice.last?.key).toBe('firstRun.callAdult');
      expect(screen.getByTestId('tali-svg').props.accessibilityHint).toBe('pose:point');
      // аккаунт на устройстве есть: яркая кнопка спорила бы с голосом «Позови взрослого» (`child-ux-specialist` по диффу B)
      expect(screen.queryByTestId('try-without-saving')).toBeNull();
    });

    it('аккаунт с профилем: обычный заголовок «Кто сегодня исследует?» и поза hello', async () => {
      withAccount();
      await renderWithProviders(<FirstRunScreen />);
      expect(screen.getByTestId('first-run-title').props.children).toBe('Кто сегодня исследует?');
      expect(voice.last?.key).toBe('firstRun.title');
      expect(screen.getByTestId('tali-svg').props.accessibilityHint).toBe('pose:hello');
    });

    it('без аккаунта (none): обычный заголовок', async () => {
      await renderWithProviders(<FirstRunScreen />);
      expect(screen.getByTestId('first-run-title').props.children).toBe('Кто сегодня исследует?');
    });
  });
});
