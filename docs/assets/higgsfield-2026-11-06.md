# Партия: все недостающие ассеты через Higgsfield (2026-11-06)

Скилл `asset-pipeline`. Кредитов Recraft нет, есть Higgsfield Plus (950 кредитов на 2026-11-06). В каталоге
Higgsfield есть **Recraft V4.1** (режим `vector`, палитра до 10 цветов, фон цветом, **без образца-картинки**),
**Ideogram Vector** (SVG из промпта или векторизация готовой картинки), **GPT Image 2.6** (PNG с прозрачным фоном,
принимает образцы), **Nano Banana Pro** (растр с образцами, безлимит), **Image Background Remover**.

Правила приёмки прежние: ASSETS.md «Приёмка», `npm run assets:check -- scripts/input`. Готовые файлы — в
`talentia-mobile/scripts/input/`, имена — как в таблицах ниже.

**Готовые промпты на каждый файл** (52 штуки, кнопка «Копировать», переключатель основного и запасного пути) —
`higgsfield-prompts-2026-11-06.html` рядом. Шаблоны ниже — справочно; копировать с той страницы.

**Итог теста `ui-check` 2026-11-06:** Higgsfield отдаёт настоящий SVG (путь через Recraft V4.1 `vector` рабочий), но
в файле были: белая подложка путём, `viewBox 0 0 2048 2048`, `preserveAspectRatio="none"`, блок `<metadata>` C2PA
на 18 КБ из 20, цвета в записи `rgb()` и контур `#241C1B` вместо `#2A1A12`; сам контур вышел втрое тоньше нормы и
каллиграфическим. Промпты иконок дополнены строками про равномерный толстый штрих; `assets:check` теперь ловит
`rgb()`-цвета, подложку путём, `<metadata>` и `preserveAspectRatio="none"`. Цвета стимулов ABA на странице
уточнены под палитру из 10 цветов (серого нет) и разведены по полям пробы `match-level1.ts`.

**Образцы для загрузки** (PNG, уже отрисованы из наших SVG): `docs/assets/ref/tali-hello-1024.png`,
`tali-idle-1024.png`, `region-numbers-1264.png`, `region-words-1264.png`, `region-nature-1264.png`,
`region-workshop-1264.png`. Их принимают GPT Image 2.6, Nano Banana Pro и Ideogram Vector (`vectorize`);
Recraft V4.1 на Higgsfield образцов не принимает, его держит только палитра и текст.

## 0. Сначала тест — одна генерация

До партии: `ui-token` в Recraft V4.1 `vector` по промпту из раздела 1. Проверить, что скачивается **файл `.svg`**
(а не PNG), что в нём нет `<image>` и градиентов (`npm run assets:check`), и что контур держит толщину.
Если Higgsfield отдаёт только PNG — вся векторная часть идёт по запасному пути: Nano Banana Pro → Ideogram
Vector `vectorize` (`mode: simple` для иконок, `default` для стимулов и панорамы).

## 1. Иконки интерфейса — 19 файлов

**Модель:** Recraft V4.1 · `model_type: vector` · 1:1 · 1k · `colors: ["#000000", "#2A1A12"]` ·
`background_color: "#FFFFFF"`. После скачивания: удалить фон-прямоугольник, заливку `#000000` заменить на
`currentColor`, `viewBox` привести к `0 0 32 32` (`ui-*`). Запасной путь: GPT Image 2.6 · `output_format: svg` ·
`background: transparent` · тот же промпт.

Шаблон (подставить предмет из таблицы):

```
A single {ПРЕДМЕТ} icon, flat vector cut-out style, ONE solid fill colour only
(pure black #000000) and a thick uniform outline in #2A1A12, rounded line ends,
no second colour, no details in other colours, no gradients, no texture, no
shadows. Simple bold silhouette readable at 24 px.
Centered, filling the frame, square format.
Plain white background, no text, no letters, no frame, no border.
```

| Файл | {ПРЕДМЕТ} | Статус |
|---|---|---|
| `ui-check.svg` (перерисовать) | bold check mark | ждём |
| `ui-x.svg` (перерисовать) | bold X cross with rounded ends | ждём |
| `ui-lock.svg` (перерисовать) | closed padlock | ждём |
| `ui-sound.svg` (перерисовать) | loudspeaker, no sound waves | ждём |
| `ui-map.svg` (перерисовать) | folded map with one route line, solid | ждём |
| `ui-star.svg` | five-pointed star with rounded points | ждём |
| `ui-star-helped.svg` | five-pointed star with rounded points with a cut-out hole in the centre shaped like a three-toed dinosaur paw print, the hole shows the background through (hole is 25–35 % of the star) | ждём |
| `ui-token.svg` | rounded square with a five-pointed star inside | ждём |
| `ui-chevron.svg` | open V-shaped chevron pointing down, outline stroke only, no fill | ждём |
| `ui-backspace.svg` | tag-shaped backspace key with a small cross inside | ждём |
| `ui-note.svg` | single eighth music note, solid head and flag | ждём |
| `ui-sleep.svg` | crescent moon | ждём |
| `ui-region-words.svg` | lighthouse | ждём |
| `ui-region-nature.svg` | spruce tree | ждём |
| `ui-region-workshop.svg` | cog gear | ждём |
| `ui-region-kyrgyz.svg` | round felt yurt with a domed roof | ждём |
| `ui-pause-bars.svg` | two vertical rounded bars (pause sign), solid | ждём |
| `ui-pause-bars-outline.svg` | two vertical rounded bars (pause sign), outline stroke only, no fill | ждём |
| `ui-finger-ring.svg` | a fingertip inside a ring, outline stroke only | ждём |

`ui-star-helped`: после векторизации вырез должен быть сквозным (`fill-rule="evenodd"`), не белой заплаткой.
Проверка: при 24 pt в ч/б «сам» и «с помощью» различимы.

## 2. Ориентиры тёмной карты — 4 файла

**Модель:** та же, что у иконок (Recraft V4.1 `vector`, `colors: ["#000000", "#2A1A12"]`, белый фон).
После: `viewBox="0 0 64 64"`, поле 4, `stroke-width="3"`, ≤ 12 путей, заливка `currentColor`. Силуэт — тот же,
что у `ui-region-*` 32: можно сделать одну генерацию на регион и из неё оба файла, упростив 32-ю версию.
Центр ориентира на панораме записать в `LANDMARK_AT` реестра (ASSETS.md, «Контур горизонта и ориентир»).

| Файл | {ПРЕДМЕТ} | Статус |
|---|---|---|
| `landmark-words.svg` | lighthouse with a round lamp room, same silhouette as the lighthouse in the words panorama | ждём |
| `landmark-nature.svg` | spruce tree, three tiers of branches | ждём |
| `landmark-workshop.svg` | cog gear with eight rounded teeth | ждём |
| `landmark-kyrgyz.svg` | round felt yurt with a domed roof and a lattice band | ждём |

Горизонты `horizon-words/nature/workshop/kyrgyz.svg` **не генерируются**: один открытый путь обводится по панораме
в редакторе (ТЗ там же).

## 3. Стимулы ABA `match` — 24 файла

**Модель:** Recraft V4.1 · `model_type: vector` · 1:1 · 1k · `background_color: "#FFFFFF"` ·
`colors` (ровно 10):

```
#2A1A12 #3FC08A #2FA24E #0E8FBF #D93A1E #5A34C4 #9671DB #E36A93 #FFE6C7 #FFFFFF
```

Промпт = начало из `docs/assets/aba-match-stimuli.md` + общий хвост (там же), последнюю строку хвоста заменить:
`plain white background` вместо `no background`. После скачивания убрать фон-прямоугольник. Только SVG — растр на
экране пробы запрещён.

**Запасной путь, если Recraft через Higgsfield не даёт SVG или уводит стиль:** Nano Banana Pro · 1:1 · 1k ·
образец `tali-hello-1024.png` · промпт тот же с припиской `in exactly the same drawing style, outline weight and
colour palette as the reference character`; затем Ideogram Vector · `operation: vectorize` · `mode: default` ·
`batch_size: 1`. Затем `assets:check`: цвета могут уйти от палитры на 1–2 единицы — такое перегенерировать, а не
править в коде (скилл, «Чего не делать»).

Список 24 файлов и начала промптов — в `aba-match-stimuli.md`, статусы ведутся там.

## 4. Панорамы регионов — 5 файлов

**Решение владельца 2026-11-06:** кыргызская панорама из Higgsfield (Recraft V4.1 `vector`, 3:2, 2k, промпт со
страницы) принята как эталон набора — 498 путей против 85–214 у старых; четыре прежние панорамы
(`numbers`, `words`, `nature`, `workshop`) перерисовываются по той же структуре промпта. Образец для сравнения —
`ref/region-kyrgyz-higgsfield-1264.png`.

**Модель:** Recraft V4.1 · `model_type: vector` · 3:2 · **2k** · `colors` — у каждого региона свои (палитры шага 3
ASSETS.md плюс `#2A1A12`), на странице копируются кнопкой. Промпты — только на странице; от ASSETS.md шаг 3 они
отличаются тремя вещами: ориентир региона назван и поставлен в среднюю треть (ступенчатый холм, маяк, ель, труба,
юрта), силуэт горизонта назван прямо, добавлена строка «верхние 15 % — пустое небо» (в кыргызской пики залезли в зону
заголовка карты `y ≤ 128`).

**Что показал кыргызский файл и что делается при приёмке:** `viewBox 0 0 2560 1664` (не 3:2 — масштаб по высоте и
срез по 20 единиц с боков до `1264×848`), 503 КБ (после `svgo --multipass -p 1` ≈ 195 КБ — укладывается в 300),
четыре мелких градиента на камнях (заменяются первым цветом стопа), контуры чёрные `rgb(0,0,0)` (→ `#2A1A12`, иначе
сборка не перекрасит их в `colors.outline`), ~35 цветов вне палитры промпта — для панорам это допускалось и раньше
(старые четыре тоже не проходят проверку палитры), оценивается глазами. Поля красно-оранжевые, а не розовые,
как просил промпт, — принято владельцем.

**Итог 2026-11-06 (№179):** все пять панорам приняты и лежат в `assets/images/regions/`; вес Мира чисел (618 КБ) и маяк
у правого края у Побережья слов приняты владельцем как есть. Девять контурных иконок и ориентиров перегенерируются по
карточкам со строкой «solid filled silhouette».

**Последствия перерисовки Мира чисел:** `horizon-numbers.svg` и `landmark-numbers.svg` привязаны к старой панораме
(контур совпадает с её формами точка в точку, центр ориентира — в `LANDMARK_AT`); после новой панорамы горизонт
обводится заново и центр меряется заново. Остальные горизонты и ориентиры ещё не рисовались, им ничего не ломается.

**Запасной путь (стиль не сошёлся с кыргызской):** Nano Banana Pro · 3:2 · 2k · образец
`ref/region-kyrgyz-higgsfield-1264.png` · промпт с приставкой про образец (переключатель на странице); затем Ideogram
Vector `vectorize`, `mode: default`. Если после векторизации файл > 300 КБ даже после svgo — перегенерировать проще,
а не чистить руками. Горизонт каждого региона обводится по принятой панораме сразу, одним заходом.

## 5. Иконка приложения и заставка — 4 файла PNG

**Модель:** GPT Image 2.6 · `output_format: png` · 1:1 · `resolution: 1k` · `quality: high` · образец
`tali-hello-1024.png` (для `splash-icon.png` — `tali-idle-1024.png` тоже). Общая приписка ко всем промптам:

```
Use the reference image as the exact character: same shapes, same colours (body
green #3FC08A, dark green #2FA24E, cream #FFE6C7, yellow #FFC42E goggles and
muzzle, red #D93A1E satchel and blush), same thick dark outline #2A1A12. Flat
vector sticker style, no gradients, no glow, no shadow, no texture, no text,
no letters, no watermark.
```

| Файл | Параметры | Промпт | Статус |
|---|---|---|---|
| `icon.png` | `background: opaque`, 1024×1024, без альфы и скруглений | The reference dinosaur character, head and shoulders only, looking up and to the right, goggles pushed up on the forehead, a gentle smile. The head is about 60 % of the image height. Everything important stays inside the central 80 % of the frame. Solid flat background #FFF3E3 filling the whole square. | ждём |
| `android-icon-foreground.png` | `background: transparent` | The same head-and-shoulders character, centred, fitting inside an imaginary circle 66 % of the image width; nothing outside that circle. Transparent background. | ждём |
| `android-icon-monochrome.png` | `background: transparent` | The same head-and-shoulders character as a single flat BLACK silhouette, no colours, no grey: the eyes, muzzle and goggle lenses are cut out as transparent holes at least 12 px wide. Centred inside an imaginary circle 66 % of the image width. Transparent background. | ждём |
| `splash-icon.png` | `background: transparent` | The reference dinosaur character full body, standing and waving hello, exactly as in the reference, centred, 12 % margin on every side. Transparent background, no ground shadow. | ждём |

`favicon.png` 48×48 не генерировать: уменьшенный `icon.png`. `android-icon-background.png` удалить из репозитория
(фон задаёт `adaptiveIcon.backgroundColor`). Если GPT Image даёт ореол по краю прозрачного фона — прогнать через
Image Background Remover или сгенерировать на `#FFF3E3` и вырезать фон там же.

## 6. Предметы к заданиям обычного режима

**Модель:** Nano Banana (безлимит) · 1:1 · 768 достаточно. Промпт — ASSETS.md, шаг 5. Списка пока нет: предметы
появляются вместе с уроками (`lesson-author`), каждая партия — отдельный документ здесь же.

## Порядок и расход

1. Тест `ui-token` (раздел 0) — решает путь для разделов 1–4.
2. Стимулы ABA (24) — в выпуске цели закрыты, пока их нет.
3. Иконки (19) и ориентиры (4).
4. Панорама и её горизонт; остальные три горизонта — в редакторе.
5. Иконка приложения и заставка.

Стоимость по каталогу Higgsfield я не вижу (коннектор читает только баланс); в Recraft вектор стоил 2 кредита за
кадр, итого ≈ 100 кредитов на партию плюс переделки. Сверяй `balance` после теста.
