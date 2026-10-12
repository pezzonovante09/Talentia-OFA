/**
 * `localDay` (`parentReport.ts`) — календарный день по часовому поясу устройства. Пояс процесса в Jest
 * не переключить: `process.env` в песочнице теста — копия, и V8 её присваивание не видит. Поэтому
 * каждый пояс проверяется в отдельном процессе Node с `TZ` в окружении: исходник собирается
 * компилятором TypeScript из зависимостей проекта и вызывается напрямую, без моков.
 */
import { execFileSync } from 'child_process';
import * as path from 'path';

const SOURCE = path.join(__dirname, '..', 'parentReport.ts');

/** Код для `node -e`: собрать parentReport.ts в CommonJS и вернуть JSON с результатом вызова. */
const RUNNER = `
const fs = require('fs');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(process.argv[1], 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function('exports', 'module', 'require', code)(mod.exports, mod, require);
const isos = JSON.parse(process.argv[2]);
process.stdout.write(JSON.stringify({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, days: isos.map((i) => mod.exports.localDay(i)) }));
`;

function localDaysIn(tz: string, isos: string[]): { tz: string; days: string[] } {  // один процесс на пояс: загрузка компилятора дорогая
  const out = execFileSync(process.execPath, ['-e', RUNNER, SOURCE, JSON.stringify(isos)], {
    env: { ...process.env, TZ: tz },
    cwd: path.join(__dirname, '..', '..', '..'),
    encoding: 'utf8',
  });
  return JSON.parse(out);
}

const ISO = '2026-10-11T20:30:00Z';
const SAMPLES = [
  ISO,
  '2026-10-11T23:00:00Z',
  '2026-10-12T17:59:59Z',
  '2026-10-12T18:00:00Z',
  '2026-10-12T00:00:00Z',
  '2026-10-12T07:00:00Z',
  '2026-10-11T09:59:59Z',
  '2026-10-11T10:00:00Z',
  '2026-12-31T18:00:00Z',
  '2028-02-28T18:00:00Z',
];
const ZONES = ['Asia/Bishkek', 'UTC', 'America/Los_Angeles', 'Pacific/Kiritimati'];
const byZone = new Map<string, { tz: string; days: string[] }>();
const day = (tz: string, iso: string) => byZone.get(tz)!.days[SAMPLES.indexOf(iso)];

beforeAll(() => {
  for (const tz of ZONES) byZone.set(tz, localDaysIn(tz, SAMPLES));
});

describe('localDay: день по поясу устройства', () => {
  // 20:30 UTC 11 октября: Бишкек (UTC+6) уже 12-е, Лос-Анджелес (UTC-7, летнее) ещё 11-е
  it.each([
    ['Asia/Bishkek', '2026-10-12'],
    ['UTC', '2026-10-11'],
    ['America/Los_Angeles', '2026-10-11'],
    ['Pacific/Kiritimati', '2026-10-12'], // UTC+14
  ])('%s: 2026-10-11T20:30Z -> %s', (tz, expected) => {
    expect(byZone.get(tz)!.tz).toBe(tz); // процесс действительно в этом поясе, а не в системном
    expect(day(tz, ISO)).toBe(expected);
  });

  it('Бишкек: урок в 5 утра по местному (23:00 UTC накануне) относится к своему дню, а не к предыдущему', () => {
    expect(['2026-10-11T23:00:00Z', '2026-10-12T17:59:59Z', '2026-10-12T18:00:00Z'].map((i) => day('Asia/Bishkek', i))).toEqual([
      '2026-10-12',
      '2026-10-12',
      '2026-10-13',
    ]);
  });

  it('Лос-Анджелес: полночь UTC - ещё вчерашний вечер', () => {
    expect(['2026-10-12T00:00:00Z', '2026-10-12T07:00:00Z'].map((i) => day('America/Los_Angeles', i))).toEqual(['2026-10-11', '2026-10-12']);
  });

  it('Кирибати (UTC+14): 10:00 UTC уже следующий день', () => {
    expect(['2026-10-11T09:59:59Z', '2026-10-11T10:00:00Z'].map((i) => day('Pacific/Kiritimati', i))).toEqual(['2026-10-11', '2026-10-12']);
  });

  it('UTC: день совпадает с датой метки', () => {
    expect(SAMPLES.map((i) => day('UTC', i))).toEqual(SAMPLES.map((i) => i.slice(0, 10)));
  });

  it('граница года и високосный день считаются по местному поясу', () => {
    expect(['2026-12-31T18:00:00Z', '2028-02-28T18:00:00Z'].map((i) => day('Asia/Bishkek', i))).toEqual(['2027-01-01', '2028-02-29']);
  });
});
