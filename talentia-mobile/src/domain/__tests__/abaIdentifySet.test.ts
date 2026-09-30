import type { AbaExemplar, AbaTarget, AbaTargetState } from '../../types/aba';
import { initialTargetState } from '../abaPrompting';
import { poolErrors, setHalves, updateSets, type IdentifySet } from '../abaIdentifySet';

const ex = (id: string, role: AbaExemplar['role'] = 'teaching'): AbaExemplar => ({
  id,
  role,
  targetKey: `k.${id}`,
  modelKey: `m.${id}`,
  partialModelKeys: [],
  image: `img-${id}`,
});

const idt = (id: string, over: Partial<AbaTarget> = {}): AbaTarget => ({
  id,
  programId: 'p',
  format: 'identify',
  band: '7',
  sdKey: `sd.${id}`,
  exemplars: [ex(`${id}-1`), ex(`${id}-2`), ex(`${id}-g1`, 'generalization'), ex(`${id}-g2`, 'generalization')],
  delayMs: 3000,
  delayMode: 'constant',
  blockSize: 5,
  scoredBy: 'adult',
  identifyPoolKey: 'animals',
  ...over,
});

const pool = ['I1', 'I2', 'I3', 'I4', 'I5'].map((id) => idt(id));
const phase = (p: AbaTargetState['phase']) => (t: AbaTarget): AbaTargetState => ({ ...initialTargetState(t), phase: p });
const statesOf = (f: (t: AbaTarget) => AbaTargetState, over: Record<string, AbaTargetState> = {}) => ({
  ...Object.fromEntries(pool.map((t) => [t.id, f(t)])),
  ...over,
});
const set = (memberIds: string[]): IdentifySet => ({
  id: 'animals#1',
  poolKey: 'animals',
  memberIds,
  createdAtSession: 1,
  lastSetSessionIndex: 1,
});
const yes = () => true;

describe('состав набора', () => {
  it('собирается из первых по программе готовых целей пула, до четырёх', () => {
    const [s] = updateSets([], pool, statesOf(phase('baseline')), 3, yes);
    expect(s.memberIds).toEqual(['I1', 'I2', 'I3', 'I4']);
  });

  it('меньше трёх готовых — набора нет', () => {
    expect(updateSets([], pool.slice(0, 2), statesOf(phase('baseline')), 3, yes)).toEqual([]);
  });

  it('пополняется одной целью за сессию, пока участников меньше четырёх', () => {
    const states = statesOf(phase('acquisition'));
    const [s] = updateSets([set(['I1', 'I2', 'I3'])], pool, states, 4, yes);
    expect(s.memberIds).toEqual(['I1', 'I2', 'I3', 'I4']);
  });

  it('полный набор: новичок заменяет освоенного участника', () => {
    const states = statesOf(phase('acquisition'), { I2: phase('mastered')(pool[1]) });
    const [s] = updateSets([set(['I1', 'I2', 'I3', 'I4'])], pool, states, 4, yes);
    expect(s.memberIds).toEqual(['I1', 'I5', 'I3', 'I4']);
  });

  it('активных не осталось и пополнять нечем — набор закрывается', () => {
    const states = statesOf(phase('mastered'));
    expect(updateSets([set(['I1', 'I2', 'I3'])], pool.slice(0, 3), states, 4, yes)).toEqual([]);
  });
});

describe('последовательность набора', () => {
  it('3 цели по 5 — половины 8 + 7, одна инструкция не больше двух подряд', () => {
    const states = statesOf(phase('acquisition'));
    for (let seed = 0; seed < 20; seed += 1) {
      let i = seed;
      const rng = () => ((i = (i * 9301 + 49297) % 233280) / 233280);
      const [a, b] = setHalves(set(['I1', 'I2', 'I3']), states, rng, { baselineLimit: 2 });
      expect([a.length, b.length]).toEqual([8, 7]);
      for (const half of [a, b]) {
        const ids = half.map((x) => x.targetId);
        expect(ids.some((id, k) => k >= 2 && id === ids[k - 1] && id === ids[k - 2])).toBe(false);
      }
    }
  });

  it('4 цели — 10 + 10; освоенная — две высоковероятные', () => {
    const states = statesOf(phase('acquisition'), { I4: phase('mastered')(pool[3]) });
    const [a, b] = setHalves(set(['I1', 'I2', 'I3', 'I4']), states, Math.random, { baselineLimit: 2 });
    expect(a.length + b.length).toBe(17);
    expect([...a, ...b].filter((x) => x.targetId === 'I4').every((x) => x.kind === 'high_p')).toBe(true);
    const full = statesOf(phase('acquisition'));
    const [c, d] = setHalves(set(['I1', 'I2', 'I3', 'I4']), full, Math.random, { baselineLimit: 2 });
    expect([c.length, d.length]).toEqual([10, 10]);
  });
});

describe('пул', () => {
  it('годный пул проходит', () => {
    expect(poolErrors(pool)).toEqual([]);
  });

  it('меньше трёх целей, разные полосы, повтор картинок — ошибки', () => {
    expect(poolErrors(pool.slice(0, 2)).join()).toContain('нужно не меньше 3');
    expect(poolErrors([...pool.slice(0, 2), idt('X', { band: '8' })]).join()).toContain('разных полос');
    const dup = idt('Y', { exemplars: pool[0].exemplars });
    expect(poolErrors([...pool, dup]).join()).toContain('изображения повторяются');
  });
});
