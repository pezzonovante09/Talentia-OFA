/**
 * Ворота этапа F1 (контрольный аудит 2026-11-09, Ж18 — ABA был набран системным шрифтом): текст экранов ABA рисует
 * только `AbaText` (`src/ui/aba/AbaText.tsx`, Nunito по весу, потолок системного масштаба). Голый `Text` из
 * `react-native` в `app/aba/**` и `src/ui/aba/**` (кроме тестов) — падение.
 *
 * Исключения прибиты числом: сам `AbaText.tsx` и две заглушки разработчика под `__DEV__` — по одному `<Text` в
 * `reinforcer.tsx` (карточка подкрепителя без картинки) и `StimulusPlate.tsx` (предмет без картинки). Вторая такая
 * строка в этих файлах — тоже падение.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..', '..', '..', '..');
const SCANNED = ['app/aba', 'src/ui/aba'];
/** Файл → сколько голых `Text` в нём разрешено (относительно корня пакета, через `/`). */
const ALLOWED: Record<string, number | 'any'> = {
  'src/ui/aba/AbaText.tsx': 'any',
  'src/ui/aba/reinforcer.tsx': 1,
  'src/ui/aba/StimulusPlate.tsx': 1,
};

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(rel);
    return /\.(tsx?|jsx?)$/.test(e.name) ? [rel] : [];
  });
}

/** Комментарии не в счёт: «`<Text`» в пояснении не рисует текст. */
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

/**
 * Сколько раз файл рисует текст голым `Text` из `react-native`: JSX `<Text`, под псевдонимом (`Text as RNText`), через
 * пространство имён (`RN.Text`), `Animated.Text` и `createElement(Text, …)`.
 */
function bareTextRenders(source: string): number {
  const src = stripComments(source);
  const locals = new Set<string>();
  const namespaces = new Set<string>(['Animated']);
  for (const m of src.matchAll(/import\s+([^;]*?)\s+from\s+['"]react-native['"]/g)) {
    const clause = m[1];
    const ns = clause.match(/\*\s+as\s+(\w+)/);
    if (ns) namespaces.add(ns[1]);
    const braces = clause.match(/\{([^}]*)\}/);
    for (const spec of braces ? braces[1].split(',') : []) {
      const [imported, local] = spec.trim().replace(/^type\s+/, '').split(/\s+as\s+/);
      if (imported === 'Text' && !/^type\s/.test(spec.trim())) locals.add(local ?? imported);
    }
  }
  const names = [...locals, ...[...namespaces].map((n) => `${n}\\.Text`)];
  if (names.length === 0) return 0;
  const alt = names.join('|');
  const jsx = src.match(new RegExp(`<(?:${alt})(?=[\\s>/])`, 'g')) ?? [];
  const created = src.match(new RegExp(`createElement\\(\\s*(?:${alt})\\s*[,)]`, 'g')) ?? [];
  return jsx.length + created.length;
}

describe('ABA: текст — только через AbaText (этап F1, Ж18)', () => {
  const files = SCANNED.flatMap(sourceFiles);
  const renders = Object.fromEntries(files.map((f) => [f, bareTextRenders(fs.readFileSync(path.join(ROOT, f), 'utf8'))]));

  it('обход нашёл экраны и компоненты ABA, и они пишут через AbaText', () => {
    // ворота не проходят впустую: пути верны, экраны на месте, AbaText действительно в ходу
    expect(files).toEqual(expect.arrayContaining(['app/aba/session.tsx', 'app/aba/pairing.tsx', 'src/ui/aba/AbaText.tsx', 'src/ui/aba/reinforcer.tsx', 'src/ui/aba/StimulusPlate.tsx']));
    const usingAbaText = files.filter((f) => /<AbaText[\s>/]/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
    expect(usingAbaText.length).toBeGreaterThanOrEqual(5);
  });

  it('вне исключений голого Text из react-native нет ни в одном файле', () => {
    const offenders = Object.entries(renders).filter(([f, n]) => ALLOWED[f] === undefined && n > 0);
    expect(offenders).toEqual([]);
  });

  it('заглушки разработчика: ровно один Text в reinforcer.tsx и один в StimulusPlate.tsx', () => {
    expect(renders['src/ui/aba/reinforcer.tsx']).toBe(1);
    expect(renders['src/ui/aba/StimulusPlate.tsx']).toBe(1);
  });

  it('счётчик ловит JSX, псевдоним, пространство имён, Animated.Text и createElement; комментарии и типы — нет', () => {
    expect(bareTextRenders(`import { Text, View } from 'react-native';\nconst a = <View><Text>a</Text><Text style={s}/></View>;`)).toBe(2);
    expect(bareTextRenders(`import { Text as RNText } from "react-native";\nconst a = <RNText>a</RNText>;`)).toBe(1);
    expect(bareTextRenders(`import * as RN from 'react-native';\nconst a = <RN.Text>a</RN.Text>;`)).toBe(1);
    expect(bareTextRenders(`import { Animated } from 'react-native';\nconst a = <Animated.Text>a</Animated.Text>;`)).toBe(1);
    expect(bareTextRenders(`import { Text } from 'react-native';\nReact.createElement(Text, null, 'a');`)).toBe(1);
    expect(bareTextRenders(`import { Text } from 'react-native';\n// <Text> в комментарии\n/* <Text /> */\ntype P = ComponentProps<typeof Text>;`)).toBe(0);
    expect(bareTextRenders(`import { type TextStyle } from 'react-native';\nimport { AbaText } from './AbaText';\nconst a = <AbaText>a</AbaText>;`)).toBe(0);
    expect(bareTextRenders(`import { TextInput } from 'react-native';\nconst a = <TextInput />;`)).toBe(0);
  });
});
