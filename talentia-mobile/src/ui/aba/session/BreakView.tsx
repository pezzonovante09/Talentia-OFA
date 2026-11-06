/**
 * Перерыв (фаза 7, №169; вид — Ц3.1, Ц3.9): кольцо → приглашение (контур 6 у «Вернуться») → второе (планки 120 становятся
 * контурными). Доля кольца — от начала перерыва, не от показа кадра: после возврата из фона кольцо не начинается заново
 * (фаза 8). Пауза после «Отказ» — не здесь: у неё экран пробы без плит (`app/aba/session.tsx`).
 */
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { abaBreak, inactiveChoice, ABA_CONTROL_STROKE } from '../../../design/abaTokens';
import { radii } from '../../../design/tokens';
import type { Phase } from '../model/sessionPhase';
import { ChildPressable, PlaceholderGlyph, useAbaColors } from '../parts';
import { AccessRing } from '../reinforcer';
import { TopBar } from './parts';

export function BreakView({ phase, onReturn }: { phase: Extract<Phase, { kind: 'break' }>; onReturn: (at: number) => void }) {
  const { t } = useTranslation();
  const c = useAbaColors();
  const left = (phase.until - (phase.tick ?? phase.shownAt)) / (phase.until - phase.startedAt);
  return (
    <View style={{ flex: 1 }} testID="aba-break">
      {/* обучающий перерыв ждёт взрослого (№169): со второго приглашения — подпись взрослому (Ц3.9) */}
      <TopBar breakCard={null} caption={phase.training && phase.invite === 2 ? t('abaBreak.trainingWaitHint') : undefined} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        {/* значок не нажимается, но похож на кнопку: касание — сжатие без звука и записи (Ц3.1) */}
        <Pressable
          accessibilityRole="image"
          accessibilityLabel={t('abaSession.breakCard')}
          testID="aba-break-icon"
          style={({ pressed }) => ({
            width: abaBreak.timerRing,
            height: abaBreak.timerRing,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? inactiveChoice.tapPress.scale : 1 }],
          })}
        >
          {phase.invite === 0 && (
            <View style={{ position: 'absolute' }}>
              <AccessRing left={left} size={abaBreak.timerRing} />
            </View>
          )}
          {/* «две планки» 120 — внутри кольца и после него: место не пустеет (`abaBreak.atTimerEnd`); на втором
              приглашении — контурные, тот же значок, что на «Вернуться» */}
          {phase.invite === 2 ? (
            <PlaceholderGlyph name="pause_bars_outline" size={abaBreak.icon} stroke={abaBreak.invite.second.iconStroke} color={c.ink} />
          ) : (
            <PlaceholderGlyph name="pause_bars" size={abaBreak.icon} color={c.ink} />
          )}
        </Pressable>
      </View>
      {/* детская цель (`abaChildTouch`): сжатие 0.94 на касание, засчитывается по правилу кадра */}
      <ChildPressable
        frameShownAt={phase.shownAt}
        onCommit={onReturn}
        testID="aba-break-return"
        accessibilityLabel={t('abaBreak.return')}
        style={{
          height: abaBreak.returnButton,
          marginHorizontal: 24,
          marginBottom: 16,
          borderRadius: radii.lg,
          borderWidth: phase.invite > 0 ? abaBreak.invite.contour : ABA_CONTROL_STROKE,
          borderColor: c.controlInk,
          backgroundColor: c.controlFill,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <PlaceholderGlyph name="pause_bars_outline" size={abaBreak.returnIcon.size} color={c.controlInk} />
        <Text style={{ color: c.controlInk, fontSize: 22, fontWeight: '700' }} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}>
          {t('abaBreak.return')}
        </Text>
      </ChildPressable>
    </View>
  );
}
