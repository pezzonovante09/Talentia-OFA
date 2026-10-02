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
  return JSON.stringify([e.targetKey, e.modelKey, e.partialModelKeys, e.image ?? null, e.voice ?? null, e.cards ?? null, e.category ?? null]);
}

/** Какими форматами делается область (ABA.md, «Сетка целей»). */
export const AREA_FORMATS: Record<AbaArea, readonly AbaFormat[]> = {
  matching: ['match'],
  motor_imitation: ['do_action'],
  receptive_identify: ['identify'],
  receptive_instructions: ['do_action'],
  echoic: ['imitate_sound', 'repeat_word'],
  lrffc: ['identify'],
  tact: ['say'],
  intraverbal: ['say'],
  voice_control: ['voice_volume'],
  early_academic: ['identify', 'match'],
  sentence: ['say'],
  self_care: ['do_action'],
};

/** Какой вид инструкции у области: у LRFFC — не по названию, у подражания — модель. */
const AREA_SD: Partial<Record<AbaArea, readonly AbaSdKind[]>> = {
  receptive_identify: ['name'],
  lrffc: ['function', 'feature', 'class'],
  tact: ['picture'],
  intraverbal: ['verbal'],
  sentence: ['picture'],
  motor_imitation: ['imitation'],
  voice_control: ['imitation', 'instruction'],
  receptive_instructions: ['instruction'],
  self_care: ['instruction'],
};

/** Предметов у сортировки: по 3 обучающих и 1 переноса на каждую из двух категорий. */
export const SORT_EXEMPLARS = { perCategoryTeaching: 3, perCategoryGeneralization: 1 } as const;

/** `match` и сортировка (ABA.md, «Спецификация первой версии»). */
function matchErrors(t: AbaTarget): string[] {
  const errors: string[] = [];
  if (t.format !== 'match') {
    if (t.fieldSize !== undefined || t.matchMode !== undefined || t.sortCategories !== undefined) {
      errors.push('поле, режим и категории — только у match');
    }
    return errors;
  }
  if (t.scoredBy !== 'device_tap' && t.scoredBy !== 'adult') errors.push('match оценивает касание или взрослый');
  if (t.matchMode === 'sort') {
    const cats = t.sortCategories;
    if (!cats || cats[0] === cats[1]) errors.push('у сортировки нужны две разные категории');
    if (t.level !== 2) errors.push('сортировка — ступень 2');
    for (const c of cats ?? []) {
      const items = t.exemplars.filter((e) => e.category === c);
      const teaching = items.filter((e) => e.role === 'teaching').length;
      const general = items.filter((e) => e.role === 'generalization').length;
      if (teaching !== SORT_EXEMPLARS.perCategoryTeaching || general !== SORT_EXEMPLARS.perCategoryGeneralization) {
        errors.push(`категория ${c}: предметов ${teaching} обучающих и ${general} переноса, нужно 3 и 1`);
      }
    }
    if (t.exemplars.some((e) => !cats?.includes(e.category ?? ''))) errors.push('у предмета сортировки нет категории из двух');
    if (t.exemplars.some((e) => !e.image)) errors.push('у предмета сортировки нет картинки');
    // выбор из двух: при блоке 5 «4 из 5» угадывается в 18,75%, при блоке 10 «8 из 10» — в 5,5%
    if (t.band !== '5-6' && t.blockSize !== 10) errors.push('сортировка с полосы 7 — блоком 10');
    return errors;
  }
  if (t.fieldSize === undefined) errors.push('у match нет размера поля (fieldSize)');
  else if (t.band === '5-6' && t.fieldSize > 3) errors.push(`поле ${t.fieldSize} на полосе 5–6, не больше 3`);
  for (const e of t.exemplars) {
    if (!e.cards || e.cards.length !== t.fieldSize) errors.push(`у экземпляра ${e.id} карточек ${e.cards?.length ?? 0}, нужно ${t.fieldSize}`);
    else if (new Set(e.cards).size < e.cards.length) errors.push(`у экземпляра ${e.id} карточки повторяются`);
  }
  return errors;
}

/** `say`: засчитывает только взрослый — распознавание речи не арбитр (ABA.md, «Микрофон»). */
function sayErrors(t: AbaTarget): string[] {
  if (t.format !== 'say') return [];
  return t.scoredBy === 'adult' ? [] : ['say засчитывает только взрослый'];
}

/**
 * Правила на программу — связи между целями (методист, 2026-10-02): у `say` среди предпосылок
 * есть цель эхоики `repeat_word` (без неё L3 — полная модель — ничего не даёт); у сортировки —
 * `match` по категории.
 */
export function programErrors(targets: readonly AbaTarget[]): string[] {
  const byId = new Map(targets.map((t) => [t.id, t]));
  const pre = (t: AbaTarget) => (t.prerequisiteTargetIds ?? []).map((id) => byId.get(id)).filter((x): x is AbaTarget => !!x);
  const errors: string[] = [];
  for (const t of targets) {
    if (t.format === 'say' && !pre(t).some((p) => p.format === 'repeat_word')) {
      errors.push(`${t.id}: у say среди предпосылок нет цели repeat_word`);
    }
    if (t.format === 'match' && t.matchMode === 'sort' && !pre(t).some((p) => p.format === 'match' && p.matchMode !== 'sort')) {
      errors.push(`${t.id}: у сортировки среди предпосылок нет match`);
    }
  }
  return errors;
}

/** Что не так с целью. Пустой список — цель годится для сессии. */
export function targetErrors(t: AbaTarget): string[] {
  const errors: string[] = [];
  const teaching = t.exemplars.filter((e) => e.role === 'teaching');
  const general = t.exemplars.filter((e) => e.role === 'generalization');

  // У сортировки предметов 8 — своё правило (`matchErrors`).
  const sort = t.format === 'match' && t.matchMode === 'sort';
  if (!sort && (t.exemplars.length < EXEMPLARS.min || t.exemplars.length > EXEMPLARS.max)) {
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
  if (t.scoredBy === 'device_tap' && t.format !== 'identify' && t.format !== 'match') {
    errors.push('касание оценивает только identify и match');
  }
  errors.push(...matchErrors(t), ...sayErrors(t));

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
