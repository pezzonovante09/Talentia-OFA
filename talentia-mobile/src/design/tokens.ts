/**
 * Дизайн-система Talentia — направление B «Живая гуашь».
 *
 * Живёт рядом со старой `src/theme/`, не заменяя её: приложение пересобирается
 * постепенно, старые экраны продолжают читать `src/theme/index.tsx`.
 * Решения и обоснования — в REBUILD.md в корне репозитория.
 *
 * Все контрастные коэффициенты в комментариях посчитаны по WCAG 2.1
 * и проверены скриптом; менять цвет без пересчёта нельзя.
 */

export type Scheme = 'light' | 'dark';

/** Плотность интерфейса. Заменяет множитель кеглей: шрифты не масштабируются никогда. */
export type Density = 'default' | 'roomy';

export type RegionId = 'numbers' | 'words' | 'nature' | 'logic';

export type RegionPalette = Record<RegionId, string>;

export type ColorTokens = {
  /** Фон приложения. */
  background: string;
  /** Карточка поверх фона. */
  surface: string;
  /** Вложенный блок внутри карточки. */
  surfaceAlt: string;
  /** Утопленная область: поле ввода, слот. */
  surfaceSunken: string;

  text: string;
  textMuted: string;
  /** Текст на цветной заливке. */
  textInverse: string;

  /** Контур фигур. Несущий элемент направления: 3 pt на всём интерактивном. */
  outline: string;
  /** Тонкий разделитель. Не несёт разделение поверхностей — это делает outline. */
  border: string;

  /** Основное действие — заливка. */
  primary: string;
  /** То же действие в виде мелкого текста; ≥4.5:1 к фону. */
  primaryInk: string;
  onPrimary: string;

  secondary: string;
  secondaryInk: string;
  onSecondary: string;

  /** Награда. Сам по себе даёт 1.45:1 к фону — ВСЕГДА только с контуром. */
  accent: string;
  /** Тот же смысл для текста; ≥4.5:1 к фону. */
  accentInk: string;
  onAccent: string;

  /** Заливка «верно». */
  success: string;
  successInk: string;
  onSuccess: string;

  error: string;
  onError: string;

  focusRing: string;

  /** Цвет региона — полноэкранная заливка карты. */
  regions: RegionPalette;
  /** Текст поверх заливки региона. В светлой схеме тёмный, в тёмной — светлый. */
  onRegion: string;
  /** Регион в виде текста или мелкой метки; ≥4.5:1 к фону. */
  regionsInk: RegionPalette;
};

export type TypeStyle = {
  size: number;
  lineHeight: number;
  weight: '400' | '500' | '600' | '700' | '800';
  family: string;
};

export type TypographyTokens = {
  display: TypeStyle;
  title: TypeStyle;
  subtitle: TypeStyle;
  body: TypeStyle;
  label: TypeStyle;
  caption: TypeStyle;
};

/**
 * Направление B не использует тени: глубина выражается «подушкой» —
 * дублем фигуры цветом outline со смещением вниз. Нажатие съедает смещение.
 */
export type ElevationSpec = {
  /** Смещение подушки по вертикали, pt. */
  offsetY: number;
};

export type SpacingTokens = Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl', number>;
export type RadiiTokens = Record<'sm' | 'md' | 'lg' | 'xl' | 'pill', number>;
export type StrokeTokens = Record<'hairline' | 'base' | 'bold', number>;
export type TouchTokens = Record<'min' | 'comfortable' | 'primary' | 'gap', number>;
export type MotionTokens = Record<'instant' | 'quick' | 'base' | 'slow' | 'celebrate', number>;
export type ElevationTokens = Record<'flat' | 'raised' | 'overlay', ElevationSpec>;

export type AppTheme = {
  scheme: Scheme;
  calmMode: boolean;
  focusMode: boolean;
  density: Density;

  colors: ColorTokens;
  spacing: SpacingTokens;
  typography: TypographyTokens;
  radii: RadiiTokens;
  stroke: StrokeTokens;
  touch: TouchTokens;
  elevation: ElevationTokens;
  motion: MotionTokens;
};

/* ───────────────────────── шкалы ───────────────────────── */

/** Сетка 4 pt. Старая тема использовала 4/8/14/22/32 — вне сетки. */
export const spacing: SpacingTokens = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radii: RadiiTokens = {
  sm: 12,
  md: 20,
  lg: 28,
  xl: 36,
  pill: 999,
};

/** Толщина контура. Направление B держится на `base`. */
export const stroke: StrokeTokens = {
  hairline: 1,
  base: 3,
  /** Утолщение целевой карточки в ABA-подсказке. */
  bold: 6,
};

/**
 * Размеры зон нажатия. Требование UX-аудита: ребёнок 4–6 лет промахивается
 * по цели меньше 60 pt, и это норма, а не его ошибка.
 */
export const touch: TouchTokens = {
  /** Абсолютный минимум для любого интерактивного элемента. */
  min: 60,
  /** Узлы карты, варианты ответа. */
  comfortable: 72,
  /** Высота главной кнопки экрана. */
  primary: 88,
  /** Минимальный зазор между двумя целями. */
  gap: 16,
};

export const motion: MotionTokens = {
  instant: 0,
  quick: 140,
  base: 220,
  slow: 360,
  /** Одноразовое празднование. Никогда не цикл. */
  celebrate: 900,
};

export const elevation: ElevationTokens = {
  flat: { offsetY: 0 },
  raised: { offsetY: 4 },
  overlay: { offsetY: 6 },
};

/** Подушка тоньше в спокойном режиме. */
export const elevationCalm: ElevationTokens = {
  flat: { offsetY: 0 },
  raised: { offsetY: 2 },
  overlay: { offsetY: 3 },
};

/* ───────────────────────── типографика ───────────────────────── */

/**
 * Comfortaa в заголовках вместо предложенной Fredoka: у Fredoka есть только
 * latin, latin-ext и hebrew — она не отрисует ни кыргызский, ни русский.
 * Comfortaa покрывает cyrillic-ext (U+0460–052F), где живут ң ө ү.
 */
/**
 * Разделение работает на возраст, а не только на вкус: то, что ребёнок должен
 * узнать с одного взгляда — вопрос, подпись варианта, кнопка, — набрано мягким
 * характерным Comfortaa; то, что он или родитель читает построчно — подсказки,
 * длинный текст, родительский раздел — разборчивым Nunito. У Comfortaa низкий
 * рост строчных и тонкие штрихи, на мелком кегле он проигрывает.
 */
const DISPLAY_FAMILY = 'Comfortaa';
const TEXT_FAMILY = 'Nunito';

export const typography: TypographyTokens = {
  display: { size: 34, lineHeight: 40, weight: '700', family: DISPLAY_FAMILY },
  title: { size: 28, lineHeight: 36, weight: '700', family: DISPLAY_FAMILY },
  subtitle: { size: 22, lineHeight: 30, weight: '600', family: DISPLAY_FAMILY },
  body: { size: 18, lineHeight: 26, weight: '400', family: TEXT_FAMILY },
  label: { size: 18, lineHeight: 24, weight: '800', family: TEXT_FAMILY },
  caption: { size: 14, lineHeight: 20, weight: '700', family: TEXT_FAMILY },
};

/**
 * Нижняя граница авто-сжатия заголовка. Кыргызская строка бывает до x2.3
 * от русской («Образ Тали» → «Талинин сырткы көрүнүшү»), поэтому заголовок
 * ужимается до 80%, но не ниже этого кегля, а контейнер всегда резервирует
 * высоту под две строки — иначе страница прыгает при смене языка.
 */
export const TITLE_MIN_SIZE = 22;
export const TITLE_MAX_LINES = 2;

/* ───────────────────────── палитры ───────────────────────── */

const lightColors: ColorTokens = {
  background: '#FFF3E3',
  surface: '#FFFFFF',
  surfaceAlt: '#FFE6C7', // text поверх: 13.86:1
  surfaceSunken: '#F2D9B8', // text поверх: 12.27:1

  text: '#2A1A12', // 15.28:1
  textMuted: '#6E564A', // 6.20:1
  textInverse: '#FFF3E3',

  outline: '#2A1A12',
  border: '#D4A66A', // 2.03:1 — мягкая группировка; настоящее разделение несёт outline

  primary: '#5A34C4', // 7.04:1
  primaryInk: '#5A34C4',
  onPrimary: '#FFFFFF', // на primary: 7.71:1

  secondary: '#D93A1E', // 4.19:1 — только крупное и иконки
  secondaryInk: '#CE371D', // 4.58:1 — для текста
  onSecondary: '#FFFFFF', // на secondary: 4.59:1

  accent: '#FFC42E', // 1.45:1 — только заливка с контуром
  accentInk: '#906800', // 4.60:1 — для текста
  onAccent: '#2A1A12', // на accent: 10.51:1

  success: '#12855A',
  successInk: '#0D6B48', // 5.97:1
  onSuccess: '#FFFFFF', // на success: 4.64:1

  error: '#C42020', // 5.37:1
  onError: '#FFFFFF', // на error: 5.87:1

  focusRing: '#5A34C4',

  regions: {
    numbers: '#F2B705', // с onRegion: 9.20:1
    words: '#0E8FBF', // 4.54:1
    nature: '#2FA24E', // 5.10:1
    logic: '#9671DB', // осветлён с #7A4BD1: тот давал 2.99:1 под тёмным текстом
  },
  onRegion: '#2A1A12',
  regionsInk: {
    numbers: '#8C6A03', // 4.59:1
    words: '#0C78A0', // 4.56:1
    nature: '#25803E', // 4.53:1
    logic: '#7A4BD1', // 5.11:1
  },
};

const darkColors: ColorTokens = {
  background: '#1B1410',
  surface: '#2A211B',
  surfaceAlt: '#372B23',
  surfaceSunken: '#221A15',

  text: '#FFF3E3', // 16.62:1
  textMuted: '#997867', // 4.54:1
  textInverse: '#1B1410',

  outline: '#FFF3E3', // контур инвертируется — главный приём тёмной темы
  border: '#775F4D', // 3.06:1 (#4A3B30 давал 1.70:1 и был отвергнут)

  primary: '#9B7CFF', // 5.82:1
  primaryInk: '#9B7CFF',
  onPrimary: '#1B1410',

  secondary: '#FF7455', // 6.83:1
  secondaryInk: '#FF7455',
  onSecondary: '#1B1410',

  accent: '#FFD46B', // 12.89:1
  accentInk: '#FFD46B',
  onAccent: '#1B1410',

  success: '#4FC694', // 8.52:1
  successInk: '#4FC694',
  onSuccess: '#1B1410',

  error: '#FF6B6B', // 6.56:1
  onError: '#1B1410',

  focusRing: '#9B7CFF',

  // Заливки притемнены: в тёмной схеме поверх них лежит светлый текст.
  regions: {
    numbers: '#8C6A03', // с onRegion: 4.59:1
    words: '#0C78A0', // 4.56:1
    nature: '#25803E', // 4.53:1
    logic: '#8255D4', // 4.57:1
  },
  onRegion: '#FFF3E3',
  regionsInk: {
    numbers: '#F2B705', // 10.01:1
    words: '#0E8FBF', // 4.94:1
    nature: '#2FA24E', // 5.54:1
    logic: '#916AD9', // 4.56:1
  },
};

/** Спокойный режим: насыщенность акцентов вниз на 40%, значения пересчитаны. */
const lightCalmColors: ColorTokens = {
  ...lightColors,
  primary: '#6851A7', // 5.77:1
  primaryInk: '#6851A7',
  secondary: '#B45443',
  secondaryInk: '#B25342', // 4.56:1
  accent: '#D5B258', // заливка с контуром
  accentInk: '#7A6234',
  success: '#296E54', // 5.56:1
  successInk: '#296E54',
  error: '#A34141', // 5.66:1
  focusRing: '#6851A7',
  regions: {
    numbers: '#C39F34', // с onRegion: 6.64:1
    words: '#378EAF', // 4.50:1
    nature: '#4B955F', // 4.59:1
    logic: '#9C86C6', // 5.29:1
  },
  regionsInk: {
    numbers: '#7A6420',
    words: '#2E7793', // 4.59:1
    nature: '#3B7549',
    logic: '#7D60B3', // 4.57:1
  },
};

const darkCalmColors: ColorTokens = {
  ...darkColors,
  primary: '#A996E5', // 7.09:1
  primaryInk: '#A996E5',
  secondary: '#DD8A77', // 6.91:1
  secondaryInk: '#DD8A77',
  accent: '#E1C889', // 11.11:1
  accentInk: '#E1C889',
  success: '#67AE90', // 6.96:1
  successInk: '#67AE90',
  error: '#E18989', // 7.05:1
  focusRing: '#A996E5',
  regions: {
    numbers: '#715C1E', // с onRegion: 5.90:1
    words: '#2A6A82', // 5.51:1
    nature: '#376E46', // 5.51:1
    logic: '#7D60B4', // 4.56:1
  },
};

export const palettes: Record<Scheme, { normal: ColorTokens; calm: ColorTokens }> = {
  light: { normal: lightColors, calm: lightCalmColors },
  dark: { normal: darkColors, calm: darkCalmColors },
};

/* ───────────────────────── сборка темы ───────────────────────── */

/**
 * Собирает тему. Схема — НЕЗАВИСИМАЯ ось: старая тема включала тёмные цвета
 * только при `calmMode && systemScheme === 'dark'`, из-за чего ребёнок
 * с системной тёмной темой получал светло-голубой фон ночью.
 *
 * `focusMode` здесь не меняет размеры: он управляет СОСТАВОМ экрана
 * (что рендерится), а разрежение задаёт `density`. Кегли не масштабируются
 * никогда — иначе длинная кыргызская строка гарантированно переполняет блок.
 */
export function buildTheme({
  scheme,
  calmMode,
  focusMode,
  density = focusMode ? 'roomy' : 'default',
}: {
  scheme: Scheme;
  calmMode: boolean;
  focusMode: boolean;
  density?: Density;
}): AppTheme {
  const colors = calmMode ? palettes[scheme].calm : palettes[scheme].normal;
  const roomy = density === 'roomy';

  return {
    scheme,
    calmMode,
    focusMode,
    density,
    colors,
    spacing: roomy ? { ...spacing, lg: 24, xl: 32, xxl: 40 } : spacing,
    typography,
    radii,
    stroke: calmMode ? { ...stroke, base: 2 } : stroke,
    touch,
    elevation: calmMode ? elevationCalm : elevation,
    motion,
  };
}
