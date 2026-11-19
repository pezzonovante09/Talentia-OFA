/**
 * Имя ребёнка в реплике Tali (TALI.md, «Подстановки»; решения №42, №101; раунд 4, Д7).
 *
 * Имя — только обращением в начале или в конце реплики: «{{name}}, смотри!», «Молодец,
 * {{name}}!». Имя по умолчанию пустое, и это нормальное состояние: тогда обращение вырезается
 * вместе с запятой, а не подставляется пустой строкой («, смотри!», «Молодец, !»). Одна функция
 * на банк `companion.*` и на реплики урока (завязка, шаги примера) — чтобы правило не разошлось.
 *
 * Применяется к строке локали до остальных подстановок i18next. Имя посреди фразы гарды
 * (`nameOnlyInTali`, `companionLines.test.ts`) не пропускают; если оно всё же дошло сюда при
 * пустом имени, слово вырезается, а пробелы схлопываются, — чтобы ребёнок не увидел `{{name}}`.
 */

const NAME = String.raw`\{\{-?\s*name\s*(?:,[^}]*)?\}\}`;
// Ведущая кавычка остаётся: «{{name}}, смотри!» → «Смотри!» (раунд 5, `qa-engineer`)
const LEADING = new RegExp(String.raw`^(\s*[«"„]?)\s*${NAME}\s*[,!]\s*`, 'i');
const TRAILING = new RegExp(String.raw`\s*,\s*${NAME}(?=\s*[!.?…»"]*\s*$)`, 'i');
const ANY = new RegExp(NAME, 'gi');

export function applyName(text: string, name: string | undefined): string {
  const trimmed = (name ?? '').trim();
  // функцией, а не строкой: «$&» и «$1» в имени — буквы, а не шаблоны String.replace (раунд 5)
  if (trimmed !== '') return text.replace(ANY, () => trimmed);
  let out = text.replace(TRAILING, '');
  const cutHead = LEADING.test(out);
  out = out.replace(LEADING, '$1');
  out = out.replace(ANY, '').replace(/\s{2,}/g, ' ').replace(/\s+([,!.?…])/g, '$1').replace(/,(?=[,!.?…])/g, '').trim();
  // «{{name}}, смотри!» → «Смотри!»: реплика снова начинается с заглавной
  return cutHead ? out.replace(/^([«"„]?)(\p{Ll})/u, (_, q: string, c: string) => q + c.toLocaleUpperCase()) : out;
}
