/**
 * Дизайн-система Talentia — направление B «Живая гуашь».
 *
 * Живёт рядом со старой `src/theme/`, не заменяя её: приложение пересобирается
 * постепенно, старые экраны продолжают читать `src/theme/index.tsx`.
 * Решения и обоснования — в REBUILD.md в корне репозитория.
 *
 * Все контрастные коэффициенты в комментариях посчитаны по WCAG 2.1
 * (`contrast.ts`) и проверены тестами; менять цвет без пересчёта нельзя.
 */
import type { Region } from '../types/task';

export type Scheme = 'light' | 'dark';

/** Плотность интерфейса. Заменяет множитель кеглей: шрифты не масштабируются никогда. */
export type Density = 'default' | 'roomy';

/**
 * Регион — **один тип на всё приложение**: схема курса (`types/task.ts`) — источник,
 * токены и реестр ассетов (`assets/registry.ts`) его только читают. Раньше здесь был
 * свой список с `logic`, а в реестре — `workshop` (аудит 2026-10-06, А25).
 */
export type RegionId = Region['id'];

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
  /** То же действие в виде мелкого текста; ≥4.5:1 на каждой поверхности `INK_SURFACES`. */
  primaryInk: string;
  onPrimary: string;

  secondary: string;
  secondaryInk: string;
  onSecondary: string;

  /** Награда. Сам по себе даёт 1.45:1 к фону — ВСЕГДА только с контуром. */
  accent: string;
  /** Тот же смысл для текста; ≥4.5:1 на каждой поверхности `INK_SURFACES`. */
  accentInk: string;
  onAccent: string;

  /** Заливка «верно». */
  success: string;
  successInk: string;
  onSuccess: string;

  /** Ошибка. Служит и заливкой (с `onError`), и текстом — поэтому тоже чернила. */
  error: string;
  onError: string;

  focusRing: string;

  /** Цвет региона — полноэкранная заливка карты. */
  regions: RegionPalette;
  /** Текст поверх заливки региона. В светлой схеме тёмный, в тёмной — светлый. */
  onRegion: string;
  /** Регион в виде текста или мелкой метки; ≥4.5:1 на каждой поверхности `INK_SURFACES`. */
  regionsInk: RegionPalette;
};

/**
 * Где гарантированы чернила — детский аналог `REGION_INK_SURFACE` из `parentTokens.ts`.
 * Все `*Ink`, `error` и `regionsInk` проходят 4.5:1 на **каждой** из этих поверхностей,
 * во всех четырёх палитрах. Раньше гарантия была только к фону, и на `surfaceSunken`
 * чернила давали 3.6:1 (аудит 2026-10-06, А25).
 *
 * Связывающие поверхности: в светлых схемах — `surfaceSunken` (самая тёмная, чернила
 * держат ≥4.66:1), в тёмных — `surfaceAlt` (самая светлая, ≥4.67:1). Проверяет
 * `__tests__/tokens.test.ts`.
 */
export const INK_SURFACES = ['background', 'surface', 'surfaceAlt', 'surfaceSunken'] as const satisfies readonly (keyof ColorTokens)[];

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
export type MotionTokens = Record<'instant' | 'press' | 'quick' | 'base' | 'slow' | 'celebrate', number>;
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
  /**
   * Отклик плоского нажимаемого — сжатие, а не посадка на подушку (решение №69):
   * Tali, пузырь, стимул отвечают на тап не дольше 100 мс.
   */
  press: 90,
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

/**
 * У кого подушка (решения №10, №68, №69). Подушка значит «это кнопка»: она есть у
 * вариантов ответа, управления (выход, повтор, действие) и у плитки «разложен» в
 * `group`. Tali, пузырь и стимул плоские — тап по ним только повторяет звук, и лишние
 * «кнопки» спорили бы с вариантами; их отклик — сжатие за `motion.press`. Жетоны ABA
 * плоские — они не нажимаются вовсе (`abaTokens.ts`).
 *
 * Calm только утончает подушку (`elevationCalm`), focus и тёмная схема карту не меняют:
 * «нажимаемость» — свойство роли, а не режима.
 */
export type CushionRole = 'answerOption' | 'control' | 'groupPlaced' | 'tali' | 'bubble' | 'stimulus' | 'abaToken';

export const cushionByRole: Record<CushionRole, 'raised' | 'flat'> = {
  answerOption: 'raised',
  control: 'raised',
  groupPlaced: 'raised',
  tali: 'flat',
  bubble: 'flat',
  stimulus: 'flat',
  abaToken: 'flat',
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
  // Чернила ниже — «к фону / к surfaceSunken» (самая тёмная поверхность светлой схемы).
  // Прежние #CE371D, #906800, #C42020 давали на surfaceSunken 3.68 / 3.70 / 4.31.
  secondaryInk: '#B12E17', // 5.86 / 4.70
  onSecondary: '#FFFFFF', // на secondary: 4.59:1

  accent: '#FFC42E', // 1.45:1 — только заливка с контуром
  accentInk: '#7C5900', // 5.84 / 4.68
  onAccent: '#2A1A12', // на accent: 10.51:1

  success: '#12855A',
  successInk: '#0D6B48', // 5.97 / 4.79
  onSuccess: '#FFFFFF', // на success: 4.64:1

  error: '#BB1E1E', // 5.78 / 4.64; был #C42020 — тот же красный на полтона глубже
  onError: '#FFFFFF', // на error: 6.33:1

  focusRing: '#5A34C4', // primaryInk тот же: 7.04 / 5.65

  regions: {
    numbers: '#F2B705', // с onRegion: 9.20:1
    words: '#0E8FBF', // 4.54:1
    nature: '#2FA24E', // 5.10:1
    workshop: '#9671DB', // осветлён с #7A4BD1: тот давал 2.99:1 под тёмным текстом
    /**
     * Кыргызский (А17) — малиновый. С onRegion 5.38:1. Цвет новой роли: ни один регион
     * и ни один сигнал не занимает тон 340°.
     *
     * Отличимость от сигналов. От `error` #BB1E1E: тон 340° против 0°, яркость 2.03:1.
     * От `secondary` #D93A1E: 340° против 9°, яркость 1.48:1 — самая близкая пара.
     * При дейтеранопии (Viénot 1999) малиновый становится нейтрально-серым ≈#9B9B90,
     * error — тёмной оливой ≈#6E6E07 (1.95:1), secondary — оливой ≈#858500 (1.42:1):
     * различие держат и насыщенность, и яркость. При протанопии ≈#808094 против
     * ≈#494921 (2.38:1) и ≈#5F5F22 (1.71:1). Ближе всех при дейтеранопии «Мастерская»
     * ≈#7D7DDB (1.29:1) — серый против синего; регион всё равно не кодируется одним
     * цветом: на карте его несут панорама и подпись (А25).
     */
    kyrgyz: '#E36A93',
  },
  onRegion: '#2A1A12',
  // Затемнены до ≥4.5 на surfaceSunken: прежние (#8C6A03, #0C78A0, #25803E, #7A4BD1)
  // проходили только к фону, на surfaceSunken давали 3.63–4.10. Тон сохранён.
  regionsInk: {
    numbers: '#785A02', // к фону 5.88, surfaceAlt 5.33, surfaceSunken 4.72
    words: '#096689', // 5.86 / 5.32 / 4.70
    nature: '#1E6D34', // 5.83 / 5.28 / 4.68
    workshop: '#7044C0', // 5.85 / 5.31 / 4.70
    kyrgyz: '#964460', // 5.83 / 5.28 / 4.68; как текст рядом с error различается тоном
  },
};

const darkColors: ColorTokens = {
  background: '#1B1410',
  surface: '#2A211B',
  surfaceAlt: '#372B23',
  surfaceSunken: '#221A15',

  text: '#FFF3E3', // 16.62:1
  // #997867 давал 4.54:1 к фону, но 3.93:1 на карточке — проходил только там, где
  // его не используют. #AD8F7E: 6.07 к фону, 5.26 на surface, 4.57 на surfaceAlt.
  textMuted: '#AD8F7E',
  textInverse: '#1B1410',

  outline: '#FFF3E3', // контур инвертируется — главный приём тёмной темы
  border: '#775F4D', // 3.06:1 (#4A3B30 давал 1.70:1 и был отвергнут)

  primary: '#9B7CFF', // 5.82:1
  // Чернила тёмной схемы — «к фону / к surfaceAlt» (самая светлая поверхность).
  // primaryInk отделён от заливки: #9B7CFF на surfaceAlt давал 4.39.
  primaryInk: '#A68AFF', // 6.67 / 5.03
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
    workshop: '#8255D4', // 4.57:1
    kyrgyz: '#AC4F6E', // 4.68:1; к dark error 1.85, к dark secondary 1.92
  },
  onRegion: '#FFF3E3',
  // Осветлены до ≥4.5 на surfaceAlt: прежние #0E8FBF / #2FA24E / #916AD9 давали там
  // 3.72 / 4.18 / 3.44. «Мастерская» сдвинута к красному (264°), чтобы не слиться с
  // primaryInk (254°); различие с действием по-прежнему держит форма.
  regionsInk: {
    numbers: '#F2B705', // к фону 10.01, surfaceAlt 7.54
    words: '#11A2D8', // 6.22 / 4.69
    nature: '#33AD54', // 6.28 / 4.73
    workshop: '#B08AE6', // 6.61 / 4.98
    kyrgyz: '#EB6E98', // 6.25 / 4.71
  },
};

/** Спокойный режим: насыщенность акцентов вниз на 40%, значения пересчитаны. */
const lightCalmColors: ColorTokens = {
  ...lightColors,
  // Чернила — «к фону / к surfaceSunken», как в светлой схеме.
  primary: '#6851A7', // 5.77:1
  primaryInk: '#6851A7', // 5.77 / 4.63
  secondary: '#B45443',
  secondaryInk: '#984637', // 5.87 / 4.71; был #B25342 — 3.66 на surfaceSunken
  accent: '#D5B258', // заливка с контуром
  accentInk: '#725C30', // 5.83 / 4.68; был #7A6234 — 4.25
  success: '#296E54', // 5.56:1, onSuccess 6.08
  successInk: '#276A51', // 5.87 / 4.71; отделён от заливки — #296E54 давал 4.46
  error: '#A34141', // 5.66 / 4.54
  focusRing: '#6851A7',
  regions: {
    numbers: '#C39F34', // с onRegion: 6.64:1
    words: '#378EAF', // 4.50:1
    nature: '#4B955F', // 4.59:1
    workshop: '#9C86C6', // 5.29:1
    kyrgyz: '#CA819A', // 5.67:1; насыщенность 68% → 41%; к error 2.10, к secondary 1.66
  },
  regionsInk: {
    numbers: '#715D1D', // 5.84 / 4.69
    words: '#26667E', // 5.84 / 4.69
    nature: '#356A41', // 5.83 / 4.68
    workshop: '#6B529A', // 5.82 / 4.67
    kyrgyz: '#815161', // 5.84 / 4.69
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
    workshop: '#7D60B4', // 4.56:1
    kyrgyz: '#875466', // 5.50:1; к error 2.33, к secondary 2.29
  },
  // Раньше calm-тёмная схема наследовала насыщенные чернила обычной (А25): спокойный
  // режим гасил заливки, а текст региона оставался кричащим. Насыщенность −40…45%,
  // контраст «к фону / к surfaceAlt» не ниже 4.78.
  regionsInk: {
    numbers: '#C9A94F', // 8.03 / 6.05 — охра вместо чистого жёлтого
    words: '#52A2C4', // 6.35 / 4.78
    nature: '#62AD76', // 6.72 / 5.06
    workshop: '#B198D0', // 7.17 / 5.40; от calm-primary #A996E5 отведён тоном (267° / 254°)
    kyrgyz: '#D48DA5', // 7.06 / 5.32
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
