/** №160: просьба «перерыв» во время последствия — запоминается, перерыв вместо следующего SD. */
import { nextStep, requestBreakBetweenTrials, stopSession } from '../abaSession';
import { CHILD_BREAKS_TO_END } from '../../types/aba';
import { answerNext, BASE_MS, beginSession } from './abaSessionDriver';

/** Сессия после первой записанной пробы — фаза последствия, следующий в очереди — проба. */
function afterTrial() {
  const st = beginSession();
  const { state } = answerNext(st, BASE_MS + 1000);
  return state;
}

describe('просьба «перерыв» между пробами (№160)', () => {
  it('вместо следующего SD — перерыв ребёнка; проба не повторяется; просьба в счёте', () => {
    const st = afterTrial();
    const trialsBefore = st.queue.filter((q) => q.kind === 'trial').length;
    const r = requestBreakBetweenTrials(st, BASE_MS + 2000);
    expect(r.queue[0]).toMatchObject({ kind: 'break', initiatedBy: 'child_card', between: true });
    expect(r.queue.filter((q) => q.kind === 'trial').length).toBe(trialsBefore);
    expect(r.childBreaks).toBe(st.childBreaks + 1);
    expect(r.events.at(-1)).toMatchObject({ kind: 'assent', by: 'child_card', action: 'break', between: true });
    expect(nextStep(r, BASE_MS + 2500).step.kind).toBe('break');
  });

  it('повторный тап до перерыва — ничего нового', () => {
    const r = requestBreakBetweenTrials(afterTrial(), BASE_MS + 2000);
    expect(requestBreakBetweenTrials(r, BASE_MS + 2100)).toBe(r);
  });

  it('просьба сверх лимита — конец по отказу, как в пробе', () => {
    const st = { ...afterTrial(), childBreaks: CHILD_BREAKS_TO_END - 1 };
    const r = requestBreakBetweenTrials(st, BASE_MS + 2000);
    expect(r.endReason).toBe('assent_withdrawn');
  });

  it('не между пробами — ошибка программы', () => {
    expect(() => requestBreakBetweenTrials(stopSession(afterTrial(), 'adult_stopped'), BASE_MS + 2000)).toThrow();
  });
});
