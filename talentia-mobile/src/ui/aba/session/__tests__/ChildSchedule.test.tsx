/**
 * Расписание ребёнку (решение методиста 34): «сначала задание → потом награда», точки «ещё N», флажок перед последним
 * блоком; без таймера и движения; на перерыве под кольцом. Показ только на перерыве — `app/aba/__tests__`.
 */
import { StyleSheet } from 'react-native';

import { abaColors, abaSchedule } from '../../../../design/abaTokens';
import ru from '../../../../i18n/locales/ru.json';
import { renderWithProviders, screen } from '../../../../test/render';
import { AbaClockProvider, manualClock } from '../../clock';
import type { Phase } from '../../model/sessionPhase';
import { BreakView } from '../BreakView';
import { ChildSchedule } from '../ChildSchedule';

const c = abaColors.light;
const HIDDEN = { includeHiddenElements: true };
const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id, HIDDEN).props.style);

it('ещё 3 блока: задание → награда и три точки чернилами, флажка нет', async () => {
  await renderWithProviders(<ChildSchedule blocksLeft={3} isLast={false} reinforcerId="bubbles" />);
  expect(screen.getAllByTestId('aba-schedule-dot', HIDDEN)).toHaveLength(3);
  expect(screen.queryByTestId('aba-schedule-last', HIDDEN)).toBeNull();
  expect(screen.getByTestId('aba-reinforcer-stub-bubbles', HIDDEN)).toBeTruthy();
  for (const dot of screen.getAllByTestId('aba-schedule-dot', HIDDEN)) expect(StyleSheet.flatten(dot.props.style)).toMatchObject({ backgroundColor: c.ink, width: abaSchedule.dot });
  expect(screen.getByTestId('aba-schedule').props.accessibilityLabel).toBe(
    `${ru.abaBreak.schedule.firstThen}. ${ru.abaBreak.schedule.left.replace('{{count}}', '3')}`,
  );
});

it('последний блок: флажок вместо точек, подпись «последнее»', async () => {
  await renderWithProviders(<ChildSchedule blocksLeft={1} isLast reinforcerId="bubbles" />);
  expect(screen.getByTestId('aba-schedule-last', HIDDEN)).toBeTruthy();
  expect(screen.queryByTestId('aba-schedule-dot', HIDDEN)).toBeNull();
  expect(screen.getByTestId('aba-schedule').props.accessibilityLabel).toBe(`${ru.abaBreak.schedule.firstThen}. ${ru.abaBreak.schedule.last}`);
});

it('точек не больше потолка: длинный план не превращается в доску', async () => {
  await renderWithProviders(<ChildSchedule blocksLeft={abaSchedule.maxDots + 3} isLast={false} reinforcerId="bubbles" />);
  expect(screen.getAllByTestId('aba-schedule-dot', HIDDEN)).toHaveLength(abaSchedule.maxDots);
});

it('работы не осталось или награда не выбрана — ничего', async () => {
  await renderWithProviders(<ChildSchedule blocksLeft={0} isLast={false} reinforcerId="bubbles" />);
  expect(screen.queryByTestId('aba-schedule', HIDDEN)).toBeNull();
  await renderWithProviders(<ChildSchedule blocksLeft={2} isLast={false} reinforcerId={null} />);
  expect(screen.queryByTestId('aba-schedule', HIDDEN)).toBeNull();
});

it('цвета — по ролям: задание на плите с контуром плиты, награда в окне награды; жёлтого нет', async () => {
  await renderWithProviders(<ChildSchedule blocksLeft={2} isLast={false} reinforcerId="bubbles" />);
  const task = flat('aba-schedule-task');
  expect(task).toMatchObject({ backgroundColor: c.plate, borderColor: c.plateOutline, borderWidth: abaSchedule.cellStroke, width: abaSchedule.cell });
  expect(flat('aba-schedule-reward').backgroundColor).toBe(c.rewardWindow);
  expect(Object.values(abaSchedule.color) as string[]).not.toContain('tokenEarned');
  expect((Object.values(abaSchedule.color) as string[]).filter((r) => r === 'rewardWindow' || r === 'reinforcement')).toEqual(['rewardWindow']);
});

it('не кнопка и неподвижно: касания проходят мимо, таймера нет', async () => {
  await renderWithProviders(<ChildSchedule blocksLeft={2} isLast={false} reinforcerId="bubbles" />);
  expect(screen.getByTestId('aba-schedule').props.pointerEvents).toBe('none');
  expect(abaSchedule).toMatchObject({ motion: 'none', timer: false, reactsToTap: false });
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
      <BreakView phase={phase} onReturn={jest.fn()} schedule={<ChildSchedule blocksLeft={1} isLast reinforcerId="bubbles" />} />
    </AbaClockProvider>,
  );
  expect(screen.getByTestId('aba-break-icon')).toBeTruthy();
  expect(screen.getByTestId('aba-schedule')).toBeTruthy();
  expect(screen.getByTestId('aba-break-return')).toBeTruthy();
});

it('награда без картинки (партия 2: барабан) — заглушка каталога в окне награды, полоса не ломается', async () => {
  await renderWithProviders(<ChildSchedule blocksLeft={2} isLast={false} reinforcerId="drum" />);
  expect(screen.getByTestId('aba-reinforcer-stub-drum', HIDDEN)).toBeTruthy();
  expect(screen.getAllByTestId('aba-schedule-dot', HIDDEN)).toHaveLength(2);
});
