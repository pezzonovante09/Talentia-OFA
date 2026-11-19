/**
 * Плитка задания и её состояния (SCREENS.md 2.1, 2.3). Ни одно состояние не держится на одном
 * цвете или прозрачности: различают контур (3 / 6 / пунктир), подушка (есть / съедена / нет) и
 * значок. Отклики: «выбрано» — повторный тап сжимает до 0.94 до отпускания (`selectedRepeatPress`);
 * «заблокировано» — посадка + «тук» (№140б); «закреплён» — сжатие 0.98 + голос; «снят» и «тень» не
 * нажимаются и скрыты от скринридера.
 */
import { View } from 'react-native';

import { useDesign } from '../../design';
import { badge, emptyOutlineColor, listeningCue, pressScale, selectedRepeatPress } from '../../design/tokens';
import { CushionPressable } from '../CushionPressable';
import { Icon } from '../Icon';
import { Badge, type BadgeKind } from './Badge';

export type TileState =
  | 'idle'
  | 'selected'
  | 'waiting'
  | 'locked'
  | 'error'
  | 'removed'
  | 'kept'
  | 'pinned'
  | 'shown'
  | 'correct'
  | 'shadow'
  | 'place'
  | 'placeWaiting';

export type TileProps = {
  state: TileState;
  width: number;
  height: number;
  /** Плитка 2.1 — `md` 20; карточка стимула — `lg` 28. */
  radius?: number;
  /** Значок в правом верхнем углу (форма пары, галочка, крест, треугольник). */
  badge?: BadgeKind | null;
  /** Гнездо линии пары на крае, обращённом к противоположному ряду. */
  socket?: 'top' | 'bottom' | null;
  /** «Звучит сейчас» — значок «волны» внутри и заливка `surfaceAlt`. */
  listening?: boolean;
  onPress?: () => void;
  onPressIn?: () => void;
  accessibilityLabel: string;
  accessibilityValue?: string;
  testID: string;
  children?: React.ReactNode;
};

type Look = {
  fill: 'surface' | 'surfaceSunken' | 'surfaceAlt';
  outline: 'outline' | 'primary' | 'error' | 'success' | typeof emptyOutlineColor;
  bold: boolean;
  dashed: boolean;
  raised: boolean;
  sunk: boolean;
  pressable: boolean;
  hidden: boolean;
  scale?: number;
  hold?: boolean;
  disabled?: boolean;
};

export function tileLook(state: TileState): Look {
  switch (state) {
    case 'idle':
      return { fill: 'surface', outline: 'outline', bold: false, dashed: false, raised: true, sunk: false, pressable: true, hidden: false };
    case 'selected':
      return { fill: 'surface', outline: 'primary', bold: true, dashed: false, raised: true, sunk: true, pressable: true, hidden: false, scale: selectedRepeatPress.scale, hold: true };
    case 'waiting':
      return { fill: 'surface', outline: 'primary', bold: false, dashed: false, raised: true, sunk: false, pressable: true, hidden: false };
    case 'locked':
      return { fill: 'surface', outline: 'outline', bold: false, dashed: false, raised: true, sunk: true, pressable: true, hidden: false };
    case 'error':
      return { fill: 'surface', outline: 'error', bold: false, dashed: false, raised: true, sunk: true, pressable: false, hidden: false, disabled: true };
    case 'removed':
      return { fill: 'surfaceSunken', outline: emptyOutlineColor, bold: false, dashed: true, raised: false, sunk: false, pressable: false, hidden: true };
    case 'kept':
      return { fill: 'surface', outline: 'outline', bold: false, dashed: false, raised: false, sunk: false, pressable: true, hidden: false, scale: pressScale.wide, disabled: true };
    case 'pinned':
      return { fill: 'surface', outline: 'outline', bold: false, dashed: false, raised: false, sunk: false, pressable: true, hidden: false, scale: pressScale.wide, disabled: true };
    case 'shown':
      return { fill: 'surface', outline: 'outline', bold: true, dashed: false, raised: true, sunk: false, pressable: true, hidden: false };
    case 'correct':
      return { fill: 'surface', outline: 'success', bold: false, dashed: false, raised: true, sunk: false, pressable: false, hidden: false, disabled: true };
    case 'shadow':
      return { fill: 'surfaceSunken', outline: emptyOutlineColor, bold: false, dashed: true, raised: false, sunk: false, pressable: true, hidden: true };
    case 'place':
      return { fill: 'surfaceSunken', outline: 'outline', bold: false, dashed: true, raised: false, sunk: false, pressable: true, hidden: false, scale: selectedRepeatPress.scale, hold: true };
    case 'placeWaiting':
      return { fill: 'surfaceSunken', outline: 'primary', bold: false, dashed: false, raised: false, sunk: false, pressable: true, hidden: false };
  }
}

export function Tile({ state, width, height, radius, badge: badgeKind = null, socket = null, listening = false, onPress, onPressIn, accessibilityLabel, accessibilityValue, testID, children }: TileProps) {
  const theme = useDesign();
  const look = tileLook(state);
  const fill = listening ? listeningCue.fill : look.fill;
  const hidden = look.hidden && state !== 'shadow';

  return (
    <View style={{ width, height: height + (look.raised ? theme.elevation.raised.offsetY : 0) }} testID={`${testID}-slot`}>
      <CushionPressable
        role="answerOption"
        width={width}
        height={height}
        radius={radius ?? theme.radii.md}
        fill={fill}
        outlineColor={look.outline}
        outlineWidth={look.bold ? theme.stroke.bold : theme.stroke.base}
        dashed={look.dashed}
        raised={look.raised}
        sunk={look.sunk}
        selected={state === 'selected'}
        scale={look.scale ?? pressScale.wide}
        squeezeOnPress={!look.raised || state === 'selected'}
        holdScale={look.hold}
        disabled={!look.pressable}
        onPress={onPress}
        onPressIn={onPressIn}
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={accessibilityValue ? { text: accessibilityValue } : undefined}
        accessibilityElementsHidden={hidden}
        importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
        testID={testID}
        faceStyle={{ overflow: 'visible' }}
      >
        <View style={{ opacity: state === 'removed' ? 0 : 1 }} testID={`${testID}-content`}>
          {children}
        </View>
        {listening && (
          <View style={{ position: 'absolute', top: listeningCue.inset, right: listeningCue.inset }} testID={`${testID}-listening`}>
            <Icon name="waves" size={listeningCue.badge} color="primaryInk" />
          </View>
        )}
      </CushionPressable>
      {badgeKind && (
        <View style={{ position: 'absolute', top: -badge.outset, right: -badge.outset }} pointerEvents="none" testID={`${testID}-badge-${badgeKind}`}>
          <Badge kind={badgeKind} />
        </View>
      )}
      {state === 'pinned' && (
        <View style={{ position: 'absolute', top: -badge.outset, left: -badge.outset }} pointerEvents="none" testID={`${testID}-badge-pin`}>
          <Badge kind="pin" />
        </View>
      )}
      {state === 'shown' && (
        <View style={{ position: 'absolute', top: -badge.status / 2, left: width / 2 - badge.status / 2 }} pointerEvents="none" testID={`${testID}-badge-triangle`}>
          <Badge kind="triangle" />
        </View>
      )}
      {socket && (
        <View
          style={{ position: 'absolute', left: width / 2 - badge.socket / 2, [socket]: -badge.socket / 2 }}
          pointerEvents="none"
          testID={`${testID}-socket`}
        >
          <Icon name="socket" size={badge.socket} color="primary" />
        </View>
      )}
    </View>
  );
}
