# ABA EN/KY semantic mismatches (heuristic)

> **Internal QA, script-generated.** This is a heuristic self-check run against the repo's own locale files, not feedback from a human reviewer, specialist, or user. Do not cite it as field/user feedback — see `docs/FIELD_TEST_FEEDBACK.md` for that.

Generated: 2026-08-17T20:07:41.864Z

## Summary

- RU ABA keys: **3400**
- EN override keys: **3400**
- KY override keys: **3400**
- Flagged (any mismatch category): **172**
- OK (heuristic): **3228**

### By category

- `length_outlier`: 125
- `option_set_inconsistent`: 48

> Heuristic only — not full human semantic review. `length_outlier` often means EN/KY still holds the long standard-locale wording while RU ABA is shortened (same skill possible).

## Mismatches

### `data.dialog.forest_vl3_0`

- **categories:** length_outlier
- **RU:** "Теперь учим И и Э!"
- **EN:** "Now let's learn И and Э! Almost all vowels will be yours!"
- **KY:** "Эми И жана Э үйрөнөбүз! Дээрлик бардык үндүүлөр сеники болот!"

### `data.dialog.g1e_grtl1_1`

- **categories:** length_outlier
- **RU:** "Hello — привет! Я использую это слово всё время! Но Тали говорит: «Good morning — это «до свидания»!» Правда?"
- **EN:** "Hello — hi! Use it everywhere!"
- **KY:** "Hello — салам! Ар жерде колдон!"

### `data.dialog.g1m_addl2_1`

- **categories:** length_outlier
- **RU:** "7 + 3 = 10! Я запомнил этот секрет: смотрю, сколько не хватает до 10. Но с другими числами ещё путаюсь — проверишь меня?"
- **EN:** "Correct — 3! 7 + 3 = 10. Well done!"
- **KY:** "Туура — 3! 7 + 3 = 10. Жакшы!"

### `data.dialog.g1m_c20l3_1`

- **categories:** length_outlier
- **RU:** "17 больше 14! Я запомнил: чем правее на числовой линии, тем больше! Теперь я хочу доказать, что научился. Проверишь меня?"
- **EN:** "17 is bigger than 14! You are doing great!"
- **KY:** "17, 14тен чоңураак! Сен эң жакшы аткаруудасың!"

### `data.dialog.g1m_subl2_1`

- **categories:** length_outlier
- **RU:** "10 − 3 = 7! Я выучил специальные пары! Хочу показать — проверь, правильно ли я их запомнил?"
- **EN:** "10 - 3 = 7! Excellent work!"
- **KY:** "10 - 3 = 7! Мыкты иш!"

### `data.dialog.g1r_grml1_1`

- **categories:** length_outlier
- **RU:** "Маша, Москва, Тали — с большой! Тали говорит: «Значит, слово «кот» тоже надо писать с большой буквы — ведь это имя животного?»"
- **EN:** "Маша, Москва, Тали — with a capital!"
- **KY:** "Маша, Москва, Тали — баш тамга менен!"

### `data.dialog.g1w_schl2_1`

- **categories:** length_outlier
- **RU:** "На физкультуре бегаем, на рисовании рисуем! Тали говорит: «На физкультуре мы решаем задачки!» Правда?"
- **EN:** "In PE we run, in art we draw!"
- **KY:** "Дене тарбияда чуркайбыз, сүрөттө тартабыз!"

### `data.dialog.g2e_daysl1_1`

- **categories:** length_outlier
- **RU:** "Monday — понедельник, это я знаю! А дальше… Tuesday? Wednesday? Я путаюсь начиная с четверга! Помоги мне!"
- **EN:** "Monday is the first day of the week. There are seven days in a week!"
- **KY:** "Monday — дүйшөмбү. Жумада жети күн!"

### `data.dialog.g2m_add2l2_1`

- **categories:** length_outlier
- **RU:** "Я думаю… 213? Нет, подожди, я посчитаю по-другому. 28 + 2 = 30, и ещё 3… Кажется, 33? Но я не уверен — проверь меня!"
- **EN:** "28 + 2 = 30, plus 3 = 33! You did it!"
- **KY:** "28 + 2 = 30, дагы 3 = 33! Жасадың!"

### `data.dialog.g2r_sentl1_1`

- **categories:** length_outlier
- **RU:** "Почти! Но чего не хватает — КТО бежит? Подлежащее! «Кот бежит» — вот настоящее предложение. Поможем Тали разобраться?"
- **EN:** "Who? What? — subject. What does it do? — predicate!"
- **KY:** "Ким? Эмне? — ээ. Эмне кылат? — баяндооч!"

### `data.dialog.g2r_sentl3_1`

- **categories:** length_outlier
- **RU:** "Хм, слова есть, но они не связаны правильно! Слова в предложении должны «дружить» друг с другом — согласовываться. Поможем Тали исправить?"
- **EN:** "An adjective agrees with the noun in gender!"
- **KY:** "Сын атооч зат атооч менен жынысы жагынан макулдашат!"

### `data.dialog.g2r_spl1_1`

- **categories:** length_outlier
- **RU:** "Хаха! Почти! Существительное — это слово, которое называет предмет или существо: КОТ, СТОЛ, НЕБО. Давай Тали поможем разобраться!"
- **EN:** "A noun names an object or person!"
- **KY:** "Зат атооч буюм же адамды атайт!"

### `data.dialog.g2s_bdyl3_1`

- **categories:** length_outlier
- **RU:** "Тали! Тело нужно кормить правильно — овощи, фрукты, белок. Печенье — это не еда на три дня! Расскажи нам, что полезно есть."
- **EN:** "Eat vegetables, do exercise!"
- **KY:** "Жашылча же, дене тарбия кыл!"

### `data.dialog.g2s_pltl3_1`

- **categories:** length_outlier
- **RU:** "Тали, нет! Морковь — это овощ, и она растёт под землёй. А яблоко — фрукт, растёт на дереве. Давай разберёмся вместе!"
- **EN:** "Carrot is a root vegetable, apple is a fruit!"
- **KY:** "Сабиз — тамыр жашылчасы, алма — мөмө!"

### `data.dialog.g3e_foodl1_1`

- **categories:** length_outlier
- **RU:** "Juice — сок! Porridge — каша. Тали, ты пьёшь сок каждое утро — теперь знаешь, как это по-английски!"
- **EN:** "Juice means сок! Porridge means каша. Tali, you drink juice every morning — now you know the English words!"
- **KY:** "Food — тамак. Drink — суусундук!"

### `data.dialog.g3m_1000l2_1`

- **categories:** length_outlier
- **RU:** "Тали, ты правильно думаешь! Давай проверим на заданиях — помоги мне убедиться, что я тоже понял правило."
- **EN:** "247 = 2 hundreds, 4 tens, 7 units!"
- **KY:** "247 = 2 жүздүк, 4 ондук, 7 бирдик!"

### `data.dialog.g3m_divl1_1`

- **categories:** length_outlier
- **RU:** "Тали, именно! Деление и умножение — лучшие друзья. Давай проверим твою идею на задачах!"
- **EN:** "We divide equally. 8 / 4 = 2!"
- **KY:** "Бирдей бөлөбүз. 8 ÷ 4 = 2!"

### `data.dialog.g3m_divl2_1`

- **categories:** length_outlier
- **RU:** "Тали, проверим! 4 × 7 = 28? Да! Значит, ты прав. Деление всегда проверяется умножением."
- **EN:** "Division and multiplication are friends!"
- **KY:** "Бөлүү жана көбөйтүү — достор!"

### `data.dialog.g3r_adjl1_1`

- **categories:** length_outlier
- **RU:** "Потому что прилагательное согласуется с существительным в роде! Шар — он (красный). Роза — она (красная). Яблоко — оно (красное)."
- **EN:** "Red ball, red rose, red apple!"
- **KY:** "Кызыл топ, кызыл раймайлы, кызыл алма!"

### `data.dialog.g3r_adjl2_1`

- **categories:** length_outlier
- **RU:** "Тали, ты сам привёл идеальный пример! Положительная — большой, сравнительная — больше, превосходная — самый большой."
- **EN:** "Beautiful — more beautiful — most beautiful!"
- **KY:** "Сулуу — сулуураак — эң сулуу!"

### `data.dialog.g3r_genl2_1`

- **categories:** length_outlier
- **RU:** "Хорошая мысль! Средний — это слова с окончанием -о, -е: ОКНО, МОРЕ, СОЛНЦЕ. Они отвечают на «оно моё». Давай проверим!"
- **EN:** "Ending -о, -е often for neuter gender!"
- **KY:** "-о, -е жалгоочтору орто жынысында көп!"

### `data.dialog.g3w_ecol1_1`

- **categories:** length_outlier
- **RU:** "Тали, они все связаны! Деревья кормят белок, белки растаскивают семена, семена вырастают в деревья. Убери одно звено — рухнет вся цепь!"
- **EN:** "Forest, meadow, pond — different ecosystems!"
- **KY:** "Токой, жайлоо, көлмө — ар кандай экосистемалар!"

### `data.dialog.g3w_ecol3_1`

- **categories:** length_outlier
- **RU:** "Да, Тали! Человек — часть экосистемы. И наши действия влияют на всю природу — как положительно, так и отрицательно."
- **EN:** "Our actions affect nature!"
- **KY:** "Биздин аракеттер жаратылышка таасир этет!"

### `data.dialog.g3w_geol1_1`

- **categories:** length_outlier
- **RU:** "Тали, запомни: солнце встаёт на востоке, садится на западе. Компас поможет с севером и югом!"
- **EN:** "A compass shows direction!"
- **KY:** "Компас багытты көрсөтөт!"

### `data.dialog.g3w_geol2_1`

- **categories:** length_outlier
- **RU:** "Глобус — точная копия формы Земли (шар). Карта — это как если раскатать апельсин скалкой: немного искажается, зато плоская и удобная!"
- **EN:** "Countries and oceans are on the map!"
- **KY:** "Картада өлкөлөр жана океандар бар!"

### `data.dialog.g3w_geol3_1`

- **categories:** length_outlier
- **RU:** "Очень круто! Столица — главный город страны. Москва — столица России, Париж — Франции, Лондон — Великобритании. А ты живёшь в Бишкеке!"
- **EN:** "Every country has a capital!"
- **KY:** "Ар бир өлкөнүн борбор шаары бар!"

### `data.dialog.g3w_natl1_1`

- **categories:** length_outlier
- **RU:** "Вода испарилась — поднялась в небо! Это первый шаг круговорота воды. Потом она вернётся дождём. Расскажем Тали весь путь?"
- **EN:** "Water moves constantly in nature!"
- **KY:** "Суу жаратылышта дайыма кыймылдайт!"

### `data.dialog.g3w_natl2_1`

- **categories:** length_outlier
- **RU:** "Почти! Нефть и уголь образовались из остатков древних живых существ за миллионы лет. Тали, это ископаемые в буквальном смысле — нужно откопать!"
- **EN:** "They are extracted from the ground!"
- **KY:** "Алар жерден казылат!"

### `data.dialog.g3w_natl3_1`

- **categories:** length_outlier
- **RU:** "Тали, это очень важная книга! В ней — список животных и растений, которым грозит исчезновение. Красный цвет — это сигнал опасности."
- **EN:** "Protect the forest, water, animals!"
- **KY:** "Токойду, сууну, жаныбарларды корго!"

### `data.dialog.g4r_cases_l1_1`

- **categories:** length_outlier
- **RU:** "Это два падежа. Именительный — «кто?». Винительный — «кого?»."
- **EN:** "Tali, those are two different cases! Nominative answers “кто?” — it’s the subject, the owner of the sentence. Accusative — “кого? что?” — is the object of the action. Let’s figure it out!"
- **KY:** "Тали, бул эки башка жөндөмө! Именительный «кто?» дегенге жооп берет — бул ээ, сүйлөмдүн ээси. Винительный — «кого? что?» — аракеттин объектиси. Кел, чогуу түшүнөлү!"

### `data.dialog.g4r_cases_l2_0`

- **categories:** length_outlier
- **RU:** "«Я отправил письмо мама.» Верно? 📬"
- **EN:** "Word, I need to write a letter to a friend! “Я отправил письмо мама” — is that right? Something sounds weird…"
- **KY:** "Сөз, мага досума кат жазыш керек! «Я отправил письмо мама» — туурабы? Бир нерсе кулакка тийип жатат…"

### `data.dialog.g4r_cases_l2_1`

- **categories:** length_outlier
- **RU:** "Нужен дательный падеж: «маме»."
- **EN:** "Tali, you can feel it — «мама» doesn’t fit here! After “отправил кому?” you need dative: «маме». And “не хватает кого?” — genitive: «мамы». Let’s look at both!"
- **KY:** "Тали, сен сезип жатасың — бул жерде «мама» туура келбейт! «Отправил кому?» дегенден кийин дательный керек: «маме». Ал эми «не хватает кого?» — родительный: «мамы». Кел, экөөнү тең карап чыгалы!"

### `data.dialog.g4r_cases_l3_1`

- **categories:** length_outlier
- **RU:** "Творительный: «кем? чем?». Предложный: всегда с предлогом."
- **EN:** "You almost guessed, Tali! Instrumental is “creating with the help of something.” “Пишу карандашом” — instrumental. And prepositional — because it is always used WITH a preposition. Never without one!"
- **KY:** "Дээрлик таптың, Тали! Творительный — «бир нерсенин жардамы менен жаратуу». «Пишу карандашом» — творительный. Ал эми предложный — анткени ал ар дайым ПРЕДЛОГ МЕНЕН колдонулат. Эч качан андан тышкары!"

### `data.dialog.g4r_conj_l1_0`

- **categories:** length_outlier
- **RU:** "Привет. 👋 Я записал: «Я хожу. Ты ходишь. Он ходить.»"
- **EN:** "Hi, I’m Word! Today Tali wrote in his diary: “Я хожу в школу. Ты ходишь в школу. Он ходить в школу.” Something’s wrong in the third sentence — Tali didn’t notice the mistake!"
- **KY:** "Салам, мен Сөз! Бүгүн Тали күндөлүгүнө жазды: «Я хожу в школу. Ты ходишь в школу. Он ходить в школу.» Үчүнчү сүйлөмдө бир нерсе туура эмес — Тали катаны байкаган жок!"

### `data.dialog.g4r_conj_l2_0`

- **categories:** length_outlier
- **RU:** "Я написал: «Мы петь вместе!» 🎵"
- **EN:** "Word, I’m writing a play about dinosaurs! There’s a line like this: “Мы петь вместе!” Sounds beautiful, right?"
- **KY:** "Сөз, мен динозаврлар жөнүндө пьеса жазып жатам! Мындай реплика бар: «Мы петь вместе!» Кооз угулат, туурабы?"

### `data.dialog.g4r_conj_l2_1`

- **categories:** length_outlier
- **RU:** "Нужен спряжённый глагол: «Мы поём.»"
- **EN:** "Tali, “мы петь” isn’t conjugation! You need to change the verb by person. “Мы поём” — that’s how it should sound. Let’s fix the play together!"
- **KY:** "Тали, «мы петь» — бул жакталуу эмес! Этишти жак боюнча өзгөртүш керек. «Мы поём» — туура ушундай угулат. Кел, пьесаны чогуу оңдойлу!"

### `data.dialog.g4r_conj_l3_0`

- **categories:** length_outlier
- **RU:** "Последняя фраза: «Мы бежит к финишу!» 🏃"
- **EN:** "Word, I’m almost done with the play! But the last line won’t come out: “Мы бежит к финишу!” Something sounds off…"
- **KY:** "Сөз, мен пьесаны дээрлик бүтүрдүм! Бирок акыркы реплика чыкпай жатат: «Мы бежит к финишу!» Бир нерсе туура эмес угулат…"

### `data.dialog.g4r_conj_l3_1`

- **categories:** length_outlier
- **RU:** "Нужно определить спряжение и подобрать окончание."
- **EN:** "Tali, you can feel the mistake — that’s a good sign! Now we need to find the verb’s conjugation and pick the right ending. You already know almost everything!"
- **KY:** "Тали, сен катаны сезип жатасың — бул жакшы белги! Эми этиштин жакталуусун аныктап, туура аягын тандаш керек. Сен дээрлик баарын билесиң!"

### `data.dialog.g4r_text_l2_0`

- **categories:** length_outlier
- **RU:** "Текст: «Ёж свернулся в клубок. Иголки торчат. Никто не тронет ежа.» 🦔"
- **EN:** "I read a text about a hedgehog: “Ёж свернулся в клубок. Иголки торчат во все стороны. Никто не тронет ежа.” Word, what’s the main idea here? There are three sentences — and each one matters!"
- **KY:** "Мен кирпи жөнүндө текст окудум: «Ёж свернулся в клубок. Иголки торчат во все стороны. Никто не тронет ежа.» Сөз, бул жерде негизги ой кайсы? Үч сүйлөм бар — ар бири маанилүү!"

### `data.dialog.g4r_text_l3_1`

- **categories:** length_outlier
- **RU:** "Слова «сначала», «потом», «наконец» — маяки. Они показывают порядок."
- **EN:** "Tali, the order of events in a text is sequence! Words like “сначала”, “потом”, “наконец” are beacons that show what comes after what. Let’s put the order back!"
- **KY:** "Тали, тексттеги окуялардын тартиби — бул ырааттуулук! «Сначала», «потом», «наконец» сыяктуу сөздөр — эмненин артынан эмне келерин көрсөткөн маяктар. Кел, тартипти калыбына келтирели!"

### `data.intro.forest_vl2_0_t`

- **categories:** length_outlier
- **RU:** "Буква О."
- **EN:** "Letter О — like a hoop!"
- **KY:** "О тамгасы — чеңгел сыяктуу!"

### `data.intro.forest_vl2_1_t`

- **categories:** length_outlier
- **RU:** "Буква У."
- **EN:** "Letter У — lips like a tube!"
- **KY:** "У тамгасы — эриндер трубка!"

### `data.intro.forest_vl3_1_t`

- **categories:** length_outlier
- **RU:** "Буква Э."
- **EN:** "We know 5 vowels!"
- **KY:** "Биз 5 үндүүнү билебиз!"

### `data.intro.g1r_vowl1_1_t`

- **categories:** length_outlier
- **RU:** "Мягкость"
- **EN:** "Softening consonants"
- **KY:** "Үнсүздөрдүн жумшаруусу"

### `data.intro.g2e_daysl1_1_b`

- **categories:** length_outlier
- **RU:** "Mon-Tue-Wed-Thu-Fri — рабочие дни. Sat-Sun — выходные. Тали, повторяй вслух!"
- **EN:** "Mon-Tue-Wed-Thu-Fri — weekdays. Sat-Sun — weekend. Tali, say them out loud!"
- **KY:** "Бир жумада жети күн!"

### `data.intro.g2e_daysl2_0_b`

- **categories:** length_outlier
- **RU:** "Yesterday — вчера. Today — сегодня. Tomorrow — завтра. «Today is Monday → Yesterday was Sunday → Tomorrow is Tuesday»"
- **EN:** "Yesterday — the day before today. Tomorrow — the day after today!"
- **KY:** "Yesterday — кечөө. Tomorrow — эртең!"

### `data.intro.g2e_daysl3_1_b`

- **categories:** length_outlier
- **RU:** "On Monday, on Tuesday — с днями недели используем ON."
- **EN:** "Weekly timetable!"
- **KY:** "Жумалык жадыбал!"

### `data.intro.g2e_phrl1_0_b`

- **categories:** length_outlier
- **RU:** "Please — пожалуйста (просьба). Thank you — спасибо (благодарность). You're welcome — пожалуйста (ответ на спасибо)."
- **EN:** "Please — a polite request. Thank you — gratitude. You're welcome — a reply to thank you."
- **KY:** "Please — сураныч. Thank you — рахмат!"

### `data.intro.g2e_phrl1_1_t`

- **categories:** length_outlier
- **RU:** "Вежливость на английском"
- **EN:** "Politeness"
- **KY:** "Сылыктык"

### `data.intro.g2e_phrl3_1_b`

- **categories:** length_outlier
- **RU:** "Can I… — вежливый вопрос. Yes, you can — можно. No, you can't — нельзя."
- **EN:** "Can I go? — Can I leave?"
- **KY:** "Can I go? — Чыксам болобу?"

### `data.intro.g2e_schl2_0_b`

- **categories:** length_outlier
- **RU:** "Math — математика, Art — рисование, PE — физкультура (Physical Education), Science — наука, English — английский."
- **EN:** "Math, Reading, PE (Physical Education)!"
- **KY:** "Math, Reading, PE (Physical Education)!"

### `data.intro.g2m_add2l1_0_b`

- **categories:** length_outlier
- **RU:** "20 + 30: смотри только на десятки: 2 + 3 = 5, добавь нолик → 50. Нули «не мешают», они просто показывают, что это десятки!"
- **EN:** "20 + 30: 2 tens + 3 tens = 5 tens = 50."
- **KY:** "20 + 30: 2 ондук + 3 ондук = 5 ондук = 50."

### `data.intro.g2r_sentl2_1_b`

- **categories:** length_outlier
- **RU:** "Без второстепенных: «Кот ест». С ними: «Пушистый кот быстро ест вкусную рыбу». Разница чувствуется!"
- **EN:** "They clarify the main members!"
- **KY:** "Алар негизги мүчөлөрдү тактайт!"

### `data.intro.g3e_dailyl1_1_b`

- **categories:** length_outlier
- **RU:** "Do homework, go to bed."
- **EN:** "Use: wake up, eat, go to school, play, sleep — to describe your day."
- **KY:** "Колдон: wake up, eat, go to school, play, sleep — күнүңдү сүрөттөө үчүн."

### `data.intro.g3e_dailyl2_1_t`

- **categories:** length_outlier
- **RU:** "Части дня"
- **EN:** "Morning, afternoon, evening"
- **KY:** "Таң, күн, кеч"

### `data.intro.g3m_tabl1_1_b`

- **categories:** length_outlier
- **RU:** "6 × 6 = 36 — запомни как «шесть шестёрок тридцать шесть»!"
- **EN:** "6 x 6 = 36!"
- **KY:** "6 × 6 = 36!"

### `data.intro.g3m_tabl2_1_b`

- **categories:** length_outlier
- **RU:** "8 × 8 = 64 — «восемь восемь шестьдесят четыре». Запоминай парами!"
- **EN:** "8 x 8 = 64!"
- **KY:** "8 × 8 = 64!"

### `data.intro.g3m_tabl3_1_b`

- **categories:** length_outlier
- **RU:** "9×9=81, 8+1=9. Правило всегда работает!"
- **EN:** "9 x 9 = 81!"
- **KY:** "9 × 9 = 81!"

### `data.intro.g3w_geol1_1_b`

- **categories:** length_outlier
- **RU:** "Стрелка компаса показывает на север. Тали, запомни: если лицом на север — справа восток, слева запад, сзади юг."
- **EN:** "A map is a flat representation of the Earth!"
- **KY:** "Карта — Жердин жалпак чагылдырылышы!"

### `data.intro.g3w_natl1_1_b`

- **categories:** length_outlier
- **RU:** "Та же вода, что падала на динозавров миллионы лет назад, сейчас в твоём стакане. Серьёзно!"
- **EN:** "Water is constantly moving!"
- **KY:** "Суу дайыма кыймылдайт!"

### `data.intro.g3w_natl2_0_b`

- **categories:** length_outlier
- **RU:** "Нефть, газ, уголь — горючие ископаемые. Гранит, песок — строительные. Железная руда — металлическая."
- **EN:** "Oil, gas, coal — extracted from the ground!"
- **KY:** "Нефть, газ, көмүр — жерден казылат!"

### `data.intro.g3w_natl3_1_b`

- **categories:** length_outlier
- **RU:** "Что мы делаем с природой, то возвращается к нам."
- **EN:** "Protect nature!"
- **KY:** "Жаратылышты корго!"

### `data.intro.g4r_cases_l1_1_b`

- **categories:** length_outlier
- **RU:** "«Я вижу кота» — кот отвечает на «кого?»."
- **EN:** "“I see the cat” - the cat is the object here, answers “whom?”, is in the accusative case. That's why the ending changes!"
- **KY:** "«Я вижу кота» — «кота» бул жерде объект, «кимди?» деген суроого жооп берет, табыш жөндөмөдө турат. Ошондуктан мүчө өзгөрөт!"

### `data.intro.g4r_cases_l2_1_b`

- **categories:** length_outlier
- **RU:** "«Не хватает мамы» — отвечает на «кого?»."
- **EN:** "“Mom is missing” - answers “whom?” The genitive is often used with negation or after “there is no” / “there is not enough”!"
- **KY:** "«Не хватает мамы» — «кимдин?» деген суроого жооп берет. Илик жөндөмө көбүнчө терс мааниде же «жок», «жетишпейт» деген сөздөрдөн кийин колдонулат!"

### `data.intro.g4r_cases_l3_1_b`

- **categories:** length_outlier
- **RU:** "«Думаю о лесе», «живу в городе»."
- **EN:** "“I think about the forest”, “I live in the city” - answers “about whom? about what? where?” The prepositional case does NOT exist without a preposition!"
- **KY:** "«Думаю о лесе», «живу в городе» — «ким жөнүндө? эмне жөнүндө? кайда?» деген суроого жооп берет. Жандооч сөзсүз болбосо, предложный жөндөмө ЖОК!"

### `data.intro.g4r_conj_l2_1_b`

- **categories:** length_outlier
- **RU:** "Вы пишЕТЕ. Они пишУТ."
- **EN:** "“Vy” (you-plural) and “oni” (they) are often confused: vy pishETE (2nd person plural), oni pishUT (3rd person plural). Different endings!"
- **KY:** "«Вы» жана «они» көп чаташтырылат: вы пишЕТЕ (2-жак көптүк), они пишУТ (3-жак көптүк). Мүчөлөрү башка!"

### `data.tasks.g1e_morning_greeting`

- **categories:** length_outlier
- **RU:** "Утром, входя в класс, говорят:"
- **EN:** "In the morning when you walk into class, which greeting is usually right: Good morning, Good night, or Goodbye?"
- **KY:** "Эртең менен класска киргенде куттуктоо үчүн кайсынысы туура: Good morning, Good night же Goodbye?"

### `data.tasks.g1e_opt_good_night`

- **categories:** length_outlier
- **RU:** "Good night"
- **EN:** "Good night"
- **KY:** "Good night (Кайырлуу түн)"

### `data.tasks.g2r_opt_krasivyi`

- **categories:** length_outlier
- **RU:** "Красивый"
- **EN:** "Красивый (beautiful — adjective)"
- **KY:** "Красивый (сулуу — сын атооч)"

### `data.tasks.g2s_bdyl2_q3_b`

- **categories:** length_outlier
- **RU:** "Тали прав — желудок для пищеварения"
- **EN:** "Tali is right"
- **KY:** "Тали туура"

### `data.tasks.g2s_opt_femur`

- **categories:** length_outlier
- **RU:** "Бедренная"
- **EN:** "Femur (thigh bone)"
- **KY:** "Жамбаш сөөгү (бедренная)"

### `data.tasks.g2s_opt_move_body`

- **categories:** length_outlier
- **RU:** "Двигаться"
- **EN:** "To move the body"
- **KY:** "Денени кыймылдатүү үчүн"

### `data.tasks.g2s_photosyn_needs`

- **categories:** length_outlier
- **RU:** "Что нужно растению для фотосинтеза? Тали перечисляет: «свет, вода и… и… что ещё?»"
- **EN:** "Photosynthesis requires:"
- **KY:** "Фотосинтез үчүн керек:"

### `data.tasks.g3m_25div5`

- **categories:** length_outlier
- **RU:** "Знаешь, что 5 × 5 = 25? Реши обратную задачу: 25 ÷ 5 = ?"
- **EN:** "25 ÷ 5 =?"
- **KY:** " 25 ÷ 5 =?"

### `data.tasks.g3m_30div10`

- **categories:** length_outlier
- **RU:** "Раз 3 × 10 = 30, то 30 ÷ 10 = ?"
- **EN:** "30 ÷ 10 =?"
- **KY:** " 30 ÷ 10 =?"

### `data.tasks.g3m_4x6`

- **categories:** length_outlier
- **RU:** "У осьминога 4 друга, у каждого по 6 рук. Тали считает: 4 × 6 = ?"
- **EN:** "4 × 6 =?"
- **KY:** " 4 × 6 =?"

### `data.tasks.g3m_4x8`

- **categories:** length_outlier
- **RU:** "Паук сплёл 4 паутины, в каждой 8 узелков. Сколько узелков завязал трудолюбивый паук? 4 × 8 = ?"
- **EN:** "4 × 8 =?"
- **KY:** " 4 × 8 =?"

### `data.tasks.g3m_6x7`

- **categories:** length_outlier
- **RU:** "На каждой из 6 полок по 7 книг. Тали считает всю библиотеку: 6 × 7 = ?"
- **EN:** "6 × 7 =?"
- **KY:** " 6 × 7 =?"

### `data.tasks.g3m_6x9`

- **categories:** length_outlier
- **RU:** "Пчела облетела 6 цветков и собрала с каждого по 9 капель нектара. Тали хочет узнать итог: 6 × 9 = ?"
- **EN:** "6 × 9 =?"
- **KY:** " 6 × 9 =?"

### `data.tasks.g3m_7x5`

- **categories:** length_outlier
- **RU:** "Неделя — 7 дней. За 5 недель сколько дней? 7 × 5 = ?"
- **EN:** "7 × 5 =?"
- **KY:** " 7 × 5 =?"

### `data.tasks.g3m_7x8`

- **categories:** length_outlier
- **RU:** "Осьминог купил 7 тетрадей по 8 листов. Тали помогает считать: 7 × 8 = ?"
- **EN:** "7 × 8 =?"
- **KY:** " 7 × 8 =?"

### `data.tasks.g3m_8x6`

- **categories:** length_outlier
- **RU:** "В 8 корзинах по 6 яблок. Тали готовится к пирогу: 8 × 6 = ?"
- **EN:** "8 × 6 =?"
- **KY:** " 8 × 6 =?"

### `data.tasks.g3m_8x9`

- **categories:** length_outlier
- **RU:** "Стадо из 8 коров даёт по 9 литров молока. Сколько литров получит фермер? 8 × 9 = ?"
- **EN:** "8 × 9 =?"
- **KY:** " 8 × 9 =?"

### `data.tasks.g3m_9x4`

- **categories:** length_outlier
- **RU:** "Кот прожил 4 из своих 9 жизней. Но сейчас важнее: 9 × 4 = ?"
- **EN:** "9 × 4 =?"
- **KY:** " 9 × 4 =?"

### `data.tasks.g3m_9x6_check`

- **categories:** length_outlier
- **RU:** "Тали утверждает: «9 × 6 = 54!» И добавляет: «5+4=9 — правило работает!» Он прав?"
- **EN:** "9 × 6 = 54. Right?"
- **KY:** " 9 × 6 = 54. Верно?"

### `data.tasks.g3m_9x7`

- **categories:** length_outlier
- **RU:** "На 9 ёлках по 7 шишек. Белка хочет знать итог: 9 × 7 = ?"
- **EN:** "9 × 7 =?"
- **KY:** " 9 × 7 =?"

### `data.tasks.g3m_9x9`

- **categories:** length_outlier
- **RU:** "Магический квадрат: 9 рядов по 9 клеток. Сколько клеток на доске? 9 × 9 = ?"
- **EN:** "9 × 9 =?"
- **KY:** " 9 × 9 =?"

### `data.tasks.g3r_adjl1_q3_b`

- **categories:** length_outlier
- **RU:** "Высокий дерево"
- **EN:** "Высокий дерево (wrong masculine ending)"
- **KY:** "Высокий дерево (туура эмес эркек род)"

### `data.tasks.g3w_poaching_is`

- **categories:** length_outlier
- **RU:** "Браконьер охотится незаконно. Что такое браконьерство?"
- **EN:** "What is poaching?"
- **KY:** " Мыйзамсыз аң уулоо деген эмне?"

### `data.tasks.g4e_quest3_q1`

- **categories:** length_outlier
- **RU:** "Тали ответил: «Do you like cats?» → «Yes, I likes.» Spark говорит: «Нет, Тали, краткий ответ — это...»"
- **EN:** "Choose: ___ books do you have?"
- **KY:** " Choose: ___ books do you have?"

### `data.tasks.g4e_quest3_q1_a`

- **categories:** option_set_inconsistent
- **RU:** "Yes, I does."
- **EN:** "Where"
- **KY:** "Where"

### `data.tasks.g4e_quest3_q1_b`

- **categories:** option_set_inconsistent
- **RU:** "Yes, I do."
- **EN:** "How many"
- **KY:** "How many"

### `data.tasks.g4e_quest3_q1_c`

- **categories:** option_set_inconsistent
- **RU:** "Yes, I am."
- **EN:** "What"
- **KY:** "What"

### `data.tasks.g4e_quest3_q3`

- **categories:** length_outlier
- **RU:** "Тали отвечает: «Did they visit the museum?» → «Yes, they are.» Spark говорит: «Нет! Вопрос с Did — ответ тоже с...»"
- **EN:** "Choose: ___ is your school bag?"
- **KY:** " Choose: ___ is your school bag?"

### `data.tasks.g4e_quest3_q3_a`

- **categories:** option_set_inconsistent
- **RU:** "Yes, they is."
- **EN:** "When"
- **KY:** "When"

### `data.tasks.g4e_quest3_q3_b`

- **categories:** option_set_inconsistent
- **RU:** "Yes, they are."
- **EN:** "Who"
- **KY:** "Who"

### `data.tasks.g4e_quest3_q3_c`

- **categories:** option_set_inconsistent
- **RU:** "Yes, they did."
- **EN:** "Where"
- **KY:** "Where"

### `data.tasks.g4e_quest_q3`

- **categories:** length_outlier
- **RU:** "Тали спрашивает про сестру: «Do your sister go to the same school?» Spark говорит, что помощник выбран неверно. Как правильно?"
- **EN:** "Choose: ___ is your favourite colour?"
- **KY:** " Choose: ___ is your favourite colour?"

### `data.tasks.g4e_quest_q3_a`

- **categories:** option_set_inconsistent
- **RU:** "Do"
- **EN:** "How"
- **KY:** "How"

### `data.tasks.g4e_quest_q3_b`

- **categories:** option_set_inconsistent
- **RU:** "Are"
- **EN:** "Where"
- **KY:** "Where"

### `data.tasks.g4e_quest_q3_c`

- **categories:** option_set_inconsistent
- **RU:** "Does"
- **EN:** "What"
- **KY:** "What"

### `data.tasks.g4r_cases2_q2`

- **categories:** length_outlier
- **RU:** "«Я дал корм собака.» Как правильно?"
- **EN:** "Tali wrote a letter: “Я дал корм собака.” Word says the case is wrong. “Дал кому?” — so you need…"
- **KY:** "Тали кат жазды: «Я дал корм собака.» Сөз жөндөмө туура эмес дейт. «Дал кому?» — демек керек…"

### `data.tasks.g4r_cases2_q2_a`

- **categories:** option_set_inconsistent
- **RU:** "Дательный: «собаке»"
- **EN:** "Dative: «собаке»"
- **KY:** "Барыш: «собаке»"

### `data.tasks.g4r_cases2_q2_b`

- **categories:** option_set_inconsistent
- **RU:** "Именительный: «собака»"
- **EN:** "Nominative: «собака»"
- **KY:** "Атооч: «собака»"

### `data.tasks.g4r_cases2_q2_c`

- **categories:** option_set_inconsistent
- **RU:** "Родительный: «собаки»"
- **EN:** "Genitive: «собаки»"
- **KY:** "Илик: «собаки»"

### `data.tasks.g4r_cases2_q3`

- **categories:** length_outlier
- **RU:** "«Не хватает ___» (друг). Какой падеж?"
- **EN:** "Tali didn’t wait for his friend and wrote: “Подожди — не хватает ___ (друг).” Which case is needed?"
- **KY:** "Тали досун күтпөй калып жазды: «Подожди — не хватает ___ (друг).» Кайсы жөндөмө керек?"

### `data.tasks.g4r_cases2_q3_a`

- **categories:** option_set_inconsistent
- **RU:** "друг (именительный)"
- **EN:** "друг (nominative)"
- **KY:** "друг (атооч)"

### `data.tasks.g4r_cases2_q3_b`

- **categories:** option_set_inconsistent
- **RU:** "друга (родительный)"
- **EN:** "друга (genitive)"
- **KY:** "друга (илик)"

### `data.tasks.g4r_cases2_q3_c`

- **categories:** option_set_inconsistent
- **RU:** "другу (дательный)"
- **EN:** "другу (dative)"
- **KY:** "другу (барыш)"

### `data.tasks.g4r_cases2_q4`

- **categories:** length_outlier
- **RU:** "«Отправить письмо ___» (мама)."
- **EN:** "The dinosaur mail carrier delivers letters: “Отправить письмо ___ (мама).” Put the word in the correct case."
- **KY:** "Динозавр-почтальон каттарды таратат: «Отправить письмо ___ (мама).» Сөздү туура жөндөмөгө кой."

### `data.tasks.g4r_cases3_q1`

- **categories:** length_outlier
- **RU:** "«Мы говорили о лес.» Как правильно?"
- **EN:** "Tali wrote: “Мы говорили о лес.” Word looks and says: “Tali, here you need the prepositional case — it always comes with a preposition!” What’s correct?"
- **KY:** "Тали жазды: «Мы говорили о лес.» Сөз карап айтат: «Тали, бул жерде предложный жөндөмө керек — ал ар дайым предлог менен!» Кантип туура?"

### `data.tasks.g4r_cases3_q1_a`

- **categories:** option_set_inconsistent
- **RU:** "Предложный: «о лесе»"
- **EN:** "Prepositional: «о лесе»"
- **KY:** "Жатыш/предложный: «о лесе»"

### `data.tasks.g4r_cases3_q1_b`

- **categories:** option_set_inconsistent
- **RU:** "Винительный: «о лес»"
- **EN:** "Accusative: «о лес»"
- **KY:** "Табыш: «о лес»"

### `data.tasks.g4r_cases3_q1_c`

- **categories:** option_set_inconsistent
- **RU:** "Дательный: «о лесу»"
- **EN:** "Dative: «о лесу»"
- **KY:** "Барыш: «о лесу»"

### `data.tasks.g4r_cases3_q2`

- **categories:** length_outlier
- **RU:** "«Я стал ___» (художник)."
- **EN:** "Tali draws a self-portrait and writes a caption: “Я стал ___ (художник).” Which case is needed after «стал»?"
- **KY:** "Тали автопортрет тартып, колтамга жазат: «Я стал ___ (художник).» «Стал» сөзүнөн кийин кайсы жөндөмө керек?"

### `data.tasks.g4r_cases3_q2_a`

- **categories:** option_set_inconsistent
- **RU:** "художник (именительный)"
- **EN:** "художник (nominative)"
- **KY:** "художник (атооч)"

### `data.tasks.g4r_cases3_q2_b`

- **categories:** option_set_inconsistent
- **RU:** "художником (творительный)"
- **EN:** "художником (instrumental)"
- **KY:** "художником (творительный)"

### `data.tasks.g4r_cases3_q2_c`

- **categories:** option_set_inconsistent
- **RU:** "художнику (дательный)"
- **EN:** "художнику (dative)"
- **KY:** "художнику (барыш)"

### `data.tasks.g4r_cases3_q3`

- **categories:** length_outlier
- **RU:** "Какой падеж всегда употребляется с предлогом?"
- **EN:** "Word asks Tali: “Which case is never used without a preposition?” Tali thinks and says: “Dative!” Is Tali right?"
- **KY:** "Сөз Талиден сурайт: «Кайсы жөндөмө эч качан предлогсуз колдонулбайт?» Тали ойлонуп айтат: «Дательный!» Тали туурабы?"

### `data.tasks.g4r_cases3_q3_a`

- **categories:** option_set_inconsistent
- **RU:** "Да, Тали прав — дательный"
- **EN:** "Yes, Tali is right — dative"
- **KY:** "Ооба, Тали туура — барыш"

### `data.tasks.g4r_cases3_q3_b`

- **categories:** option_set_inconsistent
- **RU:** "Нет, это предложный — только он всегда с предлогом"
- **EN:** "No, it’s prepositional — only that one always takes a preposition"
- **KY:** "Жок, бул предложный — бир гана ал ар дайым предлог менен"

### `data.tasks.g4r_cases3_q3_c`

- **categories:** option_set_inconsistent
- **RU:** "Нет, это творительный"
- **EN:** "No, it’s instrumental"
- **KY:** "Жок, бул творительный"

### `data.tasks.g4r_cases_q2`

- **categories:** length_outlier
- **RU:** "Найди подлежащее: «Книга лежит на столе.»"
- **EN:** "Word asks to find the subject in “Книга лежит на столе.” Tali answers: “The subject is «столе»!” Is that correct?"
- **KY:** "Сөз «Книга лежит на столе» сүйлөмүнөн ээни табууну суранат. Тали жооп берет: «Ээ — «столе»!» Туурабы?"

### `data.tasks.g4r_cases_q2_a`

- **categories:** option_set_inconsistent
- **RU:** "Нет, подлежащее «книга» — она в именительном падеже"
- **EN:** "No, the subject is «книга» — it’s in the nominative"
- **KY:** "Жок, ээ — «книга», ал атооч жөндөмөдө"

### `data.tasks.g4r_cases_q2_b`

- **categories:** option_set_inconsistent
- **RU:** "столе"
- **EN:** "Yes, Tali is right"
- **KY:** "Ооба, Тали туура"

### `data.tasks.g4r_cases_q2_c`

- **categories:** option_set_inconsistent
- **RU:** "подлежащего нет"
- **EN:** "There is no subject"
- **KY:** "Ээ жок"

### `data.tasks.g4r_conj2_q1`

- **categories:** length_outlier
- **RU:** "«Мы петь вместе!» Как правильно?"
- **EN:** "Tali wrote in his play: “Мы петь вместе на сцене!” Word says that isn’t a conjugated verb. What’s correct?"
- **KY:** "Тали пьесасына жазды: «Мы петь вместе на сцене!» Сөз бул жакталган этиш эмес дейт. Кантип туура?"

### `data.tasks.g4r_conj2_q1_a`

- **categories:** option_set_inconsistent
- **RU:** "Мы поём"
- **EN:** "Мы поём"
- **KY:** "Мы поём"

### `data.tasks.g4r_conj2_q1_b`

- **categories:** option_set_inconsistent
- **RU:** "Мы поёте"
- **EN:** "Мы поёте"
- **KY:** "Мы поёте"

### `data.tasks.g4r_conj2_q1_c`

- **categories:** option_set_inconsistent
- **RU:** "Мы поют"
- **EN:** "Мы поют"
- **KY:** "Мы поют"

### `data.tasks.g4r_conj2_q2`

- **categories:** length_outlier
- **RU:** "«Он читает книгу» → «Они ___ книгу»."
- **EN:** "Tali changes a line in the play: “Он читает книгу” → “Они ___ книгу.” What changes in the verb?"
- **KY:** "Тали пьесадагы репликаны өзгөртөт: «Он читает книгу» → «Они ___ книгу.» Этиште эмне өзгөрөт?"

### `data.tasks.g4r_conj2_q2_a`

- **categories:** option_set_inconsistent
- **RU:** "читают"
- **EN:** "читают"
- **KY:** "читают"

### `data.tasks.g4r_conj2_q2_b`

- **categories:** option_set_inconsistent
- **RU:** "читает"
- **EN:** "читает"
- **KY:** "читает"

### `data.tasks.g4r_conj2_q2_c`

- **categories:** option_set_inconsistent
- **RU:** "читали"
- **EN:** "читали"
- **KY:** "читали"

### `data.tasks.g4r_conj2_q3`

- **categories:** length_outlier
- **RU:** "«Вы знаешь правильный ответ?» Форма верна?"
- **EN:** "Word asks Tali a line for the play: “Вы ___ правильный ответ?” (verb «знать»). Tali wrote «знаешь». Is that correct?"
- **KY:** "Сөз Талиге пьеса үчүн суроо берет: «Вы ___ правильный ответ?» («знать» этиши). Тали «знаешь» деп жазды. Туурабы?"

### `data.tasks.g4r_conj2_q3_a`

- **categories:** option_set_inconsistent
- **RU:** "Нет, нужно «знаете»"
- **EN:** "No, the correct form is «знаете»"
- **KY:** "Жок, туурасы «знаете»"

### `data.tasks.g4r_conj2_q3_b`

- **categories:** length_outlier, option_set_inconsistent
- **RU:** "Да, верна"
- **EN:** "Yes, «знаешь» is correct"
- **KY:** "Ооба, «знаешь» туура"

### `data.tasks.g4r_conj2_q3_c`

- **categories:** option_set_inconsistent
- **RU:** "Нет, нужно «знают»"
- **EN:** "No, the correct form is «знают»"
- **KY:** "Жок, туурасы «знают»"

### `data.tasks.g4r_conj2_q4`

- **categories:** length_outlier
- **RU:** "«Они ___ через лес» (глагол «идти»)."
- **EN:** "In Tali’s play, a squad of dinosaur knights set out on a hike. “Они ___ через лес.” Put the verb «идти» in the correct form."
- **KY:** "Талинин пьесасында динозавр-рыцарлар отряды жортуулга чыкты. «Они ___ через лес.» «Идти» этишин туура формада кой."

### `data.tasks.g4r_conj3_q3`

- **categories:** length_outlier
- **RU:** "«Мы бежит к финишу!» Как правильно?"
- **EN:** "Tali wrote the last line of the play: “Мы бежит к финишу!” Word says the verb form is wrong. Fix it for Tali!"
- **KY:** "Тали пьесанын акыркы репликасын жазды: «Мы бежит к финишу!» Сөз этиштин формасы туура эмес дейт. Тали үчүн оңдоп кой!"

### `data.tasks.g4r_conj3_q3_a`

- **categories:** option_set_inconsistent
- **RU:** "бежит"
- **EN:** "бежит"
- **KY:** "бежит"

### `data.tasks.g4r_conj3_q3_b`

- **categories:** option_set_inconsistent
- **RU:** "бежите"
- **EN:** "бежите"
- **KY:** "бежите"

### `data.tasks.g4r_conj3_q3_c`

- **categories:** option_set_inconsistent
- **RU:** "бежим"
- **EN:** "бежим"
- **KY:** "бежим"

### `data.tasks.g4r_conj_q1_b`

- **categories:** length_outlier
- **RU:** "Да, верна"
- **EN:** "Yes, the form is correct"
- **KY:** "Ооба, форма туура"

### `data.tasks.g4r_conj_q2`

- **categories:** length_outlier
- **RU:** "Как сказать «читать» про ты?"
- **EN:** "Word asks Tali: what is the verb «читать» for «ты»? Tali is thinking… Help him!"
- **KY:** "Сөз Талиден сурайт: «читать» этиши «ты» үчүн кандай болот? Тали ойлонуп жатат… Ага жардам бер!"

### `data.tasks.g4r_conj_q2_a`

- **categories:** option_set_inconsistent
- **RU:** "читаешь"
- **EN:** "читаешь"
- **KY:** "читаешь"

### `data.tasks.g4r_conj_q2_b`

- **categories:** option_set_inconsistent
- **RU:** "читает"
- **EN:** "читает"
- **KY:** "читает"

### `data.tasks.g4r_conj_q2_c`

- **categories:** option_set_inconsistent
- **RU:** "читали"
- **EN:** "читали"
- **KY:** "читали"

### `data.tasks.g4r_text2_q1_b`

- **categories:** length_outlier
- **RU:** "Ёж всегда злой"
- **EN:** "The hedgehog is always angry and doesn’t want to talk"
- **KY:** "Кирпи ар дайым ачуулуу жана сүйлөшкүсү келбейт"

### `data.tasks.g4r_text2_q3`

- **categories:** length_outlier
- **RU:** "Расставь по порядку. Какое предложение первое?"
- **EN:** "Tali mixed up the sentences of his rain story. Which should come first so the text makes sense?"
- **KY:** "Тали жамгыр жөнүндөгү аңгемесинин сүйлөмдөрүн аралаштырып жиберди. Текст байланыштуу болушу үчүн кайсыны биринчи коюш керек?"

### `data.tasks.g4r_text2_q3_a`

- **categories:** option_set_inconsistent
- **RU:** "Сначала пошёл дождь."
- **EN:** "First it started to rain."
- **KY:** "Адегенде жамгыр жаады."

### `data.tasks.g4r_text2_q3_b`

- **categories:** option_set_inconsistent
- **RU:** "Поэтому лужи блестели."
- **EN:** "That’s why the puddles sparkled."
- **KY:** "Ошондуктан көлчүктөр жылтырады."

### `data.tasks.g4r_text2_q3_c`

- **categories:** option_set_inconsistent
- **RU:** "Наконец стало темно."
- **EN:** "At last it grew dark."
- **KY:** "Акыры караңгы болду."

### `data.tasks.g4r_text2_q4`

- **categories:** length_outlier
- **RU:** "Где чаще всего находится главная мысль текста?"
- **EN:** "Word asks Tali: “Where does the main idea of a story most often hide?” Tali says: “Only in the middle!” Is that true?"
- **KY:** "Сөз Талиден сурайт: «Аңгеменин негизги ою көбүнчө кайда жашынат?» Тали айтат: «Бир гана ортосунда!» Туурабы?"

### `data.tasks.g4r_text3_q1`

- **categories:** length_outlier
- **RU:** "Что было первым: нашла гриб, позвала сестру, набрали корзину?"
- **EN:** "Tali read: “Сначала Маша нашла гриб. Потом позвала сестру. Наконец они набрали полную корзину.” He thinks “позвала сестру” came first. Correct Tali — what happened first?"
- **KY:** "Тали окуду: «Сначала Маша нашла гриб. Потом позвала сестру. Наконец они набрали полную корзину.» Ал «позвала сестру» биринчи болду деп ойлойт. Талини оңдо — эң биринчи эмне болду?"

### `data.tasks.g4r_text3_q1_a`

- **categories:** option_set_inconsistent
- **RU:** "набрали корзину"
- **EN:** "they filled the basket"
- **KY:** "себетти толтурушту"

### `data.tasks.g4r_text3_q1_b`

- **categories:** option_set_inconsistent
- **RU:** "позвала сестру"
- **EN:** "she called her sister"
- **KY:** "эжесин чакырды"

### `data.tasks.g4r_text3_q1_c`

- **categories:** option_set_inconsistent
- **RU:** "нашла гриб"
- **EN:** "she found a mushroom"
- **KY:** "козу карын тапты"

### `data.tasks.g4r_text_q2_b`

- **categories:** length_outlier
- **RU:** "концовка"
- **EN:** "the ending (концовка)"
- **KY:** "концовка (аягы)"

### `data.tasks.g4r_text_q4`

- **categories:** length_outlier
- **RU:** "Как называется первая часть рассказа?"
- **EN:** "Tali writes a story about a kitten. He calls the first part “table of contents.” Word says that name is wrong. What is the first part of a story really called?"
- **KY:** "Тали мышык баласы жөнүндө аңгеме жазат. Биринчи бөлүктү «мазмуну» деп атат. Сөз ат туура эмес дейт. Аңгеменин биринчи бөлүгү чындыгында кандай аталат?"

### `data.tasks.nrw_fconl1_t3_q`

- **categories:** length_outlier
- **RU:** "Найди слово, которое начинается на С."
- **EN:** "Tali is looking for a word that starts with the letter С. He says: \"It's Мышка (mouse)!\" Help him find the right one."
- **KY:** "Тали С тамгасына сөз издейт. «Бул Мышка!» — дейт. Туурасын табууга жардам бер."

### `data.tasks.nrw_fconl3_t2_q`

- **categories:** length_outlier
- **RU:** "Буква Н — гласная или согласная?"
- **EN:** "Is the letter Н a vowel or a consonant? Tali thinks it's a vowel because \"it sounds soft.\" Is he right?"
- **KY:** "Н тамгасы үндүүбү же үнсүзбү? Тали аны үндүү деп ойлойт, анткени «жумшак угулат». Ал туурабы?"

### `data.tasks.nrw_fsyll2_t3_q`

- **categories:** length_outlier
- **RU:** "Слово СО-ВА. Сколько слогов?"
- **EN:** "Tali is flying on an owl. SO-VA — how many syllable-bricks are in the name of his ride?"
- **KY:** "Тали үкүдө учуп баратат. СО-ВА — анын унаасынын атында канча муун бар?"

### `data.tasks.nrw_fsyll3_t2_q`

- **categories:** length_outlier
- **RU:** "Слово НО-РА. Сколько слогов?"
- **EN:** "The fox invited Tali into her burrow (NORA). How many syllables are in the word NORA?"
- **KY:** "Түлкү Талини НО-РУ дегенге чакырды. НОРА сөзүндө канча муун бар?"

### `data.tasks.nrw_fvl1_t4_q`

- **categories:** length_outlier
- **RU:** "В каком слове нет буквы А?"
- **EN:** "A spy hid the letter A in one of the words. Which word doesn't have it — that's where the spy wasn't hiding!"
- **KY:** "Тыңчы А тамгасын сөздөрдүн биринде жашырды. Кайсы сөздө ал жок — ошол жерде тыңчы жашынган эмес!"

### `data.tasks.nrw_ganiml3_t1_q`

- **categories:** length_outlier
- **RU:** "Где живёт рыба?"
- **EN:** "Tali is an underwater explorer! He found a little fish. Where do fish live?"
- **KY:** "Тали суу астындагы изилдөөчү! Ал майда балык тапты. Балык кайда жашайт?"

### `data.tasks.nrw_ganiml3_t4_q`

- **categories:** length_outlier
- **RU:** "Крылья, клюв, поёт. Это:"
- **EN:** "Tali sees a creature with wings and a beak through his binoculars. It sings. What is it?"
- **KY:** "Тали дурбу менен канаттуу жана тумшуктуу жандыкты көрөт. Ал ырдайт. Бул ким?"

### `data.tasks.nrw_gcoll1_t4_b`

- **categories:** length_outlier
- **RU:** "Морковка"
- **EN:** "No — the sky is blue!"
- **KY:** "Жок — асман көк!"

### `data.tasks.nrw_gseasl1_t1_q`

- **categories:** length_outlier
- **RU:** "Листья летят с деревьев. Хруст. Какое время года?"
- **EN:** "Tali is walking through the park and hears crunching. Leaves are falling from the trees. \"It's summer!\" says Tali. What season is it?"
- **KY:** "Тали парк аралап баратып, бут астынан кыртылдаган добуш угат. Дарактардан жалбырактар түшүп жатат. «Бул жай!» — дейт Тали. Кайсы мезгил?"

### `data.tasks.nrw_gseasl2_t3_q`

- **categories:** length_outlier
- **RU:** "Когда птицы прилетают из тёплых стран?"
- **EN:** "Tali hears a familiar song in the sky — the birds are back! In which season do birds return from warm countries?"
- **KY:** "Тали асманда тааныш ырды угат — куштар кайтып келди! Куштар жылуу өлкөлөрдөн кайсы мезгилде учуп келет?"

### `data.tasks.nrw_ianiml2_t2_q`

- **categories:** length_outlier
- **RU:** "Where does a fish live?"
- **EN:** "Tali drops his toy fish in the tank. Where does a fish live?"
- **KY:** "Тали оюнчук балыгын аквариумга салат. Балык кайда жашайт?"

### `data.tasks.nrw_icoll1_t3_q`

- **categories:** length_outlier
- **RU:** "Is grass GREEN?"
- **EN:** "Tali runs across the grass. Is grass GREEN?"
- **KY:** "Тали чөп аркылуу чуркайт. Чөп GREEN түстөбү?"

