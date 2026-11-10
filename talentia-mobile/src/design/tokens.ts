/**
 * Дизайн-система Talentia — направление B «Живая гуашь».
 *
 * Единственный источник токенов (старой `src/theme/` в коде больше нет).
 * Решения и обоснования — в REBUILD.md в корне репозитория; экран урока — SCREENS.md,
 * промпты для макетов — DESIGN_PROMPTS.md.
 *
 * Все контрастные коэффициенты в комментариях посчитаны по WCAG 2.1
 * (`contrast.ts`) и проверены тестами; менять цвет без пересчёта нельзя.
 */
import type { AgeBand, Region } from '../types/task';
import { NUNITO_LINE_RATIO } from './glyphMetrics';

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
  onSecondary: string;

  /** Награда. Сам по себе даёт 1.45:1 к фону — ВСЕГДА только с контуром. */
  accent: string;
  onAccent: string;

  /** Заливка «верно». */
  success: string;
  onSuccess: string;

  /** Ошибка. Служит и заливкой (с `onError`), и текстом — поэтому тоже чернила. */
  error: string;
  onError: string;

  /**
   * Подложка под картинкой и под фигурами счёта. Контур предметов всегда `#2A1A12`, поэтому
   * в тёмной схеме подложка светлая (`#EDE7DC`, как плита стимула ABA): иначе контур на
   * `surface` исчезает (1.1:1). Контур предмета на подложке — 16.73 (светлая) / 13.60 (тёмная).
   * Calm подложку не меняет.
   */
  picturePlate: string;

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
export type RadiiTokens = Record<'sm' | 'md' | 'lg' | 'pill', number>;
export type StrokeTokens = Record<'hairline' | 'base' | 'bold', number>;
export type TouchTokens = Record<'min' | 'comfortable' | 'primary' | 'gap', number>;
export type MotionTokens = Record<'instant' | 'press' | 'quick' | 'base' | 'slow' | 'celebrate', number>;
export type ElevationTokens = Record<'flat' | 'raised', ElevationSpec>;

export type AppTheme = {
  scheme: Scheme;
  calmMode: boolean;
  focusMode: boolean;
  /**
   * Без движения: calm ребёнка **или** системное «уменьшить движение» (аудит 2026-11-09, Ж9). Анимации экранов
   * смотрят сюда, а не на `calmMode`: иначе ребёнок с вестибулярной чувствительностью без calm получал пульс,
   * перелёты плиток и покачивания.
   */
  still: boolean;
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

/**
 * Чернила рисунка — контур предметов, фигур счёта, корзинки, Tali, заголовка карты и плиты стимула ABA. От схемы не
 * зависит: рисунок одинаков днём и вечером (поэтому вне `ColorTokens`). Тот же hex у роли `text` / `outline` светлой
 * схемы — это совпадение значения, а не одна роль: UI-роли ссылаются на палитру, рисунок — сюда. Сборка svg подменяет
 * его на `stroke` (`.svgrrc.js`, литерал там же). Контрольный аудит 2026-11-09, п. 34 (`design-lead`, этап F).
 */
export const illustrationInk = '#2A1A12';

/** Заливки фигур счёта (`CountableShape`): рисунок, обе схемы одинаково; контур — `illustrationInk`. */
export const countShapeFill = { stone: '#B9A48A', berry: '#D93A1E', leaf: '#3FC08A', dot: illustrationInk, highlight: '#FFFFFF' } as const;

export const radii: RadiiTokens = {
  sm: 12,
  md: 20,
  lg: 28,
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
};

/** Подушка тоньше в спокойном режиме. */
export const elevationCalm: ElevationTokens = {
  flat: { offsetY: 0 },
  raised: { offsetY: 2 },
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

/* ───────────────────── отклик на касание (решение №69) ───────────────────── */

/**
 * Сжатие плоского нажимаемого за `motion.press`: Tali и узлы карты — 0.96, широкие пузырь и
 * стимул — 0.98 (у них тот же ход края). Ключа `calm` нет намеренно: спокойный режим
 * амплитуду не ослабляет — ослабленный отклик ребёнок не замечает и тапает снова.
 */
export const pressScale = { tali: 0.96, mapNode: 0.96, wide: 0.98 } as const;

/**
 * Гаптика на каждом касании: по умолчанию её нет ни в одном режиме. Calm создан снижать
 * сенсорную нагрузку и вибрацию не добавляет (решение владельца 2026-10-18, вердикт UX);
 * родитель включает её сам отдельной настройкой — тогда `light` (`expo-haptics`,
 * `ImpactFeedbackStyle.Light`).
 */
export const pressHaptic = { parentEnabled: 'light', default: 'none' } as const;

/**
 * Отклик на касание. Calm и reduce motion дают ту же амплитуду и длительность, что обычный
 * режим; гаптика зависит только от настройки родителя, не от режима.
 */
export function pressFeedback({ hapticsEnabled = false }: { calmMode?: boolean; hapticsEnabled?: boolean } = {}) {
  return {
    scale: pressScale,
    durationMs: motion.press,
    haptic: hapticsEnabled ? pressHaptic.parentEnabled : pressHaptic.default,
  };
}

/**
 * Повторный тап по уже **выбранной** плитке (раунд 5, В1; SCREENS.md 3.1, 3.3–3.5, 3.8). Выбранная
 * плитка уже вдавлена — подушки, которую можно «съесть», нет, а сжатие `pressScale.wide` 0.98 на плитке
 * 104 даёт ход края ≈ 1 pt: ребёнок отклика не видит и тапает снова. Поэтому:
 * - сжатие **0.94** (ход края ≈ 3.1 pt на 104, 3.4 на 112) — от касания **вниз**, не позже 100 мс, и
 *   держится **до отпускания** (палец лежит на плитке, отклик должен быть виден вокруг пальца всё
 *   касание); возврат к 1 за `motion.press` 90 мс после отпускания;
 * - у **плитки с кучкой** (сторона `match`, предмет `order`, кучка-вариант `choose`) сжимается только
 *   **рамка** (контур 6 «выбрано» и заливка плитки), поле фигур 80×80 стоит неподвижно — ребёнок
 *   пересчитывает фигуры касаниями, и прыгающие фигуры сбивали бы счёт; **без звука**;
 * - у обычной плитки сжимается плитка целиком, звук элемента — как раньше (у немой карточки — нейтральный
 *   звук выбора, №88);
 * - состояние не меняется (единое правило Д4), не пишется, не попытка (№35).
 * Calm и reduce motion — та же амплитуда (ослабленный отклик не замечают); в reduce motion — без
 * перехода: сразу 0.94 на касании, сразу 1 после отпускания. Вибрация — только по настройке родителя.
 */
export const selectedRepeatPress = {
  scale: 0.94,
  trigger: 'touch_down',
  feedbackMs: 100,
  heldUntil: 'touch_up',
  releaseMs: motion.press,
  pileTile: { scales: 'frame', figureFieldStatic: true, sound: false },
  plainTile: { scales: 'tile', sound: 'element' },
  records: false,
  haptic: 'parentSetting',
} as const;

/** Ход края плитки стороной `size` pt при `selectedRepeatPress`, pt. */
export function selectedRepeatTravel(size: number): number {
  return (size * (1 - selectedRepeatPress.scale)) / 2;
}

/** Время на экране урока, мс (SCREENS.md, раздел 8). */
export const lessonTiming = {
  /** Ошибка: выбранное остаётся с крестом, цели заблокированы. */
  errorHold: 600,
  /** «Дальше» недоступна после «верно». */
  nextUnlock: 900,
  /** Шаг разобранного примера: «Дальше» занята, пока реплика не прозвучала (разбор 2026-10-31, вопрос 61); с озвучкой — длительность файла. */
  modelStepMin: 1400,
  /** Защита от двойного тапа: после «Дальше» повторные касания игнорируются. */
  nextGuard: 300,
  /** 5–6: собрано, нет нажатия — Tali указывает на кнопку. */
  nudgeAfter: 5000,
  /** `point`: тапов мимо зон до повтора вопроса. */
  missesBeforeRepeat: 3,
} as const;

/** Текст, который подбирает вид под фиксированный слот по замеру высоты (вопрос, заголовок). */
export const textFit = {
  /** Запас к слоту, pt: две строки вопроса при ×1.2 дают ровно 72, округление до пикселя их не бракует. */
  tolerance: 1,
  /** До замера текст прозрачен; дольше ждать нельзя, даже если замер не пришёл, мс. */
  revealMax: 100,
} as const;

/**
 * Потолок системного шрифта на экране урока (I-11, раунд 3). Раньше `maxFontSizeMultiplier` был
 * задан только в ABA (`abaInstruction`, `abaAdultPanel`) и у знака в карточке-символе; на уроке
 * крупный системный шрифт выталкивал вопрос из слота 72 и реплику из пузыря 80. Слоты фиксированы
 * (экран не прокручивается), поэтому множитель — не пожелание, а часть раскладки.
 * - `prompt`: Nunito 700 22/30, 2 строки × 30 × 1.2 = 72 — ровно слот вопроса (как `abaInstruction`).
 *   Не вошло в две строки — сначала 22/30 при множителе 1 (`promptFallback`), если системный шрифт
 *   крупнее обычного, затем запасной вид 18/24 в 3 строки = 72: только при множителе 1, иначе
 *   3 × 24 × 1.2 = 86 > 72. Ступени выбирает `Prompt` в `LessonChrome.tsx`.
 * - `bubble`: слот 80, вертикальное поле пузыря `bubblePadY` 6 → внутри 68; 18/26 × 2 × 1.1 = 57.2 и
 *   запасной 16/20 × 3 × 1.1 = 66 — оба помещаются.
 * - `action`: подпись кнопки действия 88 — одна строка, при нехватке ширины ужимается.
 * - `fixed`: подписи на плитках, цифры, знаки, клавиши, столбик — геометрия задана пикселями, и размер
 *   знака не должен подсказывать ответ; системный шрифт здесь не масштабируется, смысл несёт озвучка.
 */
export const lessonFontCaps = { prompt: 1.2, promptFallback: 1, bubble: 1.1, action: 1.2, fixed: 1 } as const;

/** Вертикальное поле внутри пузыря реплики (слот 80 → 68 под текст). */
export const bubblePadY = 6;

/* ───────────────────── счёт и цифры на 5–6 (SCREENS.md 3.8) ───────────────────── */

export const countSizes = {
  /** Фигура в стимуле счёта; шаг 48. */
  figureStimulus: 40,
  stimulusGap: 8,
  /** Шаг по горизонтали в ряду не меньше. */
  stepMin: 44,
  /** Цифра-подпись под кучкой. */
  numeralPlate: 64,
  numeralDigit: 40,
  /** Кучка в плитке 104 (Р15): поле 80×80 по центру, фигура ≥ 24, шаг центров ≥ 28. */
  tileField: 80,
  tileFigure: 24,
  tileStep: 28,
  tileMaxPerRow: 3,
  /** Больше — только в стимуле. */
  tileMaxFigures: 5,
} as const;

/** Карточка-число (и «немая» карточка символа): поле цифры без внутреннего контура. */
export const numeralOption = { plate: 88, digit: 64 } as const;

/**
 * Кегль знака в карточке-символе (Nunito 800) по числу символов; один кегль на все карточки
 * задания — по самому длинному знаку (размер знака не подсказывает ответ). Больше 4 — не карточка.
 */
export const symbolGlyph = { 1: 64, 2: 48, 3: 40, 4: 32 } as const;

/**
 * Знак в карточке-символе не растёт с системным шрифтом: поле 88 рассчитано под кегль выше,
 * а размер знака не должен подсказывать ответ. Значение для `maxFontSizeMultiplier`.
 */
export const symbolGlyphMaxFontMultiplier = 1;

/**
 * Карточка-символ для цифры, буквы и слога (`design-lead`, этап D2 по аудиту 2026-11-09). Кегль — меньшее из ступени
 * `symbolGlyph` по числу знаков и того, что входит по ширине: ширины Nunito 800 из TTF (`glyphMetrics.ts`), расчёт —
 * `glyphFit.ts`. Поле под знак — плитка минус контур «выбрано» `stroke.bold` и `inset` с двух сторон. Высота строки —
 * натуральная высота шрифта: при 1.15 кегля обрезались бы Й, Ё и хвост Ң. Кегль меньше `minSize` на самом узком
 * экране (`narrowContentW` — 320 pt без полей 2 × 16) — ошибка корпуса (гард `glyphFit`), а не уменьшение на ходу.
 */
export const glyphCard = { inset: 4, minSize: 32, lineHeightRatio: NUNITO_LINE_RATIO, narrowContentW: 288 } as const;

/**
 * Разделитель разрядов в числах ответа из 5+ цифр (9–10 лет, `build`, до 7 цифр): тонкий
 * неразрывный пробел U+202F каждые три знака справа, «12 345 678»; у числа до 4 цифр
 * разделителя нет (1234, а не «1 234»). Ширина разделителя — 8 pt при кегле 28: поле 7 цифр
 * 7 × 17.4 + 2 × 8 ≈ 138 ≤ W − 16 (327 на SE). Разделитель — только отображение: ввод,
 * сравнение и озвучка идут по цифрам без него.
 */
export const digitGroup = { separator: ' ', size: 3, minDigits: 5, gap: 8 } as const;

/** Число цифрами → строка для показа с разделителем разрядов (`digitGroup`). */
export function groupDigits(digits: string): string {
  if (!/^\d+$/.test(digits) || digits.length < digitGroup.minDigits) return digits;
  return digits.replace(/\B(?=(\d{3})+$)/g, digitGroup.separator);
}

/**
 * Метка «сосчитано» (решение №83, Р11): точка 12 + кольцо 2 в центре фигуры. Цвета
 * **фиксированы в обеих схемах** — это слой иллюстрации, фигуры не перекрашиваются:
 * точка `#2A1A12`, кольцо `#FFFFFF` (16.73:1 между собой — видна на любой фигуре).
 */
export const countMark = {
  dot: 12,
  ring: 2,
  dotColor: illustrationInk,
  ringColor: '#FFFFFF',
  /**
   * Касание привязывается к ближайшей фигуре в этом радиусе. Шаг фигур ≥ 44, радиусы соседних
   * перекрываются (32 > 22): единственное правило — ближайшая по расстоянию до центра
   * (`snapRule`), без порядка обхода и без «первой найденной». Дальше радиуса — касание мимо.
   */
  snapRadius: 32,
  snapRule: 'nearest',
  /**
   * Отклик метки — от касания **вниз**, не от отпускания, и не позже этого (V3, I-2): позже
   * ребёнок считает, что касание не засчитано, и тапает снова.
   */
  feedbackMs: 100,
  feedbackTrigger: 'touch_down',
  /**
   * Повторное касание отмеченной фигуры: метку не снимает и состояния не меняет; белое кольцо метки
   * растёт 2 → 6 (метка 16 → 24 pt) и держится **до отпускания пальца + `tailMs` 600 мс**, затем
   * возвращается к 2 за `motion.press` (раунд 4, UX): метка лежит под подушечкой пальца, и пока палец
   * на фигуре, отклика не видно — его видно после отпускания; 600 мс (было 300) нужно, чтобы ребёнок 5–6
   * лет его заметил. Без звука. Форма — **другая, чем у промаха**: сплошное белое кольцо вокруг точки
   * в центре фигуры против пунктирного кольца 64 в точке касания (`missRing`).
   * Вибрация — **только по настройке родителя** (№112, `pressHaptic`): `haptic: 'parentSetting'` значит
   * `pressFeedback({ hapticsEnabled }).haptic` — по умолчанию `none` в любом режиме, включая calm;
   * отклик обязан быть заметен без неё. Reduce motion: 2 → 6 и назад без анимации, удержание то же.
   * **Внешний контур на пике** (раунд 5, В2): белое кольцо 6 на белой фигуре даёт 1.0:1, на жёлтой
   * `#FFC42E` — 1.59:1, и рост кольца не виден. Пока кольцо выросло (от касания до конца `tailMs`),
   * его обводит снаружи контур `peakOutline` 2 pt `#2A1A12`: метка на пике 12 + 2 × 6 + 2 × 2 = **28**
   * ≤ фигура стимула 40. Двухцветный край виден на любой фигуре: для любого фона хотя бы одна из
   * пар «белый / фон» и «#2A1A12 / фон» даёт ≥ √16.73 ≈ 4.09 (на белой — 16.73, на жёлтой — 10.5).
   * В покое (кольцо 2) контура нет — метка та же, что в решении №83. Переход 2 → 6 и назад мгновенный во всех
   * режимах (`durationMs` описывает допустимую анимацию, в `Pile` она не нужна: рост виден после отпускания).
   */
  repeatRing: {
    from: 2,
    to: 6,
    durationMs: motion.press,
    shownUntil: 'touch_up',
    /** 600, не 300: кольцо 28 целиком под пальцем, видно только после отпускания — ребёнку 5–6 нужно время перевести взгляд (UX по диффу B). */
    tailMs: 600,
    shape: 'mark_ring_solid',
    sound: false,
    haptic: 'parentSetting',
    peakOutline: { width: 2, color: illustrationInk },
  },
  /**
   * Касание мимо (дальше `snapRadius` от любой фигуры) — **знак промаха, один для счёта и `point`**
   * (раунд 4; ограничение `child-ux-specialist`): **пунктирное кольцо** диаметром 64, контур 3, штрих 8 /
   * просвет 6, в точке касания, без звука и записи. Пунктир в системе значит «здесь пусто» (заглушка,
   * тень, заплатка) — и касание пришлось на пустое место. Сплошное кольцо 64 совпадало по форме с
   * «выбрано» (двойное кольцо `point`), а лучи «всплеска» у 5–6 читаются как «ура».
   * Диаметр 64 (V-8): 24 лежало целиком под подушечкой пальца; 64 выходит за палец. Держится до
   * отпускания + `tailMs`. Кольцо может заходить на соседние фигуры — это отклик, а не метка.
   * Цвет — `textMuted` **светлой схемы** `#6E564A`, зафиксированный в обеих схемах, как цвета метки:
   * знак лежит на слое иллюстрации (стимул счёта на `picturePlate`, сцена `point`), который не
   * перекрашивается; тёмный `textMuted` `#AD8F7E` на `picturePlate` `#EDE7DC` дал бы ≈ 2.4:1. На
   * `picturePlate` — ≈ 6.8 (светлая) / ≈ 5.5 (тёмная). Calm и focus — вид тот же (движения нет).
   * **Ореол** (раунд 4, второй цикл UX): под пунктиром — сплошное кольцо `#FFFFFF` шириной
   * `stroke + 2 × haloPad` = 7 (по 2 pt с каждой стороны штриха). На полноцветной сцене `point` штрих
   * `#6E564A` может лечь на тёмный участок; белая полоса держит его (6.8:1 к штриху) на любом фоне и
   * отличает знак от пунктира заплатки и тени, у которых ореола нет.
   * Держится до отпускания + 300 мс, как `repeatRing`: под пальцем знак не виден, 90 мс после
   * отпускания ребёнок не успевал его заметить.
   * Поля роли цвета нет (раунд 5, М3): прежнее `colorRole: 'textMuted'` читалось как «берётся из темы»,
   * а цвет зафиксирован — это значение светлой схемы, а не роль.
   * **Обрезка** (раунд 5, В5): знак живёт только на слое иллюстрации — в счёте внутри подложки
   * `picturePlate` карточки стимула, в `point` внутри рамки сцены (`clip`); часть кольца за краем
   * обрезается. У края тёмной карточки белый ореол без обрезки читался сплошным белым кругом. Касание
   * **вне** подложки / рамки ничего не рисует и не считается касанием мимо: не попытка, не идёт в
   * счётчик `lessonTiming.missesBeforeRepeat`. Метит **только первый палец** (`pointers`) — и в
   * счёте, и в `point`: второй палец при мультитаче не рисует знак и не выбирает зону.
   */
  missRing: {
    size: 64,
    stroke: 3,
    shape: 'dashed_ring',
    dash: 8,
    gap: 6,
    color: '#6E564A',
    halo: { color: '#FFFFFF', pad: 2, solid: true },
    shownUntil: 'touch_up',
    tailMs: 300,
    sound: false,
    records: false,
    clip: { count: 'stimulus_plate', point: 'scene_frame' } as Readonly<Record<'count' | 'point', MissClip>>,
    outsideClip: 'nothing',
    pointers: 'first_only',
  },
} as const;

/** Где обрезается знак промаха: подложка карточки стимула счёта или рамка сцены `point`. */
export type MissClip = 'stimulus_plate' | 'scene_frame';

/**
 * Формат `point` (SCREENS.md 3.2). Знак тапа мимо зон — тот же, что `countMark.missRing`: пунктирное
 * кольцо 64, контур 3, штрих 8 / просвет 6, `#6E564A` с белым ореолом 7, до отпускания + 300 мс, без звука.
 * Для 5–6 лет зона нажатия вместе с `hitSlop` не меньше `touch.min` по обеим сторонам, зазор между
 * зонами по краю не меньше `touch.gap`; предмет меньше — расширяется невидимая зона, рисунок не трогаем.
 * Знак обрезается рамкой сцены (`missRing.clip.point`), вне рамки касание ничего не рисует и в счётчик
 * трёх промахов не идёт; зону выбирает и знак ставит только первый палец (раунд 5, В5).
 * **Счёт и `point` в одном задании не совмещаются** (раунд 5): у счёта касание фигуры ставит метку, у
 * `point` касание предмета выбирает зону — на одной картинке одно касание значило бы два разных действия.
 */
export const pointMiss = countMark.missRing;
export const pointZone = {
  band: '5-6',
  hitMin: touch.min,
  edgeGapMin: touch.gap,
  expandHiddenZone: true,
  pointers: 'first_only',
  withCounting: false,
} as const;

/**
 * Правила мелочей раунда UX (только данные для тестов и верстки):
 * - текстовые ответы 9–10 лет не обрезаются, допускают перенос (`lessonFontCaps.fixed` их не касается);
 * - «Помочь Tali» отстоит от нижнего края на safe area снизу (жест «домой») + `extra`;
 * - в focus на карте кнопка детского листа («ползунки») остаётся 60×60;
 * - включение calm/focus озвучивается голосом (смысл не только на экране);
 * - сумка Tali не различает позы и не нажимается (в тёмной она 2.99–3.96:1 — аксессуар, не сигнал).
 */
export const lessonTextAnswer = { band: '9-10', truncate: false, wrap: true } as const;
export const helpTaliButton = { bottomInset: 'safeAreaBottom', extra: 16 } as const;
/**
 * Правая кнопка полосы карты (раунд 5, В3; было `mapSpeaker`). Она открывает детский лист «Звук и
 * спокойствие», а не повторяет голос, поэтому иконка — «ползунки» `ui-sliders`, не динамик: динамик во
 * всём приложении значит «повтори» (урок, завязка, атлас), и тап по нему, открывающий лист, ребёнок
 * читал как сломанный повтор. Повтор голосом на карте — тап по Tali (`mapTaliTap`).
 */
export const mapSettingsButton = { size: 60, keptInFocus: true, icon: 'sliders', opens: 'child_sheet' } as const;
/**
 * Тап по Tali на карте (раунд 5, В3): Tali называет регион и следующий шаг («Мы в Мире чисел. Дальше —
 * вот этот урок»; текст — основной поток) и указывает на следующий узел (поза `point`). Одинаково в обычном
 * виде, calm и focus — в focus Tali статичен, но тап работает так же. Это единственный повтор голосом на
 * карте; кнопки-динамика на карте нет.
 */
export const mapTaliTap = { voices: ['region_name', 'next_step'], pose: 'point', sameInFocus: true } as const;
/** Таб региона в атласе: тап голосом называет регион (и переключает ленту) — нечитающему ребёнку. */
export const atlasTabTap = { voices: 'region_name', switchesRegion: true } as const;
/**
 * Переключатель «Звук» на детском листе (раунд 5, В3; закрывает AUDIT.md №22). Иконка — «нота» `ui-note`:
 * он глушит **только музыку и звуковые эффекты**, включая звуки нажатий («тук», звук выбора). **Голос
 * Tali, вопросы и названия вариантов он не глушит** — их выключает только взрослый в своих настройках:
 * малыш, выключивший «Звук», иначе оставался без озвучки вопросов. Видимый отклик на касание обязателен
 * везде и от звука не зависит (сжатие, метки, знаки), поэтому с выключенными эффектами ни одна цель не
 * становится молчащей.
 */
export const childSoundToggle = {
  icon: 'note',
  mutes: ['music', 'effects', 'press_sounds'],
  neverMutes: ['tali_voice', 'prompts', 'option_names'],
  voiceControlledBy: 'parent_settings',
  visualFeedbackAlways: true,
} as const;
/**
 * Карта в focus (раунд 4, DESIGN_PROMPTS.md 1.2): убираются декор и дальние узлы, но не управление.
 * Прежняя редакция убирала и правую кнопку — нечитающий ребёнок оставался на карте без пути к листу и
 * без пути наружу. Остаются полоса-заголовок 64 с кнопкой атласа 60, ориентиром 32 (как в calm) и
 * кнопкой листа «ползунки» 60; Tali стоит у текущего узла статично (без перелёта и idle-движения), его
 * тап — как в обычном виде: называет регион и следующий шаг (`mapTaliTap`, раунд 5).
 */
export const mapFocus = {
  /** Замок 16 у «ползунков» — «тут взрослый», как у «+» на первом запуске (Ж8, `child-ux-specialist` по диффу B). */
  settingsLock: 16,
  band: 64,
  atlasButton: 60,
  settings: mapSettingsButton.size,
  tali: 'static_at_node',
  taliTap: mapTaliTap,
  /**
   * Раскладка полосы (второй цикл UX): атлас — у левого края, кнопка листа — у правого, как выход и
   * повтор на уроке (SCREENS.md 1.2: две цели на противоположных краях, промах по одной не попадает
   * в другую); название — между ними, по оси экрана, не нажимается как цель. Поля `edgeInset` 16,
   * зазор между любыми соседними элементами полосы ≥ `minGap` 16 (`touch.gap`).
   */
  atlasSide: 'left',
  settingsSide: 'right',
  edgeInset: 16,
  minGap: 16,
} as const;

/**
 * Название региона в полосе карты 64. Значка в полосе нет: название стоит по оси экрана между кнопками
 * (ширина — `mapTitleWidth`: 136 на 320, 176 на 360, 206 на 390; в вёрстке — `flex: 1`).
 *
 * Обычный вид — наклейка (`mapTitle.sticker`): кремовые буквы с тёмным контуром прямо на фоне карты, без
 * планки. Контур обязателен: без него кремовый на панораме даёт 1.6–3.4:1. Цвета заданы литералами и не
 * зависят от схемы: наклейка несёт контраст сама (15.3:1 буквы к контуру). Одна строка, кегль выбирает
 * `fitStickerTitle`.
 *
 * Плоская надпись — calm, focus и названия длиннее наклейки: цвет из темы, на цветной полосе:
 * - одна строка 24/32, ужатие шагом 1 до 20 (межстрочный = кегль + 8);
 * - не входит — две строки 20/26, ужатие до 18/24 (2 × 26 = 52 ≤ 64);
 * - `maxFontSizeMultiplier` 1: полоса фиксирована, название звучит по тапу на Tali (`mapTaliTap`);
 * - кегль выбирает `fitRegionTitle` детерминированно, а не `adjustsFontSizeToFit` (на Android он ведёт
 *   себя иначе); перенос только по словам; ширина оценивается по `charWidthEm` 0.68 — запас для Nunito
 *   800 на кириллице (широкие «Ж», «Ш», «Ы»), замера не было.
 */
export const mapTitle = {
  style: 'label',
  size: 24,
  lineHeight: 32,
  minOneLineSize: 20,
  oneLineLeading: 8,
  twoLineSize: 20,
  twoLineLeading: 6,
  minSize: 18,
  minLineHeight: 24,
  maxLines: 2,
  maxFontSizeMultiplier: 1,
  charWidthEm: 0.68,
  sticker: {
    fill: '#FFF3E3',
    outlineColor: illustrationInk,
    /** Контур наружу; на самом мелком кегле тоньше, чтобы сохранить долю контура к букве. */
    outline: 2,
    outlineSmall: 1.5,
    /** Контур — копии текста по кругу (`MapBand`), а не SVG: шрифт идёт обычным путём на обеих платформах. */
    outlineSteps: 12,
    tracking: 1,
    wideWidth: 206,
    wideSize: 26,
    size: 24,
    minSize: 20,
  },
} as const;

/** Сколько ширины остаётся названию между кнопками полосы на экране `screenWidth`. */
export function mapTitleWidth(screenWidth: number): number {
  return screenWidth - 2 * mapFocus.edgeInset - mapFocus.atlasButton - mapFocus.settings - 2 * mapFocus.minGap;
}

/** Сколько строк займёт текст кеглем `size` в ширине `width` при переносе по словам (оценка). */
function wrapLines(text: string, size: number, width: number): number {
  const charW = size * mapTitle.charWidthEm;
  let lines = 1;
  let line = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const w = word.length * charW;
    if (w > width) return Infinity; // слово не переносится внутри — не помещается
    const next = line === 0 ? w : line + charW + w;
    if (next <= width) line = next;
    else {
      lines += 1;
      line = w;
    }
  }
  return lines;
}

export type RegionTitleFit = { size: number; lineHeight: number };

/** Плоская надпись: одна строка, иначе две; `null` — не помещается и в 18 (правьте название). */
export function fitRegionTitle(text: string, width: number): RegionTitleFit | null {
  for (let size: number = mapTitle.size; size >= mapTitle.minOneLineSize; size -= 1) {
    if (wrapLines(text, size, width) === 1) return { size, lineHeight: size + mapTitle.oneLineLeading };
  }
  for (let size: number = mapTitle.twoLineSize; size >= mapTitle.minSize; size -= 1) {
    if (wrapLines(text, size, width) <= mapTitle.maxLines) return { size, lineHeight: size + mapTitle.twoLineLeading };
  }
  return null;
}

export type StickerTitleFit = RegionTitleFit & { outline: number };

/** Наклейка: одна строка с запасом на трекинг и контур; `null` — не входит, нужна плоская надпись. */
export function fitStickerTitle(text: string, width: number): StickerTitleFit | null {
  const { sticker } = mapTitle;
  const start = width >= sticker.wideWidth ? sticker.wideSize : sticker.size;
  for (let size: number = start; size >= sticker.minSize; size -= 1) {
    const outline = size === sticker.minSize ? sticker.outlineSmall : sticker.outline;
    const needed = text.length * size * mapTitle.charWidthEm + (text.length - 1) * sticker.tracking + 2 * outline;
    if (needed <= width) return { size, lineHeight: size + mapTitle.oneLineLeading, outline };
  }
  return null;
}

/* ───────────────────── `order`: метки мест (раунд 5, Е2) ───────────────────── */

/**
 * Метка места на полосе порядка (SCREENS.md 3.4). Прежние точки •, ••, ••• на 5–6 кодировали
 * **количество**, а тема учит соединять кучку с таким же числом точек: кучку из 3 ребёнок клал на
 * «третье» место — ошибка, вызванная самим курсом (блокер Е2). Правило:
 * - на 5–6 метка **всегда** без количества и без номера — `tick`;
 * - с 7 лет цифра `caption` в круге 24 — **только если предметы не количества**; если количества
 *   (кучки, карточки-числа, числа и цифры текстом) — `tick` на любой полосе;
 * - **засечка, не кружок** (решение `design-lead`, раунд 5): пустой кружок 24 совпадал по виду с гнездом
 *   `match` 24 («сюда можно поставить пару») и с кольцом-фишкой рамки десятка. Засечка — отрезок 12 pt
 *   `stroke.base` цветом `outline`, скруглённые концы, **свисает вниз** от линии стрелы (от высоты 12 до
 *   низа полосы 24) над центром места: «эта точка стрелы — это место». Вниз, а не поперёк линии:
 *   поперечная засечка с линией даёт «+», а отдельная палочка читается как счётная «один»;
 * - стрела и наконечник 12×12 остаются; направление несёт наконечник.
 * Пустое место у количеств — без номера (пунктир, утоплено, внутри пусто). Текстовый вариант (с 7) — то
 * же правило: у количеств номера в месте нет, вместо него вертикальная стрела в зазоре 24 между
 * колонками (линия сверху вниз, наконечник внизу, засечки вправо к центрам мест).
 */
export type OrderMarkKind = 'tick' | 'digit';

export const orderMark = {
  strip: 24,
  lineY: 12,
  arrowHead: 12,
  tailPastLast: 16,
  tick: { length: 12, stroke: 'base', color: 'outline', cap: 'round', direction: 'down_to_place' },
  digit: { circle: 24, fill: 'surface', stroke: 'base', color: 'outline', type: 'caption', from: '7' },
  /** Точки на метке больше не используются ни на одной полосе. */
  dots: false,
  /** Номер внутри пустого места — только у `digit`. */
  emptyPlaceNumber: 'digit_only',
} as const;

/**
 * Предметы `order` — количества? Выводится из данных: у предмета есть кучка (`count`) или карточка-число
 * (`numeral`). Числа и цифры, записанные **текстом** (с 7 лет, `labelKey` «12», «пятнадцать»), из схемы
 * не выводятся — для них флаг задания `numericItems` (поле добавляет основной поток в `OrderTask`, гард
 * корпуса требует его, если подпись предмета — число).
 */
export function isQuantityOrder(
  items: readonly { count?: number; numeral?: number }[],
  numericItems = false,
): boolean {
  return numericItems || items.some((i) => i.count !== undefined || i.numeral !== undefined);
}

/** Вид метки места: на 5–6 и у количеств — засечка; цифра — только с 7 лет и не у количеств. */
export function orderMarkFor(band: AgeBand, quantity: boolean): OrderMarkKind {
  return band === '5-6' || quantity ? 'tick' : 'digit';
}

/**
 * Первое место — голосом и показом (условие UX к Е2). При открытии вопроса `order` на 5–6 левое место
 * подсвечено `listeningCue` (значок «волны» 24 внутри места + заливка `surfaceAlt`, контур не меняется,
 * движения нет) **на время слов «начни отсюда»** и при каждом повторе вопроса (кнопка повтора, тап по
 * Tali). В примере Tali (поза `point`, наклон −4°) кладёт первый предмет на левое место (перелёт
 * `motion.base`), затем «ведёт по стреле»: линия стрелы утолщается до `stroke.bold` 6 от первой засечки
 * к наконечнику за `motion.slow`, один раз, и возвращается к `stroke.base`. В calm, focus и reduce
 * motion — без плавного хода: участки между засечками (и последний — до наконечника) утолщаются по
 * очереди мгновенными шагами по `calmStepMs` 120 мс; у трёх мест три шага = `motion.slow`.
 */
export const orderFirstPlaceCue = {
  band: '5-6',
  place: 'leftmost',
  cue: 'listeningCue',
  during: 'start_here_words',
  onReplay: true,
  exampleTrace: { stroke: 'bold', durationMs: motion.slow, once: true, calm: 'segment_steps', calmStepMs: 120 },
} as const;

/**
 * Тап по пустому месту `order`, когда ничего не выбрано (раунд 5, UX). Видимый отклик — **само место**
 * сжимается до 0.94 по касанию вниз (≤ 100 мс), держится до отпускания, возврат за `motion.press`; ход
 * края ≈ 3.1 pt на 104. **Во всех режимах, включая calm и reduce motion** (в reduce motion — без
 * перехода). Прежний импульс метки 1 → 1.15 → 1 убран: на засечке 12 это ≈ 1.8 pt, а в calm его не было
 * вовсе — оставался только голос, против `childSoundToggle.visualFeedbackAlways`.
 * Голос: при цифре — порядковое «первое место» …; при засечке — позиция по стреле без числительного
 * (левое `start` «здесь начало», последнее `end` «здесь конец», средние `middle` «дальше по стрелке»);
 * затем подсказка механики «Сначала выбери, что поставить» — ничего не выбрано, действия не будет.
 * Тексты — основной поток. Не попытка, не пишется (№35).
 */
export const orderEmptyPlaceTap = {
  target: 'place',
  scale: selectedRepeatPress.scale,
  trigger: 'touch_down',
  feedbackMs: 100,
  heldUntil: 'touch_up',
  releaseMs: motion.press,
  sameInCalm: true,
  markPulse: false,
  voice: { digit: 'ordinal', tick: ['start', 'middle', 'end'], then: 'choose_first_hint' },
  records: false,
} as const;
export const modeToggleCue = { voiced: true } as const;
export const taliSatchelRule = { distinguishesPose: false, pressable: false } as const;

/**
 * Подсветка «звучит сейчас» при перечислении вариантов (I-1, V5): значок «волны» 24 в правом
 * верхнем углу **внутри** карточки и заливка `surfaceAlt` на время слова. Контур не меняется
 * (прежний «контур primary + импульс» совпадал с видом «ждёт», а различие в 1 pt невидимо), движения
 * нет ни в одном режиме — вид один в обычном, calm, focus и reduce motion.
 */
export const listeningCue = {
  badge: 24,
  corner: 'top_right',
  inset: 4,
  fill: 'surfaceAlt',
  outlineChanges: false,
  animated: false,
} as const;

/**
 * Прогресс урока (SCREENS.md 1.2, V1). Пройденный сегмент — `surfaceAlt` с контуром 3, а не
 * `primary`: второй залитый фиолетовый на экране конкурировал бы с кнопкой действия. Три
 * состояния различаются высотой и толщиной контура — без цвета.
 */
export const progressSegment = {
  upcoming: { fill: 'surfaceSunken', stroke: 'hairline', height: 16 },
  current: { fill: 'surface', stroke: 'base', height: 24 },
  done: { fill: 'surfaceAlt', stroke: 'base', height: 16 },
} as const satisfies Record<string, { fill: keyof ColorTokens; stroke: keyof StrokeTokens; height: number }>;

/**
 * Цвет контура 6 «выбрано» (V4). Урок и карта — `primary`; ABA (2.3 «Выбор подкрепителя»,
 * 2.6 «Со взрослым / Сам») — `outline`: фиолетовый в ABA живёт только на экране подкрепления.
 * Атлас — `onRegion` (раунд 4): табы атласа залиты цветом региона, и `primary` на них давал
 * 1.6–2.5:1 на части заливок (фиолетовый на «Мастерской» почти исчезал); `onRegion` проходит 4.5 на
 * каждой заливке во всех четырёх палитрах, значит и порог 3 для контура. Различие «выбрано» с
 * соседними табами по-прежнему несёт форма — контур 6 и вдавленность, не цвет.
 */
export const selectedStroke = {
  lesson: 'primary',
  map: 'primary',
  atlas: 'onRegion',
  aba: 'outline',
} as const satisfies Record<string, keyof ColorTokens>;

/**
 * Цвет пунктирного контура «здесь пусто» (заглушка, тень, заплатка, штриховка заплатки; V6).
 * `border` давал на заливке заглушки 1.63:1 (светлая) и 2.88:1 (тёмная) — ниже порога 3.
 */
export const emptyOutlineColor = 'textMuted' as const satisfies keyof ColorTokens;

/* ───────────────────── карта региона (решение №89, Р9) ───────────────────── */

export const mapLayout = {
  node: 72,
  /** Расстояние между центрами узлов не меньше. */
  nodeGapMin: 88,
  trailStroke: 3,
  horizonStroke: 3,
  /** Ориентир региона на карте: ≥ 64 и на одном месте в обоих обычных видах (светлом и тёмном). */
  landmarkMin: 64,
  /**
   * Подложка ориентира (`colors.surface` + контур) не должна читаться как кнопка (У-8): ребёнок
   * тронет её, а в ответ — тишина. Два решения сразу: (1) касание ориентира даёт тот же отклик, что
   * у узла без подушки — сжатие `pressScale.mapNode` 0.96 за `motion.press`, без звука и действия,
   * в любом режиме; (2) подложка — не круг и не скруглённый квадрат (это форма узла и кнопки), а
   * «вывеска»: плоское основание и арочный верх.
   */
  landmarkTap: { scale: 0.96, durationMs: 90, sound: false, action: 'none' },
  landmarkPlate: 'arch',
  /**
   * Верхняя зона панорамы под заголовком карты — без деталей (Г7): текст шапки `#2A1A12`
   * обязан держать на ней ≥ 4.5:1. Высота зоны — высота полосы заголовка.
   */
  titleZone: 64,
} as const;

export type MapBackdrop = 'panorama' | 'flat_region' | 'sand_strip';

/**
 * Фон карты. Панорама — только светлая обычная: рисованная картинка светлая и под светлым
 * текстом шапки даёт 1.6–3.4:1, а перерисовывать её вечером нельзя (иллюстрации не
 * перекрашиваются). Тёмная обычная — сплошной `regions.<регион>` + силуэт горизонта
 * (обвод той же панорамы на той же высоте, контур `outline` `mapLayout.horizonStroke`) +
 * ориентир; текст — `onRegion` (≥ 4.5 на каждой заливке). Calm в обеих схемах — песок
 * `background`, ориентир и цветная полоса-заголовок. Тропа, узлы, «повторение» и Tali стоят на тех
 * же координатах во всех трёх видах.
 */
export function mapBackdrop({ scheme, calmMode }: { scheme: Scheme; calmMode: boolean }): MapBackdrop {
  if (calmMode) return 'sand_strip';
  return scheme === 'light' ? 'panorama' : 'flat_region';
}

/* ───────────────────────── Tali: слой иллюстрации (раунд 3, V12–V14) ───────────────────────── */

/**
 * Палитра персонажа — слой иллюстрации, как `countMark`: в обеих схемах и в calm **одна и та же**, Tali
 * не перекрашивается (ASSETS.md, шаг 2). Цвета в UI-токены не входят и ролей интерфейса не несут:
 * зелёный тела `#3FC08A` — не `success` (`#12855A`), красная сумка — не `error`.
 */
export const taliArt = {
  body: '#3FC08A',
  bodyShadow: '#2FA24E',
  belly: '#FFE6C7',
  accent: '#FFC42E',
  satchel: '#D93A1E',
  glass: '#0E8FBF',
  outline: illustrationInk,
} as const;

/**
 * Единый кроп Tali «по пояс» (раздел 5 SCREENS.md, DESIGN_PROMPTS.md, блок 0): прямоугольник в долях
 * квадратного кадра позы, слот 88×88 везде (нижняя панель урока, слой выхода, «нет перевода»,
 * подкрепление и перерыв ABA). Кадры всех семи поз — 1:1, персонаж на одном месте и в одном масштабе
 * (ASSETS.md, «Требования к набору»), голова ≈ половина кадра (`headFrameShare`), голова касается верха.
 * - `w = h = 0.88`: голова в кропе 0.5 / 0.88 ≈ 57% высоты (норма 55–60%); низ кропа обрезает ноги, пояс
 *   остаётся внутри;
 * - `x = 0.06`: поле 6% слева и справа (центр кадра); `y = 0`: верхнее поле — собственное поле кадра
 *   позы (≤ 2%), кроп от верха не отступает, иначе голова теряет 6% высоты;
 * - масштаб показа: 88 / (0.88 × кадр) — у позы 1024 это 0.0977 pt на ед. viewBox.
 * Значения стартовые, по пропорциям ТЗ: подтверждаются наложением кропа на семь готовых SVG
 * (лапа `point` и поднятые лапы `cheer` — внутри; голова при повороте на `taliIdleTap.travel` не выходит
 * за край). Не вошла поза — правится файл позы, второй кроп не заводится. У `tali-hello.svg` viewBox
 * 2048, у остальных 1024: доли от этого не зависят, но содержимое hello обязано стоять в тех же долях.
 */
export const taliCrop = { x: 0.06, y: 0, w: 0.88, h: 0.88, slot: 88, headFrameShare: 0.5 } as const;

/**
 * Нейтральный отклик Tali на тап при пустом пузыре (SCREENS.md, раздел 5): моргание и поворот головы к
 * ребёнку — `beats` шагов по `motion.quick`, ход края ≤ `travel` pt. Кивка нет (кивок = «да»). Во
 * всех режимах одинаково; гаптика — только по настройке родителя (`pressFeedback`).
 */
export const taliIdleTap = { travel: 4, beats: 2, beatMs: motion.quick } as const;

/**
 * Где Tali стоит и чем держится его силуэт в тёмной схеме (V12). Наружный контур `taliArt.outline`
 * `#2A1A12` на нейтральных тёмных поверхностях границы не несёт (1.09:1 к `background`), её несёт
 * заливка тела (7.90:1 к `background`, 6.85:1 к `surface`). На заливке региона тёмной обычной карты —
 * наоборот: заливка тела там 2.15–2.62:1, а границу несёт контур (3.27–3.38:1). Поэтому:
 * - `neutral` — `background`, `surface`: держит тело;
 * - `regionFill` — заливки `regions.*` тёмной обычной схемы: держит контур;
 * - Tali не ставится на заливки `regions.*` тёмной calm (там карта — песок `sand_strip`, Tali стоит на
 *   `background`), на заливку региона в тёмной завязке он не выходит — он внутри карточки `surface`.
 * - Сумка `satchel` на `surfaceAlt` тёмной даёт 2.99:1 — аксессуар, не силуэт, допустимо.
 */
// Правило без экспорта (потребителей и тестов нет; `design-lead`, этап F): Tali на нейтральных поверхностях, без ореола.

/* ───────────────────────── типографика ───────────────────────── */

/**
 * Один шрифт на всё приложение, Nunito (№176). Прежний Comfortaa в заголовках и вопросах читался
 * хуже: «т» похожа на m, «л» на Λ, низкий рост строчных, тонкие штрихи. Иерархию держат кегль и вес:
 * крупные заголовки 800, вопрос задания 700 — просветы в ш, щ, ж, ң остаются открытыми на двух строках.
 * Nunito покрывает cyrillic-ext (U+0460–052F), где живут ң ө ү (`fontGlyphs.test.ts`).
 * Fredoka из первого макета не подходит: в ней нет кириллицы.
 */
const FAMILY = 'Nunito';

export const typography: TypographyTokens = {
  display: { size: 34, lineHeight: 40, weight: '800', family: FAMILY },
  title: { size: 28, lineHeight: 36, weight: '800', family: FAMILY },
  subtitle: { size: 22, lineHeight: 30, weight: '700', family: FAMILY },
  body: { size: 18, lineHeight: 26, weight: '400', family: FAMILY },
  label: { size: 18, lineHeight: 24, weight: '800', family: FAMILY },
  caption: { size: 14, lineHeight: 20, weight: '700', family: FAMILY },
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

  outline: '#2A1A12',
  border: '#D4A66A', // 2.03:1 — мягкая группировка; настоящее разделение несёт outline

  primary: '#5A34C4', // 7.04:1
  primaryInk: '#5A34C4',
  onPrimary: '#FFFFFF', // на primary: 7.71:1

  secondary: '#D93A1E', // 4.19:1 — только крупное и иконки
  onSecondary: '#FFFFFF', // на secondary: 4.59:1

  accent: '#FFC42E', // 1.45:1 — только заливка с контуром
  onAccent: '#2A1A12', // на accent: 10.51:1

  success: '#12855A',
  onSuccess: '#FFFFFF', // на success: 4.64:1

  error: '#BB1E1E', // 5.78 / 4.64; был #C42020 — тот же красный на полтона глубже
  onError: '#FFFFFF', // на error: 6.33:1

  picturePlate: '#FFFFFF', // контур предмета #2A1A12 на ней 16.73:1

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

/**
 * Правило перевода «светлая → тёмная» (Р8; в DESIGN_PROMPTS.md оно записано для макетов).
 * Текст и глифы на цветных заливках (`onPrimary`, `onSecondary`, `onAccent`, `onSuccess`,
 * `onError`) в тёмной схеме — всегда `#1B1410` (= `background`), а не белый: белое на
 * тёмных заливках даёт галочку 2.13:1 и крест 2.77:1, а `#1B1410` — 8.52 и 6.56.
 * Поверх заливки региона — `onRegion` `#FFF3E3`.
 */
const darkColors: ColorTokens = {
  background: '#1B1410',
  surface: '#2A211B',
  surfaceAlt: '#372B23',
  surfaceSunken: '#221A15',

  text: '#FFF3E3', // 16.62:1
  // #997867 давал 4.54:1 к фону, но 3.93:1 на карточке — проходил только там, где
  // его не используют. #AD8F7E: 6.07 к фону, 5.26 на surface, 4.57 на surfaceAlt.
  textMuted: '#AD8F7E',

  outline: '#FFF3E3', // контур инвертируется — главный приём тёмной темы
  border: '#775F4D', // 3.06:1 (#4A3B30 давал 1.70:1 и был отвергнут)

  primary: '#9B7CFF', // 5.82:1
  // Чернила тёмной схемы — «к фону / к surfaceAlt» (самая светлая поверхность).
  // primaryInk отделён от заливки: #9B7CFF на surfaceAlt давал 4.39.
  primaryInk: '#A68AFF', // 6.67 / 5.03
  onPrimary: '#1B1410',

  secondary: '#FF7455', // 6.83:1
  onSecondary: '#1B1410',

  accent: '#FFD46B', // 12.89:1
  onAccent: '#1B1410',

  success: '#4FC694', // 8.52:1
  onSuccess: '#1B1410',

  error: '#FF6B6B', // 6.56:1
  onError: '#1B1410',

  picturePlate: '#EDE7DC', // контур предмета #2A1A12 на ней 13.60:1; плита стимула ABA того же цвета

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
  accent: '#D5B258', // заливка с контуром
  success: '#296E54', // 5.56:1, onSuccess 6.08
  error: '#A34141', // 5.66 / 4.54
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
  accent: '#E1C889', // 11.11:1
  success: '#67AE90', // 6.96:1
  error: '#E18989', // 7.05:1
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

/* ───────────── раскладка экранов среза (SCREENS.md 8; docs/design/slice-screens-2026-10-24.md) ───────────── */

/**
 * Каркас экрана урока сверху вниз (SCREENS.md 1.1): высоты слотов и зазоры между ними, pt. Экран не
 * прокручивается, поэтому каждое число — часть бюджета высоты, а не пожелание. Имена — из SCREENS.md 8
 * (`hintBand` там переименован в `bubble`).
 */
export const lessonLayout = {
  topBar: 64,
  prompt: 72,
  bubble: 80,
  actionBar: 88,
  tali: 88,
  gapTopPrompt: 8,
  gapPromptTask: 12,
  gapTaskHint: 16,
  gapHintBar: 16,
  /** `match`: желоб между рядами под линии пар. */
  matchGutter: 48,
  /** `order`: полоса-стрела над рядом мест. */
  orderArrow: 24,
  /** `order`: зазор между рядом мест и лотком. */
  trayGap: 24,
  basketTwo: 84,
  basketThree: 112,
  buildStrip: 88,
  keypadKey: 60,
  keypadField: 48,
  exitGap: 24,
} as const;

/** Фиксированная высота каркаса урока без зоны задания и safe area: 64 + 8 + 72 + 12 + 16 + 80 + 16 + 88. */
export function lessonFixedHeight(): number {
  const l = lessonLayout;
  return l.topBar + l.gapTopPrompt + l.prompt + l.gapPromptTask + l.gapTaskHint + l.bubble + l.gapHintBar + l.actionBar;
}

/** Вопрос в слоте 72: основной вид 22/30 × 2, запасной — 18/24 × 3 при множителе 1 (`lessonFontCaps`). */
export const PROMPT_MIN_SIZE = 18;
export const PROMPT_MIN_LINE_HEIGHT = 24;
export const PROMPT_MAX_LINES = 3;
/** Реплика в пузыре 80 (внутри 68): основной 18/26 × 2, запасной 16/20 × 3. */
export const HINT_MIN_SIZE = 16;
export const HINT_MIN_LINE_HEIGHT = 20;
export const HINT_MAX_LINES = 3;

/** Значки на плитках и рядом с ними (SCREENS.md 2.2), pt. */
export const badge = {
  /** Галочка / крест / треугольник «показан» над плиткой. */
  status: 32,
  /** Форма пары в углу обеих плиток `match`. */
  pairShape: 24,
  groupSymbol: 32,
  mini: 24,
  pointPin: 32,
  /** Булавка «закреплён» в левом верхнем углу. */
  pin: 24,
  /** Гнездо линии пары на краю плитки. */
  socket: 24,
  /** Вынос значка за край плитки. */
  outset: 8,
  groupSymbolInset: 4,
} as const;

/** Иконки интерфейса: один размер на кнопках и один для значков. */
export const icon = { size: 32, badge: 24 } as const;

/** Три размера Tali на экранах среза: кроп «по пояс» 88, полный рост на карте 96 и на первом запуске 120. */
export const taliSize = { crop: 88, map: 96, hero: 120 } as const;

/**
 * Карточка профиля на первом запуске: детская 160, аватар 88, место под имя 24 (и у безымянных), зазор 16.
 * «+ Добавить» — взрослая карточка (этап D, docs/design/atlas-firstrun-2026-10-31.md D3): 120, без подушки,
 * плюс и подпись `textMuted`, замок 24 в правом верхнем углу с отступом 8; в ряду с детскими — по нижнему краю.
 */
export const profileCard = {
  size: 160,
  avatar: 88,
  nameSlot: 24,
  gap: 16,
  addSize: 120,
  addBadge: 24,
  addBadgeInset: 8,
  addRowAlign: 'bottom',
} as const;

/**
 * Первый запуск на чистой установке: «Попробовать без сохранения» — единственная `primary` (ребёнок нажмёт
 * сам, цена — потеря прогресса, о ней говорит подпись) и стоит сразу под заголовком, выше карточки «+»
 * (`childActionFirst`); вход для взрослых — зона 48 с замком 24. Карточка «+» открывает PIN только вторым
 * тапом в течение `adultSecondTapMs`: первый — голос «Позови взрослого» и покачивание замка (UX этапа D).
 */
export const firstRun = {
  noSavePrimary: true,
  adultEntryHit: 48,
  adultIcon: 24,
  childActionFirst: true,
  adultCardLabelKey: 'firstRun.adultOnly',
  adultSecondTapMs: 3000,
  /**
   * Второй тап раньше этого срока не считается (контрольный аудит 2026-11-09, Ж8, `child-ux-specialist`): без голоса
   * ребёнок тапает дважды подряд и попадал в PIN. Отклик первого тапа виден: замок растёт до `lockNudge.to` и держится
   * `lockNudge.holdMs`, Tali — поза `point`. То же правило у «ползунков» карты (вопрос 102, рабочее допущение №185).
   */
  adultSecondTapMinMs: 800,
  lockNudge: { to: 32, holdMs: 600 },
} as const;

/**
 * Бюджет высоты первого запуска без прокрутки (docs/design/atlas-firstrun-2026-10-31.md D3):
 * отступ 16 · Tali 120 · 16 · заголовок 72 · 24 · кнопка 88 · 8 · подпись 20 · 24 · карточка «+» 120 ·
 * свободное ≥ 24 · вход 48 · низ max(safeBottom, 16) = 616 на SE (было 656 с карточкой 160).
 */
export function firstRunHeight(safeTop: number, safeBottom = 0): number {
  const caption = typography.caption.lineHeight;
  const title = typography.title.lineHeight * TITLE_MAX_LINES;
  return (
    safeTop + spacing.lg + taliSize.hero + spacing.lg + title + spacing.xl + touch.primary + spacing.sm + caption +
    spacing.xl + profileCard.addSize + spacing.xl + firstRun.adultEntryHit + Math.max(safeBottom, spacing.lg)
  );
}

/**
 * Корзинка для нуля (`Media.container: 'basket'`, №136) — слой иллюстрации, как `taliArt`: заливка и контур
 * фиксированы в обеих схемах (на `surfaceAlt` тёмной схемы контур фигур `#2A1A12` давал бы ≈ 1.4:1),
 * в тёмной лежит на `picturePlate`. В стимуле корзинка шире кучки на `padInStimulus` с каждой стороны.
 */
export const basketArt = { fill: '#FFE6C7', outline: illustrationInk, stroke: 'base', padInStimulus: 16 } as const;

/**
 * Страница атласа 5–6 (§4; этап D, docs/design/atlas-firstrun-2026-10-31.md D1): рамка находки 120 со стимулом
 * первого задания навыка урока (кучка с метками «сосчитано» или карточка-цифра; при `count ≥ 6` — цифра),
 * вывод с резервом 3 строк `body`, плашка 64 с печатью 48 цветом `regionsInk` региона; лента будущих
 * страниц — 3 слота 60 (≥ `touch.min`) в любом режиме и пунктирный хвост тропы до края. Печать ложится
 * после голосовой фразы: длительность неизвестна (№158, озвучка — этап 13), поэтому через `stampAfterMs`,
 * не позже `stampMaxWaitMs`; появление — сжатие 1.4 → 1 за `motion.base`, в calm / reduce motion — сразу.
 */
export const atlasPage = {
  plate: 64,
  stamp: 48,
  findingFrame: 120,
  findingLines: 3,
  futureSlot: 60,
  futureSlots: 3,
  /** Хвост тропы за слотами: линия 2 pt пунктиром `textMuted` (UX: не 3 — не цель); остаток ряда — плоская зона с голосом `atlas.pageAhead`. */
  futureTrail: { stroke: 2, color: 'textMuted', dash: 8, gap: 6, pressable: true },
  stampSound: true,
  stampAfterMs: 1400,
  stampMaxWaitMs: 3000,
  stampEnter: { from: 1.4, to: 1, calm: 'instant' },
  taliAfterStamp: 'cheer',
  /** Чем заполнить рамку: стимул первого задания навыка; стимульный размер, если входит, иначе плиточный. */
  finding: { source: 'first_task_of_skill', fit: ['stimulus', 'tile'], fallback: 'regionIcon', fallbackSize: 64, numeralFrom: 6 },
} as const;

/**
 * Бюджет высоты страницы атласа без прокрутки (D1): 16 · ряд Tali 88 · 16 · карточка · 16 · слоты 60 · 16 ·
 * «К карте» 88 · низ. Карточка: 16 + рамка 120 + 12 + вывод 3 × 26 + 12 + плашка 64 + 16 = 318. На SE — 654.
 */
export function atlasPageHeight(safeTop: number, safeBottom = 0): number {
  const card =
    spacing.lg + atlasPage.findingFrame + spacing.md + typography.body.lineHeight * atlasPage.findingLines +
    spacing.md + atlasPage.plate + spacing.lg;
  return (
    safeTop + spacing.lg + taliSize.crop + spacing.lg + card + spacing.lg + atlasPage.futureSlot + spacing.lg +
    touch.primary + Math.max(safeBottom, spacing.lg)
  );
}

/**
 * Коллекция атласа (этап D, вопрос 60; D2): полоса 64 с «К карте» 60 слева, сетка в два столбца (focus — один),
 * карточка 164×216: рамка 96 с плиточным примитивом (кучка ≤ 5 — `Pile tile`, иначе карточка-цифра), название
 * урока `label` ≤ 2 строк, плашка 32 с печатью 24 — статичной. Одна пунктирная карточка «?» после последней.
 */
/**
 * Ширина карточки коллекции под окно: не больше `atlasGrid.card.w`, но так, чтобы `columns` карточек с зазорами
 * вошли в экран за вычетом полей `pad` с двух сторон (320 pt: 2 × 136 + 16 = 288). Аудит 2026-11-09, UX п. 12.
 */
export function atlasCardWidth(windowWidth: number, columns: number, pad: number): number {
  const fit = Math.floor((windowWidth - pad * 2 - atlasGrid.gap * (columns - 1)) / columns);
  return Math.max(96, Math.min(atlasGrid.card.w, fit));
}

export const atlasGrid = {
  columns: 2,
  columnsFocus: 1,
  card: { w: 164, h: 216 },
  frame: 96,
  titleLines: 2,
  plate: 32,
  stamp: 24,
  gap: 16,
  futureCards: 1,
  emptyTali: 'idle',
  backButton: { side: 'left', icon: 'map', size: 60 },
} as const;

/**
 * Узлы карты на 5–6 в любом режиме (UX, п. 7): рисуются «повторение», пройденные, доступный и `visibleAhead`
 * замков; дальше тропа продолжается пунктиром и заканчивается знаком «?» без плиты. Десять одинаковых
 * замков подряд — десять одинаковых откликающихся целей, ребёнок «собирает» их по очереди.
 */
export const mapNodeState = { explored: 60, iconSize: 32, visibleAhead: 2 } as const;

/**
 * Лента карты: автоцентровка на доступном узле при каждом появлении экрана (без подталкивания); порог начала
 * панорамирования 12 pt — до него касание считается тапом (палец 5–6 едет на 5–10 pt); узел открывает урок по
 * отпусканию, повторы в течение `openGuardMs` игнорируются, касание во время прокрутки урок не открывает;
 * между габаритом Tali и узлом — не меньше `touch.gap`.
 */
export const mapLane = {
  centerOn: 'available',
  panThreshold: 12,
  openGuardMs: lessonTiming.nextGuard,
  taliNodeGap: touch.gap,
} as const;

/**
 * Слой подтверждения выхода (SCREENS.md 1.6): Tali `idle` 88 на отступе 48, заголовок через 16, «Выйти» и
 * «Остаться» с зазором 24. Подпись «Прогресс сохранится» показывается только при записи на устройство
 * (`account_local`): без аккаунта это неправда.
 */
export const exitLayer = { topInset: 48, taliGap: 16, buttonGap: 24, progressNote: 'hide_when_no_account' } as const;

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
  reduceMotion = false,
  density = focusMode ? 'roomy' : 'default',
}: {
  scheme: Scheme;
  calmMode: boolean;
  focusMode: boolean;
  /** Системное «уменьшить движение»; `still = calmMode || reduceMotion`. */
  reduceMotion?: boolean;
  density?: Density;
}): AppTheme {
  const colors = calmMode ? palettes[scheme].calm : palettes[scheme].normal;
  const roomy = density === 'roomy';

  return {
    scheme,
    calmMode,
    focusMode,
    still: calmMode || reduceMotion,
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
