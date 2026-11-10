/**
 * Карточка-символ для буквы и слога (`design-lead`, этап D2 по аудиту 2026-11-09; высота — `child-ux-specialist` после
 * D2): знак `glyph` рисуется той же карточкой, что цифра; кегль один на все карточки задания — по самому широкому и
 * самому высокому знаку и размеру плитки; высота строки — натуральная высота Nunito (`glyphCard.lineHeightRatio`),
 * одна строка без многоточия, рамка — по плитке, а не поле 88.
 */
import { StyleSheet } from 'react-native';

import i18n, { initI18n } from '../../../i18n';
import { symbolBox, symbolFontSize } from '../../../design/glyphFit';
import { chooseTile } from '../../../design/taskTiles';
import { glyphCard } from '../../../design/tokens';
import { emptyChooseDraft } from '../../../domain/taskDraft';
import { renderWithProviders, screen } from '../../../test/render';
import type { ChooseTask } from '../../../types/task';
import { ChooseTaskView } from '../formats/ChooseTask';
import type { TaskStep } from '../formats/types';
import { MediaContent, symbolFitFor } from '../MediaContent';

const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style) as Record<string, unknown>;

describe('карточка буквы и слога', () => {
  beforeAll(() => initI18n({ lng: 'ru' }));

  it('glyph рисуется знаком: кегль и рамка из symbolFitFor по ширине и высоте плитки, одна строка без многоточия', async () => {
    const media = { labelKey: 'x', glyph: 'ЙА', lang: 'ru' as const, voice: 'select' as const };
    // плитка match на 320×568 — 85×60: кегль режет высота (бреве Й), а не ширина
    const fit = symbolFitFor([media], 85, 60);
    expect(fit.size).toBe(symbolFontSize(['ЙА'], 85, 60));
    expect(fit.size).toBeLessThan(symbolFontSize(['ЙА'], 85));
    await renderWithProviders(<MediaContent media={media} t={i18n.t} symbol={fit} testID="card" />);
    const text = screen.getByText('ЙА');
    const style = flat(text);
    expect(style.fontSize).toBe(fit.size);
    expect(style.lineHeight).toBe(Math.ceil(fit.size * glyphCard.lineHeightRatio));
    expect(style.fontFamily).toBe('Nunito_800ExtraBold');
    expect(text.props.numberOfLines).toBe(1);
    expect(text.props.ellipsizeMode).toBe('clip');
    expect(flat(screen.getByTestId('card'))).toMatchObject({ width: symbolBox(85), height: symbolBox(60) });
  });

  it('choose с буквами: у всех карточек один кегль — по самому широкому знаку', async () => {
    const task: ChooseTask = {
      id: 't',
      skill: 'x',
      format: 'choose',
      presentation: 'picture',
      promptKey: 'p',
      hintKey: 'h',
      stimulus: { labelKey: 's', shape: 'stone', count: 2 },
      options: [
        { id: 'a', labelKey: 'a', glyph: 'А', lang: 'ru', voice: 'select', correct: false },
        { id: 'b', labelKey: 'b', glyph: 'МА', lang: 'ru', voice: 'select', correct: true },
        { id: 'c', labelKey: 'c', glyph: 'Ш', lang: 'ru', voice: 'select', correct: false },
      ],
    };
    const step = { kind: 'task', task, attempt: 'first', removed: [], kept: [], pinned: null, rightOrder: null } as unknown as TaskStep;
    const width = 288;
    await renderWithProviders(
      <ChooseTaskView step={step} draft={emptyChooseDraft()} phase="answer" wrong={[]} listening={[]} width={width} height={300} onTap={() => undefined} onTouch={() => undefined} t={i18n.t} marksKey={0} />,
    );
    const sizes = ['А', 'МА', 'Ш'].map((g) => flat(screen.getByText(g)).fontSize);
    expect(new Set(sizes).size).toBe(1);
    const tile = chooseTile(width, 300, 3, true);
    expect(sizes[0]).toBe(symbolFontSize(['А', 'МА', 'Ш'], tile.w, tile.h));
    expect(sizes[0]).toBeLessThan(64);
  });
});
