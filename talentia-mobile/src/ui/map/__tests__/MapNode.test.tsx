/**
 * Подпись узла карты для скринридера называет состояние (аудит 2026-11-09, UX п. 11 / этап B6):
 * пройденный, доступный и закрытый иначе звучали одинаково.
 */
import type { NodeState } from '../../../domain/mapProgress';
import { renderWithProviders, screen } from '../../../test/render';
import { MapNode, type MapNodeKind } from '../MapNode';

const label = async (node: MapNodeKind, lng: 'ru' | 'en' = 'ru') => {
  await renderWithProviders(<MapNode node={node} onOpen={() => undefined} onVoice={() => undefined} panning={() => false} testID="node" />, { lng });
  return screen.getByTestId('node').props.accessibilityLabel as string;
};
const lesson = (state: NodeState, unavailable = false): MapNodeKind => ({ kind: 'lesson', state, unavailable, number: 3 });

describe('MapNode: состояние в подписи', () => {
  it.each([
    ['open', 'Урок 3, можно пройти'],
    ['done', 'Урок 3, пройден'],
    ['explored', 'Урок 3, пройден'],
    ['sleeping', 'Урок 3, закрыт'],
    ['ahead', 'Урок 3, закрыт'],
  ] as const)('%s → «%s»', async (state, expected) => {
    expect(await label(lesson(state))).toBe(expected);
  });

  it('недоступный на языке открытый урок — «закрыт», не «можно пройти»', async () => {
    expect(await label(lesson('open', true))).toBe('Урок 3, закрыт');
  });

  it('en: состояние тоже в подписи', async () => {
    const l = await label(lesson('done'), 'en');
    expect(l).toMatch(/^Lesson 3, /);
    expect(l).not.toMatch(/a11y\./);
  });
});
