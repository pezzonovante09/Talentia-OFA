/**
 * Порт прогресса ребёнка — единственная точка, через которую экраны читают и пишут итоги уроков.
 *
 * Две реализации:
 * - `noRecordPort` — режим без записи (нет согласия `account_local`, PARENT.md п. 5; решение №130):
 *   читать нечего, запись отвечает `LessonConsentRequiredError` — как ответил бы `commitLesson`.
 *   Память сеанса (`state/childSession.ts`) применяет итог сама **после** этого ответа.
 * - `sqlitePort(db)` — устройство с аккаунтом: `loadChildState` × 3 и `commitLesson` (одна транзакция,
 *   проверка согласия и счётчика внутри). Экраны между реализациями не различают.
 *
 * Сюда не добавлять прямых запросов к базе: запись итогов — только `commitLesson` (CLAUDE.md).
 */
import type { AtlasEntry } from '../domain/lessonAssembly';
import type { SkillState } from '../domain/mastery';
import type { TaskFormat } from '../types/task';
import { LessonConsentRequiredError } from './local/accountConsent';
import { loadChildState } from './local/childState';
import { commitLesson, type LessonCommit } from './local/commit';
import type { SqlDb } from './local/sql';

export type ProgressSnapshot = {
  skills: SkillState[];
  atlas: AtlasEntry[];
  lessonCounter: number;
  /** Составные форматы, которые ребёнок уже встречал: демо показывается один раз (№35). */
  formatsSeen: TaskFormat[];
};

export const EMPTY_PROGRESS: ProgressSnapshot = { skills: [], atlas: [], lessonCounter: 0, formatsSeen: [] };

export interface ProgressPort {
  load(childId: string): Promise<ProgressSnapshot>;
  /** Бросает `LessonConsentRequiredError` без согласия и `LessonStaleError` при устаревшем счётчике. */
  commit(childId: string, c: LessonCommit, at: string): Promise<void>;
}

export const noRecordPort: ProgressPort = {
  load: () => Promise.resolve({ ...EMPTY_PROGRESS }),
  commit: () => Promise.reject(new LessonConsentRequiredError('not_asked')),
};

export function sqlitePort(db: SqlDb): ProgressPort {
  return {
    async load(childId) {
      const [skills, atlas, lessonCounter, formatsSeen] = await Promise.all([
        loadChildState(db, childId, 'skills'),
        loadChildState(db, childId, 'atlas'),
        loadChildState(db, childId, 'lessonCounter'),
        loadChildState(db, childId, 'formatsSeen'),
      ]);
      return { skills: skills ?? [], atlas: atlas ?? [], lessonCounter: lessonCounter ?? 0, formatsSeen: formatsSeen ?? [] };
    },
    commit: (childId, c, at) => commitLesson(db, childId, c, at),
  };
}
