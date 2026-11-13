/**
 * Метки «сосчитано» в кучке стимула (`countMark`, №83; контрольный аудит 2026-11-09, Ж9 / этап B3):
 * первое касание — точка с кольцом `ring`; повторное по той же фигуре — пик `repeatRing.to` с контуром,
 * держится до отпускания пальца + `tailMs`; касание мимо — знак промаха `missRing`.
 */
import { countMark, countSizes } from '../../../design/tokens';
import { placeFigures } from '../../../domain/countPositions';
import { act, fireEvent, renderWithProviders, screen } from '../../../test/render';
import type { Media } from '../../../types/task';
import { Pile } from '../Pile';

const media: Media = { labelKey: 'x', shape: 'stone', count: 3, layout: 'row' };
const placed = placeFigures('row', 3, { figure: countSizes.figureStimulus, step: countSizes.figureStimulus + countSizes.stimulusGap });
// ряд шире фигуры — поле совпадает с раскладкой, смещений нет
const center = (i: number) => ({ locationX: placed.points[i].x, locationY: placed.points[i].y });

const down = (where: { locationX: number; locationY: number }) => fireEvent(screen.getByTestId('pile'), 'responderGrant', { nativeEvent: where });
const up = () => fireEvent(screen.getByTestId('pile'), 'responderRelease', { nativeEvent: {} });
const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
/** Сторона svg метки: точка + 2 × кольцо (+ 2 × контур на пике). */
const svgSide = (id: string) => (screen.getByTestId(id).children[0] as unknown as { props: { width: number } }).props.width;

describe('Pile: метки сосчитанного', () => {
  it('первое касание фигуры — метка с кольцом ring, без пика', async () => {
    await renderWithProviders(<Pile media={media} variant="stimulus" />);
    await down(center(0));
    expect(screen.getByTestId('pile-mark-0')).toBeTruthy();
    expect(screen.queryByTestId('pile-mark-0-peak')).toBeNull();
    expect(svgSide('pile-mark-0')).toBe(countMark.dot + countMark.ring * 2);
  });

  it('повторное касание той же фигуры — пик: кольцо repeatRing.to с контуром peakOutline', async () => {
    await renderWithProviders(<Pile media={media} variant="stimulus" />);
    await down(center(0));
    await up();
    await down(center(0));
    expect(screen.getByTestId('pile-mark-0-peak')).toBeTruthy();
    expect(screen.queryByTestId('pile-mark-0')).toBeNull();
    expect(svgSide('pile-mark-0-peak')).toBe(countMark.dot + countMark.repeatRing.to * 2 + countMark.repeatRing.peakOutline.width * 2);
  });

  it('пик держится, пока палец на фигуре: без отпускания и через 2 × tailMs он на месте', async () => {
    await renderWithProviders(<Pile media={media} variant="stimulus" />);
    await down(center(0));
    await up();
    await down(center(0));
    await wait(countMark.repeatRing.tailMs * 2);
    expect(screen.getByTestId('pile-mark-0-peak')).toBeTruthy();
  });

  it('после отпускания пик держится tailMs и возвращается к обычной метке', async () => {
    await renderWithProviders(<Pile media={media} variant="stimulus" />);
    await down(center(0));
    await up();
    await down(center(0));
    await up();
    await wait(countMark.repeatRing.tailMs - 150);
    expect(screen.getByTestId('pile-mark-0-peak')).toBeTruthy();
    await wait(250);
    expect(screen.queryByTestId('pile-mark-0-peak')).toBeNull();
    expect(screen.getByTestId('pile-mark-0')).toBeTruthy();
  });

  it('отмена жеста (responderTerminate) тоже снимает пик через tailMs', async () => {
    await renderWithProviders(<Pile media={media} variant="stimulus" />);
    await down(center(1));
    await up();
    await down(center(1));
    await fireEvent(screen.getByTestId('pile'), 'responderTerminate', { nativeEvent: {} });
    await wait(countMark.repeatRing.tailMs + 100);
    expect(screen.getByTestId('pile-mark-1')).toBeTruthy();
  });

  it('пик у одной фигуры не трогает метки остальных', async () => {
    await renderWithProviders(<Pile media={media} variant="stimulus" />);
    await down(center(0));
    await up();
    await down(center(1));
    await up();
    await down(center(0));
    expect(screen.getByTestId('pile-mark-0-peak')).toBeTruthy();
    expect(screen.getByTestId('pile-mark-1')).toBeTruthy();
  });

  it('касание мимо — знак промаха размером missRing.size, меток нет', async () => {
    await renderWithProviders(<Pile media={media} variant="stimulus" />);
    await down({ locationX: placed.points[0].x, locationY: placed.points[0].y + countMark.snapRadius + 20 });
    expect(screen.getByTestId('pile-miss')).toBeTruthy();
    expect(svgSide('pile-miss')).toBe(countMark.missRing.size);
    expect(screen.queryAllByTestId(/^pile-mark-/)).toHaveLength(0);
  });

  it('знак промаха снимается через missRing.tailMs после отпускания', async () => {
    await renderWithProviders(<Pile media={media} variant="stimulus" />);
    await down({ locationX: placed.points[0].x, locationY: placed.points[0].y + countMark.snapRadius + 20 });
    await up();
    await wait(countMark.missRing.tailMs + 100);
    expect(screen.queryByTestId('pile-miss')).toBeNull();
  });

  it('markedAll (атлас): метки на всех фигурах, без пика при касании', async () => {
    await renderWithProviders(<Pile media={media} variant="stimulus" markedAll />);
    await down(center(0));
    await down(center(0));
    expect(screen.getAllByTestId(/^pile-mark-\d$/)).toHaveLength(3);
    expect(screen.queryByTestId('pile-mark-0-peak')).toBeNull();
  });

  it('плитка (tile) касания не размечает', async () => {
    await renderWithProviders(<Pile media={media} variant="tile" />);
    await down({ locationX: 12, locationY: 12 });
    expect(screen.queryAllByTestId(/^pile-mark-/)).toHaveLength(0);
  });
});
