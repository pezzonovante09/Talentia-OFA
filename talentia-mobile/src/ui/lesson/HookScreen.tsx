/**
 * Завязка урока (DESIGN_PROMPTS.md 1.3): карточка `surface` с Tali в позе завязки и репликой
 * (место под 3 строки `body`), кнопка повтора 60 над карточкой справа, внизу «Помочь Tali» 88.
 * Фон: светлая — панорама региона, тёмная — заливка региона, calm/focus — песок.
 */
import { View } from 'react-native';

import { useDesign } from '../../design';
import { lessonLayout, taliSize } from '../../design/tokens';
import type { Lesson, Region } from '../../types/task';
import { AppText } from '../AppText';
import { CushionPressable } from '../CushionPressable';
import { Icon } from '../Icon';
import { TaliFigure } from '../TaliFigure';
import { MapBackdrop } from '../map/MapBackdrop';

export function HookScreen({ lesson, region, text, width, height, onReplay, onHelp, labels }: { lesson: Lesson; region: Region['id']; text: string; width: number; height: number; onReplay: () => void; onHelp: () => void; labels: { replay: string; help: string; /** Подпись для скринридера: имя кириллицей (TALI.md «Как пишется имя»). */ helpA11y?: string; tali: string } }) {
  const theme = useDesign();
  const cardW = Math.min(342, width);
  const cardH = Math.min(420, height - theme.touch.primary - theme.spacing.xl * 2 - theme.touch.min - theme.spacing.lg);
  return (
    <View style={{ flex: 1 }} testID="lesson-hook">
      {!theme.focusMode && <MapBackdrop region={region} width={width + theme.spacing.lg * 2} height={height + 200} />}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg }}>
        <View style={{ width: cardW, alignItems: 'flex-end' }}>
          <CushionPressable role="control" width={theme.touch.min} height={theme.touch.min} radius="pill" fill="surface" onPress={onReplay} accessibilityLabel={labels.replay} testID="hook-replay">
            <Icon name="sound" color="primaryInk" />
          </CushionPressable>
        </View>
        <View
          style={{
            width: cardW,
            height: cardH,
            borderRadius: theme.radii.lg,
            backgroundColor: theme.colors.surface,
            borderWidth: theme.stroke.base,
            borderColor: theme.colors.outline,
            alignItems: 'center',
            justifyContent: 'center',
            padding: theme.spacing.lg,
            gap: theme.spacing.lg,
          }}
          testID="hook-card"
        >
          <TaliFigure pose={lesson.hook.taliPose} size={Math.min(taliSize.hero * 1.5, cardH - theme.typography.body.lineHeight * 3 - theme.spacing.lg * 3)} onPress={onReplay} accessibilityLabel={labels.tali} testID="hook-tali" />
          <View style={{ height: theme.typography.body.lineHeight * 3, justifyContent: 'center' }}>
            <AppText role="body" align="center" lines={3}>
              {text}
            </AppText>
          </View>
        </View>
      </View>
      <View style={{ height: lessonLayout.actionBar + theme.elevation.raised.offsetY }}>
        <CushionPressable role="control" width="100%" height={theme.touch.primary} radius={theme.radii.lg} fill="primary" onPress={onHelp} guardMs={theme.motion.slow} accessibilityLabel={labels.helpA11y ?? labels.help} testID="hook-help">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Icon name="arrow" color="onPrimary" />
            <AppText role="label" color="onPrimary" cap="action" lines={1}>
              {labels.help}
            </AppText>
          </View>
        </CushionPressable>
      </View>
    </View>
  );
}
