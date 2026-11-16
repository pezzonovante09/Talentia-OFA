/**
 * «Как проходят занятия» — введение для взрослого перед первым занятием (решение владельца №202, вопрос 116). Четыре
 * шага: что будет, что делает взрослый, что делает ребёнок, жетоны и выход. Тексты проверил `aba-pedagogy-specialist`
 * 2026-11-16: они не описывают ответ ребёнку и не подталкивают взрослого помогать во время пробы.
 *
 * Экран внутри группы `/parent` — за PIN-гейтом. «Понятно» отмечает введение просмотренным (`abaIntro.ts`) и
 * возвращает на «Занятия ABA»; начать занятие взрослый нажимает сам — «Кто ведёт» и старт остаются в одном месте.
 * Повторно введение открывается строкой «Как проходят занятия» в карточке «Где мы сейчас».
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { parentSpacing } from '../../../src/design/parentTokens';
import { markAbaIntroSeen } from '../../../src/services/local/abaIntro';
import { useAccount } from '../../../src/state/account';
import { device } from '../../../src/state/device';
import { Card, ParentButton, ParentScreen, ParentText } from '../../../src/ui/parent/primitives';

const ABA_INTRO_STEPS = 4;

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
        <Card title={t(`parent.aba.intro.step${step}Title`)} testID={`aba-intro-step-${step}`}>
          <ParentText role="body">{t(`parent.aba.intro.step${step}`)}</ParentText>
        </Card>
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
