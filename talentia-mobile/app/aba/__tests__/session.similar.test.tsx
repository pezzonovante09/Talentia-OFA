/**
 * Проба «похожее, но не такое же» (№206) на экране занятия: сверху — показанный образец (`sampleShownId`, второй рисунок
 * предмета), в поле — карточки `field` без вторых рисунков; касание верной карточки (не такой же, как образец)
 * записывает самостоятельный верный ответ с показанным образцом. Обвязка — `src/test/abaSessionHarness.tsx`.
 *
 * Цель открыта заглушками разработчика: в Jest `__DEV__` включён, экран зовёт старт без `art` (`artFor`, `abaStart.ts`).
 * Вторых рисунков в реестре нет — образец на плите рисуется заглушкой с `testID="aba-stub-<id>"`.
 */
import { ABA_TARGETS } from '../../../src/content/aba';
import { markMastered } from '../../../src/domain/abaCriterion';
import { initialTargetState } from '../../../src/domain/abaPrompting';
import { initialTokenTraining } from '../../../src/domain/abaTokenTraining';
import { saveChildState } from '../../../src/services/local/childState';
import { asAbaWriter } from '../../../src/services/local/__tests__/nodeSql';
import type { AbaTargetState, AbaTrial } from '../../../src/types/aba';
import { fireEvent, screen, waitFor } from '../../../src/test/render';
import { KID, clock, db, count, stimOf, toTrial, answerRight, inTrial, tick, tickUntil, snapshot, iso, registerAbaSessionHooks } from '../../../src/test/abaSessionHarness';

jest.setTimeout(60_000);

jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => undefined }));
jest.mock('../../../src/assets/registry', () => jest.requireActual<typeof import('../../../src/test/abaScreenMocks')>('../../../src/test/abaScreenMocks').registryWithArtTestIds());
jest.mock('../../../src/services/abaIds', () => jest.requireActual<typeof import('../../../src/test/abaScreenMocks')>('../../../src/test/abaScreenMocks').countingAbaIds());
jest.mock('expo-router', () => jest.requireActual<typeof import('../../../src/test/abaScreenMocks')>('../../../src/test/abaScreenMocks').expoRouterMock());

registerAbaSessionHooks();

const SIMILAR = 'match-similar-3';
const target = (id: string) => ABA_TARGETS.find((t) => t.id === id)!;
const mastered = (id: string): AbaTargetState => markMastered(initialTargetState(target(id)), 0, 'criterion', 'with_adult');
const mixedDone = { mixedCheck: { days: ['2026-11-17', '2026-11-18'], done: true as const } };

/** Лестница освоена целиком, «похожее» — в обучении без подсказки; доска из трёх ячеек (жетон не ведёт к обмену). */
beforeEach(async () => {
  const at = iso(clock.now());
  const states: Record<string, AbaTargetState> = {
    'match-same-2': mastered('match-same-2'),
    'match-same-3': mastered('match-same-3'),
    'match-shape': { ...mastered('match-shape'), ...mixedDone },
    'match-color-3': { ...mastered('match-color-3'), ...mixedDone },
    [SIMILAR]: { ...initialTargetState(target(SIMILAR)), phase: 'acquisition', startPromptLevel: 0, lastSuccessfulPromptLevel: 0 },
  };
  await asAbaWriter(db, KID, async (tx) => {
    await saveChildState(tx, KID, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage: 3 }, at);
    await saveChildState(tx, KID, 'abaTargets', states, at);
  });
});

type Head = { targetId: string; field: string[]; sampleCardId: string; sampleShownId?: string };
/** Проба в голове очереди снимка — то, что домен отдал экрану. */
const head = async (): Promise<Head | null> => {
  const q = (await snapshot())?.queue[0];
  return q?.kind === 'trial' ? (q.trial as Head) : null;
};
const trialRows = async () => (await db.all<{ body: string }>('SELECT body FROM aba_trials WHERE child_id = ? ORDER BY seq', [KID])).map((r) => JSON.parse(r.body) as AbaTrial);
const optionStims = () => [0, 1, 2].filter((i) => screen.queryByTestId(`aba-option-${i}`)).map((i) => stimOf(`aba-option-${i}`));

/** До первой пробы «похожего»: пробы разогрева на освоенном — верно, как ребёнок. */
async function toSimilarTrial(): Promise<Head> {
  await toTrial();
  for (let i = 0; i < 6; i += 1) {
    const h = await head();
    if (h?.targetId === SIMILAR) return h;
    const before = await count('aba_trials');
    await answerRight();
    await waitFor(async () => expect(await count('aba_trials')).toBe(before + 1));
    await tickUntil(() => !inTrial());
    await tickUntil(() => inTrial() && screen.queryByTestId('aba-sample') !== null);
  }
  throw new Error('проба «похожего» не встретилась');
}

it('сверху — показанный образец (второй рисунок), в поле — карточки поля без вторых рисунков', async () => {
  const h = await toSimilarTrial();
  expect(h.sampleShownId).toBe(`${h.sampleCardId}-b`);
  expect(stimOf('aba-sample')).toBe(h.sampleShownId);
  expect(optionStims()).toEqual(h.field);
  expect(optionStims()).toContain(h.sampleCardId);
  expect(optionStims().filter((id) => id.endsWith('-b'))).toEqual([]);
  // такого же, как образец, в поле нет — «найди такую же» по картинке не решается, только по предмету
  expect(optionStims()).not.toContain(stimOf('aba-sample'));
});

it('касание образца и верной карточки — проба записана: показанный образец, выбор — верная карточка, ответ самостоятельный', async () => {
  const h = await toSimilarTrial();
  const before = await count('aba_trials');
  await fireEvent.press(screen.getByTestId('aba-sample'));
  await fireEvent.press(screen.getByTestId(`aba-option-${h.field.indexOf(h.sampleCardId)}`));
  await waitFor(async () => expect(await count('aba_trials')).toBe(before + 1));
  const trial = (await trialRows()).at(-1)!;
  expect(trial).toMatchObject({ targetId: SIMILAR, kind: 'teaching', field: h.field, sampleCardId: h.sampleCardId, sampleShownId: h.sampleShownId, chosenCardId: h.sampleCardId, response: 'independent' });
});

it('касание соседней карточки — ошибка, а не верный ответ: верная — только карточка с парой', async () => {
  const h = await toSimilarTrial();
  const before = await count('aba_trials');
  const wrong = h.field.findIndex((c) => c !== h.sampleCardId);
  await fireEvent.press(screen.getByTestId('aba-sample'));
  await fireEvent.press(screen.getByTestId(`aba-option-${wrong}`));
  // запись пробы с ошибкой — после её коррекции: часы идут, пока проба не записана
  for (let i = 0; i < 200 && (await count('aba_trials')) === before; i += 1) await tick(250);
  const trial = (await trialRows()).at(-1)!;
  expect(trial.targetId).toBe(SIMILAR);
  expect(trial.sampleShownId).toBe(h.sampleShownId);
  expect(trial.response).not.toBe('independent');
});

it('цель без пар рядом (проба разогрева): сверху — сама верная карточка, показанного образца в записи нет', async () => {
  await toTrial();
  const h = await head();
  expect(h?.targetId).not.toBe(SIMILAR);
  expect(h?.sampleShownId).toBeUndefined();
  expect(stimOf('aba-sample')).toBe(h?.sampleCardId);
  await answerRight();
  await waitFor(async () => expect(await count('aba_trials')).toBe(1));
  expect((await trialRows())[0].sampleShownId).toBeUndefined();
});
