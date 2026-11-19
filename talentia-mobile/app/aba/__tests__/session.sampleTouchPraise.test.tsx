/**
 * Шаг «коснись картинки» на экране занятия, правки 2026-11-19 (методист, `child-ux-specialist`): похвала на шаге — по
 * правилам обычной пробы без жетона (знак «принято» 0…1000, голос в 300 и не в спокойном режиме, следующая проба шага
 * в 2000); касание метки L1 — касание образца; «Отказ» и карточка «перерыв» во время похвалы; сворачивание на похвале.
 * Ручные часы и обвязка — `src/test/abaSessionHarness.tsx`; сам шаг — `session.sampleTouch.test.tsx`.
 */
import { StyleSheet } from 'react-native';

import { initialSampleTouch } from '../../../src/domain/abaSampleTouch';
import { loadChildState, saveChildState } from '../../../src/services/local/childState';
import { asAbaWriter } from '../../../src/services/local/__tests__/nodeSql';
import { voice } from '../../../src/services/voice';
import { useChildSession } from '../../../src/state/childSession';
import { act, fireEvent, screen, waitFor } from '../../../src/test/render';
import { PRAISE_KEYS } from '../../../src/ui/aba/praise';
import {
  KID,
  HIDDEN,
  clock,
  db,
  mount,
  stimOf,
  chooseFirst,
  skipCardTraining,
  registerAbaSessionHooks,
  registerPhase8Hooks,
  tick,
  stepTo,
  tickUntil,
  inTrial,
  snapshot,
  background,
  foreground,
  kill,
  gatedDb,
  count,
  sessions,
  toTrial,
  correctOption,
  acquisitionAtL0,
} from '../../../src/test/abaSessionHarness';

jest.setTimeout(60_000);

jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => undefined }));
jest.mock('../../../src/assets/registry', () => jest.requireActual<typeof import('../../../src/test/abaScreenMocks')>('../../../src/test/abaScreenMocks').registryWithArtTestIds());
jest.mock('../../../src/services/abaIds', () => jest.requireActual<typeof import('../../../src/test/abaScreenMocks')>('../../../src/test/abaScreenMocks').countingAbaIds());
jest.mock('expo-router', () => jest.requireActual<typeof import('../../../src/test/abaScreenMocks')>('../../../src/test/abaScreenMocks').expoRouterMock());

registerAbaSessionHooks();

let say: jest.SpyInstance;
beforeEach(async () => {
  // обвязка сеет шаг пройденным; здесь — снова не пройден
  await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'sampleTouch', initialSampleTouch(), new Date(clock.now()).toISOString()));
  say = jest.spyOn(voice, 'say');
});
afterEach(() => say.mockRestore());

const praiseSaid = () => say.mock.calls.filter(([key]) => (PRAISE_KEYS as readonly string[]).includes(String(key))).length;
const tokenSaid = () => say.mock.calls.filter(([key]) => key === 'abaSession.sound.token').length;
const mark = () => screen.queryByTestId('aba-praise-mark', HIDDEN) !== null;
const touchEvents = async () => ((await snapshot())?.events ?? []).filter((e) => e.kind === 'sample_touch');
const recorded = (n: number) => waitFor(async () => expect(await touchEvents()).toHaveLength(n));

async function toTouch() {
  await mount();
  await skipCardTraining();
  await chooseFirst();
  await waitFor(() => expect(screen.getByTestId('aba-touch')).toBeTruthy());
  expect(inTrial()).toBe(true);
}
/** Проба шага дошла до метки L1 (задержка полосы 5–6 — 4 с). */
async function toMark() {
  await toTouch();
  await tick(4000);
  await waitFor(() => expect(screen.getByTestId('aba-sample-mark')).toBeTruthy());
}
/** Касание на L1 записано, идёт похвала; возвращает момент записи `M` и образец пробы. */
async function touchedOnMark(testID = 'aba-sample') {
  await toMark();
  const sample = stimOf('aba-sample');
  say.mockClear();
  const M = clock.now();
  await fireEvent.press(screen.getByTestId(testID));
  await recorded(1);
  await waitFor(() => expect(mark()).toBe(true));
  // запись и первый кадр похвалы — в тот же момент часов
  expect(clock.now()).toBe(M);
  return { M, sample };
}
/** Следующая проба шага на экране: панель пробы и другой образец. */
async function nextTouchTrial(prev: string) {
  await waitFor(() => expect(inTrial()).toBe(true));
  expect(screen.getByTestId('aba-touch')).toBeTruthy();
  expect(screen.queryByTestId('aba-option-0')).toBeNull();
  expect(stimOf('aba-sample')).not.toBe(prev);
}

describe('похвала на шаге — как у обычной пробы без жетона', () => {
  it('касание на L1: знак «принято» сразу и до 1000, в 1000 уходит', async () => {
    const { M } = await touchedOnMark();
    await stepTo(M + 999);
    expect(mark()).toBe(true);
    await stepTo(M + 1000);
    expect(mark()).toBe(false);
  });

  it('касание на L1: голос похвалы — в 300, не раньше, и один раз', async () => {
    const { M } = await touchedOnMark();
    expect(praiseSaid()).toBe(0);
    await stepTo(M + 299);
    expect(praiseSaid()).toBe(0);
    await stepTo(M + 300);
    expect(praiseSaid()).toBe(1);
    await stepTo(M + 1999);
    expect(praiseSaid()).toBe(1);
    // жетона нет — и его звука нет
    expect(tokenSaid()).toBe(0);
  });

  it('касание на L1: следующая проба шага — в 2000, не раньше; до неё панель — только «Отказ», инструкции «Коснись» нет', async () => {
    const { M, sample } = await touchedOnMark();
    await stepTo(M + 1999);
    expect(inTrial()).toBe(false);
    expect(screen.getByTestId('aba-panel-refusal')).toBeTruthy();
    expect(await touchEvents()).toHaveLength(1);
    await stepTo(M + 2000);
    await nextTouchTrial(sample);
    // следующая проба началась ровно в 2000: часы не двигались дальше
    expect(clock.now()).toBe(M + 2000);
    expect(screen.getByTestId('aba-instruction').props.children).toBe('Коснись');
    expect(mark()).toBe(false);
  });

  it('запись касания на L1: подсказанное, без жетона', async () => {
    await touchedOnMark();
    expect(await touchEvents()).toEqual([expect.objectContaining({ levelUsed: 1, independent: false, outcome: 'touched' })]);
    expect((await snapshot())?.tokensEarned).toBe(0);
  });

  it('«Была подсказка» + касание на L0: знак «принято» 0…1000, голос в 300, следующая проба в 2000, жетона нет', async () => {
    await toTouch();
    const sample = stimOf('aba-sample');
    await tick(500);
    await fireEvent.press(screen.getByTestId('aba-panel-adult_prompted'));
    say.mockClear();
    const M = clock.now();
    await fireEvent.press(screen.getByTestId('aba-sample'));
    await recorded(1);
    await waitFor(() => expect(mark()).toBe(true));
    expect(await touchEvents()).toEqual([expect.objectContaining({ adultPrompted: true, independent: false, outcome: 'touched' })]);
    expect((await snapshot())?.tokensEarned).toBe(0);
    await stepTo(M + 299);
    expect(praiseSaid()).toBe(0);
    await stepTo(M + 300);
    expect(praiseSaid()).toBe(1);
    await stepTo(M + 999);
    expect(mark()).toBe(true);
    await stepTo(M + 1000);
    expect(mark()).toBe(false);
    await stepTo(M + 1999);
    expect(inTrial()).toBe(false);
    await stepTo(M + 2000);
    await nextTouchTrial(sample);
    expect(tokenSaid()).toBe(0);
  });

  it('спокойный режим: знак «принято» тот же 0…1000, голос не звучит вовсе, следующая проба — в 2000', async () => {
    const before = useChildSession.getState().settings;
    useChildSession.setState({ settings: { ...before, calmMode: true } });
    try {
      const { M, sample } = await touchedOnMark();
      await stepTo(M + 999);
      expect(mark()).toBe(true);
      await stepTo(M + 1000);
      expect(mark()).toBe(false);
      await stepTo(M + 1999);
      expect(inTrial()).toBe(false);
      expect(praiseSaid()).toBe(0);
      await stepTo(M + 2000);
      await nextTouchTrial(sample);
      expect(praiseSaid()).toBe(0);
    } finally {
      await act(async () => useChildSession.setState({ settings: before }));
    }
  });

  it('самостоятельное касание на L0 — жетон фазой участия со звуком жетона: знака «принято» и голоса похвалы нет', async () => {
    await toTouch();
    await tick(500);
    say.mockClear();
    await fireEvent.press(screen.getByTestId('aba-sample'));
    await recorded(1);
    expect(await touchEvents()).toEqual([expect.objectContaining({ levelUsed: 0, independent: true, outcome: 'touched' })]);
    const seen: boolean[] = [];
    for (let i = 0; i < 40; i += 1) {
      seen.push(mark());
      await tick(50);
    }
    expect(seen.includes(true)).toBe(false);
    expect(tokenSaid()).toBe(1);
    expect(praiseSaid()).toBe(0);
    // жетон выдан: с доской из одной ячейки он уже обменян — в счёт занятия вошёл
    expect((await snapshot())?.tokensEarned).toBe(1);
  });
});

describe('метка L1 над образцом — касание образца', () => {
  it('на L0 метки нет', async () => {
    await toTouch();
    expect(screen.queryByTestId('aba-sample-mark')).toBeNull();
  });

  it('касание метки закрывает пробу шага как касание на L1: «принято», не жетон; дальше — следующая проба в 2000', async () => {
    const { M, sample } = await touchedOnMark('aba-sample-mark');
    expect(await touchEvents()).toEqual([expect.objectContaining({ levelUsed: 1, independent: false, outcome: 'touched' })]);
    expect((await snapshot())?.tokensEarned).toBe(0);
    await stepTo(M + 2000);
    await nextTouchTrial(sample);
    expect(tokenSaid()).toBe(0);
  });

  it('касание метки и сразу образца — одна запись пробы, не две', async () => {
    await toMark();
    await fireEvent.press(screen.getByTestId('aba-sample-mark'));
    await fireEvent.press(screen.getByTestId('aba-sample'));
    await recorded(1);
    await tick(500);
    expect(await touchEvents()).toHaveLength(1);
  });
});

describe('метка над образцом в пробе match — касание образца, а не выбор', () => {
  beforeEach(async () => {
    // шаг пройден — занятие идёт сразу к пробам match; цель в обучении со старта L0: метка приходит как L1 наблюдения
    await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'sampleTouch', { ...initialSampleTouch(), passed: true }, new Date(clock.now()).toISOString()));
    await acquisitionAtL0(1);
  });

  it('касание метки открывает варианты и пробу не закрывает; ответ — только касание варианта, в записи два касания', async () => {
    await toTrial();
    expect(screen.queryByTestId('aba-sample-mark')).toBeNull();
    await tickUntil(() => screen.queryByTestId('aba-sample-mark') !== null, 500, 60);
    await fireEvent.press(screen.getByTestId('aba-sample-mark'));
    await tick(200);
    // касание метки выбором не стало: проба идёт, записи нет
    expect(await count('aba_trials')).toBe(0);
    expect(inTrial()).toBe(true);
    await fireEvent.press(screen.getByTestId(correctOption()));
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    const [row] = await db.all<{ body: string }>('SELECT body FROM aba_trials WHERE child_id = ?', [KID]);
    const trial = JSON.parse(row.body) as { chosenCardId: string; sampleCardId: string; tapCount: number; observingPrompted?: boolean; observingLatencyMs: number | null };
    expect(trial.chosenCardId).toBe(trial.sampleCardId);
    expect(trial.tapCount).toBe(2);
    expect(trial.observingPrompted).toBe(true);
    expect(trial.observingLatencyMs).not.toBeNull();
  });

  it('контроль: без касания образца или метки вариант ответом не становится', async () => {
    await toTrial();
    await tickUntil(() => screen.queryByTestId('aba-sample-mark') !== null, 500, 60);
    await fireEvent.press(screen.getByTestId(correctOption()));
    await tick(200);
    expect(await count('aba_trials')).toBe(0);
    expect(inTrial()).toBe(true);
  });
});

describe('карточка L4 на шаге: касание «рука в руке» — только контур', () => {
  const sampleStroke = () => StyleSheet.flatten(screen.getByTestId('aba-sample').props.style).borderWidth as number;

  it('касание образца на карточке L4 пробу не пишет и знака не даёт; «Сделали вместе» — запись уровня 4 без латентности', async () => {
    // физическая подсказка разрешена родителем: после модели без касания — карточка L4
    await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'physicalPromptAllowed', { value: true, setAt: new Date(clock.now()).toISOString(), setByRole: 'guardian' }, new Date(clock.now()).toISOString()));
    await toTouch();
    // L0 4 с → метка 5 с → модель 5 с → карточка L4 взрослому
    await tickUntil(() => screen.queryByTestId('aba-panel-l4_done') !== null, 500, 60);
    const before = sampleStroke();
    say.mockClear();
    await fireEvent.press(screen.getByTestId('aba-sample'));
    await tick(500);
    expect(sampleStroke()).toBe(6);
    expect(before).toBeLessThan(6);
    expect(await touchEvents()).toHaveLength(0);
    expect(mark()).toBe(false);
    expect(say).not.toHaveBeenCalled();
    expect(screen.getByTestId('aba-panel-l4_done')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('aba-panel-l4_done'));
    await recorded(1);
    const [e] = (await touchEvents()) as unknown as { levelUsed: number; outcome: string; independent: boolean; latencyMs?: number | null }[];
    expect(e).toMatchObject({ levelUsed: 4, outcome: 'l4_done', independent: false });
    expect(e.latencyMs ?? null).toBeNull();
    expect((await snapshot())?.tokensEarned).toBe(0);
  });
});

describe('во время похвалы шага', () => {
  it('повторное касание образца и метки второй записи не даёт и срок следующей пробы не сдвигает', async () => {
    const { M, sample } = await touchedOnMark();
    await stepTo(M + 400);
    await fireEvent.press(screen.getByTestId('aba-sample'));
    await fireEvent.press(screen.getByTestId('aba-sample-mark'));
    await stepTo(M + 1999);
    expect(await touchEvents()).toHaveLength(1);
    expect(inTrial()).toBe(false);
    await stepTo(M + 2000);
    await nextTouchTrial(sample);
    expect(praiseSaid()).toBe(1);
  });

  it('«Отказ» — отказ вне пробы: записан ход согласия, проба шага осталась «коснулся», второй пробы и отказа в ней нет', async () => {
    const { M } = await touchedOnMark();
    await stepTo(M + 500);
    await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
    // отказ вне пробы кончает занятие (`withdrawAssent`): итог записан, снимка «в работе» больше нет
    await waitFor(async () => expect(await sessions()).toHaveLength(1));
    const [done] = (await sessions()) as unknown as { endReason: string; events: { kind: string; by?: string; action?: string; outcome?: string; levelUsed?: number }[] }[];
    expect(done.endReason).toBe('assent_withdrawn');
    // отказ на похвале шага относится к требованию шага: отметка места — в «тревожность» шага (методист 2026-11-19)
    expect(done.events.filter((e) => e.kind === 'assent')).toEqual([expect.objectContaining({ by: 'adult_observed', action: 'end', step: 'sample_touch' })]);
    // проба шага осталась «коснулся» на L1: отказ не лёг поверх записи и второй пробы не дал
    expect(done.events.filter((e) => e.kind === 'sample_touch')).toEqual([expect.objectContaining({ outcome: 'touched', levelUsed: 1 })]);
    // похвала оборвана: знак ушёл, голос после отказа не догоняет
    const saidBefore = praiseSaid();
    await tick(3000);
    expect(mark()).toBe(false);
    expect(praiseSaid()).toBe(saidBefore);
    expect(screen.queryByTestId('aba-touch')).toBeNull();
    expect(await sessions()).toHaveLength(1);
  });

  it('«Отказ» до голоса (в 100 мс): похвала голосом уже не звучит', async () => {
    const { M } = await touchedOnMark();
    await stepTo(M + 100);
    await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
    await waitFor(async () => expect(await sessions()).toHaveLength(1));
    await tick(3000);
    expect(praiseSaid()).toBe(0);
  });

  it('«Отказ»: экран не зависает — занятие доходит до «Закончили», проб match не было; шаг пройденным не записан', async () => {
    const { M } = await touchedOnMark();
    await stepTo(M + 500);
    await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
    await tickUntil(() => screen.queryByTestId(/^aba-end-(normal|neutral)$/) !== null, 500, 200);
    expect(screen.queryByTestId('aba-option-0')).toBeNull();
    expect(await count('aba_trials')).toBe(0);
    expect((await loadChildState(db, KID, 'sampleTouch'))?.passed).toBe(false);
  });

  it('карточка «перерыв» — просьба не теряется (№160): похвала доигрывает, в 2000 вместо следующей пробы шага — перерыв', async () => {
    const { M } = await touchedOnMark();
    await stepTo(M + 500);
    await fireEvent.press(screen.getByTestId('aba-break-card'));
    await tick(0);
    // до срока — ещё похвала: перерыва на экране нет, новой пробы тоже
    expect(screen.queryByTestId('aba-break')).toBeNull();
    await stepTo(M + 1999);
    expect(screen.queryByTestId('aba-break')).toBeNull();
    expect(inTrial()).toBe(false);
    await stepTo(M + 2000);
    await waitFor(() => expect(screen.getByTestId('aba-break')).toBeTruthy());
    expect(inTrial()).toBe(false);
    await waitFor(async () => expect((await snapshot())?.breakStartedAt ?? null).not.toBeNull());
    // просьба записана ходом согласия ребёнка с отметкой шага
    const events = ((await snapshot())?.events ?? []) as { kind: string; by?: string; action?: string; step?: string }[];
    expect(events.filter((e) => e.kind === 'assent')).toEqual([expect.objectContaining({ by: 'child_card', action: 'break', step: 'sample_touch' })]);
  });
});

describe('сворачивание на похвале шага (фаза 8)', () => {
  registerPhase8Hooks();

  it('фон на похвале → возврат: следующая проба шага, записанная проба одна, знак и голос не возвращаются', async () => {
    const { M, sample } = await touchedOnMark();
    await stepTo(M + 200);
    await background();
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    await tick(30_000);
    // в фоне похвала не доигрывает
    expect(praiseSaid()).toBe(0);
    await foreground();
    await nextTouchTrial(sample);
    expect(screen.queryByTestId('aba-away')).toBeNull();
    expect(mark()).toBe(false);
    expect(await touchEvents()).toHaveLength(1);
    expect(praiseSaid()).toBe(0);
  });

  it('после возврата шаг живой: касание пишет вторую пробу, лестница идёт заново с L0', async () => {
    const { M, sample } = await touchedOnMark();
    await stepTo(M + 1200);
    await background();
    await tick(10_000);
    await foreground();
    await nextTouchTrial(sample);
    expect(screen.queryByTestId('aba-sample-mark')).toBeNull();
    await tick(4000);
    await waitFor(() => expect(screen.getByTestId('aba-sample-mark')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('aba-sample'));
    await recorded(2);
    await waitFor(() => expect(mark()).toBe(true));
  });

  it('фон за миг до срока следующей пробы (1999) и возврат: проба шага одна и та же, не пропущена и не задвоена', async () => {
    const { M, sample } = await touchedOnMark();
    await stepTo(M + 1999);
    await background();
    await tick(5000);
    await foreground();
    await nextTouchTrial(sample);
    const second = stimOf('aba-sample');
    expect(await touchEvents()).toHaveLength(1);
    // ещё уход и возврат уже в новой пробе — образец тот же
    await background();
    await tick(5000);
    await foreground();
    await waitFor(() => expect(inTrial()).toBe(true));
    expect(stimOf('aba-sample')).toBe(second);
    expect(await touchEvents()).toHaveLength(1);
  });

  it('фон, пока пишется шаг, взятый в срок 2000: на возврате — следующая проба шага, не пропущена и не задвоена', async () => {
    const g = gatedDb();
    const { M, sample } = await touchedOnMark();
    await stepTo(M + 1999);
    g.close();
    // срок 2000: следующий шаг домена взят, его снимок ждёт записи
    await tick(1);
    await background();
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    await g.open();
    await tick(5000);
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    await foreground();
    await nextTouchTrial(sample);
    const second = stimOf('aba-sample');
    expect(await touchEvents()).toHaveLength(1);
    // шаг живой и образец закреплён: ещё уход и возврат — та же проба
    await background();
    await tick(5000);
    await foreground();
    await waitFor(() => expect(inTrial()).toBe(true));
    expect(stimOf('aba-sample')).toBe(second);
  });

  it('приложение убито на похвале → холодный старт: следующая проба шага, записанная проба не потеряна', async () => {
    const { M, sample } = await touchedOnMark();
    await stepTo(M + 500);
    await kill(20_000);
    await mount();
    await nextTouchTrial(sample);
    expect(mark()).toBe(false);
    expect(await touchEvents()).toHaveLength(1);
  });

  it('фон, пока проба шага ещё пишется: запись ложится, похвала в фоне не всплывает, на возврате — следующая проба', async () => {
    const g = gatedDb();
    await toMark();
    const sample = stimOf('aba-sample');
    say.mockClear();
    g.close();
    await fireEvent.press(screen.getByTestId('aba-sample'));
    expect(await touchEvents()).toHaveLength(0);
    await background();
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    await g.open();
    await recorded(1);
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    expect(mark()).toBe(false);
    await tick(10_000);
    expect(praiseSaid()).toBe(0);
    await foreground();
    await nextTouchTrial(sample);
    expect(await touchEvents()).toHaveLength(1);
  });
});
