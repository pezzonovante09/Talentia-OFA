/**
 * Смена кадра с полной доски на обмен под пальцем (Ц4, огр. 1; Ж19): чистые функции `gateWait`, `gateOnHold`,
 * `gateOnRelease` и ворота `participationPhase`. Правило: палец на карточке «перерыв» или «Отказ» откладывает смену
 * кадра до отпускания + `acceptedShowMs`, но не дальше `ceilingAt`; лежащий палец ждёт **ровно** потолка — раньше
 * касание не засчитывается; касание, начатое до показа кадра (`since`), кадр не держит.
 *
 * Экран (`app/aba/session.tsx`, `commitHeld`) засчитывает касание только в срок `frameAt`, который ставят эти
 * функции: мутация «ждать не до потолка» в `gateOnHold` или «не до потолка» в `gateWait` ломает тесты здесь, а
 * проверка `at < gate.ceilingAt` в `commitHeld` — вторая линия той же защиты (модельные тесты — `session.test.tsx`,
 * «палец на карточке … в момент смены кадра»).
 */
import { abaExchange, abaParticipation } from '../../../../design/abaTokens';
import type { TrialStep } from '../../../../domain/abaSession';
import { startConsequence } from '../consequenceRun';
import { gateOnHold, gateOnRelease, gateWait, participationPhase, phaseDueAt, type FullBoardGate, type Phase } from '../sessionPhase';

const F = abaExchange.fromFullBoard;
const SHOW = F.heldTouch.acceptedShowMs; // 300
const CEIL = F.ceilingMs; // 920

/** Кадр плашки показан (`since`) в 1000; жетон сел в 1340, потолок — 1340 + 920. */
const SINCE = 1000;
const LANDED = 1340;
const gate = (frameAt: number | null = null): FullBoardGate => ({ since: SINCE, ceilingAt: LANDED + CEIL, frameAt });
const CEILING = LANDED + CEIL; // 2260
const PLANNED = LANDED + F.afterLandingMs; // 2040 — плановая смена кадра
/** Ворота с широким окном (потолок далеко): для формулы «отпускание + 300», которую продуктовые 220 мс не показывают. */
const WIDE = (frameAt: number | null = null): FullBoardGate => ({ since: SINCE, ceilingAt: SINCE + 5000, frameAt });
const gateOf = (p: Phase) => (p.kind === 'consequence' || p.kind === 'participation' ? p.gate : undefined);

const consequence = (g: FullBoardGate | null): Extract<Phase, { kind: 'consequence' }> => ({
  kind: 'consequence',
  run: startConsequence({ markedAt: SINCE, feedback: 'token_praise', calm: false, exchange: true }),
  overlay: true,
  earnedBefore: 0,
  landed: true,
  empty: false,
  field: {} as TrialStep,
  stripEarned: 1,
  participation: false,
  chosenId: null,
  breakAsked: false,
  gate: g,
});

const participation = (g: FullBoardGate | null, over: Partial<Extract<Phase, { kind: 'participation' }>> = {}): Extract<Phase, { kind: 'participation' }> => ({
  kind: 'participation',
  landAt: LANDED,
  landed: true,
  until: PLANNED,
  earned: 1,
  field: null,
  then: null,
  breakAsked: false,
  gate: g,
  ...over,
});

describe('токены ворот', () => {
  it('отклик «принято» 300, потолок посадка + 920, плановая смена посадка + 700; палец держат карточка и «Отказ», в потолке — засчитать', () => {
    expect([SHOW, CEIL, F.afterLandingMs, F.heldTouch.on, F.heldTouch.atCeiling]).toEqual([300, 920, 700, ['break_card', 'adult_refusal'], 'commit_if_inside']);
  });
});

describe('gateWait — срок ожидания в плановый момент смены кадра', () => {
  it('палец лежит с момента не раньше показа кадра — ждать до потолка, не до плановой смены', () => {
    expect(gateWait(gate(), PLANNED, { at: SINCE }, -Infinity)).toBe(CEILING);
    expect(gateWait(gate(), PLANNED, { at: PLANNED - 1 }, -Infinity)).toBe(CEILING);
  });

  it('лежащий палец ждёт именно потолка, а не касание + 300: при широком окне срок — потолок', () => {
    expect(gateWait(WIDE(), SINCE + 1000, { at: SINCE }, -Infinity)).toBe(SINCE + 5000);
    expect(gateWait(WIDE(), SINCE + 1000, { at: SINCE + 900 }, SINCE + 950)).toBe(SINCE + 5000);
  });

  it('палец лежит, а отпускание было недавно — всё равно до потолка: лежащий палец важнее прежнего отклика', () => {
    expect(gateWait(gate(), PLANNED, { at: SINCE + 500 }, PLANNED - 100)).toBe(CEILING);
  });

  it('касание, начатое до показа кадра, кадр не держит: без отпусканий — менять сейчас', () => {
    expect(gateWait(gate(), PLANNED, { at: SINCE - 1 }, -Infinity)).toBeNull();
  });

  it('пальца нет, отпускание меньше чем за 300 до плановой смены — ждать до отпускания + 300', () => {
    expect(gateWait(gate(), PLANNED, null, PLANNED - 100)).toBe(PLANNED + 200);
    expect(gateWait(gate(), PLANNED, null, PLANNED - 299)).toBe(PLANNED + 1);
  });

  it('отпускание + 300 позже потолка — срок режется потолком', () => {
    expect(gateWait(gate(), PLANNED, null, CEILING - 100)).toBe(CEILING);
  });

  it('пальца нет и отпускание давно (ровно 300 и раньше) — менять сейчас', () => {
    expect(gateWait(gate(), PLANNED, null, PLANNED - 300)).toBeNull();
    expect(gateWait(gate(), PLANNED, null, -Infinity)).toBeNull();
  });

  it('никогда не отдаёт срок раньше плановой смены и позже потолка', () => {
    for (const released of [-Infinity, PLANNED - 1000, PLANNED - 299, PLANNED - 1, PLANNED, CEILING])
      for (const held of [null, { at: SINCE - 10 }, { at: SINCE }, { at: PLANNED }]) {
        const w = gateWait(gate(), PLANNED, held, released);
        if (w !== null) expect([w >= PLANNED, w <= CEILING]).toEqual([true, true]);
      }
  });
});

describe('gateOnHold — новое касание, пока кадр уже ждёт', () => {
  it('кадр ждал отклика прежнего касания (до потолка) — ожидание переносится на потолок', () => {
    const p = consequence(gate(PLANNED + 200));
    expect(gateOf(gateOnHold(p, PLANNED + 100))).toEqual(gate(CEILING));
  });

  it('палец ложится в любой момент до потолка — ждать ровно потолка, не момента касания и не касание + 300', () => {
    for (const now of [SINCE, PLANNED, PLANNED + 1, CEILING - 301, CEILING - 1]) {
      const held = gateOnHold(participation(gate(PLANNED + 50)), now);
      expect(held.kind === 'participation' && held.gate?.frameAt).toBe(CEILING);
      expect(phaseDueAt(held)).toBe(CEILING);
    }
  });

  it('кадр ещё не ждёт (frameAt null — плашка идёт) — фаза не меняется: срок возьмёт gateWait в плановый момент', () => {
    const p = consequence(gate(null));
    expect(gateOnHold(p, PLANNED - 500)).toBe(p);
  });

  it('касание до показа кадра (now < since) ожидание не трогает', () => {
    const p = participation(gate(PLANNED + 200));
    expect(gateOnHold(p, SINCE - 1)).toBe(p);
  });

  it('без ворот (доска не заполнена) и в других фазах — та же фаза', () => {
    const plain = consequence(null);
    expect(gateOnHold(plain, PLANNED)).toBe(plain);
    const trial = { kind: 'pause', step: {} as TrialStep, until: PLANNED } as Phase;
    expect(gateOnHold(trial, PLANNED)).toBe(trial);
  });

  it('уже в потолке — остаётся потолок, остальное в фазе не меняется', () => {
    const p = participation(gate(CEILING), { earned: 2, breakAsked: true });
    expect(gateOnHold(p, CEILING - 10)).toEqual(p);
  });

  it('удержание переживает смену кадра: посадка жетона за участие не сбрасывает ожидание до потолка', () => {
    const waiting = gateOnHold(participation(gate(PLANNED + 100), { landed: false }), PLANNED);
    // кадр обновился (жетон сел) — ворота те же: срок по-прежнему потолок
    const landed = { ...waiting, landed: true } as Phase;
    expect(landed.kind === 'participation' && landed.gate).toEqual(gate(CEILING));
    expect(phaseDueAt(landed)).toBe(CEILING);
  });
});

describe('gateOnRelease — палец сняли', () => {
  it('ждали потолка — после отпускания срок становится отпускание + 300, если это раньше потолка', () => {
    const p = consequence(WIDE(SINCE + 5000));
    expect(gateOf(gateOnRelease(p, SINCE + 1000))).toEqual(WIDE(SINCE + 1300));
  });

  it('отпускание + 300 позже потолка — срок остаётся потолком', () => {
    const p = participation(gate(CEILING));
    const r = gateOnRelease(p, CEILING - 100);
    expect(gateOf(r)?.frameAt).toBe(CEILING);
  });

  it('продуктовые тайминги: окно от плановой смены до потолка 220 < 300 — отпускание после плановой смены всегда ведёт в потолок', () => {
    expect(CEIL - F.afterLandingMs).toBeLessThan(SHOW);
    for (const now of [PLANNED, PLANNED + 1, CEILING - 1]) expect(gateOf(gateOnRelease(consequence(gate(CEILING)), now))?.frameAt).toBe(CEILING);
  });

  it('отпускание очищает удержание: новое ожидание не зависит от прежнего и не превышает потолок', () => {
    const held = gateOnHold(consequence(WIDE(SINCE + 100)), SINCE + 50);
    expect(gateOf(held)?.frameAt).toBe(SINCE + 5000);
    const released = gateOnRelease(held, SINCE + 200);
    expect(gateOf(released)).toEqual(WIDE(SINCE + 500));
    // палец лёг снова — опять потолок; снова сняли — снова отпускание + 300; у потолка — потолок
    const again = gateOnHold(released, SINCE + 300);
    expect(gateOf(again)?.frameAt).toBe(SINCE + 5000);
    expect(gateOf(gateOnRelease(again, SINCE + 400))?.frameAt).toBe(SINCE + 700);
    expect(gateOf(gateOnRelease(again, SINCE + 4900))?.frameAt).toBe(SINCE + 5000);
  });

  it('кадр не ждал (frameAt null) — отпускание фазу не меняет', () => {
    const p = consequence(gate(null));
    expect(gateOnRelease(p, PLANNED)).toBe(p);
    const plain = participation(null);
    expect(gateOnRelease(plain, PLANNED)).toBe(plain);
  });
});

describe('participationPhase — ворота жетона за участие', () => {
  const board = { size: 2, earned: 1 };

  it('жетон заполнил доску: ворота с показа кадра в посадке, потолок посадка + 920, смена кадра через 700 после посадки', () => {
    const p = participationPhase({ now: 10_000, field: null, then: null, board, fills: true });
    const landAt = 10_000 + abaParticipation.drop.ms;
    expect(p).toMatchObject({ kind: 'participation', landAt, until: landAt + F.afterLandingMs, earned: 2, gate: { since: landAt, ceilingAt: landAt + CEIL, frameAt: null } });
  });

  it('доска не заполнена — ворот нет, полоса стоит holdMs', () => {
    const p = participationPhase({ now: 10_000, field: null, then: null, board, fills: false });
    expect(p).toMatchObject({ earned: 1, gate: null, until: 10_000 + abaParticipation.drop.ms + abaParticipation.holdMs });
  });

  it('палец, лёгший до посадки (до since), смену кадра не держит; лёгший в посадке — держит до потолка', () => {
    const p = participationPhase({ now: 10_000, field: null, then: null, board, fills: true });
    if (p.kind !== 'participation' || !p.gate) throw new Error('ворот нет');
    expect(gateWait(p.gate, p.until, { at: p.gate.since - 1 }, -Infinity)).toBeNull();
    expect(gateWait(p.gate, p.until, { at: p.gate.since }, -Infinity)).toBe(p.gate.ceilingAt);
  });
});
