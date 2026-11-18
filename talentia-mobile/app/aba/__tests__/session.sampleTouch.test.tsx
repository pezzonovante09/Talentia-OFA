/**
 * Шаг «коснись картинки» на экране занятия (решение 1, часть В): после выбора подкрепителя ребёнку с непройденным шагом —
 * только образец и «Коснись»; L0 сам — жетон, L1 — метка над образцом, L3 — модель; 5 самостоятельных подряд — шаг
 * пройден, дальше пробы `match`; «Отказ» кончает шаг на сегодня. Обвязка — `src/test/abaSessionHarness.tsx` (она сеет
 * шаг пройденным; здесь — снова не пройден).
 */
import { initialSampleTouch } from '../../../src/domain/abaSampleTouch';
import { loadChildState, saveChildState } from '../../../src/services/local/childState';
import { asAbaWriter } from '../../../src/services/local/__tests__/nodeSql';
import { fireEvent, screen, waitFor } from '../../../src/test/render';
import { KID, HIDDEN, clock, db, mount, chooseFirst, skipCardTraining, registerAbaSessionHooks, tick, holdExit, snapshot } from '../../../src/test/abaSessionHarness';

jest.setTimeout(60_000);

jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => undefined }));
jest.mock('../../../src/assets/registry', () => jest.requireActual<typeof import('../../../src/test/abaScreenMocks')>('../../../src/test/abaScreenMocks').registryWithArtTestIds());
jest.mock('../../../src/services/abaIds', () => jest.requireActual<typeof import('../../../src/test/abaScreenMocks')>('../../../src/test/abaScreenMocks').countingAbaIds());
jest.mock('expo-router', () => jest.requireActual<typeof import('../../../src/test/abaScreenMocks')>('../../../src/test/abaScreenMocks').expoRouterMock());

registerAbaSessionHooks();

beforeEach(async () => {
  await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'sampleTouch', initialSampleTouch(), new Date(clock.now()).toISOString()));
});

async function toTouch() {
  await mount();
  await skipCardTraining();
  await chooseFirst();
  await waitFor(() => expect(screen.getByTestId('aba-touch')).toBeTruthy());
}

/** Касание образца сразу и всё последствие (жетон, обмен и доступ на доске из одной ячейки) — до следующей пробы шага или `match`. */
async function touchNow() {
  await fireEvent.press(screen.getByTestId('aba-sample'));
  for (let i = 0; i < 200 && !screen.queryByTestId('aba-touch') && !screen.queryByTestId('aba-option-0'); i += 1) await tick(500);
}

it('после выбора — только образец и «Коснись», без вариантов; панель — «Была подсказка» и «Отказ»', async () => {
  await toTouch();
  expect(screen.getByTestId('aba-sample')).toBeTruthy();
  expect(screen.queryByTestId('aba-option-0')).toBeNull();
  expect(screen.getByTestId('aba-instruction').props.children).toBe('Коснись');
  expect(screen.getByTestId('aba-panel-adult_prompted')).toBeTruthy();
  expect(screen.getByTestId('aba-panel-refusal')).toBeTruthy();
  expect(screen.queryByTestId('aba-hint-chevron')).toBeNull();
});

it('лестница без L2: через задержку — метка над образцом, ещё через окно — модель', async () => {
  await toTouch();
  await tick(4000);
  await waitFor(() => expect(screen.getByTestId('aba-hint-chevron')).toBeTruthy());
  expect(screen.queryByTestId('aba-touch-model')).toBeNull();
  await tick(5000);
  await waitFor(() => expect(screen.getByTestId('aba-touch-model')).toBeTruthy());
});

it('касание на метке — знак «принято», без жетона', async () => {
  await toTouch();
  await tick(4000);
  await waitFor(() => expect(screen.getByTestId('aba-hint-chevron')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('aba-sample'));
  await waitFor(() => expect(screen.getByTestId('aba-praise-mark', HIDDEN)).toBeTruthy());
  const s = await snapshot();
  expect(s?.events.filter((e) => e.kind === 'sample_touch')).toEqual([expect.objectContaining({ levelUsed: 1, independent: false, outcome: 'touched' })]);
  expect(s?.tokensEarned).toBe(0);
});

it('5 самостоятельных подряд — шаг пройден, дальше проба match; после занятия шаг записан пройденным', async () => {
  await toTouch();
  for (let i = 0; i < 5; i += 1) {
    await waitFor(() => expect(screen.getByTestId('aba-touch')).toBeTruthy());
    await touchNow();
  }
  await waitFor(() => expect(screen.getByTestId('aba-option-0')).toBeTruthy());
  const s = await snapshot();
  expect(s?.events.filter((e) => e.kind === 'sample_touch' && e.independent)).toHaveLength(5);
  expect(s?.sampleTouch?.passed).toBe(true);
  await holdExit();
  await waitFor(async () => expect((await loadChildState(db, KID, 'sampleTouch'))?.passed).toBe(true));
});

it('«Отказ» в пробе шага — шаг на сегодня кончен, match нет: занятие кончается', async () => {
  await toTouch();
  await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
  for (let i = 0; i < 80 && !screen.queryByTestId(/^aba-end-(normal|neutral)$/); i += 1) await tick(500);
  expect(screen.getByTestId(/^aba-end-(normal|neutral)$/)).toBeTruthy();
  expect(screen.queryByTestId('aba-option-0')).toBeNull();
  const st = await loadChildState(db, KID, 'sampleTouch');
  expect(st).toMatchObject({ passed: false, sessionsTried: 1 });
});
