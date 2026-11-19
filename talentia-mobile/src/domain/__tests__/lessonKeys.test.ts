/**
 * «Нет перевода — нет урока» (№78): урок открывается, только если в словаре есть каждый его ключ.
 * Словарь здесь — настоящие локали: ru и en закрывают все шесть уроков среза, ky — пустой.
 */
import { REGIONS, regionLessons } from '../../content';
import en from '../../i18n/locales/en.json';
import ky from '../../i18n/locales/ky.json';
import ru from '../../i18n/locales/ru.json';
import type { Lesson } from '../../types/task';
import { lessonAvailable, lessonKeys, missingLessonKeys } from '../lessonKeys';

type Tree = { [k: string]: string | Tree };

function flatKeys(tree: Tree, prefix = ''): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.add(key);
    else for (const sub of flatKeys(v, key)) out.add(sub);
  }
  return out;
}

const RU = flatKeys(ru as Tree);
const EN = flatKeys(en as Tree);
const KY = flatKeys(ky as Tree);
const existsIn = (set: Set<string>) => (k: string) => set.has(k);

const LESSONS = regionLessons('numbers');

describe('lessonKeys', () => {
  it('собирает название, завязку, пример, задания и атлас без повторов', () => {
    const l = LESSONS[0];
    const keys = lessonKeys(l);
    expect(keys[0]).toBe(l.titleKey);
    expect(keys[1]).toBe(l.hook.lineKey);
    expect(keys[keys.length - 1]).toBe(l.atlasEntryKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of l.tasks) {
      expect(keys).toContain(t.promptKey);
      expect(keys).toContain(t.hintKey);
    }
    if (l.model) for (const s of l.model.steps) expect(keys).toContain(s.lineKey);
  });

  it('у каждого задания учтены подписи всех элементов формата', () => {
    for (const l of LESSONS) {
      const keys = new Set(lessonKeys(l));
      for (const t of l.tasks) {
        if (t.format === 'choose') t.options.forEach((o) => expect(keys).toContain(o.labelKey));
        if (t.format === 'match') t.pairs.forEach((p) => {
          expect(keys).toContain(p.left.labelKey);
          expect(keys).toContain(p.right.labelKey);
        });
        if (t.format === 'order') t.items.forEach((i) => expect(keys).toContain(i.labelKey));
        if (t.stimulus) expect(keys).toContain(t.stimulus.labelKey);
      }
    }
  });
});

describe('lessonAvailable по настоящим локалям', () => {
  it('все шесть уроков среза доступны в ru и в en', () => {
    expect(LESSONS).toHaveLength(6);
    for (const l of LESSONS) {
      expect({ id: l.id, missingRu: missingLessonKeys(l, existsIn(RU)) }).toEqual({ id: l.id, missingRu: [] });
      expect({ id: l.id, missingEn: missingLessonKeys(l, existsIn(EN)) }).toEqual({ id: l.id, missingEn: [] });
    }
  });

  it('в ky ни один урок не доступен — карта покажет «нет перевода», а не русский урок', () => {
    for (const l of LESSONS) expect(lessonAvailable(l, existsIn(KY))).toBe(false);
  });

  it('один выпавший ключ закрывает урок', () => {
    const l: Lesson = LESSONS[1];
    const victim = l.tasks[0].hintKey;
    const dict = new Set(RU);
    dict.delete(victim);
    expect(missingLessonKeys(l, existsIn(dict))).toEqual([victim]);
    expect(lessonAvailable(l, existsIn(dict))).toBe(false);
  });

  it('название региона в реестре переведено на ru и en', () => {
    for (const r of REGIONS) {
      expect(RU.has(r.titleKey)).toBe(true);
      expect(EN.has(r.titleKey)).toBe(true);
    }
  });
});
