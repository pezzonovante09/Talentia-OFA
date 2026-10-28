/**
 * Каталог подкрепителей ABA (№149): состав, запреты, пул после фильтров, «не в одну тройку». Пул по классам
 * стимулов целей контента — в `abaTargets.test.ts`.
 */
import { MIN_REINFORCER_POOL, reinforcerChoices } from '../../domain/abaTokens';
import { apartPairs, reinforcerPoolFor } from '../../domain/abaReinforcerCatalog';
import { EXCHANGE_ACCESS_MS } from '../../domain/abaTokenTraining';
import { seeded } from '../../domain/abaRandom';
import ru from '../../i18n/locales/ru.json';
import en from '../../i18n/locales/en.json';
import { REINFORCERS } from '../aba/reinforcers';

const ALLOWED = ['bubbles', 'kaleidoscope', 'pinwheel', 'marble_run', 'puzzle4', 'tali_dance', 'paint_drop', 'drum', 'xylophone', 'song', 'sing_together'];
const FORBIDDEN = /sticker|candy|sweet|food|cookie|video|cartoon|youtube|game|shop|coin|high_five|tickle|confetti|chat/i;
const ACCESS = [...new Set(Object.values(EXCHANGE_ACCESS_MS))];

describe('каталог подкрепителей', () => {
  it('состав v1 утверждён; id уникальны; запрещённого нет', () => {
    const ids = REINFORCERS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...ALLOWED].sort());
    expect(ids.filter((id) => FORBIDDEN.test(id))).toEqual([]);
  });

  it('название — ключ локали, есть на ru и en', () => {
    const get = (o: unknown, k: string) => k.split('.').reduce<unknown>((x, p) => (x as Record<string, unknown> | undefined)?.[p], o);
    for (const r of REINFORCERS) {
      expect(typeof get(ru, r.labelKey)).toBe('string');
      expect(typeof get(en, r.labelKey)).toBe('string');
    }
  });

  it('беззвучных не меньше MIN_REINFORCER_POOL в «Сам» при самом коротком доступе', () => {
    expect(reinforcerPoolFor(REINFORCERS, { config: 'alone', soundOn: false, accessMs: Math.min(...ACCESS), stimulusClasses: [] }).length).toBeGreaterThanOrEqual(MIN_REINFORCER_POOL);
  });

  it.each((['alone', 'with_adult'] as const).flatMap((config) => [true, false].flatMap((soundOn) => ACCESS.map((accessMs) => ({ config, soundOn, accessMs })))))(
    'пул ≥ MIN_REINFORCER_POOL: %o',
    (f) => {
      expect(reinforcerPoolFor(REINFORCERS, { ...f, stimulusClasses: [] }).length).toBeGreaterThanOrEqual(MIN_REINFORCER_POOL);
    },
  );

  it('фильтры: без звука — без звуковых; доступ 20 с — без пазла; «Сам» — без «Поём вместе»', () => {
    const pool = reinforcerPoolFor(REINFORCERS, { config: 'alone', soundOn: false, accessMs: 20_000, stimulusClasses: [] });
    expect(pool).not.toEqual(expect.arrayContaining(['drum']));
    expect(pool).not.toContain('puzzle4');
    expect(pool).not.toContain('sing_together');
    expect(reinforcerPoolFor(REINFORCERS, { config: 'with_adult', soundOn: true, accessMs: 40_000, stimulusClasses: ['ball'] })).not.toContain('marble_run');
  });

  it('«Песенка» и «Поём вместе» никогда не в одной тройке', () => {
    const pool = reinforcerPoolFor(REINFORCERS, { config: 'with_adult', soundOn: true, accessMs: 60_000, stimulusClasses: [] });
    const apart = apartPairs(REINFORCERS);
    for (let seed = 1; seed <= 300; seed += 1) {
      const three = reinforcerChoices(pool, [], seeded(seed).rng, apart);
      expect(three).toHaveLength(3);
      expect(three.includes('song') && three.includes('sing_together')).toBe(false);
    }
  });

  it('№164: у позиции не больше одной пары — тройка из пяти кандидатов всегда набирается', () => {
    const per = new Map<string, number>();
    for (const [a, b] of apartPairs(REINFORCERS)) for (const id of [a, b]) per.set(id, (per.get(id) ?? 0) + 1);
    expect([...per.values()].every((n) => n <= 1)).toBe(true);
  });

  it('№164: три варианта при любом пуле после фильтров и выборе, заблокированном «дважды подряд»', () => {
    const apart = apartPairs(REINFORCERS);
    for (const config of ['alone', 'with_adult'] as const) {
      for (const soundOn of [false, true]) {
        for (const accessMs of [20_000, 40_000, 60_000]) {
          const pool = reinforcerPoolFor(REINFORCERS, { config, soundOn, accessMs, stimulusClasses: [] });
          if (pool.length < 6) continue;
          for (const blocked of pool) {
            for (let seed = 1; seed <= 40; seed += 1) {
              const three = reinforcerChoices(pool, [blocked, blocked], seeded(seed).rng, apart);
              expect(three).toHaveLength(3);
              expect(three).not.toContain(blocked);
            }
          }
        }
      }
    }
  });
});

