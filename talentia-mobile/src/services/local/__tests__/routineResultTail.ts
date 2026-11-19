/**
 * Поля итога прогона рутины, добавленные раундом 4 (Д2, Д3), — для поддельных итогов в тестах
 * хранилища, где важна запись, а не доменный расчёт: законченный прогон (для формы места), входы
 * пересчёта и просьбы о перерыве. Прогон — минимальный: форма места читает из него только
 * `runId`, `day`, `setting` и `target.id`.
 */
import type { RoutineRunRecordBase, RoutineRunResult, RoutineRunState } from '../../../domain/abaRoutineRun';

export function resultTail(
  record: Pick<RoutineRunRecordBase, 'id' | 'day' | 'targetId' | 'setting'>,
  breakRequests: RoutineRunResult['breakRequests'] = { requests: 0, ended: false },
): Pick<RoutineRunResult, 'run' | 'sessionIndex' | 'history' | 'breakRequests'> {
  return {
    run: { runId: record.id, day: record.day, target: { id: record.targetId }, setting: record.setting } as unknown as RoutineRunState,
    sessionIndex: 7,
    history: { runs: [] },
    breakRequests,
  };
}
