/**
 * Ключи нарративного фидбека по id задания.
 *
 * Пусто: карта генерировалась скриптом из прежнего корпуса, а он удалён
 * целиком. Имя экспорта и форма сохранены, чтобы экран урока продолжал
 * собираться; наполнится заново вместе с новым корпусом по учебникам.
 */
export type TaskFeedbackKeyEntry = {
  correctFeedbackKey: string;
  incorrectFeedbackKey?: string;
};

export const TASK_FEEDBACK_KEYS_BY_TASK_ID: Record<string, TaskFeedbackKeyEntry> = {};
