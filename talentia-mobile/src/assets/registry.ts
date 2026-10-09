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

import UiBulb from '../../assets/icons/ui-bulb.svg';
import UiCheck from '../../assets/icons/ui-check.svg';
import UiLock from '../../assets/icons/ui-lock.svg';
import UiMap from '../../assets/icons/ui-map.svg';
import UiSound from '../../assets/icons/ui-sound.svg';
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

export const ICONS = {
  check: UiCheck,
  x: UiX,
  lock: UiLock,
  sound: UiSound,
  map: UiMap,
  bulb: UiBulb,
} satisfies Record<string, Svg>;

export type IconName = keyof typeof ICONS;
