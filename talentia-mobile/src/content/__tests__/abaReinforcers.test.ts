/**
 * Каталог подкрепителей ABA (№149): состав, запреты, пул после фильтров, «не в одну тройку». Пул по классам
 * стимулов целей контента — в `abaTargets.test.ts`. «Награда от взрослого» (`from_adult`) — решение 14 методиста.
 */
import { MIN_REINFORCER_POOL, reinforcerChoices } from '../../domain/abaTokens';
import { apartPairs, reinforcerPoolFor } from '../../domain/abaReinforcerCatalog';
import { EXCHANGE_ACCESS_MS } from '../../domain/abaTokenTraining';
import { seeded } from '../../domain/abaRandom';
import ru from '../../i18n/locales/ru.json';
import en from '../../i18n/locales/en.json';
import { REINFORCERS } from '../aba/reinforcers';

// №149 «в v1 только фиксированный каталог с картинками» пересмотрен 2026-11-18 (решение 14 методиста, подтвердил
// владелец): `from_adult` — награду даёт взрослый вне приложения, только «Со взрослым» и при включённой настройке
// профиля; что дали — не записывается. Запрет на еду, экраны, наклейки и прочее (`FORBIDDEN`) в самом каталоге остаётся.
const ALLOWED = ['bubbles', 'kaleidoscope', 'pinwheel', 'marble_run', 'puzzle4', 'tali_dance', 'paint_drop', 'drum', 'xylophone', 'song', 'sing_together', 'from_adult'];
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

  it.each((['alone', 'with_adult'] as const).flatMap((config) => [true, false].flatMap((soundOn) => [false, true].flatMap((adultReward) => ACCESS.map((accessMs) => ({ config, soundOn, adultReward, accessMs }))))))(
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
        for (const [accessMs, adultReward] of [20_000, 40_000, 60_000].flatMap((ms) => [[ms, false], [ms, true]] as const)) {
          const pool = reinforcerPoolFor(REINFORCERS, { config, soundOn, adultReward, accessMs, stimulusClasses: [] });
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

  describe('«Награда от взрослого» (решение 14)', () => {
    const base = { soundOn: true, accessMs: 20_000, stimulusClasses: [] as string[] };

    it('скрыта, пока настройка выключена или не передана', () => {
      expect(reinforcerPoolFor(REINFORCERS, { ...base, config: 'with_adult' })).not.toContain('from_adult');
      expect(reinforcerPoolFor(REINFORCERS, { ...base, config: 'with_adult', adultReward: false })).not.toContain('from_adult');
    });

    it('в «Сам» скрыта и при включённой настройке', () => {
      expect(reinforcerPoolFor(REINFORCERS, { ...base, config: 'alone', adultReward: true })).not.toContain('from_adult');
    });

    it('«Со взрослым» при включённой настройке — в пуле; позиция беззвучная, без классов стимулов', () => {
      expect(reinforcerPoolFor(REINFORCERS, { ...base, config: 'with_adult', adultReward: true })).toContain('from_adult');
      expect(reinforcerPoolFor(REINFORCERS, { ...base, soundOn: false, config: 'with_adult', adultReward: true })).toContain('from_adult');
      const item = REINFORCERS.find((r) => r.id === 'from_adult');
      expect(item).toMatchObject({ sound: false, configs: ['with_adult'], adultGiven: true, classes: [] });
    });

    it('в тройке выбора — не больше одного раза и иногда есть', () => {
      const pool = reinforcerPoolFor(REINFORCERS, { ...base, config: 'with_adult', adultReward: true });
      const apart = apartPairs(REINFORCERS);
      let seen = 0;
      for (let seed = 1; seed <= 300; seed += 1) {
        const three = reinforcerChoices(pool, [], seeded(seed).rng, apart);
        expect(three).toHaveLength(3);
        const n = three.filter((id) => id === 'from_adult').length;
        expect(n).toBeLessThanOrEqual(1);
        seen += n;
      }
      expect(seen).toBeGreaterThan(0);
    });

    it('выбранная дважды подряд в третий раз не предлагается (общее правило)', () => {
      const pool = reinforcerPoolFor(REINFORCERS, { ...base, config: 'with_adult', adultReward: true });
      for (let seed = 1; seed <= 100; seed += 1) {
        expect(reinforcerChoices(pool, ['from_adult', 'from_adult'], seeded(seed).rng, apartPairs(REINFORCERS))).not.toContain('from_adult');
      }
    });
  });
});
