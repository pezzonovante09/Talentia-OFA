/** Ручные часы: срок вызывается по порядку, время в колбэке — срок; отмена снимает вызов. */
import { manualClock } from '../clock';

describe('manualClock', () => {
  it('advance вызывает наступившее по сроку; now в колбэке — срок; отмена работает', () => {
    const c = manualClock(0);
    const seen: [string, number][] = [];
    c.at(300, () => seen.push(['b', c.now()]));
    c.at(100, () => seen.push(['a', c.now()]));
    const cancel = c.at(200, () => seen.push(['x', c.now()]));
    cancel();
    c.advance(250);
    expect(seen).toEqual([['a', 100]]);
    expect(c.now()).toBe(250);
    c.advance(100);
    expect(seen).toEqual([['a', 100], ['b', 300]]);
    expect(c.pending()).toBe(0);
  });

  it('вызов, поставленный из колбэка в пределах advance, тоже срабатывает', () => {
    const c = manualClock(0);
    const seen: number[] = [];
    c.at(100, () => c.at(150, () => seen.push(c.now())));
    c.advance(200);
    expect(seen).toEqual([150]);
  });
});
