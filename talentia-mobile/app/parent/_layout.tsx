/**
 * Группа родительского раздела (дизайн-док §0): своя тема, свой стек. Гейт уровня 1 — не роут, а
 * слой: пока раздел закрыт, вместо экранов рендерится PIN, deep-link его не обходит. Уход в фон и
 * две минуты бездействия закрывают раздел; выход из раздела («Готово», создание профиля — размонтирование
 * группы) закрывает его тоже, иначе ребёнок с карты попадал бы внутрь в двухминутном окне. Без аккаунта
 * открыта только первая настройка; при устаревшем тексте согласия — только повторное согласие и удаление.
 * Полуаккаунт (PIN придуман, согласия `account_local` нет, первая настройка покинута) вне её экранов
 * стирается до гейта, как на старте (`boot`), и раздел ведёт на первую настройку (вопрос 92): данных ребёнка
 * в нём нет, а без согласия ни профиль, ни повторное согласие по ссылке ему не положены.
 */
import { Redirect, Stack, usePathname, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Platform, Pressable, View } from 'react-native';

import { checkPin } from '../../src/services/local/account';
import { sha256 } from '../../src/services/digest';
import { useAccount } from '../../src/state/account';
import { device } from '../../src/state/device';
import { useGate } from '../../src/state/gate';
import { PinPad } from '../../src/ui/parent/PinPad';
import { ParentButton, ParentIcon, ParentScreen, ParentText } from '../../src/ui/parent/primitives';
import { ParentThemeProvider } from '../../src/ui/parent/theme';
import { gateAvailable } from '../../src/domain/parentGate';

// `confirm/delete_account` и `done` — пока удаление в полёте: аккаунт уже стёрт, а переход на «Удалено» ещё не
// произошёл. При живом аккаунте они за гейтом, как всё остальное (контрольный аудит 2026-11-09, приватность п. 8).
const OPEN_WITHOUT_ACCOUNT = ['/parent/setup', '/parent/policy', '/parent/done', '/parent/confirm/delete_account'];
const OPEN_WITH_ACCOUNT_UNGATED = ['/parent/setup', '/parent/policy'];
const OPEN_WHEN_OUTDATED = ['/parent/reconsent', '/parent/policy', '/parent/confirm/delete_account', '/parent/done'];

/** Аккаунт есть, открыть не вышло (`status: 'error'`, Ж1): не первая настройка, а «Повторить» — данные не трогаются. */
function BootError() {
  const { t } = useTranslation();
  const router = useRouter();
  const boot = useAccount((s) => s.boot);
  const [busy, setBusy] = useState(false);
  return (
    <ParentScreen scroll={false} left={<ParentButton variant="quiet" label={t('parent.close')} onPress={() => router.dismissAll()} testID="boot-error-close" block={false} />} testID="parent-boot-error">
      <View style={{ paddingTop: 24, gap: 16 }}>
        <ParentText role="heading" accessibilityRole="header">
          {t('parent.bootError.title')}
        </ParentText>
        <ParentText role="body">{t('parent.bootError.body')}</ParentText>
        <ParentButton
          label={t('parent.bootError.retry')}
          disabled={busy}
          testID="boot-error-retry"
          onPress={async () => {
            setBusy(true);
            try {
              await boot();
            } catch (e) {
              if (__DEV__) console.warn('boot', e);
              useAccount.getState().fail();
            } finally {
              setBusy(false);
            }
          }}
        />
      </View>
    </ParentScreen>
  );
}

/**
 * «Закрыть» на экране PIN — иконка в зоне 48, не только слово: нечитающий ребёнок, попавший сюда с карты, иначе
 * жмёт цифры и за 30 тапов блокирует вход родителю на 1 → 5 → 15 минут (контрольный аудит 2026-11-09, Ж8).
 */
function GateClose({ onPress, testID }: { onPress: () => void; testID: string }) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('parent.close')}
      hitSlop={4}
      style={({ pressed }) => ({ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
      testID={testID}
    >
      <ParentIcon name="x" />
    </Pressable>
  );
}

function Gate() {
  const router = useRouter();
  const accountId = useAccount((s) => s.accountId);
  const open = useGate((s) => s.open);
  const { t } = useTranslation();
  return (
    <ParentScreen scroll={false} left={<GateClose onPress={() => router.dismissAll()} testID="gate-close" />} testID="parent-gate">
      <View style={{ paddingTop: 24 }}>
        <PinPad
          title={t('parent.pin.title')}
          hint={t('parent.pin.hint')}
          testID="gate-pin"
          onComplete={async (pin) => {
            if (!accountId) return { result: 'wrong' };
            const r = await checkPin(device(), accountId, pin, { digest: sha256, now: Date.now() });
            if (r.result === 'ok') {
              open();
              return { result: 'ok' };
            }
            if (r.result === 'locked') return { result: 'locked', lockedUntil: r.lockedUntil };
            return { result: 'wrong', attemptsLeft: Math.max(0, 5 - r.lockout.failures) };
          }}
        />
      </View>
    </ParentScreen>
  );
}

/** Полуаккаунт вне первой настройки: стереть один раз; «Закрыть» — если стирание не удалось. */
function HalfAccount() {
  const { t } = useTranslation();
  const router = useRouter();
  const abandonSetup = useAccount((s) => s.abandonSetup);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    abandonSetup().catch((e: unknown) => {
      if (__DEV__) console.warn('half-account', e);
    });
  }, [abandonSetup]);
  return <ParentScreen scroll={false} left={<ParentButton variant="quiet" label={t('parent.close')} onPress={() => router.dismissAll()} testID="half-account-close" block={false} />} testID="parent-half-account" />;
}

function Guarded() {
  const status = useAccount((s) => s.status);
  const consent = useAccount((s) => s.consent);
  const pathname = usePathname();
  const session = useGate((s) => s.session);
  const lock = useGate((s) => s.lock);
  const touch = useGate((s) => s.touch);
  const [, tick] = useState(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') lock();
    });
    const id = setInterval(() => tick((n) => n + 1), 15_000);
    return () => {
      sub.remove();
      clearInterval(id);
      lock();
    };
  }, [lock]);

  if (!gateAvailable(Platform.OS)) {
    // Web: раздел, который нельзя защитить, не показывается (PARENT.md «Гейт»). В Expo Web-прототипе
    // гейт всё же рисуется — это ворота прототипа, не выпуск.
  }
  if (status === 'loading') return <View style={{ flex: 1 }} />;
  if (status === 'error') return <BootError />;
  const setupRoute = (status === 'ready' ? OPEN_WITH_ACCOUNT_UNGATED : OPEN_WITHOUT_ACCOUNT).includes(pathname);
  if (status === 'ready' && consent === 'not_asked' && !setupRoute) return <HalfAccount />;
  if (status === 'none' && !setupRoute) return <Redirect href="/parent/setup" />;
  const unlocked = status === 'ready' && useGate.getState().unlocked();
  if (status === 'ready' && !unlocked && !setupRoute) return <Gate />;
  void session;
  if (status === 'ready' && consent === 'outdated' && !OPEN_WHEN_OUTDATED.includes(pathname)) return <Redirect href="/parent/reconsent" />;
  return (
    <View style={{ flex: 1 }} onTouchStart={() => touch()}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 140, gestureEnabled: false }} />
    </View>
  );
}

export default function ParentLayout() {
  return (
    <ParentThemeProvider>
      <Guarded />
    </ParentThemeProvider>
  );
}
