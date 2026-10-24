/**
 * Значки поверх плитки (SCREENS.md 2.2): статусные — круг-подложка своего цвета с иконкой 32;
 * форма пары 24, булавка 24 — одноцветная заливка `outline`. Не нажимаются.
 */
import { View } from 'react-native';

import { PAIR_SHAPES } from '../../assets/registry';
import { useDesign } from '../../design';
import { badge } from '../../design/tokens';
import { Icon } from '../Icon';

export type BadgeKind = 'check' | 'x' | 'triangle' | 'pin' | 'pair0' | 'pair1' | 'pair2' | 'pair3';

export function Badge({ kind }: { kind: BadgeKind }) {
  const theme = useDesign();
  if (kind === 'check' || kind === 'x') {
    const fill = kind === 'check' ? theme.colors.success : theme.colors.error;
    const ink: 'onSuccess' | 'onError' = kind === 'check' ? 'onSuccess' : 'onError';
    return (
      <View
        style={{
          width: badge.status,
          height: badge.status,
          borderRadius: badge.status / 2,
          backgroundColor: fill,
          borderWidth: theme.stroke.base,
          borderColor: theme.colors.outline,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={kind} size={badge.status - 8} color={ink} />
      </View>
    );
  }
  if (kind === 'triangle') return <Icon name="triangle" size={badge.status} color="outline" />;
  if (kind === 'pin') return <Icon name="pin" size={badge.pin} color="outline" />;
  const Shape = PAIR_SHAPES[Number(kind.slice(4))] ?? PAIR_SHAPES[0];
  return <Shape width={badge.pairShape} height={badge.pairShape} color={theme.colors.outline} stroke={theme.colors.outline} />;
}
