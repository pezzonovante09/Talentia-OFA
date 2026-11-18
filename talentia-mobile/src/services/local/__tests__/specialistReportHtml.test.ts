/**
 * Читаемый отчёт специалисту (вопрос 118): `specialistReportHtml` по выдуманной выгрузке (`specialistReportFixture`).
 * Проверяется: шапка («Р1», период, число занятий, режим, кто ведёт метками, знакомство с жетонами), таблица
 * заданий словами, график со столбцами, линией критерия из `summaries.criterion` и отметкой базовой линии,
 * таблица по датам, таблица занятий, сигналы словами или «Сигналов нет»; журнал «Для специалиста» — таблица
 * «Изменения условий», линии смены условий на графиках и текущие параметры в шапке; экранирование; нет имени ребёнка, uuid
 * записей и наблюдателя, сырых ключей локали, скриптов и внешних ресурсов. Образец для владельца пишется в
 * `docs/aba-center/specialist-report-generated-sample.html` при `WRITE_REPORT_SAMPLE=1`.
 */
import fs from 'fs';
import path from 'path';

import type { SpecialistExport } from '../purge';
import { changeLineSlots, escapeHtml, specialistReportHtml } from '../specialistReportHtml';
import { reportT } from '../../../test/reportT';
import { FIXTURE_OBSERVER, fabricatedExport, fixtureId } from '../../../test/specialistReportFixture';

const t = reportT();
const render = (data: SpecialistExport = fabricatedExport(), opts = {}) => specialistReportHtml(data, t, { dataFileName: 'talentia-aba-2026-11-15.json', ...opts });

/** Текст страницы без разметки — для проверок формулировок. */
const text = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('specialistReportHtml: содержание', () => {
  const html = render();
  const plain = text(html);

  it('шапка: Р1 без имени, период, число занятий, режим, кто ведёт меткой, знакомство с жетонами, день выгрузки', () => {
    expect(plain).toContain('Ребёнок: Р1 (имени в файле нет)');
    expect(plain).toContain('3.11.2026 – 14.11.2026');
    expect(plain).toContain('занятий: 6');
    expect(plain).toContain('режим: Со взрослым');
    expect(plain).toContain('ведёт: O1 — Родитель, обучение у специалиста пройдено');
    expect(plain).toContain('знакомство с жетонами пройдено 31.10.2026');
    expect(plain).toContain('выгружено 15.11.2026');
  });

  it('задания — состояние словами: освоено с датой, в обучении — чего не хватает до критерия, без занятий — базовая линия', () => {
    expect(plain).toMatch(/Одинаковые из двух освоено 14\.11/);
    expect(plain).toContain('По форме учим; старт с подсказки 0; занятий подряд с 80 % и выше: 0 из 3; ещё нужно: занятий подряд с 80 % и выше: 3');
    expect(plain).toContain('Одинаковые из трёх базовая линия');
  });

  it('карточка цели: график SVG со столбцами, линией критерия 80 % из файла и отметкой базовой линии', () => {
    const svgs = html.match(/<svg[\s\S]*?<\/svg>/g) ?? [];
    expect(svgs).toHaveLength(2); // две цели с занятиями; у «Одинаковые из трёх» карточки нет
    expect(svgs[0]).toContain('критерий 80 %');
    expect(svgs[0]).toContain('>база<');
    expect(svgs[0]).toContain('>100 %<');
    expect(svgs[0]).toContain('stroke="#C62828"');
  });

  it('линия критерия — из summaries.criterion, а не константой', () => {
    const data = fabricatedExport();
    const custom = { ...data, summaries: { ...data.summaries, criterion: { ...data.summaries.criterion, minIndependentRate: 0.9 } } } as unknown as SpecialistExport;
    expect(render(custom)).toContain('критерий 90 %');
  });

  it('таблица по датам: доля в зачёт, старт с подсказки в начале → в конце, задержка, медианы, пробы на новых карточках', () => {
    expect(plain).toContain('база: 3 из 5 самост.');
    expect(plain).toContain('20 % из 5');
    expect(plain).toContain('3 → 0');
    expect(plain).toContain('Время до касания образца, медиана, с 2,6 2,4 2,0 1,6 1,5 1,3');
    expect(plain).toContain('Пробы на новых карточках — — — 1 из 1 самост. 0 из 1 самост. 1 из 1 самост.');
    expect(plain).toContain('Для критерия — серия прервана серия прервана в серию в серию в серию');
  });

  it('занятия: дата, длительность, попытки (базовая линия, после ошибки), пробы, перерывы по карточке, «Отказ»', () => {
    expect(plain).toContain('3.11 5 мин базовая линия: 5 (3 самост.) — 0 0');
    expect(plain).toContain('7.11 8 мин 5 — 1, из них карточкой: 1 0');
    expect(plain).toContain('10.11 8 мин 5 + 1 после ошибки 1 0 1');
  });

  it('занятие без записи конца (длительности нет) и с остановкой — заметка словами', () => {
    const data = fabricatedExport();
    const rows = data.abaSessions as Record<string, unknown>[];
    const changed = { ...data, abaSessions: rows.map((s, i) => (i === 1 ? { ...s, durationSec: null } : i === 2 ? { ...s, endReason: 'assent_withdrawn' } : s)) };
    const p = text(render(changed));
    expect(p).toContain('5.11 — 5 — 0 0 запись конца занятия не сохранилась');
    expect(p).toContain('остановлено: отказ ребёнка');
  });

  it('сигналы словами; без флагов — «Сигналов нет.»', () => {
    expect(plain).toContain('По форме: ребёнок чаще, чем случайно, выбирает одно и то же место на экране');
    expect(plain).not.toContain('position_bias');
    const data = fabricatedExport();
    const quiet = { ...data, summaries: { ...data.summaries, byTarget: data.summaries.byTarget.map((x) => ({ ...x, state: x.state && { ...x.state, flags: [] } })) } } as SpecialistExport;
    expect(text(render(quiet))).toContain('Сигналов нет.');
  });

  it('сигналы доски жетонов и прочие флаги — словами: token_training_stalled, alternation_bias, mixed_not_established, needs_verification, assent_concern', () => {
    const data = fabricatedExport();
    const flags = ['alternation_bias', 'mixed_not_established', 'needs_verification', 'assent_concern', 'card_preference'] as const;
    const flagged = {
      ...data,
      state: { ...data.state, tokenTraining: { ...(data.state.tokenTraining as object), flags: ['token_training_stalled'] } },
      summaries: { ...data.summaries, byTarget: data.summaries.byTarget.map((x) => (x.targetId === 'match-same-2' ? { ...x, state: { ...x.state!, flags: [...flags] } } : x)) },
    } as SpecialistExport;
    const p = text(render(flagged));
    expect(p).toContain('Доска жетонов: обучение доске жетонов застряло: два занятия без обменов');
    expect(p).toContain('стратегия «на другую сторону»');
    expect(p).toContain('проверка вперемешку два раза не дала итога');
    expect(p).toContain('не подтверждено взрослым, обученным у специалиста');
    expect(p).toContain('задание стоит пересмотреть со специалистом');
    expect(p).toContain('одну и ту же карточку при любой инструкции');
    for (const f of [...flags, 'token_training_stalled']) expect(p).not.toContain(f);
  });

  it('ссылка на файл данных — по имени', () => {
    expect(plain).toContain('Полные записи — в файле данных talentia-aba-2026-11-15.json.');
  });

  it('шапка: сохранённые параметры занятий простыми словами; без параметров — по умолчанию полосы профиля', () => {
    expect(plain).toContain(
      'условия занятий, сохранённые в разделе «Для специалиста»: полоса параметров как в профиле, длительность 10 мин, заданий в обучении за занятие: по умолчанию, время на ответ: по умолчанию',
    );
    const data = fabricatedExport();
    const custom = { ...data, state: { ...data.state, abaSessionParams: { paramsBand: '9-10', maxTeachingTargets: 1, responseWindowMs: { match: 7500 } } } };
    expect(text(render(custom))).toContain(
      'полоса параметров 9–10, длительность по умолчанию, заданий в обучении за занятие: 1, время на ответ (сопоставить): 7,5 с',
    );
    const { abaSessionParams: _p, ...without } = data.state;
    expect(text(render({ ...data, state: without }))).toContain('условия занятий: по умолчанию для полосы профиля');
  });

  it('«Изменения условий»: день, кто — со слов, что изменено, было → стало словами, без мс и null', () => {
    expect(plain).toContain('Изменения условий');
    expect(plain).toContain('Кто менял — со слов: приложение не проверяет, кто держит телефон.');
    expect(plain).toContain('1.11 специалист (со слов) заданий в обучении за занятие по умолчанию 1');
    expect(plain).toContain('7.11 специалист (со слов) длительность занятия по умолчанию 10 мин');
    expect(plain).toContain('10.11 специалист (со слов) обучение наблюдателя у специалиста (Родитель) нет да');
    expect(plain).toContain('12.11 специалист (со слов) заданий в обучении за занятие 1 по умолчанию');
    expect(plain).not.toContain('600000');
  });

  it('«Изменения условий»: окно ответа, полоса, флаг с целью — словами; без журнала — «Изменений условий в файле нет.»', () => {
    const data = fabricatedExport();
    const more = {
      ...data,
      abaSpecialistEvents: [
        { order: 1, day: '2026-11-04', role: 'specialist', claimed: true, field: 'responseWindowMs.match', from: null, to: 8000 },
        { order: 2, day: '2026-11-04', role: 'specialist', claimed: true, field: 'paramsBand', from: null, to: '7' },
        { order: 3, day: '2026-11-13', role: 'specialist', claimed: true, field: 'flag.assent_concern', from: true, to: false, targetIds: ['match-shape'] },
        { order: 4, day: '2026-11-13', role: 'specialist', claimed: true, field: 'flag.mixed_not_established', from: true, to: false, targetIds: ['match-same-2', 'match-shape'] },
      ],
    };
    const p = text(render(more));
    expect(p).toContain('4.11 специалист (со слов) время на ответ (сопоставить) по умолчанию 8 с');
    expect(p).toContain('4.11 специалист (со слов) полоса параметров как в профиле 7');
    expect(p).toContain('13.11 специалист (со слов) сигнал просмотрен: ребёнок часто отказывается: занятия прерываются — По форме да нет');
    expect(p).toContain('13.11 специалист (со слов) проверка вперемешку назначена снова (сигнал «снята с плана») — Одинаковые из двух, По форме да нет');
    expect(text(render({ ...data, abaSpecialistEvents: [] }))).toContain('Изменений условий в файле нет.');
  });

  it('графики: линия смены условий в день изменения, подпись — день; изменения других целей и до первого столбца — не рисуются', () => {
    const svgs = html.match(/<svg[\s\S]*?<\/svg>/g) ?? [];
    const lines = (svg = '') => (svg.match(/class="cc"/g) ?? []).length;
    // «Одинаковые из двух»: 7.11, 10.11, 12.11; 1.11 — раньше первого занятия
    expect(lines(svgs[0])).toBe(3);
    for (const d of ['>7.11<', '>10.11<', '>12.11<']) expect(svgs[0]).toContain(d);
    // «По форме»: занятия с 12.11 — линия только у первого столбца
    expect(lines(svgs[1])).toBe(1);
    expect(plain).toContain('Точечная вертикальная линия с датой — день изменения условий');
    const data = fabricatedExport();
    const own = { ...data, abaSpecialistEvents: [{ order: 1, day: '2026-11-14', role: 'specialist', claimed: true, field: 'flag.ioa_low', from: true, to: false, targetIds: ['match-shape'] }] };
    const [a, b] = render(own).match(/<svg[\s\S]*?<\/svg>/g) ?? [];
    expect([lines(a), lines(b)]).toEqual([0, 1]);
    // без линий — без подписи о линиях
    expect(text(render({ ...data, abaSpecialistEvents: [] }))).not.toContain('Точечная вертикальная линия');
  });

  it('changeLineSlots: перед первым столбцом с днём не раньше изменения; после последнего — у края; раньше первого — нет', () => {
    const bars = ['2026-11-03', '2026-11-05', '2026-11-05', '2026-11-10'];
    expect(changeLineSlots(bars, ['2026-11-01'])).toEqual([]);
    expect(changeLineSlots(bars, ['2026-11-03'])).toEqual([{ slot: 0, days: ['2026-11-03'] }]);
    expect(changeLineSlots(bars, ['2026-11-04', '2026-11-05'])).toEqual([{ slot: 1, days: ['2026-11-04', '2026-11-05'] }]);
    expect(changeLineSlots(bars, ['2026-11-12'])).toEqual([{ slot: 4, days: ['2026-11-12'] }]);
    expect(changeLineSlots(bars, ['2026-11-07', '2026-11-07'])).toEqual([{ slot: 3, days: ['2026-11-07'] }]);
    expect(changeLineSlots([null], ['2026-11-07'])).toEqual([]);
  });
});

describe('specialistReportHtml: приватность и безопасность страницы', () => {
  const html = render();

  it('нет uuid записей и наблюдателя, нет дат со временем суток', () => {
    expect(html).not.toContain(FIXTURE_OBSERVER);
    for (const n of [1, 2, 6, 101, 120, 900]) expect(html).not.toContain(fixtureId(n));
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:/);
  });

  it('нет имени ребёнка: отчёт не печатает поля состояния, кроме разобранных', () => {
    const data = fabricatedExport();
    const out = render({ ...data, state: { ...data.state, childName: 'Айгерим', name: 'Айгерим' } });
    expect(out).not.toContain('Айгерим');
  });

  it('без скриптов, внешних ресурсов, NaN, undefined и сырых ключей локали; печать на A4', () => {
    expect(html).not.toMatch(/<script|<link|https?:|src=|NaN|undefined|null|parent\.aba\.|abaSession\./);
    expect(html).toContain('@page { size: A4');
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('экранирует текст из файла и из словаря: метка наблюдателя, неизвестная цель и флаг с разметкой', () => {
    const data = fabricatedExport();
    const evil = '<img src=x onerror=alert(1)>';
    const hostile = {
      ...data,
      abaSessions: (data.abaSessions as Record<string, unknown>[]).map((s) => ({ ...s, primaryObserverId: evil })),
      abaSpecialistEvents: [
        { order: 1, day: '2026-11-08', role: evil, claimed: true, field: evil, from: evil, to: evil },
        { order: 2, day: '2026-11-09', role: 'specialist', claimed: true, field: 'responseWindowMs.match', from: null, to: evil },
      ],
      summaries: {
        ...data.summaries,
        byTarget: [...data.summaries.byTarget, { ...data.summaries.byTarget[0], targetId: `x"${evil}`, catalogMissing: true as const, state: { ...data.summaries.byTarget[0].state!, flags: [evil as never] } }],
      },
    } as SpecialistExport;
    const out = render(hostile);
    expect(out).not.toContain('<img');
    expect(out).toContain(escapeHtml(evil));
  });

  it('пустая выгрузка — страница без графиков, «Заданий в файле нет», «Сигналов нет»', () => {
    const empty: SpecialistExport = {
      exportedAt: '2026-11-15',
      abaTrials: [],
      abaSessions: [],
      abaIoa: [],
      abaTrialCorrections: [],
      abaRoutineRuns: [],
      abaReinforcerChoices: [],
      abaPairingSessions: [],
      abaSpecialistEvents: [],
      summaries: { ...fabricatedExport().summaries, bySession: [], byTarget: [] },
      state: {},
    };
    const out = render(empty);
    expect(out).not.toContain('<svg');
    expect(text(out)).toContain('занятий в файле нет');
    expect(text(out)).toContain('Заданий в файле нет.');
    expect(text(out)).toContain('Сигналов нет.');
    expect(out).not.toMatch(/NaN|undefined|parent\.aba\./);
  });

  it('английский словарь: без кириллицы, кроме названий из данных нет', () => {
    const out = specialistReportHtml(fabricatedExport(), reportT('en'), { lang: 'en' });
    expect(out).toContain('<html lang="en">');
    expect(text(out)).not.toMatch(/[А-Яа-яЁё]/);
  });

  it('плашка образца — только с demo', () => {
    expect(html).not.toContain('class="demo"');
    expect(render(undefined, { demo: true })).toContain('Пример на выдуманных данных');
  });
});

// образец для владельца: `WRITE_REPORT_SAMPLE=1 npx jest specialistReportHtml`
(process.env.WRITE_REPORT_SAMPLE ? it : it.skip)('пишет образец docs/aba-center/specialist-report-generated-sample.html', () => {
  const out = path.resolve(__dirname, '../../../../../docs/aba-center/specialist-report-generated-sample.html');
  fs.writeFileSync(out, render(undefined, { demo: true }));
});
