/**
 * Первый запуск: выбор профиля (DESIGN_PROMPTS.md 1.1; docs/design/slice-screens-2026-10-24.md §1).
 *
 * Чистая установка: профилей нет, поэтому на экране одна пунктирная карточка «+ Добавить» (путь
 * взрослого → родительский раздел за PIN) и единственная `primary` — «Попробовать без сохранения» (путь
 * ребёнка, №130). С аккаунтом на устройстве (этап 10) — карточки детей и «+ Добавить»; кнопки без записи
 * нет вовсе (PARENT.md п. 5): состав меняется, стиль — нет. Тап по карточке читает прогресс ребёнка через
 * порт и открывает сеанс с записью; при устаревшем тексте согласия сначала — повторное согласие.
 * Полоса в режиме без записи — `5-6`, меняет только взрослый (№142). Бюджет высоты на SE — 616
 * (`firstRunHeight`), экран не прокручивается. В focus Tali убран, состав остальной тот же.
 *
 * Порядок (docs/design/atlas-firstrun-2026-10-31.md D3): Tali → заголовок → «Попробовать без сохранения» →
 * подпись → карточки (дети 160, «+» 120 последним, по нижнему краю) → «Для взрослых». «+» открывает PIN только
 * вторым тапом в `firstRun.adultSecondTapMs`: первый — голос «Позови взрослого» и покачивание замка.
 *
 * Сборка «только ABA» (`ABA_ONLY`, «Тихий кабинет» №203, спецификация п. «г» 7) — свой вид того же состава: фон
 * `abaColors.background`, за Tali круг `blockExplain` (в calm круга нет), Tali всегда в позе `hello` — ни на что не
 * указывает, в том числе после тапа по «+»; касание Tali повторяет «Позови взрослого». «+» — взрослый тон `zone`,
 * кромка 2 `edge`, без борта, замок 36 (`abaFirstRun`); текст — Golos (`AbaText`). Детские карточки профилей и
 * обычный режим не меняются.
 */
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { Animated, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { adultI18n } from '../src/i18n';
import { useDesign } from '../src/design';
import { abaColors, abaFirstRun, abaTypography } from '../src/design/abaTokens';
import { parentColors, parentTypography } from '../src/design/parentTokens';
import { firstRun, icon, pressScale, profileCard, taliSize } from '../src/design/tokens';
import { uuidV4 } from '../src/domain/ids';
import type { InterfaceLang } from '../src/domain/regionVisibility';
import { ABA_ONLY } from '../src/services/buildScope';
import type { ChildProfile } from '../src/services/local/profiles';
import { randomBytes } from '../src/services/random';
import { voice } from '../src/services/voice';
import { useAccount } from '../src/state/account';
import { useChildSession } from '../src/state/childSession';
import { useParentView } from '../src/state/parentView';
import { progressPort } from '../src/state/port';
import { AppText } from '../src/ui/AppText';
import { CushionPressable } from '../src/ui/CushionPressable';
import { Icon } from '../src/ui/Icon';
import { ProfileCard } from '../src/ui/ProfileCard';
import { Screen } from '../src/ui/Screen';
import { TaliFigure } from '../src/ui/TaliFigure';
import { AbaText } from '../src/ui/aba/AbaText';

/** На web нативного драйвера анимаций нет — RN предупреждает на каждом касании. */
const NATIVE_DRIVER = Platform.OS !== 'web';

/** Выбор профиля и первый запуск — на языке устройства (№190): сессии ребёнка здесь ещё нет или она сменится. */
export default function FirstRunScreen() {
  return (
    <I18nextProvider i18n={adultI18n()}>
      <FirstRun />
    </I18nextProvider>
  );
}

function FirstRun() {
  const theme = useDesign();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const startNoRecordSession = useChildSession((s) => s.startNoRecordSession);
  const startAccountSession = useChildSession((s) => s.startAccountSession);
  const accountStatus = useAccount((s) => s.status);
  const profiles = useAccount((s) => s.profiles);
  const consent = useAccount((s) => s.consent);
  const opening = useRef(false);
  const hasAccount = accountStatus === 'ready';
  /**
   * Нужен взрослый, а ребёнку нечем ответить на «Кто сегодня исследует?»: аккаунт без профилей (вопрос 93) или
   * аккаунт не открылся (`error`, Ж1). Заголовок и голос — «Позови взрослого», Tali указывает на «+».
   */
  const adultNeeded = (hasAccount && profiles.length === 0) || accountStatus === 'error';
  // в сборке «только ABA» (№195) ребёнку здесь нечего выбрать самому — сразу «Позови взрослого» (`child-ux-specialist`)
  const titleKey = adultNeeded || ABA_ONLY ? 'firstRun.callAdult' : 'firstRun.title';
  const [taliPose, setTaliPose] = useState<'hello' | 'point'>('hello');
  const poseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    voice.say(titleKey);
  }, [titleKey]);
  useEffect(
    () => () => {
      if (poseTimer.current) clearTimeout(poseTimer.current);
    },
    [],
  );

  const openAdult = (sayKey: string, href: '/parent' | '/parent/profile/new' | '/parent/aba') => {
    voice.say(sayKey);
    router.push(href);
  };

  // «+»: первый тап — голос «Позови взрослого» и покачивание замка; PIN — вторым тапом в `adultSecondTapMs` (UX этапа D).
  const adultTapAt = useRef(0);
  const [nudgeKey, setNudgeKey] = useState(0);
  const tapAdd = () => {
    const now = Date.now();
    const since = now - adultTapAt.current;
    if (adultTapAt.current > 0 && since < firstRun.adultSecondTapMs) {
      // второй тап раньше `adultSecondTapMinMs` не считается и перезапускает окно: стук без паузы не пройдёт,
      // взрослый тапает с паузой (Ж8, `child-ux-specialist` по диффу)
      if (since < firstRun.adultSecondTapMinMs) {
        adultTapAt.current = now;
        return;
      }
      adultTapAt.current = 0;
      router.push(hasAccount ? '/parent/profile/new' : '/parent');
      return;
    }
    adultTapAt.current = now;
    voice.say('firstRun.callAdult');
    setNudgeKey((k) => k + 1);
    // в сборке ABA Tali ни на что не указывает (№203): отклик первого тапа — голос и выросший замок
    if (ABA_ONLY) return;
    // видимый отклик первого тапа: Tali указывает на «+», пока держится выросший замок
    setTaliPose('point');
    if (poseTimer.current) clearTimeout(poseTimer.current);
    poseTimer.current = setTimeout(() => setTaliPose('hello'), firstRun.lockNudge.holdMs);
  };

  const tryWithoutSaving = () => {
    startNoRecordSession({ childId: uuidV4(randomBytes), now: new Date(), interfaceLang: i18n.language as InterfaceLang });
    router.replace('/map');
  };

  const openProfile = async (profile: ChildProfile) => {
    if (opening.current) return;
    // сборка «только ABA» (№195): обычного режима нет — ребёнок зовёт взрослого, после PIN сразу «Занятия ABA»
    // именно этого ребёнка, а не главная раздела с первым профилем (`child-ux-specialist`)
    if (ABA_ONLY) {
      useParentView.getState().select(profile.childId);
      openAdult('firstRun.callAdult', '/parent/aba');
      return;
    }
    if (consent === 'outdated') {
      router.push('/parent/reconsent');
      return;
    }
    opening.current = true;
    try {
      const snapshot = await progressPort().load(profile.childId);
      startAccountSession({ profile, snapshot, now: new Date() });
      router.replace('/map');
    } finally {
      opening.current = false;
    }
  };

  const cardGap = theme.calmMode || theme.focusMode ? theme.spacing.xl : profileCard.gap;
  const addLabel = `${t('a11y.addProfile')}. ${t('firstRun.adultOnly')}`;
  const cards = (
    <>
      {profiles.map((p, i) => {
        const name = p.name || t('profile.unnamed', { n: i + 1 });
        return <ProfileCard key={p.childId} kind="profile" name={name} mark={p.name ? undefined : String(i + 1)} onPress={() => void openProfile(p)} accessibilityLabel={name} testID={`profile-${i + 1}`} />;
      })}
      {ABA_ONLY ? <AbaAddCard nudgeKey={nudgeKey} onPress={tapAdd} accessibilityLabel={addLabel} /> : <ProfileCard kind="add" nudgeKey={nudgeKey} onPress={tapAdd} accessibilityLabel={addLabel} />}
    </>
  );
  const profileRow =
    profiles.length > 1 ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: cardGap, paddingHorizontal: theme.spacing.lg, alignItems: 'flex-end' }} style={{ marginHorizontal: -theme.spacing.lg, flexGrow: 0 }} testID="profile-row">
        {cards}
      </ScrollView>
    ) : (
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: cardGap }} testID="profile-row">
        {cards}
      </View>
    );

  if (ABA_ONLY) {
    return <AbaFirstRunView titleKey={titleKey} profileRow={profileRow} onAdults={() => openAdult('firstRun.forAdults', '/parent')} />;
  }

  return (
    <Screen testID="first-run">
      <View style={{ height: theme.spacing.lg }} />
      {!theme.focusMode && (
        <View style={{ alignItems: 'center' }}>
          <TaliFigure pose={adultNeeded ? 'point' : taliPose} size={taliSize.hero} onPress={() => voice.say(titleKey)} accessibilityLabel={t('a11y.tali')} />
        </View>
      )}
      <View style={{ height: theme.spacing.lg }} />
      <View style={{ height: theme.typography.title.lineHeight * 2, justifyContent: 'center' }}>
        <AppText role="title" fit="title" align="center" accessibilityRole="header" testID="first-run-title">
          {t(titleKey)}
        </AppText>
      </View>
      <View style={{ height: theme.spacing.xl }} />
      {/* Детская кнопка — сразу под заголовком, выше взрослой карточки «+» (`firstRun.childActionFirst`) */}
      {/* при `error` аккаунт есть: яркая кнопка спорила бы с голосом «Позови взрослого»; при `loading` не мелькает */}
      {!ABA_ONLY && !hasAccount && accountStatus !== 'error' && accountStatus !== 'loading' && (
        <>
          <CushionPressable
            role="control"
            width="100%"
            height={theme.touch.primary}
            radius={theme.radii.lg}
            fill="primary"
            guardMs={theme.motion.slow}
            onPress={tryWithoutSaving}
            accessibilityLabel={t('firstRun.tryWithoutSaving')}
            testID="try-without-saving"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <Icon name="arrow" color="onPrimary" />
              <AppText role="label" color="onPrimary" cap="action" lines={1}>
                {t('firstRun.tryWithoutSaving')}
              </AppText>
            </View>
          </CushionPressable>
          <View style={{ height: theme.spacing.sm }} />
          <AppText role="caption" color="textMuted" align="center" lines={1}>
            {t('firstRun.noSaveNote')}
          </AppText>
          <View style={{ height: theme.spacing.xl }} />
        </>
      )}
      {profileRow}
      <View style={{ flex: 1, minHeight: theme.spacing.xl }} />
      <CushionPressable
        role="tali"
        width="100%"
        height={firstRun.adultEntryHit}
        radius={theme.radii.md}
        fill="background"
        outlineColor="background"
        guardMs={theme.motion.slow}
        onPress={() => openAdult('firstRun.forAdults', '/parent')}
        accessibilityLabel={t('firstRun.forAdults')}
        testID="for-adults"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Icon name="lock" size={firstRun.adultIcon} color="textMuted" />
          <AppText role="caption" color="textMuted">
            {t('firstRun.forAdults')}
          </AppText>
        </View>
      </CushionPressable>
    </Screen>
  );
}

/**
 * Сборка «только ABA» (№203): тот же состав и бюджет высоты (`firstRunHeight`), что у обычного первого запуска, но
 * палитра ABA вместо детской темы — поэтому свой холст вместо `Screen` (его фон — `colors.background` детской темы).
 * Порядок: Tali на круге → «Позови взрослого» → карточки → «Для взрослых».
 */
function AbaFirstRunView({ titleKey, profileRow, onAdults }: { titleKey: string; profileRow: ReactNode; onAdults: () => void }) {
  const theme = useDesign();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const c = abaColors[theme.scheme];
  const p = parentColors[theme.scheme];
  const halo = taliSize.hero + abaFirstRun.taliHalo * 2;
  // защита от двойного тапа, как `guardMs` у детской подушки: второй переход в стек не ложится
  const adultsAt = useRef(0);
  const pressAdults = () => {
    const now = Date.now();
    if (now - adultsAt.current < theme.motion.slow) return;
    adultsAt.current = now;
    onAdults();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }} testID="first-run">
      <View style={{ height: insets.top }} />
      <View style={{ flex: 1, paddingHorizontal: theme.spacing.lg, paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }}>
        <View style={{ height: theme.spacing.lg }} />
        {!theme.focusMode && (
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: taliSize.hero, height: taliSize.hero }}>
              {/* круг неба — декор, касание проходит к Tali; в calm его нет (№203) */}
              {!theme.calmMode && (
                <View
                  pointerEvents="none"
                  style={{ position: 'absolute', top: -abaFirstRun.taliHalo, left: -abaFirstRun.taliHalo, width: halo, height: halo, borderRadius: halo / 2, backgroundColor: p.blockExplain }}
                  testID="first-run-tali-halo"
                />
              )}
              <TaliFigure pose="hello" size={taliSize.hero} onPress={() => voice.say(titleKey)} accessibilityLabel={t('a11y.tali')} />
            </View>
          </View>
        )}
        <View style={{ height: theme.spacing.lg }} />
        <View style={{ height: theme.typography.title.lineHeight * 2, justifyContent: 'center' }}>
          <AbaText type={abaTypography.title} color={c.ink} max={1.2} lines={2} style={{ textAlign: 'center' }} accessibilityRole="header" testID="first-run-title">
            {t(titleKey)}
          </AbaText>
        </View>
        <View style={{ height: theme.spacing.xl }} />
        {profileRow}
        <View style={{ flex: 1, minHeight: theme.spacing.xl }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('firstRun.forAdults')}
          onPress={pressAdults}
          // видимый отклик на нажатие (child-ux-specialist, проверка №203): без него взрослый жмёт ещё раз
          style={({ pressed }) => ({ height: firstRun.adultEntryHit, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, opacity: pressed ? abaFirstRun.pressedOpacity : 1 })}
          testID="for-adults"
        >
          <Icon name="lock" size={firstRun.adultIcon} color="textMuted" tint={p.textMuted} outline={c.ink} />
          <AbaText type={parentTypography.caption} color={p.textMuted} max={1.3} lines={1}>
            {t('firstRun.forAdults')}
          </AbaText>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * «+ Для взрослых» в сборке ABA (№203): взрослый тон `zone`, кромка `edge` 2, без борта и подушки — ничто не зовёт
 * ребёнка нажать; плюс и подпись чернилами, замок 36 (белый с контуром чернил) в правом верхнем углу. Смена
 * `nudgeKey` — покачивание и рост замка в той же пропорции, что у обычной карточки (`lockNudge.to / addBadge`); при
 * `still` — без движения. Размер и правило второго тапа — как у обычной (`profileCard.addSize`, экран).
 */
function AbaAddCard({ nudgeKey, onPress, accessibilityLabel }: { nudgeKey: number; onPress: () => void; accessibilityLabel: string }) {
  const theme = useDesign();
  const { t } = useTranslation();
  const c = abaColors[theme.scheme];
  const p = parentColors[theme.scheme];
  const shake = useRef(new Animated.Value(0)).current;
  const lockScale = useRef(new Animated.Value(1)).current;
  const seenNudge = useRef(nudgeKey);

  useEffect(() => {
    if (seenNudge.current === nudgeKey) return undefined;
    seenNudge.current = nudgeKey;
    const peak = firstRun.lockNudge.to / profileCard.addBadge;
    if (theme.still) {
      lockScale.setValue(peak);
      const id = setTimeout(() => lockScale.setValue(1), firstRun.lockNudge.holdMs);
      return () => clearTimeout(id);
    }
    const step = theme.motion.quick / 4;
    const to = (v: number) => Animated.timing(shake, { toValue: v, duration: step, useNativeDriver: NATIVE_DRIVER });
    Animated.parallel([
      Animated.sequence([to(-1), to(1), to(-1), to(0)]),
      Animated.sequence([
        Animated.timing(lockScale, { toValue: peak, duration: theme.motion.quick, useNativeDriver: NATIVE_DRIVER }),
        Animated.delay(firstRun.lockNudge.holdMs),
        Animated.timing(lockScale, { toValue: 1, duration: theme.motion.quick, useNativeDriver: NATIVE_DRIVER }),
      ]),
    ]).start();
    return undefined;
  }, [nudgeKey, shake, lockScale, theme.still, theme.motion.quick]);

  const bar = { backgroundColor: c.ink, borderRadius: theme.stroke.base / 2 } as const;
  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-theme.spacing.xs, theme.spacing.xs] });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        width: profileCard.addSize,
        height: profileCard.addSize,
        borderRadius: theme.radii.lg,
        backgroundColor: p.zone,
        borderWidth: abaFirstRun.addEdge,
        borderColor: p.edge,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pressed ? pressScale.wide : 1 }],
      })}
      testID="profile-add"
    >
      <Animated.View style={{ position: 'absolute', top: profileCard.addBadgeInset, right: profileCard.addBadgeInset, transform: [{ translateX }, { scale: lockScale }], transformOrigin: 'top right' }} testID="profile-add-lock">
        <Icon name="lock" size={abaFirstRun.addLock} color="surface" tint={p.card} outline={c.ink} testID="profile-add-lock-icon" />
      </Animated.View>
      <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
        <View style={{ width: icon.size, height: icon.size, alignItems: 'center', justifyContent: 'center' }} testID="profile-add-plus">
          <View style={[{ position: 'absolute', width: icon.size, height: theme.stroke.base * 2 }, bar]} />
          <View style={[{ position: 'absolute', height: icon.size, width: theme.stroke.base * 2 }, bar]} />
        </View>
        <AbaText type={parentTypography.caption} color={p.text} max={1.2} lines={1} adjustsFontSizeToFit minimumFontScale={abaFirstRun.addLabelMinScale} style={{ textAlign: 'center' }}>
          {t(firstRun.adultCardLabelKey)}
        </AbaText>
      </View>
    </Pressable>
  );
}
