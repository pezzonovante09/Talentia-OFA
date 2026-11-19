/**
 * `theme.still` = calm ребёнка **или** системное «уменьшить движение» (контрольный аудит 2026-11-09, Ж9 / этап B4);
 * ширина карточки коллекции под окно (`atlasCardWidth`, UX п. 12).
 */
import { AccessibilityInfo, Animated, Text } from 'react-native';

import { DesignProvider, useDesign } from '..';
import { atlasCardWidth, atlasGrid, buildTheme } from '../tokens';
import { BottomBar } from '../../ui/lesson/LessonChrome';
import { renderWithProviders, render, screen, waitFor } from '../../test/render';

const reduce = AccessibilityInfo.isReduceMotionEnabled as jest.Mock;
afterEach(() => reduce.mockImplementation(() => Promise.resolve(false)));

describe('buildTheme: still', () => {
  it.each([
    [false, false, false],
    [true, false, true],
    [false, true, true],
    [true, true, true],
  ])('calmMode=%s, reduceMotion=%s → still=%s', (calmMode, reduceMotion, still) => {
    expect(buildTheme({ scheme: 'light', calmMode, focusMode: false, reduceMotion }).still).toBe(still);
  });

  it('reduceMotion по умолчанию false: still следует calm', () => {
    expect(buildTheme({ scheme: 'dark', calmMode: false, focusMode: true }).still).toBe(false);
  });

  it('reduceMotion не включает calm-палитру: цвета те же, что без него', () => {
    const plain = buildTheme({ scheme: 'light', calmMode: false, focusMode: false });
    const rm = buildTheme({ scheme: 'light', calmMode: false, focusMode: false, reduceMotion: true });
    expect(rm.calmMode).toBe(false);
    expect(rm.colors).toEqual(plain.colors);
  });
});

function Probe() {
  const theme = useDesign();
  return <Text testID="probe">{theme.still ? 'still' : 'moving'}</Text>;
}

describe('DesignProvider: системное «уменьшить движение»', () => {
  it('isReduceMotionEnabled → true даёт still без calm', async () => {
    reduce.mockImplementation(() => Promise.resolve(true));
    await render(
      <DesignProvider calmMode={false} focusMode={false}>
        <Probe />
      </DesignProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('probe').props.children).toBe('still'));
  });

  it('isReduceMotionEnabled → false и без calm — движение есть', async () => {
    await render(
      <DesignProvider calmMode={false} focusMode={false}>
        <Probe />
      </DesignProvider>,
    );
    await waitFor(() => expect(reduce).toHaveBeenCalled());
    expect(screen.getByTestId('probe').props.children).toBe('moving');
  });

  it('isReduceMotionEnabled отвергнут — не падает, движение есть', async () => {
    reduce.mockImplementation(() => Promise.reject(new Error('n/a')));
    await render(
      <DesignProvider calmMode={false} focusMode={false}>
        <Probe />
      </DesignProvider>,
    );
    await waitFor(() => expect(reduce).toHaveBeenCalled());
    expect(screen.getByTestId('probe').props.children).toBe('moving');
  });
});

describe('BottomBar: пульс «Дальше»', () => {
  const bar = (pulse: number) => (
    <BottomBar pose="idle" onTali={() => undefined} action="next" onAction={() => undefined} labels={{ tali: 'Tali', check: 'Проверить', next: 'Дальше' }} pulse={pulse} />
  );
  const pulsed = (timing: jest.SpyInstance) => timing.mock.calls.some((c) => (c[1] as { toValue: number }).toValue === 1.06);

  it('без still: новый pulse запускает анимацию роста', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    try {
      const r = await renderWithProviders(bar(0));
      expect(pulsed(timing)).toBe(false);
      await r.rerender(bar(1));
      expect(pulsed(timing)).toBe(true);
    } finally {
      timing.mockRestore();
    }
  });

  it('calm: pulse не анимирует', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    try {
      const r = await renderWithProviders(bar(0), { calmMode: true });
      await r.rerender(bar(1));
      expect(pulsed(timing)).toBe(false);
    } finally {
      timing.mockRestore();
    }
  });

  it('системное «уменьшить движение» без calm: pulse не анимирует', async () => {
    reduce.mockImplementation(() => Promise.resolve(true));
    const timing = jest.spyOn(Animated, 'timing');
    try {
      const r = await renderWithProviders(bar(0));
      await waitFor(() => expect(reduce).toHaveBeenCalled());
      await new Promise((res) => setTimeout(res, 0));
      await r.rerender(bar(1));
      expect(pulsed(timing)).toBe(false);
    } finally {
      timing.mockRestore();
    }
  });
});

describe('atlasCardWidth', () => {
  it('320 pt, 2 колонки, поля 16 → 136 (2 × 136 + 16 = 288)', () => {
    expect(atlasCardWidth(320, 2, 16)).toBe(136);
  });

  it('390 pt, 2 колонки → потолок 164', () => {
    expect(atlasCardWidth(390, 2, 16)).toBe(164);
  });

  it('одна колонка не шире atlasGrid.card.w', () => {
    expect(atlasCardWidth(1024, 1, 16)).toBe(atlasGrid.card.w);
    expect(atlasCardWidth(320, 1, 16)).toBeLessThanOrEqual(164);
  });

  it.each([320, 360, 375, 390, 414])('%i pt: две карточки с зазором влезают в окно за вычетом полей', (w) => {
    const card = atlasCardWidth(w, 2, 16);
    expect(card * 2 + atlasGrid.gap + 32).toBeLessThanOrEqual(w);
  });

  it('очень узкое окно — не меньше 96', () => {
    expect(atlasCardWidth(200, 2, 16)).toBe(96);
  });
});
