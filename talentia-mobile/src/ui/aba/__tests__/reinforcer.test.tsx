/**
 * Выбор награды в виде «Тихого кабинета» (№203, шаг 8): окно сцены `rewardWindow`, подпись в одну строку с ужатием
 * до 0.86, выбранная — контур 6 без борта, опущена, галочка в кружке 32 чернилами; соседи без прозрачности; полоса
 * взрослого и подпись ожидания — листом взрослого (`zone`, кромка `edge`). Логику выбора проверяют тесты экранов.
 */
import { StyleSheet } from 'react-native';

import ru from '../../../i18n/locales/ru.json';
import {
  abaAdultPanelColors,
  abaAdultSheet,
  abaColors,
  abaControlLip,
  abaReinforcerCardFace,
  abaReinforcerCardSize,
  abaReinforcerCardWindow,
  abaReinforcerChoice,
  ABA_CONTROL_STROKE,
} from '../../../design/abaTokens';
import { contrast } from '../../../design/contrast';
import { stroke } from '../../../design/tokens';
import { REWARD_ART } from '../../../assets/registry';
import { REINFORCERS } from '../../../content/aba/reinforcers';
import { renderWithProviders, screen } from '../../../test/render';
import { rewardPicture } from '../access/RewardPicture';
import type { ChoiceRun } from '../model/reinforcerChoiceRun';
import { ReinforcerChoiceView } from '../reinforcer';

const c = abaColors.light;
const p = abaAdultPanelColors('light');
const OPTIONS = ['bubbles', 'pinwheel', 'marble_run'];
const SIZE = 136;

const run = (over: Partial<ChoiceRun> = {}): ChoiceRun =>
  ({ config: 'with_adult', shownAt: 0, selected: null, by: null, firstTapAt: null, firstTapId: null, holdUntil: null, stripShownAt: null, pulsed: false, ...over }) as ChoiceRun;

const view = (r: ChoiceRun, extra: { waitCaption?: string; calm?: boolean; options?: string[]; size?: number } = {}) =>
  renderWithProviders(
    <ReinforcerChoiceView
      run={r}
      options={extra.options ?? OPTIONS}
      cardSize={extra.size ?? SIZE}
      boardCells={1}
      pulse={false}
      onTap={jest.fn()}
      onAdultTap={jest.fn()}
      waitCaption={extra.waitCaption}
      calm={extra.calm}
    />,
  );

/** Борт и галочка скрыты от экранного чтеца (название несёт карточка) — ищем и скрытые узлы. */
const HIDDEN = { includeHiddenElements: true } as const;
/** Стиль узла; у `Pressable` стиль-функция уже вычислена RN в `props.style`. */
const styleOf = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID, HIDDEN).props.style) ?? {};
const translateY = (testID: string) =>
  ((styleOf(testID).transform ?? []) as Record<string, number>[]).reduce((y, t) => y + (t.translateY ?? 0), 0);

describe('карточка награды: окно и подпись', () => {
  it('невыбранная — белая, контур 3 чернилами, борт 4, окно сцены лавандой, без галочки', async () => {
    await view(run());
    for (const id of OPTIONS) {
      const card = styleOf(`aba-reinforcer-${id}`);
      expect(card.borderWidth).toBe(ABA_CONTROL_STROKE);
      expect(card.borderColor).toBe(c.controlInk);
      expect(card.backgroundColor).toBe(c.controlFill);
      expect(card.width).toBe(SIZE);
      expect(card.height).toBe(SIZE);
      expect(styleOf(`aba-choice-lip-${id}`).backgroundColor).toBe(c.controlLip);
      expect(styleOf(`aba-choice-lip-${id}`).top).toBe(abaControlLip.height);
      expect(styleOf(`aba-choice-window-${id}`).backgroundColor).toBe(c.rewardWindow);
      expect(translateY(`aba-choice-card-${id}`)).toBe(0);
      expect(screen.queryByTestId(`aba-choice-check-${id}`, HIDDEN)).toBeNull();
    }
  });

  it('подпись — название одной строкой, ужатие до 0.86, чернилами; второй строки нет', async () => {
    await view(run());
    const label = screen.getByTestId('aba-choice-label-marble_run');
    expect(label).toHaveTextContent(ru.abaReinforcer.items.marble_run);
    expect(label.props.numberOfLines).toBe(1);
    expect(label.props.adjustsFontSizeToFit).toBe(true);
    expect(label.props.minimumFontScale).toBe(0.86);
    expect(label.props.maxFontSizeMultiplier).toBe(abaReinforcerCardFace.labelMax);
    expect(StyleSheet.flatten(label.props.style).color).toBe(c.ink);
    expect(contrast(c.ink, c.controlFill)).toBeGreaterThanOrEqual(7);
  });

  it('позиция без картинки (партия 2): название уже в окне — подпись под ним не повторяет его', async () => {
    const bare = REINFORCERS.map((r) => r.id).find((id) => !REWARD_ART[id] && rewardPicture(id, 60, '') === null);
    if (!bare) return; // все картинки уже есть — повторять нечего
    await view(run(), { options: [bare, 'bubbles', 'pinwheel'] });
    expect(screen.queryByTestId(`aba-choice-label-${bare}`)).toBeNull();
    expect(screen.getByTestId('aba-choice-label-bubbles')).toBeTruthy();
  });
});

describe('карточка награды: выбранная', () => {
  it('контур 6 (stroke.bold), без борта, опущена на 4, галочка в кружке 32 чернилами', async () => {
    await view(run({ selected: 'pinwheel', by: 'child' }));
    const card = styleOf('aba-reinforcer-pinwheel');
    expect(card.borderWidth).toBe(stroke.bold);
    expect(card.borderWidth).toBeGreaterThanOrEqual(5);
    expect(card.borderColor).toBe(c.controlInk);
    expect(card.width).toBe(SIZE);
    expect(screen.queryByTestId('aba-choice-lip-pinwheel', HIDDEN)).toBeNull();
    expect(translateY('aba-choice-card-pinwheel')).toBe(4);
    const check = styleOf('aba-choice-check-pinwheel');
    expect(check.width).toBe(32);
    expect(check.height).toBe(32);
    expect(check.borderRadius).toBe(16);
    expect(check.backgroundColor).toBe(c.controlInk);
    // белая галочка на чернилах
    expect(contrast(c.controlFill, c.controlInk)).toBeGreaterThanOrEqual(7);
  });

  it('соседи остаются как были: контур 3, борт, без сдвига и без прозрачности', async () => {
    await view(run({ selected: 'pinwheel', by: 'child' }));
    for (const id of ['bubbles', 'marble_run']) {
      expect(styleOf(`aba-reinforcer-${id}`).borderWidth).toBe(ABA_CONTROL_STROKE);
      expect(screen.getByTestId(`aba-choice-lip-${id}`, HIDDEN)).toBeTruthy();
      expect(translateY(`aba-choice-card-${id}`)).toBe(0);
      expect(screen.queryByTestId(`aba-choice-check-${id}`, HIDDEN)).toBeNull();
    }
    for (const id of OPTIONS) {
      for (const tid of [`aba-choice-card-${id}`, `aba-reinforcer-${id}`, `aba-choice-window-${id}`]) {
        expect(styleOf(tid).opacity ?? 1).toBe(1);
      }
    }
  });

  it('calm: борт 2, выбранная опускается на него же', async () => {
    await view(run({ selected: 'bubbles', by: 'child' }), { calm: true });
    expect(styleOf('aba-choice-lip-pinwheel').top).toBe(abaControlLip.calm);
    expect(translateY('aba-choice-card-bubbles')).toBe(abaControlLip.calm);
    expect(styleOf('aba-reinforcer-bubbles').borderWidth).toBe(stroke.bold);
  });

  it('окно и подпись помещаются внутри контура 6 на любом размере карточки — при выборе ничего не сдвигается', () => {
    const f = abaReinforcerCardFace;
    const sizes = new Set<number>();
    for (const [w, h] of [[288, 520], [328, 568], [343, 647], [358, 763]]) sizes.add(abaReinforcerCardSize(w, h));
    for (const size of sizes) {
      const win = abaReinforcerCardWindow(size);
      expect(2 * stroke.bold + 2 * f.inset + win.height + f.labelSlot).toBe(size);
      expect(2 * stroke.bold + 2 * f.inset + win.width).toBe(size);
      expect(win.art).toBeGreaterThan(0);
      expect(win.art).toBeLessThanOrEqual(Math.min(win.width, win.height));
    }
    expect(f.labelSlot).toBeGreaterThanOrEqual(Math.ceil(20 * f.labelMax));
  });
});

describe('лист взрослого под карточками', () => {
  const sheet = (testID: string) => {
    const s = styleOf(testID);
    expect(s.height).toBe(abaReinforcerChoice.adultStripHeight);
    expect(s.backgroundColor).toBe(p.band);
    expect(s.borderWidth).toBe(abaAdultSheet.edge);
    expect(s.borderColor).toBe(p.edge);
    expect(s.borderRadius).toBe(abaAdultSheet.radius);
  };

  it('подпись ожидания — лист `zone` с кромкой `edge`, текст чернилами 14/20 500', async () => {
    await view(run(), { waitCaption: ru.abaPanel.choiceWait });
    sheet('aba-choice-wait');
    const text = screen.getByText(ru.abaPanel.choiceWait);
    const ts = StyleSheet.flatten(text.props.style);
    expect(ts.color).toBe(p.caption);
    expect(ts.fontSize).toBe(14);
    expect(ts.lineHeight).toBe(20);
    expect(ts.fontWeight).toBe('500');
    expect(text.props.minimumFontScale).toBe(0.86);
    expect(contrast(p.caption, p.band)).toBeGreaterThanOrEqual(7);
    expect(contrast(p.edge, p.band)).toBeGreaterThanOrEqual(3);
  });

  it('полоса взрослого — тот же лист; кнопки белые, граница 1.5 `edge`, радиус 14', async () => {
    await view(run({ stripShownAt: 30_000 }));
    sheet('aba-adult-strip');
    for (const id of OPTIONS) {
      const b = styleOf(`aba-adult-choose-${id}`);
      expect(b.backgroundColor).toBe(p.button);
      expect(b.borderColor).toBe(p.border);
      expect(b.borderWidth).toBe(abaAdultSheet.buttonBorder);
      expect(b.borderRadius).toBe(abaAdultSheet.buttonRadius);
      expect(b.height).toBe(48);
    }
    expect(contrast(p.border, p.band)).toBeGreaterThanOrEqual(3);
    expect(contrast(p.border, p.button)).toBeGreaterThanOrEqual(3);
  });
});
