import type { ColorTokens } from '../design/tokens';

/** Имя цвета темы, за которым стоит строка (без палитр регионов `regions` / `regionsInk`). */
export type ColorName = { [K in keyof ColorTokens]: ColorTokens[K] extends string ? K : never }[keyof ColorTokens];
