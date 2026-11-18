/**
 * Полоса этапов карточки «Где мы сейчас» (№203, `docs/design/aba-direction-b-spec-2026-11-16.md` п. «г», шаг 4; макет
 * `b-tihiy-kabinet.html`, экран 2): Знакомство → Проверка → Учимся → Повторяем. Четыре колонки с весами под длину слова
 * (`parentStageStrip.weights`); пройденный этап — залитая полоса `primary` и кружок ✓ на её конце (знак не в подписи),
 * текущий — полоса выше, в рамке 3 `primary`, следующий — тонкая полоса с границей `edge`. Форма различает состояния и
 * без цвета: заливка / рамка / пусто. Подписи — роль `stage` 13/16, потолок масштаба 1.1, одной строкой с ужатием до
 * `labelMinScale` (не в две строки, как в спецификации: подпись — одно слово, перенос резал бы его посередине; на 360 pt
 * при ×1.1 «Знакомство», «Проверка» и «Повторяем» шире колонок — замер по TTF в `abaExplain202.test.tsx`).
 *
 * Только показ: этап считает `previewParentStage` (план вхолостую), процедура не меняется. Полоса стоит на блоке `where`
 * — ободок кружка ✓ его цвета, чтобы кружок «вырезался» из полосы, а не лежал на ней.
 */
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { ParentStage } from '../../domain/abaParentStage';
import { parentFontScaleMax, parentStageStrip as S } from '../../design/parentTokens';
import { fontFamilyFor } from '../fonts';
import { ParentIcon } from './primitives';
import { useParentTheme } from './theme';

export const STAGE_STEPS = ['pairing', 'placement', 'teaching', 'maintenance'] as const;
export type StageStep = (typeof STAGE_STEPS)[number];
export type StageStepState = 'done' | 'now' | 'next';

/**
 * Колонка полосы для этапа плана: первые пробы (`baseline`) — тоже «Проверка» (без жетонов и подсказок), «всё освоено» —
 * «Повторяем». План не построился (`unknown`) — полосы нет.
 */
export function stageStepOf(kind: ParentStage['kind']): StageStep | null {
  switch (kind) {
    case 'pairing':
      return 'pairing';
    // шаг «коснись картинки» — перед первыми заданиями, в колонке «Проверка»
    case 'sample_touch':
    case 'placement':
    case 'baseline':
      return 'placement';
    case 'teaching':
      return 'teaching';
    case 'maintenance':
    case 'all_mastered':
      return 'maintenance';
    case 'unknown':
      return null;
  }
}

export function stageStepState(step: StageStep, current: StageStep): StageStepState {
  const d = STAGE_STEPS.indexOf(step) - STAGE_STEPS.indexOf(current);
  return d < 0 ? 'done' : d === 0 ? 'now' : 'next';
}

export function StageStrip({ current, testID = 'stage-strip' }: { current: StageStep; testID?: string }) {
  const { t } = useTranslation();
  const th = useParentTheme();
  const c = th.colors;
  const ty = th.typography.stage;
  return (
    <View style={{ flexDirection: 'row', gap: S.gap }} testID={testID}>
      {STAGE_STEPS.map((step, i) => {
        const state = stageStepState(step, current);
        const bar =
          state === 'done'
            ? { height: S.bar, borderRadius: S.bar / 2, backgroundColor: c.primary }
            : state === 'now'
              ? { height: S.barNow, borderRadius: S.barNow / 2, backgroundColor: c.card, borderWidth: S.ringNow, borderColor: c.primary }
              : { height: S.bar, borderRadius: S.bar / 2, backgroundColor: c.card, borderWidth: th.shape.edge, borderColor: c.edge };
        return (
          <View
            key={step}
            style={{ flex: S.weights[i], gap: S.labelGap }}
            accessible
            accessibilityState={state === 'now' ? { selected: true } : undefined}
            testID={`${testID}-${step}`}
          >
            {/* слот полосы — высоты текущей: полосы разной толщины стоят по одной оси, подписи — на одной линии */}
            <View style={{ height: S.barNow, justifyContent: 'center' }}>
              <View style={bar} testID={`${testID}-${step}-${state}`} />
              {state === 'done' ? (
                <View
                  testID={`${testID}-${step}-check`}
                  style={{
                    position: 'absolute',
                    right: -S.checkOverhang,
                    top: (S.barNow - S.check) / 2,
                    width: S.check,
                    height: S.check,
                    borderRadius: S.check / 2,
                    backgroundColor: c.primary,
                    borderWidth: S.checkRing,
                    borderColor: c.blockWhere,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ParentIcon name="check" color="onPrimary" size={S.checkGlyph} />
                </View>
              ) : null}
            </View>
            {/* одной строкой с ужатием, а не в две: подпись — одно слово, перенос разрезал бы его (360 pt при ×1.1) */}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={S.labelMinScale}
              maxFontSizeMultiplier={parentFontScaleMax.stage}
              testID={`${testID}-${step}-label`}
              style={{ fontFamily: fontFamilyFor(ty), fontWeight: ty.weight, fontSize: ty.size, lineHeight: ty.lineHeight, color: state === 'next' ? c.textMuted : c.text }}
            >
              {t(`parent.aba.where.stage.${step}`)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
