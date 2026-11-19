# Партия: вторые рисунки предметов для «похожее, но не такое же» (5 файлов)

Скилл `asset-pipeline`. Решение владельца №206 (2026-11-19). Цель — `match-similar-3` в
`talentia-mobile/src/content/aba/match-level1.ts`: сверху показан **второй рисунок** предмета, в поле — его первый
рисунок из партии `aba-match-stimuli.md`. Стимулы уже записаны в `src/content/aba/stimuli.ts`, в реестре
`ABA_OBJECT_ART` у них `null` — **пока файлов нет, цель закрыта** и в занятие не попадает.

**Инструмент и стиль — как у первой партии:** Higgsfield, Recraft V4.1 `vector`, только SVG, квадрат, прозрачный фон
(`docs/assets/higgsfield-2026-11-06.md`, раздел 3). Растр на экране пробы запрещён.

## Что должно отличаться

Требование методиста: **другой экземпляр того же предмета — другой цвет и другая форма деталей, тот же стиль, ракурс
и размер; с первого взгляда тот же предмет.**

Обязательное правило цвета одно (методист, рецензия 2026-11-19): **цвет второго рисунка не совпадает с цветом первого
рисунка того же предмета** — по цвету ответ не находится. С соседями цвет совпадать может, и это полезно: красная
машина-образец рядом с красной шапкой в поле учит выбирать по предмету, а не по цвету.

Вопрос «нужны ли варианты разного цвета» записан специалисту (`docs/aba-center/meeting-questions.md`, «К личной
встрече»). На приёмке сверить ракурс с первым рисунком того же предмета.

## Общий хвост к каждому промпту

```
single object, centered, flat vector cut-out style, thick uniform dark brown outline #2A1A12,
flat fills with two or three hard-edged tone steps, no gradients, no texture, no shadow, no background,
no text, children's picture-book applique look, palette: #3FC08A #2FA24E #0E8FBF #D93A1E #5A34C4 #9671DB #E36A93 #FFE6C7 #FFFFFF
```

Не жёлтый и не оранжевый целиком (жетон), не фиолетовая заливка на весь предмет (награды). Предмет узнаётся силуэтом
в чёрной заливке на 24 px. Размер предмета в кадре — как у первого рисунка.

## Файлы

| id файла | Первый рисунок | Промпт второго рисунка (перед общим хвостом) | Статус |
|---|---|---|---|
| `aba-obj-car-b.svg` | машинка, синяя, вид сбоку | a small toy car, red body #D93A1E, rounded roof with one large window, two dark wheels with cream hubcaps, side view | ждём |
| `aba-obj-book-b.svg` | книга, зелёная, закрытая | a closed book, blue cover #0E8FBF, thicker than usual, cream page edge, a pink ribbon bookmark sticking out at the bottom, three-quarter view | ждём |
| `aba-obj-hat-b.svg` | шапка вязаная, красная с белой полосой и помпоном | a knitted winter hat with a pompom, blue #0E8FBF with two cream stripes and a folded cream cuff, front view | ждём |
| `aba-obj-cup-b.svg` | чашка, белая с синим | a tall cup with a handle, red #D93A1E with one wide cream band, handle of a different shape (squarer), side view | ждём |
| `aba-obj-chair-b.svg` | стул, кремовый с красным сиденьем | a simple wooden chair, green #2FA24E, back made of three vertical slats, cream seat, three-quarter view | ждём |

Где какой рисунок встретится: машина, книга, шапка — в обучении; чашка и стул — только в пробах переноса.

## Что сделать владельцу

1. Сгенерировать пять SVG по промптам; имена файлов — как в таблице.
2. Положить в `talentia-mobile/scripts/input/` и написать в чат «рисунки для похожего готовы».

## Приёмка (делает ассистент, когда файлы придут)

1. `npm run assets:check -- scripts/input` — размер, `viewBox`, нет текста, растра и градиентов, цвета из палитры.
2. Глазами: второй рисунок рядом с первым — тот же предмет с первого взгляда, но не «тот же рисунок, перекрашенный»;
   контур и размер как у первой партии; силуэт на 24 px.
3. Файлы — в `talentia-mobile/assets/images/aba/stimuli/`; в `src/assets/registry.ts` заменить `null` на импорты.
4. `npm test -- src/assets src/content src/domain/__tests__/abaSimilarMatch.test.ts`; тест «в реестре вторых рисунков
   ещё нет — цель не допущена» обновить: цель открывается.
5. С открытой целью разобрать два сценария лестницы (`ABA.md`, «Длина и разнообразие занятия», «Не проверено»).
6. Статус в таблице — «принято», один коммит: ассеты, реестр, документ партии.
