/**
 * Расписание ребёнку (решение методиста 34, ревью методиста и `child-ux-specialist`): «сначала задание → потом
 * жетоны и награда», мини-плиты по одной на отрезок работы; «потом» — всегда доска с окном награды, на перерыве с
 * запасным обменом полосы нет (`then: null`); без таймера; касание — сжатие как у значка перерыва; на перерыве под кольцом. Показ только на перерыве — `app/aba/__tests__`.
 */
import { StyleSheet } from 'react-native';

import { abaColors, abaSchedule, inactiveChoice } from '../../../../design/abaTokens';
import type { ChildScheduleView, ScheduleThen } from '../../../../domain/abaBlockSchedule';
import ru from '../../../../i18n/locales/ru.json';
import { renderWithProviders, screen } from '../../../../test/render';
import { AbaClockProvider, manualClock } from '../../clock';
import type { Phase } from '../../model/sessionPhase';
import { BreakView } from '../BreakView';
import { ChildSchedule, scheduleStripStyle } from '../ChildSchedule';

const c = abaColors.light;
const HIDDEN = { includeHiddenElements: true };
const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id, HIDDEN).props.style);
const sched = ru.abaBreak.schedule;
const boardThen = (earned: number, size = 5): ScheduleThen => ({ size, earned });
const view = (over: Partial<ChildScheduleView> = {}): ChildScheduleView => ({
  blocksLeft: 3,
  isLast: false,
  reinforcerId: 'bubbles',
  then: boardThen(2),
  ...over,
});

it('ещё 3 отрезка: задание → доска с наградой при ней, три мини-плиты, подпись «жетоны к награде»', async () => {
  await renderWithProviders(<ChildSchedule {...view()} />);
  expect(screen.getAllByTestId('aba-schedule-segment', HIDDEN)).toHaveLength(3);
  expect(screen.getByTestId('aba-schedule-board', HIDDEN)).toBeTruthy();
  expect(screen.getAllByTestId('aba-schedule-token-filled', HIDDEN)).toHaveLength(2);
  expect(screen.getAllByTestId('aba-schedule-token-empty', HIDDEN)).toHaveLength(3);
  expect(screen.getByTestId('aba-reinforcer-stub-bubbles', HIDDEN)).toBeTruthy();
  expect(screen.getByTestId('aba-schedule').props.accessibilityLabel).toBe(`${sched.firstThenTokens}. ${sched.left.replace('{{count}}', '3')}`);
});

it('мини-плита повторяет ячейку «задание»: плита, контур плиты, 20 / 2', async () => {
  await renderWithProviders(<ChildSchedule {...view()} />);
  for (const plate of screen.getAllByTestId('aba-schedule-segment', HIDDEN)) {
    expect(StyleSheet.flatten(plate.props.style)).toMatchObject({
      width: abaSchedule.segment,
      height: abaSchedule.segment,
      backgroundColor: c.plate,
      borderColor: c.plateOutline,
      borderWidth: abaSchedule.segmentStroke,
    });
  }
  expect(abaSchedule).toMatchObject({ segment: 20, segmentStroke: 2 });
});

it('последний отрезок: одна мини-плита, флажка нет, подпись «последнее»', async () => {
  await renderWithProviders(<ChildSchedule {...view({ blocksLeft: 1, isLast: true })} />);
  expect(screen.getAllByTestId('aba-schedule-segment', HIDDEN)).toHaveLength(1);
  expect(screen.queryByTestId('aba-schedule-last', HIDDEN)).toBeNull();
  expect(screen.getByTestId('aba-schedule').props.accessibilityLabel).toBe(`${sched.firstThenTokens}. ${sched.last}`);
});

it('мини-плит не больше потолка: длинный план не превращается в доску', async () => {
  await renderWithProviders(<ChildSchedule {...view({ blocksLeft: abaSchedule.maxSegments + 3 })} />);
  expect(screen.getAllByTestId('aba-schedule-segment', HIDDEN)).toHaveLength(abaSchedule.maxSegments);
});

it('перерыв кончится запасным обменом (порядок «перерыв → награда → задание») — полосы нет совсем', async () => {
  await renderWithProviders(<ChildSchedule {...view({ then: null })} />);
  expect(screen.queryByTestId('aba-schedule', HIDDEN)).toBeNull();
  expect(screen.queryByTestId('aba-schedule-reward', HIDDEN)).toBeNull();
  // варианта «одна награда» нет: подписи «потом награда» в локалях не осталось
  expect(Object.keys(sched)).not.toContain('firstThen');
});

it('награда никогда не одна: всегда окно при доске', async () => {
  for (const then of [boardThen(0), boardThen(4), boardThen(5), boardThen(0, 1)]) {
    await renderWithProviders(<ChildSchedule {...view({ then })} />);
    expect(screen.getByTestId('aba-schedule-board', HIDDEN)).toBeTruthy();
    expect(screen.getAllByTestId(/^aba-schedule-token-/, HIDDEN)).toHaveLength(then.size);
    expect(flat('aba-schedule-reward')).toMatchObject({ backgroundColor: c.rewardWindow, width: abaSchedule.boardReward });
  }
});

it('работы не осталось или награда не выбрана — ничего', async () => {
  await renderWithProviders(<ChildSchedule {...view({ blocksLeft: 0 })} />);
  expect(screen.queryByTestId('aba-schedule', HIDDEN)).toBeNull();
  await renderWithProviders(<ChildSchedule {...view({ blocksLeft: 2, reinforcerId: null })} />);
  expect(screen.queryByTestId('aba-schedule', HIDDEN)).toBeNull();
});

it('цвета — по ролям: жёлтый только в ячейках доски, лаванда только у окна награды', async () => {
  await renderWithProviders(<ChildSchedule {...view({ blocksLeft: 2 })} />);
  expect(flat('aba-schedule-task')).toMatchObject({ backgroundColor: c.plate, borderColor: c.plateOutline, borderWidth: abaSchedule.cellStroke, width: abaSchedule.cell });
  expect(flat('aba-schedule-reward').backgroundColor).toBe(c.rewardWindow);
  // у ряда доски своей подложки нет: жёлтое — только сами ячейки `TokenCell`
  expect(flat('aba-schedule-board').backgroundColor).toBeUndefined();
  expect(Object.values(abaSchedule.color) as string[]).not.toContain('tokenEarned');
  expect((Object.values(abaSchedule.color) as string[]).filter((r) => r === 'rewardWindow' || r === 'reinforcement')).toEqual(['rewardWindow']);
});

it('касание — сжатие всей полосы 0.94 без звука и записи, как у значка перерыва; роль image, таймера нет', async () => {
  await renderWithProviders(<ChildSchedule {...view()} />);
  const strip = screen.getByTestId('aba-schedule');
  expect(strip.props.accessibilityRole).toBe('image');
  expect(abaSchedule.tap).toBe(inactiveChoice.tapPress);
  expect(abaSchedule.tap).toMatchObject({ scale: 0.94, sound: false, records: false });
  expect(abaSchedule).toMatchObject({ motion: 'none', timer: false });
  // сжатие — от состояния `pressed` самого Pressable, обработчика нажатия нет: касание ничего не вызывает и не пишет
  expect(StyleSheet.flatten(strip.props.style).transform).toEqual([{ scale: 1 }]);
  expect(scheduleStripStyle(false).transform).toEqual([{ scale: 1 }]);
  expect(scheduleStripStyle(true).transform).toEqual([{ scale: abaSchedule.tap.scale }]);
});

it('на 5 ячейках полоса укладывается в контент экрана 360 (328)', () => {
  const s = abaSchedule;
  const then = 5 * s.boardCell + 4 * s.boardGap + s.boardRewardGap + s.boardReward;
  expect(s.cell + s.gap + s.arrow + s.gap + then).toBeLessThanOrEqual(328);
});

it('перерыв: расписание под кольцом, «Вернуться» на месте', async () => {
  const phase: Extract<Phase, { kind: 'break' }> = {
    kind: 'break',
    step: { kind: 'break' } as Extract<Phase, { kind: 'break' }>['step'],
    startedAt: 0,
    shownAt: 0,
    until: 60_000,
    invite: 0,
    inviteAt: null,
    training: false,
  };
  await renderWithProviders(
    <AbaClockProvider clock={manualClock()}>
      <BreakView phase={phase} onReturn={jest.fn()} schedule={<ChildSchedule {...view({ blocksLeft: 1, isLast: true })} />} />
    </AbaClockProvider>,
  );
  expect(screen.getByTestId('aba-break-icon')).toBeTruthy();
  expect(screen.getByTestId('aba-schedule')).toBeTruthy();
  expect(screen.getByTestId('aba-break-return')).toBeTruthy();
});

it('награда без картинки (партия 2: барабан) — заглушка каталога в окне награды, полоса не ломается', async () => {
  await renderWithProviders(<ChildSchedule {...view({ blocksLeft: 2, reinforcerId: 'drum' })} />);
  expect(screen.getByTestId('aba-reinforcer-stub-drum', HIDDEN)).toBeTruthy();
  expect(screen.getAllByTestId('aba-schedule-segment', HIDDEN)).toHaveLength(2);
});
