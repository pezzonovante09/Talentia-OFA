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

/**
 * Медицинские основы по языкам. ky — черновик до носителя (№108). Раунд 5 (`release-readiness-auditor`,
 * `localization-qa`, `qa-engineer`): слова, по которым ревьюер опознаёт медицинскую или поведенческую
 * функцию, и ось Apple «Health or Wellness Topics» (9+) — советы о здоровье и гигиене. «Здорово!» —
 * похвала, поэтому основа «здоровь», а не «здоров».
 */
export const HEALTH_WORDS: Record<Lang, RegExp> = {
  ru: stems(
    [
      'терапи|терапевт|лечени|лечеб|лечит|(?:вы|из)лечи|аутизм|аутист|аутичн|РАС(?!' + L + ')|расстройств|диагноз|пациент|симптом',
      'коррекци\\p{L}* поведени|коррекционн|заболе|болезн|медицин|клиник|врач|СДВГ|ЗПР|ОВЗ(?!' + L + ')|нарушени\\p{L}* (?:развити|поведени)',
      'дефектолог|психиатр|невролог|реабилит|инвалид|здоровь|гигиен|микроб',
    ].join('|'),
  ),
  en: stems(
    [
      'therap|treatment|autis|ASD(?!' + L + ')|ADHD|disorder|diagnos|patient|symptom|disease|medic|clinic|doctor|cure(?!' + L + ')',
      'special needs|developmental delay|intervention|rehab|neurodiverg|disabilit|health|hygien|germs?(?!' + L + ')',
    ].join('|'),
  ),
  ky: stems('терапи|дарыла|дарыгер|аутизм|диагноз|бейтап|оору\\p{L}*|медицин|клиника|майып'),
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

  // раунд 5 (`qa-engineer`): пример на каждую основу, иначе удаление основы проходит тесты
  it.each([
    'Занятие по терапии', 'Терапевт центра', 'Лечение', 'Лечебная игра', 'Это лечит', 'Вылечить', 'Для детей с аутизмом',
    'Аутист', 'Аутичный ребёнок', 'Для детей с РАС', 'Расстройство', 'Диагноз', 'Пациент', 'Симптомы', 'Коррекция поведения',
    'Коррекционное занятие', 'Заболевание', 'Болезнь', 'Медицинские показания', 'Клиника', 'Врач', 'СДВГ', 'ЗПР', 'Дети с ОВЗ',
    'Нарушение развития', 'Нарушения поведения', 'Дефектолог', 'Психиатр', 'Невролог', 'Реабилитация', 'Инвалидность',
    'Для здоровья', 'Гигиена рук', 'Микробы',
  ])('ru: ловит «%s»', (text) => {
    expect(healthWordingProblems('ru', { 'abaScreen.x': text })).toHaveLength(1);
  });

  it.each(['Здорово!', 'Помой руки', 'Почисти зубы', 'Обсудите со специалистом центра', 'Нарисуй дом', 'Практика навыков по шагам'])(
    'ru: пропускает «%s»',
    (text) => {
      expect(healthWordingProblems('ru', { 'abaScreen.x': text })).toEqual([]);
    },
  );

  it.each([
    'Therapy', 'Treatment plan', 'Autism', 'ASD', 'ADHD', 'Disorder', 'Diagnosis', 'Patient', 'Symptoms', 'Disease', 'Medication',
    'Medical', 'Clinician', 'Doctor', 'A cure', 'Special needs', 'Developmental delay', 'Intervention plan', 'Rehabilitation',
    'Neurodivergent', 'Disability', 'Healthcare', 'Stay healthy', 'Hygiene', 'Germs',
  ])('en: ловит «%s»', (text) => {
    expect(healthWordingProblems('en', { 'abaScreen.x': text })).toHaveLength(1);
  });

  it.each(['Wash your hands', 'Brush your teeth', 'Talk to the specialist at the centre', 'Secure the lid', 'German'])(
    'en: пропускает «%s»',
    (text) => {
      expect(healthWordingProblems('en', { 'abaScreen.x': text })).toEqual([]);
    },
  );

  it.each(['оору', 'оорусу', 'дарыгер', 'майып'])('ky (черновик): ловит «%s»', (text) => {
    expect(healthWordingProblems('ky', { 'abaScreen.x': text })).toHaveLength(1);
  });
});
