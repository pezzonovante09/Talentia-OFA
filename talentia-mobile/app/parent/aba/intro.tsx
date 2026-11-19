/**
 * «Как проходят занятия» — введение для взрослого перед первым занятием (решение владельца №202, вопрос 116). Четыре
 * шага: что будет, что делает взрослый, что делает ребёнок, жетоны и выход. Тексты проверил `aba-pedagogy-specialist`
 * 2026-11-16: они не описывают ответ ребёнку и не подталкивают взрослого помогать во время пробы.
 *
 * Вид — «Тихий кабинет» (№203, спецификация `docs/design/aba-direction-b-spec-2026-11-16.md`, п. «г» 6): каждый шаг —
 * тонированный блок. Шаг 2 «Что делаете вы» — правило взрослому (`rule`) с двумя запретами-иконками (фрагменты того
 * же текста шага), остальные — объяснение (`explain`). Под блоком шага 2 — неинтерактивная врезка-пример низа экрана
 * занятия: лист `zone` с кромкой `edge` по верху, как в пробе, но без кнопок — названия словами в кавычках, ничего не
 * выглядит нажимаемым и не нажимается.
 *
 * Экран внутри группы `/parent` — за PIN-гейтом. «Понятно» отмечает введение просмотренным (`abaIntro.ts`) и
 * возвращает на «Занятия ABA»; начать занятие взрослый нажимает сам — «Кто ведёт» и старт остаются в одном месте.
 * Повторно введение открывается строкой «Как проходят занятия» в карточке «Где мы сейчас».
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { abaAdultSheet } from '../../../src/design/abaTokens';
import { parentCard, parentSpacing } from '../../../src/design/parentTokens';
import { markAbaIntroSeen } from '../../../src/services/local/abaIntro';
import { useAccount } from '../../../src/state/account';
import { device } from '../../../src/state/device';
import { Card, ParentButton, ParentScreen, ParentText, type CardTone } from '../../../src/ui/parent/primitives';
import { useParentTheme } from '../../../src/ui/parent/theme';

const ABA_INTRO_STEPS = 4;

/** Тон блока шага: шаг 2 — правило взрослому, остальные объясняют (№203). */
export const INTRO_STEP_TONE: Record<number, CardTone> = { 1: 'explain', 2: 'rule', 3: 'explain', 4: 'explain' };

/**
 * Иконки-запреты шага 2 — линия 2 в поле 24 (`viewBox` 0 0 24 24) с косой чертой через весь знак; рисунок из макета
 * направления Б. Геометрия задана в единицах поля, размер на экране — `parentCard.iconGlyph`, цвет — `text`.
 */
const FORBID_PATHS = {
  point: 'M10 20 V8 a2 2 0 0 1 4 0 V13 h3 a2 2 0 0 1 2 2 v5',
  talk: 'M4 5 h16 v10 h-9 l-4 4 v-4 h-3 z',
} as const;
const FORBID_SLASH = 'M3 3 L21 21';
const FORBID_STROKE = 2;

function ForbidIcon({ kind }: { kind: keyof typeof FORBID_PATHS }) {
  const t = useParentTheme();
  const size = parentCard.iconGlyph;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" testID={`aba-intro-forbid-${kind}`}>
      <Path d={FORBID_PATHS[kind]} fill="none" stroke={t.colors.text} strokeWidth={FORBID_STROKE} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={FORBID_SLASH} stroke={t.colors.text} strokeWidth={FORBID_STROKE} strokeLinecap="round" />
    </Svg>
  );
}

/** Строка запрета: иконка в белом круге 40 (как у блока с иконкой) и фрагмент текста шага. Иконку скринридер не читает. */
function ForbidRule({ kind, label }: { kind: keyof typeof FORBID_PATHS; label: string }) {
  const t = useParentTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: parentCard.iconGap }}>
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{ width: parentCard.icon, height: parentCard.icon, borderRadius: parentCard.icon / 2, backgroundColor: t.colors.card, alignItems: 'center', justifyContent: 'center' }}
      >
        <ForbidIcon kind={kind} />
      </View>
      <View style={{ flex: 1 }}>
        <ParentText role="label">{label}</ParentText>
      </View>
    </View>
  );
}

/**
 * Врезка-пример низа экрана занятия: лист `zone` с кромкой `edge` 2 по верху и скруглением верха листа
 * (`abaAdultSheet`). Не `Pressable` и без кнопок: названия «Была подсказка» и «Отказ» — обычный текст в кавычках
 * (берутся из подписей панели, чтобы не разойтись с настоящими кнопками). Для скринридера — один текстовый блок.
 */
function PanelExample() {
  const { t } = useTranslation();
  const th = useParentTheme();
  return (
    <View
      accessible
      accessibilityRole="text"
      testID="aba-intro-panel-example"
      style={{
        backgroundColor: th.colors.zone,
        borderTopWidth: abaAdultSheet.edge,
        borderTopColor: th.colors.edge,
        borderTopLeftRadius: abaAdultSheet.radius,
        borderTopRightRadius: abaAdultSheet.radius,
        paddingHorizontal: parentCard.blockPad,
        paddingVertical: parentCard.padY,
        gap: parentSpacing.xs,
      }}
    >
      <ParentText role="caption">{t('parent.aba.intro.panelExample')}</ParentText>
      <ParentText role="body" testID="aba-intro-panel-names">
        {t('parent.aba.intro.panelNames', { prompted: t('abaPanel.prompted'), refused: t('abaPanel.refused') })}
      </ParentText>
    </View>
  );
}

export default function AbaIntroScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const accountId = useAccount((s) => s.accountId);
  const [step, setStep] = useState(1);

  // сборка «только ABA»: если вернуться некуда — на «Занятия ABA», а не в пустоту (как правка 7)
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/parent/aba'));
  const done = () => {
    if (accountId) {
      // флаг не держит взрослого: не записался — введение покажется ещё раз, это безвредно
      void markAbaIntroSeen(device(), accountId).catch((e: unknown) => {
        if (__DEV__) console.warn('aba-intro', e);
      });
    }
    leave();
  };

  const last = step === ABA_INTRO_STEPS;
  const doer = step === 2;
  return (
    <ParentScreen
      title={t('parent.aba.intro.title')}
      scroll
      left={<ParentButton variant="quiet" label={t('parent.back')} onPress={leave} block={false} testID="aba-intro-close" />}
      testID="parent-aba-intro"
    >
      <View style={{ gap: parentSpacing.lg, paddingTop: parentSpacing.lg }}>
        <ParentText role="caption" color="textMuted" testID="aba-intro-counter">
          {t('parent.aba.intro.counter', { n: step, of: ABA_INTRO_STEPS })}
        </ParentText>
        <View>
          <Card tone={INTRO_STEP_TONE[step]} testID={`aba-intro-step-${step}`} style={doer ? { marginBottom: parentSpacing.md } : undefined}>
            <View style={{ gap: parentSpacing.md }}>
              <ParentText role="title" accessibilityRole="header">
                {t(`parent.aba.intro.step${step}Title`)}
              </ParentText>
              {doer ? (
                <View style={{ gap: parentSpacing.sm }} testID="aba-intro-rules">
                  <ForbidRule kind="point" label={t('parent.aba.intro.ruleNoPoint')} />
                  <ForbidRule kind="talk" label={t('parent.aba.intro.ruleNoTalk')} />
                </View>
              ) : null}
              <ParentText role="body">{t(`parent.aba.intro.step${step}`)}</ParentText>
            </View>
          </Card>
          {doer ? <PanelExample /> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: parentSpacing.md }}>
          <View style={{ flex: 1 }}>
            {step > 1 ? (
              <ParentButton variant="secondary" label={t('parent.aba.intro.back')} onPress={() => setStep((s) => s - 1)} testID="aba-intro-back" />
            ) : null}
          </View>
          <View style={{ flex: 1 }}>
            <ParentButton
              label={t(last ? 'parent.aba.intro.done' : 'parent.aba.intro.next')}
              onPress={() => (last ? done() : setStep((s) => s + 1))}
              testID={last ? 'aba-intro-done' : 'aba-intro-next'}
            />
          </View>
        </View>
      </View>
    </ParentScreen>
  );
}
