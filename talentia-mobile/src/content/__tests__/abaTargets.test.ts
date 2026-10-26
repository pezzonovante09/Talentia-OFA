/**
 * Гард контента целей ABA (ступень 1, `match`): правила домена (`targetErrors`, `programErrors`), стимулы и цвет
 * (ABA.md «Визуальный язык», №162), пул подкрепителей по классам стимулов программы (№149).
 */
import { ABA_OBJECT_ART } from '../../assets/registry';
import { abaColors } from '../../design/abaTokens';
import { reinforcerPoolFor } from '../../domain/abaReinforcerCatalog';
import { programErrors, targetErrors , targetForBand } from '../../domain/abaTargetRules';
import { EXCHANGE_ACCESS_MS } from '../../domain/abaTokenTraining';
import { MIN_REINFORCER_POOL } from '../../domain/abaTokens';
import ru from '../../i18n/locales/ru.json';
import en from '../../i18n/locales/en.json';
import { MATCH_COLOR, MATCH_LEVEL1 , MATCH_SHAPE } from '../aba/match-level1';
import { REINFORCERS } from '../aba/reinforcers';
import { ABA_COLOR_NOT_TOGETHER, ABA_SHAPE_FILL, ABA_SHAPE_NOT_TOGETHER, ABA_STIMULI } from '../aba/stimuli';
import { abaTargetReady, ABA_TARGETS, readyAbaTargets } from '../aba';

const byId = new Map(ABA_STIMULI.map((s) => [s.id, s]));
const cardsOf = (t: (typeof MATCH_LEVEL1)[number]) => t.exemplars.flatMap((e) => e.cards ?? []);
const get = (o: unknown, k: string) => k.split('.').reduce<unknown>((x, p) => (x as Record<string, unknown> | undefined)?.[p], o);

describe('цели ABA ступени 1 (match)', () => {
  it.each(MATCH_LEVEL1.map((t) => [t.id, t] as const))('%s: правила цели домена', (_, t) => {
    expect(targetErrors(t)).toEqual([]);
  });

  it('программа: связи между целями', () => {
    expect(programErrors(MATCH_LEVEL1)).toEqual([]);
  });

  it('касательный формат: modelKey — повтор SD, частичных моделей нет; SD и варианты есть на ru и en', () => {
    for (const t of MATCH_LEVEL1) {
      for (const e of t.exemplars) {
        expect(e.modelKey).toBe(t.sdKey);
        expect(e.partialModelKeys).toEqual([]);
      }
      for (const k of [t.sdKey, ...(t.sdVariantKeys ?? [])]) {
        expect(typeof get(ru, k)).toBe('string');
        expect(typeof get(en, k)).toBe('string');
      }
    }
  });

  it('у переноса голос взрослого — другой, чем у обучения', () => {
    for (const t of MATCH_LEVEL1) {
      for (const e of t.exemplars.filter((x) => x.role === 'generalization')) expect(['adult_f', 'adult_m']).toContain(e.voice);
    }
  });
});

describe('стимулы', () => {
  it('каждая карточка — стимул; у предмета — запись в реестре картинок; лишних записей нет', () => {
    for (const t of MATCH_LEVEL1) for (const id of cardsOf(t)) expect(byId.has(id)).toBe(true);
    const objects = ABA_STIMULI.filter((s) => s.kind === 'object').map((s) => s.id).sort();
    expect(Object.keys(ABA_OBJECT_ART).sort()).toEqual(objects);
  });

  it('в одной цели — один вид стимула (предметы, формы или цвета)', () => {
    for (const t of MATCH_LEVEL1) expect(new Set(cardsOf(t).map((id) => byId.get(id)!.kind)).size).toBe(1);
  });

  it('цвета стимулов не совпадают с цветами интерфейса и не жёлтые/оранжевые, как жетон', () => {
    const ui = new Set(Object.values(abaColors).flatMap((sch) => Object.values(sch as Record<string, unknown>)).filter((v): v is string => typeof v === 'string').map((v) => v.toUpperCase()));
    for (const s of ABA_STIMULI) {
      if (s.kind !== 'color') continue;
      expect(ui.has(s.hex.toUpperCase())).toBe(false);
      expect(['#E69F00', '#F0E442', '#FFC42E']).not.toContain(s.hex.toUpperCase());
    }
  });

  it('цвет: первое поле — синий и киноварь; зелёный с пурпурным в одно поле не ставятся', () => {
    expect(MATCH_COLOR.exemplars[0].cards).toEqual(['aba-color-blue', 'aba-color-vermilion']);
    for (const e of MATCH_COLOR.exemplars) {
      for (const [a, b] of ABA_COLOR_NOT_TOGETHER) expect(e.cards!.includes(a) && e.cards!.includes(b)).toBe(false);
    }
  });
});

describe('перенос и различимость (aba-pedagogy-specialist 2026-10-26)', () => {
  it('в переносе — только стимулы, которых не было ни в одном обучении лестницы', () => {
    const taught = new Set(MATCH_LEVEL1.flatMap((t) => t.exemplars.filter((e) => e.role === 'teaching').flatMap((e) => e.cards ?? [])));
    for (const t of MATCH_LEVEL1) {
      for (const e of t.exemplars.filter((x) => x.role === 'generalization')) expect(e.cards!.filter((id) => taught.has(id))).toEqual([]);
    }
  });

  it('формы: квадрат с ромбом и круг с кольцом — не в одном поле; заливка одна на поле', () => {
    for (const e of MATCH_SHAPE.exemplars) {
      const items = e.cards!.map((id) => byId.get(id)!);
      const shapes = items.map((x) => (x.kind === 'shape' ? x.shape : ''));
      for (const [a, b] of ABA_SHAPE_NOT_TOGETHER) expect(shapes.includes(a) && shapes.includes(b)).toBe(false);
      expect(new Set(items.map((x) => (x.kind === 'shape' ? x.fill : ''))).size).toBe(1);
    }
  });

  it('заливка форм — не из цветов-целей', () => {
    const targetHex = new Set(ABA_STIMULI.flatMap((x) => (x.kind === 'color' ? [x.hex.toUpperCase()] : [])));
    for (const f of Object.values(ABA_SHAPE_FILL)) expect(targetHex.has(f.toUpperCase())).toBe(false);
  });
});

describe('пул подкрепителей для программы', () => {
  // худший случай — классы стимулов всех целей ABA-контента (у ребёнка программа — смесь целей)
  const classes = [...new Set(ABA_TARGETS.flatMap(cardsOf).map((id) => byId.get(id)!.class))];
  const ACCESS = [...new Set(Object.values(EXCHANGE_ACCESS_MS))];

  it('классы стимулов не пересекаются с классами каталога', () => {
    const catalog = new Set(REINFORCERS.flatMap((r) => r.classes));
    expect(classes.filter((c) => catalog.has(c))).toEqual([]);
  });

  it.each((['alone', 'with_adult'] as const).flatMap((config) => [true, false].flatMap((soundOn) => ACCESS.map((accessMs) => ({ config, soundOn, accessMs })))))(
    'пул ≥ MIN_REINFORCER_POOL с классами программы: %o',
    (f) => {
      expect(reinforcerPoolFor(REINFORCERS, { ...f, stimulusClasses: classes }).length).toBeGreaterThanOrEqual(MIN_REINFORCER_POOL);
    },
  );
});

describe('допуск цели к сессии и полоса', () => {
  it('предметы без картинки — цель не допускается; формы и цвета рисует код', () => {
    expect(abaTargetReady(MATCH_SHAPE)).toBe(true);
    expect(abaTargetReady(MATCH_LEVEL1[0])).toBe(false);
    const allArt = Object.fromEntries(ABA_STIMULI.map((x) => [x.id, x.kind === 'object' ? {} : null]));
    expect(MATCH_LEVEL1.every((t) => abaTargetReady(t, allArt))).toBe(true);
  });

  it('лестница: пока не готовы «одинаковые», форма и цвет тоже закрыты (предпосылка)', () => {
    expect(readyAbaTargets().map((t) => t.id)).toEqual([]);
    const allArt = Object.fromEntries(ABA_STIMULI.map((x) => [x.id, {}]));
    expect(readyAbaTargets(ABA_TARGETS, allArt).map((t) => t.id)).toEqual(ABA_TARGETS.map((t) => t.id));
  });

  it.each(['7', '8', '9-10'] as const)('полоса %s: выбор из двух — блоком 10, поле 3 — как было; правила цели соблюдены', (band) => {
    for (const t of ABA_TARGETS) {
      const b = targetForBand(t, band);
      expect(b.blockSize).toBe(t.fieldSize === 2 ? 10 : t.blockSize);
      expect(targetErrors(b)).toEqual([]);
    }
  });
});
