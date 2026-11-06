/**
 * Выход из занятия ABA (`leaveAba`): на карту ребёнка; если сессию сменили с другого ребёнка ради занятия
 * (`openedForAba`), — к выбору профиля со сбросом сессии: иначе следующие уроки первого ребёнка ушли бы второму.
 */
import type { useRouter } from 'expo-router';

import { DEFAULT_SETTINGS, useChildSession } from '../../../state/childSession';
import { leaveAba } from '../leaveAba';

const KID = '00000000-0000-4000-8000-0000000000a1';
const router = { dismissTo: jest.fn(), replace: jest.fn() };
const leave = () => leaveAba(router as unknown as ReturnType<typeof useRouter>);

beforeEach(() => {
  router.dismissTo.mockClear();
  router.replace.mockClear();
  useChildSession.getState().reset();
  useChildSession.setState({ childId: KID, mode: 'account' });
});

describe('leaveAba: занятие открыто ради другого ребёнка', () => {
  beforeEach(() => {
    useChildSession.setState({ openedForAba: true });
  });

  it('ведёт на «/» заменой, а не на карту', () => {
    leave();
    expect(router.replace.mock.calls).toEqual([['/']]);
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('сбрасывает детскую сессию вместе с флагом', () => {
    leave();
    expect(useChildSession.getState()).toMatchObject({ childId: null, mode: 'none', openedForAba: false });
  });

  it('сессия сброшена до перехода: экран выбора профиля не видит второго ребёнка', () => {
    const seen: { id: string | null } = { id: KID };
    router.replace.mockImplementationOnce(() => {
      seen.id = useChildSession.getState().childId;
    });
    leave();
    expect(seen.id).toBeNull();
  });

  describe('режимы calm и focus переживают сброс: экран выбора не меняет ребёнку тему', () => {
    it.each([
      [true, false],
      [false, true],
      [true, true],
    ])('calm %s, focus %s', (calmMode, focusMode) => {
      useChildSession.getState().setSettings({ calmMode, focusMode });
      leave();
      expect(useChildSession.getState().settings).toMatchObject({ calmMode, focusMode });
    });

    it('режимы на месте уже в момент перехода: первый кадр выбора без смены темы', () => {
      useChildSession.getState().setSettings({ calmMode: true, focusMode: true });
      const seen = { calm: false, focus: false };
      router.replace.mockImplementationOnce(() => {
        const { calmMode, focusMode } = useChildSession.getState().settings;
        seen.calm = calmMode;
        seen.focus = focusMode;
      });
      leave();
      expect(seen).toEqual({ calm: true, focus: true });
    });

    it('остальные настройки второго ребёнка не переживают сброс', () => {
      useChildSession.setState({ settings: { ...DEFAULT_SETTINGS, band: '9-10', soundEffects: false, calmMode: true } });
      leave();
      expect(useChildSession.getState().settings).toEqual({ ...DEFAULT_SETTINGS, calmMode: true });
    });
  });
});

describe('leaveAba: обычное занятие', () => {
  it('ведёт на карту', () => {
    leave();
    expect(router.dismissTo.mock.calls).toEqual([['/map']]);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('детская сессия остаётся', () => {
    leave();
    expect(useChildSession.getState()).toMatchObject({ childId: KID, mode: 'account' });
  });

  it('настройки остаются', () => {
    const settings = { ...DEFAULT_SETTINGS, band: '9-10' as const, soundEffects: false, calmMode: true, focusMode: true };
    useChildSession.setState({ settings });
    leave();
    expect(useChildSession.getState().settings).toEqual(settings);
  });
});
