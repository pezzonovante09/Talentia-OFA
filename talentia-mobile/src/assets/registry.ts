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
import RegionKyrgyz from '../../assets/images/regions/region-kyrgyz.svg';

// Имена горизонтов и ориентиров намеренно не начинаются с `Region`: тест панорам
// отбирает строки карты по префиксу импорта.
import HorizonNumbers from '../../assets/images/regions/horizon-numbers.svg';
import LandmarkNumbers from '../../assets/images/regions/landmark-numbers.svg';
import LandmarkWords from '../../assets/images/regions/landmark-words.svg';
import LandmarkNature from '../../assets/images/regions/landmark-nature.svg';
import LandmarkWorkshop from '../../assets/images/regions/landmark-workshop.svg';
import LandmarkKyrgyz from '../../assets/images/regions/landmark-kyrgyz.svg';

import UiArrow from '../../assets/icons/ui-arrow.svg';
import UiBackspace from '../../assets/icons/ui-backspace.svg';
import UiBook from '../../assets/icons/ui-book.svg';
import UiBulb from '../../assets/icons/ui-bulb.svg';
import UiCheck from '../../assets/icons/ui-check.svg';
import UiChevron from '../../assets/icons/ui-chevron.svg';
import UiFingerRing from '../../assets/icons/ui-finger-ring.svg';
import UiLock from '../../assets/icons/ui-lock.svg';
import UiMap from '../../assets/icons/ui-map.svg';
import UiNote from '../../assets/icons/ui-note.svg';
import UiPauseBars from '../../assets/icons/ui-pause-bars.svg';
import UiPauseBarsOutline from '../../assets/icons/ui-pause-bars-outline.svg';
import UiPin from '../../assets/icons/ui-pin.svg';
import UiRegionKyrgyz from '../../assets/icons/ui-region-kyrgyz.svg';
import UiRegionNature from '../../assets/icons/ui-region-nature.svg';
import UiRegionNumbers from '../../assets/icons/ui-region-numbers.svg';
import UiRegionWords from '../../assets/icons/ui-region-words.svg';
import UiRegionWorkshop from '../../assets/icons/ui-region-workshop.svg';
import UiReview from '../../assets/icons/ui-review.svg';
import UiShapeCircle from '../../assets/icons/ui-shape-circle.svg';
import UiShapeDiamond from '../../assets/icons/ui-shape-diamond.svg';
import UiShapeSquare from '../../assets/icons/ui-shape-square.svg';
import UiShapeTriangle from '../../assets/icons/ui-shape-triangle.svg';
import UiSleep from '../../assets/icons/ui-sleep.svg';
import UiSliders from '../../assets/icons/ui-sliders.svg';
import UiSocket from '../../assets/icons/ui-socket.svg';
import UiSound from '../../assets/icons/ui-sound.svg';
import UiSoundOn from '../../assets/icons/ui-sound-on.svg';
import UiStampOpen from '../../assets/icons/ui-stamp-open.svg';
import UiStar from '../../assets/icons/ui-star.svg';
import UiStarHelped from '../../assets/icons/ui-star-helped.svg';
import UiToken from '../../assets/icons/ui-token.svg';
import UiTriangle from '../../assets/icons/ui-triangle.svg';
import UiWaves from '../../assets/icons/ui-waves.svg';
import UiX from '../../assets/icons/ui-x.svg';
import UiRewardBubbles from '../../assets/icons/ui-reward-bubbles.svg';
import UiRewardKaleidoscope from '../../assets/icons/ui-reward-kaleidoscope.svg';
import UiRewardPinwheel from '../../assets/icons/ui-reward-pinwheel.svg';
import UiRewardMarbleRun from '../../assets/icons/ui-reward-marble-run.svg';
import UiRewardTaliDance from '../../assets/icons/ui-reward-tali-dance.svg';
import UiRewardPaintDrop from '../../assets/icons/ui-reward-paint-drop.svg';
import UiRewardSingTogether from '../../assets/icons/ui-reward-sing-together.svg';

import AbaObjApple from '../../assets/images/aba/stimuli/aba-obj-apple.svg';
import AbaObjPear from '../../assets/images/aba/stimuli/aba-obj-pear.svg';
import AbaObjCarrot from '../../assets/images/aba/stimuli/aba-obj-carrot.svg';
import AbaObjMushroom from '../../assets/images/aba/stimuli/aba-obj-mushroom.svg';
import AbaObjLeaf from '../../assets/images/aba/stimuli/aba-obj-leaf.svg';
import AbaObjCar from '../../assets/images/aba/stimuli/aba-obj-car.svg';
import AbaObjPlane from '../../assets/images/aba/stimuli/aba-obj-plane.svg';
import AbaObjBoat from '../../assets/images/aba/stimuli/aba-obj-boat.svg';
import AbaObjHouse from '../../assets/images/aba/stimuli/aba-obj-house.svg';
import AbaObjUmbrella from '../../assets/images/aba/stimuli/aba-obj-umbrella.svg';
import AbaRewardBubbles from '../../assets/images/aba/rewards/aba-reward-bubbles.svg';
import AbaRewardPinwheel from '../../assets/images/aba/rewards/aba-reward-pinwheel.svg';
import AbaRewardPaintDrop from '../../assets/images/aba/rewards/aba-reward-paint-drop.svg';
import AbaRewardPinwheelHead from '../../assets/images/aba/rewards/aba-reward-pinwheel-head.svg';
import AbaRewardMarbleTrack from '../../assets/images/aba/rewards/aba-reward-marble-track.svg';
import AbaRewardMarble from '../../assets/images/aba/rewards/aba-reward-marble.svg';
import AbaObjKey from '../../assets/images/aba/stimuli/aba-obj-key.svg';
import AbaObjSpoon from '../../assets/images/aba/stimuli/aba-obj-spoon.svg';
import AbaObjTeapot from '../../assets/images/aba/stimuli/aba-obj-teapot.svg';
import AbaObjBook from '../../assets/images/aba/stimuli/aba-obj-book.svg';
import AbaObjHat from '../../assets/images/aba/stimuli/aba-obj-hat.svg';
import AbaObjMitten from '../../assets/images/aba/stimuli/aba-obj-mitten.svg';
import AbaObjPyramid from '../../assets/images/aba/stimuli/aba-obj-pyramid.svg';
import AbaObjSock from '../../assets/images/aba/stimuli/aba-obj-sock.svg';
import AbaObjChair from '../../assets/images/aba/stimuli/aba-obj-chair.svg';
import AbaObjFlower from '../../assets/images/aba/stimuli/aba-obj-flower.svg';
import AbaObjCup from '../../assets/images/aba/stimuli/aba-obj-cup.svg';
import AbaObjTree from '../../assets/images/aba/stimuli/aba-obj-tree.svg';
import AbaObjBus from '../../assets/images/aba/stimuli/aba-obj-bus.svg';
import AbaObjBell from '../../assets/images/aba/stimuli/aba-obj-bell.svg';

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
 * Все пять — из Higgsfield, Recraft V4.1 `vector` (решение №177, 2026-11-06): `kyrgyz`, `nature`, `workshop`
 * приняты; `numbers` и `words` пока старые, их замена ждёт решения владельца (вес и место маяка).
 */
export const REGION_PANORAMAS = {
  numbers: RegionNumbers,
  words: RegionWords,
  nature: RegionNature,
  workshop: RegionWorkshop,
  kyrgyz: RegionKyrgyz,
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
  words: LandmarkWords,
  nature: LandmarkNature,
  workshop: LandmarkWorkshop,
  kyrgyz: LandmarkKyrgyz,
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
  backspace: UiBackspace,
  book: UiBook,
  chevron: UiChevron,
  fingerRing: UiFingerRing,
  note: UiNote,
  pauseBars: UiPauseBars,
  pauseBarsOutline: UiPauseBarsOutline,
  sleep: UiSleep,
  star: UiStar,
  starHelped: UiStarHelped,
  token: UiToken,
  sliders: UiSliders,
  triangle: UiTriangle,
  pin: UiPin,
  socket: UiSocket,
  shapeCircle: UiShapeCircle,
  shapeSquare: UiShapeSquare,
  shapeTriangle: UiShapeTriangle,
  shapeDiamond: UiShapeDiamond,
  stampOpen: UiStampOpen,
  regionKyrgyz: UiRegionKyrgyz,
  regionNature: UiRegionNature,
  regionNumbers: UiRegionNumbers,
  regionWords: UiRegionWords,
  regionWorkshop: UiRegionWorkshop,
  review: UiReview,
  rewardBubbles: UiRewardBubbles,
  rewardKaleidoscope: UiRewardKaleidoscope,
  rewardPinwheel: UiRewardPinwheel,
  rewardMarbleRun: UiRewardMarbleRun,
  rewardTaliDance: UiRewardTaliDance,
  rewardPaintDrop: UiRewardPaintDrop,
  rewardSingTogether: UiRewardSingTogether,
} satisfies Record<string, Svg>;

export type IconName = keyof typeof ICONS;

/** Формы пар и групп в порядке, в котором их раздаёт экран `match` / `group`. */
export const PAIR_SHAPES = [
  ICONS.shapeCircle,
  ICONS.shapeSquare,
  ICONS.shapeTriangle,
  ICONS.shapeDiamond,
] as const;

/**
 * Картинки предметов-стимулов ABA (`src/content/aba/stimuli.ts`, партия `docs/assets/aba-match-stimuli.md`, скилл
 * `asset-pipeline`). Только SVG: растр на экране пробы запрещён. `null` — файла ещё нет, экран рисует заглушку-силуэт;
 * гард `abaTargets.test.ts` сверяет ключи со стимулами. Все 24 — Higgsfield, Recraft V4.1 `vector`, цвета подогнаны к
 * палитре скриптом (решение №178, 2026-11-06), сетка 512.
 */
export const ABA_OBJECT_ART: Record<string, Svg | null> = {
  'aba-obj-apple': AbaObjApple,
  'aba-obj-pear': AbaObjPear,
  'aba-obj-carrot': AbaObjCarrot,
  'aba-obj-mushroom': AbaObjMushroom,
  'aba-obj-leaf': AbaObjLeaf,
  'aba-obj-car': AbaObjCar,
  'aba-obj-plane': AbaObjPlane,
  'aba-obj-boat': AbaObjBoat,
  'aba-obj-house': AbaObjHouse,
  'aba-obj-umbrella': AbaObjUmbrella,
  'aba-obj-key': AbaObjKey,
  'aba-obj-spoon': AbaObjSpoon,
  'aba-obj-teapot': AbaObjTeapot,
  'aba-obj-book': AbaObjBook,
  'aba-obj-hat': AbaObjHat,
  'aba-obj-mitten': AbaObjMitten,
  'aba-obj-pyramid': AbaObjPyramid,
  'aba-obj-sock': AbaObjSock,
  'aba-obj-chair': AbaObjChair,
  'aba-obj-flower': AbaObjFlower,
  'aba-obj-cup': AbaObjCup,
  'aba-obj-tree': AbaObjTree,
  'aba-obj-bus': AbaObjBus,
  'aba-obj-bell': AbaObjBell,
};

/**
 * Награды ABA, партия 1 (`docs/assets/aba-rewards-batch1.md`, принято 2026-11-13). `REWARD_ART` — картинка карточки
 * выбора и обмена; калейдоскопа и горки нет: карточка — кадр той же сцены (`access/RewardPicture`): у калейдоскопа сцена
 * рисуется кодом, у горки карточка собрана из рельсов и шарика сцены.
 * `REWARD_PARTS` — детали сцен вертушки и горки. `REWARD_ICONS` — одноцветный силуэт для полосы «работаю за…» и кольца.
 */
export const REWARD_ART: Readonly<Partial<Record<string, Svg>>> = {
  bubbles: AbaRewardBubbles,
  pinwheel: AbaRewardPinwheel,
  paint_drop: AbaRewardPaintDrop,
};

export const REWARD_PARTS = {
  pinwheelHead: AbaRewardPinwheelHead,
  marbleTrack: AbaRewardMarbleTrack,
  marble: AbaRewardMarble,
} satisfies Record<string, Svg>;

export const REWARD_ICONS: Readonly<Partial<Record<string, Svg>>> = {
  bubbles: ICONS.rewardBubbles,
  kaleidoscope: ICONS.rewardKaleidoscope,
  pinwheel: ICONS.rewardPinwheel,
  marble_run: ICONS.rewardMarbleRun,
  tali_dance: ICONS.rewardTaliDance,
  paint_drop: ICONS.rewardPaintDrop,
  sing_together: ICONS.rewardSingTogether,
};
