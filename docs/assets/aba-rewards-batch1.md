# Партия: награды ABA, партия 1 (2026-11-12)

Скилл `asset-pipeline`. Источник — проверка на телефоне: карточки наград одинаковые, награда — заглушка
(`docs/aba-center/content-audit-2026-11-12.md`). **Полные промпты и гайд перед тестом —
`higgsfield-prompts-aba-rewards-2026-11-12.html`** (кнопка «Копировать», основной и запасной путь).

**Модель:** Recraft V4.1 · `vector` · 1:1 · 1k · фон `#FFFFFF`. Картинки и детали — `colors`
`#2A1A12 #5A34C4 #9671DB #FFE6C7 #FFFFFF`: без цветов заданий (синий, красно-оранжевый, зелёный, розовый) и жетона
(жёлтый). Силуэты — `#000000 #2A1A12`, после приёмки чёрный → `currentColor`. Запасной путь — Nano Banana Pro с
образцом `ref/tali-hello-1024.png` → Ideogram Vector `vectorize`.

Генерирует владелец, файлы — в `talentia-mobile/scripts/input/`. Не генерируются: сцены пузырей, капли и узор
калейдоскопа (код), карточки «Танец Tali» и «Поём вместе» (позы Tali и значок ноты из реестра).

| id файла | Что | Куда после приёмки | Статус |
|---|---|---|---|
| `aba-reward-bubbles.svg` | пузыри, карточка | `assets/images/aba/rewards/` | ждём |
| `aba-reward-kaleidoscope.svg` | калейдоскоп, карточка (лепестки и завитки, без фигур) | `assets/images/aba/rewards/` | ждём |
| `aba-reward-pinwheel.svg` | вертушка на палочке, карточка | `assets/images/aba/rewards/` | ждём |
| `aba-reward-marble-run.svg` | горка с шариком и ведёрком, карточка | `assets/images/aba/rewards/` | ждём |
| `aba-reward-paint-drop.svg` | капля краски и брызги, карточка | `assets/images/aba/rewards/` | ждём |
| `aba-reward-pinwheel-head.svg` | головка вертушки без палочки, для вращения | `assets/images/aba/rewards/` | ждём |
| `aba-reward-marble-track.svg` | рельсы горки с ведёрком, без шарика | `assets/images/aba/rewards/` | ждём |
| `aba-reward-marble.svg` | стеклянный шарик | `assets/images/aba/rewards/` | ждём |
| `ui-reward-bubbles.svg` | силуэт: три пузыря разного размера | `assets/icons/` | ждём |
| `ui-reward-kaleidoscope.svg` | силуэт: розетка из 8 лепестков | `assets/icons/` | ждём |
| `ui-reward-pinwheel.svg` | силуэт: вертушка | `assets/icons/` | ждём |
| `ui-reward-marble-run.svg` | силуэт: горка и шарик | `assets/icons/` | ждём |
| `ui-reward-tali-dance.svg` | силуэт: танцующий тираннозавр | `assets/icons/` | ждём |
| `ui-reward-paint-drop.svg` | силуэт: капля над брызгами | `assets/icons/` | ждём |
| `ui-reward-sing-together.svg` | силуэт: две ноты с ребром | `assets/icons/` | ждём |

Звуки партии — таблица на той же странице и `docs/aba-center/voice-lines-ru.md`.
