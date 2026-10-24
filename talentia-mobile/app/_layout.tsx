/**
 * Корень приложения (этап 9, срез детского режима).
 *
 * Порядок: i18n без запасного языка — один раз при загрузке модуля; шрифты из бандла под
 * заставкой; жесты (лента карты); тема из настроек сеанса ребёнка (calm / focus — их меняет
 * взрослый или детский лист, не провайдер); стек без системных заголовков и без свайпа «назад» —
 * выход из урока только через слой подтверждения (SCREENS.md 1.6).
 */
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DesignProvider } from '../src/design';
import { deviceLang, initI18n } from '../src/i18n';
import { useChildSession } from '../src/state/childSession';
import { FONT_FILES } from '../src/ui/fonts';

initI18n({ lng: deviceLang() });
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsReady, fontError] = useFonts(FONT_FILES);
  const calmMode = useChildSession((s) => s.settings.calmMode);
  const focusMode = useChildSession((s) => s.settings.focusMode);

  useEffect(() => {
    if (fontsReady || fontError) void SplashScreen.hideAsync();
  }, [fontsReady, fontError]);

  if (!fontsReady && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DesignProvider calmMode={calmMode} focusMode={focusMode}>
        <Stack screenOptions={{ headerShown: false, gestureEnabled: false, animation: calmMode ? 'none' : 'default' }} />
      </DesignProvider>
    </GestureHandlerRootView>
  );
}
