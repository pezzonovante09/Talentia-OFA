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

### Кто такой Tali

**Тираннозавр-исследователь.** Не абстрактный динозавр: силуэт ти-рекса узнаётся
залитым в чёрный за долю секунды, и это первое требование к запоминаемому
персонажу.

**Крошечные ручки — главная черта, и она не декоративная.** Ти-рекс физически
не дотягивается, не удерживает, не может сосчитать на пальцах — их два. Поэтому
ему нужен ребёнок. Концепция «ребёнок помогает Tali» перестаёт быть сценарной
условностью и становится свойством тела персонажа.

Три правила запоминаемости, по убыванию важности:

1. **Силуэт.** Залейте фигуру чёрным — должна узнаваться. Большая голова,
   мелкие ручки, тяжёлый хвост дают это сразу.
2. **Один крючок.** Черта, которую называют первой. Здесь — ручки. Гогглы
   вторичны.
3. **Преувеличенные пропорции.** Голова 35–40% роста. Реалистичные пропорции
   у детского персонажа всегда читаются скучно.

### Почему не листом из шести поз

Лист 1024 px делит кадр на шесть, каждой позе достаётся около 340 px — персонаж
выходит мелким по построению.

**Генерируйте по одной позе на кадр.** Сначала главная поза крупно и до идеала,
затем она становится **образцом-изображением** для остальных пяти: Recraft V4.1
принимает картинку на вход, и персонаж держится от неё надёжнее, чем от текста.

### Поза 1: эталон

Формат **1:1**, прозрачный фон, ссылка на сохранённый стиль.

```
A cartoon Tyrannosaurus Rex explorer, full body, standing and waving hello.
Flat vector cut-out style, thick uniform dark outline (#2A1A12), completely
flat fills with NO gradients and NO texture, children's picture-book applique
look.

Proportions: oversized head about 40 percent of total height, comically tiny
short arms, sturdy legs, heavy tail for balance. Friendly rounded snout, one
small tooth showing, big round eyes, no menace.

Colours: body #3FC08A with a darker green shadow side #2FA24E, cream belly
#FFE6C7, large yellow goggles #FFC42E with blue lenses #0E8FBF worn pushed up
on the forehead, red satchel #D93A1E with a yellow buckle.

The character FILLS THE ENTIRE FRAME: head touches the top edge, feet touch the
bottom edge, tail reaches the side. Tight crop, no empty margins.
Transparent background, no ground shadow, no text.
```

Доводите эту позу, пока не понравится всё: пропорции, морда, толщина контура.
**Остальные пять наследуют её, поэтому на эталон кредитов не жалейте.**

### Позы 2–6: от образца

Для каждой — та же генерация, но **с эталоном на входе как image reference**,
и меняется только описание позы:

| Файл | Поза | Что писать вместо `standing and waving hello` |
|---|---|---|
| `tali-hello.svg` | приветствие | это и есть эталон |
| `tali-found.svg` | нашёл | `holding up a rolled map in both tiny arms, excited, leaning forward` |
| `tali-puzzled.svg` | сомневается | `head tilted, one tiny arm scratching the chin, puzzled` |
| `tali-point.svg` | указывает | `goggles pulled down over the eyes, one tiny arm pointing to the side` |
| `tali-cheer.svg` | похвала | `jumping with joy, both tiny arms up, tail lifted` |
| `tali-write.svg` | вписывает | `leaning over an open atlas, holding a pencil in one tiny arm` |

В каждой повторяйте абзац про заполнение кадра — модель о нём забывает.

### Требования к набору

От них зависит, соберётся ли анимация:

1. **Одинаковый размер кадра** у всех шести.
2. **Одинаковое положение и масштаб персонажа** внутри кадра. Если на одной позе
   Tali по центру, а на другой смещён — при переключении он прыгает.
3. **Голова одного размера** во всех позах.

Проверка: положите шесть файлов друг на друга в редакторе. Голова и ноги должны
совпасть.

### Проверка силуэта

Залейте готовую фигуру сплошным чёрным и уменьшите до 24 px. Если не узнаётся —
пропорции недостаточно преувеличены: увеличивайте голову и уменьшайте ручки.

Расход: примерно 60 кредитов — эталон дороже, остальные дешевле.

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
| Tali: эталон плюс пять поз | ~60 |
| Четыре панорамы | ~65 |
| 22 иконки | ~130 |
| Запас на переделки | ~200 |
| **Итого** | **~505** |

Тариф Basic даёт 1000 кредитов в месяц: весь набор укладывается меньше чем
в половину. Векторная генерация стоит 2 кредита, растровая — 1.

---

## Частые проблемы

**Стиль разъезжается между ассетами.** Style Lock не применён или применён не ко
всем генерациям. Проверьте, что каждая ссылается на сохранённый стиль.

**У персонажа белый фон вместо прозрачного.** Прозрачность не включена в настройках.
Перегенерируйте: вырезать фон вручную у вектора мучительно.

**Позы Tali разного масштаба.** Забыт абзац про заполнение кадра, или поза сделана
без эталона на входе. Перегенерируйте с image reference и явным требованием, что
голова касается верхнего края.

**Персонаж выходит мелким.** Модель оставляет поля по привычке. Усильте: `The character
fills 100 percent of the frame height, head touching the top edge, cropped tight.`

**Панорама забита деталями снизу.** Модель проигнорировала «lower third nearly
empty». Усильте: добавьте в конец промпта `The bottom third must be empty sky or
flat ground with nothing in it.`

**SVG весит мегабайт.** Слишком сложная сцена. Упростите промпт: уберите
`distant mountains`, `small flowers and stones`, оставьте два-три плана.
