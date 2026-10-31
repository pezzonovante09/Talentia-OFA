import { registryProblems, SKILLS } from '../skills';
import type { SkillEntry } from '../skills';

const e = (id: string, band: SkillEntry['band'], prerequisites: string[] = []): SkillEntry => ({
  id,
  region: 'numbers',
  band,
  prerequisites,
  source: 'kr',
  titleKey: `content.skills.${id}`,
  homeTipKey: `content.skillTips.${id}`,
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

  it('ловит кривой ключ строки «что делать дома»', () => {
    const out = registryProblems([{ ...e('a', '7'), homeTipKey: 'content.skills.a' }]).join('\n');
    expect(out).toContain('a: homeTipKey должен быть content.skillTips.a');
  });

  it('ловит цикл пререквизитов', () => {
    const out = registryProblems([e('x', '7', ['z']), e('y', '7', ['x']), e('z', '7', ['y'])]).join('\n');
    expect(out).toContain('цикл пререквизитов');
  });
});

describe('названия навыков', () => {
  it('у каждого навыка реестра есть название в ru.json — для отчёта родителю', () => {
    const ru = require('../../i18n/locales/ru.json') as Record<string, unknown>;
    const at = (key: string) => key.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown> | undefined)?.[k], ru);
    expect(SKILLS.filter((s) => typeof at(s.titleKey) !== 'string').map((s) => s.id)).toEqual([]);
  });

  it('у каждого навыка есть строка «что делать дома» в ru.json — блок «даётся тяжело» (вопрос 57)', () => {
    const ru = require('../../i18n/locales/ru.json') as Record<string, unknown>;
    const at = (key: string) => key.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown> | undefined)?.[k], ru);
    expect(SKILLS.filter((s) => typeof at(s.homeTipKey) !== 'string').map((s) => s.id)).toEqual([]);
  });
});
