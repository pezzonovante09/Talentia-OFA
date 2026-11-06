/**
 * Хвост конца сессии на экране (фаза 8, №172 п. 2, методист а8): итог уже записан, экран проигрывает обмен и доступ или
 * цикл сопряжения (`model/endTail.ts`), а хук держит очередь шагов, факты «что реально выдано» и строки
 * `aba_session_tails`. Уход на шаге хвоста пишется сразу: ребёнок может не вернуться. Возврат до 2 мин доигрывает
 * купленный доступ (решение владельца 2026-11-06), и строка итога ложится после строки ухода; иначе — «Закончили».
 * Ошибки записи — только в `__DEV__`.
 */
import { useCallback, useMemo, useRef } from 'react';

import { commitAbaSessionTail } from '../../services/local/commit';
import type { SqlDb } from '../../services/local/sql';
import type { AbaSessionTail } from '../../types/aba';
import type { TailStep } from './model/endTail';
import { accessScenesAtEnd, tailPhase, tailStepOf, type AccessScene, type EndBoard, type Phase } from './model/sessionPhase';
import { accessOnReturn, tailOnEnd, tailOnLeave, tailOnReturn, type TailFacts } from './model/sessionResume';

type AccessPhase = Extract<Phase, { kind: 'access' }>;
type EndView = { variant: 'normal' | 'neutral'; board: EndBoard };

export function useSessionTail(o: { db: SqlDb | null; childId: string | null; still: boolean; setPhase: (p: Phase) => void }) {
  const { db, childId, still, setPhase } = o;
  const steps = useRef<TailStep[]>([]);
  const view = useRef<EndView>({ variant: 'neutral', board: null });
  /** Факты хвоста; `null` — итог не записан, строк хвоста нет. */
  const facts = useRef<TailFacts | null>(null);
  /** Строка хвоста уже записана и актуальна: на возврате с доигрыванием снимается — итог ляжет новой строкой. */
  const written = useRef(false);
  /** Шаг хвоста, на котором свернули: возврат решает, доигрывать ли. */
  const left = useRef<{ step: TailStep['kind']; access: AccessPhase | null; at: number } | null>(null);

  const write = useCallback(
    (row: AbaSessionTail, at: number) => {
      if (!db || !childId) return;
      written.current = true;
      commitAbaSessionTail(db, childId, row, new Date(at).toISOString()).catch((e: unknown) => {
        if (__DEV__) console.warn('aba-session-tail', e);
      });
    },
    [db, childId],
  );

  /** Следующий шаг хвоста: обмен, доступ, ожидание цикла, жетон сопряжения, «Закончили». */
  const next = useCallback(
    (now: number) => {
      const step = steps.current.shift() ?? { kind: 'end' as const };
      if (step.kind === 'end' && facts.current && !written.current) write(tailOnEnd(facts.current), now);
      setPhase(tailPhase(step, now, still, view.current));
    },
    [still, setPhase, write],
  );

  /** Уход на шаге `step`: строка сразу, что дальше — решит возврат; второй уход до возврата ничего не меняет. */
  const leave = useCallback(
    (step: TailStep['kind'], access: AccessPhase | null, at: number) => {
      if (left.current) return;
      left.current = { step, access, at };
      const f = facts.current;
      if (step === 'end' || !f) return;
      write(tailOnLeave(step, access ? { ...f, accessScenes: [...f.accessScenes, ...accessScenesAtEnd(access, at)] } : f, at), at);
    },
    [write],
  );

  /** Возврат: до 2 мин купленный доступ доигрывается (а7, а8), иначе — «Закончили». */
  const back = useCallback(
    (now: number) => {
      const was = left.current;
      left.current = null;
      const how = tailOnReturn(was, now, facts.current?.pairingTokenAt != null);
      if (how === 'end') {
        steps.current = [];
        next(now);
        return;
      }
      written.current = false;
      const a = was?.access;
      if (how === 'next' || !was || !a) {
        next(now);
        return;
      }
      const r = accessOnReturn({ accessStartedAt: a.run.startedAt, durationMs: a.run.durationMs, leftAt: was.at, now, still, delivered: accessScenesAtEnd(a, was.at) });
      setPhase({ kind: 'access', run: r.run, tick: now, tail: true, sceneEndedAt: null, trace: false, scenes: r.scenes, sceneFrom: r.sceneFrom });
    },
    [next, still, setPhase],
  );

  return useMemo(
    () => ({
      next,
      leave,
      back,
      /** Итог записан: с этого момента строки хвоста можно писать. */
      closed: (sessionId: string) => {
        facts.current = { sessionId, accessScenes: [], pairingTokenAt: null };
      },
      /** Очередь шагов и вид «Закончили». */
      arm: (s: TailStep[], v: EndView) => {
        steps.current = s;
        view.current = v;
      },
      setEnd: (v: EndView) => {
        view.current = v;
      },
      /** Свернули во время конца: итог ещё пишется — хвост начнёт `finish`; записан — шаг хвоста, на котором ушли. */
      leaveOn: (p: Phase, now: number) => {
        if (facts.current) leave(tailStepOf(p), p.kind === 'access' && p.tail ? p : null, now);
      },
      accessGiven: (scenes: AccessScene[]) => {
        if (facts.current) facts.current = { ...facts.current, accessScenes: [...facts.current.accessScenes, ...scenes] };
      },
      pairingTokenLanded: (at: number) => {
        if (facts.current) facts.current = { ...facts.current, pairingTokenAt: at };
      },
    }),
    [next, leave, back],
  );
}
