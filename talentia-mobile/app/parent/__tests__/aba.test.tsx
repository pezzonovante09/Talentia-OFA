/**
 * «Занятия ABA» в разделе родителя: `app/parent/aba/index.tsx` (кнопка занятия по `abaBlockOf`, режим и «Кто ведёт»
 * у взрослого — этап G1, карточка «Цели» — этап G2, согласие, пауза со строкой №150, файл для специалиста, отзыв),
 * `app/parent/aba/consent.tsx` (согласие за PIN) и
 * действие `aba_revoke` на `app/parent/confirm/[action].tsx`. База — in-memory SQLite (`memoryDb`), сервисы
 * настоящие, PIN — настоящий `checkPin` на `fakeDevice()`. Роутер замокан; поддельных таймеров нет.
 */
import AbaParentScreen from '../aba/index';
import AbaConsentScreen from '../aba/consent';
import ConfirmScreen from '../confirm/[action]';
import { ABA_TARGETS } from '../../../src/content/aba';
import { markMastered } from '../../../src/domain/abaCriterion';
import { isUuidV4 } from '../../../src/domain/ids';
import { initialTargetState } from '../../../src/domain/abaPrompting';
import { nextStep, startAbaSession } from '../../../src/domain/abaSession';
import { CURRENT_CONSENT_TEXTS } from '../../../src/domain/consentTexts';
import { initialTokenTraining } from '../../../src/domain/abaTokenTraining';
import { createLocalAccount } from '../../../src/services/local/account';
import { abaConsentTextVersion, grantAbaProcessing } from '../../../src/services/local/abaConsent';
import { appendPairingSession, sessionsOf } from '../../../src/services/local/abaLog';
import { abaOverview, DEV_PLACEHOLDER_ART, finishInProgressSession, loadAbaStart } from '../../../src/services/local/abaStart';
import { ABA_DELETED_KEYS, loadChildState, saveChildState } from '../../../src/services/local/childState';
import { saveAbaSessionStep, setAbaPaused } from '../../../src/services/local/commit';
import { appendConsentEvent, readConsentLog } from '../../../src/services/local/consentLog';
import { asAbaWriter, memoryDb, writeLessonRun } from '../../../src/services/local/__tests__/nodeSql';
import { newProfile } from '../../../src/services/local/profiles';
import { revokeAbaProcessing } from '../../../src/services/local/purge';
import type { SqlDb } from '../../../src/services/local/sql';
import { sha256 } from '../../../src/services/digest';
import { randomBytes } from '../../../src/services/random';
import { useAbaRun } from '../../../src/state/abaRun';
import { useAccount } from '../../../src/state/account';
import { setDevice } from '../../../src/state/device';
import { useGate } from '../../../src/state/gate';
import { useParentView } from '../../../src/state/parentView';
import { fakeDevice } from '../../../src/test/fakeDevice';
import { ParentThemeProvider } from '../../../src/ui/parent/theme';
import { act, fireEvent, renderWithProviders, screen, waitFor } from '../../../src/test/render';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissAll: jest.fn() };
  const params = { action: '' as string | undefined };
  /** Последний колбэк фокуса: «вернулись на экран» — вызвать его снова, как навигатор при возврате. */
  const focus: { current: (() => void) | null } = { current: null };
  return {
    __router: router,
    __params: params,
    __focus: focus,
    useRouter: () => router,
    useLocalSearchParams: () => params,
    useFocusEffect: (cb: () => void) => {
      focus.current = cb;
      React.useEffect(() => cb(), [cb]);
    },
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
  };
});
jest.mock('../../../src/services/local/expoSqlite', () => ({ openLocalDb: jest.fn(), deleteLocalDb: jest.fn(async () => undefined) }));
jest.mock('../../../src/services/local/buildInfo', () => ({ buildTime: () => null }));

const { __router: router, __params: params, __focus: focus } = jest.requireMock('expo-router') as {
  __router: { push: jest.Mock; back: jest.Mock; replace: jest.Mock; dismissAll: jest.Mock };
  __params: { action: string | undefined };
  __focus: { current: (() => void) | null };
};

const PIN = '295173';
const KID = '00000000-0000-4000-8000-0000000000a1';
const KID2 = '00000000-0000-4000-8000-0000000000a2';
const p1 = newProfile({ childId: KID, band: '5-6', interfaceLang: 'ru', createdAt: '2026-10-25T00:00:00.000Z', name: 'Айдар' });
const p2 = newProfile({ childId: KID2, band: '7', interfaceLang: 'ru', createdAt: '2026-10-25T00:00:00.000Z' });
const OBS = [{ id: 'obs-1', role: 'parent' as const, trained: false }];
/** Свои байты для подготовки данных: мок `expo-crypto` детерминирован, и два id из `randomBytes` совпали бы. */
let seq = 0;
const bytes = (len: number) => Uint8Array.from({ length: len }, (_, i) => (i * 13 + (seq += 7)) & 0xff);

let db: SqlDb;
let accountId = '';

const iso = (ms = Date.now()) => new Date(ms).toISOString();
const wrap = (el: React.ReactElement, lng: 'ru' | 'en' = 'ru') => renderWithProviders(<ParentThemeProvider>{el}</ParentThemeProvider>, { lng });
const renderAba = () => wrap(<AbaParentScreen />);
const renderConsent = (lng: 'ru' | 'en' = 'ru') => wrap(<AbaConsentScreen />, lng);
const renderRevoke = () => {
  params.action = 'aba_revoke';
  return wrap(<ConfirmScreen />);
};

async function typePin(pin: string) {
  for (const d of pin) await fireEvent.press(screen.getByTestId(`confirm-pin-keypad-${d}`));
}

// --- состояние ребёнка через настоящие сервисы ---

async function grant(childId = KID) {
  await grantAbaProcessing(db, { childId, accountId, lang: 'ru', at: iso(Date.now() - 60_000), randomBytes: bytes });
}

/** Согласие на прежний текст: версии нет среди текущих (`CURRENT_CONSENT_TEXTS`) — статус `outdated`. */
async function grantOutdated(childId = KID) {
  await appendConsentEvent(db, { id: `old-${childId}`, scope: 'aba_processing', action: 'grant', childId, textVersion: 'ru-draft-0', confirmedBy: 'pin', actorId: accountId, at: iso(Date.now() - 60_000) }, 'owner');
}

async function pair(childId = KID) {
  await asAbaWriter(db, childId, (tx) => saveChildState(tx, childId, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true }, iso()));
}

/** Незаконченное занятие: вход → старт → первый шаг → снимок, как пишет экран занятия. */
async function sessionInProgress(childId = KID) {
  const now = Date.now();
  const r = await loadAbaStart(db, childId, { config: 'with_adult', band: '5-6', soundOn: true, observers: OBS, primaryObserverId: 'obs-1', now, art: DEV_PLACEHOLDER_ART, randomBytes: bytes });
  if (r.kind !== 'ready') throw new Error(`занятие не стартовало: ${r.reason}`);
  await saveAbaSessionStep(db, childId, nextStep(startAbaSession(r.input), now).state, iso(now));
}

/** Наблюдатели прошлой сессии — предвыбор строки «Кто ведёт». */
const observers = (list: { id: string; role: 'parent' | 'specialist' | 'other_adult'; trained: boolean }[], childId = KID) =>
  asAbaWriter(db, childId, (tx) => saveChildState(tx, childId, 'abaObservers', list, iso()));

const statusText = () => screen.getByTestId('aba-status').props.children as string;
const waitStatus = (text: string) => waitFor(() => expect(statusText()).toBe(text));
const pausedInDb = async (childId = KID) => (await loadChildState(db, childId, 'abaPaused')) === true;
const whoValue = () => screen.getByTestId('aba-who-row-value').props.children as string;
/** `replace` к ребёнку после `dismissAll`, без `push`: карта не мелькает. */
const expectWentTo = (href: string) => {
  expect(router.replace).toHaveBeenCalledWith(href);
  expect(router.push).not.toHaveBeenCalled();
  expect(router.dismissAll.mock.invocationCallOrder[0]).toBeLessThan(router.replace.mock.invocationCallOrder[0]);
};

beforeEach(async () => {
  jest.clearAllMocks();
  focus.current = null;
  useAbaRun.getState().reset();
  const device = fakeDevice();
  setDevice(device);
  useParentView.setState({ childId: null });
  useGate.setState({ session: null });
  db = await memoryDb();
  accountId = await createLocalAccount(device, PIN, { randomBytes, digest: sha256 });
  useAccount.setState({ status: 'ready', accountId, db, profiles: [p1], consent: 'granted', retentionHold: null });
});

afterEach(() => setDevice(null));

describe('«Занятия ABA»: кнопка занятия по состоянию', () => {
  it('согласия не давали — «Прочитать согласие» ведёт на экран согласия, «Начать» нет', async () => {
    await renderAba();
    await waitStatus('Нужно согласие на данные практики');
    expect(screen.queryByTestId('aba-start')).toBeNull();
    await fireEvent.press(screen.getByTestId('aba-read-consent'));
    expect(router.push).toHaveBeenCalledWith('/parent/aba/consent');
  });

  it('согласия не давали — карточек паузы, файла и отзыва нет', async () => {
    await renderAba();
    await waitStatus('Нужно согласие на данные практики');
    expect([screen.queryByTestId('aba-pause'), screen.queryByTestId('aba-specialist'), screen.queryByTestId('aba-revoke-card')]).toEqual([null, null, null]);
  });

  it('согласие отозвано — снова «Нужно согласие» и «Прочитать согласие»', async () => {
    await grant();
    await revokeAbaProcessing(db, { id: 'rv', scope: 'aba_processing', action: 'revoke', childId: KID, textVersion: 'ru-draft-1', confirmedBy: 'pin', actorId: accountId, at: iso() }, 'owner');
    await renderAba();
    await waitStatus('Нужно согласие на данные практики');
    expect(screen.getByTestId('aba-read-consent')).toBeTruthy();
  });

  it('текст согласия обновился — статус об этом и «Прочитать согласие»', async () => {
    await grantOutdated();
    await renderAba();
    await waitStatus('Текст согласия обновился — прочитайте его');
    expect(screen.queryByTestId('aba-start')).toBeNull();
    await fireEvent.press(screen.getByTestId('aba-read-consent'));
    expect(router.push).toHaveBeenCalledWith('/parent/aba/consent');
  });

  it('согласие есть, знакомства с жетонами не было — «Начать знакомство»: раздел закрыт, затем сразу /aba/pairing', async () => {
    await grant();
    await observers(OBS);
    await renderAba();
    await waitStatus('Сначала знакомство с жетонами — короткое занятие без заданий');
    expect(screen.getByTestId('aba-start').props.accessibilityLabel).toBe('Начать знакомство');
    await fireEvent.press(screen.getByTestId('aba-start'));
    await waitFor(() => expectWentTo('/aba/pairing'));
  });

  it('согласие есть, знакомство пройдено — «Можно начинать», «Начать занятие»: раздел закрыт, затем сразу /aba/session', async () => {
    await grant();
    await pair();
    await observers(OBS);
    await renderAba();
    await waitStatus('Можно начинать');
    expect(screen.getByTestId('aba-start').props.accessibilityLabel).toBe('Начать занятие');
    await fireEvent.press(screen.getByTestId('aba-start'));
    await waitFor(() => expectWentTo('/aba/session'));
  });

  it('«Начать занятие» не просит PIN: лист PIN не открывается', async () => {
    await grant();
    await pair();
    await observers(OBS);
    await renderAba();
    await waitStatus('Можно начинать');
    await fireEvent.press(screen.getByTestId('aba-start'));
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    expect(screen.queryByTestId('confirm-pin-sheet')).toBeNull();
  });

  it('пауза — «На паузе», «Начать занятие» недоступна с подписью «Снимите паузу, чтобы начать»', async () => {
    await grant();
    await pair();
    await setAbaPaused(db, KID, true, iso());
    await renderAba();
    await waitStatus('На паузе');
    expect(screen.getByTestId('aba-start').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Снимите паузу, чтобы начать')).toBeTruthy();
  });

  it('пауза — нажатие на недоступную «Начать» никуда не ведёт', async () => {
    await grant();
    await pair();
    await setAbaPaused(db, KID, true, iso());
    await renderAba();
    await waitStatus('На паузе');
    await fireEvent.press(screen.getByTestId('aba-start'));
    expect([router.replace.mock.calls.length, router.dismissAll.mock.calls.length]).toEqual([0, 0]);
  });

  it('в DEV-сборке нет — цели ждут картинок: статус об этом, кнопки занятия нет', async () => {
    await grant();
    await pair();
    const g = global as unknown as { __DEV__: boolean };
    const dev = g.__DEV__;
    g.__DEV__ = false;
    try {
      await renderAba();
      await waitStatus('Цели ждут картинок');
      expect([screen.queryByTestId('aba-start'), screen.queryByTestId('aba-continue'), screen.queryByTestId('aba-read-consent')]).toEqual([null, null, null]);
    } finally {
      g.__DEV__ = dev;
    }
  });
});

describe('«Занятия ABA»: режим и «Кто ведёт» у взрослого (этап G1, вопрос 59)', () => {
  const PAIRING_STATUS = 'Сначала знакомство с жетонами — короткое занятие без заданий';
  const ALONE_LOCKED = '«Сам» откроется, когда задание будет освоено со взрослым';
  const TOGETHER = 'Пока это занятие лучше вместе — побудьте рядом';
  const segment = (cfg: 'with_adult' | 'alone') => screen.getByTestId(`aba-mode-${cfg}`);
  const setTargets = (states: Record<string, ReturnType<typeof markMastered>>) => asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'abaTargets', states, iso()));
  let n = 0;
  const pairingAloneMiss = () =>
    asAbaWriter(db, KID, (tx) =>
      appendPairingSession(
        tx,
        KID,
        {
          id: `00000000-0000-4000-8000-00000000020${(n += 1)}`,
          day: '2026-10-28',
          startedAt: '2026-10-28T10:00:00.000Z',
          endedAt: '2026-10-28T10:01:00.000Z',
          config: 'alone',
          endReason: 'abandoned',
          cycles: 0,
          chosenBy: 'none',
          choicesByChild: 0,
          choicesByAdult: 0,
          options: ['bubbles', 'drum', 'pinwheel'],
          choices: [],
          primaryObserverId: null,
        },
        '2026-10-28T10:01:00.000Z',
      ),
    );

  it('без согласия и на паузе сегментов и «Кто ведёт» нет — выбирать нечего', async () => {
    await renderAba();
    await waitStatus('Нужно согласие на данные практики');
    expect([screen.queryByTestId('aba-mode'), screen.queryByTestId('aba-who-row')]).toEqual([null, null]);
    screen.unmount();
    await grant();
    await pair();
    await setAbaPaused(db, KID, true, iso());
    await renderAba();
    await waitStatus('На паузе');
    expect([screen.queryByTestId('aba-mode'), screen.queryByTestId('aba-who-row')]).toEqual([null, null]);
  });

  it('готово к занятию: «Со взрослым» выбран, «Кто ведёт» — «Не выбрано», «Сам» заблокирован с причиной, пока формат не освоен со взрослым', async () => {
    await grant();
    await pair();
    await renderAba();
    await waitStatus('Можно начинать');
    expect(segment('with_adult').props.accessibilityState).toMatchObject({ selected: true });
    expect(segment('alone').props.accessibilityState).toMatchObject({ selected: false, disabled: true });
    expect(segment('alone').props.accessibilityHint).toBe(ALONE_LOCKED);
    expect(screen.getByTestId('aba-hint').props.children).toBe(ALONE_LOCKED);
    expect(whoValue()).toBe('Не выбрано');
    // тап по заблокированному сегменту ничего не меняет: строка «Кто ведёт» остаётся
    await fireEvent.press(segment('alone'));
    expect(segment('with_adult').props.accessibilityState.selected).toBe(true);
    expect(whoValue()).toBe('Не выбрано');
  });

  it('цель освоена со взрослым по критерию — «Сам» доступен, причины нет; выбор «Сам» → «Кто ведёт» «не нужно», высота строки сохраняется', async () => {
    await grant();
    await pair();
    await setTargets({ [ABA_TARGETS[0].id]: markMastered(initialTargetState(ABA_TARGETS[0]), 1, 'criterion', 'with_adult') });
    await renderAba();
    await waitStatus('Можно начинать');
    expect(segment('alone').props.accessibilityState.disabled).toBeFalsy();
    expect(screen.queryByTestId('aba-hint')).toBeNull();
    expect(screen.getByTestId('aba-hint-slot')).toBeTruthy();
    await fireEvent.press(segment('alone'));
    expect(segment('alone').props.accessibilityState.selected).toBe(true);
    expect(whoValue()).toBe('не нужно');
    expect(screen.getByTestId('aba-who-row')).toBeTruthy();
  });

  it('«Сам» → «Начать»: наблюдателей нет, стор с «Сам», сразу /aba/session', async () => {
    await grant();
    await pair();
    await setTargets({ [ABA_TARGETS[0].id]: markMastered(initialTargetState(ABA_TARGETS[0]), 1, 'criterion', 'with_adult') });
    await renderAba();
    await waitStatus('Можно начинать');
    await fireEvent.press(segment('alone'));
    await fireEvent.press(screen.getByTestId('aba-start'));
    await waitFor(() => expectWentTo('/aba/session'));
    expect(useAbaRun.getState()).toMatchObject({ config: 'alone', observers: [], primaryObserverId: null });
    expect(await loadChildState(db, KID, 'abaObservers')).toBeUndefined();
  });

  it('до знакомства «Сам» доступен (сопряжение в «Сам» допустимо): «Начать знакомство» в «Сам» → /aba/pairing', async () => {
    await grant();
    await renderAba();
    await waitStatus(PAIRING_STATUS);
    expect(segment('alone').props.accessibilityState.disabled).toBeFalsy();
    expect(screen.queryByTestId('aba-hint')).toBeNull();
    await fireEvent.press(segment('alone'));
    await fireEvent.press(screen.getByTestId('aba-start'));
    await waitFor(() => expectWentTo('/aba/pairing'));
    expect(useAbaRun.getState().config).toBe('alone');
  });

  it('подсказка №166: две неудачи сопряжения в «Сам» — «лучше вместе» в слоте, «Со взрослым» предвыбран, «Сам» по-прежнему доступен', async () => {
    await grant();
    await pairingAloneMiss();
    await pairingAloneMiss();
    await renderAba();
    await waitStatus(PAIRING_STATUS);
    expect(screen.getByTestId('aba-hint').props.children).toBe(TOGETHER);
    expect(segment('with_adult').props.accessibilityState.selected).toBe(true);
    expect(segment('alone').props.accessibilityState.disabled).toBeFalsy();
  });

  it('«Со взрослым» и «Не выбрано»: «Начать» открывает лист с причиной, не идёт к ребёнку; «Готово» заполняет строку; второй тап запускает', async () => {
    await grant();
    await renderAba();
    await waitStatus(PAIRING_STATUS);
    await fireEvent.press(screen.getByTestId('aba-start'));
    expect(screen.getByTestId('aba-who-leads')).toBeTruthy();
    expect(screen.getByTestId('aba-who-caption').props.children).toBe('Отметьте, кто рядом с ребёнком');
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByTestId('aba-who-done').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByTestId('aba-role-parent'));
    await fireEvent.press(screen.getByTestId('aba-role-specialist'));
    expect(screen.getByTestId('aba-role-specialist').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('aba-role-parent').props.accessibilityState.selected).toBe(false);
    await fireEvent(screen.getByTestId('aba-trained-switch'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('aba-who-done'));
    expect(screen.queryByTestId('aba-who-leads')).toBeNull();
    expect(whoValue()).toBe('Специалист центра · обучен');
    expect(router.replace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('aba-start'));
    await waitFor(() => expectWentTo('/aba/pairing'));
    const run = useAbaRun.getState();
    expect(run.config).toBe('with_adult');
    expect(run.observers[0]).toMatchObject({ role: 'specialist', trained: true });
    expect(isUuidV4(run.observers[0].id)).toBe(true);
    expect(run.primaryObserverId).toBe(run.observers[0].id);
    expect(await loadChildState(db, KID, 'abaObservers')).toEqual(run.observers);
  });

  it('лист «Кто ведёт»: первый тап после открытия засчитывается (блокировки 500 мс нет), «Назад» закрывает без изменений', async () => {
    await grant();
    await renderAba();
    await waitStatus(PAIRING_STATUS);
    await fireEvent.press(screen.getByTestId('aba-who-row'));
    await fireEvent.press(screen.getByTestId('aba-role-parent'));
    expect(screen.getByTestId('aba-role-parent').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByTestId('aba-who-back'));
    expect(screen.queryByTestId('aba-who-leads')).toBeNull();
    expect(whoValue()).toBe('Не выбрано');
  });

  it('предвыбор прошлой сессии: строка заполнена, лист говорит «Как в прошлый раз», «Начать» — один тап, тот же id наблюдателя', async () => {
    await grant();
    await pair();
    await observers([{ id: 'obs-spec', role: 'specialist', trained: true }, { id: 'obs-1', role: 'parent', trained: false }]);
    await renderAba();
    await waitStatus('Можно начинать');
    await waitFor(() => expect(whoValue()).toBe('Специалист центра · обучен'));
    await fireEvent.press(screen.getByTestId('aba-who-row'));
    expect(screen.getByTestId('aba-who-caption').props.children).toBe('Как в прошлый раз');
    expect(screen.getByTestId('aba-role-specialist').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByTestId('aba-who-back'));
    await fireEvent.press(screen.getByTestId('aba-start'));
    await waitFor(() => expectWentTo('/aba/session'));
    expect(useAbaRun.getState().observers.map((o) => o.id)).toEqual(['obs-spec', 'obs-1']);
    expect(useAbaRun.getState().primaryObserverId).toBe('obs-spec');
  });

  it('смена роли на уже известную: наблюдатель поднимается первым с прежним id, второго такого не появляется', async () => {
    await grant();
    await pair();
    await observers([{ id: 'obs-spec', role: 'specialist', trained: true }, { id: 'obs-1', role: 'parent', trained: false }]);
    await renderAba();
    await waitStatus('Можно начинать');
    await fireEvent.press(screen.getByTestId('aba-who-row'));
    await fireEvent.press(screen.getByTestId('aba-role-parent'));
    // «обучен» — отдельный переключатель, со сменой роли сам не сбрасывается
    expect(screen.getByTestId('aba-trained-switch').props.value).toBe(true);
    await fireEvent(screen.getByTestId('aba-trained-switch'), 'valueChange', false);
    await fireEvent.press(screen.getByTestId('aba-who-done'));
    expect(whoValue()).toBe('Родитель');
    await fireEvent.press(screen.getByTestId('aba-start'));
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    expect((await loadChildState(db, KID, 'abaObservers'))!.map((o) => o.id)).toEqual(['obs-1', 'obs-spec']);
  });
});

describe('«Занятия ABA»: карточка «Цели» (этап G2, вопрос 66)', () => {
  const goal = (id: string) => screen.getByTestId(`aba-goal-${id}`);
  const goalStatus = (id: string) => screen.getByTestId(`aba-goal-${id}-value`).props.children as string;
  const setTargets = (states: Record<string, ReturnType<typeof initialTargetState>>) => asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'abaTargets', states, iso()));

  it('без согласия карточки нет', async () => {
    await renderAba();
    await waitStatus('Нужно согласие на данные практики');
    expect(screen.queryByTestId('aba-goals')).toBeNull();
  });

  it('согласие дано, занятий не было: одна первая цель «впереди» без глифа и подпись о первом занятии', async () => {
    await grant();
    await renderAba();
    await waitFor(() => expect(screen.getByTestId('aba-goals')).toBeTruthy());
    expect(goal('match-same-2')).toBeTruthy();
    expect(goalStatus('match-same-2')).toBe('впереди');
    expect(screen.getByTestId('aba-goal-match-same-2-glyph-ahead')).toBeTruthy();
    expect([screen.queryByTestId('aba-goal-match-same-3'), screen.queryByTestId('aba-goal-match-shape'), screen.queryByTestId('aba-goal-match-color')]).toEqual([null, null, null]);
    expect(screen.getByTestId('aba-goals-summary').props.children).toBe('Первое занятие покажет, что ребёнок уже умеет');
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('начатые цели в порядке лестницы со словом и глифом, следующая — «впереди», дальше ничего', async () => {
    await grant();
    await pair();
    const [same2, same3] = ABA_TARGETS;
    await setTargets({
      [same2.id]: markMastered(initialTargetState(same2), 1, 'criterion', 'with_adult'),
      [same3.id]: { ...initialTargetState(same3), phase: 'acquisition', lastSessionIndex: 1 },
    });
    await renderAba();
    await waitFor(() => expect(screen.getByTestId('aba-goals')).toBeTruthy());
    const rows = screen.getByTestId('aba-goals');
    expect([goalStatus('match-same-2'), goalStatus('match-same-3'), goalStatus('match-shape')]).toEqual(['освоено', 'учим', 'впереди']);
    expect(screen.getByTestId('aba-goal-match-same-2-glyph-mastered')).toBeTruthy();
    expect(screen.getByTestId('aba-goal-match-same-3-glyph-learning')).toBeTruthy();
    expect(screen.queryByTestId('aba-goal-match-color')).toBeNull();
    expect(screen.getByText('Одинаковые из двух')).toBeTruthy();
    expect(rows).toBeTruthy();
  });

  it('«почти» — половинный глиф: обучение с сессиями на критерии', async () => {
    await grant();
    await pair();
    const [same2] = ABA_TARGETS;
    await setTargets({ [same2.id]: { ...initialTargetState(same2), phase: 'acquisition', sessionsAtCriterion: 1, lastSessionIndex: 2 } });
    await renderAba();
    await waitFor(() => expect(screen.getByTestId('aba-goals')).toBeTruthy());
    expect(goalStatus('match-same-2')).toBe('почти');
    expect(screen.getByTestId('aba-goal-match-same-2-glyph-almost-half')).toBeTruthy();
  });

  it('после занятия — итог под строками: день словами отчёта, без проб — «без проб»', async () => {
    await grant();
    await pair();
    await sessionInProgress();
    await finishInProgressSession(db, KID, Date.now());
    await renderAba();
    await waitStatus('Можно начинать');
    await waitFor(() => expect(screen.getByTestId('aba-goals-summary').props.children).toBe('За занятие сегодня: без проб'));
  });

  it('цели — выбранного ребёнка: у второго без согласия карточки нет', async () => {
    await grant();
    await pair();
    useAccount.setState({ profiles: [p1, p2] });
    useParentView.setState({ childId: KID2 });
    await renderAba();
    await waitStatus('Нужно согласие на данные практики');
    expect(screen.queryByTestId('aba-goals')).toBeNull();
  });
});

describe('«Занятия ABA»: «Знакомство с жетонами уже пройдено» (сопряжение подтверждено, вопрос 62)', () => {
  const PAIRING_STATUS = 'Сначала знакомство с жетонами — короткое занятие без заданий';
  const trainingOf = (childId = KID) => loadChildState(db, childId, 'tokenTraining');

  it('без наблюдателей кнопки нет — только «Начать знакомство»', async () => {
    await grant();
    await renderAba();
    await waitStatus(PAIRING_STATUS);
    expect(screen.queryByTestId('aba-pairing-confirm')).toBeNull();
    expect(screen.queryByTestId('aba-pairing-confirm-caption')).toBeNull();
    expect(screen.getByTestId('aba-start')).toBeTruthy();
  });

  it('наблюдатель не обучен — кнопки нет', async () => {
    await grant();
    await observers(OBS);
    await renderAba();
    await waitStatus(PAIRING_STATUS);
    expect(screen.queryByTestId('aba-pairing-confirm')).toBeNull();
  });

  it('обученный наблюдатель и знакомство не пройдено — кнопка с подписью, «Начать знакомство» остаётся', async () => {
    await grant();
    await observers([{ id: 'obs-1', role: 'specialist', trained: true }]);
    await renderAba();
    await waitStatus(PAIRING_STATUS);
    expect(screen.getByTestId('aba-pairing-confirm').props.accessibilityLabel).toBe('Знакомство с жетонами уже пройдено');
    expect(screen.getByTestId('aba-pairing-confirm-caption')).toBeTruthy();
    expect(screen.getByTestId('aba-start').props.accessibilityLabel).toBe('Начать знакомство');
  });

  it('знакомство пройдено — кнопки нет и при обученном наблюдателе', async () => {
    await grant();
    await pair();
    await observers([{ id: 'obs-1', role: 'specialist', trained: true }]);
    await renderAba();
    await waitStatus('Можно начинать');
    expect(screen.queryByTestId('aba-pairing-confirm')).toBeNull();
  });

  it('нажатие без свежего PIN — лист PIN, в базе знакомство не отмечено', async () => {
    await grant();
    await observers([{ id: 'obs-1', role: 'specialist', trained: true }]);
    await renderAba();
    await waitStatus(PAIRING_STATUS);
    await fireEvent.press(screen.getByTestId('aba-pairing-confirm'));
    expect(screen.getByTestId('confirm-pin-sheet')).toBeTruthy();
    expect((await trainingOf())?.pairingDone ?? false).toBe(false);
    expect(statusText()).toBe(PAIRING_STATUS);
  });

  it('верный PIN — статус «Можно начинать», в базе pairingConfirmed с наблюдателем obs-1 и ролью владельца', async () => {
    await grant();
    await observers([{ id: 'obs-1', role: 'specialist', trained: true }]);
    await renderAba();
    await waitStatus(PAIRING_STATUS);
    await fireEvent.press(screen.getByTestId('aba-pairing-confirm'));
    await typePin(PIN);
    await waitStatus('Можно начинать');
    const t = await trainingOf();
    expect(t).toMatchObject({ pairingDone: true, stage: 1, pairingConfirmed: { observerId: 'obs-1', byRole: 'owner' } });
    expect(Date.parse(t!.pairingConfirmed!.at)).not.toBeNaN();
    expect(screen.queryByTestId('aba-pairing-confirm')).toBeNull();
    expect(screen.getByTestId('aba-start').props.accessibilityLabel).toBe('Начать занятие');
    expect([router.push.mock.calls.length, router.replace.mock.calls.length]).toEqual([0, 0]);
  });

  it('неверный PIN — лист остаётся, знакомство не отмечено', async () => {
    await grant();
    await observers([{ id: 'obs-1', role: 'specialist', trained: true }]);
    await renderAba();
    await waitStatus(PAIRING_STATUS);
    await fireEvent.press(screen.getByTestId('aba-pairing-confirm'));
    await typePin('000000');
    await waitFor(() => expect(screen.getByTestId('confirm-pin-error').props.children).toBe('Неверный PIN'));
    expect((await trainingOf())?.pairingDone ?? false).toBe(false);
    expect(screen.getByTestId('confirm-pin-sheet')).toBeTruthy();
  });

  it('«Отмена» на листе — знакомство не отмечено, кнопка на месте', async () => {
    await grant();
    await observers([{ id: 'obs-1', role: 'specialist', trained: true }]);
    await renderAba();
    await waitStatus(PAIRING_STATUS);
    await fireEvent.press(screen.getByTestId('aba-pairing-confirm'));
    await fireEvent.press(screen.getByTestId('confirm-pin-cancel'));
    expect(screen.queryByTestId('confirm-pin-sheet')).toBeNull();
    expect((await trainingOf())?.pairingDone ?? false).toBe(false);
    expect(screen.getByTestId('aba-pairing-confirm')).toBeTruthy();
  });

  it('в окне свежести PIN — сразу, без листа', async () => {
    await grant();
    await observers([{ id: 'obs-1', role: 'specialist', trained: true }]);
    useGate.getState().open();
    await renderAba();
    await waitStatus(PAIRING_STATUS);
    await fireEvent.press(screen.getByTestId('aba-pairing-confirm'));
    expect(screen.queryByTestId('confirm-pin-sheet')).toBeNull();
    await waitStatus('Можно начинать');
    expect((await trainingOf())?.pairingConfirmed?.observerId).toBe('obs-1');
  });

  it('подтверждение у выбранного ребёнка: у второго знакомство не отмечается', async () => {
    useAccount.setState({ profiles: [p1, p2] });
    await grant();
    await grant(KID2);
    await observers([{ id: 'obs-1', role: 'specialist', trained: true }]);
    await observers([{ id: 'obs-1', role: 'specialist', trained: true }], KID2);
    useGate.getState().open();
    await renderAba();
    await waitStatus(PAIRING_STATUS);
    await fireEvent.press(screen.getByTestId('aba-pairing-confirm'));
    await waitStatus('Можно начинать');
    expect((await trainingOf(KID2))?.pairingDone ?? false).toBe(false);
  });
});

describe('«Занятия ABA»: незаконченное занятие', () => {
  beforeEach(async () => {
    await grant();
    await pair();
    await sessionInProgress();
  });

  it('статус «Занятие не закончено», кнопки «Продолжить занятие» и «Закончить без продолжения»; вместо сегментов — строка «Режим»', async () => {
    await renderAba();
    await waitStatus('Занятие не закончено');
    expect(screen.getByTestId('aba-continue').props.accessibilityLabel).toBe('Продолжить занятие');
    expect(screen.getByTestId('aba-finish').props.accessibilityLabel).toBe('Закончить без продолжения');
    expect(screen.queryByTestId('aba-start')).toBeNull();
    expect([screen.queryByTestId('aba-mode'), screen.queryByTestId('aba-who-row')]).toEqual([null, null]);
    expect(screen.getByTestId('aba-mode-row-value').props.children).toBe('Со взрослым · Родитель');
  });

  it('«Продолжить» без свежего PIN — лист PIN, перехода до PIN нет', async () => {
    await renderAba();
    await waitStatus('Занятие не закончено');
    await fireEvent.press(screen.getByTestId('aba-continue'));
    expect(screen.getByTestId('confirm-pin-sheet')).toBeTruthy();
    expect([router.replace.mock.calls.length, router.dismissAll.mock.calls.length]).toEqual([0, 0]);
  });

  it('«Продолжить» → верный PIN → конфигурация из снимка в сторе, раздел закрыт, затем сразу /aba/session', async () => {
    await renderAba();
    await waitStatus('Занятие не закончено');
    await fireEvent.press(screen.getByTestId('aba-continue'));
    await typePin(PIN);
    await waitFor(() => expectWentTo('/aba/session'));
    expect(useAbaRun.getState()).toMatchObject({ config: 'with_adult', observers: OBS, primaryObserverId: 'obs-1' });
  });

  it('«Продолжить» → неверный PIN → перехода нет, лист остаётся', async () => {
    await renderAba();
    await waitStatus('Занятие не закончено');
    await fireEvent.press(screen.getByTestId('aba-continue'));
    await typePin('000000');
    await waitFor(() => expect(screen.getByTestId('confirm-pin-error').props.children).toBe('Неверный PIN'));
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirm-pin-sheet')).toBeTruthy();
  });

  it('«Продолжить» → лист закрыт «Отмена» → перехода нет', async () => {
    await renderAba();
    await waitStatus('Занятие не закончено');
    await fireEvent.press(screen.getByTestId('aba-continue'));
    await fireEvent.press(screen.getByTestId('confirm-pin-cancel'));
    expect(screen.queryByTestId('confirm-pin-sheet')).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('«Продолжить» в окне свежести PIN — сразу /aba/session, без листа', async () => {
    useGate.getState().open();
    await renderAba();
    await waitStatus('Занятие не закончено');
    await fireEvent.press(screen.getByTestId('aba-continue'));
    expect(screen.queryByTestId('confirm-pin-sheet')).toBeNull();
    expect(router.replace).toHaveBeenCalledWith('/aba/session');
  });

  it('«Закончить без продолжения» — снимок снят, сессия записана остановкой взрослого, статус «Можно начинать»', async () => {
    await renderAba();
    await waitStatus('Занятие не закончено');
    await fireEvent.press(screen.getByTestId('aba-finish'));
    await waitStatus('Можно начинать');
    expect((await loadChildState(db, KID, 'abaSessionInProgress')) ?? null).toBeNull();
    expect((await sessionsOf(db, KID)).map((s) => s.endReason)).toEqual(['adult_stopped']);
  });

  it('«Закончить без продолжения» — без PIN и без перехода', async () => {
    await renderAba();
    await waitStatus('Занятие не закончено');
    await fireEvent.press(screen.getByTestId('aba-finish'));
    await waitStatus('Можно начинать');
    expect(screen.queryByTestId('confirm-pin-sheet')).toBeNull();
    expect([router.replace.mock.calls.length, router.dismissAll.mock.calls.length]).toEqual([0, 0]);
  });

  it('запись итога не прошла (пауза поставлена в обход экрана) — «Не получилось…», снимок на месте', async () => {
    await renderAba();
    await waitStatus('Занятие не закончено');
    await setAbaPaused(db, KID, true, iso());
    await fireEvent.press(screen.getByTestId('aba-finish'));
    await waitFor(() => expect(screen.getByTestId('aba-error').props.children).toBe('Не получилось. Попробуйте ещё раз'));
    expect(await loadChildState(db, KID, 'abaSessionInProgress')).toBeDefined();
    expect(await sessionsOf(db, KID)).toEqual([]);
  });
});

describe('«Занятия ABA»: согласие, пауза, файл, отзыв', () => {
  it('строка «Согласие» без согласия — «Не спрашивали», ведёт на экран согласия', async () => {
    await renderAba();
    await waitFor(() => expect(screen.getByText('Не спрашивали')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('aba-consent-row'));
    expect(router.push).toHaveBeenCalledWith('/parent/aba/consent');
  });

  it('строка «Согласие» при согласии — «Действует»; при прежнем тексте — «Текст обновился»', async () => {
    await grant();
    await renderAba();
    await waitFor(() => expect(screen.getByText('Действует')).toBeTruthy());
    screen.unmount();
    await grantOutdated(KID2);
    useAccount.setState({ profiles: [p1, p2] });
    useParentView.setState({ childId: KID2 });
    await renderAba();
    await waitFor(() => expect(screen.getByText('Текст обновился')).toBeTruthy());
  });

  it('пауза выключена — включение пишет паузу без PIN, статус «На паузе»', async () => {
    await grant();
    await pair();
    await renderAba();
    await waitStatus('Можно начинать');
    expect(screen.getByTestId('aba-pause-toggle-switch').props.value).toBe(false);
    await fireEvent(screen.getByTestId('aba-pause-toggle-switch'), 'valueChange', true);
    await waitStatus('На паузе');
    expect(screen.queryByTestId('confirm-pin-sheet')).toBeNull();
    expect(await pausedInDb()).toBe(true);
    expect(screen.getByTestId('aba-pause-toggle-switch').props.value).toBe(true);
  });

  it('снятие паузы без свежего PIN — лист PIN, до PIN пауза в базе остаётся', async () => {
    await grant();
    await pair();
    await setAbaPaused(db, KID, true, iso());
    await renderAba();
    await waitStatus('На паузе');
    await fireEvent(screen.getByTestId('aba-pause-toggle-switch'), 'valueChange', false);
    expect(screen.getByTestId('confirm-pin-sheet')).toBeTruthy();
    expect(await pausedInDb()).toBe(true);
  });

  it('снятие паузы → верный PIN → пауза снята в базе, статус «Можно начинать»', async () => {
    await grant();
    await pair();
    await setAbaPaused(db, KID, true, iso());
    await renderAba();
    await waitStatus('На паузе');
    await fireEvent(screen.getByTestId('aba-pause-toggle-switch'), 'valueChange', false);
    await typePin(PIN);
    await waitStatus('Можно начинать');
    expect(await pausedInDb()).toBe(false);
  });

  it('снятие паузы → неверный PIN → пауза остаётся', async () => {
    await grant();
    await pair();
    await setAbaPaused(db, KID, true, iso());
    await renderAba();
    await waitStatus('На паузе');
    await fireEvent(screen.getByTestId('aba-pause-toggle-switch'), 'valueChange', false);
    await typePin('000000');
    await waitFor(() => expect(screen.getByTestId('confirm-pin-error').props.children).toBe('Неверный PIN'));
    expect(await pausedInDb()).toBe(true);
    expect(statusText()).toBe('На паузе');
  });

  it('снятие паузы в окне свежести PIN — сразу, без листа', async () => {
    await grant();
    await pair();
    await setAbaPaused(db, KID, true, iso());
    useGate.getState().open();
    await renderAba();
    await waitStatus('На паузе');
    await fireEvent(screen.getByTestId('aba-pause-toggle-switch'), 'valueChange', false);
    await waitStatus('Можно начинать');
    expect(screen.queryByTestId('confirm-pin-sheet')).toBeNull();
  });

  it('строка №150 о сроке хранения видна и при выключенной, и при включённой паузе', async () => {
    const line = 'Если 12 месяцев не было занятий, данные о ходе практики удалятся.';
    await grant();
    await pair();
    await renderAba();
    await waitStatus('Можно начинать');
    const off = screen.queryByText(line) !== null;
    await fireEvent(screen.getByTestId('aba-pause-toggle-switch'), 'valueChange', true);
    await waitStatus('На паузе');
    expect([off, screen.queryByText(line) !== null]).toEqual([true, true]);
  });

  it('пауза у одного ребёнка не ставит её другому', async () => {
    await grant();
    await grant(KID2);
    await renderAba();
    await waitFor(() => expect(screen.getByTestId('aba-pause-toggle-switch')).toBeTruthy());
    await fireEvent(screen.getByTestId('aba-pause-toggle-switch'), 'valueChange', true);
    await waitStatus('На паузе');
    expect([await pausedInDb(KID), await pausedInDb(KID2)]).toEqual([true, false]);
  });

  it('файл для специалиста — до PIN подпись о содержимом, лист PIN; после PIN — «Файл появится позже…»', async () => {
    await grant();
    await renderAba();
    await waitFor(() => expect(screen.getByTestId('aba-export')).toBeTruthy());
    expect(screen.getByTestId('aba-export-note').props.children).toBe('Что в файле: задания, подсказки, итоги занятий и выбор наград, без имени. Копии, отданные специалисту, приложение не удаляет.');
    await fireEvent.press(screen.getByTestId('aba-export'));
    expect(screen.getByTestId('confirm-pin-sheet')).toBeTruthy();
    expect(screen.getByTestId('aba-export-note').props.children).not.toBe('Файл появится позже, вместе с облачной копией.');
    await typePin(PIN);
    await waitFor(() => expect(screen.getByTestId('aba-export-note').props.children).toBe('Файл появится позже, вместе с облачной копией.'));
  });

  it('файл для специалиста в окне свежести PIN — сразу «появится позже», без листа', async () => {
    await grant();
    useGate.getState().open();
    await renderAba();
    await waitFor(() => expect(screen.getByTestId('aba-export')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('aba-export'));
    expect(screen.queryByTestId('confirm-pin-sheet')).toBeNull();
    expect(screen.getByTestId('aba-export-note').props.children).toBe('Файл появится позже, вместе с облачной копией.');
  });

  it('«Отозвать и удалить данные практики» ведёт в confirm с action aba_revoke', async () => {
    await grant();
    await renderAba();
    await waitFor(() => expect(screen.getByTestId('aba-revoke')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('aba-revoke'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/parent/confirm/[action]', params: { action: 'aba_revoke' } });
  });

  it('«Назад» — назад', async () => {
    await renderAba();
    await fireEvent.press(screen.getByTestId('aba-back'));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('всё про выбранного ребёнка: у второго без согласия — «Нужно согласие», хотя у первого оно есть', async () => {
    await grant();
    await pair();
    useAccount.setState({ profiles: [p1, p2] });
    useParentView.setState({ childId: KID2 });
    await renderAba();
    await waitStatus('Нужно согласие на данные практики');
    expect(screen.queryByTestId('aba-pause')).toBeNull();
  });

  it('без базы аккаунта экран пуст', async () => {
    useAccount.setState({ db: null });
    await renderAba();
    expect(screen.queryByTestId('parent-aba')).toBeNull();
  });

  /**
   * Баг: обзор читается только при монтировании (`useEffect` по `[db, childId]`). Экран согласия и экран отзыва
   * уходят `router.back()` — в стеке «Занятия ABA» остаются смонтированными, обзор не перечитывается: после
   * «Согласен» родитель видит «Нужно согласие» и «Прочитать согласие», хотя согласие уже записано (после отзыва
   * — наоборот, карточки паузы и отзыва при отозванном согласии). Нужна перечитка на фокус (`useFocusEffect`,
   * как в `app/map.tsx`). Мок `useFocusEffect` здесь ведёт себя как навигатор: вызов при монтировании и при
   * возврате.
   */
  it('возврат с экрана согласия: после «Согласен» статус обновляется без перезахода на экран', async () => {
    await renderAba();
    await waitStatus('Нужно согласие на данные практики');
    await grant(); // «Согласен» на экране согласия, затем router.back()
    await act(async () => focus.current?.());
    await waitStatus('Сначала знакомство с жетонами — короткое занятие без заданий');
  });

  /**
   * Баг: строка «Отозвать и удалить данные практики» показывается только при `consent === 'granted'`. При
   * согласии на прежний текст (`outdated`) данные практики на устройстве есть, но отозвать их негде: в «Согласиях»
   * раздела `aba_processing` нет, а ABA.md говорит «другого пути отзыва нет». Отзыв (`revokeAbaProcessing`) при
   * `outdated` работает — закрыт только вход.
   */
  it('текст согласия устарел, данные практики есть — отзыв доступен', async () => {
    await grantOutdated();
    await renderAba();
    await waitStatus('Текст согласия обновился — прочитайте его');
    expect(screen.getByTestId('aba-revoke')).toBeTruthy();
  });
});

describe('экран согласия на данные практики', () => {
  it('заголовок, текст, «Только на этом устройстве» и версия текста на языке экрана', async () => {
    await renderConsent();
    expect(screen.getByRole('header', { name: 'Согласие на данные практики' })).toBeTruthy();
    expect(screen.getByText('Только на этом устройстве')).toBeTruthy();
    expect(screen.getByTestId('aba-consent-version').props.children).toBe(`Текст ${abaConsentTextVersion('ru')}`);
  });

  it('по-английски — версия en-…', async () => {
    await renderConsent('en');
    expect(screen.getByTestId('aba-consent-version').props.children).toMatch(/ en-/);
  });

  it('«Согласен» без свежего PIN — лист PIN, до PIN согласия нет', async () => {
    await renderConsent();
    await fireEvent.press(screen.getByTestId('aba-agree'));
    expect(screen.getByTestId('confirm-pin-sheet')).toBeTruthy();
    expect((await abaOverview(db, KID)).consent).toBe('not_asked');
  });

  it('«Согласен» → верный PIN → согласие действует, назад', async () => {
    await renderConsent();
    await fireEvent.press(screen.getByTestId('aba-agree'));
    await typePin(PIN);
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect((await abaOverview(db, KID)).consent).toBe('granted');
  });

  it('событие согласия: этот ребёнок, владелец аккаунта, подтверждено PIN, версия показанного текста', async () => {
    await renderConsent();
    await fireEvent.press(screen.getByTestId('aba-agree'));
    await typePin(PIN);
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const ev = (await readConsentLog(db)).filter((e) => e.scope === 'aba_processing');
    expect(ev.map((e) => [e.action, e.childId, e.actorId, e.confirmedBy, e.textVersion])).toEqual([['grant', KID, accountId, 'pin', abaConsentTextVersion('ru')]]);
  });

  it('по-английски согласие записано с версией en-…, и она среди текущих', async () => {
    await renderConsent('en');
    await fireEvent.press(screen.getByTestId('aba-agree'));
    await typePin(PIN);
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const [ev] = (await readConsentLog(db)).filter((e) => e.scope === 'aba_processing');
    expect([ev.textVersion.startsWith('en-'), CURRENT_CONSENT_TEXTS.aba_processing.includes(ev.textVersion)]).toEqual([true, true]);
  });

  it('согласие даётся выбранному ребёнку, второму — нет', async () => {
    useAccount.setState({ profiles: [p1, p2] });
    useParentView.setState({ childId: KID2 });
    await renderConsent();
    await fireEvent.press(screen.getByTestId('aba-agree'));
    await typePin(PIN);
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect([(await abaOverview(db, KID)).consent, (await abaOverview(db, KID2)).consent]).toEqual(['not_asked', 'granted']);
  });

  it('«Согласен» в окне свежести PIN — без листа, согласие записано', async () => {
    useGate.getState().open();
    await renderConsent();
    await fireEvent.press(screen.getByTestId('aba-agree'));
    expect(screen.queryByTestId('confirm-pin-sheet')).toBeNull();
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await abaOverview(db, KID)).consent).toBe('granted');
  });

  it('«Согласен» → неверный PIN — согласия нет, назад не уходит', async () => {
    await renderConsent();
    await fireEvent.press(screen.getByTestId('aba-agree'));
    await typePin('000000');
    await waitFor(() => expect(screen.getByTestId('confirm-pin-error').props.children).toBe('Неверный PIN'));
    expect((await abaOverview(db, KID)).consent).toBe('not_asked');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('«Согласен» → лист закрыт «Отмена» — согласия нет, назад не уходит', async () => {
    await renderConsent();
    await fireEvent.press(screen.getByTestId('aba-agree'));
    await fireEvent.press(screen.getByTestId('confirm-pin-cancel'));
    expect((await abaOverview(db, KID)).consent).toBe('not_asked');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('«Не сейчас» — назад, согласия нет', async () => {
    await renderConsent();
    await fireEvent.press(screen.getByTestId('aba-not-now'));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect((await abaOverview(db, KID)).consent).toBe('not_asked');
  });

  it('прежний текст → «Согласен» с PIN → согласие снова действует', async () => {
    await grantOutdated();
    await renderConsent();
    await fireEvent.press(screen.getByTestId('aba-agree'));
    await typePin(PIN);
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await abaOverview(db, KID)).consent).toBe('granted');
  });
});

describe('подтверждение aba_revoke', () => {
  /** У ребёнка — согласие, знакомство, одно законченное занятие и одно в работе, пауза; плюс урок. У второго — своё. */
  async function withAbaData() {
    await grant();
    await pair();
    await sessionInProgress();
    await finishInProgressSession(db, KID, Date.now());
    await sessionInProgress();
    await setAbaPaused(db, KID, true, iso());
    await writeLessonRun(db, { id: 'lesson-1', childId: KID, lessonId: 'l', startedAt: iso(Date.now() - 3_600_000), taskSeconds: [10], reviewTasks: 0 });
    await grant(KID2);
    await pair(KID2);
    await sessionInProgress(KID2);
    await finishInProgressSession(db, KID2, Date.now());
  }

  const abaStateKeys = async (childId: string) =>
    (await db.all<{ key: string }>(`SELECT key FROM child_state WHERE child_id = ? AND key IN (${ABA_DELETED_KEYS.map(() => '?').join(', ')})`, [childId, ...ABA_DELETED_KEYS])).map((r) => r.key);

  it('заголовок «Отозвать согласие?», текст о том, что удалится, кнопка «Отозвать и удалить»; строки «Останется: ничего» нет', async () => {
    await grant();
    await renderRevoke();
    expect(screen.getByRole('header', { name: 'Отозвать согласие?' })).toBeTruthy();
    expect(screen.getByText(/Удалятся все записи практики этого ребёнка на устройстве/)).toBeTruthy();
    expect(screen.getByTestId('confirm-action').props.accessibilityLabel).toBe('Отозвать и удалить');
    expect(screen.queryByText('Останется: ничего')).toBeNull();
  });

  it('кнопка открывает лист PIN даже в окне свежести; до PIN данные на месте', async () => {
    await withAbaData();
    useGate.getState().open();
    await renderRevoke();
    await fireEvent.press(screen.getByTestId('confirm-action'));
    expect(screen.getByTestId('confirm-pin-sheet')).toBeTruthy();
    expect((await sessionsOf(db, KID)).length).toBe(1);
  });

  it('верный PIN → сессии и состояние ABA ребёнка удалены, согласие отозвано, назад', async () => {
    await withAbaData();
    await renderRevoke();
    await fireEvent.press(screen.getByTestId('confirm-action'));
    await typePin(PIN);
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect([await sessionsOf(db, KID), await abaStateKeys(KID), (await abaOverview(db, KID)).consent]).toEqual([[], [], 'revoked']);
  });

  it('событие отзыва: владелец аккаунта, подтверждено PIN, текущая версия текста', async () => {
    await withAbaData();
    await renderRevoke();
    await fireEvent.press(screen.getByTestId('confirm-action'));
    await typePin(PIN);
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const revokes = (await readConsentLog(db)).filter((e) => e.scope === 'aba_processing' && e.action === 'revoke');
    expect(revokes.map((e) => [e.childId, e.actorId, e.confirmedBy, e.textVersion])).toEqual([[KID, accountId, 'pin', abaConsentTextVersion('ru')]]);
  });

  it('отзыв не трогает уроки ребёнка и ABA другого ребёнка', async () => {
    await withAbaData();
    await renderRevoke();
    await fireEvent.press(screen.getByTestId('confirm-action'));
    await typePin(PIN);
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const lessons = await db.all<{ id: string }>('SELECT id FROM lesson_runs WHERE child_id = ?', [KID]);
    expect([lessons.map((r) => r.id), (await sessionsOf(db, KID2)).length, (await abaOverview(db, KID2)).consent]).toEqual([['lesson-1'], 1, 'granted']);
  });

  it('отзывается у выбранного ребёнка', async () => {
    await withAbaData();
    useAccount.setState({ profiles: [p1, p2] });
    useParentView.setState({ childId: KID2 });
    await renderRevoke();
    await fireEvent.press(screen.getByTestId('confirm-action'));
    await typePin(PIN);
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect([(await abaOverview(db, KID)).consent, (await abaOverview(db, KID2)).consent, (await sessionsOf(db, KID)).length]).toEqual(['granted', 'revoked', 1]);
  });

  it('неверный PIN — ничего не удалено, согласие действует', async () => {
    await withAbaData();
    await renderRevoke();
    await fireEvent.press(screen.getByTestId('confirm-action'));
    await typePin('000000');
    await waitFor(() => expect(screen.getByTestId('confirm-pin-error').props.children).toBe('Неверный PIN'));
    expect([(await sessionsOf(db, KID)).length, (await abaOverview(db, KID)).consent, router.back.mock.calls.length]).toEqual([1, 'granted', 0]);
  });

  it('«Отмена» — назад, ничего не удалено', async () => {
    await withAbaData();
    await renderRevoke();
    await fireEvent.press(screen.getByTestId('confirm-cancel'));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect([(await sessionsOf(db, KID)).length, await pausedInDb()]).toEqual([1, true]);
  });

  it('при прежнем тексте согласия отзыв тоже удаляет данные практики', async () => {
    await grantOutdated();
    await renderRevoke();
    await fireEvent.press(screen.getByTestId('confirm-action'));
    await typePin(PIN);
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await abaOverview(db, KID)).consent).toBe('revoked');
  });

  /**
   * Пробел против ABA.md («Согласие aba_processing»): «Перед отзывом экран показывает, сколько будет удалено, и
   * предлагает экспорт» (и `docs/design/aba-screens-2026-10-25.md` §1: «что удалится — числом проб и сессий»).
   * Экран `aba_revoke` показывает только общий текст `revokeBody`; `abaDataSummary` (purge.ts) есть, но не вызывается.
   */
  it('экран отзыва называет, сколько занятий удалится', async () => {
    await withAbaData();
    await renderRevoke();
    // одно законченное занятие (незаконченное — снимок, не сессия)
    await waitFor(() => expect(screen.getByText(/\b1\b/)).toBeTruthy());
  });
});
