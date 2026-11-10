/**
 * Ключи локали, которые ни один экран пока не вызывает, но которые ждут своих экранов (контрольный аудит 2026-11-09,
 * `localization-qa`, вопрос 103; рабочее допущение №185). Остальные неиспользуемые ключи удалены. Эти **не переводить
 * на ky** до появления экранов: носитель переведёт текст, который ещё может измениться.
 *
 * - `abaRoutine.*` (кроме `kind`) — экраны рутин (этап 11 их не делал: только `match`);
 * - `abaPanel.undo` — отмена отметки взрослого (вопрос методисту 40);
 * - `abaBreak.offer` / `done` / `endedToday` — «Tali предлагает перерыв» в режиме «Без взрослого»;
 * - `parent.data.exportJson` / `exportCsv` / `exportFirst` / `deleteWithoutExport` — экран экспорта родителю (№184, к выпуску).
 */
export const PENDING_KEYS: readonly string[] = [
  'abaRoutine.doneToday',
  'abaRoutine.whatNow',
  'abaRoutine.start',
  'abaRoutine.handover',
  'abaRoutine.whereRan',
  'abaRoutine.setting.usual',
  'abaRoutine.setting.other_adult',
  'abaRoutine.setting.other_place',
  'abaRoutine.transferHint',
  'abaPanel.undo',
  'abaBreak.offer',
  'abaBreak.done',
  'abaBreak.endedToday',
  'parent.data.exportJson',
  'parent.data.exportCsv',
  'parent.data.exportFirst',
  'parent.data.deleteWithoutExport',
];
