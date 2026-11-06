/**
 * Записи экрана сессии ABA (фаза 8): снимок шага и очередь записей вне хода шага. Конфликт доски — состояние на живую
 * доску и эта же запись заново, не больше `MAX_BOARD_CONFLICT_RETRIES` за сессию (план фазы 8, д): повторяется один шаг, а
 * не всё действие, записи до него уже прошли. Прочие ошибки уходят наверх, в разбор экрана.
 */
import { useRef, type MutableRefObject } from 'react';

import { resumeAbaSession, type AbaSessionState } from '../../domain/abaSession';
import { boardRevOf } from '../../domain/abaTokens';
import { classifyAbaWriteError, MAX_BOARD_CONFLICT_RETRIES } from '../../services/local/abaResume';
import { loadChildState } from '../../services/local/childState';
import { saveAbaSessionStep } from '../../services/local/commit';
import type { SqlDb } from '../../services/local/sql';

type Choice = Parameters<typeof saveAbaSessionStep>[4];

export function useSessionWrites(o: { db: SqlDb | null; childId: string | null; st: MutableRefObject<AbaSessionState | null>; now: () => number }) {
  const { db, childId, st, now } = o;
  /** Запись просьбы, сделанной вне хода шага (карточка «перерыв» на последствии и участии): следующий шаг её ждёт. */
  const writing = useRef<Promise<void> | null>(null);
  const conflictRetries = useRef(0);

  const boardRetry = async <T>(write: () => Promise<T>): Promise<T> => {
    for (;;) {
      try {
        return await write();
      } catch (e) {
        if (classifyAbaWriteError(e) !== 'conflict' || !db || !childId || !st.current || conflictRetries.current >= MAX_BOARD_CONFLICT_RETRIES) throw e;
        if (__DEV__) console.warn('aba-session', e);
        conflictRetries.current += 1;
        const live = (await loadChildState(db, childId, 'abaBoard')) ?? { earned: 0, nonContingent: 0 };
        st.current = resumeAbaSession(st.current, { earned: live.earned, nonContingent: live.nonContingent, rev: boardRevOf(live) }, { routineExchanged: false });
      }
    }
  };

  /** Сохранить снимок сессии в работе (после выкладки поля, выбора, перерыва, доступа). */
  const save = async (s: AbaSessionState, choice?: Choice) => (db && childId ? saveAbaSessionStep(db, childId, s, new Date(now()).toISOString(), choice) : s);

  /** Запись не затирает состояние, которое за это время ушло дальше (просьба о перерыве): оно наследует новую версию доски. */
  const land = async (target: AbaSessionState, choice?: Choice) => {
    const before = st.current;
    const saved = await save(target, choice);
    st.current = st.current === before ? saved : { ...st.current!, boardRev: saved.boardRev };
  };

  /** Снимок шага: `make` считает состояние от текущего — после конфликта доски шаг пересчитывается от живой доски. */
  const saveStep = (make: (s: AbaSessionState) => AbaSessionState, choice?: Choice) => boardRetry(() => land(make(st.current!), choice));

  /** Запись вне хода шага: ложится после идущей; `advance` её ждёт. */
  const writeAside = (): Promise<void> => {
    const w = (writing.current ?? Promise.resolve()).then(() => boardRetry(() => land(st.current!)));
    writing.current = w;
    return w.finally(() => {
      if (writing.current === w) writing.current = null;
    });
  };

  return { writing, boardRetry, saveStep, writeAside };
}
