import { applyName } from '../taliName';

describe('имя в реплике Tali (раунд 4, Д7)', () => {
  it.each([
    ['{{name}}, смотри!', 'Айым, смотри!'],
    ['Молодец, {{name}}!', 'Молодец, Айым!'],
    ['{{name, capitalize}}, у тебя получилось!', 'Айым, у тебя получилось!'],
  ])('имя есть: «%s» → «%s»', (text, out) => {
    expect(applyName(text, ' Айым ')).toBe(out);
  });

  it.each([
    ['{{name}}, смотри!', 'Смотри!'],
    ['{{name}}! Смотри, что тут.', 'Смотри, что тут.'],
    ['Молодец, {{name}}!', 'Молодец!'],
    ['У тебя получилось, {{name}}.', 'У тебя получилось.'],
    ['Вот и всё, {{ name }}…', 'Вот и всё…'],
    ['Hi, {{name}}!', 'Hi!'],
    ['Без имени!', 'Без имени!'],
  ])('имя пустое: «%s» → «%s»', (text, out) => {
    expect(applyName(text, '')).toBe(out);
    expect(applyName(text, '   ')).toBe(out);
    expect(applyName(text, undefined)).toBe(out);
  });

  it('пустое имя: ни ведущей запятой, ни двойного пробела, ни пробела перед знаком', () => {
    for (const text of ['{{name}}, смотри!', 'Молодец, {{name}}!', 'Смотри, {{name}}, на камни!']) {
      const out = applyName(text, '');
      expect(out).not.toMatch(/^\s*[,!.?]/);
      expect(out).not.toMatch(/\s{2}|\s[,!.?…]|,[,!.?…]/);
      expect(out).not.toMatch(/\{\{/);
    }
  });
});

describe('имя в реплике Tali: раунд 5', () => {
  it('«$&» и «$1» в имени — буквы, а не шаблоны замены', () => {
    expect(applyName('{{name}}, смотри!', '$&')).toBe('$&, смотри!');
    expect(applyName('Молодец, {{name}}!', 'a$1b')).toBe('Молодец, a$1b!');
  });

  it('ведущая кавычка остаётся, буква после неё — заглавная', () => {
    expect(applyName('«{{name}}, смотри!»', '')).toBe('«Смотри!»');
    expect(applyName('«Молодец, {{name}}!»', '')).toBe('«Молодец!»');
  });
});
