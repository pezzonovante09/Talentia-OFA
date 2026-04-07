# Озвучка уроков 5–6 лет (интро + диалоги + задания)

В приложении это возраст **`5–6`**, миры: **meadow, forest, garden, island**. Отдельного поля «0 класс» в коде нет — это тот же контент.

## Что уже автоматизировано в репозитории

1. **Список всех фраз** (ru / en / ky): интро, диалоги, **текст вопроса** и **подписи вариантов** (multiple choice) с именами файлов `{lessonId}_task_{taskId}_q_{lang}.mp3` и `…_opt_{optionId}_{lang}.mp3`.
2. **CSV** для Excel / ручной загрузки в ElevenLabs Studio.
3. **Скрипт скачивания MP3** через официальный API ElevenLabs (по желанию).

Тебе не нужно собирать ключи вручную из `worlds.ts` и локалей — всё собирает экспорт.

---

## Шаг 1. Сгенерировать манифест (обязательно)

В папке `talentia-mobile`:

```bash
npm run voice:manifest-5-6
```

Появятся файлы:

- `scripts/output/voice-manifest-5-6.json` — полная структура.
- `scripts/output/voice-manifest-5-6.csv` — таблица: одна строка = одна фраза на одном языке (количество строк растёт вместе с заданиями; в CSV есть колонки `task_id`, `option_id` для строк заданий).

Поле **`text_for_tts`** в CSV и **`texts.<lang>.forTTS`** в JSON — то, что нужно отдавать в синтезатор (эмодзи убраны).

---

## Шаг 2. ElevenLabs: ключ и голоса

1. Зайди на [elevenlabs.io](https://elevenlabs.io), создай аккаунт / войди.
2. **API Key**: профиль → раздел API → скопируй ключ.
3. **Voice ID**: для каждого клонируемого или библиотечного голоса открой настройки голоса — в URL или в API будет ID вида `21m00Tcm4TlvDq8ikWAM`.

Рекомендация: заведи **два голоса** (Тали и NPC), чтобы диалоги звучали разными персонажами:

- интро в приложении читает Тали → для всех `kind: intro` используется голос **TALI**;
- в диалогах смотри на `speaker`: `tali` / `npc`.

---

## Шаг 3A. Скачать все MP3 скриптом (проще всего)

### Вариант 1: ключ только на Vercel (без ElevenLabs в `.env`)

Если `ELEVENLABS_API_KEY` уже в переменных **деплоя Vercel** у `talentia-ai-proxy-next`, локально укажи только базовый URL бэкенда (тот же, что в приложении для Тали):

```env
EXPO_PUBLIC_BACKEND_URL=https://твой-проект.vercel.app
```

или явно:

```env
TTS_PROXY_URL=https://твой-проект.vercel.app
```

Скрипт дергает **`POST …/api/tts`** с `{ text, language }` — как мобильное приложение. **API-ключ на компьютер не нужен.**

Ограничения прокси:

- Язык только **`ru`** или **`en`**. Строки для **`ky`** при явной настройке шлются как **`language: "ru"`** (кыргызский текст, тот же голос, что и для ru).
- **По умолчанию в режиме прокси скрипт качает только `ru` и `en`**, без **`ky`**: иначе было бы вдвое больше запросов с тем же движком TTS, только другой текст. Если в приложении нужны отдельные файлы `*_ky.mp3`, задай **`VOICE_LANGS=ru,en,ky`**.
- На сервере один **`ELEVENLABS_VOICE_ID`** — **два разных голоса** (Тали и NPC), как в прямом режиме ElevenLabs, через этот прокси **нельзя**, пока не расширите `/api/tts`.

### Вариант 2: прямой ElevenLabs с твоего ПК

```env
ELEVENLABS_API_KEY=твой_ключ
ELEVENLABS_VOICE_ID=голос_по_умолчанию
# либо отдельно:
ELEVENLABS_VOICE_ID_TALI=id_голоса_тали
ELEVENLABS_VOICE_ID_NPC=id_голоса_npc
```

Опционально (оба варианта, где уместно):

```env
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
VOICE_LANGS=ru,en
VOICE_FETCH_DELAY_MS=450
```

Запуск:

```bash
npm run voice:fetch-elevenlabs-5-6
```

MP3 окажутся в:

`talentia-mobile/scripts/output/audio/5-6/`

Имена файлов совпадают с **`suggestedFilename`** в JSON (например `meadow-c5-l1_intro_0_ru.mp3`). Уже существующие файлы скрипт **не перезаписывает** (удали файл, если нужна перегенерация).

Проверка без списания запросов:

```bash
set VOICE_FETCH_DRY_RUN=1
node scripts/fetch-lesson-audio-elevenlabs.mjs
```

(PowerShell: `$env:VOICE_FETCH_DRY_RUN=1; node scripts/fetch-lesson-audio-elevenlabs.mjs`)

---

## Шаг 3B. Вручную через ElevenLabs Studio

1. Выполни шаг 1.
2. Открой `voice-manifest-5-6.csv` в Excel / Google Таблицах.
3. Отфильтруй, например, `lang = ru`.
4. Для каждой строки (или пакетами, если у тебя есть свой сценарий) вставляй **`text_for_tts`** в Studio, выгружай MP3 и сохраняй под именем из колонки **`filename`**.

---

## Шаг 4. Подключение к приложению (уже в коде)

1. Скопируй все `*.mp3` из `scripts/output/audio/5-6/` в папку **`assets/audio/lesson-voice-5-6/`** (имена файлов не меняй).
2. Сгенерируй карту ассетов для Metro:
   ```bash
   npm run lesson-voice:generate-map
   ```
   Появится/обновится **`src/generated/lessonVoiceAssets.ts`** с `require(...)` для каждого файла.
3. Запусти приложение как обычно. На экране урока (5–6) сначала ищут вшитый mp3 по ключу:
   - интро / диалоги: `{lessonId}_intro_{индекс}_{ru|en|ky}`, `{lessonId}_dialog_{индекс}_{ru|en|ky}`;
   - вопрос задания: `{lessonId}_task_{taskId}_q_{ru|en|ky}`;
   - вариант ответа (MC): `{lessonId}_task_{taskId}_opt_{optionId}_{ru|en|ky}`.  
   Если файла нет — как раньше **TTS через прокси / expo-speech**. Для **ky**, если нет `*_ky.mp3`, подставляется **`_ru`**.

Озвучка вшитых файлов уважает настройку **«голос / TTS»** в приложении (`ttsEnabled`).

---

## Кыргызский язык (`ky`)

Модель **eleven_multilingual_v2** обычно озвучивает кыргызский текст; качество зависит от голоса. Если не устраивает — в `.env` поставь `VOICE_LANGS=ru,en` и добери `ky` позже или в Studio другим голосом.

---

## Краткий чеклист

| # | Действие |
|---|----------|
| 1 | `cd talentia-mobile` → `npm run voice:manifest-5-6` |
| 2 | В `.env`: **либо** `EXPO_PUBLIC_BACKEND_URL=https://…vercel.app` (ключ на Vercel), **либо** `ELEVENLABS_API_KEY` + голос(а) для прямого режима |
| 3 | `npm run voice:fetch-elevenlabs-5-6` |
| 4 | Забрать MP3 из `scripts/output/audio/5-6/` |

Если что-то падает по лимитам API — увеличь `VOICE_FETCH_DELAY_MS` или режь языки через `VOICE_LANGS`.
