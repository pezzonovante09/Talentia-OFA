/**
 * Пояснения для взрослого (решение владельца №202, вопрос 116): введение «Как проходят занятия», строки карточки
 * «Где мы сейчас» по этапам, полоса этапов (№203) и подпись взрослому на выборе награды. Роутер замокан; флаг введения — на `fakeDevice`.
 */
import { StyleSheet } from 'react-native';

import AbaIntroScreen, { INTRO_STEP_TONE } from '../aba/intro';
import { stageLines } from '../aba/index';
import { abaAdultSheet } from '../../../src/design/abaTokens';
import type { ParentStageView } from '../../../src/domain/abaParentStage';
import { initI18n } from '../../../src/i18n';
import en from '../../../src/i18n/locales/en.json';
import ru from '../../../src/i18n/locales/ru.json';
import { abaIntroSeen } from '../../../src/services/local/abaIntro';
import { useAccount } from '../../../src/state/account';
import { setDevice } from '../../../src/state/device';
import { fakeDevice } from '../../../src/test/fakeDevice';
import { fireEvent, renderWithProviders, screen, waitFor, within } from '../../../src/test/render';
import { contrast, SHAPE_CONTRAST, TEXT_CONTRAST } from '../../../src/design/contrast';
import { parentButton, parentCard, parentColors, parentFontScaleMax, parentSpacing, parentStageStrip, parentTypography } from '../../../src/design/parentTokens';
import { textEm } from '../../../src/test/fontMetrics';
import { fontFamilyFor } from '../../../src/ui/fonts';
import { STAGE_STEPS, StageStrip, stageStepOf, stageStepState } from '../../../src/ui/parent/StageStrip';
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

  it('шаги — тонированные блоки (№203): шаг 2 — правило взрослому, остальные — объяснение', async () => {
    await renderIntro();
    const fill = (n: number) => StyleSheet.flatten(screen.getByTestId(`aba-intro-step-${n}`).props.style).backgroundColor;
    expect(fill(1)).toBe(parentColors.light.blockExplain);
    for (const n of [2, 3, 4]) {
      await pastGuard();
      await fireEvent.press(screen.getByTestId('aba-intro-next'));
      await waitFor(() => expect(screen.getByTestId(`aba-intro-step-${n}`)).toBeTruthy());
      expect(fill(n)).toBe(n === 2 ? parentColors.light.blockRule : parentColors.light.blockExplain);
    }
    expect(INTRO_STEP_TONE).toEqual({ 1: 'explain', 2: 'rule', 3: 'explain', 4: 'explain' });
  });

  it('шаг 2: два запрета-иконки с фрагментами текста шага; врезка-пример панели без кнопок, лист zone с кромкой edge', async () => {
    await renderIntro();
    expect(screen.queryByTestId('aba-intro-panel-example')).toBeNull();
    expect(screen.queryByTestId('aba-intro-rules')).toBeNull();
    await fireEvent.press(screen.getByTestId('aba-intro-next'));
    await waitFor(() => expect(screen.getByTestId('aba-intro-step-2')).toBeTruthy());

    // запреты — те же слова, что в полном тексте шага (проверенном `aba-pedagogy-specialist`), а не новый совет
    const I = ru.parent.aba.intro;
    const rules = within(screen.getByTestId('aba-intro-rules'));
    // иконки — украшение при тексте: скринридер их не читает, поэтому ищем среди скрытых
    expect(rules.queryByTestId('aba-intro-forbid-point')).toBeNull();
    expect(rules.getByTestId('aba-intro-forbid-point', { includeHiddenElements: true })).toBeTruthy();
    expect(rules.getByTestId('aba-intro-forbid-talk', { includeHiddenElements: true })).toBeTruthy();
    expect(rules.getByText(I.ruleNoPoint)).toBeTruthy();
    expect(rules.getByText(I.ruleNoTalk)).toBeTruthy();
    expect(I.step2.toLowerCase()).toContain(I.ruleNoPoint.toLowerCase());
    expect(I.step2.toLowerCase()).toContain(I.ruleNoTalk.toLowerCase());
    // иконка запрета — 24 pt
    const glyph = screen.getByTestId('aba-intro-forbid-point', { includeHiddenElements: true });
    expect(glyph.props.width ?? StyleSheet.flatten(glyph.props.style)?.width).toBe(parentCard.iconGlyph);

    const example = screen.getByTestId('aba-intro-panel-example');
    const look = StyleSheet.flatten(example.props.style);
    expect(look.backgroundColor).toBe(parentColors.light.zone);
    expect(look.borderTopColor).toBe(parentColors.light.edge);
    expect(look.borderTopWidth).toBe(abaAdultSheet.edge);
    expect(within(example).getByText(I.panelExample)).toBeTruthy();
    // названия — обычным текстом в кавычках, те же, что на настоящих кнопках панели
    expect(within(example).getByTestId('aba-intro-panel-names')).toHaveTextContent(`«${ru.abaPanel.prompted}»`, { exact: false });
    expect(within(example).getByTestId('aba-intro-panel-names')).toHaveTextContent(`«${ru.abaPanel.refused}»`, { exact: false });
    // ничего не нажимается: ни кнопок, ни обработчиков
    expect(within(example).queryAllByRole('button')).toEqual([]);
    expect(example.props.onPress).toBeUndefined();
    expect(example.props.onClick).toBeUndefined();

    await pastGuard();
    await fireEvent.press(screen.getByTestId('aba-intro-next'));
    await waitFor(() => expect(screen.getByTestId('aba-intro-step-3')).toBeTruthy());
    expect(screen.queryByTestId('aba-intro-panel-example')).toBeNull();
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

  it('проверка и первые пробы без обучения: «без жетонов» уже в строке этапа — строки noTokens нет (№203)', () => {
    expect(stageLines(t, view({ stage: { kind: 'placement', targetId: 'match-shape' }, tokens: false }), '5-6')).toEqual([W.placement.replace('{{target}}', 'По форме')]);
    expect(stageLines(t, view({ stage: { kind: 'baseline', targetId: 'match-color' }, tokens: false }), '5-6')).toEqual([W.baseline.replace('{{target}}', 'По цвету')]);
  });

  it('план не построился — строк нет', () => {
    expect(stageLines(t, view({ stage: { kind: 'unknown' } }), '5-6')).toEqual([]);
  });
});

describe('полоса этапов «Где мы сейчас» (№203)', () => {
  const W = ru.parent.aba.where;

  it('этап плана → колонка: baseline — «Проверка», all_mastered — «Повторяем», unknown — полосы нет', () => {
    expect(stageStepOf('pairing')).toBe('pairing');
    expect(stageStepOf('placement')).toBe('placement');
    expect(stageStepOf('baseline')).toBe('placement');
    expect(stageStepOf('teaching')).toBe('teaching');
    expect(stageStepOf('maintenance')).toBe('maintenance');
    expect(stageStepOf('all_mastered')).toBe('maintenance');
    expect(stageStepOf('unknown')).toBeNull();
  });

  it('до текущего — пройдено, текущий, после — впереди', () => {
    expect(STAGE_STEPS.map((s) => stageStepState(s, 'teaching'))).toEqual(['done', 'done', 'now', 'next']);
    expect(STAGE_STEPS.map((s) => stageStepState(s, 'pairing'))).toEqual(['now', 'next', 'next', 'next']);
  });

  it('рисунок: пройденный — заливка primary и ✓, текущий — 12 в рамке 3 primary, следующий — 6 с границей edge', async () => {
    await renderWithProviders(<ParentThemeProvider><StageStrip current="placement" testID="s" /></ParentThemeProvider>);
    const st = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);
    const c = parentColors.light;
    expect(st('s-pairing-done')).toMatchObject({ height: parentStageStrip.bar, backgroundColor: c.primary });
    expect(st('s-pairing-check')).toMatchObject({ width: parentStageStrip.check, backgroundColor: c.primary, borderColor: c.blockWhere });
    expect(st('s-placement-now')).toMatchObject({ height: parentStageStrip.barNow, borderWidth: parentStageStrip.ringNow, borderColor: c.primary });
    expect(st('s-teaching-next')).toMatchObject({ height: parentStageStrip.bar, borderColor: c.edge });
    expect(screen.queryByTestId('s-placement-check')).toBeNull();
    expect(STAGE_STEPS.map((s) => screen.getByTestId(`s-${s}-label`).props.children)).toEqual(STAGE_STEPS.map((s) => W.stage[s]));
    expect(screen.getByTestId('s-placement').props.accessibilityState).toEqual({ selected: true });
    // подписи: роль stage 13/16, потолок масштаба 1.1, одной строкой с ужатием (слово не режется); «впереди» — textMuted
    const label = screen.getByTestId('s-teaching-label');
    expect(label.props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: parentStageStrip.labelMinScale, maxFontSizeMultiplier: 1.1 });
    expect(st('s-teaching-label')).toMatchObject({ fontSize: 13, lineHeight: 16, color: c.textMuted });
    expect(st('s-placement-label')).toMatchObject({ color: c.text });
  });

  it('контраст на блоке where: полоса primary и граница edge ≥ 3, подпись «впереди» textMuted ≥ 4.5', () => {
    const c = parentColors.light;
    expect(contrast(c.primary, c.blockWhere)).toBeGreaterThanOrEqual(SHAPE_CONTRAST);
    expect(contrast(c.edge, c.blockWhere)).toBeGreaterThanOrEqual(SHAPE_CONTRAST);
    expect(contrast(c.textMuted, c.blockWhere)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });

  // ширина по TTF Golos 600 (`fontMetrics`), экран 360: поле экрана 16 и блока 16 с двух сторон, зазоры 6
  const columns = (scale: number, locale: Record<string, string>) => {
    const ty = parentTypography.stage;
    const inner = 360 - 2 * parentSpacing.lg - 2 * parentCard.blockPad - (STAGE_STEPS.length - 1) * parentStageStrip.gap;
    const sum = parentStageStrip.weights.reduce((a, b) => a + b, 0);
    return STAGE_STEPS.map((s, i) => ({ s, text: textEm(fontFamilyFor(ty), locale[s]) * ty.size * scale, col: (inner * parentStageStrip.weights[i]) / sum }));
  };

  it('веса колонок: при обычном масштабе каждое слово этапа (ru, en) помещается в свою колонку на 360 без ужатия', () => {
    [W.stage, en.parent.aba.where.stage].forEach((loc) => expect(columns(1, loc).filter((r) => r.text > r.col)).toEqual([]));
  });

  it('при потолке ×1.1 на 360 слово укладывается в одну строку ужатием не ниже labelMinScale', () => {
    [W.stage, en.parent.aba.where.stage].forEach((loc) =>
      expect(columns(parentFontScaleMax.stage, loc).filter((r) => r.col / r.text < parentStageStrip.labelMinScale)).toEqual([]),
    );
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
