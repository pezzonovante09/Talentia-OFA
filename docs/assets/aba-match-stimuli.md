# Партия: стимулы ABA `match`, ступень 1 (24 предмета)

Скилл `asset-pipeline`. Цели — `talentia-mobile/src/content/aba/match-level1.ts`, стимулы — `src/content/aba/stimuli.ts`,
реестр — `ABA_OBJECT_ART` в `src/assets/registry.ts`. **Партия принята 2026-11-06**: все 24 файла из Higgsfield лежат в
`talentia-mobile/assets/images/aba/stimuli/` и подключены в реестре; цвета подогнаны к палитре скриптом (№178).

**Инструмент:** Recraft, вектор, **Style Lock** от эталона Tali (ASSETS.md шаг 0–1). Растр не годится: на экране пробы
ABA он запрещён. Квадрат, прозрачный фон. С 2026-11-06 генерация идёт через Higgsfield: модель, палитра из 10 цветов
и запасной путь через Ideogram Vector — `docs/assets/higgsfield-2026-11-06.md`, раздел 3. **Полные промпты — на странице
`docs/assets/higgsfield-prompts-2026-11-06.html`**; там цвета предметов уточнены под палитру (серого в ней нет: ложка и
ключ — голубые `#0E8FBF`, колокольчик — розовый, носок — зелёный, стул — кремовый с красной подушкой, чашка — синяя
с белым горохом) и разведены так, чтобы в одном поле `match-level1.ts` не было двух предметов одного цвета. Колонка
«Промпт (начало)» ниже — прежняя формулировка, справочно.

**Общий хвост к каждому промпту** (дописать после описания предмета):

```
single object, centered, three-quarter view, flat vector cut-out style, thick uniform dark brown outline #2A1A12,
flat fills with two or three hard-edged tone steps, no gradients, no texture, no shadow, no background,
no text, children's picture-book applique look, palette: #3FC08A #2FA24E #0E8FBF #D93A1E #5A34C4 #9671DB #E36A93 #FFE6C7 #FFFFFF
```

Не жёлтый и не оранжевый целиком (жетон `#FFC42E`), не фиолетовая заливка на весь предмет (подкрепление `#5A34C4`):
эти цвета только деталями. Предмет узнаётся силуэтом в чёрной заливке на 24 px. Ни мяча, ни шарика, ни ведёрка
(классы сцен подкрепителей).

| id файла | Что | Промпт (начало) | Статус |
|---|---|---|---|
| `aba-obj-apple.svg` | яблоко | a red apple with one green leaf on a short stem | принято 2026-11-06 |
| `aba-obj-pear.svg` | груша | a green pear with a brown stem | принято 2026-11-06 |
| `aba-obj-carrot.svg` | морковь | one carrot with green leafy top, red-orange body made of tone steps of #D93A1E | принято 2026-11-06 |
| `aba-obj-mushroom.svg` | гриб | a mushroom with a red cap and white dots, cream stem | принято 2026-11-06 |
| `aba-obj-leaf.svg` | листок | a single green tree leaf with visible veins as pattern | принято 2026-11-06 |
| `aba-obj-car.svg` | машинка | a small toy car, blue body, two black wheels, side view | принято 2026-11-06 |
| `aba-obj-plane.svg` | самолёт | a small toy airplane, white with blue stripe, side view | принято 2026-11-06 |
| `aba-obj-boat.svg` | кораблик | a small paper-style sailboat, white sail, blue hull | принято 2026-11-06 |
| `aba-obj-house.svg` | домик | a small house with a red roof, one door, one window | принято 2026-11-06 |
| `aba-obj-umbrella.svg` | зонт | an open umbrella, pink canopy, curved handle | принято 2026-11-06 |
| `aba-obj-key.svg` | ключ | an old-fashioned key, blue-grey, round bow | принято 2026-11-06 |
| `aba-obj-spoon.svg` | ложка | a single spoon, light grey with cream highlight, diagonal | принято 2026-11-06 |
| `aba-obj-teapot.svg` | чайник | a round teapot, blue body, white lid, short spout | принято 2026-11-06 |
| `aba-obj-book.svg` | книга | a closed book, green cover, cream pages edge | принято 2026-11-06 |
| `aba-obj-hat.svg` | шапка | a knitted winter hat with a pompom, red with white band | принято 2026-11-06 |
| `aba-obj-mitten.svg` | рукавица | a single knitted mitten, blue with white pattern band | принято 2026-11-06 |
| `aba-obj-pyramid.svg` | пирамидка | a toy stacking ring pyramid, rings in green, blue, pink, red | принято 2026-11-06 |
| `aba-obj-sock.svg` | носок | a single striped sock, blue and white stripes | принято 2026-11-06 |
| `aba-obj-chair.svg` | стул (перенос) | a simple wooden chair, brown with cream seat, three-quarter view | принято 2026-11-06 |
| `aba-obj-flower.svg` | цветок (перенос) | a single daisy-like flower with green stem and two leaves | принято 2026-11-06 |
| `aba-obj-cup.svg` | чашка (перенос) | a cup with a handle, pink with white dots | принято 2026-11-06 |
| `aba-obj-tree.svg` | дерево (перенос) | a small round green tree with brown trunk | принято 2026-11-06 |
| `aba-obj-bus.svg` | автобус (перенос) | a small city bus, blue with white windows, side view | принято 2026-11-06 |
| `aba-obj-bell.svg` | колокольчик (перенос) | a small hand bell, blue-grey with cream handle | принято 2026-11-06 |

**Приёмка** — по скиллу: `npm run assets:check -- scripts/input`, затем глазами (плотность узором, прозрачный
фон на цветной подложке, контур как у соседних, силуэт на 24 px). Принятое — в
`talentia-mobile/assets/images/aba/stimuli/`, импорт и запись в `ABA_OBJECT_ART`, статус здесь — «принято».
