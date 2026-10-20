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
#9671DB   Мастерская
#E36A93   Кыргызский язык
#12855A   верно
```

Это цвета **иллюстраций**. Цвета интерфейса (текст, ошибка, чернила) берутся только из
`talentia-mobile/src/design/tokens.ts`, в ассеты не зашиваются: иконки интерфейса —
одноцветные (шаг 4).

### Модели

| Что генерируем | Модель | Тип стиля |
|---|---|---|
| Пробный кадр, Tali, иконки | **Recraft V4.1 Vector** | Vector illustration |
| Пять панорам | **Recraft V4.1 Pro Vector** | Vector illustration |
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

## Главное правило: плотность — это узор, а не анатомия

Две крайности, в которые эти промпты уже успели свалиться, и обе одинаково плохи.

**Первая партия вышла пустой.** В промпте стояло «NO shading», «a few simple round
trees» и «нижняя четверть кадра пустая» — панорамы получились по 22–60 фигур, на
экране это читается как залитая форма. Я тогда приравнял плоскую аппликацию к малому
числу фигур, а это разные вещи.

**Вторая вышла реалистичной.** Исправляя первую, я добавил Tali щитки вдоль спины,
пластины живота, когти, складки на сгибах, ноздрю и надбровную дугу. Плотность
появилась — но щитки и надбровная дуга на тираннозавре и есть настоящий тираннозавр.
Плотность набиралась анатомией.

Верное правило между ними:

> **Форма остаётся простой и мультяшной. Богатство даёт узор поверх формы.**

Так работает Чарли Харпер, и он сам называл это «минимальным реализмом»: зверь сведён
к нескольким чистым геометрическим формам, а сцена насыщена повторяющимися мотивами —
рядами точек, полосами, насечками, чешуёй-орнаментом. Эрика Карла из ориентиров
убрал: у него коллаж из крашеной бумаги, и он тянет в фактурность, то есть в реализм.

Но у персонажа есть рычаг сильнее орнамента — **пропорции**. Мультяшность даёт
не большая голова, а маленькое тело: голова в половину роста, туловище заметно
меньше головы, ноги короткими тумбами, глаза каждый в треть ширины головы с
белком и двумя бликами, морда отдельной накладкой другого цвета, румянец
овалами. Пока сложение обычное, сколько ни навешивай узора, выйдет динозавр —
просто головастый.

Практическая проверка для Tali: **если персонаж мог бы попасть в энциклопедию
динозавров — промпт неверен.** Правильный Tali собран из больших мягких овалов,
пальцы у него скруглённые подушечки, а не когти, зубов не больше одного и тот
тупой. Детализацию несут очки с заклёпками, сумка со строчкой и пряжкой, ровный
ряд шевронов вдоль спины как печатный узор на ткани — то есть костюм и орнамент,
а не животное.

Для панорам то же самое: пять планов и сорок элементов набираются повторением
простых мотивов, а не приближением к фотографии. Никакой дымки, мазков, мягких
теней и природной нерегулярности — узор ровный и намеренный, как на печатной бумаге.

---

## Шаг 2. Tali, семь поз

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
3. **Преувеличенные пропорции.** Голова 45–50% роста (в промпте эталона — «половина»; прежние
   «35–40%» давали головастого динозавра, а не чиби, и спорили с кропом ниже). Реалистичные
   пропорции у детского персонажа всегда читаются скучно.

### Почему не листом из семи поз

Лист 1024 px делит кадр на семь, каждой позе достаётся около 340 px — персонаж
выходит мелким по построению.

**Генерируйте по одной позе на кадр.** Сначала главная поза крупно и до идеала,
затем она становится **образцом-изображением** для остальных шести: Recraft V4.1
принимает картинку на вход, и персонаж держится от неё надёжнее, чем от текста.

### Поза 1: эталон

Формат **1:1**, прозрачный фон, ссылка на сохранённый стиль.

```
A cute cartoon dinosaur mascot named Tali: a friendly baby T-Rex, full body,
standing and waving hello. Chibi proportions, clean flat vector sticker art.

STYLE: flat vector cartoon, like a modern children's sticker or a mascot logo.
Crisp solid shapes with hard edges. NO gradients, NO airbrush, NO soft glow,
NO glossy highlights, NO texture, NO rendering.

PROPORTIONS — chibi. This is what makes it read as a cartoon, get it right first:
- the head is HALF the total height, a big round ball;
- the body is small and plump and clearly SMALLER than the head;
- legs are short stubby tubes, feet are small rounded blobs;
- arms are tiny and short, hands are small rounded mitts;
- the tail is short, thick, and curls slightly upward;
- the whole silhouette is a soft egg: wide at the head, narrow at the feet.

FACE — the main source of cuteness:
- two enormous round eyes, each about one third of the head width, set wide
  apart and low on the face;
- each eye has a white sclera, a large dark iris filling most of it, and TWO
  round white highlight dots, one big and one small;
- a separate rounded muzzle shape in a contrasting colour laid over the lower
  face, like a wide soft heart;
- a big open happy smile inside the muzzle, with a small pink tongue and
  exactly two tiny rounded teeth pointing down;
- two soft oval blush patches on the cheeks;
- two tiny nostril dots;
- no eyebrows, no eyelids, no brow ridge, no nose bridge, no cheekbones.

DECORATION — flat motifs only, nothing anatomical:
- a row of small rounded triangular spikes along the top of the head and down
  the back and tail, in a contrasting colour, evenly spaced and all alike;
- a cream belly panel as one clean rounded shape with three or four gentle
  curved lines across it;
- a scattering of plain round spots on the head, back and tail;
- small cream oval toe-nubs on each foot.

NOT REALISTIC. Absolutely no: muscle definition, rendered scales, skin texture,
wrinkles, folds at joints, visible ribs, sharp claws, rows of sharp teeth, long
jaw, heavy brow, correct dinosaur anatomy, menacing posture. If it could appear
in a dinosaur encyclopaedia it is wrong. It should look like a plush toy.

OUTLINE: a thick dark outline in #2A1A12 around the whole silhouette, and
thinner lines of the same colour for the shapes inside it. Rounded ends,
no tapering, no sketchy strokes.

VOLUME: where a shape needs depth, use exactly two flat steps of the same
colour with a hard edge between them. No blending, no soft shading.

COLOURS: body green #3FC08A with darker green #2FA24E for the spots and the
shadow step, cream #FFE6C7 for the belly panel and toe-nubs, yellow #FFC42E
for the muzzle and the spikes, red #D93A1E for the tongue and the blush.

ACCESSORIES, small and simple, they must not break up the silhouette: round
yellow goggles pushed up on the forehead, and a small red satchel on a strap
across the chest.

The character FILLS THE FRAME: head near the top edge, feet near the bottom
edge. Tight crop, very small margins. Transparent background, no ground
shadow, no text, no watermark.
```

Доводите эту позу, пока не понравится всё: пропорции, морда, толщина контура.
**Остальные пять наследуют её, поэтому на эталон кредитов не жалейте.**

**Если есть под рукой картинка с нужными пропорциями — грузите её образцом,
а не описывайте словами.** Recraft V4.1 принимает изображение на вход, и чиби-
пропорции держатся от образца несравнимо надёжнее, чем от текста: «голова в
половину роста» модель понимает как угодно, картинку — однозначно. Образец
задаёт сложение и посадку головы, а стиль всё равно придёт из Style Lock,
поэтому градиенты и залаченный блеск с образца не перетекут.

### Позы 2–7: от образца

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
| `tali-idle.svg` | спокоен | `standing calmly and relaxed, both tiny arms resting down at the sides, mouth closed in a soft small smile, eyes looking up and to the right, goggles pushed up on the forehead` |

В каждой повторяйте абзац про заполнение кадра — модель о нём забывает.

### Требования к набору

От них зависит, соберётся ли анимация:

1. **Одинаковый размер кадра** у всех семи.
2. **Одинаковое положение и масштаб персонажа** внутри кадра. Если на одной позе
   Tali по центру, а на другой смещён — при переключении он прыгает.
3. **Голова одного размера** во всех позах.
4. **Два именованных слоя в каждом из семи файлов** (раунд 4) — без них код не сделает
   нейтральный отклик на тап (`taliIdleTap`: моргнуть и повернуть голову, ход ≤ 4 pt, SCREENS.md 5):
   - `<g id="head">` — вся голова с глазами, гогглами, ртом и контуром головы; шея в группу не
     входит. Код поворачивает и сдвигает **только эту группу** (ход ≤ 4 pt, точка вращения — низ
     головы над шеей), поэтому под краем головы не должно быть «дыры»: тело рисуется целиком,
     голова лежит поверх. Внутри группы — без `transform`, координаты абсолютные;
   - `<g id="eyes-closed">` — закрытые глаза (две дуги контуром 3, цвет `#2A1A12`) **внутри
     `#head`**, по умолчанию `display="none"`; открытые глаза — соседняя группа `<g id="eyes-open">`.
     Моргание — переключение видимости групп кодом, без морфинга путей. В позе `point` (гогглы на
     глазах) `#eyes-closed` тоже есть, но лежит под гогглами — моргание там не видно, это допустимо.
   Генератор слоёв не делает: после Recraft группы расставляются руками в редакторе (Figma /
   Inkscape) — `id` ровно такие, регистр важен. Проверка: в каждом файле есть `#head`,
   `#eyes-open`, `#eyes-closed`; `#eyes-closed` вложен в `#head`; при скрытии `#head` на кадре
   остаётся тело без дыр.

Проверка: положите семь файлов друг на друга в редакторе. Голова и ноги должны
совпасть.

### Проверка силуэта

Залейте готовую фигуру сплошным чёрным и уменьшите до 24 px. Если не узнаётся —
пропорции недостаточно преувеличены: увеличивайте голову и уменьшайте ручки.

### Единый кроп `taliCrop`: числа и приёмка

Везде, где Tali меньше полного роста (нижняя панель урока, слой выхода, «нет перевода»,
подкрепление и перерыв ABA, DESIGN_PROMPTS.md блок 0), — один прямоугольник в долях квадратного
кадра позы, слот **88×88**. Значения в коде — `taliCrop` (`src/design/tokens.ts`):

| Поле | Значение | Смысл |
|---|---|---|
| `x`, `w` | 0.06, 0.88 | поле 6% слева и справа, центр кадра |
| `y`, `h` | 0, 0.88 | от верха кадра: голова касается верха, поэтому кроп не отступает; низ обрезает ноги, пояс внутри |
| голова в кропе | 0.5 / 0.88 ≈ 57% | норма 55–60% высоты кропа |
| масштаб показа | 88 / (0.88 × кадр) | у позы 1024 — 0.0977 pt на единицу viewBox |

Значения **стартовые** — выведены из пропорций ТЗ, не измерены на готовых файлах. Приёмка: наложить
прямоугольник на каждую из семи поз; внутри обязаны быть голова целиком, лапа `point`, поднятые лапы
`cheer`, свиток `found`, карандаш и атлас `write`; голова при повороте на 4 pt (`taliIdleTap`) не
выходит за край слота. Не входит — править **файл позы**, а не заводить второй кроп. Если измерение
даёт голову вне 55–60% — менять `h` и `x` вместе (`x = (1 − w) / 2`), тест `tokens.test.ts` проверит
соотношение.

**Рассогласование кадров, найденное при проверке:** `tali-hello.svg` имеет `viewBox="0 0 2048 2048"`,
остальные шесть — `0 0 1024 1024`. Доли от этого не зависят, но «одинаковый размер кадра» из
требований к набору нарушен: при следующей генерации hello выпустить в 1024 или нормализовать
`viewBox`, и проверить наложением, что содержимое стоит в тех же долях.

### Какая поза где (использование)

Завязка 1.3 — `found` или `puzzled`; ожидание — `idle`; подсказка и показ — `point`; верно — `cheer`;
первая ошибка — `puzzled`; сигнал «посмотри сюда» — `hello`. **`write` — только** после верного
последнего задания и на странице атласа (1.5): в завязке и в ходе задания Tali ничего не вписывает.

### Tali в тёмной схеме

Tali **не перекрашивается и без ореола**: слой иллюстрации, одни цвета в обеих схемах и в calm
(`taliArt` в `tokens.ts`). Тёмный наружный контур `#2A1A12` на тёмных нейтральных поверхностях
границы не несёт (1.09:1 к `#1B1410`), но и не должен: силуэт держит заливка тела `#3FC08A` —
**7.90:1** к `background` `#1B1410` и **6.85:1** к `surface` `#2A211B`; хвост и пятна `#2FA24E` — 5.54:1,
сумка `#D93A1E` — 3.96:1 / 3.44:1, жёлтое и кремовое — 9.9 и выше. На заливке региона тёмной обычной
карты (`#8C6A03`, `#0C78A0`, `#25803E`, `#8255D4`, `#AC4F6E`) наоборот: заливка тела там 2.15–2.62:1, а
границу несёт контур — **3.27–3.38:1**. Правила: (1) Tali стоит только на `background`, `surface`
и заливках региона тёмной обычной; на тёмной calm-карте это песок `background`; (2) на `surfaceAlt`
(`#372B23`) сумка даёт 2.99:1 — допустимо, это аксессуар: в тёмной схеме сумка не различает позы
и не делается нажимаемой (`taliSatchelRule`); (3) проверка силуэта на тёмном —
чёрная заливка (шаг выше) **и** контрольный кадр «заливка тела без контура на `#1B1410` при 24 px»:
узнаётся по голове и хвосту; (4) отдельных «ночных» файлов поз нет. Контрасты посчитаны по WCAG 2.1
(`contrast.ts`), пары проверяет `tokens.test.ts`.

Расход: примерно 60 кредитов — эталон дороже, остальные дешевле.

---

## Шаг 3. Пять панорам регионов

Четыре готовы (`numbers`, `words`, `nature`, `workshop`), пятой — кыргызской — нет; её ТЗ
в конце шага. Имена регионов — `RegionId` из `types/task.ts`; `logic` больше не
существует (А25).

**Pro Vector**, формат **3:2 ландшафтный** (`viewBox="0 0 1264 848"`, как у четырёх готовых;
прежние «16:9» были ошибкой — V19), фон не прозрачный, ссылка на стиль.

### Почему ландшафт, а не вертикаль

Панорама не заполняет экран целиком. Она встаёт в два места (на экране урока панорамы нет:
там цвет региона только в safe area — SCREENS.md 1.1):

- **фон завязки урока** — под карточкой по центру, на весь экран 390×844 (DESIGN_PROMPTS.md 1.3);
- **карта региона** — горизонтальная лента, которая прокручивается вбок; на ней 64 pt сверху
  занимает заголовок карты (см. «Верхняя зона» ниже).

Вектор тянется без потерь, но **композиция не тянется**: вертикальную сцену в широкой
полосе придётся обрезать сверху и снизу, и от неё останется середина. Обратное работает —
из широкой панорамы полоса вырезается свободно.

### Безопасные зоны

Выведены из вёрстки экрана, не из общих соображений:

- **нижняя четверть спокойная** — там стоит Tali и висит его реплика;
- **важное не у самых краёв** — телефоны разной ширины обрежут бока по-разному;
- смысловой центр сцены держите в средней трети по горизонтали;
- **верхняя зона без деталей — `y` от 0 до 128 в единицах viewBox** (Г7; раунд 4: зона задаётся
  в единицах файла, а не в pt — художник работает в viewBox, и «64 pt» в нём ничего не значат).
  На экране это полоса заголовка карты `mapLayout.titleZone` 64 pt плюс верхняя safe area.
  Пересчёт: панорама масштабируется по высоте контейнера карты `H` (pt), единица viewBox = `H / 848`
  pt, зона = `(safeTop + 64) × 848 / H` единиц. Самые невыгодные экраны: 393×852 (safe area 59) —
  (59 + 64) × 848 / 852 ≈ 122; 360×640 (24) — ≈ 117; 375×812 (50) — ≈ 119; SE 375×667 (20) — ≈ 107.
  Округлено вверх до **128** с запасом; если карта кладёт панораму ниже safe area, зона ещё меньше
  (64 × 848 / H ≤ 91) и 128 тем более хватает. Под зоной — заголовок (ориентир и название, цвет
  `#2A1A12` в светлой схеме). В зоне — ровная заливка одного цвета из палитры региона, без облаков,
  солнца, птиц, пиков, узора и штриховки; **цвет заливки зоны к `#2A1A12` — не ниже 4.5:1**
  (проверка: растр полосы `y` 0–128 файла, самый светлый пиксель против `#2A1A12`). Линия горизонта
  и любой пик остаются ниже `y = 128` — у кыргызской панорамы это условие для зубчатых пиков. Если
  готовая панорама условия не выполняет — не перерисовывать, а закрыть зону в коде полосой
  safe area + 64 pt заливкой `regions.<id>` (`mapLayout.titleZone` — в pt, это размер на экране).

### Промпты: по одному на регион

Промпты короткие: перечисление фигур («круг с точкой в центре», «ряды простых
кругов») генератор понимает буквально и складывает сцену из перечисленного,
отчего она выглядит собранной в пэинте. Модель умеет рисовать пейзаж, ей надо
сказать, ЧТО на нём, а не КАК его строить.

Но три вещи сказать обязательно, иначе картинка выходит сырой:

1. **Контур толстый.** Без явного «BOLD THICK, never thin or delicate» модель
   рисует тонкую ровную линию флэт-иллюстрации, и панорама оказывается из
   другого набора, чем персонаж с его жирной обводкой.
2. **Планы различаются цветом.** Без явного требования модель заливает небо и
   все холмы одним цветом: в первой пробе `#FEB422` занял 28.7% кадра — небо и
   вся земля разом, отделённые только ниточкой контура. Глубина обязана идти
   цветом, потому что светотень нам запрещена стилем персонажа.
3. **Разнообразие вместо повтора.** Модель охотно клонирует один тюльпан
   пятнадцать раз. «Several different kinds and sizes» это снимает.

### Главное: образец важнее слов

Слова «в стиле милого мультяшного маскота» модель толкует как угодно.
**Грузите финального Tali образцом-изображением и пересоберите на нём Style
Lock.** Именно оттуда переносятся толщина контура, насыщенность заливок и
скруглённость форм — то, что текстом передаётся хуже всего. Панорамы,
собранные на Style Lock от персонажа, сходятся с ним без подгонки.

**`region-numbers.svg` — Числовая долина, математика**

```
A rich, detailed cartoon landscape of a sunny valley: rolling hills, leafy
trees, a winding stone path, drystone walls, round bushes, meadows of flowers
and a little stream.

Style: BOLD THICK dark outlines #2A1A12 — heavy confident linework, the same
chunky weight as a kawaii vinyl sticker, never thin or delicate. Flat vivid
colours, soft rounded forms. Polished professional vector illustration,
generously detailed and lovingly finished, warm and inviting.

DEPTH THROUGH COLOUR, never through shading: the sky, the far ground, the
middle ground and the near ground must EACH be a different colour from the
palette. Never use one colour for both the sky and the land. Every layer is
clearly separated by having its own colour, not by a line.

VARIETY: many different kinds of tree, bush and flower, in several different
greens and several different sizes — never one shape repeated over and over.

Palette: golden yellow #F2B705, amber #C79104, brown #8C6A03, green #2FA24E,
deep green #1F7A3A, red #D93A1E, cream #FFE6C7. The foreground is a band of
deep shadowed earth #534723 where a character will stand.

No gradients, no airbrush, no texture, no glossy highlights.
Wide 3:2 landscape, full bleed to every edge. Horizon in the upper third.
No characters, no animals, no people, no text, no frame.
```

**`region-words.svg` — Побережье слов, язык и чтение**

```
A rich, detailed cartoon seaside: a striped lighthouse on a grassy headland,
rolling waves, a wooden jetty, sailing boats with flags, buoys, rocks and
shells along the shore.

Style: BOLD THICK dark outlines #2A1A12 — heavy confident linework, the same
chunky weight as a kawaii vinyl sticker, never thin or delicate. Flat vivid
colours, soft rounded forms. Polished professional vector illustration,
generously detailed and lovingly finished, warm and inviting.

DEPTH THROUGH COLOUR, never through shading: the sky, the far ground, the
middle ground and the near ground must EACH be a different colour from the
palette. Never use one colour for both the sky and the land. Every layer is
clearly separated by having its own colour, not by a line.

VARIETY: many different kinds of boat, rock, shell and plant, in several
different sizes — never one shape repeated over and over.

Palette: sea blue #0E8FBF, deep blue #0C6E92, green #2FA24E, deep green
#1F7A3A, yellow #FFC42E, red #D93A1E, brown #8C6A03, cream #FFE6C7. The
foreground is a band of deep shadowed wet shore #274F5D where a character
will stand.

No gradients, no airbrush, no texture, no glossy highlights.
Wide 3:2 landscape, full bleed to every edge. Horizon in the upper third.
No characters, no animals, no people, no text, no frame.
```

**`region-nature.svg` — Живой лес, окружающий мир**

```
A rich, detailed cartoon forest: tall pine trees, broad leafy trees, ferns,
clusters of spotted mushrooms, berry bushes and a mossy fallen log.

Style: BOLD THICK dark outlines #2A1A12 — heavy confident linework, the same
chunky weight as a kawaii vinyl sticker, never thin or delicate. Flat vivid
colours, soft rounded forms. Polished professional vector illustration,
generously detailed and lovingly finished, warm and inviting.

DEPTH THROUGH COLOUR, never through shading: the sky, the far ground, the
middle ground and the near ground must EACH be a different colour from the
palette. Never use one colour for both the sky and the land. Every layer is
clearly separated by having its own colour, not by a line.

VARIETY: many different kinds of tree, fern, mushroom and berry, in several
different greens and several different sizes — never one shape repeated over
and over.

IMPORTANT: keep every green deep and rich. No mint, pale or pastel green
anywhere — a bright mint-green cartoon character will stand in front of this
forest and must not disappear into it.

Palette: green #2FA24E, deep green #1F7A3A, brown #8C6A03, red #D93A1E,
yellow #FFC42E, cream #FFE6C7. The foreground is a band of deep shadowed
forest floor #235330 where a character will stand.

No gradients, no airbrush, no texture, no glossy highlights.
Wide 3:2 landscape, full bleed to every edge. Horizon in the upper third.
No characters, no animals, no people, no text, no frame.
```

**`region-workshop.svg` — Мастерская (`workshop`), английский** (до 2026-10-10 — `region-logic.svg`, решение №82)

Файл назван по прежнему id; в реестре он уже стоит под ключом `workshop`. Переименовать в
`region-workshop.svg` — вместе с правкой `REGION_PANORAMAS` и `registry.test.ts`
(SCREENS.md, открытый вопрос 11). Промпт ниже не меняется.

```
A rich, detailed cartoon workshop village: cosy cubic houses with tiled roofs,
a tall smoking chimney, big friendly gears and pipes on the walls, hanging
lamps, workbenches and stacked crates in the yard.

Style: BOLD THICK dark outlines #2A1A12 — heavy confident linework, the same
chunky weight as a kawaii vinyl sticker, never thin or delicate. Flat vivid
colours, soft rounded forms. Polished professional vector illustration,
generously detailed and lovingly finished, warm and inviting.

DEPTH THROUGH COLOUR, never through shading: the sky, the far ground, the
middle ground and the near ground must EACH be a different colour from the
palette. Never use one colour for both the sky and the land. Every layer is
clearly separated by having its own colour, not by a line.

VARIETY: many different kinds of house, gear, pipe, lamp and crate, in several
different sizes — never one shape repeated over and over.

Palette: violet #9671DB, deep violet #6F49B0, red #D93A1E, yellow #FFC42E,
brown #8C6A03, cream #FFE6C7. The foreground is a band of deep shadowed paving
#3A2560 where a character will stand.

No gradients, no airbrush, no texture, no glossy highlights.
Wide 3:2 landscape, full bleed to every edge. Horizon in the upper third.
No characters, no animals, no people, no text, no frame.
```

**`region-kyrgyz.svg` — Кыргызский язык (`kyrgyz`)** — ТЗ, шаг 6

| Параметр | Требование |
|---|---|
| Файл | `talentia-mobile/assets/images/regions/region-kyrgyz.svg`, вектор, `viewBox="0 0 1264 848"` — как у четырёх готовых (≈ 3:2), фон непрозрачный, ≤ 300 КБ, от 250 путей узора |
| Сцена | горная долина-жайлоо: зубчатые снежные пики на горизонте, луговые террасы, горная речка, одна-две юрты с войлочным узором, арча (можжевельник) — **не** ели и кроны (это Живой лес) |
| Силуэт горизонта | острые снежные пики — главный отличительный признак против холмов, волны, крон и крыш; ориентир региона — юрта (купол с решёткой) |
| Тон | малиновый `#E36A93` доминирует, как жёлтый в Числовой долине и фиолетовый в Мастерской: розовый свет на снегу на рассвете. Палитра: `#E36A93`, глубокий малиновый `#964460`, светло-розовый `#F6C3D3`, снег `#FFFFFF`, крем `#FFE6C7`, красный узор `#D93A1E`, жёлтый `#FFC42E` — точечно; зелёного не больше одного-двух мелких пятен (иначе спор с Живым лесом); ближний план — тёмная полоса `#4A2033` |
| Контур | `#2A1A12`, толстый, как у остальных панорам и у Tali; глубина — только сменой цвета планов, без светотени |
| Поля | нижняя четверть спокойная (там Tali и реплика); смысловой центр — юрта — в средней трети по горизонтали; значимое не ближе 5% к левому и правому краю; горизонт в верхней трети |
| Нельзя | флаг, герб, солнце-тюндюк как государственный символ, культовые здания, надписи и буквы (в том числе в орнаменте), люди, животные, персонажи; этнические сравнения (CURRICULUM.md, С3) |
| Проверка | обесцветить кадр рядом с четырьмя готовыми: регион узнаётся по пикам и юрте без цвета; в calm он же сводится к ориентиру «юрта» иконкой 32 — силуэт иконки совпадает с юртой панорамы; сцену смотрит носитель (орнамент, юрта, жайлоо) |

```
A rich, detailed cartoon mountain valley in Kyrgyzstan at sunrise: jagged
snow-capped peaks along the horizon glowing pink, terraced alpine meadows, a
winding mountain stream with round stones, juniper bushes, and one or two
round felt yurts with bold geometric felt-rug patterns on their walls.

Style: BOLD THICK dark outlines #2A1A12 — heavy confident linework, the same
chunky weight as a kawaii vinyl sticker, never thin or delicate. Flat vivid
colours, soft rounded forms. Polished professional vector illustration,
generously detailed and lovingly finished, warm and inviting.

DEPTH THROUGH COLOUR, never through shading: the sky, the far ground, the
middle ground and the near ground must EACH be a different colour from the
palette. Never use one colour for both the sky and the land. Every layer is
clearly separated by having its own colour, not by a line.

VARIETY: many different kinds of peak, rock, bush and felt pattern, in several
different sizes — never one shape repeated over and over. No pine or spruce
trees, almost no green.

Palette: raspberry pink #E36A93, deep raspberry #964460, pale pink #F6C3D3,
snow white #FFFFFF, cream #FFE6C7, red #D93A1E, a little yellow #FFC42E. The
foreground is a band of deep shadowed plum earth #4A2033 where a character will
stand.

No gradients, no airbrush, no texture, no glossy highlights.
Wide 3:2 landscape, full bleed to every edge. Horizon in the upper third.
No flags, no emblems, no religious buildings, no letters or writing anywhere,
no characters, no animals, no people, no text, no frame.
```

Когда файл готов: импорт `RegionKyrgyz` и строка `kyrgyz: RegionKyrgyz` в
`REGION_PANORAMAS` (`src/assets/registry.ts`), снять `PANORAMA_PENDING` в
`__tests__/registry.test.ts`. До этого экран рисует плоскую заливку `regions.kyrgyz` с
силуэтом пиков и подписью.

**Нижняя четверть обязана остаться спокойной.** Если модель забила её деталями,
перегенерируйте: обрезать потом не выйдет, композиция поедет.

Расход: примерно 65 кредитов.

### Контур горизонта и ориентир для тёмной карты (№89, Г7)

Тёмная карта — без панорамы (`mapBackdrop` = `flat_region`): сплошная заливка региона, **контур
горизонта той же панорамы на той же высоте** и ориентир ≥ 64 pt на том же месте, что в
светлой. Для этого нужны два набора по пять файлов (регионы `numbers`, `words`, `nature`,
`workshop`, `kyrgyz`). Горизонт и ориентир **кыргызского региона** рисуются **вместе с
недостающей панорамой** — одним заходом, чтобы линия пиков в светлой и в тёмной схеме совпала
точка в точку.

**`horizon-<region>.svg` ×5** — `assets/images/regions/horizon-<region>.svg`:

| Параметр | Требование |
|---|---|
| viewBox | **равен viewBox панорамы** региона (`0 0 1264 848`): координаты те же, масштабируется вместе с картой |
| Содержимое | **один `<path>`**, открытый, от `x = 0` до `x = 1264`; **без заливки** (`fill="none"`); `stroke` в файле не задан или `currentColor` — **контур задаёт код**: цвет `colors.outline`, толщина `mapLayout.horizonStroke` 3, `stroke-linejoin="round"`, `stroke-linecap="round"`, `vector-effect="non-scaling-stroke"` |
| Что обводит | верхнюю границу ближайших к небу форм той же панорамы: холмы-ступени, волну и маяк, кроны, крыши и трубу, зубчатые пики; **на той же высоте**, горизонт в верхней трети (`y` ≤ 283), не выше `y = 128` в единицах viewBox (верхняя зона без деталей, шаг 3) |
| Различимость | в ч/б пять контуров узнаются без цвета и без ориентира: ступени, волна, острые кроны, ломаная кубов, пики; перепад линии по высоте не меньше 24 |
| Нельзя | замкнутые фигуры, заливка, второй путь, группы с трансформациями, текст, градиенты, более 400 узлов пути |
| Проверка | наложить на `region-<region>.svg` (для кыргызского — на новую панораму): линия совпадает с краем форм ≤ 4 единиц; вес файла ≤ 8 КБ |

**`landmark-<region>.svg` ×5** — `assets/images/regions/landmark-<region>.svg`:

| Параметр | Требование |
|---|---|
| Сетка | **64×64** (`viewBox="0 0 64 64"`), поле 4; контур **3** (`stroke-width="3"`, скруглённые концы и углы), как у иконок шага 4 |
| Цвет | `currentColor` — заливка и контур одним цветом глифа, как у всех иконок; код красит его `colors.outline`, а подложку-фон ориентира (`colors.surface` в тёмной схеме) кладёт отдельной фигурой под файлом. Многоцветный ориентир запрещён |
| Силуэт | тот же, что у `ui-region-<region>.svg` 32 (холм-ступень, маяк, ель, шестерёнка, юрта) и у ориентира в панораме; не уменьшенная копия панорамы, а упрощённый знак: ≤ 12 путей |
| Координаты | на карте ориентир стоит **на том же месте, что нарисован в панораме**; центр ориентира в единицах viewBox панорамы записывается в `LANDMARK_AT` реестра (`src/assets/registry.ts`): `{ x, y }` для каждого региона. Правила: все числа — в единицах viewBox панорамы: x в средней трети (421–843), y центра ≥ 128 + 48 = 176 (ориентир целиком под верхней зоной; 48 — половина ориентира 64 pt при самом мелком масштабе `H` 568: 32 × 848 / 568 ≈ 48) и не ниже горизонта на более чем 160, не на пути тропы (тропу задаёт карта) |
| Проверка | в ч/б при 64 и при 32 (calm, полоса) узнаётся; на заливке региона тёмной схемы контур `#FFF3E3` ≥ 4.5:1 (`outline` на `regions.*`) |

В calm ориентир показывается иконкой 32 в полосе-заголовке (`mapLayout.landmarkCalmStrip`), а не
этим файлом: рисованной панорамы в calm нет, ориентиру негде стоять на карте (V22).
Реестр: `REGION_HORIZONS` и `REGION_LANDMARKS` по образцу `REGION_PANORAMAS`, тест в
`registry.test.ts` — по файлу на каждый `RegionId`, один путь в горизонте, `viewBox`
панорамы. Файлов пока нет: реестр не заводится, пока они не появились.

Расход: горизонты рисуются по готовым панорамам — около 10 кредитов на пять (вектор, ссылка
на панораму как образец); ориентиры — около 10; кыргызский горизонт входит в ~20 кредитов
панорамы.

---

## Шаг 4. Иконки интерфейса

Тип стиля **Icon**, прозрачный фон, квадратный формат, ссылка на сохранённый стиль.

### Сколько их нужно

**Столько, сколько требуют собранные экраны** — после спецификации урока, карты, атласа
и ABA (шаг 6) это шесть готовых плюс список ниже. Первоначальные двадцать две были
перенесены из прежнего приложения не глядя. Список обязан выводиться из новых экранов,
а не наследоваться от старых.

Правило: **иконка под несуществующую механику заставляет потом придумывать
механику, чтобы оправдать иконку.** Это работа задом наперёд, и в текущем
приложении она уже случилась — двенадцать форматов заданий существуют по два
экземпляра, потому что их сделали до того, как поняли зачем.

### Правило: одноцветные (шаг 6, А16)

Первые шесть иконок сгенерированы многоцветными (жёлтый динамик, зелёная галочка, цветная
карта). Так нельзя: в тёмной теме тёмные детали пропадают, а в ABA жёлтый динамик
становится четвёртым цветом экрана пробы (AUDIT.md, блокеры 21 и 25). Правило для всех
иконок интерфейса:

- **ровно два цвета в файле**: заливка глифа `currentColor` и контур `#2A1A12`; сборка
  подменяет `#2A1A12` на `colors.outline` (svgr `replaceAttrValues`), `currentColor` берёт
  цвет места (`text`, `onPrimary`, `primaryInk`, `ink` в ABA). Линейные детали (волны,
  шеврон) — штрих `currentColor`;
- **сетка 32**, контур 3, скруглённые концы; при 24 (ненажимаемые значки) контур тот же,
  деталей меньше;
- одна иконка — один смысл; состояние меняет силуэт, а не прозрачность.

Генерация — в Recraft одним цветом, затем в редакторе заливка → `currentColor`:

```
A single {ПРЕДМЕТ} icon, flat vector cut-out style, ONE solid fill colour only
(pure black #000000) and a thick uniform outline in #2A1A12, rounded line ends,
no second colour, no details in other colours, no gradients, no texture, no
shadows. Simple bold silhouette readable at 24 px.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**Перерисовать по правилу** (файлы есть, цвет зашит): `ui-check.svg`, `ui-x.svg`,
`ui-lock.svg`, `ui-sound.svg`, `ui-map.svg`. `ui-bulb.svg` на экранах не используется
(подсказку даёт Tali) — удалить вместе со строкой реестра или оставить до решения;
`ui-help` не делать по той же причине.

**Нарисовать** (SCREENS.md, 9; DESIGN_PROMPTS.md, «Иконки — одно правило»):

| Файл | Предмет для промпта | Где |
|---|---|---|
| `ui-star.svg` | five-pointed star with rounded points | атлас с 7 лет, «сам» |
| `ui-star-helped.svg` | the same star with a cut-out in the centre shaped like Tali's three-toed paw print (the paw is a hole, background shows through) | атлас, «с помощью» — **вырез-лапа**, не круглое окошко (DESIGN_PROMPTS.md 1.6): круг читается как «пустая / недорисованная звезда», лапа — «вместе с Tali». Вырез — сквозной (`fill-rule="evenodd"`), площадь лапы 25–35% звезды, чтобы при 24 pt силуэт звезды держался; лапа та же, что на печати `ui-stamp-open.svg`. Проверка: при 24 pt в ч/б «сам» и «с помощью» различимы |
| `ui-stamp-open.svg` | round stamp with a zigzag edge and a three-toed dinosaur footprint inside | атлас 5–6, «открыто» |
| `ui-token.svg` | rounded square with a star inside | ABA, доска и подкрепление |
| `ui-chevron.svg` | open V-shaped chevron pointing down, outline only | ABA, подсказка L1 |
| `ui-triangle.svg` | solid triangle pointing down | «показан», ABA L2–L3 |
| `ui-pin.svg` | push pin with a round head | «закреплён», маркер `point` |
| `ui-arrow.svg` | thick arrow pointing right | «Дальше», «Занято», открытый узел |
| `ui-backspace.svg` | tag-shaped key with a cross inside | клавиатура 4×3 |
| `ui-book.svg` | open book | «Остаться», «к атласу» |
| `ui-waves.svg` | three sound arcs, outline only | звучит реплика |
| `ui-sound-on.svg` | speaker with three sound arcs | повтор, пока звучит |
| `ui-sliders.svg` | three horizontal lines, each with a round knob at a different position | карта: кнопка детского листа «Звук и спокойствие» 60×60 (иконка 32; раунд 5, `mapSettingsButton`). Не динамик: динамик значит «повтори» |
| `ui-note.svg` | single eighth music note, solid head and flag | детский лист: переключатель «Звук» — музыка и эффекты (`childSoundToggle`); голос Tali он не глушит, поэтому не динамик |
| `ui-sleep.svg` | crescent moon | узел «спит» |
| `ui-review.svg` | two arrows chasing each other in a circle | узел «повторение» |
| `ui-socket.svg`, `ui-circle.svg`, `ui-square.svg`, `ui-triangle-shape.svg`, `ui-rhombus.svg` | empty ring; plain shapes | пары и группы |
| `ui-region-numbers/words/nature/workshop/kyrgyz.svg` | stepped hill; lighthouse; spruce; gear; yurt | ориентир региона: calm, атлас, шапка карты |
| `ui-pause-bars.svg` | two vertical rounded bars (pause), solid | ABA: карточка «перерыв» 64×64 (иконка 32), экран перерыва (иконка 120 в кольце, 2.4), «Tali предлагает перерыв» (64 на карточке 120). Не знак «стоп», не рука |
| `ui-pause-bars-outline.svg` | the same two bars, outline only, no fill | ABA: значок кнопки «Вернуться» 32 (`abaBreak.returnIcon`, «перерыв» кончился — планки опустели) |
| `ui-finger-ring.svg` | a fingertip inside a ring, outline | ABA: тихая подсказка «держите» у кнопки выхода (`abaControls.exitTapHint`, 1.2 с, статично); строка `finger_ring` в `ICONS`, пока её нет, `tokenIcons.test.ts` держит «известный пропуск» |

Размеры в таблице — для штриха: во всех иконках набора заливка `currentColor`, контур `#2A1A12`
3 pt, скруглённые концы; «перерыв» на карточке — одноцветная, без подписи.

Каждый новый файл — строка в `ICONS` (`src/assets/registry.ts`): тест реестра не пустит
файл, которого там нет.

### Что отложено и почему

Не генерировать, пока не собраны экраны и не подтверждены механики.

| Иконка | Механика | Почему отложена |
|---|---|---|
| ~~`ui-stars`~~ | звёзды урока | **снято**: по №7 пустых слотов нет, нужны две звезды «сам» / «с помощью» — `ui-star.svg`, `ui-star-helped.svg` выше |
| `ui-heart` | жизни | механики нет и не будет: «жизни» — наказание за ошибку, а в системе записано, что наказательных механик нет |
| `ui-lightning`, `ui-meteor` | быстрый ответ, бонус | поощрение за скорость противоречит ABA-режиму и вообще детям, которым нужно время подумать |
| `ui-trophy`, `ui-medal`, `ui-level-up` | достижения | экран достижений в новой структуре не подтверждён |
| `ui-flame`, `ui-streak` | серия дней | не решено, переносим ли стрик; для пятилетки «ты пропустил день» — сомнительная мотивация |
| `ui-gift`, `ui-egg` | коллекция | коллекция стала атласом, его страницы — иллюстрации находок, а не иконки |
| `ui-backpack` | снаряжение | механики нет |
| `ui-book-bookmark` | урок, тема | на карте узлы, а не книжки (`ui-book` нужен — «Остаться» и «к атласу», см. выше) |
| `ui-pencil-paper` | задание на ввод | тип задания виден по самому заданию, метка не нужна |

Расход: примерно 40 кредитов вместо 130.

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

## Шаг 7. Иконка приложения и заставка

Сейчас в `talentia-mobile/assets/images/` лежат **файлы шаблона Expo** (голубая сетка с градиентной
«галкой», серая сетка на белом): вне палитры и с градиентом, которого в направлении нет. Конфиг
`app.json` уже в палитре (`backgroundColor` `#FFF3E3`, тёмная заставка `#1B1410`, фоновая картинка
adaptive-иконки убрана — она перекрывала цвет); не хватает самих картинок. Рисуются по эталону Tali
(`tali-hello.svg`, ссылка на Style Lock), без текста и без градиентов, контур `#2A1A12`.

| Файл | Размер, формат | Содержимое и поля |
|---|---|---|
| `icon.png` (iOS, стор) | 1024×1024 PNG, **без альфа-канала и без скруглений** (скругляет система) | сплошной фон `#FFF3E3`; Tali — голова и плечи (в границах `taliCrop`, голова ≈ 60% высоты картинки), взгляд вправо-вверх, гогглы на лбу, лёгкая улыбка; всё значимое внутри центральных 80% (поле 10%). Контраст контура к фону 15.28:1, заливка тела к фону 2.10:1 — силуэт держит контур 3 pt, не уменьшать его |
| `android-icon-foreground.png` | 1024×1024 PNG с альфой, фон прозрачный | тот же Tali, **внутри круга диаметром 66% (≈ 676 px)** по центру: так маска любой формы (круг, «белка», квадрат) не режет голову. Фон задаёт `adaptiveIcon.backgroundColor` `#FFF3E3`, `android-icon-background.png` **не нужен** и из репозитория убирается |
| `android-icon-monochrome.png` | 1024×1024 PNG с альфой | силуэт Tali **одним цветом** (чёрный, альфа 100%) в тех же 66%; глаза и морда вырезаны просветами толщиной не меньше 12 px; без полутонов — система красит его сама |
| `splash-icon.png` | 1024×1024 PNG с альфой, показывается шириной 200 pt (`imageWidth`) | Tali в позе `hello` (или `idle`) целиком, прозрачный фон, поля 12%. Одна картинка на светлую и тёмную заставку: Tali не перекрашивается, на `#1B1410` его держит заливка тела (7.90:1), на `#FFF3E3` — контур. Ни ореола, ни тени, ни надписи «Talentia» (название — подпись приложения под значком) |
| `favicon.png` | 48×48 PNG | только голова на `#FFF3E3`; веб в v1 не выпускается — низкий приоритет |

Приёмка: (1) в ч/б при 48 px узнаётся голова с гогглами; (2) значок рядом с иконками трёх соседних
детских приложений на светлом и тёмном экране — не сливается с обоями ни там, ни там (на тёмной
подложке iOS берётся тот же `icon.png`: светлый фон заметен сам); (3) нет градиентов, теней, текста;
(4) цвета — только из палитры шага 0. Расход — около 10 кредитов.

---

## Приёмка: проверять каждый ассет

1. **Плотность.** Главная проверка, и раньше её тут не было. Считайте фигуры:

   ```bash
   grep -o '<path' файл.svg | wc -l
   ```

   Первая партия дала **22–60 путей на панораму** — это силуэт, а не иллюстрация,
   и на экране читается как залитая форма. Ориентир: **панорама от 250 путей,
   поза Tali от 150**. Меньше — сцена выйдет пустой, сколько бы её ни перекрашивали.

   Но плотность считается **только узором**. Если фигуры набежали за счёт анатомии —
   щитков, складок, когтей, прорисованной чешуи — счётчик зелёный, а ассет негодный.
   Форма простая и мультяшная, богатство даёт орнамент поверх неё; подробно об этом
   в разделе «Плотность — это узор, а не анатомия». Объём набирается **ступенями
   тона**: один цвет лежит двумя-тремя отдельными заливками — светлой, средней и
   тёмной, с жёсткой границей между ними.

2. **Размер файла SVG.** Обратная граница к плотности. Нейросети иногда выдают
   вектор с десятками тысяч точек. Панорама больше **300 КБ** — перегенерируйте
   проще. Между 250 путями и 300 КБ есть широкий коридор, в него и целимся.
3. **Фон действительно прозрачный, а не белый.** Положите картинку на цветной фон
   и посмотрите. Это ровно та ошибка, что сейчас в приложении: 22 иконки сохранены
   без альфа-канала и лягут квадратами на любой новый фон.
4. **Внутри картинки нет текста.** Надписи приходят из локалей, иначе перевод
   невозможен.
5. **Контур одинаковой толщины** на всех ассетах. Разнотолщинность — первый признак,
   что Style Lock не сработал.
6. **Цвета из палитры.** Если модель увела оттенок — поправьте в настройках проекта
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
assets/images/tali/       семь поз (кроп для урока — прямоугольником, не файлами)
assets/images/regions/    пять панорам (кыргызская — по ТЗ шага 3), horizon-<region>.svg ×5,
                          landmark-<region>.svg ×5 (ТЗ — «Контур горизонта и ориентир», шаг 3)
assets/icons/             одноцветные иконки по списку шага 4
assets/images/            icon.png, android-icon-foreground.png, android-icon-monochrome.png,
                          splash-icon.png, favicon.png — по шагу 7 (шаблон Expo заменить)
assets/images/tasks/      предметы к заданиям
```

---

## Бюджет кредитов

| Этап | Кредитов |
|---|---|
| Калибровка стиля | ~50 |
| Tali: эталон плюс шесть поз | ~60 |
| Четыре панорамы | ~65 |
| Кыргызская панорама | ~20 |
| 6 иконок (первая партия) | ~40 |
| Перерисовка 5 иконок в один цвет и ~30 новых | ~70 |
| Контуры горизонтов ×5 и ориентиры ×5 (шаг 3; кыргызский горизонт входит в панораму) | ~20 |
| Иконка приложения и заставка (шаг 7) | ~10 |
| Запас на переделки | ~200 |
| **Итого** | **~535** |

Тариф Basic даёт 1000 кредитов в месяц: весь набор укладывается примерно в
половину. Векторная генерация стоит 2 кредита, растровая — 1.

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

**Панорама вышла вертикальной.** Проверьте формат: нужен 3:2 ландшафтный. Вертикальную
сцену в горизонтальную полосу не перекомпоновать — только перегенерировать.

**SVG весит мегабайт.** Слишком сложная сцена. Упростите промпт: уберите
`distant mountains`, `small flowers and stones`, оставьте два-три плана.
