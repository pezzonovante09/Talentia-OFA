# Партия: пять новых предметов для решения 41 и рука для подсказки (6 файлов)

Скилл `asset-pipeline`. Генерирует владелец (Higgsfield, Recraft V4.1 `vector`, только SVG, квадрат, прозрачный фон —
`docs/assets/higgsfield-2026-11-06.md`, раздел 3). Файлы — в `talentia-mobile/scripts/input/`.

## 1. Пять новых предметов (решение методиста 41)

Зачем: «понял правило» в «найди такую же» проверяется на **трёх новых наборах картинок**, каждый верно с первого
показа без подсказки (`ABA.md`, решение 41, «Не сделано»). Нужны предметы, которых не было ни в одном обучении и
переносе лестницы.

Из семи кандидатов методиста взяты пять: **часы, ботинок, лампа, кровать, очки**. Карандаш и зубная щётка отложены —
у них такой же вытянутый наклонный силуэт, как у ложки и друг у друга, в одном поле их было бы не различить.

**Общий хвост к каждому промпту** (как у первой партии, `aba-match-stimuli.md`):

```
single object, centered, flat vector cut-out style, thick uniform dark brown outline #2A1A12,
flat fills with two or three hard-edged tone steps, no gradients, no texture, no shadow, no background,
no text, children's picture-book applique look, palette: #3FC08A #2FA24E #0E8FBF #D93A1E #5A34C4 #9671DB #E36A93 #FFE6C7 #FFFFFF
```

Ракурс назван в самом промпте каждого предмета, поэтому «three-quarter view» из общего хвоста убран.

Не жёлтый и не оранжевый целиком (жетон), не фиолетовая заливка на весь предмет (награды). Предмет узнаётся силуэтом
в чёрной заливке на 24 px. Цвета разведены так, чтобы в одном поле из трёх не оказалось двух предметов одного цвета.

| id файла | Что | Промпт (перед общим хвостом) | Статус |
|---|---|---|---|
| `aba-obj-clock.svg` | часы настенные | a round wall clock, blue rim #0E8FBF, cream face, two dark hands, no numbers, front view | ждём |
| `aba-obj-boot.svg` | ботинок | a child's ankle boot, red #D93A1E, cream sole and laces, side view | ждём |
| `aba-obj-lamp.svg` | лампа настольная | a table lamp, green shade #2FA24E, cream stand and round base, switched off, no light rays, side view | ждём |
| `aba-obj-bed.svg` | кровать | a small bed, pink blanket #E36A93, white pillow, cream frame with a headboard, three-quarter view | ждём |
| `aba-obj-glasses.svg` | очки | a pair of glasses, thick mint-green frame #3FC08A, white lenses, front view | ждём |

Цифр на часах нет — на картинке не должно быть знаков. Лампа выключена и без лучей: лучи читались бы как жёлтое.

**Когда файлы придут:** приёмка `npm run assets:check -- scripts/input`; файлы — в
`talentia-mobile/assets/images/aba/stimuli/`; стимулы — в `src/content/aba/stimuli.ts` и `ABA_OBJECT_ART`
(`src/assets/registry.ts`); само правило «три новых набора» в домене ещё не написано — его делает
`aba-pedagogy-specialist` (`ABA.md`, решение 41).

## 2. Рука для подсказки на шаге «коснись картинки»

Спецификация — `design-lead`, `docs/design/aba-touch-screen-review-2026-11-19.md`. Сейчас вместо руки — заглушка:
полупрозрачный тёмный круг, который похож на ячейку доски жетонов и плохо виден на тёмных картинках.

| id файла | Куда | Статус |
|---|---|---|
| `ui-hand-point.svg` | `talentia-mobile/assets/icons/`, реестр `ICONS.handPoint` | ждём |

**Что нарисовано:** кисть с тыльной стороны, указательный палец вытянут вверх-влево под ~30° к вертикали, остальные
пальцы собраны, запястье обрезано в правом нижнем углу; без рукава и руки. **Цвета кожи нет:** одна белая заливка и
тёмно-коричневый контур — так не возникает вопроса этничности и на экране пробы остаются три цвета интерфейса.
Правая рука; левую приложение получает зеркалом.

**Промпт целиком** (общий хвост предметов сюда не добавлять):

```
a single simple cartoon hand seen from the back, index finger extended straight and pointing to the upper left at
about 30 degrees from vertical, the other three fingers curled into a loose fist, thumb tucked along the side, wrist
cut off straight at the lower right corner, bare hand only, no sleeve, no arm, soft rounded age-neutral proportions,
smooth plain fingers without details, fingertip in the upper left part of the frame, single object, flat vector
cut-out style, thick uniform dark brown outline #2A1A12, the same outline colour for the few inner lines between the
curled fingers, ONE flat fill colour only: pure white #FFFFFF, no skin tone, no second colour, no gradients,
no texture, no shadow, no background, no text, children's picture-book applique look, square format,
palette: #2A1A12 #FFFFFF
```

**Когда файл придёт:** приёмка `npm run assets:check -- scripts/input`; заливку перевести в `currentColor`; измерить
точку подушечки пальца (ожидается около 0.28 × 0.14 стороны кадра) — она пойдёт в токен; размер на экране —
0.8 стороны плиты образца; движение и вид в спокойном режиме — по рецензии `design-lead` после ответов
`child-ux-specialist` и методиста.
