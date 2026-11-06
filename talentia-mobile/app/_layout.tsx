/**
 * Корень приложения (этап 9–10).
 *
 * Порядок: i18n без запасного языка — один раз при загрузке модуля; аккаунт с устройства (база,
 * срок хранения, порт прогресса); шрифты из бандла под заставкой; жесты (лента карты); тема из
 * настроек сеанса ребёнка; стек без системных заголовков и без свайпа «назад». Родительский раздел —
 * группа `parent` как полноэкранная модалка: вход «как разрыв» (PARENT.md «Визуальный язык»).
 */
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DesignProvider } from '../src/design';
import { deviceLang, initI18n } from '../src/i18n';
import { expoSoundPlayer } from '../src/services/audioPlayer';
import { installNetworkFuse, networkFuseEnabled } from '../src/services/networkFuse';
import { createAudioVoice, setVoiceBackend } from '../src/services/voice';
import { useAccount } from '../src/state/account';
import { useChildSession } from '../src/state/childSession';
import { FONT_FILES } from '../src/ui/fonts';

// сеть закрыта до ворот «данные» (ментор П2): вне dev-сборки — с первого модуля корня
if (networkFuseEnabled(__DEV__)) installNetworkFuse();
initI18n({ lng: deviceLang() });
// голос и звуки — файлы из сборки (№158); ключ без файла молчит
setVoiceBackend(createAudioVoice(expoSoundPlayer()));
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsReady, fontError] = useFonts(FONT_FILES);
  const calmMode = useChildSession((s) => s.settings.calmMode);
  const focusMode = useChildSession((s) => s.settings.focusMode);
  const accountStatus = useAccount((s) => s.status);
  const boot = useAccount((s) => s.boot);

  useEffect(() => {
    void boot().catch((e: unknown) => {
      // Битая база или устройство: ребёнок получает режим без записи, причина видна в консоли разработчика.
      if (__DEV__) console.warn('boot', e);
      useAccount.getState().clear();
    });
  }, [boot]);

  const ready = (fontsReady || fontError) && accountStatus !== 'loading';
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DesignProvider calmMode={calmMode} focusMode={focusMode}>
        <Stack screenOptions={{ headerShown: false, gestureEnabled: false, animation: calmMode ? 'none' : 'default' }}>
          <Stack.Screen name="parent" options={{ presentation: 'fullScreenModal', animation: 'fade', animationDuration: 140, gestureEnabled: false }} />
        </Stack>
      </DesignProvider>
    </GestureHandlerRootView>
  );
}
