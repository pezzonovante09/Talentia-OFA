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
A cartoon dinosaur character named Tali: a friendly little T-Rex explorer,
full body, standing and waving hello. Flat vector cut-out style, thick uniform
dark outline (#2A1A12). NO gradients, NO airbrush, NO texture.

STYLE — read this first. Minimal realism in the manner of Charley Harper: the
FORM is simplified to a few clean geometric shapes, and richness comes from
DECORATIVE PATTERN laid over that form, never from anatomy. This is a toy
character for small children, not a natural history illustration.

NOT REALISTIC. Absolutely no: muscle definition, individually rendered scales,
skin texture, wrinkles, creased folds at joints, visible ribs or bone structure,
claws as weapons, rows of sharp teeth, nostril and eyebrow modelling, correct
dinosaur anatomy, menacing posture. If it could appear in a dinosaur
encyclopaedia, it is wrong.

FORM: built from big soft ovals and rounded rectangles. Oversized round head
about 40 percent of total height, short blunt rounded snout, comically tiny
short arms, plump sturdy legs like simple tubes, thick rounded tail. Toes and
fingers are soft rounded nubs, not claws. Huge round friendly eyes with a big
dark pupil and one round white highlight cut as its own shape. A wide closed
smile with at most one tiny rounded tooth showing. Kind and a little goofy.

DETAIL comes from COSTUME AND PATTERN, not from the animal:
- a decorative motif on the back and tail — a neat evenly spaced row of soft
  rounded chevrons, like a printed pattern on fabric, not like real scutes;
- a few scattered round spots on the flank, simple and evenly sized;
- large yellow goggles pushed up on the forehead, with a stitched strap,
  round rivets at the rims and a highlight arc on each lens;
- a red satchel with a flap, a row of visible stitches along the edge,
  a square buckle and a shoulder strap;
- soft rounded belly panel as a single clean shape, with NO plating or segments.

VOLUME from FLAT TONE STEPS only: each colour appears as two or three separate
solid shapes with hard edges — a light step on the lit side and a darker step on
the shadow side. Like cut paper laid on cut paper. No blending, no soft shading.

Colours: body #3FC08A with a darker green shadow side #2FA24E, cream belly
#FFE6C7, yellow goggles #FFC42E with blue lenses #0E8FBF, red satchel #D93A1E
with a yellow buckle.

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
in the manner of Charley Harper: absolutely NO gradients anywhere, but very many
overlapping flat shapes.

STYLE: minimal realism. Every object is reduced to a few clean geometric shapes,
and richness comes from DECORATIVE PATTERN laid over those shapes. This is a
stylised storybook map, NOT a realistic landscape painting. No realistic
texture, no rendered foliage, no photographic detail, no fine hatching, no
atmospheric haze, no natural irregularity — patterns are neat, evenly spaced
and deliberate, like printed paper.

DENSITY — the most important instruction. The scene is BUSY: at least forty
distinct elements. Every large shape carries smaller shapes inside it — rows of
dots, stripes, notches, scalloped edges, repeated motifs. No large area is left
as a single empty flat fill. Build the scene in five overlapping depth planes
from far to near. Density comes from repeating simple motifs, never from making
objects more realistic.

VOLUME comes from FLAT TONE STEPS, never from gradients. Each colour appears as
three separate solid shapes with hard edges between them — a light step, a mid
step and a dark step — like cut paper laid on cut paper. Lit side light, shadow
side dark. No blending, no soft edges, no airbrush, no drop shadows.

OUTLINE: every shape has a thick uniform outline in warm near-black #2A1A12.
Same weight everywhere, no thin or tapering lines, no other outline colour.

COLOURS, use only these, each in a light, mid and dark flat step: golden yellow
#F2B705 for the sky and the near hills, deeper amber #C79104 for the far hills,
green #2FA24E for trees and grass, red #D93A1E and cream #FFE6C7 for flowers,
grey-brown #8C6A03 for stones, paths and trunks.

SCENE: a sunny terraced valley. Five ridges of stepped hills overlapping into
the distance, the near ones cut into terraces with rows of furrows running along
the slope. Round trees with three concentric rings of layered foliage and a
notched trunk, standing in a scattered grove. Drystone walls built of stacked
individual pebbles. A winding path of separate stepping stones climbing from the
foreground to the far ridge. Clusters of small flowers with visible petals and
round centres. Bushes drawn as clumps of overlapping scalloped lobes. A striped
sun low over the far ridge. Warm, open, abundant.

FRAMING: the artwork covers the whole canvas edge to edge — top, bottom, left
and right. No white margin, no empty canvas. The bottom sixth is built from
fewer and larger shapes so a character can stand there and still read clearly —
but it is NOT empty and NOT a blank band. Keep the tallest shapes away from the
left and right edges.

DO NOT include: characters, animals, people, text, letters, numbers, signage,
logos, frames, borders, vignettes. DO NOT make it realistic: no photographic
texture, no painterly rendering, no soft shading, no perspective haze.
```

**`region-words.svg` — Побережье слов, язык и чтение**

```
Wide landscape illustration, 16:9 aspect ratio, flat vector cut-out style,
in the manner of Charley Harper: absolutely NO gradients anywhere, but very many
overlapping flat shapes.

STYLE: minimal realism. Every object is reduced to a few clean geometric shapes,
and richness comes from DECORATIVE PATTERN laid over those shapes. This is a
stylised storybook map, NOT a realistic landscape painting. No realistic
texture, no rendered foliage, no photographic detail, no fine hatching, no
atmospheric haze, no natural irregularity — patterns are neat, evenly spaced
and deliberate, like printed paper.

DENSITY — the most important instruction. The scene is BUSY: at least forty
distinct elements. Every large shape carries smaller shapes inside it — rows of
dots, stripes, notches, scalloped edges, repeated motifs. No large area is left
as a single empty flat fill. Build the scene in five overlapping depth planes
from far to near. Density comes from repeating simple motifs, never from making
objects more realistic.

VOLUME comes from FLAT TONE STEPS, never from gradients. Each colour appears as
three separate solid shapes with hard edges between them — a light step, a mid
step and a dark step — like cut paper laid on cut paper. Lit side light, shadow
side dark. No blending, no soft edges, no airbrush, no drop shadows.

OUTLINE: every shape has a thick uniform outline in warm near-black #2A1A12.
Same weight everywhere, no thin or tapering lines, no other outline colour.

COLOURS, use only these, each in a light, mid and dark flat step: sea blue
#0E8FBF for water and sky, deep blue #0C6E92 for the far water and cliff shadow,
red #D93A1E for the lighthouse stripes and flags, yellow #FFC42E for sand,
lamp and buoys, green #2FA24E for headland grass, cream #FFE6C7 for foam and
shells, grey-brown #8C6A03 for rock and timber.

SCENE: a bright shoreline. Five bands of sea receding to the horizon, each band
built from rows of scalloped wave crests with separate round foam dots along
their edges. A tall striped lighthouse with a banded lamp room, a railing of
individual posts and a course of bricks at its base, standing on a headland of
layered rock strata. Wooden jetty on a row of separate piles, with planks drawn
one by one. Moored sailing boats with striped hulls and pennant flags. Round
buoys on chains. Foreground sand strewn with shells, pebbles and coils of rope.

FRAMING: the artwork covers the whole canvas edge to edge — top, bottom, left
and right. No white margin, no empty canvas. The bottom sixth is built from
fewer and larger shapes so a character can stand there and still read clearly —
but it is NOT empty and NOT a blank band. Keep the tallest shapes away from the
left and right edges.

DO NOT include: characters, animals, people, text, letters, numbers, signage,
logos, frames, borders, vignettes. DO NOT make it realistic: no photographic
texture, no painterly rendering, no soft shading, no perspective haze.
```

**`region-nature.svg` — Живой лес, окружающий мир**

```
Wide landscape illustration, 16:9 aspect ratio, flat vector cut-out style,
in the manner of Charley Harper: absolutely NO gradients anywhere, but very many
overlapping flat shapes.

STYLE: minimal realism. Every object is reduced to a few clean geometric shapes,
and richness comes from DECORATIVE PATTERN laid over those shapes. This is a
stylised storybook map, NOT a realistic landscape painting. No realistic
texture, no rendered foliage, no photographic detail, no fine hatching, no
atmospheric haze, no natural irregularity — patterns are neat, evenly spaced
and deliberate, like printed paper.

DENSITY — the most important instruction. The scene is BUSY: at least forty
distinct elements. Every large shape carries smaller shapes inside it — rows of
dots, stripes, notches, scalloped edges, repeated motifs. No large area is left
as a single empty flat fill. Build the scene in five overlapping depth planes
from far to near. Density comes from repeating simple motifs, never from making
objects more realistic.

VOLUME comes from FLAT TONE STEPS, never from gradients. Each colour appears as
three separate solid shapes with hard edges between them — a light step, a mid
step and a dark step — like cut paper laid on cut paper. Lit side light, shadow
side dark. No blending, no soft edges, no airbrush, no drop shadows.

OUTLINE: every shape has a thick uniform outline in warm near-black #2A1A12.
Same weight everywhere, no thin or tapering lines, no other outline colour.

COLOURS, use only these, each in a light, mid and dark flat step: green #2FA24E
for foliage, deep green #1F7A3A for the far forest, mint #6FD6AC for lit leaves
and moss, red #D93A1E for berries and mushroom caps, cream #FFE6C7 for spots,
blossoms and mushroom stems, grey-brown #8C6A03 for trunks, branches and soil.

SCENE: a deep living forest. Five ranks of pointed conifer crowns overlapping
into the distance, each crown built from rows of separate triangular tiers.
Foreground trunks with notched bark marks and ring-shaped knots. Ferns drawn as
stems with individually cut leaflets. Clusters of round mushrooms with spotted
caps and ringed stems. Mossy fallen log with scalloped moss patches and rows of
bracket fungi. Berry bushes with separate round berries on visible stems.
Ground layer of scattered leaves, cones and small stones. Shafts of light shown
as hard-edged flat wedges, never as soft glow.

FRAMING: the artwork covers the whole canvas edge to edge — top, bottom, left
and right. No white margin, no empty canvas. The bottom sixth is built from
fewer and larger shapes so a character can stand there and still read clearly —
but it is NOT empty and NOT a blank band. Keep the tallest shapes away from the
left and right edges.

DO NOT include: characters, animals, people, text, letters, numbers, signage,
logos, frames, borders, vignettes. DO NOT make it realistic: no photographic
texture, no painterly rendering, no soft shading, no perspective haze.
```

**`region-logic.svg` — Мастерская, логика и задачи**

```
Wide landscape illustration, 16:9 aspect ratio, flat vector cut-out style,
in the manner of Charley Harper: absolutely NO gradients anywhere, but very many
overlapping flat shapes.

STYLE: minimal realism. Every object is reduced to a few clean geometric shapes,
and richness comes from DECORATIVE PATTERN laid over those shapes. This is a
stylised storybook map, NOT a realistic landscape painting. No realistic
texture, no rendered foliage, no photographic detail, no fine hatching, no
atmospheric haze, no natural irregularity — patterns are neat, evenly spaced
and deliberate, like printed paper.

DENSITY — the most important instruction. The scene is BUSY: at least forty
distinct elements. Every large shape carries smaller shapes inside it — rows of
dots, stripes, notches, scalloped edges, repeated motifs. No large area is left
as a single empty flat fill. Build the scene in five overlapping depth planes
from far to near. Density comes from repeating simple motifs, never from making
objects more realistic.

VOLUME comes from FLAT TONE STEPS, never from gradients. Each colour appears as
three separate solid shapes with hard edges between them — a light step, a mid
step and a dark step — like cut paper laid on cut paper. Lit side light, shadow
side dark. No blending, no soft edges, no airbrush, no drop shadows.

OUTLINE: every shape has a thick uniform outline in warm near-black #2A1A12.
Same weight everywhere, no thin or tapering lines, no other outline colour.

COLOURS, use only these, each in a light, mid and dark flat step: violet #9671DB
for walls and sky, deep violet #6F49B0 for the far buildings and shadow sides,
red #D93A1E for roofs and pipes, yellow #FFC42E for windows, lamps and gears,
cream #FFE6C7 for smoke, dials and paper, grey-brown #8C6A03 for timber,
crates and brickwork.

SCENE: a tidy inventor's workshop quarter. Five ranks of cubic buildings
overlapping into the distance, their walls laid in visible courses of individual
bricks and their roofs in rows of separate tiles. A tall chimney of stacked
bands with puffs of smoke drawn as clusters of hard-edged round lobes. Windows
as grids of separate panes. Exposed machinery on the walls: toothed gears with
every tooth cut out, belts, rivets in rows, jointed pipes with flanges. Stacked
crates with plank lines and corner brackets. Hanging lamps on brackets. Round
dials with tick marks. Orderly and geometric, everything built from rectangles
and circles, but packed with parts.

FRAMING: the artwork covers the whole canvas edge to edge — top, bottom, left
and right. No white margin, no empty canvas. The bottom sixth is built from
fewer and larger shapes so a character can stand there and still read clearly —
but it is NOT empty and NOT a blank band. Keep the tallest shapes away from the
left and right edges.

DO NOT include: characters, animals, people, text, letters, numbers, signage,
logos, frames, borders, vignettes. DO NOT make it realistic: no photographic
texture, no painterly rendering, no soft shading, no perspective haze.
```

**Нижняя четверть обязана остаться спокойной.** Если модель забила её деталями,
перегенерируйте: обрезать потом не выйдет, композиция поедет.

Расход: примерно 65 кредитов.

---

## Шаг 4. Иконки интерфейса

Тип стиля **Icon**, прозрачный фон, квадратный формат, ссылка на сохранённый стиль.

### Сколько их нужно

**Шесть, а не двадцать две.** Первоначальный список был перенесён из текущего
приложения не глядя, хотя оно пересобирается с нуля. Список обязан выводиться
из новых экранов, а не наследоваться от старых.

Правило: **иконка под несуществующую механику заставляет потом придумывать
механику, чтобы оправдать иконку.** Это работа задом наперёд, и в текущем
приложении она уже случилась — двенадцать форматов заданий существуют по два
экземпляра, потому что их сделали до того, как поняли зачем.

### Промпты


**`ui-check.svg`** — верный ответ, пройденный узел карты

```
A single check mark icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: green #12855A mark.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-x.svg`** — неверный ответ

```
A single cross mark icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: red #C42020 cross.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-lock.svg`** — закрытый узел карты

```
A single closed padlock icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: cream #FFE6C7 body, brown #8C6A03 shackle.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-sound.svg`** — «послушать ещё раз»

```
A single speaker with two sound waves icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: gold #FFC42E speaker, warm near-black #2A1A12 waves.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-map.svg`** — возврат на карту из урока

```
A single folded paper map icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: cream #FFE6C7 paper, green #2FA24E and blue #0E8FBF markings, red #D93A1E pin.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

**`ui-bulb.svg`** — подсказка в обычном режиме

```
A single light bulb icon, flat vector cut-out style, thick uniform outline
in warm near-black #2A1A12, completely flat fills, no gradients, no texture,
no shadows. Colours: gold #FFC42E glass, cream #FFE6C7 screw base.
Centered, filling the frame, square format.
Transparent background, no text, no letters, no frame, no border.
```

`ui-help` под вопросом: помощь в этом продукте — это Tali. Отдельная иконка
может оказаться лишней сущностью. Решается, когда соберём экран урока.

### Что отложено и почему

Не генерировать, пока не собраны экраны и не подтверждены механики.

| Иконка | Механика | Почему отложена |
|---|---|---|
| `ui-stars` | звёзды урока | рисуются кодом: `StarsRow` — SVG с двумя силуэтами, заполненным и пунктирным |
| `ui-heart` | жизни | механики нет и не будет: «жизни» — наказание за ошибку, а в системе записано, что наказательных механик нет |
| `ui-lightning`, `ui-meteor` | быстрый ответ, бонус | поощрение за скорость противоречит ABA-режиму и вообще детям, которым нужно время подумать |
| `ui-trophy`, `ui-medal`, `ui-level-up` | достижения | экран достижений в новой структуре не подтверждён |
| `ui-flame`, `ui-streak` | серия дней | не решено, переносим ли стрик; для пятилетки «ты пропустил день» — сомнительная мотивация |
| `ui-gift`, `ui-egg` | коллекция | коллекция стала атласом, его страницы — иллюстрации находок, а не иконки |
| `ui-backpack` | снаряжение | механики нет |
| `ui-book`, `ui-book-bookmark` | урок, тема | на карте узлы, а не книжки |
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
| 6 иконок | ~40 |
| Запас на переделки | ~200 |
| **Итого** | **~415** |

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
