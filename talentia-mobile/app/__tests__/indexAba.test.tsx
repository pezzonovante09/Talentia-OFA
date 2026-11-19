/**
 * Первый экран в сборке «только ABA» («Тихий кабинет», №203, спецификация п. «г» 7): фон кабинета, круг неба за Tali
 * (в calm его нет), Tali в позе `hello` и не указывает на «+» даже после тапа, касание Tali повторяет «Позови
 * взрослого», «+» — взрослый тон `zone` с кромкой 2 `edge`, без борта, замок 36. Правило второго тапа и пути после PIN
 * — как в обычной сборке. Обычный режим — `index.test.tsx`.
 */
import FirstRunScreen from '../index';
import { abaColors, abaFirstRun, abaTypeFor, abaTypography } from '../../src/design/abaTokens';
import { parentColors, parentTypography } from '../../src/design/parentTokens';
import { firstRun, profileCard, spacing, taliSize } from '../../src/design/tokens';
import { newProfile } from '../../src/services/local/profiles';
import { noRecordPort } from '../../src/services/progressPort';
import { voice } from '../../src/services/voice';
import { useAccount } from '../../src/state/account';
import { useChildSession } from '../../src/state/childSession';
import { useParentView } from '../../src/state/parentView';
import { setProgressPort } from '../../src/state/port';
import { contrast } from '../../src/design/contrast';
import { fontFamilyFor } from '../../src/ui/fonts';
import { textEm } from '../../src/test/fontMetrics';
import { StyleSheet } from 'react-native';

import { act, fireEvent, renderWithProviders, screen } from '../../src/test/render';

jest.mock('../../src/services/buildScope', () => ({ ABA_ONLY: true }));
jest.mock('expo-router', () => {
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
  return { useRouter: () => router, Redirect: () => null, __router: router };
});
// позы Tali помечаются именем, как в index.test.tsx
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

const KID = '00000000-0000-4000-8000-000000000041';
const profile = (childId: string, name = '') => newProfile({ childId, name, band: '5-6', interfaceLang: 'ru', createdAt: '2026-11-16T00:00:00.000Z' });
const P = parentColors.light;
const C = abaColors.light;
const flat = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style) as Record<string, unknown>;
const pose = () => screen.getByTestId('tali-svg').props.accessibilityHint;

beforeEach(() => {
  mockReplace.mockClear();
  mockPush.mockClear();
  voice.stop();
  useChildSession.getState().reset();
  useParentView.setState({ childId: null });
  useAccount.setState({ status: 'none', accountId: null, db: null, profiles: [], consent: 'not_asked' });
  setProgressPort(noRecordPort);
});

describe('первый экран, сборка «только ABA» (№203)', () => {
  it('состав: Tali в hello, «Позови взрослого» голосом и текстом, «+», вход для взрослых; кнопки без записи нет', async () => {
    await renderWithProviders(<FirstRunScreen />);
    expect(pose()).toBe('pose:hello');
    expect(screen.getByTestId('first-run-title').props.children).toBe('Позови взрослого');
    expect(screen.getByRole('header', { name: 'Позови взрослого' })).toBeTruthy();
    expect(voice.last?.key).toBe('firstRun.callAdult');
    expect(screen.getAllByTestId('profile-add')).toHaveLength(1);
    expect(screen.getByTestId('for-adults')).toBeTruthy();
    expect(screen.queryByTestId('try-without-saving')).toBeNull();
    // у «+» нет подушки и борта: ни одной подушки на экране без детских карточек
    expect(screen.queryAllByTestId(/-cushion$/)).toHaveLength(0);
  });

  it('фон кабинета — из палитры ABA, не детской темы', async () => {
    await renderWithProviders(<FirstRunScreen />);
    expect(flat('first-run').backgroundColor).toBe(C.background);
    expect(C.background).toBe(P.background);
  });

  it('круг неба за Tali: blockExplain, шире Tali на taliHalo с каждой стороны, касание не перехватывает', async () => {
    await renderWithProviders(<FirstRunScreen />);
    const halo = screen.getByTestId('first-run-tali-halo');
    const s = flat('first-run-tali-halo');
    const d = taliSize.hero + abaFirstRun.taliHalo * 2;
    expect(s.backgroundColor).toBe(P.blockExplain);
    expect(s.width).toBe(d);
    expect(s.height).toBe(d);
    expect(s.borderRadius).toBe(d / 2);
    expect(halo.props.pointerEvents).toBe('none');
  });

  it('calm: круга за Tali нет, Tali на месте', async () => {
    await renderWithProviders(<FirstRunScreen />, { calmMode: true });
    expect(screen.queryByTestId('first-run-tali-halo')).toBeNull();
    expect(screen.getByTestId('tali')).toBeTruthy();
  });

  it('focus: ни Tali, ни круга', async () => {
    await renderWithProviders(<FirstRunScreen />, { focusMode: true });
    expect(screen.queryByTestId('tali')).toBeNull();
    expect(screen.queryByTestId('first-run-tali-halo')).toBeNull();
  });

  it('касание Tali повторяет «Позови взрослого»', async () => {
    await renderWithProviders(<FirstRunScreen />);
    voice.stop();
    expect(voice.last).toBeNull();
    await fireEvent.press(screen.getByTestId('tali-press'));
    expect(voice.last?.key).toBe('firstRun.callAdult');
  });

  it('«+»: тон zone, кромка 2 edge, радиус и размер прежние, замок 36; кромка видна (≥ 3:1 к фону)', async () => {
    await renderWithProviders(<FirstRunScreen />);
    const s = flat('profile-add');
    expect(s.backgroundColor).toBe(P.zone);
    expect(s.borderWidth).toBe(abaFirstRun.addEdge);
    expect(abaFirstRun.addEdge).toBe(2);
    expect(s.borderColor).toBe(P.edge);
    expect(s.width).toBe(profileCard.addSize);
    expect(s.height).toBe(profileCard.addSize);
    expect(screen.getByTestId('profile-add-lock-icon').props.width).toBe(abaFirstRun.addLock);
    expect(abaFirstRun.addLock).toBe(36);
    expect(contrast(P.edge, C.background)).toBeGreaterThanOrEqual(3);
    // подпись в карточке — чернила раздела на тоне zone
    expect(contrast(P.text, P.zone)).toBeGreaterThanOrEqual(7);
  });

  it('первый тап по «+»: голос и замок, Tali остаётся в hello (ни на что не указывает); второй в окне — родительский раздел', async () => {
    const now = jest.spyOn(Date, 'now');
    try {
      now.mockReturnValue(1_000_000);
      await renderWithProviders(<FirstRunScreen />, { calmMode: true });
      voice.stop();
      await fireEvent.press(screen.getByTestId('profile-add'));
      expect(voice.last?.key).toBe('firstRun.callAdult');
      expect(pose()).toBe('pose:hello');
      const scale = (screen.getByTestId('profile-add-lock').props.style.transform as Record<string, unknown>[]).find((x) => 'scale' in x)!.scale;
      expect(scale).toBeCloseTo(firstRun.lockNudge.to / profileCard.addBadge);
      expect(mockPush).not.toHaveBeenCalled();
      await act(async () => {
        await new Promise((r) => setTimeout(r, firstRun.lockNudge.holdMs + 50));
      });
      expect(pose()).toBe('pose:hello');
      now.mockReturnValue(1_000_000 + firstRun.adultSecondTapMinMs + 1);
      await fireEvent.press(screen.getByTestId('profile-add'));
      expect(mockPush).toHaveBeenCalledWith('/parent');
    } finally {
      now.mockRestore();
    }
  });

  it('«+»: ранний второй тап не открывает PIN (правило adultSecondTapMinMs то же)', async () => {
    const now = jest.spyOn(Date, 'now');
    try {
      now.mockReturnValue(1_000_000);
      await renderWithProviders(<FirstRunScreen />);
      await fireEvent.press(screen.getByTestId('profile-add'));
      now.mockReturnValue(1_000_000 + firstRun.adultSecondTapMinMs - 1);
      await fireEvent.press(screen.getByTestId('profile-add'));
      expect(mockPush).not.toHaveBeenCalled();
    } finally {
      now.mockRestore();
    }
  });

  it('аккаунт без профилей: Tali всё равно hello, не point', async () => {
    useAccount.setState({ status: 'ready', accountId: 'acc', profiles: [], consent: 'granted' });
    await renderWithProviders(<FirstRunScreen />);
    expect(pose()).toBe('pose:hello');
    expect(screen.getByTestId('first-run-title').props.children).toBe('Позови взрослого');
  });

  it('с профилем: детская карточка на месте; тап — голос, выбор ребёнка и «Занятия ABA»', async () => {
    useAccount.setState({ status: 'ready', accountId: 'acc', profiles: [profile(KID, 'Айдар')], consent: 'granted' });
    await renderWithProviders(<FirstRunScreen />);
    expect(screen.getByText('Айдар')).toBeTruthy();
    const row = screen.getAllByTestId(/^(profile-\d|profile-add)$/).map((el) => el.props.testID);
    expect(row).toEqual(['profile-1', 'profile-add']);
    await fireEvent.press(screen.getByTestId('profile-1'));
    expect(useParentView.getState().childId).toBe(KID);
    expect(mockPush).toHaveBeenCalledWith('/parent/aba');
    expect(useChildSession.getState().mode).toBe('none');
  });

  it('«Для взрослых» ведёт в родительский раздел; двойной тап — один переход', async () => {
    await renderWithProviders(<FirstRunScreen />);
    await fireEvent.press(screen.getByTestId('for-adults'));
    await fireEvent.press(screen.getByTestId('for-adults'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/parent');
  });

  /** Ширина по TTF Golos (`textEm`): экран 360, поля `spacing.lg`. */
  describe('строки входят по ширине', () => {
    const width = (type: Parameters<typeof fontFamilyFor>[0] & { size: number }, text: string) => textEm(fontFamilyFor(type), text) * type.size;

    it('«Для взрослых» в карточке «+»: одна строка при ×1, при ×1.2 — не ниже ужатия addLabelMinScale', () => {
      const inner = profileCard.addSize - 2 * abaFirstRun.addEdge;
      const w = width(parentTypography.caption, 'Для взрослых');
      expect(w).toBeLessThanOrEqual(inner);
      expect(w * 1.2 * abaFirstRun.addLabelMinScale).toBeLessThanOrEqual(inner);
    });

    it('«Позови взрослого» — одна строка даже при ×1.2 (слот заголовка — две строки)', () => {
      const t = abaTypeFor(abaTypography.title);
      expect(width(t, 'Позови взрослого') * 1.2).toBeLessThanOrEqual(360 - 2 * spacing.lg);
    });
  });
});
