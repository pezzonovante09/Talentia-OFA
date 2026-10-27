/**
 * 2.6 — «со взрослым / сам» (направление §2, Ц2.3). Корень — окончательная проверка окна (`abaWindowPolicy`,
 * `abaTierFor` по `onLayout`): `null` — экран «слишком мал» взрослому, дальше ребёнок не идёт; окно выросло — экран
 * пропускает сам. «Со взрослым» → лист «Кто ведёт» (роль и «обучен», без имени; предвыбор прошлой сессии; лист не
 * принимает касаний 500 мс от последнего отпускания — `abaWhoLeadsAccepts`; «Начать» листа в шапке).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { abaTierFor, abaWhoLeadsAccepts, abaWhoLeadsSheet, ABA_CONTROL_STROKE } from '../../src/design/abaTokens';
import { parentSpacing } from '../../src/design/parentTokens';
import { radii, touch } from '../../src/design/tokens';
import { newAbaId } from '../../src/services/abaIds';
import { loadChildState } from '../../src/services/local/childState';
import { setAbaObservers } from '../../src/services/local/commit';
import { useAbaRun } from '../../src/state/abaRun';
import { useAccount } from '../../src/state/account';
import { useChildSession } from '../../src/state/childSession';
import type { AbaConfig, AbaObserver } from '../../src/types/aba';
import { useAbaClock } from '../../src/ui/aba/clock';
import { ChildPressable, ExitHold, useAbaColors } from '../../src/ui/aba/parts';
import { ParentButton, ParentText, Row } from '../../src/ui/parent/primitives';
import { ParentThemeProvider, useParentTheme } from '../../src/ui/parent/theme';

const ROLES: AbaObserver['role'][] = ['specialist', 'parent', 'other_adult'];

function Figures({ n, color }: { n: 1 | 2; color: string }) {
  return (
    <Svg width={128} height={128} viewBox="0 0 128 128">
      {n === 2 ? (
        <>
          <Circle cx={44} cy={44} r={16} fill="none" stroke={color} strokeWidth={4} />
          <Circle cx={88} cy={56} r={12} fill="none" stroke={color} strokeWidth={4} />
        </>
      ) : (
        <Circle cx={64} cy={50} r={14} fill="none" stroke={color} strokeWidth={4} />
      )}
    </Svg>
  );
}

function WhoLeadsSheet({ prev, onStart, onBack }: { prev: AbaObserver | null; onStart: (role: AbaObserver['role'], trained: boolean) => void; onBack: () => void }) {
  const { t } = useTranslation();
  const theme = useParentTheme();
  const clock = useAbaClock();
  const [role, setRole] = useState<AbaObserver['role'] | null>(prev?.role ?? null);
  const [trained, setTrained] = useState(prev?.trained ?? false);
  const [settledAt] = useState(() => clock.now());
  const [lastUp, setLastUp] = useState<number | null>(null);
  const downAt = useRef(0);
  const accepts = () => abaWhoLeadsAccepts(downAt.current, settledAt, lastUp);
  /** Обёртка действия листа: касание раньше 500 мс от последнего отпускания — не действие. */
  const act = (fn: () => void) => () => {
    if (accepts()) fn();
  };
  return (
    <View
      testID="aba-who-leads"
      onTouchStart={() => {
        downAt.current = clock.now();
      }}
      onTouchEnd={() => setLastUp(clock.now())}
      style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: parentSpacing.lg, height: abaWhoLeadsSheet.height }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <ParentButton variant="quiet" block={false} label={t('abaSession.back')} onPress={act(onBack)} testID="aba-who-back" />
        <ParentButton block={false} label={t('abaSession.start')} disabled={role === null} onPress={act(() => role && onStart(role, trained))} testID="aba-who-start" />
      </View>
      <ParentText role="heading">{t('abaSession.whoLeads')}</ParentText>
      {prev && (
        <ParentText role="caption" color="textMuted">
          {t('abaSession.asLastTime')}
        </ParentText>
      )}
      {ROLES.map((r, i) => (
        <Row key={r} first={i === 0} kind="link" label={`${role === r ? '✓ ' : ''}${t(`abaSession.role.${r}`)}`} onPress={act(() => setRole(r))} testID={`aba-role-${r}`} />
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 }}>
        <ParentText role="body">{t('abaSession.trained')}</ParentText>
        <Switch value={trained} onValueChange={(v) => {
            if (accepts()) setTrained(v);
          }} testID="aba-trained" />
      </View>
    </View>
  );
}

export default function AbaConfigScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const c = useAbaColors();
  const insets = useSafeAreaInsets();
  const clock = useAbaClock();
  const db = useAccount((s) => s.db);
  const childId = useChildSession((s) => s.childId);
  const setRun = useAbaRun((s) => s.set);
  const [height, setHeight] = useState<number | null>(null);
  const [choice, setChoice] = useState<AbaConfig | null>(null);
  const [sheet, setSheet] = useState(false);
  const [prev, setPrev] = useState<AbaObserver[]>([]);
  const [shownAt] = useState(() => clock.now());

  useEffect(() => {
    if (db && childId) void loadChildState(db, childId, 'abaObservers').then((o) => setPrev(o ?? []));
  }, [db, childId]);

  const next = mode === 'pairing' ? '/aba/pairing' : '/aba/session';
  const go = async (config: AbaConfig, role?: AbaObserver['role'], trained = false) => {
    let observers: AbaObserver[] = [];
    let primary: string | null = null;
    if (config === 'with_adult' && role) {
      const same = prev.find((o) => o.role === role);
      const me: AbaObserver = { id: same?.id ?? newAbaId(), role, trained };
      observers = [me, ...prev.filter((o) => o.id !== me.id)];
      primary = me.id;
      if (db && childId) await setAbaObservers(db, childId, observers, new Date(clock.now()).toISOString());
    }
    setRun({ config, observers, primaryObserverId: primary });
    router.replace(next);
  };

  const tier = height === null ? 'pending' : abaTierFor(height, insets.bottom);
  const cardH = height === null ? 160 : Math.min(200, 4 * Math.floor((height - 248) / 8));

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top, paddingBottom: insets.bottom }} testID="aba-config">
      <View style={{ flex: 1, paddingHorizontal: 16 }} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        {tier === null ? (
          <View style={{ flex: 1, justifyContent: 'center', gap: 16 }} testID="aba-too-small">
            <Text style={{ color: c.ink, fontSize: 20, fontWeight: '700' }}>{t('abaSession.tooSmallTitle')}</Text>
            <Text style={{ color: c.ink, fontSize: 16 }}>{t('abaSession.tooSmallBody')}</Text>
            <ParentThemeProvider>
              <ParentButton label={t('abaSession.regularLessons')} onPress={() => router.replace('/map')} testID="aba-regular" />
              <ParentButton variant="secondary" label={t('abaSession.back')} onPress={() => router.replace('/map')} testID="aba-too-small-back" />
            </ParentThemeProvider>
          </View>
        ) : (
          <>
            <View style={{ height: 68, justifyContent: 'center' }}>
              <ExitHold onExit={() => router.replace('/map')} label={t('abaSession.exit')} hintLabel={t('abaSession.exitHint')} />
            </View>
            {(['with_adult', 'alone'] as const).map((cfg) => (
              <ChildPressable
                key={cfg}
                frameShownAt={shownAt}
                onCommit={() => setChoice(cfg)}
                testID={`aba-config-${cfg}`}
                accessibilityLabel={t(`abaSession.config.${cfg}`)}
                style={{
                  height: cardH,
                  marginTop: cfg === 'alone' ? 16 : 8,
                  borderRadius: radii.lg,
                  borderWidth: choice === cfg ? 6 : ABA_CONTROL_STROKE,
                  borderColor: c.controlInk,
                  backgroundColor: c.controlFill,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Figures n={cfg === 'with_adult' ? 2 : 1} color={c.ink} />
              </ChildPressable>
            ))}
            <Text style={{ color: c.ink, opacity: 0.7, textAlign: 'center', marginTop: 8, fontSize: 14 }}>{t('abaSession.aloneCaption')}</Text>
            <View style={{ flex: 1 }} />
            <Pressable
              disabled={choice === null}
              onPress={() => (choice === 'with_adult' ? setSheet(true) : choice && void go(choice))}
              testID="aba-config-start"
              accessibilityRole="button"
              accessibilityState={{ disabled: choice === null }}
              style={{
                height: touch.primary,
                marginBottom: 16,
                borderRadius: radii.lg,
                borderWidth: ABA_CONTROL_STROKE,
                borderColor: c.controlInk,
                backgroundColor: choice === null ? c.background : c.reinforcement,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: choice === null ? c.ink : c.onReinforcement, fontSize: 22, fontWeight: '700' }}>{t('abaSession.start')}</Text>
            </Pressable>
          </>
        )}
      </View>
      {sheet && (
        <ParentThemeProvider>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
            <WhoLeadsSheet prev={prev[0] ?? null} onBack={() => setSheet(false)} onStart={(role, trained) => void go('with_adult', role, trained)} />
          </View>
        </ParentThemeProvider>
      )}
    </View>
  );
}
