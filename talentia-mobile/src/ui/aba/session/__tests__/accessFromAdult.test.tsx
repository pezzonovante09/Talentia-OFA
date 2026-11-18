/**
 * Доступ к «Награде от взрослого» (решение 14 методиста, 2026-11-18): сцена — значок и подсказка взрослому, кольцо
 * доступа в строке 72, «Готово» взрослого кончает доступ раньше кольца (`finishAccessNow`); у других наград и после T
 * кнопки нет. Что именно дали, экран не спрашивает.
 */
import { useState } from 'react';

import { act } from '@testing-library/react-native';

import { renderWithProviders, screen, fireEvent } from '../../../../test/render';
import { abaControls } from '../../../../design/abaTokens';
import { AbaClockProvider, manualClock, type ManualClock } from '../../clock';
import { finishAccessNow, startAccess, stepAccess, type AccessRun } from '../../model/accessRun';
import { AccessView } from '../AccessView';

const HIDDEN = { includeHiddenElements: true };

let clock: ManualClock;

/** «Готово» — удержанием, как выход (child-ux-specialist 2026-11-18): палец лёг, часы прошли `exitHoldMs`. */
async function holdDone() {
  await fireEvent(screen.getByTestId('aba-from-adult-done'), 'pressIn');
  await act(async () => clock.advance(abaControls.exitHoldMs));
}

async function mount(reinforcerId: string, run: AccessRun, onAdultDone = jest.fn()) {
  clock = manualClock();
  await renderWithProviders(
    <AbaClockProvider clock={clock}>
      <AccessView run={run} tick={run.startedAt} reinforcerId={reinforcerId} moving onAdultDone={onAdultDone} />
    </AbaClockProvider>,
  );
  return onAdultDone;
}

it('пока сцена играет — значок, подсказка взрослому, кольцо и «Готово»', async () => {
  await mount('from_adult', startAccess(0, 20_000));
  expect(screen.getByTestId('aba-access-ring', HIDDEN)).toBeTruthy();
  expect(screen.getByTestId('aba-from-adult-hint', HIDDEN)).toBeTruthy();
  expect(screen.getByTestId('aba-from-adult-done')).toBeTruthy();
  expect(screen.queryByText('Готово')).toBeTruthy();
});

it('«Готово» зовёт взрослый обработчик только удержанием', async () => {
  const onAdultDone = await mount('from_adult', startAccess(0, 20_000));
  await holdDone();
  expect(onAdultDone).toHaveBeenCalledTimes(1);
});

it('короткое касание «Готово» доступ не кончает — в кнопке подсказка «держите»', async () => {
  const onAdultDone = await mount('from_adult', startAccess(0, 20_000));
  const done = screen.getByTestId('aba-from-adult-done');
  await fireEvent(done, 'pressIn');
  await act(async () => clock.advance(abaControls.exitHoldMs - 400));
  await fireEvent(done, 'pressOut');
  await act(async () => clock.advance(1_000));
  expect(onAdultDone).not.toHaveBeenCalled();
  expect(screen.getByText('Держите, чтобы закончить')).toBeTruthy();
});

it('у других наград кнопки нет', async () => {
  await mount('bubbles', startAccess(0, 20_000));
  expect(screen.queryByTestId('aba-from-adult-done', HIDDEN)).toBeNull();
});

it('после T кнопки нет', async () => {
  await mount('from_adult', stepAccess(startAccess(0, 20_000), 20_000).run);
  expect(screen.queryByTestId('aba-from-adult-done', HIDDEN)).toBeNull();
});

it('доступ кончается по «Готово»: кольцо исчезает, кадр конца идёт обычным ходом', async () => {
  clock = manualClock();
  function Host() {
    const [run, setRun] = useState(() => startAccess(0, 20_000));
    return (
      <AbaClockProvider clock={clock}>
        <AccessView run={run} tick={5_000} reinforcerId="from_adult" moving onAdultDone={() => setRun((r) => stepAccess(finishAccessNow(r, 5_000), 5_000).run)} />
      </AbaClockProvider>
    );
  }
  await renderWithProviders(<Host />);
  await holdDone();
  expect(screen.queryByTestId('aba-access-ring', HIDDEN)).toBeNull();
  expect(screen.queryByTestId('aba-from-adult-done', HIDDEN)).toBeNull();
  // корень кадра доступа несёт стадию: после «Готово» — сворачивание в карточку (место карточки RNTL не меряет)
  expect(screen.getByTestId('aba-access-fold', HIDDEN)).toBeTruthy();
});
