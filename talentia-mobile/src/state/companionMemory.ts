/**
 * Какой вариант реплики Tali прозвучит (TALI.md, «Без заметных повторов»; этап D5 по аудиту 2026-11-09, Ж14): вариант
 * не звучит снова, пока не прозвучали остальные три его ситуации (`pickVariant`), и на новом круге первым не идёт тот,
 * что прозвучал последним. Память — **только в оперативной памяти** сеанса: на устройство не пишется, в журналы и
 * экспорт не попадает, сбрасывается сменой ребёнка (`childSession`). Форма обращения выбирает родовую надстройку, если
 * она есть (`lineKeyFor`); сама форма отсюда никуда не уходит.
 */
import i18n from '../i18n';
import { lineKeyFor, pickVariant, VARIANTS_PER_SITUATION, type AddressForm, type Situation } from '../domain/companionSituations';

const used = new Map<Situation, number[]>();

/** Ключ реплики ситуации `s` — следующий без повтора вариант с формой обращения ребёнка. */
export function companionLine(s: Situation, form: AddressForm, random: () => number = Math.random): string {
  let heard = used.get(s) ?? [];
  if (heard.length >= VARIANTS_PER_SITUATION) heard = heard.slice(-1);
  const variant = pickVariant(heard, VARIANTS_PER_SITUATION, random);
  used.set(s, [...heard, variant]);
  return lineKeyFor(s, variant, form, (key) => i18n.exists(key));
}

export function resetCompanionMemory(): void {
  used.clear();
}
