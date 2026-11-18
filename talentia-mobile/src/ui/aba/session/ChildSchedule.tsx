/**
 * Расписание ребёнку (решение методиста 34, ревью методиста и `child-ux-specialist`, токены `abaSchedule`):
 * «сначала задание → потом жетоны и награда», под полосой — мини-плиты по одной на оставшийся отрезок работы (на
 * последнем — одна). «Потом» — доска жетонов с наградой при ней; награда одна — только при гарантированном обмене
 * (`childSchedule`). Показывается только на перерыве (`BreakView`); без таймера; касание — сжатие 0.94 без звука и
 * записи, как у значка перерыва. Работы не осталось или награда не выбрана — ничего не рисуется.
 */
import { Pressable, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { abaSchedule } from '../../../design/abaTokens';
import type { ChildScheduleView } from '../../../domain/abaBlockSchedule';
import { useChildT } from '../../../i18n';
import { useAbaColors } from '../parts';
import { ReinforcerArt, TokenCell } from '../reinforcer';

/**
 * Глиф «задание»: две квадратные плиты поля пробы (до ассета, скилл `asset-pipeline`). Квадратные, не вертикальные
 * рамки: вертикальные на этом же экране читались бы как значок «Вернуться» (`pause_bars_outline`; design-lead).
 */
function TaskGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={2.5} y={7.5} width={9} height={9} rx={1.5} stroke={color} strokeWidth={2} fill="none" />
      <Rect x={12.5} y={7.5} width={9} height={9} rx={1.5} stroke={color} strokeWidth={2} fill="none" />
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

/** Вид полосы: касание — сжатие `tapPress` (без обработчика — ничего не вызывает и не пишет), как у значка перерыва. */
export function scheduleStripStyle(pressed: boolean) {
  return { alignItems: 'center', gap: abaSchedule.gap, transform: [{ scale: pressed ? abaSchedule.tap.scale : 1 }] } as const;
}

export function ChildSchedule({ blocksLeft, reinforcerId, then }: ChildScheduleView) {
  const childT = useChildT();
  const c = useAbaColors();
  if (blocksLeft <= 0 || !reinforcerId) return null;
  const s = abaSchedule;
  const plates = Math.min(blocksLeft, s.maxSegments);
  const firstThen = then.kind === 'reward' ? childT('abaBreak.schedule.firstThen') : childT('abaBreak.schedule.firstThenTokens');
  const left = blocksLeft === 1 ? childT('abaBreak.schedule.last') : childT('abaBreak.schedule.left', { count: blocksLeft });
  const cell = { width: s.cell, height: s.cell, borderRadius: s.cellRadius, alignItems: 'center', justifyContent: 'center' } as const;
  // окно награды к фону 1.12:1 — край несёт контур плиты (design-lead)
  const rewardWindow = { backgroundColor: c[s.color.reward], borderWidth: s.cellStroke, borderColor: c[s.color.taskOutline] } as const;
  return (
    <Pressable
      testID="aba-schedule"
      accessible
      accessibilityRole={s.role}
      accessibilityLabel={`${firstThen}. ${left}`}
      style={({ pressed }) => scheduleStripStyle(pressed)}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.gap }}>
        <View testID="aba-schedule-task" style={{ ...cell, backgroundColor: c[s.color.task], borderWidth: s.cellStroke, borderColor: c[s.color.taskOutline] }}>
          <TaskGlyph size={s.taskGlyph} color={c[s.color.taskGlyph]} />
        </View>
        <ArrowGlyph size={s.arrow} color={c[s.color.arrow]} />
        {then.kind === 'reward' ? (
          <View testID="aba-schedule-reward" style={{ ...cell, ...rewardWindow }}>
            <ReinforcerArt id={reinforcerId} size={s.rewardArt} />
          </View>
        ) : (
          <View testID="aba-schedule-board" style={{ flexDirection: 'row', alignItems: 'center', gap: s.boardRewardGap }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.boardGap }}>
              {Array.from({ length: then.size }, (_, i) => (
                <TokenCell
                  key={i}
                  size={s.boardCell}
                  filled={i < then.earned}
                  testID={i < then.earned ? 'aba-schedule-token-filled' : 'aba-schedule-token-empty'}
                />
              ))}
            </View>
            <View
              testID="aba-schedule-reward"
              style={{ width: s.boardReward, height: s.boardReward, borderRadius: s.cellRadius, alignItems: 'center', justifyContent: 'center', ...rewardWindow }}
            >
              <ReinforcerArt id={reinforcerId} size={s.boardRewardArt} />
            </View>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.segmentGap }}>
        {Array.from({ length: plates }, (_, i) => (
          <View
            key={i}
            testID="aba-schedule-segment"
            style={{
              width: s.segment,
              height: s.segment,
              borderRadius: s.cellRadius / 2,
              backgroundColor: c[s.color.segment],
              borderWidth: s.segmentStroke,
              borderColor: c[s.color.segmentOutline],
            }}
          />
        ))}
      </View>
    </Pressable>
  );
}
