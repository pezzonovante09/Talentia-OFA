/**
 * Гард «без функций здоровья» (решение №114, раунд 4 Д1; ABA.md «Позиционирование»).
 *
 * В сторах ABA-режим подаётся как практика навыков по шагам: в текстах нет диагнозов,
 * «терапии», «лечения», «аутизма». Иначе опросник Apple даёт 13+, а Google требует декларацию
 * здоровья. Гард идёт по всем ключам всех локалей: в тексте для ребёнка этих слов тем более нет.
 */
import en from '../locales/en.json';
import ky from '../locales/ky.json';
import ru from '../locales/ru.json';

type Tree = { [k: string]: string | Tree };
type Lang = 'ru' | 'en' | 'ky';

function flat(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [k, v]) => {
    if (typeof v === 'string') acc[prefix + k] = v;
    else Object.assign(acc, flat(v, `${prefix}${k}.`));
    return acc;
  }, {});
}

const L = String.raw`\p{L}`;
/** Основа в начале слова: «терапи» ловит «терапия», «терапевт» — нет, у него своя основа. */
const stems = (alt: string) => new RegExp(`(?<!${L})(?:${alt})`, 'iu');

/** Медицинские основы по языкам. ky — черновик до носителя (№108). */
export const HEALTH_WORDS: Record<Lang, RegExp> = {
  ru: stems('терапи|терапевт|лечени|лечеб|лечит|аутизм|аутист|РАС(?!' + L + ')|расстройств|диагноз|пациент|симптом|коррекци\\p{L}* поведени|заболевани|болезн'),
  en: stems('therap|treatment|autis|ASD(?!' + L + ')|disorder|diagnos|patient|symptom|disease|medical|clinical'),
  ky: stems('терапи|дарыла|аутизм|диагноз|бейтап|оору(?!' + L + ')'),
};

export function healthWordingProblems(lang: Lang, bank: Record<string, string>): string[] {
  return Object.entries(bank)
    .filter(([, text]) => HEALTH_WORDS[lang].test(text))
    .map(([key, text]) => `${lang} ${key}: «${text}» — медицинская лексика (№114)`);
}

const banks: Record<Lang, Record<string, string>> = { ru: flat(ru as Tree), en: flat(en as Tree), ky: flat(ky as Tree) };

describe.each(['ru', 'en', 'ky'] as const)('локаль %s без медицинской лексики', (lang) => {
  it('ни один ключ не называет диагнозов, терапии и лечения', () => {
    expect(healthWordingProblems(lang, banks[lang])).toEqual([]);
  });
});

describe('правило на примерах', () => {
  it('ловит диагнозы и «терапию», не трогает обычные слова', () => {
    expect(healthWordingProblems('ru', { 'abaScreen.x': 'Занятие по терапии' })).toHaveLength(1);
    expect(healthWordingProblems('ru', { 'abaScreen.x': 'Для детей с РАС' })).toHaveLength(1);
    expect(healthWordingProblems('ru', { 'abaScreen.x': 'Обсудите со специалистом центра' })).toEqual([]);
    expect(healthWordingProblems('ru', { 'content.x': 'Раскрась листья' })).toEqual([]);
    expect(healthWordingProblems('en', { 'abaScreen.x': 'Autism therapy session' })).toHaveLength(1);
    expect(healthWordingProblems('en', { 'abaScreen.x': 'Talk to the specialist at the centre' })).toEqual([]);
    expect(healthWordingProblems('en', { 'abaReinforcer.x': 'Pick a treat!' })).toEqual([]);
  });
});
