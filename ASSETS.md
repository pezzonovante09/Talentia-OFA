# Генерация ассетов Talentia

Пошаговый гайд. Направление — «Живая гуашь», плоские фигуры со сплошной заливкой
и толстым контуром. Решения и обоснования — в `REBUILD.md`.

Инструменты: **Recraft** для всего, что должно быть вектором; **Nano Banana**
(Google AI Studio, бесплатно) для предметов к заданиям.

---

## 0. Настройка, один раз

Создайте в Recraft **проект** — он держит общие настройки для всех генераций.

### Цвета бренда

Вбейте ровно эти. Recraft будет удерживать палитру, и ассеты сойдутся с кодом.

```
#2A1A12   контур и текст
#FFF3E3   фон приложения
#FFFFFF   карточки
#FFE6C7   брюхо, вложенные блоки
#3FC08A   тело Tali
#2FA24E   зелёная тень, Живой лес
#FFC42E   награда, гогглы
#0E8FBF   Побережье слов, стёкла
#D93A1E   внимание, сумка
#5A34C4   основное действие
#F2B705   Числовая долина
#12855A   верно
```

### Модели

| Что генерируем | Модель | Тип стиля |
|---|---|---|
| Пробный кадр, Tali, иконки | **Recraft V4.1 Vector** | Vector illustration |
| Четыре панорамы | **Recraft V4.1 Pro Vector** | Vector illustration |
| Иконки интерфейса | Recraft V4.1 Vector | **Icon** |

Не берите «Digital illustration» — она даёт мягкие переходы, которые выпадут
из направления.

### Прозрачный фон

Включать для **Tali, жителей, иконок и предметов**. Для панорам не нужен.

---

## Шаг 1. Калибровка стиля

**Это самый важный шаг. Не пропускайте его.** Без него четыре панорамы, персонаж
и сотня предметов окажутся из разных миров, и переделывать придётся всё.

Сгенерируйте один простой предмет и гоняйте, пока не понравится:

```
A single apple, flat vector cut-out style, thick uniform dark outline,
completely flat fills, no gradients, no texture, no shadows,
children's picture-book applique look.
```

**Что оценивать:**

- толщина контура — она должна быть одинаковой по всему силуэту, без утончений;
- заливка ровная, без намёка на градиент и текстуру;
- форма упрощённая, но узнаваемая;
- никаких теней под предметом.

Когда кадр устраивает — **сохраните его как Style** (Style Lock, стиль по образцу).
Дальше каждая генерация ссылается на этот стиль.

Расход: примерно 50 кредитов.

---

## Шаг 2. Tali, шесть поз

Генерируйте **одним листом**, не по одной картинке: внутри одного кадра модель
держит персонажа заметно лучше.

Формат **16:9**, прозрачный фон, ссылка на сохранённый стиль.

```
Character sheet, 6 poses of the same cartoon dinosaur, flat vector cut-out
style, thick uniform dark outline (#2A1A12), completely flat fills with NO
gradients and NO texture, children's picture-book applique look.

Character: small friendly green dinosaur explorer. Body #3FC08A with a
darker green shadow side #2FA24E, cream belly #FFE6C7, large yellow goggles
#FFC42E with blue lenses #0E8FBF worn on the forehead, red satchel #D93A1E
with a yellow buckle. Big head, short legs, round friendly eyes.

Poses left to right: 1 waving hello, 2 holding up a rolled map having found
something, 3 puzzled with head tilted, 4 pointing a paw to the side,
5 jumping with joy, 6 leaning over a book and writing.

Plain white background, each pose fully separated, no text, no labels,
no shadows on the ground.
```

**Если одна поза не удалась** — правьте её отдельно через image-input от удачного
кадра. Не перегенерируйте весь лист: потеряете те позы, что уже хороши.

**Требования к нарезке — от них зависит, будет ли работать анимация:**

1. Шесть отдельных файлов.
2. **Одинаковый размер кадра** у всех шести.
3. **Одинаковое положение и масштаб персонажа** внутри кадра. Если на одной позе
   Tali по центру, а на другой смещён — при переключении он будет прыгать.

Проще всего резать лист по равным ячейкам.

**Имена файлов:**

```
tali-hello.svg     приветствие
tali-found.svg     нашёл
tali-puzzled.svg   сомневается
tali-point.svg     указывает
tali-cheer.svg     похвала
tali-write.svg     вписывает в атлас
```

Расход: примерно 30 кредитов.

---

## Шаг 3. Четыре панорамы регионов

**Pro Vector**, формат **3:4**, фон не прозрачный, ссылка на стиль.

```
Wide landscape illustration, flat vector cut-out style, thick dark outline
on every shape, flat fills, no gradients, no texture.
Scene: {СЦЕНА}. Calm and spacious, the lower third nearly empty.
No characters, no text, no signage.
```

| Файл | Регион | `{СЦЕНА}` |
|---|---|---|
| `region-numbers.svg` | Числовая долина, математика | `rolling stepped golden hills under a warm yellow sky, distant mountains, a few simple trees, small flowers and stones` |
| `region-words.svg` | Побережье слов, язык | `a calm seashore with rounded waves and a striped lighthouse, blue water and sky` |
| `region-nature.svg` | Живой лес, окружающий мир | `a forest of pointed conifer trees on soft green hills, a winding path` |
| `region-logic.svg` | Мастерская, логика | `a small village of cubic workshop roofs with a chimney and gears, purple and warm tones` |

**Нижняя треть обязана остаться пустой** — туда встаёт интерфейс. Если модель
заполнила её деталями, перегенерируйте: обрезать потом не получится, композиция
поедет.

Расход: примерно 65 кредитов.

---

## Шаг 4. Иконки интерфейса

Тип стиля **Icon**, прозрачный фон, квадратный формат, по одной штуке.

```
A single {ПРЕДМЕТ} icon, flat vector, thick uniform dark outline,
flat fills, centered, no background, no text.
```

Двадцать два предмета, `{ПРЕДМЕТ}` по-английски:

| Файл | `{ПРЕДМЕТ}` | Где нужна |
|---|---|---|
| `ui-trophy.svg` | trophy cup | достижения |
| `ui-medal.svg` | medal | награда |
| `ui-stars.svg` | three stars | рейтинг урока |
| `ui-heart.svg` | heart | жизни, симпатия |
| `ui-lock.svg` | padlock | закрытый узел карты |
| `ui-lightning.svg` | lightning bolt | быстрый ответ |
| `ui-gift.svg` | gift box | награда |
| `ui-book.svg` | closed book | урок |
| `ui-book-bookmark.svg` | open book with a bookmark | тема |
| `ui-backpack.svg` | backpack | снаряжение |
| `ui-check.svg` | check mark | верно |
| `ui-x.svg` | cross mark | неверно |
| `ui-bulb.svg` | light bulb | подсказка |
| `ui-map.svg` | folded map | карта региона |
| `ui-egg.svg` | egg | коллекция |
| `ui-flame.svg` | flame | серия дней |
| `ui-streak.svg` | calendar with a flame | стрик |
| `ui-meteor.svg` | meteor | бонус |
| `ui-pencil-paper.svg` | pencil and sheet of paper | задание на ввод |
| `ui-help.svg` | question mark in a circle | помощь |
| `ui-level-up.svg` | upward arrow badge | новый уровень |
| `ui-sound.svg` | speaker with sound waves | послушать ещё раз |

Расход: примерно 130 кредитов с переделками.

---

## Шаг 5. Предметы к заданиям

**Это на Nano Banana, а не на Recraft.** Их будут сотни, кредиты на них тратить
незачем, и растр там допустим.

Google AI Studio даёт до 500 картинок в день бесплатно.

```
A single {ПРЕДМЕТ} on a plain white background, flat vector cut-out style,
thick uniform dark outline, flat fills, no gradients, no texture, no shadows,
children's picture-book applique look. No text.
```

Формат квадратный, 768×768 достаточно — в приложении они выводятся размером
до 160 pt.

Что понадобится: животные, фрукты, предметы быта, школьные вещи, транспорт,
погода — по мере того как будет собираться корпус заданий.

---

## Приёмка: проверять каждый ассет

1. **Размер файла SVG.** Нейросети иногда выдают вектор с десятками тысяч точек.
   Панорама больше **300 КБ** — перегенерируйте проще или возьмите растр. Иначе
   теряется весь выигрыш по весу, ради которого выбирался вектор.
2. **Фон действительно прозрачный, а не белый.** Положите картинку на цветной фон
   и посмотрите. Это ровно та ошибка, что сейчас в приложении: 22 иконки сохранены
   без альфа-канала и лягут квадратами на любой новый фон.
3. **Внутри картинки нет текста.** Надписи приходят из локалей, иначе перевод
   невозможен.
4. **Контур одинаковой толщины** на всех ассетах. Разнотолщинность — первый признак,
   что Style Lock не сработал.
5. **Цвета из палитры.** Если модель увела оттенок — поправьте в настройках проекта
   и перегенерируйте, а не подгоняйте потом в коде.

---

## Куда класть

Готовое складывайте в `talentia-mobile/scripts/input/`, дальше запускайте импорт:

```bash
cd talentia-mobile
npm run assets:import-nano
```

Конвейер переведён на WebP и сам конвертирует и ужимает растр. Для SVG нужна
отдельная ветка — скажите, когда появятся первые файлы, добавлю.

Целевые пути в проекте:

```
assets/images/tali/       шесть поз
assets/images/regions/    четыре панорамы
assets/icons/             22 иконки
assets/images/tasks/      предметы к заданиям
```

---

## Бюджет кредитов

| Этап | Кредитов |
|---|---|
| Калибровка стиля | ~50 |
| Tali, шесть поз | ~30 |
| Четыре панорамы | ~65 |
| 22 иконки | ~130 |
| Запас на переделки | ~200 |
| **Итого** | **~475** |

Тариф Basic даёт 1000 кредитов в месяц: весь набор укладывается меньше чем
в половину. Векторная генерация стоит 2 кредита, растровая — 1.

---

## Частые проблемы

**Стиль разъезжается между ассетами.** Style Lock не применён или применён не ко
всем генерациям. Проверьте, что каждая ссылается на сохранённый стиль.

**У персонажа белый фон вместо прозрачного.** Прозрачность не включена в настройках.
Перегенерируйте: вырезать фон вручную у вектора мучительно.

**Позы Tali разного масштаба.** Лист нарезан неровно. Режьте по равным ячейкам
от краёв изображения, а не «на глаз» по фигурам.

**Панорама забита деталями снизу.** Модель проигнорировала «lower third nearly
empty». Усильте: добавьте в конец промпта `The bottom third must be empty sky or
flat ground with nothing in it.`

**SVG весит мегабайт.** Слишком сложная сцена. Упростите промпт: уберите
`distant mountains`, `small flowers and stones`, оставьте два-три плана.
