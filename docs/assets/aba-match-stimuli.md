# Партия: стимулы ABA `match`, ступень 1 (18 предметов)

Скилл `asset-pipeline`. Цели — `talentia-mobile/src/content/aba/match-level1.ts`, стимулы — `src/content/aba/stimuli.ts`,
реестр — `ABA_OBJECT_ART` в `src/assets/registry.ts` (сейчас все `null`, экран рисует заглушку-силуэт).

**Инструмент:** Recraft, вектор, **Style Lock** от эталона Tali (ASSETS.md шаг 0–1). Растр не годится: на экране пробы
ABA он запрещён. Квадрат, прозрачный фон.

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
| `aba-obj-apple.svg` | яблоко | a red apple with one green leaf on a short stem | ждём |
| `aba-obj-pear.svg` | груша | a green pear with a brown stem | ждём |
| `aba-obj-carrot.svg` | морковь | one carrot with green leafy top, red-orange body made of tone steps of #D93A1E | ждём |
| `aba-obj-mushroom.svg` | гриб | a mushroom with a red cap and white dots, cream stem | ждём |
| `aba-obj-leaf.svg` | листок | a single green tree leaf with visible veins as pattern | ждём |
| `aba-obj-car.svg` | машинка | a small toy car, blue body, two black wheels, side view | ждём |
| `aba-obj-plane.svg` | самолёт | a small toy airplane, white with blue stripe, side view | ждём |
| `aba-obj-boat.svg` | кораблик | a small paper-style sailboat, white sail, blue hull | ждём |
| `aba-obj-house.svg` | домик | a small house with a red roof, one door, one window | ждём |
| `aba-obj-umbrella.svg` | зонт | an open umbrella, pink canopy, curved handle | ждём |
| `aba-obj-key.svg` | ключ | an old-fashioned key, blue-grey, round bow | ждём |
| `aba-obj-spoon.svg` | ложка | a single spoon, light grey with cream highlight, diagonal | ждём |
| `aba-obj-teapot.svg` | чайник | a round teapot, blue body, white lid, short spout | ждём |
| `aba-obj-book.svg` | книга | a closed book, green cover, cream pages edge | ждём |
| `aba-obj-hat.svg` | шапка | a knitted winter hat with a pompom, red with white band | ждём |
| `aba-obj-mitten.svg` | рукавица | a single knitted mitten, blue with white pattern band | ждём |
| `aba-obj-pyramid.svg` | пирамидка | a toy stacking ring pyramid, rings in green, blue, pink, red | ждём |
| `aba-obj-sock.svg` | носок | a single striped sock, blue and white stripes | ждём |

**Приёмка** — по скиллу: `npm run assets:check -- scripts/input`, затем глазами (плотность узором, прозрачный
фон на цветной подложке, контур как у соседних, силуэт на 24 px). Принятое — в
`talentia-mobile/assets/images/aba/stimuli/`, импорт и запись в `ABA_OBJECT_ART`, статус здесь — «принято».
