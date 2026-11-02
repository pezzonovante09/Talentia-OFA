/**
 * Хвост конца сессии (раздел 9, №169): итог уже записан (`commitAbaSession` — до доступа, чтобы свёрнутое во время
 * доступа приложение не теряло итог по целям), дальше экран проигрывает, что домен решил в `finishAbaSession`.
 *
 * - обмен в конце (`exchanged > 0`) → экран обмена без кнопки (требования к ребёнку в конце нет) → доступ по ступени
 *   доски, на которой ребёнок работал (`session.boardSize`, а не новая ступень) → «Закончили»;
 * - цикл сопряжения (событие `pairing` в итоге — экран и журнал не расходятся) → «Закончили» с неактивной «Готово»
 *   `pairingCycleAfterMs` → одна ячейка и Tali `point`, жетон, обмен → доступ 20 с → «Закончили» с «Готово»;
 * - иначе — сразу «Закончили».
 *
 * Обмен и цикл сопряжения в одном конце не встречаются: цикл — только без обмена (№169).
 */
import { EXCHANGE_ACCESS_MS, PAIRING } from '../../../domain/abaTokenTraining';
import type { AbaSessionEvent } from '../../../types/aba';

export type TailStep =
  | { kind: 'exchange'; tokens: number; boardSize: number }
  | { kind: 'access'; durationMs: number }
  /** «Закончили» стоит, «Готово» неактивна: взрослый не кончит первую сессию раньше цикла. */
  | { kind: 'wait'; ms: number }
  | { kind: 'pairing_token' }
  | { kind: 'end' };

export function endTail(input: { exchanged: number; boardSize: number; events: readonly AbaSessionEvent[] }): TailStep[] {
  if (input.exchanged > 0) {
    const size = input.boardSize as keyof typeof EXCHANGE_ACCESS_MS;
    return [
      { kind: 'exchange', tokens: input.exchanged, boardSize: input.boardSize },
      { kind: 'access', durationMs: EXCHANGE_ACCESS_MS[size] ?? EXCHANGE_ACCESS_MS[3] },
      { kind: 'end' },
    ];
  }
  if (input.events.some((e) => e.kind === 'pairing')) {
    return [{ kind: 'wait', ms: PAIRING.tokenAfterMs }, { kind: 'pairing_token' }, { kind: 'access', durationMs: PAIRING.accessMs }, { kind: 'end' }];
  }
  return [{ kind: 'end' }];
}
