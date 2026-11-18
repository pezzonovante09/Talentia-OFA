/**
 * Панель взрослого сессии ABA (Ц2.2 / №159): места кнопок постоянные, подпись взрослому — только вместо пустого
 * ряда 1 (у карточки L4 кнопки остаются), действие — по отпусканию, время — касания вниз. Вид — лист «Тихого
 * кабинета» (№203, п. 5): `zone`, кромка 2 `edge`, белые кнопки с границей 1.5, подпись в одну строку чернилами.
 */
import { StyleSheet } from 'react-native';

import { abaAdultPanel, abaAdultPanelColors, abaAdultPanelTier, abaAdultSheet, abaColors, abaControlLip, abaIdentifyGrid, abaLayout, abaTypography, abaVisiblePraise } from '../../../../design/abaTokens';
import { contrast } from '../../../../design/contrast';
import { parentColors } from '../../../../design/parentTokens';
import ru from '../../../../i18n/locales/ru.json';
import en from '../../../../i18n/locales/en.json';
import { textEm } from '../../../../test/fontMetrics';
import { renderWithProviders, screen, fireEvent, act } from '../../../../test/render';
import { fontFamilyFor } from '../../../fonts';
import { AbaClockProvider, manualClock } from '../../clock';
import { AdultPanel, TopBar } from '../parts';

type Panel = Parameters<typeof AdultPanel>[0];

async function mount(buttons: Panel['buttons'], caption?: string, onPress = jest.fn(), more: Partial<Panel> = {}) {
  const clock = manualClock();
  await renderWithProviders(
    <AbaClockProvider clock={clock}>
      <AdultPanel buttons={buttons} height={124} insetBottom={0} caption={caption} pressed={null} onPress={onPress} {...more} />
    </AbaClockProvider>,
  );
  return { clock, onPress };
}

const HIDDEN = { includeHiddenElements: true };
const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id, HIDDEN).props.style);
const light = abaAdultPanelColors('light');

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

describe('лист «Тихого кабинета» (№203, п. 5)', () => {
  it('лист — `zone`, скруглённый верх 24, кромка 2 `edge` только по верху', async () => {
    await mount(['adult_prompted', 'refusal']);
    const s = flat('aba-adult-panel');
    expect(s.backgroundColor).toBe(parentColors.light.zone);
    expect([s.borderTopWidth, s.borderTopColor]).toEqual([abaAdultSheet.edge, parentColors.light.edge]);
    expect([s.borderTopLeftRadius, s.borderTopRightRadius]).toEqual([abaAdultSheet.radius, abaAdultSheet.radius]);
    expect(s.borderWidth ?? 0).toBe(0);
    expect(s.borderBottomWidth ?? 0).toBe(0);
  });

  it('кромка видна с обеих сторон (≥ 3 к фону пробы и к листу), подпись на листе ≥ 7', () => {
    expect(contrast(light.edge, abaColors.light.background)).toBeGreaterThanOrEqual(3);
    expect(contrast(light.edge, light.band)).toBeGreaterThanOrEqual(3);
    expect(contrast(light.caption, light.band)).toBeGreaterThanOrEqual(7);
    expect(contrast(light.label, light.button)).toBeGreaterThanOrEqual(7);
    // граница кнопки — граница нажимаемого: ≥ 3 к листу
    expect(contrast(light.border, light.band)).toBeGreaterThanOrEqual(3);
  });

  it('кромка входит в верхнее поле: ряды стоят там же, где по `abaAdultPanelTier` (№198)', async () => {
    for (const tier of Object.values(abaAdultPanelTier)) {
      await mount(['correct', 'approximation', 'incorrect', 'adult_prompted', 'refusal'], undefined, jest.fn(), { height: tier.height });
      const s = flat('aba-adult-panel');
      expect(s.height).toBe(tier.height);
      // сверху: кромка + поле = прежнее поле 8
      expect(s.borderTopWidth + s.paddingTop).toBe(abaAdultPanel.padding);
      expect(s.paddingBottom).toBe(abaAdultPanel.padding);
      // две строки кнопок и зазор 12 занимают ровно высоту тира без двух полей
      expect(s.height - s.borderTopWidth - s.paddingTop - s.paddingBottom).toBe(2 * tier.buttonHeight + tier.rowGap);
    }
  });

  it('низ панели — над нижним safe area: заливка уходит под отступ, кнопки — над ним', async () => {
    await mount(['adult_prompted', 'refusal'], undefined, jest.fn(), { height: 124, insetBottom: 34 });
    const s = flat('aba-adult-panel');
    expect(s.paddingBottom).toBe(34);
    expect(s.height).toBe(124 + 34 - abaAdultPanel.padding);
    // место рядов то же, что без отступа
    expect(s.height - s.borderTopWidth - s.paddingTop - s.paddingBottom).toBe(124 - 2 * abaAdultPanel.padding);
  });

  it('кнопки — белые, граница 1.5 `edge`, радиус 14; без контура 3 и борта', async () => {
    await mount(['correct', 'approximation', 'incorrect', 'adult_prompted', 'refusal']);
    for (const b of ['correct', 'approximation', 'incorrect', 'adult_prompted', 'refusal']) {
      const s = flat(`aba-panel-${b}`);
      expect([s.backgroundColor, s.borderWidth, s.borderColor, s.borderRadius]).toEqual([
        parentColors.light.card,
        abaAdultSheet.buttonBorder,
        parentColors.light.edge,
        abaAdultSheet.buttonRadius,
      ]);
      expect(s.borderWidth).toBeLessThan(3);
    }
    expect(screen.queryAllByTestId(/lip/, HIDDEN)).toHaveLength(0);
  });

  it('нажатая (в т. ч. в очереди) — та же толщина границы, другой цвет и заливка: подпись не сдвигается', async () => {
    await mount(['adult_prompted', 'refusal'], undefined, jest.fn(), { pressed: 'refusal' });
    const on = flat('aba-panel-refusal');
    const off = flat('aba-panel-adult_prompted');
    expect(on.borderWidth).toBe(off.borderWidth);
    expect(on.borderColor).not.toBe(off.borderColor);
    expect(on.backgroundColor).not.toBe(off.backgroundColor);
    expect(contrast(on.borderColor, light.band)).toBeGreaterThanOrEqual(7);
    expect(screen.getByTestId('aba-panel-refusal').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('заголовка «Для взрослого» нет', async () => {
    await mount(['adult_prompted', 'refusal'], ru.abaPanel.waitQuiet);
    expect(screen.queryByText(/для взросл/i)).toBeNull();
  });

  it('подпись — одна строка 14/20 500 чернилами, ужатие до 0.86', async () => {
    await mount(['adult_prompted', 'refusal'], ru.abaPanel.waitQuiet);
    const cap = screen.getByTestId('aba-panel-caption');
    const s = StyleSheet.flatten(cap.props.style);
    expect(cap.props.children).toBe('Ждите молча — подскажет приложение');
    expect(cap.props.numberOfLines).toBe(1);
    expect(cap.props.adjustsFontSizeToFit).toBe(true);
    expect(cap.props.minimumFontScale).toBe(0.86);
    expect([s.fontSize, s.lineHeight, s.fontWeight, s.color]).toEqual([14, 20, '500', parentColors.light.text]);
    expect(s.fontFamily).toBe(fontFamilyFor(abaTypography.sheetCaption));
  });

  // панель в полосе с полями 16 (`app/aba/session.tsx`): 360 − 2 × 16 − 2 × 8 = 312; ширина — по TTF Golos 500
  const width = abaIdentifyGrid.minContentWidth - 2 * abaAdultPanel.padding;
  const font = fontFamilyFor(abaTypography.sheetCaption);
  const fits = (s: string, scale: number) => textEm(font, s) * abaTypography.sheetCaption.size * scale <= width;

  it('`waitQuiet` (ru, en) — одна строка на экране 360 даже при ×1.2 с ужатием до 0.86', () => {
    for (const L of [ru, en]) {
      const s = L.abaPanel.waitQuiet;
      expect({ s, fits: fits(s, abaAdultPanel.maxFontSizeMultiplier * abaAdultPanel.minimumFontScale) }).toEqual({ s, fits: true });
    }
  });

  it('прочие подписи листа (ru, en) — одна строка при обычном размере с ужатием до 0.86 (iOS не ужмёт ниже)', () => {
    // при ×1.2 «Покажите на карточку жестом, не уговаривайте» (338 pt при 14) не входит и с 0.86 — Android ужимает
    // без нижней границы; проверить на телефоне (К2) или сократить строку
    for (const L of [ru, en]) {
      for (const s of [L.abaSession.offerCardHint, ...Object.values(L.abaSession.breakTraining)]) {
        expect({ s, fits: fits(s, abaAdultPanel.minimumFontScale) }).toEqual({ s, fits: true });
      }
    }
  });
});

describe('полоса 68: детские кнопки с бортом (№203)', () => {
  async function bar(calm?: boolean) {
    await renderWithProviders(
      <AbaClockProvider clock={manualClock()}>
        <TopBar onExit={jest.fn()} breakCard={{ frameShownAt: 0, onTap: jest.fn() }} calm={calm} />
      </AbaClockProvider>,
    );
  }

  it('карточка «перерыв» и выход — борт `controlLip` 4 за габаритом, в calm 2; габарит кнопки прежний', async () => {
    await bar();
    for (const id of ['aba-break-card-lip', 'aba-exit-lip']) {
      const s = flat(id);
      expect([s.backgroundColor, s.top, s.bottom]).toEqual([abaColors.light.controlLip, abaControlLip.height, -abaControlLip.height]);
    }
    const card = flat('aba-break-card');
    expect([card.width, card.height, card.borderColor, card.backgroundColor]).toEqual([abaLayout.breakCard, abaLayout.breakCard, abaColors.light.controlInk, abaColors.light.controlFill]);
  });

  it('calm: борт 2', async () => {
    await bar(true);
    for (const id of ['aba-break-card-lip', 'aba-exit-lip']) expect(flat(id).top).toBe(abaControlLip.calm);
  });
});

describe('знак «принято» в полосе 68 (решение 35, `abaVisiblePraise`)', () => {
  async function bar(more: Partial<Parameters<typeof TopBar>[0]> = {}) {
    await renderWithProviders(
      <AbaClockProvider clock={manualClock()}>
        <TopBar breakCard={{ frameShownAt: 0, onTap: jest.fn() }} {...more} />
      </AbaClockProvider>,
    );
  }

  it('без пропа знака нет', async () => {
    await bar();
    expect(screen.queryByTestId('aba-praise-mark', HIDDEN)).toBeNull();
  });

  it('praiseMark: знак есть, квадрат 48 со скруглением 6 цвета ink', async () => {
    await bar({ praiseMark: true, still: true });
    const square = screen.getByTestId('aba-praise-mark', HIDDEN).children[0];
    if (typeof square === 'string') throw new Error('ожидался квадрат, а не текст');
    const inner = StyleSheet.flatten(square.props.style);
    expect([inner.width, inner.height, inner.borderRadius, inner.backgroundColor]).toEqual([abaVisiblePraise.size, abaVisiblePraise.size, abaVisiblePraise.radius, abaColors.light.ink]);
  });

  it('знак не кнопка: касания проходят сквозь, обработчика нажатия нет', async () => {
    await bar({ praiseMark: true, still: true });
    const mark = screen.getByTestId('aba-praise-mark', HIDDEN);
    expect(mark.props.pointerEvents).toBe('none');
    expect(mark.props.onPress).toBeUndefined();
    expect(mark.props.accessibilityRole).toBeUndefined();
  });

  it('знак скрыт от чтения экрана: без includeHiddenElements его не найти', async () => {
    await bar({ praiseMark: true, still: true });
    expect(screen.getByTestId('aba-praise-mark', HIDDEN)).toBeTruthy();
    expect(screen.queryByTestId('aba-praise-mark')).toBeNull();
    const mark = screen.getByTestId('aba-praise-mark', HIDDEN);
    expect(mark.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(mark.props.accessibilityElementsHidden).toBe(true);
  });
});
