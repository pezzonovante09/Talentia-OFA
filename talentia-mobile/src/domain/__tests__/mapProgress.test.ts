import {
  accruePortion,
  afterCompletion,
  beforeStart,
  gameDay,
  mapNodes,
  NEW_LESSONS_CAP,
  NEW_PORTION,
  pointer,
  portionBand,
  reviewNode,
} from '../mapProgress';
import type { MapLesson, RegionInput } from '../mapProgress';

const L = (id: string, band: MapLesson['band'], grade?: 3 | 4): MapLesson => ({ id, band, grade });
const region = (lessons: MapLesson[], completed: string[] = [], started: string[] = []): RegionInput => ({
  lessons,
  completed: new Set(completed),
  started: new Set(started),
});

describe('игровой день', () => {
  it('меняется в 04:00 по местному времени, а не в полночь', () => {
    expect(gameDay(new Date(2026, 9, 2, 23, 50))).toBe('2026-10-02');
    expect(gameDay(new Date(2026, 9, 3, 0, 10))).toBe('2026-10-02');
    expect(gameDay(new Date(2026, 9, 3, 4, 0))).toBe('2026-10-03');
  });
});

describe('порция новых уроков', () => {
  it('при первом запуске — сразу полный потолок', () => {
    expect(accruePortion(NEW_PORTION, '2026-10-02', '5-6')).toEqual({ left: NEW_LESSONS_CAP['5-6'], grantedDay: '2026-10-02' });
  });

  it('в тот же день и при часах назад не начисляется и не отнимается', () => {
    const p = { left: 1, grantedDay: '2026-10-05' };
    expect(accruePortion(p, '2026-10-05', '7')).toBe(p);
    expect(accruePortion(p, '2026-10-03', '7')).toBe(p);
  });

  it('копится по дням до потолка полосы', () => {
    expect(accruePortion({ left: 0, grantedDay: '2026-10-01' }, '2026-10-02', '7')).toEqual({ left: 2, grantedDay: '2026-10-02' });
    expect(accruePortion({ left: 0, grantedDay: '2026-10-01' }, '2026-10-08', '7')).toEqual({ left: 4, grantedDay: '2026-10-08' });
    expect(accruePortion({ left: 1, grantedDay: '2026-10-01' }, '2026-10-03', '9-10')).toEqual({ left: 6, grantedDay: '2026-10-03' });
  });

  it('тратится только первым завершением открытого урока', () => {
    const p = { left: 2, grantedDay: '2026-10-02' };
    expect(afterCompletion(p, 'open').left).toBe(1);
    expect(afterCompletion(p, 'done')).toBe(p);
    expect(afterCompletion(p, 'explored')).toBe(p);
    expect(afterCompletion({ ...p, left: 0 }, 'open').left).toBe(0);
  });
});

describe('узлы карты', () => {
  const math = [L('m1', '5-6'), L('m2', '5-6'), L('m3', '7'), L('m4', '7')];

  it('уроки открываются строго по порядку; без порции следующий спит, а не исчезает', () => {
    expect(mapNodes([region(math, ['m1'])], { band: '5-6' }, 1)).toEqual([['done', 'open', 'ahead', 'ahead']]);
    expect(mapNodes([region(math, ['m1'])], { band: '5-6' }, 0)).toEqual([['done', 'sleeping', 'ahead', 'ahead']]);
  });

  it('следующая полоса региона открывается после всех уроков текущей', () => {
    expect(mapNodes([region(math, ['m1', 'm2'])], { band: '5-6' }, 1)).toEqual([['done', 'done', 'open', 'ahead']]);
  });

  it('брошенный урок можно продолжить и без порции', () => {
    expect(mapNodes([region(math, ['m1'], ['m2'])], { band: '5-6' }, 0)[0][1]).toBe('open');
  });

  it('начатый урок занимает порцию: с порцией 1 второй регион спит', () => {
    const words = [L('w1', '5-6'), L('w2', '5-6')];
    expect(mapNodes([region(math, [], ['m1']), region(words)], { band: '5-6' }, 1)).toEqual([
      ['open', 'ahead', 'ahead', 'ahead'],
      ['sleeping', 'ahead'],
    ]);
  });

  it('старт с 7: уроки 5-6 — исследованная земля, проходить их можно и порцию они не держат', () => {
    expect(mapNodes([region(math, ['m1'], ['m2'])], { band: '7' }, 1)).toEqual([['explored', 'explored', 'open', 'ahead']]);
  });

  it('старт с 4 класса: темы 3 класса на 9-10 — исследованная земля', () => {
    const big = [L('b1', '9-10', 3), L('b2', '9-10', 3), L('b3', '9-10', 4)];
    expect(beforeStart(big[0], { band: '9-10', grade: 4 })).toBe(true);
    expect(beforeStart(big[2], { band: '9-10', grade: 4 })).toBe(false);
    expect(beforeStart(L('m', '8'), { band: '9-10', grade: 3 })).toBe(true);
    expect(mapNodes([region(big)], { band: '9-10', grade: 4 }, 2)).toEqual([['explored', 'explored', 'open']]);
  });

  it('порция считается по старшей текущей полосе среди регионов', () => {
    const words = [L('w1', '5-6'), L('w2', '7')];
    expect(portionBand([region(math, ['m1', 'm2']), region(words)], { band: '5-6' })).toBe('7');
    expect(portionBand([region(math), region(words)], { band: '8' })).toBe('8');
  });
});

describe('повторение и указатель', () => {
  it('узел повторения всегда на карте: активен, когда есть навыки к сроку, иначе приглушён', () => {
    expect(reviewNode(2)).toBe('active');
    expect(reviewNode(0)).toBe('quiet');
  });

  it('указатель — на первый открытый урок, при потраченной порции — на повторение, на исследованную землю никогда', () => {
    expect(pointer([['explored', 'open'], ['open']], 'active')).toEqual({ region: 0, lesson: 1 });
    expect(pointer([['done', 'sleeping'], ['sleeping']], 'active')).toBe('review');
    expect(pointer([['explored', 'sleeping']], 'quiet')).toBeNull();
  });
});
