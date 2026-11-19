/**
 * Читаемый отчёт специалисту (открытый вопрос 118, выбор владельца «лист + машинный файл»): `SpecialistExport` →
 * одна страница HTML по образцу `docs/aba-center/specialist-report-sample.html`. Рядом с ним в том же листе
 * «Поделиться» уходит JSON — для программы (`shareSpecialistExport.ts`).
 *
 * Чистая функция: без I/O, без часов, без сети. Всё — из файла выгрузки: числа берутся из `summaries` (тот же счёт
 * домена, что двигает критерий), линия критерия — из `summaries.criterion`, а не константой. Записи `abaSessions` и
 * `abaTrials` в типе выгрузки — `unknown[]`: читаются узким защитным чтением, время событий там — смещения в мс.
 *
 * Журнал раздела «Для специалиста» (`abaSpecialistEvents`) — таблица «Изменения условий» (день, роль со слов, поле,
 * было → стало) и вертикальные линии на графиках целей в день изменения; текущие `state.abaSessionParams` — в шапке.
 * В файле у изменения только день: если в тот день было занятие, линия стоит перед ним — порядок внутри дня не
 * восстановить, это сказано в подписи графика.
 *
 * Приватность: в отчёте нет имени ребёнка (только «Р1»), идентификаторов записей, наблюдателей (кроме меток `O1`…
 * из файла и роли наблюдателя в журнале изменений), наград и времени суток — только дни. Весь текст, в том числе из
 * `t()` (`escapeValue: false` у i18next), экранируется. Ни скриптов, ни внешних шрифтов и стилей: страница
 * открывается без сети и печатается на A4.
 */
import { ABA_TARGETS } from '../../content/aba';
import type { SpecialistExport, SessionTargetSummary, TargetSummary } from './purge';

/** `t` раздела взрослого: экран передаёт свой (язык взрослого, №190). */
export type ReportT = (key: string, options?: Record<string, unknown>) => string;

export type ReportOptions = {
  /** Язык страницы (`<html lang>`). */
  lang?: string;
  /** Имя JSON-файла рядом — строка внизу «полные записи — в файле…». */
  dataFileName?: string;
  /** Плашка «образец на выдуманных данных» — только для образца в `docs/`. */
  demo?: boolean;
};

const K = 'parent.aba.report';
/** Колонок в таблице по датам и столбцов на графике — последние занятия цели, чтобы лист влез в A4. */
const MAX_COLUMNS = 12;
const MAX_BARS = 24;

// --- чтение записей файла ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

type SessionRow = {
  id: string;
  index: number;
  day: string | null;
  durationSec: number | null;
  config: string | null;
  endReason: string | null;
  incomplete: boolean;
  events: Obj[];
  lead: string | null;
};

function readSessions(raw: unknown[]): SessionRow[] {
  return raw
    .filter(isObj)
    .map((s) => ({
      id: str(s.id) ?? '',
      index: num(s.index) ?? 0,
      day: str(s.day),
      durationSec: num(s.durationSec),
      config: str(s.config),
      endReason: str(s.endReason),
      // `endedAt` в файл не попадает (`exportForSpecialist`): записи конца нет — нет и длительности
      incomplete: num(s.durationSec) === null,
      events: arr(s.events).filter(isObj),
      lead: str(s.primaryObserverId),
    }))
    .sort((a, b) => a.index - b.index);
}

type TrialRow = { id: string; sessionId: string; targetId: string; kind: string; index: number; start: number | null; response: string; observingMs: number | null };

function readTrials(raw: unknown[]): TrialRow[] {
  return raw.filter(isObj).map((t) => ({
    id: str(t.id) ?? '',
    sessionId: str(t.sessionId) ?? '',
    targetId: str(t.targetId) ?? '',
    kind: str(t.kind) ?? '',
    index: num(t.index) ?? 0,
    start: num(t.startPromptLevel),
    response: str(t.response) ?? '',
    observingMs: num(t.observingLatencyMs),
  }));
}

/** Запись журнала «Для специалиста» из файла (`exportForSpecialist`): день без времени, роль заявленная. */
type ChangeRow = {
  order: number;
  day: string | null;
  role: string | null;
  claimed: boolean;
  field: string;
  from: unknown;
  to: unknown;
  targetIds: string[] | null;
  observerRole: string | null;
};

function readChanges(raw: unknown[]): ChangeRow[] {
  return raw
    .filter(isObj)
    .map((c, i) => {
      const day = str(c.day);
      const targets = Array.isArray(c.targetIds) ? c.targetIds.map(str).filter((x): x is string => !!x) : null;
      return {
        order: num(c.order) ?? i + 1,
        day: day && DAY.test(day) ? day : null,
        role: str(c.role),
        claimed: c.claimed === true,
        field: str(c.field) ?? '',
        from: c.from,
        to: c.to,
        targetIds: targets && targets.length ? targets : null,
        observerRole: str(c.observerRole),
      };
    })
    .filter((c) => c.field !== '')
    .sort((a, b) => a.order - b.order);
}

// --- форматирование ----------------------------------------------------------------------------------

/** Экранирование для текста и атрибутов. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function makeFormat(t: ReportT) {
  const decimal = t(`${K}.decimal`);
  const dateShort = (day: string | null) => {
    const m = day ? DAY.exec(day) : null;
    return m ? t(`${K}.dateShort`, { d: String(Number(m[3])), m: m[2] }) : '—';
  };
  const dateFull = (day: string | null) => {
    const m = day ? DAY.exec(day) : null;
    return m ? t(`${K}.dateFull`, { d: String(Number(m[3])), m: m[2], y: m[1] }) : '—';
  };
  const percent = (rate: number) => t(`${K}.percent`, { value: Math.round(rate * 100) });
  const seconds = (ms: number) => (Math.round(ms / 100) / 10).toFixed(1).replace('.', decimal);
  /** Секунды без лишнего «,0»: окно ответа 8000 мс — «8», 7500 — «7,5». */
  const wholeSeconds = (ms: number) => {
    const s = Math.round(ms / 100) / 10;
    return Number.isInteger(s) ? String(s) : s.toFixed(1).replace('.', decimal);
  };
  return { dateShort, dateFull, percent, seconds, wholeSeconds };
}

/** Перевод или запасная строка, если ключа нет (`fallbackLng: false` отдаёт сам ключ). */
const tOr = (t: ReportT, key: string, fallback: () => string, options?: Record<string, unknown>) => {
  const s = t(key, options);
  return s === key ? fallback() : s;
};

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// --- части страницы ---------------------------------------------------------------------------------

const STYLE = `
@page { size: A4; margin: 12mm; }
body { font: 11px/1.35 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #222; background: #fff; max-width: 190mm; margin: 0 auto; padding: 8px; }
.demo { background: #FFF4D6; border: 1px solid #E8C35A; padding: 4px 8px; border-radius: 4px; margin-bottom: 6px; }
h1 { font-size: 16px; margin: 0 0 2px; } h2 { font-size: 12px; margin: 10px 0 4px; }
.meta { color: #555; margin-bottom: 6px; }
table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #ddd; padding: 2px 4px; text-align: left; vertical-align: top; }
th { background: #f4f4f4; font-weight: 600; }
.t { border: 1px solid #ddd; border-radius: 6px; padding: 6px 8px; margin-bottom: 6px; break-inside: avoid; page-break-inside: avoid; }
.mini td, .mini th { text-align: center; font-size: 10px; } .mini td:first-child, .mini th:first-child { text-align: left; }
.st { font-weight: 600; font-size: 10px; padding: 1px 6px; border-radius: 8px; margin-left: 6px; background: #EEF1F4; color: #333; }
.st.ok { background: #DFF2E7; color: #1E5E3E; }
.small { font-size: 10px; color: #555; } .ch { max-width: 120mm; margin: 4px 0; }
.changes td:nth-child(4), .changes td:nth-child(5) { white-space: nowrap; }
ul { margin: 2px 0 0 16px; padding: 0; }
.scroll { overflow-x: auto; }
@media print { body { padding: 0; } .scroll { overflow: visible; } }
`;

type Ctx = {
  t: ReportT;
  f: ReturnType<typeof makeFormat>;
  e: (s: string) => string;
  criterionRate: number;
  targetName: (id: string, missing?: boolean) => string;
  /** Журнал «Для специалиста» по порядку записи. */
  changes: ChangeRow[];
};

const BAND = (b: string) => b.replace('-', '–');

/** Значение изменения словами: `null` — по умолчанию (у полосы — как в профиле), мс — минуты или секунды. */
function changeValue(ctx: Ctx, field: string, v: unknown): string {
  const { t, f } = ctx;
  // два выключателя (№206) — значением, а не «по умолчанию → да»: пауза 2 с или 5 с, вперемешку да или нет
  if (field === 'longInterTrial') return t(v === true ? `${K}.pace.long` : `${K}.pace.fast`);
  if (field === 'noInterspersal') return t(v === true ? `${K}.valueOff` : `${K}.valueOn`);
  if (v === null || v === undefined) return t(field === 'paramsBand' ? `${K}.valueProfile` : `${K}.valueDefault`);
  if (typeof v === 'boolean') return t(v ? `${K}.valueOn` : `${K}.valueOff`);
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (field === 'timeLimitMs') return t(`${K}.minutes`, { n: Math.round(v / 6000) / 10 });
    if (field.startsWith('responseWindowMs.')) return t(`${K}.seconds`, { n: f.wholeSeconds(v) });
    return String(v);
  }
  if (typeof v === 'string') return field === 'paramsBand' ? BAND(v) : v;
  return '—';
}

/** Что изменено — словами; цели изменения — названиями. */
function changeField(ctx: Ctx, c: ChangeRow): string {
  const { t } = ctx;
  const dot = c.field.indexOf('.');
  const head = dot < 0 ? c.field : c.field.slice(0, dot);
  const tail = dot < 0 ? '' : c.field.slice(dot + 1);
  let text: string;
  if (head === 'responseWindowMs') {
    text = t(`${K}.field.responseWindowMs`, { format: tOr(t, `parent.aba.spec.format.${tail}`, () => tail) });
  } else if (c.field === 'flag.mixed_not_established') {
    // «Назначить проверку вперемешку»: снимает сигнал, но это назначение, а не «просмотрено»
    text = t(`${K}.field.mixedAssigned`);
  } else if (head === 'flag') {
    const flag = tOr(t, `parent.aba.spec.flag.${tail}`, () => tOr(t, `parent.aba.spec.tokenFlag.${tail}`, () => t(`${K}.unknownFlag`, { code: tail })));
    text = t(`${K}.field.flag`, { text: flag });
  } else {
    text = tOr(t, `${K}.field.${head}`, () => c.field);
    if (head === 'observerTrained' && c.observerRole) {
      const role = tOr(t, `abaSession.role.${c.observerRole}`, () => '');
      if (role) text = `${text} (${role})`;
    }
  }
  return c.targetIds ? `${text} — ${c.targetIds.map((id) => ctx.targetName(id)).join(', ')}` : text;
}

/** Текущие параметры занятий из `state.abaSessionParams` — сохранённые; действуют ли при полосе профиля, файл не знает. */
function paramsText(ctx: Ctx, raw: unknown): string {
  const { t, f } = ctx;
  const p = isObj(raw) ? raw : {};
  const band = str(p.paramsBand);
  const time = num(p.timeLimitMs);
  const teaching = num(p.maxTeachingTargets);
  const windows = isObj(p.responseWindowMs)
    ? Object.entries(p.responseWindowMs).flatMap(([format, ms]) => (num(ms) !== null ? [[format, num(ms)!] as const] : []))
    : [];
  const longPause = p.longInterTrial === true;
  const noInterspersal = p.noInterspersal === true;
  if (!band && time === null && teaching === null && !windows.length && !longPause && !noInterspersal) return t(`${K}.paramsDefault`);
  const def = t(`${K}.valueDefault`);
  const list = [
    t(`${K}.param.band`, { value: band ? BAND(band) : t(`${K}.valueProfile`) }),
    t(`${K}.param.time`, { value: time !== null ? t(`${K}.minutes`, { n: Math.round(time / 6000) / 10 }) : def }),
    t(`${K}.param.teaching`, { value: teaching !== null ? String(teaching) : def }),
    ...(longPause ? [t(`${K}.param.longInterTrial`)] : []),
    ...(noInterspersal ? [t(`${K}.param.noInterspersal`)] : []),
    ...(windows.length
      ? windows.map(([format, ms]) =>
          t(`${K}.param.window`, { format: tOr(t, `parent.aba.spec.format.${format}`, () => format), value: t(`${K}.seconds`, { n: f.wholeSeconds(ms) }) }),
        )
      : [t(`${K}.param.windowDefault`)]),
  ];
  return t(`${K}.paramsLine`, { list: list.join(', ') });
}

function header(ctx: Ctx, data: SpecialistExport, sessions: SessionRow[]): string {
  const { t, f, e } = ctx;
  const parts: string[] = [e(t(`${K}.child`, { label: t(`${K}.childLabel`) }))];
  const days = sessions.map((s) => s.day).filter((d): d is string => !!d && DAY.test(d)).sort();
  parts.push(days.length ? e(t(`${K}.period`, { from: f.dateFull(days[0]), to: f.dateFull(days[days.length - 1]) })) : e(t(`${K}.noSessions`)));
  if (sessions.length) parts.push(e(t(`${K}.sessions`, { count: sessions.length })));
  const configs = [...new Set(sessions.map((s) => s.config).filter((c): c is string => !!c))];
  if (configs.length) parts.push(e(t(`${K}.mode`, { modes: configs.map((c) => tOr(t, `abaSession.config.${c}`, () => c)).join(', ') })));
  const observers = arr(data.state.abaObservers).filter(isObj);
  const leads = [...new Set(sessions.map((s) => s.lead).filter((l): l is string => !!l))];
  const who = leads.map((label) => {
    const o = observers.find((x) => x.id === label);
    const role = o && str(o.role) ? tOr(t, `abaSession.role.${str(o.role)}`, () => '') : '';
    if (!role) return label;
    return t(o?.trained === true ? `${K}.observer` : `${K}.observerUntrained`, { label, role });
  });
  parts.push(e(who.length ? t(`${K}.leads`, { who: who.join('; ') }) : t(`${K}.leadsNone`)));
  const tt = isObj(data.state.tokenTraining) ? data.state.tokenTraining : null;
  if (tt) {
    const confirmed = isObj(tt.pairingConfirmed) ? str(tt.pairingConfirmed.at) : null;
    const pairingDays = arr(data.abaPairingSessions).filter(isObj).map((p) => str(p.day)).filter((d): d is string => !!d).sort();
    const day = confirmed ?? (tt.pairingDone === true ? (pairingDays[pairingDays.length - 1] ?? null) : null);
    parts.push(e(tt.pairingDone === true || confirmed ? (day ? t(`${K}.pairingDone`, { date: f.dateFull(day) }) : t(`${K}.pairingDoneNoDate`)) : t(`${K}.pairingNotDone`)));
  }
  parts.push(e(paramsText(ctx, data.state.abaSessionParams)));
  parts.push(e(t(`${K}.exported`, { date: f.dateFull(data.exportedAt) })));
  return `<h1>${e(t(`${K}.docTitle`))}</h1>\n<div class="meta">${parts.join(' · ')}</div>`;
}

/** Состояние цели простыми словами. */
function stateText(ctx: Ctx, data: SpecialistExport, tg: TargetSummary): { text: string; mastered: boolean } {
  const { t, f } = ctx;
  const st = tg.state;
  if (!st) return { text: t(`${K}.noState`), mastered: false };
  const c = data.summaries.criterion;
  const rate = f.percent(c.minIndependentRate);
  const masteredAt = [...tg.phaseChanges].reverse().find((p) => p.to === 'mastered');
  const phase = tOr(t, `${K}.phase.${st.phase}`, () => st.phase);
  const bits: string[] = [];
  if (st.phase === 'mastered' || st.phase === 'maintenance') {
    bits.push(masteredAt ? t(`${K}.masteredOn`, { date: f.dateShort(masteredAt.day) }) : phase);
    if (st.phase === 'maintenance') bits.push(t(`${K}.phase.maintenance`));
    if (st.maintenanceFailsInRow > 0) bits.push(t(`${K}.maintenanceFails`, { n: st.maintenanceFailsInRow }));
    return { text: bits.join('; '), mastered: true };
  }
  bits.push(phase);
  if (st.phase === 'acquisition' && st.startPromptLevel !== null) bits.push(t(`${K}.startLevel`, { level: st.startPromptLevel }));
  if (st.phase === 'acquisition' || st.phase === 'generalization_check') {
    bits.push(t(`${K}.inRow`, { rate, n: st.sessionsAtCriterion, need: c.sessionsInRow }));
    if (st.criterionGaps && st.criterionGaps.length) {
      const gaps = st.criterionGaps.map((g) =>
        tOr(t, `${K}.gap.${g}`, () => g, { n: g === 'exemplars' ? c.minDistinctExemplars : g === 'generalization' ? c.minGeneralizationPasses : c.sessionsInRow, w: c.generalizationWindow, rate }),
      );
      bits.push(t(`${K}.stillNeeded`, { list: gaps.join(', ') }));
    }
  }
  return { text: bits.join('; '), mastered: false };
}

function targetsTable(ctx: Ctx, data: SpecialistExport, targets: TargetSummary[]): string {
  const { t, e } = ctx;
  if (!targets.length) return `<h2>${e(t(`${K}.targets`))}</h2>\n<p class="small">${e(t(`${K}.noTargets`))}</p>`;
  const rows = targets
    .map((tg) => `<tr><td>${e(ctx.targetName(tg.targetId, tg.catalogMissing))}</td><td>${e(stateText(ctx, data, tg).text)}</td></tr>`)
    .join('\n');
  return `<h2>${e(t(`${K}.targets`))}</h2>\n<table>\n<tr><th>${e(t(`${K}.target`))}</th><th>${e(t(`${K}.state`))}</th></tr>\n${rows}\n</table>`;
}

const baselineOf = (r: SessionTargetSummary) => r.byKind.baseline ?? null;

/**
 * Где на графике линии смены условий: граница слота перед первым столбцом с днём не раньше дня изменения (в файле только
 * день — изменение в день занятия ставится перед ним); изменение после последнего столбца — у правого края; раньше
 * первого показанного столбца — не рисуется (оно в таблице «Изменения условий»). Одна линия на границу, подписи — дни.
 */
export function changeLineSlots(barDays: readonly (string | null)[], changeDays: readonly string[]): { slot: number; days: string[] }[] {
  const out = new Map<number, string[]>();
  for (const d of [...new Set(changeDays)].sort()) {
    const idx = barDays.findIndex((b) => b !== null && b >= d);
    if (idx === 0 && barDays[0] !== d) continue;
    const slot = idx < 0 ? barDays.length : idx;
    if (slot === barDays.length && !barDays.some((b) => b !== null && b < d)) continue;
    out.set(slot, [...(out.get(slot) ?? []), d]);
  }
  return [...out].sort((a, b) => a[0] - b[0]).map(([slot, days]) => ({ slot, days }));
}

/**
 * Столбцы доли самостоятельных по занятиям: обучение — столбец, базовая линия — пунктирная рамка; смена условий —
 * точечная вертикальная линия с днём над графиком (`changeLineSlots`).
 */
function chart(ctx: Ctx, rows: SessionTargetSummary[], changeDays: readonly string[]): { svg: string; lines: number } {
  const { t, f, e } = ctx;
  const bars = rows.filter((r) => (r.role === 'teaching' && r.independentRate !== null) || (r.role === 'baseline' && baselineOf(r))).slice(-MAX_BARS);
  if (!bars.length) return { svg: '', lines: 0 };
  const W = 300;
  const H = 104;
  const left = 26;
  const top = 20;
  const bottom = 88;
  const slot = (W - left - 4) / bars.length;
  const bw = Math.max(4, slot * 0.7);
  const y = (rate: number) => bottom - (bottom - top) * rate;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const out: string[] = [];
  for (const v of [0, 0.5, 1]) {
    out.push(`<line x1="${left}" x2="${W - 4}" y1="${r1(y(v))}" y2="${r1(y(v))}" stroke="#ddd"/><text x="${left - 4}" y="${r1(y(v) + 3)}" font-size="8" text-anchor="end" fill="#666">${Math.round(v * 100)}</text>`);
  }
  bars.forEach((r, i) => {
    const x = left + slot * i + (slot - bw) / 2;
    const cx = r1(x + bw / 2);
    if (r.role === 'baseline') {
      const b = baselineOf(r)!;
      const rate = b.trials ? b.independent / b.trials : 0;
      out.push(`<rect x="${r1(x)}" y="${top}" width="${r1(bw)}" height="${bottom - top}" fill="none" stroke="#bbb" stroke-dasharray="3 2"/>`);
      if (b.trials) out.push(`<rect x="${r1(x)}" y="${r1(y(rate))}" width="${r1(bw)}" height="${r1(bottom - y(rate))}" fill="#C9CED4"/>`);
      out.push(`<text x="${cx}" y="${r1((top + bottom) / 2)}" font-size="7" text-anchor="middle" fill="#666">${e(t(`${K}.baselineMark`))}</text>`);
    } else {
      const rate = r.independentRate!;
      const fill = rate >= ctx.criterionRate ? '#2E7D5B' : '#7FA894';
      out.push(`<rect x="${r1(x)}" y="${r1(y(rate))}" width="${r1(bw)}" height="${r1(bottom - y(rate))}" fill="${fill}"/>`);
      out.push(`<text x="${cx}" y="${r1(Math.min(y(rate) - 2, bottom - 2))}" font-size="7" text-anchor="middle" fill="#333">${e(f.percent(rate))}</text>`);
    }
    out.push(`<text x="${cx}" y="100" font-size="8" text-anchor="middle" fill="#444">${e(f.dateShort(r.day))}</text>`);
  });
  const cy = r1(y(ctx.criterionRate));
  out.push(`<line x1="${left}" x2="${W - 4}" y1="${cy}" y2="${cy}" stroke="#C62828" stroke-dasharray="4 2"/>`);
  out.push(`<text x="${left + 3}" y="${r1(cy - 2)}" font-size="7" fill="#C62828">${e(t(`${K}.criterionLine`, { rate: f.percent(ctx.criterionRate) }))}</text>`);
  const slots = changeLineSlots(
    bars.map((r) => r.day),
    changeDays,
  );
  for (const { slot: at, days } of slots) {
    const x = r1(Math.min(left + slot * at, W - 4));
    const anchor = x > W - 24 ? 'end' : x < left + 12 ? 'start' : 'middle';
    out.push(`<line class="cc" x1="${x}" x2="${x}" y1="${top - 8}" y2="${bottom}" stroke="#4A5866" stroke-width="0.8" stroke-dasharray="1 1.5"/>`);
    out.push(`<text x="${x}" y="9" font-size="7" text-anchor="${anchor}" fill="#4A5866">${e(days.map((d) => f.dateShort(d)).join(', '))}</text>`);
  }
  return {
    svg: `<div class="ch"><svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${e(t(`${K}.chartLabel`))}">${out.join('')}</svg></div>`,
    lines: slots.length,
  };
}

function targetCard(ctx: Ctx, data: SpecialistExport, tg: TargetSummary, trials: TrialRow[], corrected: ReadonlySet<string>): string {
  const { t, f, e } = ctx;
  const rows = data.summaries.bySession.filter((r) => r.targetId === tg.targetId).sort((a, b) => a.sessionIndex - b.sessionIndex);
  const { text, mastered } = stateText(ctx, data, tg);
  const title = `<h2>${e(ctx.targetName(tg.targetId, tg.catalogMissing))} <span class="st${mastered ? ' ok' : ''}">${e(text)}</span></h2>`;
  if (!rows.length) return `${title}\n<div class="t"><p class="small">${e(t(`${K}.noSessionsForTarget`))}</p></div>`;
  const cols = rows.slice(-MAX_COLUMNS);
  const sameDay = (r: SessionTargetSummary) => cols.filter((c) => c.day === r.day).length > 1;
  const head = cols.map((r) => `<th>${e(sameDay(r) ? t(`${K}.dateWithSession`, { date: f.dateShort(r.day), n: r.sessionIndex }) : f.dateShort(r.day))}</th>`).join('');
  const own = (r: SessionTargetSummary) =>
    trials
      .filter((x) => x.sessionId === r.sessionId && x.targetId === tg.targetId && !corrected.has(x.id))
      .sort((a, b) => a.index - b.index);
  const cell = (s: string) => `<td>${e(s)}</td>`;
  const line = (label: string, fn: (r: SessionTargetSummary) => string) => `<tr><td>${e(label)}</td>${cols.map((r) => cell(fn(r))).join('')}</tr>`;
  const body = [
    line(t(`${K}.row.rate`), (r) => {
      if (r.role === 'baseline') {
        const b = baselineOf(r);
        return b ? t(`${K}.baselineCell`, { k: b.independent, n: b.trials }) : '—';
      }
      return r.independentRate !== null && r.trials !== null ? t(`${K}.rateOf`, { rate: f.percent(r.independentRate), n: r.trials }) : '—';
    }),
    line(t(`${K}.row.start`), (r) => {
      const levels = own(r).filter((x) => (x.kind === 'teaching' || x.kind === 'transfer') && x.response !== 'interrupted' && x.start !== null).map((x) => x.start!);
      if (!levels.length) return '—';
      const [a, b] = [levels[0], levels[levels.length - 1]];
      return a === b ? String(a) : `${a} → ${b}`;
    }),
    line(t(`${K}.row.delay`), (r) => (r.promptDelayMs ? f.seconds(r.promptDelayMs.last) : '—')),
    line(t(`${K}.row.latency`), (r) => (r.l0Latency ? f.seconds(r.l0Latency.medianMs) : '—')),
    line(t(`${K}.row.observing`), (r) => {
      const m = median(own(r).filter((x) => x.observingMs !== null && x.response !== 'interrupted').map((x) => x.observingMs!));
      return m === null ? '—' : f.seconds(m);
    }),
    line(t(`${K}.row.generalization`), (r) => {
      const g = r.byKind.generalization;
      return g ? t(`${K}.genCell`, { k: g.independent, n: g.trials }) : '—';
    }),
    line(t(`${K}.row.outcome`), (r) => (r.outcome ? tOr(t, `${K}.outcome.${r.outcome}`, () => '—') : '—')),
  ].join('\n');
  const more = rows.length > cols.length ? `<p class="small">${e(t(`${K}.lastColumns`, { shown: cols.length, total: rows.length }))}</p>` : '';
  // смена условий: все изменения, кроме привязанных к другим целям
  const changeDays = ctx.changes.filter((c) => c.day && (!c.targetIds || c.targetIds.includes(tg.targetId))).map((c) => c.day!);
  const ch = chart(ctx, rows, changeDays);
  const changeLegend = ch.lines ? `\n<div class="small">${e(t(`${K}.changeLegend`))}</div>` : '';
  return `${title}
<div class="t">
<div class="small">${e(t(`${K}.legend`, { rate: f.percent(ctx.criterionRate) }))}</div>
${ch.svg}${changeLegend}
<div class="scroll"><table class="mini">
<tr><th></th>${head}</tr>
${body}
</table></div>
${more}</div>`;
}

function sessionsTable(ctx: Ctx, data: SpecialistExport, sessions: SessionRow[]): string {
  const { t, f, e } = ctx;
  if (!sessions.length) return '';
  const rows = sessions
    .map((s) => {
      const mine = data.summaries.bySession.filter((r) => r.sessionId === s.id);
      const sum = (pick: (r: SessionTargetSummary) => number) => mine.reduce((n, r) => n + pick(r), 0);
      const teaching = sum((r) => r.byKind.teaching?.trials ?? 0);
      const baseline = sum((r) => r.byKind.baseline?.trials ?? 0);
      const baselineInd = sum((r) => r.byKind.baseline?.independent ?? 0);
      const corrections = sum((r) => r.corrections);
      const gen = sum((r) => r.byKind.generalization?.trials ?? 0);
      const teachingCell = [
        ...(baseline ? [t(`${K}.baselineTrials`, { n: baseline, k: baselineInd })] : []),
        ...(teaching || !baseline ? [corrections ? t(`${K}.teachingWithCorrections`, { n: teaching, c: corrections }) : String(teaching)] : []),
      ].join('; ');
      const breaks = s.events.filter((ev) => ev.kind === 'break' && ev.training !== true);
      const byCard = breaks.filter((ev) => ev.initiatedBy === 'child_card').length;
      // «Отказ» взрослого: перерыв по карточке ребёнка тоже пишет событие `assent` (by: 'child_card') — он уже в перерывах
      const refusals = s.events.filter((ev) => ev.kind === 'assent' && ev.by === 'adult_observed').length;
      const duration =
        s.durationSec === null ? '—' : s.durationSec < 60 ? t(`${K}.underMinute`) : t(`${K}.minutes`, { n: Math.round(s.durationSec / 60) });
      const notes = [
        ...(s.incomplete ? [t(`${K}.incomplete`)] : []),
        ...(s.endReason && s.endReason !== 'completed' ? [tOr(t, `${K}.end.${s.endReason}`, () => '')] : []),
      ].filter(Boolean);
      const cells = [
        f.dateShort(s.day),
        duration,
        teachingCell,
        gen ? String(gen) : '—',
        breaks.length ? t(`${K}.breaksCell`, { n: breaks.length, card: byCard }) : '0',
        String(refusals),
        notes.join('; '),
      ];
      return `<tr>${cells.map((c) => `<td>${e(c)}</td>`).join('')}</tr>`;
    })
    .join('\n');
  const cols = ['date', 'duration', 'teaching', 'generalization', 'breaks', 'refusals', 'note'].map((c) => `<th>${e(t(`${K}.col.${c}`))}</th>`).join('');
  return `<h2>${e(t(`${K}.sessionsTitle`))}</h2>\n<div class="scroll"><table>\n<tr>${cols}</tr>\n${rows}\n</table></div>`;
}

/** «Изменения условий»: журнал раздела «Для специалиста» — день, кто (со слов), что, было → стало. */
function changesTable(ctx: Ctx): string {
  const { t, f, e } = ctx;
  const title = `<h2>${e(t(`${K}.changesTitle`))}</h2>`;
  if (!ctx.changes.length) return `${title}\n<p class="small">${e(t(`${K}.noChanges`))}</p>`;
  const who = (c: ChangeRow) =>
    c.role === 'specialist'
      ? t(c.claimed ? `${K}.roleSpecialistClaimed` : `${K}.roleSpecialist`)
      : c.role === 'parent'
        ? t(c.claimed ? `${K}.roleParentClaimed` : `${K}.roleParent`)
        : (c.role ?? '—');
  const rows = ctx.changes
    .map((c) => {
      const cells = [f.dateShort(c.day), who(c), changeField(ctx, c), changeValue(ctx, c.field, c.from), changeValue(ctx, c.field, c.to)];
      return `<tr>${cells.map((x) => `<td>${e(x)}</td>`).join('')}</tr>`;
    })
    .join('\n');
  const head = [`${K}.col.date`, `${K}.changeCol.who`, `${K}.changeCol.what`, `${K}.changeCol.from`, `${K}.changeCol.to`].map((k) => `<th>${e(t(k))}</th>`).join('');
  return `${title}\n<p class="small">${e(t(`${K}.changesNote`))}</p>\n<div class="scroll"><table class="changes">\n<tr>${head}</tr>\n${rows}\n</table></div>`;
}

function signals(ctx: Ctx, data: SpecialistExport, targets: TargetSummary[]): string {
  const { t, e } = ctx;
  const items: string[] = [];
  for (const tg of targets) {
    for (const flag of tg.state?.flags ?? []) {
      const text = tOr(t, `${K}.flag.${flag}`, () => t(`${K}.unknownFlag`, { code: flag }));
      items.push(t(`${K}.signalTarget`, { target: ctx.targetName(tg.targetId, tg.catalogMissing), text }));
    }
  }
  const tt = isObj(data.state.tokenTraining) ? data.state.tokenTraining : null;
  for (const flag of arr(tt?.flags)) {
    const code = str(flag);
    if (!code) continue;
    const text = tOr(t, `${K}.tokenFlag.${code}`, () => t(`${K}.unknownFlag`, { code }));
    items.push(t(`${K}.signalBoard`, { text }));
  }
  const title = `<h2>${e(t(`${K}.signalsTitle`))}</h2>`;
  if (!items.length) return `${title}\n<p class="small">${e(t(`${K}.noSignals`))}</p>`;
  return `${title}\n<ul>\n${items.map((i) => `<li>${e(i)}</li>`).join('\n')}\n</ul>`;
}

/**
 * Страница отчёта целиком. Цели — `summaries.byTarget` в порядке каталога (`catalogOrder`), без рутин в таблице по
 * датам: у рутины прогоны, а не занятия.
 */
export function specialistReportHtml(data: SpecialistExport, t: ReportT, opts: ReportOptions = {}): string {
  const e = escapeHtml;
  const f = makeFormat(t);
  const ctx: Ctx = {
    t,
    f,
    e,
    criterionRate: data.summaries.criterion.minIndependentRate,
    targetName: (id, missing) => (missing ? t(`${K}.unknownTarget`, { id }) : tOr(t, `parent.aba.goal.${id}`, () => t(`${K}.unknownTarget`, { id }))),
    changes: readChanges(arr(data.abaSpecialistEvents)),
  };
  const sessions = readSessions(data.abaSessions);
  const trials = readTrials(data.abaTrials);
  const corrected = new Set(arr(data.abaTrialCorrections).filter(isObj).map((c) => str(c.trialId)).filter((x): x is string => !!x));
  const order = (id: string) => {
    const i = ABA_TARGETS.findIndex((x) => x.id === id);
    return i < 0 ? Infinity : i;
  };
  const targets = [...data.summaries.byTarget].sort((a, b) => order(a.targetId) - order(b.targetId) || a.targetId.localeCompare(b.targetId));
  // карточка с графиком — у цели с занятиями в файле; состояние остальных — в таблице «Задания»
  const cards = targets.filter((tg) => !tg.routine && tg.sessions > 0).map((tg) => targetCard(ctx, data, tg, trials, corrected));
  const footer = opts.dataFileName ? `<p class="small">${e(t(`${K}.dataFile`, { file: opts.dataFileName }))}</p>` : '';
  return `<!doctype html>
<html lang="${e(opts.lang ?? 'ru')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(t(`${K}.docTitle`))}</title>
<style>${STYLE}</style></head><body>
${opts.demo ? `<div class="demo">${e(t(`${K}.demo`))}</div>\n` : ''}${header(ctx, data, sessions)}
${targetsTable(ctx, data, targets)}
${changesTable(ctx)}
${cards.join('\n')}
${sessionsTable(ctx, data, sessions)}
${signals(ctx, data, targets)}
<p class="small">${e(t(`${K}.levelsNote`))}</p>
${footer}</body></html>
`;
}
