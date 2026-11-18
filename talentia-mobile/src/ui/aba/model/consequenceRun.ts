/**
 * Последствие пробы ABA — расписание от записи (`markedAt`, Ц2.6.1; `abaConsequence`, `abaReinforcementOverlay`,
 * `abaInterTrial`). Сначала запись пробы (`recordAbaTrial`), потом последствие (спецификация п. 7): жетон,
 * показанный и не записанный, для ребёнка — отнятый.
 *
 * - `token_praise` — плашка сменой кадра в 0, жетон приземляется в `abaTokenLandingMs()` со звуком `token`,
 *   похвала голосом в 700 (calm 500), плашка уходит в 4000;
 * - `praise` / `listened` — без плашки (иначе подсказанный ответ получил бы тот же условный подкрепитель, что
 *   самостоятельный): знак «принято» в центре полосы (`abaVisiblePraise`, решение 35) с 0 до 1000 и голос в 300 —
 *   в calm голоса нет; `neutral` — ничего;
 * - следующий SD — `abaNextSdAt(markedAt, tokenAddedLandedAt)`; пустые плиты межпробной паузы — с 4000;
 * - жетон пробы заполнил доску (`exchange`, №172): плашки до 4000, пустых плит и SD нет — `exchange` через
 *   `abaExchange.fromFullBoard.afterLandingMs` после посадки жетона (1040, calm 820); похвала договаривается на
 *   удержании полной доски экрана обмена.
 *
 * Просьба «перерыв» в эту фазу — сразу в домен (`requestBreakBetweenTrials`, №160): модель её не ждёт, следующий
 * шаг в срок `next_sd` и будет перерывом.
 */
import { abaExchange, abaInterTrial, abaNextSdAt, abaReinforcementOverlay, abaTokenLandingMs, abaConsequence, abaVisiblePraise } from '../../../design/abaTokens';
import type { Feedback } from '../../../domain/abaTokens';

export type ConsequenceEffect =
  | { kind: 'overlay_show' }
  | { kind: 'token_land' }
  | { kind: 'say'; key: 'praise' | 'listened' }
  | { kind: 'praise_mark_show' }
  | { kind: 'praise_mark_hide' }
  | { kind: 'overlay_hide' }
  | { kind: 'plates_empty' }
  | { kind: 'next_sd' }
  | { kind: 'exchange' };

export type ConsequenceRun = {
  markedAt: number;
  /** Расписание по возрастанию срока `at`. */
  plan: { at: number; effect: ConsequenceEffect }[];
  /** Сколько событий уже выдано. */
  done: number;
};

export function startConsequence(input: {
  markedAt: number;
  feedback: Feedback;
  calm: boolean;
  /**
   * Спокойный режим профиля — отдельно от `calm` (он же «уменьшить движение»): у `praise` / `listened` в нём нет
   * голоса (`abaVisiblePraise.voiceCalm`, решение 35).
   */
  calmMode?: boolean;
  tokenAddedLandedAt?: number;
  /** Жетон этой пробы заполнил доску (обучение доске, №172): после посадки — сразу обмен. */
  exchange?: boolean;
}): ConsequenceRun {
  const { markedAt, feedback, calm } = input;
  const o = abaReinforcementOverlay;
  const plan: ConsequenceRun['plan'] = [];
  if (feedback === 'token_praise') {
    const landedAt = markedAt + (calm ? o.tokenAppearsAtMsCalm : abaTokenLandingMs());
    plan.push({ at: markedAt, effect: { kind: 'overlay_show' } });
    plan.push({ at: landedAt, effect: { kind: 'token_land' } });
    plan.push({ at: markedAt + (calm ? o.praiseAtMsCalm : o.praiseAtMs), effect: { kind: 'say', key: 'praise' } });
    if (input.exchange) {
      plan.push({ at: landedAt + abaExchange.fromFullBoard.afterLandingMs, effect: { kind: 'exchange' } });
      plan.sort((a, b) => a.at - b.at);
      return { markedAt, plan, done: 0 };
    }
    plan.push({ at: markedAt + o.holdFromMarkedMs, effect: { kind: 'overlay_hide' } });
  } else if (feedback === 'praise' || feedback === 'listened') {
    const v = abaVisiblePraise;
    plan.push({ at: markedAt + v.appearsAtMs, effect: { kind: 'praise_mark_show' } });
    if (!input.calmMode || v.voiceCalm) {
      plan.push({ at: markedAt + abaConsequence.praiseOnlyAtMs, effect: { kind: 'say', key: feedback } });
    }
    plan.push({ at: markedAt + v.holdMs, effect: { kind: 'praise_mark_hide' } });
  }
  plan.push({ at: markedAt + abaInterTrial.nextSdAtMs - abaInterTrial.ms, effect: { kind: 'plates_empty' } });
  plan.push({ at: abaNextSdAt(markedAt, input.tokenAddedLandedAt), effect: { kind: 'next_sd' } });
  plan.sort((a, b) => a.at - b.at);
  return { markedAt, plan, done: 0 };
}

/** Срок следующего события; `null` — расписание кончилось. */
export function consequenceDueAt(run: ConsequenceRun): number | null {
  return run.plan[run.done]?.at ?? null;
}

/** Выдать всё, чей срок наступил к `now`. */
export function advanceConsequence(run: ConsequenceRun, now: number): { run: ConsequenceRun; effects: ConsequenceEffect[] } {
  const effects: ConsequenceEffect[] = [];
  let done = run.done;
  while (done < run.plan.length && run.plan[done].at <= now) {
    effects.push(run.plan[done].effect);
    done += 1;
  }
  return { run: { ...run, done }, effects };
}
