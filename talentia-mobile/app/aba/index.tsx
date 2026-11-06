/**
 * Гейт окна перед занятием ABA (этап G1, вопрос 59; `docs/design/parent-aba-2026-11-01.md` «Что видит ребёнок после
 * „Начать“»). Интерфейса нет: режим и «кто ведёт» взрослый выбрал на `parent/aba`, сюда приходят с готовым
 * `useAbaRun.config`. Песочный фон `c.background` с первого кадра — родительская бумага ребёнку не показывается.
 * Окончательная проверка окна (`abaWindowPolicy`, `abaTierFor` по `onLayout`): тир есть — `replace` в сопряжение или
 * сессию по параметру `mode`; `null` — экран «слишком мал» взрослому с кнопками 56 (`belowMinButtonHeight`), окно
 * выросло — экран пропускает сам. Без конфигурации (пришли не через родителя) — к родителю.
 */
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { abaTierFor, abaWindowPolicy } from '../../src/design/abaTokens';
import { useAbaRun } from '../../src/state/abaRun';
import { useAbaColors } from '../../src/ui/aba/parts';
import { ParentButton } from '../../src/ui/parent/primitives';
import { ParentThemeProvider } from '../../src/ui/parent/theme';

export default function AbaGateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const c = useAbaColors();
  const insets = useSafeAreaInsets();
  const config = useAbaRun((s) => s.config);
  const [height, setHeight] = useState<number | null>(null);

  const tier = height === null ? 'pending' : abaTierFor(height, insets.bottom);
  const next = mode === 'pairing' ? '/aba/pairing' : '/aba/session';

  useEffect(() => {
    if (config !== null && tier !== 'pending' && tier !== null) router.replace(next);
  }, [config, tier, next, router]);

  if (config === null) return <Redirect href="/parent/aba" />;

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top, paddingBottom: insets.bottom }} testID="aba-config">
      <View style={{ flex: 1, paddingHorizontal: 16 }} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        {tier === null ? (
          <View style={{ flex: 1, justifyContent: 'center', gap: abaWindowPolicy.belowMinButtonGap }} testID="aba-too-small">
            <Text style={{ color: c.ink, fontSize: 20, fontWeight: '700' }}>{t('abaSession.tooSmallTitle')}</Text>
            <Text style={{ color: c.ink, fontSize: 16 }}>{t('abaSession.tooSmallBody')}</Text>
            <ParentThemeProvider>
              <ParentButton height={abaWindowPolicy.belowMinButtonHeight} label={t('abaSession.regularLessons')} onPress={() => router.replace('/map')} testID="aba-regular" />
              <ParentButton height={abaWindowPolicy.belowMinButtonHeight} variant="secondary" label={t('abaSession.back')} onPress={() => router.replace('/parent/aba')} testID="aba-too-small-back" />
            </ParentThemeProvider>
          </View>
        ) : null}
      </View>
    </View>
  );
}
