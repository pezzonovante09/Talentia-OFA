/**
 * Правило иконок (DESIGN_PROMPTS.md «Иконки — одно правило», ASSETS.md шаг 4): заливка глифа —
 * `currentColor`, контур — `#2A1A12`. В тёмной теме контур инвертируется (`colors.outline` `#FFF3E3`),
 * поэтому контур в svg заменяется на проп `stroke`: экран передаёт `stroke={theme.colors.outline}`,
 * без пропа остаётся исходный цвет. Старые трассировки Recraft пишут цвет строчными — ловим оба.
 */
module.exports = {
  replaceAttrValues: {
    '#2A1A12': "{props.stroke || '#2A1A12'}",
    '#2a1a12': "{props.stroke || '#2A1A12'}",
  },
};
