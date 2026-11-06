/**
 * Выжившая мутация раунда 3 (а): `finishAbaSession` при устаревшем выборе подкрепителя
 * (`reinforcerStale`) не делает финального обмена ни по одной причине из `EXCHANGE_AT_END`.
 * Проверяем всё, что обмен менял бы: `exchanged`, `exchangesMade` сессии, доску, событие `exchange`
 * и ступень доски (через `exchanges` в `applyStageSession`). Контроль — те же сессии без stale.
 */
import { resumeAbaSession, type AbaSessionState } from '../abaSession';
import { finishSession } from './abaFixtures';
import type { AbaSessionEndReason } from '../../types/aba';
import { beginSession } from './abaSessionDriver';

const END_BASE = Date.UTC(2026, 9, 12, 8, 30);
const OPTIONS = ['paint_drop', 'kaleidoscope', 'pinwheel'];
/** Все причины, при которых без stale в конце сессии обмен бывает (`EXCHANGE_AT_END`). */
const EXCHANGE_REASONS: AbaSessionEndReason[] = ['completed', 'time_limit', 'breakdown', 'assent_withdrawn'];

/** Полная доска; обмен рутины после выбора подкрепителя — выбор устарел. */
function staleFull(): AbaSessionState {
  const full = beginSession({ board: { earned: 5, nonContingent: 0 } });
  const stale = resumeAbaSession(full, { earned: 5, nonContingent: 0, rev: 1 }, { routineExchanged: true, options: OPTIONS });
  expect(stale.reinforcerStale).toBe(true); // предпосылка теста
  return stale;
}
const ended = (st: AbaSessionState, endReason: AbaSessionEndReason): AbaSessionState => ({ ...st, endReason, queue: [] });

describe.each(EXCHANGE_REASONS)('finishAbaSession при устаревшем подкрепителе, причина %s', (reason) => {
  it('не делает обмена: exchanged = 0', () => {
    const r = finishSession(ended(staleFull(), reason), END_BASE);
    expect(r.exchanged).toBe(0);
  });

  it('не засчитывает обмен сессии: exchangesMade прежний', () => {
    const before = staleFull();
    const r = finishSession(ended(before, reason), END_BASE);
    expect(r.session.exchangesMade).toBe(before.exchangesMade);
  });

  it('оставляет доску как есть: жетоны не сгорают и уходят на следующую сессию', () => {
    const r = finishSession(ended(staleFull(), reason), END_BASE);
    expect([r.board.earned, r.board.nonContingent]).toEqual([5, 0]);
  });

  it('не пишет в события сессии обмен', () => {
    const r = finishSession(ended(staleFull(), reason), END_BASE);
    expect(r.session.events.filter((e) => e.kind === 'exchange')).toEqual([]);
  });

  it('контроль: та же полная доска без устаревшего выбора обменивается', () => {
    const fresh = beginSession({ board: { earned: 5, nonContingent: 0 } });
    const r = finishSession(ended(fresh, reason), END_BASE);
    expect([r.exchanged, r.session.exchangesMade, r.board.earned]).toEqual([5, 1, 0]);
  });
});

describe('finishAbaSession: причины без обмена в конце', () => {
  it.each(['adult_stopped', 'abandoned', 'unreliable_measurement', 'app_backgrounded', 'app_error'] as const)('%s: полная доска не обменивается и без stale', (reason) => {
    const r = finishSession(ended(beginSession({ board: { earned: 5, nonContingent: 0 } }), reason), END_BASE);
    expect([r.exchanged, r.board.earned]).toEqual([0, 5]);
  });
});
