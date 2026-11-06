/**
 * Узел карты 72 (DESIGN_PROMPTS.md 1.2; §2 дизайн-дока). Доступный — `primary` с подушкой и стрелкой,
 * открывает урок по отпусканию с защитой от повтора. Остальные — плоские с голосом (UX п. 8: у любого
 * тапа есть отклик): замок «откроется по порядку», «спит» — «откроется завтра», пройденный — повтор
 * урока, «повторение» — «сначала пройди урок» / «всё повторено», без перевода — пунктир и «тут пока
 * пусто» (1.6а).
 */
import { useTranslation } from 'react-i18next';

import { mapLane, mapLayout, pressScale } from '../../design/tokens';
import type { NodeState, ReviewNode } from '../../domain/mapProgress';
import type { IconName } from '../../assets/registry';
import { CushionPressable } from '../CushionPressable';
import { Icon } from '../Icon';
import type { ColorName } from '../colors';

export type MapNodeKind =
  | { kind: 'lesson'; state: NodeState; unavailable: boolean; number: number }
  /** `voice` — что говорит тихий узел: «сначала пройди урок» или «всё повторено» (модель карты). */
  | { kind: 'review'; review: ReviewNode; voice: 'map.reviewLater' | 'map.reviewNothing' };

export type MapNodeProps = {
  node: MapNodeKind;
  onOpen?: () => void;
  /** Плоский узел: голос вместо действия. */
  onVoice: (key: string) => void;
  /** Лента в движении — узел не открывается. */
  panning: () => boolean;
  testID: string;
};

type Look = { fill: ColorName; icon: IconName; iconColor: ColorName; raised: boolean; dashed?: boolean; voice?: string };

function lookOf(node: MapNodeKind): Look {
  if (node.kind === 'review') {
    return node.review === 'active'
      ? { fill: 'surface', icon: 'review', iconColor: 'text', raised: true }
      : { fill: 'surface', icon: 'review', iconColor: 'textMuted', raised: false, voice: node.voice };
  }
  if (node.unavailable) return { fill: 'surfaceSunken', icon: 'lock', iconColor: 'textMuted', raised: false, dashed: true, voice: 'map.noTranslation' };
  switch (node.state) {
    case 'open':
      return { fill: 'primary', icon: 'arrow', iconColor: 'onPrimary', raised: true };
    case 'done':
    case 'explored':
      return { fill: 'surface', icon: 'check', iconColor: 'text', raised: true };
    case 'sleeping':
      return { fill: 'surface', icon: 'lock', iconColor: 'textMuted', raised: false, voice: 'map.sleeping' };
    case 'ahead':
      return { fill: 'surface', icon: 'lock', iconColor: 'text', raised: false, voice: 'map.lockedInOrder' };
  }
}

export function MapNode({ node, onOpen, onVoice, panning, testID }: MapNodeProps) {
  const { t } = useTranslation();
  const look = lookOf(node);
  const label = node.kind === 'review' ? t('a11y.map.review') : t('a11y.map.lesson', { n: node.number });

  return (
    <CushionPressable
      role={look.raised ? 'control' : 'tali'}
      width={mapLayout.node}
      height={mapLayout.node}
      radius="pill"
      fill={look.fill}
      dashed={look.dashed}
      scale={pressScale.mapNode}
      guardMs={mapLane.openGuardMs}
      onPress={() => {
        if (look.voice) {
          onVoice(look.voice);
          return;
        }
        if (panning()) return;
        onOpen?.();
      }}
      accessibilityLabel={label}
      testID={testID}
      style={{ opacity: node.kind === 'lesson' && node.state === 'explored' ? 0.8 : 1 }}
    >
      <Icon name={look.icon} color={look.iconColor} />
    </CushionPressable>
  );
}
