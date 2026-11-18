/**
 * Расписание ребёнку (решение методиста 34, токены `abaSchedule`): «сначала задание → потом награда» и «ещё N»
 * блоков точками, перед последним блоком — флажок «последнее». Показывается только на перерыве (`BreakView`);
 * неподвижно, без таймера. Работы не осталось или награда не выбрана — ничего не рисуется.
 */
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { abaSchedule } from '../../../design/abaTokens';
import type { BlockSchedule } from '../../../domain/abaBlockSchedule';
import { useChildT } from '../../../i18n';
import { useAbaColors } from '../parts';
import { ReinforcerArt } from '../reinforcer';

/** Глиф «задание»: две плиты поля пробы (до ассета, скилл `asset-pipeline`). */
function TaskGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={2.5} y={6.5} width={8} height={11} rx={1.5} stroke={color} strokeWidth={2} fill="none" />
      <Rect x={13.5} y={6.5} width={8} height={11} rx={1.5} stroke={color} strokeWidth={2} fill="none" />
    </Svg>
  );
}

function ArrowGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 12h15M13 6l6 6-6 6" stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Значок «последнее»: флажок финиша (до ассета). */
function LastGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" testID="aba-schedule-last">
      <Path d="M6 21V3.5" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M6 4h12l-3 4.5 3 4.5H6z" fill={color} />
    </Svg>
  );
}

export function ChildSchedule({ blocksLeft, isLast, reinforcerId }: BlockSchedule & { reinforcerId: string | null }) {
  const childT = useChildT();
  const c = useAbaColors();
  if (blocksLeft <= 0 || !reinforcerId) return null;
  const s = abaSchedule;
  const dots = Math.min(blocksLeft, s.maxDots);
  const label = `${childT('abaBreak.schedule.firstThen')}. ${isLast ? childT('abaBreak.schedule.last') : childT('abaBreak.schedule.left', { count: blocksLeft })}`;
  const cell = { width: s.cell, height: s.cell, borderRadius: s.cellRadius, alignItems: 'center', justifyContent: 'center' } as const;
  return (
    <View
      testID="aba-schedule"
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      pointerEvents="none"
      style={{ alignItems: 'center', gap: s.gap }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.gap }}>
        <View testID="aba-schedule-task" style={{ ...cell, backgroundColor: c[s.color.task], borderWidth: s.cellStroke, borderColor: c[s.color.taskOutline] }}>
          <TaskGlyph size={s.taskGlyph} color={c[s.color.taskGlyph]} />
        </View>
        <ArrowGlyph size={s.arrow} color={c[s.color.arrow]} />
        <View testID="aba-schedule-reward" style={{ ...cell, backgroundColor: c[s.color.reward] }}>
          <ReinforcerArt id={reinforcerId} size={s.rewardArt} />
        </View>
      </View>
      <View style={{ height: Math.max(s.dot, s.lastMark), flexDirection: 'row', alignItems: 'center', gap: s.dotGap }}>
        {isLast ? (
          <LastGlyph size={s.lastMark} color={c[s.color.lastMark]} />
        ) : (
          Array.from({ length: dots }, (_, i) => (
            <View key={i} testID="aba-schedule-dot" style={{ width: s.dot, height: s.dot, borderRadius: s.dot / 2, backgroundColor: c[s.color.dot] }} />
          ))
        )}
      </View>
    </View>
  );
}
