/**
 * Реестр векторных ассетов.
 *
 * Карта статическая, потому что react-native-svg-transformer превращает файл в
 * компонент на этапе сборки: `require` с вычисляемым путём Metro не разрешит.
 * Значит каждый ассет обязан быть перечислен явно — и тест `registry.test.ts`
 * следит, чтобы в папках не завелось файла, которого здесь нет.
 */
import type * as React from 'react';
import type { SvgProps } from 'react-native-svg';

import type { RegionId } from '../design/tokens';

import TaliCheer from '../../assets/images/tali/tali-cheer.svg';
import TaliFound from '../../assets/images/tali/tali-found.svg';
import TaliHello from '../../assets/images/tali/tali-hello.svg';
import TaliIdle from '../../assets/images/tali/tali-idle.svg';
import TaliPoint from '../../assets/images/tali/tali-point.svg';
import TaliPuzzled from '../../assets/images/tali/tali-puzzled.svg';
import TaliWrite from '../../assets/images/tali/tali-write.svg';

import RegionWorkshop from '../../assets/images/regions/region-workshop.svg';
import RegionNature from '../../assets/images/regions/region-nature.svg';
import RegionNumbers from '../../assets/images/regions/region-numbers.svg';
import RegionWords from '../../assets/images/regions/region-words.svg';

// Имена горизонтов и ориентиров намеренно не начинаются с `Region`: тест панорам
// отбирает строки карты по префиксу импорта.
import HorizonNumbers from '../../assets/images/regions/horizon-numbers.svg';
import LandmarkNumbers from '../../assets/images/regions/landmark-numbers.svg';

import UiArrow from '../../assets/icons/ui-arrow.svg';
import UiBook from '../../assets/icons/ui-book.svg';
import UiBulb from '../../assets/icons/ui-bulb.svg';
import UiCheck from '../../assets/icons/ui-check.svg';
import UiLock from '../../assets/icons/ui-lock.svg';
import UiMap from '../../assets/icons/ui-map.svg';
import UiPin from '../../assets/icons/ui-pin.svg';
import UiRegionNumbers from '../../assets/icons/ui-region-numbers.svg';
import UiReview from '../../assets/icons/ui-review.svg';
import UiShapeCircle from '../../assets/icons/ui-shape-circle.svg';
import UiShapeDiamond from '../../assets/icons/ui-shape-diamond.svg';
import UiShapeSquare from '../../assets/icons/ui-shape-square.svg';
import UiShapeTriangle from '../../assets/icons/ui-shape-triangle.svg';
import UiSliders from '../../assets/icons/ui-sliders.svg';
import UiSocket from '../../assets/icons/ui-socket.svg';
import UiSound from '../../assets/icons/ui-sound.svg';
import UiSoundOn from '../../assets/icons/ui-sound-on.svg';
import UiStampOpen from '../../assets/icons/ui-stamp-open.svg';
import UiTriangle from '../../assets/icons/ui-triangle.svg';
import UiWaves from '../../assets/icons/ui-waves.svg';
import UiX from '../../assets/icons/ui-x.svg';

type Svg = React.FC<SvgProps>;

/**
 * Семь поз. Анимация Tali — переключение между ними, а не риг. `idle` — спокоен,
 * ждёт ребёнка: в ней экран урока проводит больше всего времени (SCREENS.md, 5).
 */
export const TALI_POSES = {
  idle: TaliIdle,
  hello: TaliHello,
  found: TaliFound,
  point: TaliPoint,
  cheer: TaliCheer,
  puzzled: TaliPuzzled,
  write: TaliWrite,
} satisfies Record<string, Svg>;

export type TaliPose = keyof typeof TALI_POSES;

/**
 * Сторона квадратного viewBox каждой позы — для кропа (поза рисуется в кадре с
 * полями, и код вырезает нужную область в единицах viewBox). Файлы разного
 * размера: `hello` отрисован на сетке 2048, остальные — 1024. Тест сверяет
 * значения с атрибутом `viewBox` файлов.
 */
export const TALI_VIEWBOX: Record<TaliPose, number> = {
  idle: 1024,
  hello: 2048,
  found: 1024,
  point: 1024,
  cheer: 1024,
  puzzled: 1024,
  write: 1024,
};

/**
 * Панорамы регионов. Ключи — `RegionId`, то есть id региона из схемы курса
 * (`types/task.ts`); `satisfies` не даст забыть регион. Своего типа региона у реестра
 * больше нет (аудит 2026-10-06, А25).
 *
 * `kyrgyz: null` — заготовка: панорамы ещё нет (А17, ТЗ — шаг 6). Экран карты рисует
 * на её месте плоскую заливку `regions.kyrgyz` с подписью региона. Когда файл появится —
 * импорт `RegionKyrgyz`, строка `kyrgyz: RegionKyrgyz,` и снять `PANORAMA_PENDING`
 * в `__tests__/registry.test.ts`.
 */
export const REGION_PANORAMAS = {
  numbers: RegionNumbers,
  words: RegionWords,
  nature: RegionNature,
  workshop: RegionWorkshop,
  kyrgyz: null,
} satisfies Record<RegionId, Svg | null>;

/**
 * Контур горизонта для тёмной карты (ASSETS.md, «Контур горизонта и ориентир»):
 * один открытый путь во viewBox панорамы, без заливки; цвет и толщину штриха
 * (`colors.outline`, `mapLayout.horizonStroke`) задаёт код. `null` — горизонт ещё
 * не нарисован; тёмная карта региона тогда остаётся сплошной заливкой.
 */
export const REGION_HORIZONS = {
  numbers: HorizonNumbers,
  words: null,
  nature: null,
  workshop: null,
  kyrgyz: null,
} satisfies Record<RegionId, Svg | null>;

/**
 * Ориентир региона для тёмной карты: знак 64×64 одним цветом (`currentColor`),
 * тот же силуэт, что у иконки `ICONS.regionNumbers` и т. п. Подложку под него
 * кладёт код отдельной фигурой.
 */
export const REGION_LANDMARKS = {
  numbers: LandmarkNumbers,
  words: null,
  nature: null,
  workshop: null,
  kyrgyz: null,
} satisfies Record<RegionId, Svg | null>;

export const ICONS = {
  check: UiCheck,
  x: UiX,
  lock: UiLock,
  sound: UiSound,
  soundOn: UiSoundOn,
  waves: UiWaves,
  map: UiMap,
  bulb: UiBulb,
  arrow: UiArrow,
  book: UiBook,
  sliders: UiSliders,
  triangle: UiTriangle,
  pin: UiPin,
  socket: UiSocket,
  shapeCircle: UiShapeCircle,
  shapeSquare: UiShapeSquare,
  shapeTriangle: UiShapeTriangle,
  shapeDiamond: UiShapeDiamond,
  stampOpen: UiStampOpen,
  regionNumbers: UiRegionNumbers,
  review: UiReview,
} satisfies Record<string, Svg>;

export type IconName = keyof typeof ICONS;

/** Формы пар и групп в порядке, в котором их раздаёт экран `match` / `group`. */
export const PAIR_SHAPES = [
  ICONS.shapeCircle,
  ICONS.shapeSquare,
  ICONS.shapeTriangle,
  ICONS.shapeDiamond,
] as const;
