/**
 * Что открыто в родительском разделе: выбранный ребёнок (сегменты в шапке) и отчёт по нему из
 * локальных данных (`domain/parentReport.ts`): прохождения и навыки этого ребёнка.
 */
import { useEffect, useState } from 'react';
import { create } from 'zustand';

import { buildParentReport, type ParentReport } from '../domain/parentReport';
import { loadChildState } from '../services/local/childState';
import { lessonRunsOf } from '../services/local/lessonRuns';
import type { ChildProfile } from '../services/local/profiles';
import { useAccount } from './account';

type ParentViewState = { childId: string | null; select(childId: string): void };
export const useParentView = create<ParentViewState>((set) => ({ childId: null, select: (childId) => set({ childId }) }));

/** Текущий профиль раздела: выбранный или первый. */
export function useSelectedProfile(): ChildProfile | null {
  const profiles = useAccount((s) => s.profiles);
  const childId = useParentView((s) => s.childId);
  return profiles.find((p) => p.childId === childId) ?? profiles[0] ?? null;
}

export async function loadReport(childId: string, today = new Date()): Promise<ParentReport> {
  const db = useAccount.getState().db;
  if (!db) throw new Error('Отчёт без базы аккаунта');
  const [runs, skills] = await Promise.all([lessonRunsOf(db, childId), loadChildState(db, childId, 'skills')]);
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return buildParentReport(childId, runs, skills ?? [], day);
}

export function useParentReport(childId: string | null): ParentReport | null {
  const [report, setReport] = useState<ParentReport | null>(null);
  useEffect(() => {
    let alive = true;
    setReport(null);
    if (childId) void loadReport(childId).then((r) => alive && setReport(r));
    return () => {
      alive = false;
    };
  }, [childId]);
  return report;
}
