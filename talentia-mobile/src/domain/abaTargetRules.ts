/**
 * Правила на ABA-цель. Спецификация — `ABA.md` («Единица работы», «Task analysis»,
 * «Генерализация», «Разбор оркестратора сессии»).
 *
 * Здесь то, что ломает процедуру молча: цель проходит сессию, данные пишутся, а
 * критерий недостижим или помечен процедурой, которую никто не применял. Сессия с
 * такой целью не начинается (`abaSession.startAbaSession`), и тот же список —
 * основа гарда корпуса ABA, когда появится контент.
 */
import { promptLadder } from './abaPrompting';
import { MAX_DELAY_MS, type AbaArea, type AbaExemplar, type AbaFormat, type AbaSdKind, type AbaTarget } from '../types/aba';

/** Экземпляров на цель: меньше трёх — учит одной картинке, больше пяти — не нужно. */
export const EXEMPLARS = { min: 3, max: 5 } as const;

/** Звеньев цепочки по полосе: длиннее — уже не одна инструкция телом. */
export const MAX_CHAIN_STEPS = { young: 5, older: 8 } as const;

/** Разных пар «экземпляр × формулировка» для переноса: критерий требует двух зачётов. */
export const MIN_GENERALIZATION_PAIRS = 2;

/** Чем экземпляр отличается от другого. Два экземпляра, отличающиеся только `id`, — один. */
function signature(e: AbaExemplar): string {
  return JSON.stringify([e.targetKey, e.modelKey, e.partialModelKeys, e.image ?? null, e.voice ?? null]);
}

/**
 * Какими форматами делается область (ABA.md, «Сетка целей»). Сопоставление, называние,
 * интравербальное и строй речи ждут форматов `match` и `say` — пока целей в этих областях
 * поставить нельзя.
 */
export const AREA_FORMATS: Record<AbaArea, readonly AbaFormat[]> = {
  matching: [],
  motor_imitation: ['do_action'],
  receptive_identify: ['identify'],
  receptive_instructions: ['do_action'],
  echoic: ['imitate_sound', 'repeat_word'],
  lrffc: ['identify'],
  tact: [],
  intraverbal: [],
  voice_control: ['voice_volume'],
  early_academic: ['identify'],
  sentence: [],
  self_care: ['do_action'],
};

/** Какой вид инструкции у области: у LRFFC — не по названию, у подражания — модель. */
const AREA_SD: Partial<Record<AbaArea, readonly AbaSdKind[]>> = {
  receptive_identify: ['name'],
  lrffc: ['function', 'feature', 'class'],
  early_academic: ['name'],
  motor_imitation: ['imitation'],
  voice_control: ['imitation', 'instruction'],
  receptive_instructions: ['instruction'],
  self_care: ['instruction'],
};

/** Что не так с целью. Пустой список — цель годится для сессии. */
export function targetErrors(t: AbaTarget): string[] {
  const errors: string[] = [];
  const teaching = t.exemplars.filter((e) => e.role === 'teaching');
  const general = t.exemplars.filter((e) => e.role === 'generalization');

  if (t.exemplars.length < EXEMPLARS.min || t.exemplars.length > EXEMPLARS.max) {
    errors.push(`экземпляров ${t.exemplars.length}, нужно ${EXEMPLARS.min}–${EXEMPLARS.max}`);
  }
  if (teaching.length < 2) errors.push('обучающих экземпляров меньше двух: критерий требует двух разных');
  if (general.length < 1) errors.push('нет экземпляра переноса');
  const pairs = general.length * Math.max(1, t.sdVariantKeys?.length ?? 0);
  if (general.length && pairs < MIN_GENERALIZATION_PAIRS) {
    errors.push('для переноса меньше двух пар «экземпляр × формулировка»: критерий недостижим');
  }
  if (new Set(t.exemplars.map(signature)).size < t.exemplars.length) {
    errors.push('экземпляры отличаются только id: это один стимул');
  }
  if (new Set(t.exemplars.map((e) => e.id)).size < t.exemplars.length) errors.push('id экземпляров повторяются');

  if (t.band === '5-6' && t.blockSize === 10) {
    errors.push('блок 10 на полосе 5–6: сессия малыша — 12–14 проб, блок 5');
  }
  if (t.delayMs > MAX_DELAY_MS[t.band]) errors.push(`задержка ${t.delayMs} мс выше потолка полосы`);
  if (t.scoredBy === 'device_asr') errors.push('распознавание речи не бывает арбитром');

  if (t.steps?.length) {
    if (t.format !== 'do_action') errors.push('цепочка — только у do_action');
    const max = t.band === '5-6' ? MAX_CHAIN_STEPS.young : MAX_CHAIN_STEPS.older;
    if (t.steps.length > max) errors.push(`звеньев ${t.steps.length}, на полосе ${t.band} не больше ${max}`);
    if (new Set(t.steps.map((s) => s.order)).size < t.steps.length) errors.push('порядок звеньев повторяется');
    // окно не меньше потолка задержки: иначе задержка молча обрезается окном
    for (const s of t.steps) {
      if (s.responseWindowMs !== undefined && s.responseWindowMs < MAX_DELAY_MS[t.band]) {
        errors.push(`окно звена ${s.id} короче потолка задержки полосы`);
      }
    }
  }
  if (t.chaining === 'backward') {
    errors.push('обратное сцепление не реализовано: как total task его выполнять нельзя — данные солгут');
  }

  if (t.format === 'identify') {
    if (!t.identifyPoolKey) errors.push('у identify нет пула: цели «покажи…» учатся только набором');
    if (t.exemplars.some((e) => !e.image)) errors.push('у экземпляра identify нет картинки');
    if (t.scoredBy === 'device_onset' || t.scoredBy === 'device_loudness') {
      errors.push('identify оценивает касание или взрослый');
    }
  } else if (t.identifyPoolKey) {
    errors.push('пул набора — только у identify');
  }
  if (t.scoredBy === 'device_tap' && t.format !== 'identify') errors.push('касание оценивает только identify');

  // Сетка целей (ABA.md, «Сетка целей», `aba-pedagogy-specialist` 2026-10-02).
  if (!AREA_FORMATS[t.area]?.includes(t.format)) {
    errors.push(`область ${t.area} не делается форматом ${t.format}`);
  }
  const sd = AREA_SD[t.area];
  if (sd && (!t.sdKind || !sd.includes(t.sdKind))) {
    errors.push(`у области ${t.area} вид инструкции ${sd.join(' / ')}, а не ${t.sdKind ?? 'пусто'}`);
  }
  if (!sd && t.sdKind) errors.push(`у области ${t.area} нет вида инструкции, а задан ${t.sdKind}`);
  if (t.level === 'cross' && t.area !== 'self_care') errors.push('сквозной блок — только самообслуживание');
  if (t.area === 'self_care' && t.level !== 'cross') errors.push('самообслуживание — сквозной блок, не ступень');
  if (t.area === 'self_care' && !t.steps?.length) errors.push('самообслуживание — цепочка с картинками шагов');

  // Лестница подражания (ABA.md, «Лестница подражания»): SD и есть модель.
  if (promptLadder(t) === 'imitative') {
    if (t.exemplars.some((e) => e.partialModelKeys.length > 0)) {
      errors.push('частичная модель у цели, где SD и есть модель: она даёт меньше SD — L2 у такой цели нет');
    }
    if (t.exemplars.some((e) => e.modelKey === t.sdKey)) {
      errors.push('усиленная модель L3 совпадает с SD: нужен отдельный ассет — медленнее, с выделением');
    }
  }
  return errors;
}
