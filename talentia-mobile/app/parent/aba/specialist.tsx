/**
 * «Для специалиста» (методист 2026-11-18): в разделе родителя за PIN, на телефоне семьи, офлайн. Вход — строка в карточке
 * «Для специалиста» на `index.tsx` за свежим PIN (`aba_specialist`); каждое изменение здесь — тоже за ним: окно свежести
 * могло истечь, пока экран открыт.
 *
 * Задаёт: параметры сессии (`AbaSessionParams`), «Награду от взрослого», «обучен» у наблюдателей. Отметки: беспокойство
 * по согласию просмотрено, подтвердить сопряжение, назначить проверку вперемешку, «Просмотрено» для трёх сигналов.
 * Только чтение: сигналы целей, доски, карточки «перерыв» и шага «коснись картинки», ступень доски, старт подсказки,
 * задержка, события занятий. Беспокойство по согласию на шаге «коснись картинки» — с отметкой «просмотрено».
 * Каждое изменение — событие журнала с ролью «специалист», заявленной (`commit.ts`, `abaSpecialist.ts`).
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ABA_TARGETS } from '../../../src/content/aba';
import { parentSpacing } from '../../../src/design/parentTokens';
import { MAX_TEACHING_TARGETS } from '../../../src/domain/abaSession';
import { PARAM_LIMITS, pruneSessionParams, sessionParamsErrors, type AbaSessionParams } from '../../../src/domain/abaSessionParams';
import type { SpecialistEvent } from '../../../src/domain/abaSpecialist';
import { abaLocalDay } from '../../../src/services/local/abaLog';
import { loadSpecialistView, setAdultRewardAsSpecialist, type SpecialistSessionNote, type SpecialistView } from '../../../src/services/local/abaSpecialist';
import {
  AbaSessionParamsInvalidError,
  assignAbaMixedCheck,
  confirmAbaPairingAsSpecialist,
  reviewAbaAssentConcern,
  reviewAbaFlag,
  reviewAbaSampleTouchAssentConcern,
  setAbaObserverTrained,
  setAbaSessionParams,
  type ReviewableFlag,
} from '../../../src/services/local/commit';
import { useAccount } from '../../../src/state/account';
import { useChildSession } from '../../../src/state/childSession';
import { useGate } from '../../../src/state/gate';
import { useSelectedProfile } from '../../../src/state/parentView';
import type { AbaFormat } from '../../../src/types/aba';
import type { AgeBand } from '../../../src/types/task';
import { ConfirmPinSheet } from '../../../src/ui/parent/ConfirmPinSheet';
import { Card, ParentButton, ParentScreen, ParentText, Row, Segmented } from '../../../src/ui/parent/primitives';

type Tr = (k: string, o?: Record<string, unknown>) => string;

const BANDS: readonly AgeBand[] = ['5-6', '7', '8', '9-10'];
const MINUTES = [5, 10, 15, 20] as const;
const WINDOWS_MS = [6000, 8000, 10_000] as const;
/** Форматы окна ответа — те, что есть в программе (первая версия — только `match`). */
const FORMATS: readonly AbaFormat[] = [...new Set(ABA_TARGETS.map((t) => t.format))];

const goal = (t: Tr, id: string) => t(`parent.aba.goal.${id}`, { defaultValue: id });

function valueText(t: Tr, v: SpecialistEvent['from']): string {
  if (v === null) return t('parent.aba.spec.valueDefault');
  if (typeof v === 'boolean') return t(v ? 'parent.aba.spec.valueOn' : 'parent.aba.spec.valueOff');
  return String(v);
}

/** Строка журнала: день, поле словами, было → стало. */
export function changeLine(t: Tr, e: SpecialistEvent): string {
  const [head, tail] = e.field.split('.') as [string, string | undefined];
  const field =
    head === 'responseWindowMs'
      ? `${t('parent.aba.spec.field.responseWindowMs')} (${t(`parent.aba.spec.format.${tail}`)})`
      : head === 'flag'
        ? `${t('parent.aba.spec.field.flag')}: ${t(`parent.aba.spec.${e.step === 'sample_touch' ? 'touchFlag' : tail === 'token_training_stalled' || tail === 'pairing_keeps_breaking' ? 'tokenFlag' : 'flag'}.${tail}`)}`
        : head === 'observerTrained' && e.observerRole
          ? `${t('parent.aba.spec.field.observerTrained')} (${t(`abaSession.role.${e.observerRole}`)})`
          : t(`parent.aba.spec.field.${head}`);
  const line = t('parent.aba.spec.changeLine', { day: abaLocalDay(Date.parse(e.at)), field, from: valueText(t, e.from), to: valueText(t, e.to) });
  // изменение вне раздела (профиль, «Кто ведёт», карточка ABA) — роль «родитель», тоже заявленная
  return e.role === 'parent' ? t('parent.aba.spec.changeLineParent', { line }) : line;
}

/** Событие занятия словами. */
export function noteLine(t: Tr, n: SpecialistSessionNote): string {
  const targets = n.targetIds.map((id) => goal(t, id)).join(', ');
  if (n.kind === 'observing_not_established') {
    return t('parent.aba.spec.noteObserving', { day: n.day, targets, then: t(`parent.aba.spec.observingThen.${n.then}`) });
  }
  const parts = [
    t(`parent.aba.spec.mixedReason.${n.reason}`),
    t(n.counted ? 'parent.aba.spec.noteCounted' : 'parent.aba.spec.noteNeutral'),
    ...(n.dropped ? [t('parent.aba.spec.noteDropped')] : []),
    ...(n.yielded ? [t('parent.aba.spec.noteYielded')] : []),
  ];
  return t('parent.aba.spec.noteMixed', { day: n.day, targets, reason: parts.join(', ') });
}

export default function AbaSpecialistScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const db = useAccount((s) => s.db);
  const updateProfile = useAccount((s) => s.updateProfile);
  const profile = useSelectedProfile();
  const can = useGate((s) => s.can);
  const [view, setView] = useState<SpecialistView | null>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const childId = profile?.childId ?? null;
  const band = profile?.band ?? null;
  const reload = useCallback(async () => {
    if (!db || !childId || !band) return;
    setView(await loadSpecialistView(db, childId, band));
  }, [db, childId, band]);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  if (!db || !profile || !band) return null;

  /** Изменение за свежим PIN; ошибка — строкой внизу, данные перечитываются в любом случае. */
  const act = (fn: () => Promise<unknown>) => {
    const run = () => {
      setFailure(null);
      void fn()
        .catch((e: unknown) => {
          if (__DEV__) console.warn('aba-specialist', e);
          setFailure(t(e instanceof AbaSessionParamsInvalidError ? 'parent.aba.spec.invalid' : 'parent.failed'));
        })
        .finally(() => void reload());
    };
    if (can('aba_specialist')) run();
    else setPending(() => run);
  };
  const now = () => new Date().toISOString();
  const params = view?.params ?? {};
  const effectiveBand = params.paramsBand ?? band;
  const saveParams = (next: AbaSessionParams) => act(() => setAbaSessionParams(db, profile.childId, pruneSessionParams(next, band), band, now()));
  const maxMinutes = (effectiveBand === '5-6' ? PARAM_LIMITS.maxTimeMs.young : PARAM_LIMITS.maxTimeMs.older) / 60_000;
  const windowsFor = (f: AbaFormat) => WINDOWS_MS.filter((ms) => !sessionParamsErrors({ ...params, responseWindowMs: { [f]: ms } }, band).length);

  const actions: { key: string; label: string; run: () => Promise<unknown> }[] = [];
  if (view) {
    for (const tg of view.targets.filter((x) => x.flags.includes('assent_concern'))) {
      actions.push({ key: `assent-${tg.id}`, label: t('parent.aba.spec.assentReviewed', { target: goal(t, tg.id) }), run: () => reviewAbaAssentConcern(db, profile.childId, tg.id, now()) });
    }
    if (view.sampleTouchFlags.includes('assent_concern')) {
      actions.push({ key: 'assent-sample-touch', label: t('parent.aba.spec.assentReviewedTouch'), run: () => reviewAbaSampleTouchAssentConcern(db, profile.childId, now()) });
    }
    if (!view.pairingDone && view.trainedObserverId) {
      const observerId = view.trainedObserverId;
      actions.push({ key: 'pairing', label: t('parent.aba.spec.pairingConfirm'), run: () => confirmAbaPairingAsSpecialist(db, profile.childId, observerId, now()) });
    }
    for (const group of view.mixedHeld) {
      actions.push({
        key: `mixed-${group.join('+')}`,
        label: t('parent.aba.spec.mixedAssign', { targets: group.map((id) => goal(t, id)).join(', ') }),
        run: () => assignAbaMixedCheck(db, profile.childId, ABA_TARGETS, group[0], now()),
      });
    }
    for (const flag of ['token_training_stalled', 'pairing_keeps_breaking'] as const satisfies readonly ReviewableFlag[]) {
      if (view.tokenFlags.includes(flag)) actions.push({ key: flag, label: t(`parent.aba.spec.reviewed.${flag}`), run: () => reviewAbaFlag(db, profile.childId, flag, now()) });
    }
    for (const tg of view.targets.filter((x) => x.flags.includes('ioa_low'))) {
      actions.push({ key: `ioa-${tg.id}`, label: t('parent.aba.spec.reviewed.ioa_low', { target: goal(t, tg.id) }), run: () => reviewAbaFlag(db, profile.childId, 'ioa_low', now(), tg.id) });
    }
  }

  return (
    <ParentScreen
      title={t('parent.aba.spec.title')}
      scroll
      left={<ParentButton variant="quiet" label={t('parent.back')} onPress={() => router.back()} block={false} testID="spec-back" />}
      testID="parent-aba-specialist"
    >
      {view && (
        <View style={{ gap: parentSpacing.lg }}>
          <ParentText role="caption" color="textMuted" testID="spec-claimed">
            {t('parent.aba.spec.claimed')}
          </ParentText>

          <Card title={t('parent.aba.spec.params')} testID="spec-params">
            <View style={{ gap: parentSpacing.md }}>
              <ParentText role="label">{t('parent.aba.spec.band')}</ParentText>
              <Segmented
                options={[{ value: 'profile', label: t('parent.aba.spec.bandDefault') }, ...BANDS.map((b) => ({ value: b, label: b.replace('-', '–') }))]}
                value={params.paramsBand ?? 'profile'}
                onChange={(v) => {
                  const { paramsBand: _b, ...rest } = params;
                  saveParams(v === 'profile' ? rest : { ...rest, paramsBand: v as AgeBand });
                }}
                testID="spec-band"
              />
              <ParentText role="label">{t('parent.aba.spec.time')}</ParentText>
              <Segmented
                options={[
                  { value: 'default', label: t('parent.aba.spec.default') },
                  ...MINUTES.filter((m) => m <= maxMinutes).map((m) => ({ value: String(m), label: t('parent.aba.spec.minutes', { n: m }) })),
                ]}
                value={params.timeLimitMs ? String(params.timeLimitMs / 60_000) : 'default'}
                onChange={(v) => {
                  const { timeLimitMs: _x, ...rest } = params;
                  saveParams(v === 'default' ? rest : { ...rest, timeLimitMs: Number(v) * 60_000 });
                }}
                testID="spec-time"
              />
              <ParentText role="label">{t('parent.aba.spec.teaching')}</ParentText>
              <Segmented
                options={[1, MAX_TEACHING_TARGETS].map((n) => ({ value: String(n), label: String(n) }))}
                value={String(params.maxTeachingTargets ?? MAX_TEACHING_TARGETS)}
                onChange={(v) => {
                  const { maxTeachingTargets: _x, ...rest } = params;
                  saveParams(v === '1' ? { ...rest, maxTeachingTargets: 1 } : rest);
                }}
                testID="spec-teaching"
              />
              {FORMATS.map((f) => (
                <View key={f} style={{ gap: parentSpacing.md }}>
                  <ParentText role="label">{t('parent.aba.spec.window', { format: t(`parent.aba.spec.format.${f}`) })}</ParentText>
                  <Segmented
                    options={[
                      { value: 'default', label: t('parent.aba.spec.default') },
                      ...windowsFor(f).map((ms) => ({ value: String(ms), label: t('parent.aba.spec.seconds', { n: ms / 1000 }) })),
                    ]}
                    value={params.responseWindowMs?.[f] ? String(params.responseWindowMs[f]) : 'default'}
                    onChange={(v) => {
                      const { [f]: _x, ...others } = params.responseWindowMs ?? {};
                      const windows = v === 'default' ? others : { ...others, [f]: Number(v) };
                      const { responseWindowMs: _w, ...rest } = params;
                      saveParams(Object.keys(windows).length ? { ...rest, responseWindowMs: windows } : rest);
                    }}
                    testID={`spec-window-${f}`}
                  />
                </View>
              ))}
              {view.paramsIgnored && (
                <ParentText role="caption" color="error" testID="spec-params-ignored">
                  {t('parent.aba.spec.paramsIgnored')}
                </ParentText>
              )}
              <ParentText role="caption" color="textMuted" testID="spec-fixed">
                {t('parent.aba.spec.fixed')}
              </ParentText>
            </View>
          </Card>

          <Card title={t('parent.aba.spec.people')} testID="spec-people">
            <Row
              first
              kind="toggle"
              label={t('parent.profile.adultReward')}
              caption={t('parent.profile.adultRewardHint')}
              toggle={profile.adultReward === true}
              onToggle={(to) =>
                act(async () => {
                  const changed = await setAdultRewardAsSpecialist(db, profile, to, updateProfile, now());
                  // как настройки профиля: следующее занятие этого ребёнка берёт пул из настроек сеанса
                  const session = useChildSession.getState();
                  if (changed && session.mode !== 'none' && session.childId === profile.childId) session.setSettings({ adultReward: to });
                })
              }
              testID="spec-adult-reward"
            />
            {view.observers.map((o) => (
              <Row
                key={o.id}
                kind="toggle"
                label={t('parent.aba.spec.observerTrained', { role: t(`abaSession.role.${o.role}`) })}
                toggle={o.trained}
                onToggle={(trained) => act(() => setAbaObserverTrained(db, profile.childId, o.id, trained, now()))}
                testID={`spec-observer-${o.role}`}
              />
            ))}
            {view.observers.length === 0 && (
              <ParentText role="caption" color="textMuted" testID="spec-no-observers">
                {t('parent.aba.spec.noObservers')}
              </ParentText>
            )}
          </Card>

          <Card title={t('parent.aba.spec.actions')} testID="spec-actions">
            {actions.map((a, i) => (
              <Row key={a.key} first={i === 0} kind="link" label={a.label} onPress={() => act(a.run)} testID={`spec-action-${a.key}`} />
            ))}
            <ParentText role="caption" color="textMuted" testID="spec-actions-caption">
              {t(actions.length ? 'parent.aba.spec.reviewedCaption' : 'parent.aba.spec.noActions')}
            </ParentText>
          </Card>

          <Card title={t('parent.aba.spec.seen')} testID="spec-seen">
            <View style={{ gap: parentSpacing.sm }}>
              <ParentText role="body" testID="spec-board-stage">
                {t('parent.aba.spec.boardStage', { n: view.boardStage })}
              </ParentText>
              {view.tokenFlags.map((f) => (
                <ParentText key={f} role="caption" testID={`spec-token-flag-${f}`}>
                  {t(`parent.aba.spec.tokenFlag.${f}`)}
                </ParentText>
              ))}
              {view.breakCardFlags.map((f) => (
                <ParentText key={f} role="caption" testID={`spec-break-flag-${f}`}>
                  {t(`parent.aba.spec.breakFlag.${f}`)}
                </ParentText>
              ))}
              {view.sampleTouchFlags.map((f) => (
                <ParentText key={f} role="caption" testID={`spec-touch-flag-${f}`}>
                  {t(`parent.aba.spec.touchFlag.${f}`)}
                </ParentText>
              ))}
              {view.targets.map((tg) => (
                <View key={tg.id} testID={`spec-target-${tg.id}`}>
                  <ParentText role="body">{t('parent.aba.spec.targetLine', { target: goal(t, tg.id), phase: t(`parent.aba.spec.phase.${tg.phase}`) })}</ParentText>
                  <ParentText role="caption" color="textMuted">
                    {t('parent.aba.spec.targetDetail', { level: tg.startPromptLevel, delay: Math.round((tg.currentDelayMs ?? 0) / 100) / 10 })}
                  </ParentText>
                  {tg.flags.map((f) => (
                    <ParentText key={f} role="caption" testID={`spec-flag-${tg.id}-${f}`}>
                      {t(`parent.aba.spec.flag.${f}`)}
                    </ParentText>
                  ))}
                </View>
              ))}
              {view.notes.map((n, i) => (
                <ParentText key={i} role="caption" testID={`spec-note-${i}`}>
                  {noteLine(t, n)}
                </ParentText>
              ))}
              {view.notes.length === 0 && (
                <ParentText role="caption" color="textMuted" testID="spec-no-notes">
                  {t('parent.aba.spec.noNotes')}
                </ParentText>
              )}
            </View>
          </Card>

          <Card title={t('parent.aba.spec.changes')} testID="spec-changes">
            {view.changes.map((e, i) => (
              <ParentText key={i} role="caption" testID={`spec-change-${i}`}>
                {changeLine(t, e)}
              </ParentText>
            ))}
            {view.changes.length === 0 && (
              <ParentText role="caption" color="textMuted" testID="spec-no-changes">
                {t('parent.aba.spec.noChanges')}
              </ParentText>
            )}
          </Card>

          {failure && (
            <ParentText role="caption" color="error" align="center" testID="spec-error">
              {failure}
            </ParentText>
          )}
        </View>
      )}
      <ConfirmPinSheet
        visible={pending !== null}
        onCancel={() => setPending(null)}
        onConfirmed={() => {
          const run = pending;
          setPending(null);
          run?.();
        }}
      />
    </ParentScreen>
  );
}
