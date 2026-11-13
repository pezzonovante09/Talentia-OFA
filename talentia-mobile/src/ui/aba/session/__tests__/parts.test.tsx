/**
 * Панель взрослого сессии ABA (Ц2.2 / №159): места кнопок постоянные, подпись взрослому — только вместо пустого
 * ряда 1 (у карточки L4 кнопки остаются), действие — по отпусканию, время — касания вниз.
 */
import { renderWithProviders, screen, fireEvent, act } from '../../../../test/render';
import { AbaClockProvider, manualClock } from '../../clock';
import { AdultPanel } from '../parts';

async function mount(buttons: Parameters<typeof AdultPanel>[0]['buttons'], caption?: string, onPress = jest.fn()) {
  const clock = manualClock();
  await renderWithProviders(
    <AbaClockProvider clock={clock}>
      <AdultPanel buttons={buttons} height={124} insetBottom={0} caption={caption} pressed={null} onPress={onPress} />
    </AbaClockProvider>,
  );
  return { clock, onPress };
}

it('карточка L4: подпись не прячет «Сделали вместе» и «Сопротивляется»', async () => {
  await mount(['l4_done', 'l4_resisted', 'l4_skipped', 'refusal'], 'подсказка');
  for (const b of ['l4_done', 'l4_resisted', 'l4_skipped', 'refusal']) expect(screen.getByTestId(`aba-panel-${b}`)).toBeTruthy();
  expect(screen.queryByTestId('aba-panel-caption')).toBeNull();
});

it('match (`device_tap`): ряд 1 пуст — на его месте подпись; «Была подсказка» и «Отказ» в ряду 2', async () => {
  await mount(['adult_prompted', 'refusal'], 'подсказка');
  expect(screen.getByTestId('aba-panel-caption')).toBeTruthy();
  expect(screen.getByTestId('aba-panel-adult_prompted')).toBeTruthy();
});

it('«Отказ» — по отпусканию, со временем касания вниз', async () => {
  const { clock, onPress } = await mount(['adult_prompted', 'refusal']);
  const t0 = clock.now();
  await fireEvent(screen.getByTestId('aba-panel-refusal'), 'pressIn');
  expect(onPress).not.toHaveBeenCalled();
  await act(async () => clock.advance(300));
  await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
  expect(onPress).toHaveBeenCalledWith('refusal', t0);
});
