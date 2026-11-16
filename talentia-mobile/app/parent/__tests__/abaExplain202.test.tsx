/**
 * Пояснения для взрослого (решение владельца №202, вопрос 116): введение «Как проходят занятия», строки карточки
 * «Где мы сейчас» по этапам и подпись взрослому на выборе награды. Роутер замокан; флаг введения — на `fakeDevice`.
 */
import AbaIntroScreen from '../aba/intro';
import { stageLines } from '../aba/index';
import type { ParentStageView } from '../../../src/domain/abaParentStage';
import { initI18n } from '../../../src/i18n';
import ru from '../../../src/i18n/locales/ru.json';
import { abaIntroSeen } from '../../../src/services/local/abaIntro';
import { useAccount } from '../../../src/state/account';
import { setDevice } from '../../../src/state/device';
import { fakeDevice } from '../../../src/test/fakeDevice';
import { fireEvent, renderWithProviders, screen, waitFor } from '../../../src/test/render';
import { parentButton } from '../../../src/design/parentTokens';
import { ParentThemeProvider } from '../../../src/ui/parent/theme';
import { ReinforcerChoiceView } from '../../../src/ui/aba/reinforcer';
import type { ChoiceRun } from '../../../src/ui/aba/model/reinforcerChoiceRun';

jest.mock('expo-router', () => {
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
  return { __router: router, useRouter: () => router };
});
const { __router: router } = jest.requireMock('expo-router') as { __router: { replace: jest.Mock; push: jest.Mock; back: jest.Mock; canGoBack: jest.Mock } };

const ACCOUNT = 'acc-202';
let device: ReturnType<typeof fakeDevice>;

beforeEach(() => {
  jest.clearAllMocks();
  router.canGoBack.mockReturnValue(true);
  device = fakeDevice();
  setDevice(device);
  useAccount.setState({ accountId: ACCOUNT });
});
afterEach(() => setDevice(null));

/** Кнопки раздела отбрасывают второй тап раньше `guardMs` (правка 9): между нажатиями — пауза. */
const pastGuard = () => new Promise((r) => setTimeout(r, parentButton.guardMs + 20));
const renderIntro = () => renderWithProviders(<ParentThemeProvider><AbaIntroScreen /></ParentThemeProvider>);

describe('введение «Как проходят занятия»', () => {
  it('четыре шага по порядку; «Понятно» на последнем отмечает введение и возвращает назад', async () => {
    await renderIntro();
    expect(screen.getByTestId('aba-intro-counter')).toHaveTextContent('1 из 4');
    expect(screen.getByTestId('aba-intro-step-1')).toBeTruthy();
    for (const n of [2, 3, 4]) {
      await pastGuard();
      await fireEvent.press(screen.getByTestId('aba-intro-next'));
      await waitFor(() => expect(screen.getByTestId(`aba-intro-step-${n}`)).toBeTruthy());
    }
    await pastGuard();
    await fireEvent.press(screen.getByTestId('aba-intro-done'));
    await waitFor(async () => expect(await abaIntroSeen(device, ACCOUNT)).toBe(true));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('«Назад» в шапке не отмечает введение: в следующий раз оно покажется снова', async () => {
    await renderIntro();
    await fireEvent.press(screen.getByTestId('aba-intro-close'));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(await abaIntroSeen(device, ACCOUNT)).toBe(false);
  });

  it('вернуться некуда (сборка «только ABA») — на «Занятия ABA», а не в пустоту', async () => {
    router.canGoBack.mockReturnValue(false);
    await renderIntro();
    await fireEvent.press(screen.getByTestId('aba-intro-close'));
    expect(router.replace).toHaveBeenCalledWith('/parent/aba');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('на шаге 2 «Назад» внизу возвращает на шаг 1', async () => {
    await renderIntro();
    expect(screen.queryByTestId('aba-intro-back')).toBeNull();
    await fireEvent.press(screen.getByTestId('aba-intro-next'));
    await pastGuard();
    await fireEvent.press(screen.getByTestId('aba-intro-back'));
    await waitFor(() => expect(screen.getByTestId('aba-intro-counter')).toHaveTextContent('1 из 4'));
  });
});

describe('stageLines — строки «Где мы сейчас»', () => {
  const t = (() => {
    const i18n = initI18n({ lng: 'ru' });
    return (k: string, o?: Record<string, unknown>) => i18n.t(k, o) as string;
  })();
  const view = (v: Partial<ParentStageView> & Pick<ParentStageView, 'stage'>): ParentStageView => ({ alsoTeaching: null, breakCardTraining: false, tokens: null, ...v });
  const W = ru.parent.aba.where;

  it('обучение на полосе 5–6: цель, перерыв до минуты, жетоны', () => {
    expect(stageLines(t, view({ stage: { kind: 'teaching', targetId: 'match-color', plannedBreak: true }, tokens: true }), '5-6')).toEqual([
      W.teaching.replace('{{target}}', 'По цвету'),
      W.plannedBreak60,
      W.tokens,
    ]);
  });

  it('обучение на полосе 7: перерыв до полутора минут; без планового перерыва строки о нём нет', () => {
    expect(stageLines(t, view({ stage: { kind: 'teaching', targetId: 'match-shape', plannedBreak: true }, tokens: true }), '7')).toContain(W.plannedBreak90);
    expect(stageLines(t, view({ stage: { kind: 'teaching', targetId: 'match-shape', plannedBreak: false }, tokens: true }), '7')).not.toContain(W.plannedBreak90);
  });

  it('смешанное занятие: первые пробы и обучение — обе строки и «будут жетоны», не «жетонов нет»', () => {
    const lines = stageLines(t, view({ stage: { kind: 'baseline', targetId: 'match-color' }, alsoTeaching: { targetId: 'match-same-2', plannedBreak: true }, tokens: true }), '5-6');
    expect(lines).toEqual([W.baseline.replace('{{target}}', 'По цвету'), W.teaching.replace('{{target}}', 'Одинаковые из двух'), W.plannedBreak60, W.tokens]);
  });

  it('повторение и «всё освоено» — без строки о жетонах', () => {
    expect(stageLines(t, view({ stage: { kind: 'maintenance', targetIds: ['match-same-2', 'match-same-3'] } }), '5-6')).toEqual([
      W.maintenance.replace('{{targets}}', 'Одинаковые из двух, Одинаковые из трёх'),
    ]);
    expect(stageLines(t, view({ stage: { kind: 'all_mastered' } }), '5-6')).toEqual([W.allMastered]);
  });

  it('знакомство 2 из 2 со сбросом серии', () => {
    expect(stageLines(t, view({ stage: { kind: 'pairing', n: 2, of: 2, reset: true } }), '5-6')).toEqual([
      W.pairing.replace('{{n}}', '2').replace('{{of}}', '2'),
      W.pairingReset,
      W.pairingLast,
      W.pairingRule,
    ]);
  });

  it('план не построился — строк нет', () => {
    expect(stageLines(t, view({ stage: { kind: 'unknown' } }), '5-6')).toEqual([]);
  });
});

describe('выбор награды: подпись взрослому', () => {
  const run = (over: Partial<ChoiceRun> = {}): ChoiceRun =>
    ({ config: 'with_adult', shownAt: 0, selected: null, by: null, firstTapAt: null, firstTapId: null, holdUntil: null, stripShownAt: null, pulsed: false, ...over }) as ChoiceRun;
  const renderChoice = (r: ChoiceRun, waitCaption?: string) =>
    renderWithProviders(<ReinforcerChoiceView run={r} options={['bubbles', 'pinwheel', 'kaleidoscope']} cardSize={120} boardCells={1} pulse={false} onTap={jest.fn()} onAdultTap={jest.fn()} waitCaption={waitCaption} />);

  it('пока ребёнок выбирает — подпись есть; после выбора и при полосе взрослого — нет', async () => {
    const { rerender } = await renderChoice(run(), ru.abaPanel.choiceWait);
    expect(screen.getByTestId('aba-choice-wait')).toHaveTextContent(ru.abaPanel.choiceWait);
    await rerender(<ReinforcerChoiceView run={run({ selected: 'bubbles', by: 'child' })} options={['bubbles', 'pinwheel', 'kaleidoscope']} cardSize={120} boardCells={1} pulse={false} onTap={jest.fn()} onAdultTap={jest.fn()} waitCaption={ru.abaPanel.choiceWait} />);
    expect(screen.queryByTestId('aba-choice-wait')).toBeNull();
    await rerender(<ReinforcerChoiceView run={run({ stripShownAt: 30_000 })} options={['bubbles', 'pinwheel', 'kaleidoscope']} cardSize={120} boardCells={1} pulse={false} onTap={jest.fn()} onAdultTap={jest.fn()} waitCaption={ru.abaPanel.choiceWait} />);
    expect(screen.queryByTestId('aba-choice-wait')).toBeNull();
    expect(screen.getByTestId('aba-adult-strip')).toBeTruthy();
  });

  it('без подписи (режим «Сам») — ничего', async () => {
    await renderChoice(run({ config: 'alone' }));
    expect(screen.queryByTestId('aba-choice-wait')).toBeNull();
  });
});
