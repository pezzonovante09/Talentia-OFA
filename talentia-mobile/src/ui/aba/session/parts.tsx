/**
 * Детали экрана рабочей сессии ABA (раздел 5–7 направления, Ц2.2, Ц2.6): полоса с выходом и карточкой «перерыв»,
 * доска в полосе, поле `match`, панель взрослого, плашка подкрепления. Логика — модели `model/*` и домен; здесь вид.
 */
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { abaAdultPanel, abaAdultPanelColors, abaBoardCell, abaBreak, abaLayout, abaRefusalPause, abaReinforcementOverlay, abaTokenBoard, ABA_CONTROL_STROKE, ABA_STRIP_SILHOUETTE, ABA_STRIP_SILHOUETTE_GAP } from '../../../design/abaTokens';
import { parentColors, parentTypography } from '../../../design/parentTokens';
import { radii } from '../../../design/tokens';
import type { PromptVisualPlan } from '../../../domain/abaPrompting';
import type { PanelButton } from '../../../domain/abaScoring';
import { fontFamilyFor } from '../../fonts';
import { TaliFigure } from '../../TaliFigure';
import { useAbaClock } from '../clock';
import { ChildPressable, ExitHold, PlaceholderGlyph, useAbaColors } from '../parts';
import { ReinforcerArt, TokenCell } from '../reinforcer';
import { StimulusPlate } from '../StimulusPlate';

/**
 * Полоса 68: выход удержанием слева, карточка «перерыв» справа (не прячется, без подтверждения). `caption` — строка
 * взрослого справа от выхода (обучающий перерыв со второго приглашения, Ц3.9): родительский `caption` `textMuted`.
 */
export function TopBar({
  onExit,
  breakCard,
  caption,
}: {
  onExit: () => void;
  /** `null` — карточки на этом экране нет (перерыв, конец). `highlight` — статичный контур 6 (пауза после «Отказ»). */
  breakCard: { frameShownAt: number; onTap: (at: number) => void; highlight?: boolean } | null;
  caption?: string;
}) {
  const { t } = useTranslation();
  const c = useAbaColors();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const w = abaBreak.trainingWait;
  const cap = parentTypography.caption;
  return (
    <View style={{ height: abaLayout.topBar, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <ExitHold onExit={onExit} label={t('abaSession.exit')} hintLabel={t('abaSession.exitHint')} />
      {caption !== undefined && (
        <Text
          testID="aba-adult-caption"
          style={{ flex: 1, marginLeft: 16, color: parentColors[scheme][w.color], fontFamily: fontFamilyFor(cap), fontWeight: cap.weight, fontSize: cap.size, lineHeight: cap.lineHeight, textAlign: 'left' }}
          numberOfLines={w.lines}
          adjustsFontSizeToFit
          minimumFontScale={abaAdultPanel.minimumFontScale}
          maxFontSizeMultiplier={w.maxFontSizeMultiplier}
        >
          {caption}
        </Text>
      )}
      {breakCard && (
        <ChildPressable
          frameShownAt={breakCard.frameShownAt}
          onCommit={breakCard.onTap}
          testID="aba-break-card"
          accessibilityLabel={t('abaSession.breakCard')}
          style={{
            width: abaLayout.breakCard,
            height: abaLayout.breakCard,
            borderRadius: radii.md,
            borderWidth: breakCard.highlight ? abaRefusalPause.cardContour : ABA_CONTROL_STROKE,
            borderColor: c.controlInk,
            backgroundColor: c.controlFill,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PlaceholderGlyph name="pause_bars" size={32} color={c.controlInk} />
        </ChildPressable>
      )}
    </View>
  );
}

/** Доска в полосе пробы: силуэт «работаю за…» и ячейки по рабочему размеру; жетон уже стоит, без анимации. */
export function TokenStrip({ reinforcerId, size, earned }: { reinforcerId: string | null; size: number; earned: number }) {
  return (
    <View
      testID="aba-token-strip"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: abaLayout.tokenBoard, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: ABA_STRIP_SILHOUETTE_GAP }}
    >
      {reinforcerId && <ReinforcerArt id={reinforcerId} size={ABA_STRIP_SILHOUETTE} silhouette />}
      {Array.from({ length: size }, (_, i) => (
        <TokenCell key={i} size={abaTokenBoard.size} filled={i < earned} testID={i < earned ? 'aba-strip-token-filled' : 'aba-strip-token-empty'} />
      ))}
    </View>
  );
}

/** Метка подсказки L1: шеврон 32 над образцом (полоса 40). */
function Chevron({ color }: { color: string }) {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" testID="aba-hint-chevron">
      <Path d="M5 9l7 7 7-7" stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** Плита `match`: белая, контур 3; касание — контур 6 внутрь; неактивная — штриховка (Ц2.5). */
function Plate({
  stimulusId,
  size,
  selected,
  inactive,
  frameShownAt,
  onTap,
  testID,
  label,
}: {
  stimulusId: string | null;
  size: number;
  selected: boolean;
  inactive: boolean;
  frameShownAt: number;
  onTap: (at: number) => void;
  testID: string;
  label: string;
}) {
  const c = useAbaColors();
  return (
    <ChildPressable
      frameShownAt={frameShownAt}
      onCommit={onTap}
      testID={testID}
      accessibilityLabel={label}
      style={{
        width: size,
        height: size,
        borderRadius: radii.md,
        borderWidth: selected ? 6 : ABA_CONTROL_STROKE,
        borderColor: c.plateOutline,
        backgroundColor: inactive ? c.inactiveHatch : c.plate,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {stimulusId && <StimulusPlate stimulusId={stimulusId} size={size - 16} />}
    </ChildPressable>
  );
}

/**
 * Поле `match`: полоса подсказки 40 (шеврон над образцом на L1+), образец по центру, 24, варианты в ряд. `empty` —
 * межпробная пауза или обучение карточке: пустые белые плиты (без стимулов), позиции не меняются.
 */
export function MatchField({
  sampleId,
  field,
  visual,
  sampleTouched,
  activeIds,
  chosenId,
  sampleSize,
  choiceSize,
  frameShownAt,
  empty,
  onSample,
  onOption,
}: {
  sampleId: string;
  field: readonly string[];
  visual: PromptVisualPlan | null;
  sampleTouched: boolean;
  activeIds: readonly string[];
  chosenId: string | null;
  sampleSize: number;
  choiceSize: number;
  frameShownAt: number;
  empty: boolean;
  onSample: (at: number) => void;
  onOption: (id: string, at: number) => void;
}) {
  const { t } = useTranslation();
  const c = useAbaColors();
  const mark = !empty && visual?.focus?.on === 'sample';
  return (
    <View style={{ alignItems: 'center' }} testID="aba-match-field">
      <View style={{ height: abaLayout.hintBand, justifyContent: 'flex-end', paddingBottom: 2 }}>{mark && <Chevron color={c.ink} />}</View>
      <Plate
        stimulusId={empty ? null : sampleId}
        size={sampleSize}
        selected={!empty && sampleTouched}
        inactive={false}
        frameShownAt={frameShownAt}
        onTap={onSample}
        testID="aba-sample"
        label={t('abaSession.sample')}
      />
      <View style={{ flexDirection: 'row', gap: 24, marginTop: 24 }}>
        {field.map((id, i) => (
          <Plate
            key={`${i}-${id}`}
            stimulusId={empty ? null : id}
            size={choiceSize}
            selected={!empty && chosenId === id}
            inactive={!empty && !activeIds.includes(id)}
            frameShownAt={frameShownAt}
            onTap={(at) => onOption(id, at)}
            testID={`aba-option-${i}`}
            label={t('abaSession.option', { n: i + 1 })}
          />
        ))}
      </View>
    </View>
  );
}

const PANEL_LABEL: Record<PanelButton, string> = {
  correct: 'abaPanel.correct',
  approximation: 'abaPanel.close',
  incorrect: 'abaPanel.incorrect',
  adult_prompted: 'abaPanel.prompted',
  refusal: 'abaPanel.refused',
  l4_done: 'abaPanel.together',
  l4_resisted: 'abaPanel.resisted',
  l4_skipped: 'abaPanel.skip',
  adult_completed: 'abaPanel.stepAlone',
};

/**
 * Панель взрослого (Ц2.2 / №159): места кнопок постоянные — ряд 1 «Верно · Почти · Неверно» (у `match` пуст) или
 * карточка L4; ряд 2 «Была подсказка» · «Отказ» у нижнего края. `caption` — подсказка взрослому вместо ряда 1.
 */
export function AdultPanel({
  buttons,
  height,
  insetBottom,
  caption,
  pressed,
  onPress,
}: {
  buttons: readonly PanelButton[];
  height: number;
  insetBottom: number;
  caption?: string;
  pressed: PanelButton | null;
  /** `at` — касание вниз (`respondedAt: 'touch_down'`); действие — по отпусканию внутри кнопки. */
  onPress: (b: PanelButton, at: number) => void;
}) {
  const { t } = useTranslation();
  const clock = useAbaClock();
  const downAt = useRef<Partial<Record<PanelButton, number>>>({});
  const p = abaAdultPanelColors(useColorScheme() === 'dark' ? 'dark' : 'light');
  const has = (b: PanelButton) => buttons.includes(b);
  const l4 = has('l4_done') || has('l4_resisted');
  const row1: (PanelButton | null)[] = l4 ? ['l4_done', 'l4_resisted'] : has('correct') ? ['correct', 'approximation', 'incorrect'] : [];
  // «Пропустить» без карточки L4 (обучение карточке «перерыв») — на месте «Отказ», справа в ряду 2
  const right: PanelButton | null = has('refusal') ? 'refusal' : !l4 && has('l4_skipped') ? 'l4_skipped' : null;
  const row2: (PanelButton | null)[] = [l4 ? (has('l4_skipped') ? 'l4_skipped' : null) : has('adult_prompted') ? 'adult_prompted' : null, right];
  const pad = abaAdultPanel.padding;
  const button = (b: PanelButton | null, i: number) =>
    b === null ? (
      <View key={i} style={{ flex: 1 }} />
    ) : (
      <Pressable
        key={b}
        // случайное касание ладонью ребёнка не необратимо: срабатывает отпускание, время — касания вниз
        onPressIn={() => {
          downAt.current[b] = clock.now();
        }}
        onPress={() => onPress(b, downAt.current[b] ?? clock.now())}
        testID={`aba-panel-${b}`}
        accessibilityRole="button"
        style={{
          flex: 1,
          borderRadius: radii.sm,
          borderWidth: pressed === b ? 3 : 1,
          borderColor: p.border,
          backgroundColor: p.button,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: abaAdultPanel.labelPadX,
        }}
      >
        <Text
          style={{ color: p.label, fontSize: 14, lineHeight: 20, textAlign: 'center' }}
          numberOfLines={abaAdultPanel.labelLines}
          maxFontSizeMultiplier={abaAdultPanel.maxFontSizeMultiplier}
          minimumFontScale={abaAdultPanel.minimumFontScale}
          adjustsFontSizeToFit
        >
          {t(PANEL_LABEL[b])}
        </Text>
      </Pressable>
    );
  return (
    <View testID="aba-adult-panel" style={{ height: height + Math.max(0, insetBottom - pad), backgroundColor: p.band, padding: pad, paddingBottom: Math.max(pad, insetBottom), gap: 12 }}>
      <View style={{ flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        {caption && row1.length === 0 ? (
          <Text testID="aba-panel-caption" style={{ color: p.label, fontSize: 14, lineHeight: 20, flex: 1 }} numberOfLines={2} maxFontSizeMultiplier={abaAdultPanel.maxFontSizeMultiplier}>
            {caption}
          </Text>
        ) : (
          row1.map(button)
        )}
      </View>
      <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>{row2.map(button)}</View>
    </View>
  );
}

/**
 * Плашка подкрепления (раздел 6, Ц2.6): ложится от доски до низа зоны стимула, Tali `cheer`, крупная доска, подпись.
 * Тап по ней ничего не делает. `landed` — жетон уже в ячейке (до приземления новая ячейка пустая).
 */
export function ReinforcementOverlay({ size, earnedBefore, landed, calm, height }: { size: number; earnedBefore: number; landed: boolean; calm: boolean; height: number }) {
  const { t } = useTranslation();
  const c = useAbaColors();
  const o = abaReinforcementOverlay;
  const earned = earnedBefore + (landed ? 1 : 0);
  return (
    <View
      testID="aba-reinforcement"
      pointerEvents="none"
      style={{
        height,
        borderRadius: o.radius,
        borderWidth: o.stroke,
        borderColor: calm ? c.reinforcement : c.controlInk,
        backgroundColor: calm ? c.background : c.reinforcement,
        padding: o.pad,
        alignItems: 'center',
        justifyContent: 'center',
        gap: o.gap,
      }}
    >
      <TaliFigure pose="cheer" size={o.tali} crop accessibilityLabel={t('abaSession.tali')} testID="aba-reinforcement-tali" />
      <View style={{ flexDirection: 'row', gap: abaTokenBoard.gap }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: size }, (_, i) => (
          <TokenCell key={i} size={abaBoardCell(311, size)} filled={i < earned} testID={i < earned ? 'aba-overlay-token-filled' : 'aba-overlay-token-empty'} />
        ))}
      </View>
      <Text style={{ color: calm ? c.ink : c.onReinforcement, fontSize: 24, lineHeight: 32, fontWeight: '700', textAlign: 'center', minHeight: o.caption }} numberOfLines={2} maxFontSizeMultiplier={1.2}>
        {t('abaReinforcement.token')}
      </Text>
    </View>
  );
}
