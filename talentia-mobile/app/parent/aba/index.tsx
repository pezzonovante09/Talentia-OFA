/**
 * «Занятия ABA» в разделе родителя (направление `docs/design/aba-screens-2026-10-25.md` §1, этап G —
 * `docs/design/parent-aba-2026-11-01.md`; вход — строка на главной, решение владельца 2026-10-27, флага режима в
 * профиле нет). Иерархия: «Занятие» с единственной залитой кнопкой → «Цели» → согласие → пауза со строкой №150 →
 * файл для специалиста → отзыв. Всё про выбранного ребёнка.
 *
 * Этап G1 (вопрос 59): режим «Со взрослым · Сам» и «Кто ведёт» выбирает взрослый здесь, а не ребёнок на 2.6;
 * «Начать» пишет наблюдателей и `useAbaRun` до навигации и ведёт сразу в сопряжение или сессию через гейт окна
 * `app/aba/index.tsx`. Этап G2 (вопрос 66): карточка «Цели» — три слова на цель и две цифры за занятие. Этап G3
 * (вопрос 67): «Выгрузить для специалиста» — файл через системный лист (`shareSpecialistExport`), строка в трёх
 * состояниях; за флагом `ABA_EXPORT_FILE_ENABLED` — «Позже», как раньше. Вопрос 118: две строки — «Отчёт
 * специалисту» (читаемая страница HTML) и «Файл для программы» (JSON той же выгрузки).
 *
 * №202 (вопрос 116): над «Занятием» — карточка «Где мы сейчас»: что будет на следующем занятии простыми словами
 * (`previewParentStage` — план вхолостую, процедура не меняется) и строка «Как проходят занятия». Первое «Начать»
 * на аккаунте открывает это введение (`intro.tsx`).
 *
 * №203 «Тихий кабинет»: «Где мы сейчас» — блок тона `where` с полосой этапов `StageStrip` (Знакомство · Проверка ·
 * Учимся · Повторяем); главная кнопка состояния — единственная залитая, высота `parentButton.mainHeight` 56.
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ABA_TARGETS } from '../../../src/content/aba';
import type { ParentStageView } from '../../../src/domain/abaParentStage';
import { CHILD_BREAK_MS } from '../../../src/types/aba';
import type { AgeBand } from '../../../src/types/task';
import { parentButton, parentSpacing } from '../../../src/design/parentTokens';
import type { SensitiveAction } from '../../../src/domain/parentGate';
import { newAbaId } from '../../../src/services/abaIds';
import { ABA_ONLY } from '../../../src/services/buildScope';
import {
  abaBlockOf,
  abaLocalDay,
  abaOverview,
  abandonInProgressSession,
  finishInProgressSession,
  loadAbaParentProgress,
  previewParentStage,
  type AbaOverview,
  type AbaParentProgress,
} from '../../../src/services/local/abaStart';
import { abaIntroSeen } from '../../../src/services/local/abaIntro';
import { loadChildState } from '../../../src/services/local/childState';
import { confirmAbaPairing, setAbaObservers, setAbaPaused, settleTailExchange } from '../../../src/services/local/commit';
import { ABA_EXPORT_FILE_ENABLED, shareSpecialistExport, type SpecialistExportKind } from '../../../src/services/local/shareSpecialistExport';
import { useAbaRun } from '../../../src/state/abaRun';
import { useAccount } from '../../../src/state/account';
import { useChildSession } from '../../../src/state/childSession';
import { device } from '../../../src/state/device';
import { useGate } from '../../../src/state/gate';
import { useSelectedProfile } from '../../../src/state/parentView';
import { progressPort } from '../../../src/state/port';
import type { AbaConfig, AbaObserver } from '../../../src/types/aba';
import { ConfirmPinSheet } from '../../../src/ui/parent/ConfirmPinSheet';
import { Card, GoalGlyph, ParentButton, ParentScreen, ParentText, Row, Segmented, type GoalGlyphStatus } from '../../../src/ui/parent/primitives';
import { StageStrip, stageStepOf } from '../../../src/ui/parent/StageStrip';
import { WhoLeadsSheet, type WhoLeadsChoice } from '../../../src/ui/parent/WhoLeadsSheet';

const CONFIGS: readonly AbaConfig[] = ['with_adult', 'alone'];
/** В сборке «только ABA» (№195) режима «Сам» нет: выбора режима не показываем, занятие всегда «Со взрослым». */
const ALONE_HIDDEN = ABA_ONLY;

/** Слот подсказки под сегментами — резерв всегда (две строки caption), карточка не прыгает. */
const HINT_SLOT = 40;

/** Подпись «Файл передан…» держится столько и уходит сама: подтверждение, не состояние. */
const SHARED_CAPTION_MS = 3000;

type ExportState = 'idle' | 'preparing' | 'shared' | 'error' | 'unavailable';

/** День занятия словами отчёта родителя (`app/parent/index.tsx`): сегодня / вчера / N дн. назад. */
function dayLabel(t: (k: string, o?: Record<string, unknown>) => string, day: string | null): string {
  if (!day) return t('parent.home.today');
  const toUtc = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  const days = Math.round((toUtc(abaLocalDay(Date.now())) - toUtc(day)) / 86_400_000);
  return days <= 0 ? t('parent.home.today') : days === 1 ? t('parent.home.yesterday') : t('parent.home.daysAgo', { n: days });
}

/**
 * Строки карточки «Где мы сейчас» (№202): этап следующего занятия, перерыв, жетоны. Тексты проверил
 * `aba-pedagogy-specialist` 2026-11-16. `unknown` — пусто: карточка остаётся со строкой «Как проходят занятия».
 */
export function stageLines(t: (k: string, o?: Record<string, unknown>) => string, v: ParentStageView, band: AgeBand): string[] {
  const goal = (id: string) => t(`parent.aba.goal.${id}`);
  const st = v.stage;
  if (st.kind === 'pairing') {
    return [
      t('parent.aba.where.pairing', { n: st.n, of: st.of }),
      ...(st.reset ? [t('parent.aba.where.pairingReset')] : []),
      t(st.n < st.of ? 'parent.aba.where.pairingThen' : 'parent.aba.where.pairingLast'),
      t('parent.aba.where.pairingRule'),
    ];
  }
  const lines: string[] = v.breakCardTraining ? [t('parent.aba.where.breakCard')] : [];
  if (st.kind === 'placement') lines.push(t('parent.aba.where.placement', { target: goal(st.targetId) }));
  else if (st.kind === 'baseline') lines.push(t('parent.aba.where.baseline', { target: goal(st.targetId) }));
  const teaching = st.kind === 'teaching' ? st : v.alsoTeaching;
  if (teaching) {
    lines.push(t('parent.aba.where.teaching', { target: goal(teaching.targetId) }));
    if (teaching.plannedBreak) lines.push(t(CHILD_BREAK_MS[band] > 60_000 ? 'parent.aba.where.plannedBreak90' : 'parent.aba.where.plannedBreak60'));
  }
  if (st.kind === 'maintenance') lines.push(t('parent.aba.where.maintenance', { targets: st.targetIds.map(goal).join(', ') }));
  else if (st.kind === 'all_mastered') lines.push(t('parent.aba.where.allMastered'));
  // на проверке и первых пробах «без жетонов» уже сказано в строке этапа — повтор не пишем (№203, макет Б)
  if (v.tokens === false && st.kind !== 'placement' && st.kind !== 'baseline') lines.push(t('parent.aba.where.noTokens'));
  else if (v.tokens === true) lines.push(t('parent.aba.where.tokens'));
  return lines;
}

type GoalRowStatus = AbaParentProgress['targets'][number]['status'] | 'ahead';

/**
 * Глиф строки: «освоено отдельно» (ждёт проверки вперемешку или её назначит специалист) — половинный, как «почти»:
 * окончательно ещё не освоено.
 */
const glyphOf = (status: GoalRowStatus): GoalGlyphStatus => (status === 'mixed_pending' || status === 'mixed_by_specialist' ? 'almost' : status);

/** Строки «Целей»: начатые цели в порядке лестницы `ABA_TARGETS` плюс одна следующая как «впереди». */
function goalRows(progress: AbaParentProgress, ready: boolean): { id: string; status: GoalRowStatus }[] {
  const byId = new Map(progress.targets.map((r) => [r.id, r]));
  const rows: { id: string; status: GoalRowStatus }[] = [];
  let aheadShown = false;
  for (const tg of ABA_TARGETS) {
    const r = byId.get(tg.id);
    if (r?.started) rows.push({ id: tg.id, status: r.status });
    else if (!aheadShown && ready) {
      rows.push({ id: tg.id, status: 'ahead' });
      aheadShown = true;
    }
  }
  return rows;
}

export default function AbaParentScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const db = useAccount((s) => s.db);
  const profile = useSelectedProfile();
  const profiles = useAccount((s) => s.profiles);
  const can = useGate((s) => s.can);
  const accountId = useAccount((s) => s.accountId);
  const [stage, setStage] = useState<ParentStageView | null>(null);
  /** Введение «Как проходят занятия» просмотрено на этом аккаунте; `null` — ещё не прочитано. */
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  const [ov, setOv] = useState<AbaOverview | null>(null);
  const [progress, setProgress] = useState<AbaParentProgress | null>(null);
  const [prevObservers, setPrevObservers] = useState<AbaObserver[]>([]);
  const [config, setConfig] = useState<AbaConfig | null>(null);
  const [who, setWho] = useState<WhoLeadsChoice | null>(null);
  const [whoFromLast, setWhoFromLast] = useState(false);
  /** Предвыбор «Кто ведёт» из прошлой сессии делается один раз: взрослый мог уже переставить роль в этот раз. */
  const whoSettled = useRef(false);
  /** «Начать» уже переходит к ребёнку — второй тап не повторяет переход (правка 9). */
  const starting = useRef(false);
  const [sheet, setSheet] = useState<'row' | 'start' | null>(null);
  const [pending, setPending] = useState<{ action: SensitiveAction; run: () => void } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [exportState, setExportState] = useState<ExportState>('idle');
  const sharedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (sharedTimer.current && clearTimeout(sharedTimer.current)), []);

  const childId = profile?.childId ?? null;
  const reload = useCallback(async () => {
    if (!db || !childId) return;
    // прошлое занятие оборвалось на обмене в конце до сцены (№181): жетоны — на доску до показа карточки; на паузе и без
    // согласия возврат не пишется, его подберёт следующий старт
    await settleTailExchange(db, childId, { at: new Date().toISOString() }).catch((e: unknown) => {
      if (__DEV__) console.warn('aba-tail-return', e);
    });
    const o = await abaOverview(db, childId);
    const obs = (await loadChildState(db, childId, 'abaObservers')) ?? [];
    setOv(o);
    setPrevObservers(obs);
    if (!whoSettled.current && obs[0]) {
      whoSettled.current = true;
      setWho({ role: obs[0].role, trained: obs[0].trained });
      setWhoFromLast(true);
    }
    // предвыбор режима до первого кадра карточки — из обзора, не отдельным запросом: «Со взрослым» по умолчанию и по
    // подсказке №166; выбранный «Сам» держится, пока доступен
    setConfig((cur) => (cur === 'alone' && o.aloneAvailable && !ALONE_HIDDEN ? cur : 'with_adult'));
    const hasData = o.consent === 'granted' || o.consent === 'outdated';
    setProgress(hasData ? await loadAbaParentProgress(db, childId) : null);
    if (accountId) setIntroSeen(await abaIntroSeen(device(), accountId).catch(() => true));
  }, [db, childId, accountId]);

  // «Где мы сейчас»: план следующего занятия вхолостую — по тем, кто ведёт сейчас (обученный наблюдатель меняет план)
  const band = profile?.band;
  const soundOn = profile?.soundEffects ?? true;
  const adultReward = profile?.adultReward === true;
  useEffect(() => {
    if (!db || !childId || !band || !ov) return;
    let alive = true;
    const lead: AbaObserver | null = who ? { id: prevObservers.find((o) => o.role === who.role)?.id ?? 'preview', role: who.role, trained: who.trained } : null;
    previewParentStage(db, childId, {
      config: 'with_adult',
      band,
      soundOn,
      adultReward,
      observers: lead ? [lead, ...prevObservers.filter((o) => o.id !== lead.id)] : prevObservers,
      primaryObserverId: lead?.id ?? null,
      now: Date.now(),
    })
      .then((v) => {
        if (alive) setStage(v);
      })
      .catch((e: unknown) => {
        if (__DEV__) console.warn('aba-stage', e);
        if (alive) setStage(null);
      });
    return () => {
      alive = false;
    };
  }, [db, childId, band, soundOn, adultReward, ov, who, prevObservers]);
  // согласие и отзыв уходят назад через `router.back()` — этот экран остаётся смонтированным, читать на фокус
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  /** Действие за свежим PIN: окно свежести ещё открыто — сразу, иначе лист. */
  const guarded = (action: SensitiveAction, run: () => void) => (can(action) ? run() : setPending({ action, run }));

  const safely = (fn: () => Promise<void>) => () => {
    setFailure(null);
    void fn().catch((e: unknown) => {
      if (__DEV__) console.warn('aba-parent', e);
      setFailure(t('parent.failed'));
    });
  };

  if (!profile || !db) return null;
  // с `now`: незаконченное занятие старше 30 мин или другого дня — `in_progress_stale` (фаза 8), его только закрывают
  const block = ov ? abaBlockOf(ov, Date.now()) : null;
  // текст согласия обновился — данные практики на устройстве остаются, пауза и отзыв доступны (ABA.md: другого пути отзыва нет)
  const hasData = ov?.consent === 'granted' || ov?.consent === 'outdated';
  const status = !ov ? '' : t(`parent.aba.status.${block ?? 'ready'}`);
  const mode: AbaConfig = config ?? 'with_adult';
  const aloneAvailable = ov?.aloneAvailable ?? true;
  const hint = !ov ? '' : block === 'pairing_needed' && ov.suggestAdult ? t('abaSession.togetherHint') : block !== 'pairing_needed' && !aloneAvailable && !ALONE_HIDDEN ? t('parent.aba.aloneLocked') : '';
  const whoValue = who ? (who.trained ? t('parent.aba.whoLeadsValue', { role: t(`abaSession.role.${who.role}`) }) : t(`abaSession.role.${who.role}`)) : t('parent.aba.whoLeadsNone');

  const setPaused = (paused: boolean) =>
    safely(async () => {
      const r = await setAbaPaused(db, profile.childId, paused, new Date().toISOString());
      if (r === 'consent_required') router.push('/parent/aba/consent');
      await reload();
    })();

  const finish = safely(async () => {
    await finishInProgressSession(db, profile.childId, Date.now());
    await reload();
  });
  /** Просроченное занятие (фаза 8): закрывается `app_backgrounded` моментом ухода; дальше — обычная карточка «Можно начинать». */
  const closeStale = safely(async () => {
    const leftAt = Date.parse(ov?.inProgressLeftAt ?? '');
    const now = Date.now();
    await abandonInProgressSession(db, profile.childId, { reason: 'app_backgrounded', at: Number.isFinite(leftAt) ? leftAt : now, now });
    await reload();
  });

  /**
   * К ребёнку через гейт окна `app/aba/index.tsx` (фаза 8, `design-lead`): экран «слишком мал» в одном месте, первый кадр
   * детской стороны — пустой фон. Не `push`: карта между родительским экраном и гейтом не мелькает. Детская сессия — того
   * ребёнка, чья карточка открыта: с карты другого ребёнка и на холодном старте она не совпадает (как `openProfile`), иначе
   * занятие и его записи ушли бы чужому ребёнку.
   */
  const goChild = async (to: 'pairing' | 'session') => {
    if (useChildSession.getState().childId !== profile.childId) {
      if (useAccount.getState().consent === 'outdated') {
        router.push('/parent/reconsent');
        return;
      }
      const snapshot = await progressPort().load(profile.childId);
      // ради занятия сменили живую сессию: выход из занятия — к выбору профиля (`leaveAba`)
      useChildSession.getState().startAccountSession({ profile, snapshot, now: new Date(), openedForAba: useChildSession.getState().mode !== 'none' });
    }
    router.dismissAll();
    router.replace(to === 'pairing' ? { pathname: '/aba', params: { mode: 'pairing' } } : '/aba');
  };

  /** «Начать»: наблюдатели в базу и в стор до навигации (как делал `go()` на 2.6), затем сразу сопряжение или сессия. */
  const begin = safely(async () => {
    // второй тап, пока идёт переход, не начинает занятие заново (правка 9)
    if (starting.current) return;
    starting.current = true;
    try {
      await beginNow();
    } finally {
      starting.current = false;
    }
  });
  const beginNow = async () => {
    let observers: AbaObserver[] = [];
    let primary: string | null = null;
    if (mode === 'with_adult' && who) {
      const same = prevObservers.find((o) => o.role === who.role);
      const me: AbaObserver = { id: same?.id ?? newAbaId(), role: who.role, trained: who.trained };
      observers = [me, ...prevObservers.filter((o) => o.id !== me.id)];
      primary = me.id;
      await setAbaObservers(db, profile.childId, observers, new Date().toISOString());
    }
    useAbaRun.getState().set({ config: mode, observers, primaryObserverId: primary });
    await goChild(block === 'pairing_needed' ? 'pairing' : 'session');
  };

  /**
   * «Начать» при «Со взрослым» и «Не выбрано» — не серая кнопка, а лист с причиной; «Готово» листа возвращает сюда.
   * Первое «Начать» на аккаунте — сначала введение (№202); вернувшись, взрослый нажимает «Начать» сам.
   */
  const start = () => {
    // флаг ещё не прочитан (`null`) — тоже «не просмотрено»: быстрый первый тап не проскакивает введение
    if (introSeen !== true) {
      router.push('/parent/aba/intro');
      return;
    }
    if (mode === 'with_adult' && !who) setSheet('start');
    else begin();
  };

  /** «Продолжить»: конфигурация и наблюдатели — из снимка занятия, выбирать заново нечего. */
  const resume = safely(async () => {
    const s = ov?.inProgress;
    if (!ov || !s) return;
    // карточка просрочилась, пока была открыта: занятие не закрывается молча, закрывает взрослый
    if (abaBlockOf(ov, Date.now()) === 'in_progress_stale') {
      await reload();
      return;
    }
    // второй тап, пока идёт переход, не повторяет его (как у «Начать», правка 9)
    if (starting.current) return;
    starting.current = true;
    try {
      useAbaRun.getState().set({ config: s.config, observers: s.observers, primaryObserverId: s.primaryObserverId });
      await goChild('session');
    } finally {
      starting.current = false;
    }
  });

  // «Сопряжение подтверждено» (вопрос 62): только обученному наблюдателю, за PIN; роль держателя PIN — владелец аккаунта
  const confirmPairing = safely(async () => {
    if (!ov?.trainedObserverId) return;
    await confirmAbaPairing(db, profile.childId, { observerId: ov.trainedObserverId, byRole: 'owner', at: new Date().toISOString() });
    await reload();
  });

  /**
   * Файл для специалиста (G3): «Готовится…» не короче `guardMs`, чтобы слово не мигнуло; результат листа система не
   * сообщает — на `'shared'` нейтральная подпись на 3 с, на отмену ничего, лист недоступен — «появится позже».
   */
  const exportFile = async (kind: SpecialistExportKind) => {
    if (exportState === 'preparing') return;
    setExportState('preparing');
    const started = Date.now();
    try {
      const result = await shareSpecialistExport(db, profile.childId, device(), new Date().toISOString(), { kind, t, lang: i18n.language });
      await new Promise((r) => setTimeout(r, Math.max(0, parentButton.guardMs - (Date.now() - started))));
      if (result === 'shared') {
        setExportState('shared');
        if (sharedTimer.current) clearTimeout(sharedTimer.current);
        sharedTimer.current = setTimeout(() => setExportState((cur) => (cur === 'shared' ? 'idle' : cur)), SHARED_CAPTION_MS);
      } else if (result === 'no_consent') {
        // согласие устарело или отозвано между загрузкой экрана и нажатием — к тексту согласия
        setExportState('idle');
        router.push('/parent/aba/consent');
      } else {
        setExportState(result === 'unavailable' ? 'unavailable' : 'idle');
      }
    } catch (e) {
      if (__DEV__) console.warn('aba-export', e);
      setExportState('error');
    }
  };

  const inProgressMode = (() => {
    const s = ov?.inProgress;
    if (!s) return '';
    const label = t(`abaSession.config.${s.config}`);
    const lead = s.observers.find((o) => o.id === s.primaryObserverId);
    return s.config === 'with_adult' && lead ? `${label} · ${t(`abaSession.role.${lead.role}`)}` : label;
  })();

  const canChoose = block === null || block === 'pairing_needed';
  const goals = progress ? goalRows(progress, (ov?.readyTargets ?? 0) > 0) : [];
  // этап считается для «Со взрослым»; в «Сам» (обычная сборка) план другой — этап не показываем
  const whereLines = canChoose && mode === 'with_adult' && stage ? stageLines(t, stage, profile.band) : [];
  const whereStep = whereLines.length > 0 && stage ? stageStepOf(stage.stage.kind) : null;

  return (
    <ParentScreen
      title={t('parent.aba.title')}
      scroll
      // сборка «только ABA»: назад некуда (после «слишком мал» раздел — единственный экран) — на первый экран (правка 7)
      left={<ParentButton variant="quiet" label={t('parent.back')} onPress={() => (ALONE_HIDDEN && !router.canGoBack() ? router.replace('/') : router.back())} block={false} testID="aba-back" />}
      testID="parent-aba"
    >
      <View style={{ gap: parentSpacing.lg }}>
        {ov && (
          // №203: блок тона `where` с иконкой в круге; подпись «Следующее занятие» — только когда этап показан
          <Card tone="where" icon="map" title={t('parent.aba.where.title')} caption={whereLines.length > 0 ? t('parent.aba.where.next') : undefined} testID="aba-where">
            {whereLines.length > 0 && (
              <View style={{ gap: parentSpacing.xs, marginBottom: parentSpacing.sm }} testID="aba-where-lines">
                {whereStep && (
                  <View style={{ marginBottom: parentSpacing.sm }}>
                    <StageStrip current={whereStep} testID="aba-stage-strip" />
                  </View>
                )}
                {whereLines.map((line, i) => (
                  <ParentText key={i} role={i === 0 ? 'body' : 'caption'} color={i === 0 ? 'text' : 'textMuted'} testID={`aba-where-line-${i}`}>
                    {line}
                  </ParentText>
                ))}
              </View>
            )}
            <Row first kind="link" label={t('parent.aba.where.howItWorks')} onPress={() => router.push('/parent/aba/intro')} testID="aba-where-intro" />
          </Card>
        )}
        <Card title={t('parent.aba.session')} testID="aba-session">
          {/* несколько детей: занятие и его данные идут этому ребёнку, имя нельзя угадывать */}
          {profiles.length > 1 && (
            <ParentText role="label" style={{ marginBottom: parentSpacing.xs }} testID="aba-child-name">
              {profile.name || t('parent.profile.unnamed', { n: profiles.findIndex((p) => p.childId === profile.childId) + 1 })}
            </ParentText>
          )}
          <ParentText role="body" testID="aba-status">
            {status}
          </ParentText>
          {block === 'paused' && ov?.inProgress && (
            // незаконченное занятие под паузой (фаза 8, г2): писать нельзя — ни продолжить, ни закрыть; подпись принадлежит статусу
            <View style={{ marginTop: parentSpacing.xs }}>
              <ParentText role="caption" color="textMuted" lines={2} testID="aba-paused-in-progress">
                {t('parent.aba.pausedInProgress')}
              </ParentText>
            </View>
          )}
          {canChoose && (
            <View style={{ marginTop: parentSpacing.md }}>
              {!ALONE_HIDDEN && <Segmented
                options={CONFIGS.map((c) => ({ value: c, label: t(`abaSession.config.${c}`) }))}
                value={mode}
                onChange={setConfig}
                disabled={aloneAvailable ? [] : ['alone']}
                disabledHint={t('parent.aba.aloneLocked')}
                testID="aba-mode"
              />}
              <View style={{ minHeight: HINT_SLOT, marginTop: parentSpacing.sm, justifyContent: 'center' }} testID="aba-hint-slot">
                {hint ? (
                  <ParentText role="caption" color="textMuted" lines={2} testID="aba-hint">
                    {hint}
                  </ParentText>
                ) : null}
              </View>
              <View style={{ marginTop: parentSpacing.sm }}>
                {mode === 'with_adult' ? (
                  <Row first kind="value" label={t('parent.aba.whoLeads')} value={whoValue} onPress={() => setSheet('row')} testID="aba-who-row" valueTestID="aba-who-row-value" />
                ) : (
                  <Row first kind="value" label={t('parent.aba.whoLeads')} value={t('parent.aba.whoLeadsNotNeeded')} testID="aba-who-row" valueTestID="aba-who-row-value" />
                )}
              </View>
            </View>
          )}
          {(block === 'in_progress' || block === 'in_progress_stale') && ov?.inProgress && (
            <View style={{ marginTop: parentSpacing.md }}>
              <Row first kind="value" label={t('parent.aba.mode')} value={inProgressMode} testID="aba-mode-row" valueTestID="aba-mode-row-value" />
            </View>
          )}
          <View style={{ marginTop: canChoose || block === 'in_progress' || block === 'in_progress_stale' ? parentSpacing.md : parentSpacing.sm }}>
            {block === 'no_consent' || block === 'outdated' ? (
              <ParentButton label={t('parent.aba.readConsent')} height={parentButton.mainHeight} onPress={() => router.push('/parent/aba/consent')} testID="aba-read-consent" />
            ) : block === 'paused' ? (
              <ParentButton variant="secondary" label={t('parent.aba.start')} height={parentButton.mainHeight} disabled reason={t('parent.aba.unpauseToStart')} onPress={() => undefined} testID="aba-start" />
            ) : block === 'in_progress' ? (
              <>
                <ParentButton label={t('parent.aba.continue')} height={parentButton.mainHeight} onPress={() => guarded('aba_resume', resume)} testID="aba-continue" />
                <ParentButton variant="quiet" label={t('parent.aba.finishWithout')} onPress={finish} testID="aba-finish" />
              </>
            ) : block === 'in_progress_stale' ? (
              // просрочено (фаза 8, `design-lead`): одно действие и единственный путь к новому занятию — заметная кнопка
              <ParentButton variant="secondary" label={t('parent.aba.closeStale')} onPress={closeStale} testID="aba-close-stale" />
            ) : block === 'no_ready_targets' || block === 'pool_small' ? null : (
              // единственная залитая кнопка экрана — главная, 56 (№203)
              <ParentButton label={t(block === 'pairing_needed' ? 'parent.aba.startPairing' : 'parent.aba.start')} height={parentButton.mainHeight} onPress={start} testID="aba-start" />
            )}
          </View>
          {(canChoose || block === 'in_progress') && (
            <ParentText role="caption" color="textMuted" style={{ marginTop: parentSpacing.sm }} testID="aba-exit-hint">
              {t('parent.aba.where.exitHint')}
            </ParentText>
          )}
          {block === 'pairing_needed' && ov?.trainedObserverId && (
            <>
              <ParentButton variant="quiet" label={t('parent.aba.pairingConfirmed')} onPress={() => guarded('aba_pairing_confirm', confirmPairing)} testID="aba-pairing-confirm" />
              <ParentText role="caption" color="textMuted" testID="aba-pairing-confirm-caption">
                {t('parent.aba.pairingConfirmedCaption')}
              </ParentText>
            </>
          )}
        </Card>

        {hasData && progress && (
          <Card title={t('parent.aba.goals')} testID="aba-goals">
            {goals.map((g, i) => (
              <Row
                key={g.id}
                first={i === 0}
                leading={<GoalGlyph status={glyphOf(g.status)} testID={`aba-goal-${g.id}-glyph-${glyphOf(g.status)}`} />}
                label={t(`parent.aba.goal.${g.id}`)}
                value={t(`parent.aba.goalStatus.${g.status}`)}
                valueColor={g.status === 'ahead' ? 'textMuted' : 'text'}
                accessibilityLabel={`${t(`parent.aba.goal.${g.id}`)}: ${t(`parent.aba.goalStatus.${g.status}`)}`}
                testID={`aba-goal-${g.id}`}
                valueTestID={`aba-goal-${g.id}-value`}
              />
            ))}
            <ParentText role="caption" color="textMuted" style={{ marginTop: parentSpacing.md }} testID="aba-goals-summary">
              {!progress.last
                ? t('parent.aba.goalsEmpty')
                : progress.last.kind === 'pairing_only'
                  ? t('parent.aba.lastSessionPairing', { day: dayLabel(t, progress.last.day) })
                  : progress.last.trials === 0
                    ? t('parent.aba.lastSessionNoTrials', { day: dayLabel(t, progress.last.day) })
                    : t('parent.aba.lastSession', { day: dayLabel(t, progress.last.day), trials: progress.last.trials, independent: progress.last.independent })}
            </ParentText>
          </Card>
        )}

        <Card title={t('parent.aba.consentCard')} testID="aba-consent">
          <Row first kind="value" label={t('parent.aba.consentRow')} value={ov ? t(`parent.aba.consentStatus.${ov.consent}`) : ''} onPress={() => router.push('/parent/aba/consent')} testID="aba-consent-row" />
        </Card>

        {hasData && (
          <Card title={t('parent.aba.pause')} testID="aba-pause">
            <Row
              first
              kind="toggle"
              label={t('parent.aba.pauseRow')}
              caption={t('parent.aba.pauseRetention')}
              toggle={ov!.paused}
              onToggle={(v) => (v ? setPaused(true) : guarded('aba_consent', () => setPaused(false)))}
              testID="aba-pause-toggle"
            />
          </Card>
        )}

        {hasData && (
          <Card title={t('parent.aba.specialist')} testID="aba-specialist">
            {ov?.consent === 'outdated' ? (
              // текст согласия обновился (в нём — про выгрузку файлом): сначала прочитать и согласиться, потом выгружать
              <Row first kind="link" label={t('parent.aba.exportUpdateConsent')} onPress={() => router.push('/parent/aba/consent')} testID="aba-export-update-consent" />
            ) : !ABA_EXPORT_FILE_ENABLED || exportState === 'unavailable' ? (
              <Row first kind="value" label={t('parent.aba.exportRow')} value={t('parent.aba.exportLaterValue')} testID="aba-export" valueTestID="aba-export-value" />
            ) : exportState === 'preparing' ? (
              <Row first kind="value" label={t('parent.aba.exportRow')} value={t('parent.aba.exportPreparing')} testID="aba-export" valueTestID="aba-export-value" />
            ) : (
              <>
                <Row first kind="link" label={t('parent.aba.reportRow')} onPress={() => guarded('aba_export', () => void exportFile('report'))} testID="aba-export" />
                <Row kind="link" label={t('parent.aba.dataRow')} onPress={() => guarded('aba_export', () => void exportFile('data'))} testID="aba-export-data" />
              </>
            )}
            {exportState === 'error' && (
              <ParentText role="caption" color="error" testID="aba-export-error">
                {t('parent.aba.exportFailed')}
              </ParentText>
            )}
            {exportState === 'shared' && (
              <ParentText role="caption" color="textMuted" testID="aba-export-shared">
                {t('parent.aba.exportShared')}
              </ParentText>
            )}
            <ParentText role="caption" color="textMuted" testID="aba-export-note">
              {!ABA_EXPORT_FILE_ENABLED ? t('parent.aba.exportLater') : exportState === 'unavailable' ? t('parent.aba.exportUnavailable') : t('parent.aba.exportCaption')}
            </ParentText>
          </Card>
        )}

        {hasData && (
          <Card testID="aba-revoke-card">
            <Row first kind="destructive" label={t('parent.aba.revoke')} onPress={() => router.push({ pathname: '/parent/confirm/[action]', params: { action: 'aba_revoke' } })} testID="aba-revoke" />
          </Card>
        )}

        {failure && (
          <ParentText role="caption" color="error" align="center" testID="aba-error">
            {failure}
          </ParentText>
        )}
      </View>
      <WhoLeadsSheet
        key={sheet ?? 'closed'}
        visible={sheet !== null}
        initial={who}
        fromLastTime={whoFromLast}
        reasonRequired={sheet === 'start'}
        onBack={() => setSheet(null)}
        onDone={(choice) => {
          whoSettled.current = true;
          setWho(choice);
          setWhoFromLast(false);
          setSheet(null);
        }}
      />
      <ConfirmPinSheet
        visible={pending !== null}
        onCancel={() => setPending(null)}
        onConfirmed={() => {
          const p = pending;
          setPending(null);
          p?.run();
        }}
      />
    </ParentScreen>
  );
}
