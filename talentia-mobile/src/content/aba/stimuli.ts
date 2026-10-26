/**
 * Стимулы проб `match` (Ц2.12 `docs/design/aba-screens-2026-10-25.md`; правило цвета — ABA.md «Визуальный язык»,
 * №162). Предметы — SVG из партии `docs/assets/aba-match-stimuli.md` (скилл `asset-pipeline`; пока файла нет — у
 * `ABA_OBJECT_ART` `null`, экран рисует заглушку-силуэт). Формы и цвета — не файлы, их рисует код.
 *
 * `class` — класс стимула для пула подкрепителей (`reinforcerPoolFor`): позиция каталога с тем же классом в
 * программу не идёт. Ведёрко убрано (класс сцены `marble_run`), вместо него ложка.
 */
export type AbaStimulus =
  | { id: string; kind: 'object'; class: string }
  | { id: string; kind: 'shape'; class: 'shape'; shape: 'circle' | 'square' | 'triangle' | 'ring' | 'rhombus' }
  /** Одна форма (круг) одного размера; hex одинаков в светлой и тёмной — стимул не перекрашивается. */
  | { id: string; kind: 'color'; class: 'color'; hex: string };

const obj = (name: string, cls: string): AbaStimulus => ({ id: `aba-obj-${name}`, kind: 'object', class: cls });

export const ABA_STIMULI: readonly AbaStimulus[] = [
  obj('apple', 'fruit'),
  obj('pear', 'fruit'),
  obj('carrot', 'vegetable'),
  obj('mushroom', 'mushroom'),
  obj('leaf', 'leaf'),
  obj('car', 'vehicle'),
  obj('plane', 'vehicle'),
  obj('boat', 'vehicle'),
  obj('house', 'house'),
  obj('umbrella', 'umbrella'),
  obj('key', 'key'),
  obj('spoon', 'kitchen'),
  obj('teapot', 'kitchen'),
  obj('book', 'book'),
  obj('hat', 'clothes'),
  obj('mitten', 'clothes'),
  obj('pyramid', 'toy'),
  obj('sock', 'clothes'),
  { id: 'aba-shape-circle', kind: 'shape', class: 'shape', shape: 'circle' },
  { id: 'aba-shape-square', kind: 'shape', class: 'shape', shape: 'square' },
  { id: 'aba-shape-triangle', kind: 'shape', class: 'shape', shape: 'triangle' },
  { id: 'aba-shape-ring', kind: 'shape', class: 'shape', shape: 'ring' },
  { id: 'aba-shape-rhombus', kind: 'shape', class: 'shape', shape: 'rhombus' },
  // Окабе–Ито без оранжевого #E69F00 и жёлтого #F0E442 (близки к жетону); зелёный и пурпурный — не в одно поле
  { id: 'aba-color-blue', kind: 'color', class: 'color', hex: '#0072B2' },
  { id: 'aba-color-vermilion', kind: 'color', class: 'color', hex: '#D55E00' },
  { id: 'aba-color-green', kind: 'color', class: 'color', hex: '#009E73' },
  { id: 'aba-color-purple', kind: 'color', class: 'color', hex: '#CC79A7' },
];

/** Цвет формы-стимула — тот, что у заливки; контур у всех `#2A1A12` 2 pt. Формы одного цвета. */
export const ABA_SHAPE_FILL = '#0072B2';

/** Пары цветов, которые не ставятся в одно поле: близкая яркость, хуже при нарушениях цветового зрения. */
export const ABA_COLOR_NOT_TOGETHER: readonly [string, string][] = [['aba-color-green', 'aba-color-purple']];
