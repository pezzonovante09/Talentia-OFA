/**
 * Полоса порядка `order` (SCREENS.md 3.4; решение владельца №143): линия от первого места до последнего
 * и засечки над центрами мест, наконечника нет; на 5–6 цифр в местах нет.
 */
import { regionLessons } from '../../../content';
import type { OrderTask } from '../../../types/task';
import { renderWithProviders, screen } from '../../../test/render';
import { emptyOrderDraft } from '../../../domain/taskDraft';
import { OrderTaskView } from '../formats/OrderTask';
import type { TaskStep } from '../formats/types';
import i18n, { initI18n } from '../../../i18n';

const task = regionLessons('numbers')
  .flatMap((l) => l.tasks)
  .find((t) => t.format === 'order') as OrderTask;

const step: TaskStep = {
  kind: 'task',
  task,
  transferProbe: false,
  review: false,
  progress: { segment: 0, total: 4 },
  attempt: 'first',
  stage: 'answer',
  narrowing: null,
  removed: [],
  rightOrder: null,
  kept: [],
  pinned: null,
  demo: false,
  answerCue: true,
  activeResponse: null,
  feedback: null,
  counts: true,
};

describe('полоса порядка', () => {
  it('линия и засечки по числу мест, наконечника нет', async () => {
    initI18n({ lng: 'ru' });
    await renderWithProviders(
      <OrderTaskView step={step} draft={emptyOrderDraft(task)} phase="answer" wrong={[]} listening={null} width={343} height={275} onTap={() => undefined} onTouch={() => undefined} t={i18n.t} marksKey={0} />,
    );
    expect(screen.getByTestId('order-strip')).toBeTruthy();
    expect(screen.getByTestId('order-line')).toBeTruthy();
    expect(screen.getAllByTestId('order-tick')).toHaveLength(task.items.length);
    expect(screen.queryByTestId('order-arrow')).toBeNull();
    expect(screen.getAllByTestId(/^place-\d$/)).toHaveLength(task.items.length);
    expect(screen.getAllByTestId(/^item-i\d$/)).toHaveLength(task.items.length);
  });
});
