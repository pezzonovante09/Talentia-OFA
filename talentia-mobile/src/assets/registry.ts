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

import TaliCheer from '../../assets/images/tali/tali-cheer.svg';
import TaliFound from '../../assets/images/tali/tali-found.svg';
import TaliHello from '../../assets/images/tali/tali-hello.svg';
import TaliPoint from '../../assets/images/tali/tali-point.svg';
import TaliPuzzled from '../../assets/images/tali/tali-puzzled.svg';
import TaliWrite from '../../assets/images/tali/tali-write.svg';

import RegionLogic from '../../assets/images/regions/region-logic.svg';
import RegionNature from '../../assets/images/regions/region-nature.svg';
import RegionNumbers from '../../assets/images/regions/region-numbers.svg';
import RegionWords from '../../assets/images/regions/region-words.svg';

import UiBulb from '../../assets/icons/ui-bulb.svg';
import UiCheck from '../../assets/icons/ui-check.svg';
import UiLock from '../../assets/icons/ui-lock.svg';
import UiMap from '../../assets/icons/ui-map.svg';
import UiSound from '../../assets/icons/ui-sound.svg';
import UiX from '../../assets/icons/ui-x.svg';

type Svg = React.FC<SvgProps>;

/** Шесть поз. Анимация Tali — переключение между ними, а не риг. */
export const TALI_POSES = {
  hello: TaliHello,
  found: TaliFound,
  point: TaliPoint,
  cheer: TaliCheer,
  puzzled: TaliPuzzled,
  write: TaliWrite,
} satisfies Record<string, Svg>;

export type TaliPose = keyof typeof TALI_POSES;

/** Панорамы регионов. Ключи совпадают с id региона в схеме курса. */
export const REGION_PANORAMAS = {
  numbers: RegionNumbers,
  words: RegionWords,
  nature: RegionNature,
  workshop: RegionLogic,
} satisfies Record<string, Svg>;

export type RegionId = keyof typeof REGION_PANORAMAS;

export const ICONS = {
  check: UiCheck,
  x: UiX,
  lock: UiLock,
  sound: UiSound,
  map: UiMap,
  bulb: UiBulb,
} satisfies Record<string, Svg>;

export type IconName = keyof typeof ICONS;
