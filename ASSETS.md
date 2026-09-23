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

**Pro Vector**, формат **16:9 ландшафтный**, фон не прозрачный, ссылка на стиль.

### Почему ландшафт, а не вертикаль

Панорама не заполняет экран целиком. Она встаёт в два горизонтальных места:

- **полоса региона в шапке урока** — примерно 390×286, то есть широкая лента;
- **карта региона** — горизонтальная лента, которая прокручивается вбок.

Вектор тянется без потерь, но **композиция не тянется**: вертикальную сцену в широкой
полосе придётся обрезать сверху и снизу, и от неё останется середина. Обратное работает —
из широкой панорамы полоса вырезается свободно.

### Безопасные зоны

Выведены из вёрстки экрана, не из общих соображений:

- **нижняя четверть спокойная** — там стоит Tali и висит его реплика;
- **важное не у самых краёв** — телефоны разной ширины обрежут бока по-разному;
- смысловой центр сцены держите в средней трети по горизонтали.

### Промпты: по одному на регион

Каждый самодостаточный. Копируйте целиком, ничего не подставляя.

Почему не шаблон с подстановкой: первая панорама вышла с сине-чёрным контуром
`#050042` вместо тёплого `#2A1A12`, на треть белой и мимо палитры во всех пяти
цветах. Общая настройка проекта не удержала ни один. Поэтому палитра и контур
перечисляются в каждом промпте поимённо, а заполнение кадра требуется дважды
разными словами.

**`region-numbers.svg` — Числовая долина, математика**

```
Wide landscape illustration, 16:9 aspect ratio, flat vector cut-out style,
children's picture-book applique look.

OUTLINE: every shape has a thick uniform outline in warm near-black #2A1A12.
Same weight everywhere, no thin or tapering lines, no other outline colour.

FILLS: completely flat solid colour. NO gradients, NO texture, NO shading,
NO drop shadows.

COLOURS, use only these: golden yellow #F2B705 for the sky and the hills,
deeper amber #C79104 for the far hills, green #2FA24E for trees,
red #D93A1E and cream #FFE6C7 for small flowers, grey-brown #8C6A03 for stones.

SCENE: rolling stepped golden hills in three overlapping layers, a few simple
round trees on the middle ridge, small flowers and stones scattered on the
slopes. Warm, open, sunny.

FRAMING: the artwork covers the whole canvas edge to edge — top, bottom, left
and right. There is no white margin and no empty canvas anywhere. The bottom
quarter is calm flat ground belonging to the scene, with nothing
placed on it. Keep the main shapes away from the left and right edges.

DO NOT include: characters, animals, people, text, letters, numbers,
signage, logos, frames, borders, vignettes.
```

**`region-words.svg` — Побережье слов, язык и чтение**

```
Wide landscape illustration, 16:9 aspect ratio, flat vector cut-out style,
children's picture-book applique look.

OUTLINE: every shape has a thick uniform outline in warm near-black #2A1A12.
Same weight everywhere, no thin or tapering lines, no other outline colour.

FILLS: completely flat solid colour. NO gradients, NO texture, NO shading,
NO drop shadows.

COLOURS, use only these: blue #0E8FBF for the sky and the sea, deeper blue
#0C6E92 for the far water, cream #FFE6C7 for the sand and the lighthouse body,
red #D93A1E for the lighthouse stripes, yellow #FFC42E for its lamp,
green #2FA24E for a few coastal bushes.

SCENE: a calm shore with rounded overlapping waves, a striped lighthouse
standing on a low rocky point to one side, a sandy beach in front, a few small
bushes. Wide horizon, peaceful.

FRAMING: the artwork covers the whole canvas edge to edge — top, bottom, left
and right. There is no white margin and no empty canvas anywhere. The bottom
quarter is calm flat sand belonging to the scene, with nothing
placed on it. Keep the lighthouse away from the left and right edges.

DO NOT include: characters, animals, people, boats, text, letters, numbers,
signage, logos, frames, borders, vignettes.
```

**`region-nature.svg` — Живой лес, окружающий мир**

```
Wide landscape illustration, 16:9 aspect ratio, flat vector cut-out style,
children's picture-book applique look.

OUTLINE: every shape has a thick uniform outline in warm near-black #2A1A12.
Same weight everywhere, no thin or tapering lines, no other outline colour.

FILLS: completely flat solid colour. NO gradients, NO texture, NO shading,
NO drop shadows.

COLOURS, use only these: green #2FA24E for the trees and hills, deeper green
#1F7A3A for the far forest, light green #6FD6AC for the near meadow, cream
#FFE6C7 for the winding path, red #D93A1E for a few berries, brown #8C6A03
for the tree trunks.

SCENE: rows of pointed conifer trees on soft rolling hills, a winding cream
path leading between them, low bushes with small berries, a calm clearing in
front. Layered depth, three planes.

FRAMING: the artwork covers the whole canvas edge to edge — top, bottom, left
and right. There is no white margin and no empty canvas anywhere. The bottom
quarter is calm flat meadow belonging to the scene, with nothing
placed on it. Keep the tallest trees away from the left and right edges.

DO NOT include: characters, animals, people, text, letters, numbers,
signage, logos, frames, borders, vignettes.
```

**`region-logic.svg` — Мастерская, логика и задачи**

```
Wide landscape illustration, 16:9 aspect ratio, flat vector cut-out style,
children's picture-book applique look.

OUTLINE: every shape has a thick uniform outline in warm near-black #2A1A12.
Same weight everywhere, no thin or tapering lines, no other outline colour.

FILLS: completely flat solid colour. NO gradients, NO texture, NO shading,
NO drop shadows.

COLOURS, use only these: purple #9671DB for the sky and the distant hills,
deeper purple #6F49B0 for the far buildings, cream #FFE6C7 for the walls,
red #D93A1E for the roofs, yellow #FFC42E for the lit windows and the gears,
brown #8C6A03 for the chimney.

SCENE: a small village of cubic workshop buildings with pitched roofs, one
tall chimney, a few large gear wheels mounted on the walls, low hills behind.
Orderly and geometric, everything built from simple rectangles and circles.

FRAMING: the artwork covers the whole canvas edge to edge — top, bottom, left
and right. There is no white margin and no empty canvas anywhere. The bottom
quarter is calm flat ground belonging to the scene, with nothing
placed on it. Keep the buildings away from the left and right edges.

DO NOT include: characters, animals, people, text, letters, numbers,
signage, logos, frames, borders, vignettes.
```

**Нижняя четверть обязана остаться спокойной.** Если модель забила её деталями,
перегенерируйте: обрезать потом не выйдет, композиция поедет.

Расход: примерно 65 кредитов.

---

## Шаг 4. Иконки интерфейса

Тип стиля **Icon**, прозрачный фон, квадратный формат, по одной штуке.

### Промпты: по одному на иконку

Тип стиля **Icon**, прозрачный фон, квадратный формат, ссылка на сохранённый стиль.
Каждый самодостаточный — копируется целиком.

**`ui-trophy.svg`** — достижения

```
A single trophy cup icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: gold #FFC42E cup, cream #FFE6C7 base.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-medal.svg`** — награда

```
A single medal on a ribbon icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: gold #FFC42E disc, red #D93A1E ribbon.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-stars.svg`** — рейтинг урока

```
A single three five-pointed stars icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: gold #FFC42E stars.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-heart.svg`** — жизни

```
A single heart icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: red #D93A1E heart, cream #FFE6C7 highlight.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-lock.svg`** — закрытый узел

```
A single closed padlock icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: cream #FFE6C7 body, brown #8C6A03 shackle.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-lightning.svg`** — быстрый ответ

```
A single lightning bolt icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: gold #FFC42E bolt.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-gift.svg`** — награда

```
A single gift box with a bow icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: red #D93A1E box, gold #FFC42E ribbon and bow.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-book.svg`** — урок

```
A single closed book icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: blue #0E8FBF cover, cream #FFE6C7 pages.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-book-bookmark.svg`** — тема

```
A single open book with a bookmark icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: green #2FA24E cover, cream #FFE6C7 pages, red #D93A1E bookmark.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-backpack.svg`** — снаряжение

```
A single backpack icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: red #D93A1E body, gold #FFC42E buckles, cream #FFE6C7 front pocket.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-check.svg`** — верно

```
A single check mark icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: green #12855A mark.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-x.svg`** — неверно

```
A single cross mark icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: red #C42020 cross.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-bulb.svg`** — подсказка

```
A single light bulb icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: gold #FFC42E glass, cream #FFE6C7 screw base.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-map.svg`** — карта региона

```
A single folded paper map icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: cream #FFE6C7 paper, green #2FA24E and blue #0E8FBF markings, red #D93A1E pin.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-egg.svg`** — коллекция

```
A single speckled egg icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: cream #FFE6C7 shell, blue #0E8FBF speckles.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-flame.svg`** — серия дней

```
A single flame icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: red #D93A1E outer flame, gold #FFC42E inner flame.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-streak.svg`** — стрик

```
A single calendar page with a small flame on it icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: cream #FFE6C7 calendar, red #D93A1E flame, blue #0E8FBF header bar.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-meteor.svg`** — бонус

```
A single meteor with a trail icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: brown #8C6A03 rock, gold #FFC42E trail.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-pencil-paper.svg`** — ввод ответа

```
A single pencil lying on a sheet of paper icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: gold #FFC42E pencil, cream #FFE6C7 paper.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-help.svg`** — помощь

```
A single question mark inside a circle icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: purple #5A34C4 circle, cream #FFE6C7 question mark.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-level-up.svg`** — новый уровень

```
A single badge with an upward arrow icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: green #12855A badge, cream #FFE6C7 arrow.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-sound.svg`** — послушать ещё раз

```
A single speaker with two sound waves icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: gold #FFC42E speaker, warm near-black #2A1A12 waves.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```


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

**Панорама забита деталями снизу.** Модель проигнорировала требование. Усильте:
`The bottom quarter must be completely empty flat ground with nothing in it.`

**Панорама вышла вертикальной.** Проверьте формат: нужен 16:9 ландшафтный. Вертикальную
сцену в горизонтальную полосу не перекомпоновать — только перегенерировать.

**SVG весит мегабайт.** Слишком сложная сцена. Упростите промпт: уберите
`distant mountains`, `small flowers and stones`, оставьте два-три плана.
