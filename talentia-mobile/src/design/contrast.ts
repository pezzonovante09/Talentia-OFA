/**
 * Контраст по WCAG 2.1. Одна реализация на все тесты токенов: цвет нельзя
 * поменять, не пересчитав контраст, и считать его везде надо одинаково.
 */

/** Относительная яркость цвета `#RRGGBB`. */
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const channel = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** Коэффициент контраста двух цветов, от 1 до 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Текст обязан читаться. */
export const TEXT_CONTRAST = 4.5;
/** Граница фигуры и нетекстовый элемент интерфейса. */
export const SHAPE_CONTRAST = 3;
