/**
 * Гард контента пятой цели ABA — «похожее, но не такое же» (№206, `MATCH_SIMILAR_3`): то же, что `abaTargets.test.ts`
 * проверяет у лестницы `MATCH_LEVEL1`, — для программы из пяти целей и для пар «карточка → образец» (`samplePairs`).
 * Правила самой цели и допуск без картинок — `src/domain/__tests__/abaSimilarMatch.test.ts`.
 */
import { ABA_OBJECT_ART } from '../../assets/registry';
import { programErrors, targetErrors, targetForBand, versionErrors } from '../../domain/abaTargetRules';
import en from '../../i18n/locales/en.json';
import ru from '../../i18n/locales/ru.json';
import { ABA_TARGETS } from '../aba';
import { MATCH_AFTER_LADDER, MATCH_LEVEL1, MATCH_SIMILAR_3 } from '../aba/match-level1';
import { ABA_STIMULI } from '../aba/stimuli';

const byId = new Map(ABA_STIMULI.map((s) => [s.id, s]));
const get = (o: unknown, k: string) => k.split('.').reduce<unknown>((x, p) => (x as Record<string, unknown> | undefined)?.[p], o);
const PAIRS = Object.entries(MATCH_SIMILAR_3.samplePairs ?? {});

describe('программа из пяти целей', () => {
  it('связи между целями выполнены и с целью после лестницы', () => {
    expect(ABA_TARGETS).toEqual([...MATCH_LEVEL1, ...MATCH_AFTER_LADDER]);
    expect(programErrors(ABA_TARGETS)).toEqual([]);
  });

  it.each(['5-6', '7', '8', '9-10'] as const)('полоса %s: цель проходит правила домена и входит в первую версию', (band) => {
    expect(targetErrors(targetForBand(MATCH_SIMILAR_3, band))).toEqual([]);
    expect(versionErrors(MATCH_SIMILAR_3)).toEqual([]);
  });

  it('инструкция и её варианты, название цели для взрослого — есть на ru и en', () => {
    for (const k of [MATCH_SIMILAR_3.sdKey, ...(MATCH_SIMILAR_3.sdVariantKeys ?? []), `parent.aba.goal.${MATCH_SIMILAR_3.id}`]) {
      expect(typeof get(ru, k)).toBe('string');
      expect(typeof get(en, k)).toBe('string');
    }
  });

  it('касательный формат: modelKey — повтор SD, частичных моделей нет; у переноса голос взрослого', () => {
    for (const e of MATCH_SIMILAR_3.exemplars) {
      expect(e.modelKey).toBe(MATCH_SIMILAR_3.sdKey);
      expect(e.partialModelKeys).toEqual([]);
      if (e.role === 'generalization') expect(['adult_f', 'adult_m']).toContain(e.voice);
    }
  });
});

describe('пары «карточка → образец»', () => {
  it('пар пять — по одной на экземпляр', () => {
    expect(PAIRS).toHaveLength(MATCH_SIMILAR_3.exemplars.length);
  });

  it.each(PAIRS)('%s → %s: оба — стимулы-предметы одного класса; у образца есть запись в реестре картинок', (card, sample) => {
    const a = byId.get(card);
    const b = byId.get(sample);
    expect(a?.kind).toBe('object');
    expect(b?.kind).toBe('object');
    expect(b?.class).toBe(a?.class);
    expect(sample in ABA_OBJECT_ART).toBe(true);
  });

  it('карточки поля цели — стимулы-предметы; вторых рисунков среди них нет', () => {
    const cards = MATCH_SIMILAR_3.exemplars.flatMap((e) => e.cards ?? []);
    for (const id of cards) expect(byId.get(id)?.kind).toBe('object');
    expect(cards.filter((id) => Object.values(MATCH_SIMILAR_3.samplePairs ?? {}).includes(id))).toEqual([]);
  });

  it('вторые рисунки не стоят в полях ни одной цели программы', () => {
    const samples = new Set(PAIRS.map(([, s]) => s));
    for (const t of ABA_TARGETS) expect(t.exemplars.flatMap((e) => e.cards ?? []).filter((id) => samples.has(id))).toEqual([]);
  });

  it('карточка в паре «не вместе» — её образец в паре с тем же соседом (образец тоже на экране)', () => {
    const apart = MATCH_SIMILAR_3.notTogether ?? [];
    const has = (a: string, b: string) => apart.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    for (const [card, sample] of PAIRS) {
      for (const [x, y] of apart) {
        if (x === card) expect(has(sample, y)).toBe(true);
        if (y === card) expect(has(sample, x)).toBe(true);
      }
    }
  });

  it('перенос — на предметах, которых не было ни в одном обучении программы', () => {
    const taught = new Set(ABA_TARGETS.flatMap((t) => t.exemplars.filter((e) => e.role === 'teaching').flatMap((e) => e.cards ?? [])));
    for (const e of MATCH_SIMILAR_3.exemplars.filter((x) => x.role === 'generalization')) {
      expect((e.cards ?? []).filter((id) => taught.has(id))).toEqual([]);
    }
  });
});
