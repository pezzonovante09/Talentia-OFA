import { registryProblems, SKILLS } from '../skills';
import type { SkillEntry } from '../skills';

const e = (id: string, band: SkillEntry['band'], prerequisites: string[] = []): SkillEntry => ({
  id,
  region: 'numbers',
  band,
  prerequisites,
  source: 'kr',
});

describe('реестр навыков', () => {
  it('настоящий реестр цел', () => {
    expect(registryProblems(SKILLS)).toEqual([]);
  });

  it('ловит повтор, не kebab-case, неизвестный и старший пререквизит, больше трёх', () => {
    const out = registryProblems([
      e('a', '7'),
      e('a', '7'),
      e('Count_To', '5-6'),
      e('b', '7', ['nope']),
      e('c', '7', ['late']),
      e('late', '8'),
      e('d', '9-10', ['a', 'b', 'c', 'late']),
    ]).join('\n');
    expect(out).toContain('навык a записан дважды');
    expect(out).toContain('навык «Count_To» не kebab-case');
    expect(out).toContain('b: пререквизит nope не записан');
    expect(out).toContain('c (7): пререквизит late вводится позже — на 8');
    expect(out).toContain('d: пререквизитов 4, не больше 3');
  });

  it('ловит цикл пререквизитов', () => {
    const out = registryProblems([e('x', '7', ['z']), e('y', '7', ['x']), e('z', '7', ['y'])]).join('\n');
    expect(out).toContain('цикл пререквизитов');
  });
});
