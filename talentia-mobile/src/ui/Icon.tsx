/**
 * Иконка из реестра: глиф — `color` (в svg `currentColor`), контур — `colors.outline` темы
 * (в svg `#2A1A12`, подменяется на проп `stroke` сборкой, `.svgrrc.js`). Два размера: 32 на
 * кнопках, 24 у значков (`icon`).
 */
import { ICONS, type IconName } from '../assets/registry';
import { useDesign } from '../design';
import { icon as iconSize } from '../design/tokens';
import type { ColorName } from './colors';

export type IconProps = {
  name: IconName;
  size?: number;
  color: ColorName;
  /** Цвет глифа строкой — для палитр регионов (`regionsInk`), которых нет среди `ColorName`; перекрывает `color`. */
  tint?: string;
  /** Цвет контура строкой — для палитр вне детской темы (ABA, `abaColors`); перекрывает `colors.outline`. */
  outline?: string;
  testID?: string;
};

export function Icon({ name, size = iconSize.size, color, tint, outline, testID }: IconProps) {
  const theme = useDesign();
  const Svg = ICONS[name];
  return <Svg width={size} height={size} color={tint ?? theme.colors[color]} stroke={outline ?? theme.colors.outline} testID={testID} />;
}
