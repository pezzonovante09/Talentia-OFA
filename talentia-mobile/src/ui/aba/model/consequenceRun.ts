/**
 * Последствие пробы ABA — расписание от записи (`markedAt`, Ц2.6.1; `abaConsequence`, `abaReinforcementOverlay`,
 * `abaInterTrial`). Сначала запись пробы (`recordAbaTrial`), потом последствие (спецификация п. 7): жетон,
 * показанный и не записанный, для ребёнка — отнятый.
 *
 * - `token_praise` — плашка сменой кадра в 0, жетон приземляется в `abaTokenLandingMs()` со звуком `token`,
 *   похвала голосом в 700 (calm 500), плашка уходит в 4000;
 * - `praise` / `listened` — **только голос** в 300 (без плашки: иначе подсказанный ответ получил бы тот же
 *   условный подкрепитель, что самостоятельный), `neutral` — ничего;
 * - следующий SD — `abaNextSdAt(markedAt, tokenAddedLandedAt)`; пустые плиты межпробной паузы — с 4000.
 *
 * Просьба «перерыв» в эту фазу — сразу в домен (`requestBreakBetweenTrials`, №160): модель её не ждёт, следующий
 * шаг в срок `next_sd` и будет перерывом.
 */
import { abaInterTrial, abaNextSdAt, abaReinforcementOverlay, abaTokenLandingMs, abaConsequence } from '../../../design/abaTokens';
import type { Feedback } from '../../../domain/abaTokens';

export type ConsequenceEffect =
  | { kind: 'overlay_show' }
  | { kind: 'token_land' }
  | { kind: 'say'; key: 'praise' | 'listened' }
  | { kind: 'overlay_hide' }
  | { kind: 'plates_empty' }
  | { kind: 'next_sd' };

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
  tokenAddedLandedAt?: number;
}): ConsequenceRun {
  const { markedAt, feedback, calm } = input;
  const o = abaReinforcementOverlay;
  const plan: ConsequenceRun['plan'] = [];
  if (feedback === 'token_praise') {
    plan.push({ at: markedAt, effect: { kind: 'overlay_show' } });
    plan.push({ at: markedAt + (calm ? o.tokenAppearsAtMsCalm : abaTokenLandingMs()), effect: { kind: 'token_land' } });
    plan.push({ at: markedAt + (calm ? o.praiseAtMsCalm : o.praiseAtMs), effect: { kind: 'say', key: 'praise' } });
    plan.push({ at: markedAt + o.holdFromMarkedMs, effect: { kind: 'overlay_hide' } });
  } else if (feedback === 'praise' || feedback === 'listened') {
    plan.push({ at: markedAt + abaConsequence.praiseOnlyAtMs, effect: { kind: 'say', key: feedback } });
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
