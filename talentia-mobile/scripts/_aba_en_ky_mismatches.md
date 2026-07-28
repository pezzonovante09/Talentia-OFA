# ABA EN/KY semantic mismatches (heuristic)

Generated: 2026-07-28T10:13:30.428Z

## Summary

- RU ABA keys: **4197**
- EN override keys: **4197**
- KY override keys: **4197**
- Flagged (any mismatch category): **70**
- OK (heuristic): **4127**

### By category

- `option_set_inconsistent`: 42
- `length_outlier`: 34

> Heuristic only — not full human semantic review. `length_outlier` often means EN/KY still holds the long standard-locale wording while RU ABA is shortened (same skill possible).

## Mismatches

### `data.intro.g2m_add2l1_0_b`

- **categories:** length_outlier
- **RU:** "20 + 30: смотри только на десятки: 2 + 3 = 5, добавь нолик → 50. Нули «не мешают», они просто показывают, что это десятки!"
- **EN:** "20 + 30: 2 tens + 3 tens = 5 tens = 50."
- **KY:** "20 + 30: 2 ондук + 3 ондук = 5 ондук = 50."

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

### `data.tasks.g3r_adjl1_q3_b`

- **categories:** length_outlier
- **RU:** "Высокий дерево"
- **EN:** "Высокий дерево (wrong masculine ending)"
- **KY:** "Высокий дерево (туура эмес эркек род)"

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

### `data.tasks.g4e_quest_q4`

- **categories:** length_outlier
- **RU:** "Инопланетянин приземлился и задаёт вопрос: «___ humans sleep at night?» Какое слово начинает вопрос?"
- **EN:** "Choose: ___ did you go yesterday?"
- **KY:** " Choose: ___ did you go yesterday?"

### `data.tasks.g4e_quest_q4_a`

- **categories:** option_set_inconsistent
- **RU:** "Are"
- **EN:** "What"
- **KY:** "What"

### `data.tasks.g4e_quest_q4_b`

- **categories:** option_set_inconsistent
- **RU:** "Do"
- **EN:** "Where"
- **KY:** "Where"

### `data.tasks.g4e_quest_q4_c`

- **categories:** option_set_inconsistent
- **RU:** "Is"
- **EN:** "Who"
- **KY:** "Who"

### `data.tasks.g4s_help2_q1`

- **categories:** length_outlier
- **RU:** "«Дай мне ластик!» vs. «Можешь одолжить ластик, пожалуйста?» Какой вариант вежливее?"
- **EN:** "What does \"mutual assistance\" mean?"
- **KY:** " Что значит «взаимопомощь»?"

### `data.tasks.g4s_help2_q1_a`

- **categories:** option_set_inconsistent
- **RU:** "Первый — он короткий и понятный"
- **EN:** "Помогать только себе"
- **KY:** "Помогать только себе"

### `data.tasks.g4s_help2_q1_b`

- **categories:** option_set_inconsistent
- **RU:** "Второй — вежливый вопрос, а не приказ"
- **EN:** "Помогать друг другу"
- **KY:** "Помогать друг другу"

### `data.tasks.g4s_help2_q1_c`

- **categories:** option_set_inconsistent
- **RU:** "Оба одинаково вежливые"
- **EN:** "Просить помощи"
- **KY:** "Просить помощи"

### `data.tasks.g4s_help2_q3_b`

- **categories:** length_outlier
- **RU:** "Ничего не говорить — и так понятно"
- **EN:** "Не смотреть"
- **KY:** "Не смотреть"

### `data.tasks.g4s_help3_q1`

- **categories:** length_outlier
- **RU:** "Маша потеряла рюкзак на перемене. К кому ей сначала обратиться?"
- **EN:** "Why help strangers?"
- **KY:** " Зачем помогают незнакомым?"

### `data.tasks.g4s_help3_q1_a`

- **categories:** length_outlier, option_set_inconsistent
- **RU:** "Сначала спорить с одноклассниками, кто взял"
- **EN:** "Ради награды"
- **KY:** "Ради награды"

### `data.tasks.g4s_help3_q1_b`

- **categories:** length_outlier, option_set_inconsistent
- **RU:** "Сначала к учителю или в учительскую, потом действовать по указанию взрослых"
- **EN:** "Из сочувствия и доброты"
- **KY:** "Из сочувствия и доброты"

### `data.tasks.g4s_help3_q1_c`

- **categories:** option_set_inconsistent
- **RU:** "Никуда не обращаться — само найдётся"
- **EN:** "Из обязанности"
- **KY:** "Из обязанности"

### `data.tasks.g4s_help3_q2`

- **categories:** length_outlier
- **RU:** "Младший брат Тали плачет, но не говорит почему. Что поможет ему рассказать о своей проблеме?"
- **EN:** "What is a volunteer?"
- **KY:** " Ыктыярчы деген эмне?"

### `data.tasks.g4s_help3_q2_a`

- **categories:** option_set_inconsistent
- **RU:** "Кричать: «Говори немедленно!»"
- **EN:** "Помогает за деньги"
- **KY:** "Помогает за деньги"

### `data.tasks.g4s_help3_q2_b`

- **categories:** option_set_inconsistent
- **RU:** "Спокойно спросить и выслушать"
- **EN:** "Помогает добровольно"
- **KY:** "Помогает добровольно"

### `data.tasks.g4s_help3_q2_c`

- **categories:** option_set_inconsistent
- **RU:** "Отвернуться — сам успокоится"
- **EN:** "Просит помощи"
- **KY:** "Просит помощи"

### `data.tasks.g4s_help3_q3`

- **categories:** length_outlier
- **RU:** "Тали хочет помочь пожилой соседке донести сумку. Как правильно предложить помощь, чтобы не обидеть?"
- **EN:** "How to react if you were helped?"
- **KY:** " Сага жардам бергенде кандай жооп берүү керек?"

### `data.tasks.g4s_help3_q3_a`

- **categories:** option_set_inconsistent
- **RU:** "«Дай я сам — ты слабая»"
- **EN:** "Промолчать"
- **KY:** "Промолчать"

### `data.tasks.g4s_help3_q3_b`

- **categories:** option_set_inconsistent
- **RU:** "«Мне не нужна твоя помощь» (это чужая реплика, не предложение)"
- **EN:** "Убежать"
- **KY:** "Убежать"

### `data.tasks.g4s_help3_q3_c`

- **categories:** option_set_inconsistent
- **RU:** "«Могу помочь донести?»"
- **EN:** "Сказать «спасибо»"
- **KY:** "Сказать «спасибо»"

### `data.tasks.g4s_help3_q4`

- **categories:** length_outlier
- **RU:** "Учитель объяснил тему, но Тали не понял. Тали говорит: «Подниму руку прямо сейчас и перебью!» Friendly морщится. Как лучше поступить?"
- **EN:** "What should you do if you see that someone is ill?"
- **KY:** " Что делать, если видишь, что кому-то плохо?"

### `data.tasks.g4s_help3_q4_a`

- **categories:** option_set_inconsistent
- **RU:** "Перебить с места громко"
- **EN:** "Не замечать"
- **KY:** "Не замечать"

### `data.tasks.g4s_help3_q4_b`

- **categories:** option_set_inconsistent
- **RU:** "Подойти после урока или поднять руку в подходящий момент"
- **EN:** "Спросить: «Тебе помочь?»"
- **KY:** "Спросить: «Тебе помочь?»"

### `data.tasks.g4s_help3_q4_c`

- **categories:** option_set_inconsistent
- **RU:** "Шептать на весь класс"
- **EN:** "Позвать смотреть"
- **KY:** "Позвать смотреть"

### `data.tasks.g4s_help_q1`

- **categories:** length_outlier
- **RU:** "Тали стоит с пакетами перед тяжёлой дверью и говорит: «Сам справлюсь!» — и продолжает толкать её ногой. Это мудрое решение?"
- **EN:** "What if a friend falls and gets hurt?"
- **KY:** " Что сделать, если друг упал и поранился?"

### `data.tasks.g4s_help_q1_a`

- **categories:** length_outlier, option_set_inconsistent
- **RU:** "Да, надо всегда справляться самому"
- **EN:** "Посмеяться"
- **KY:** "Посмеяться"

### `data.tasks.g4s_help_q1_b`

- **categories:** option_set_inconsistent
- **RU:** "Нет — лучше попросить кого-то придержать дверь"
- **EN:** "Помочь и позвать взрослого"
- **KY:** "Помочь и позвать взрослого"

### `data.tasks.g4s_help_q1_c`

- **categories:** option_set_inconsistent
- **RU:** "Да, можно и дальше толкать ногой"
- **EN:** "Уйти"
- **KY:** "Уйти"

### `data.tasks.g4s_help_q3`

- **categories:** length_outlier
- **RU:** "Одноклассник не понимает задание, но молчит и расстраивается. Что ему стоит сделать?"
- **EN:** "What does it mean to “help”?"
- **KY:** " Что значит «помогать»?"

### `data.tasks.g4s_help_q3_a`

- **categories:** option_set_inconsistent
- **RU:** "Молчать и злиться дальше"
- **EN:** "Делать всё за другого"
- **KY:** "Делать всё за другого"

### `data.tasks.g4s_help_q3_b`

- **categories:** option_set_inconsistent
- **RU:** "Смеяться над собственной ошибкой"
- **EN:** "Не обращать внимания"
- **KY:** "Не обращать внимания"

### `data.tasks.g4s_help_q3_c`

- **categories:** option_set_inconsistent
- **RU:** "Сказать учителю или попросить одноклассника объяснить"
- **EN:** "Поддерживать в нужный момент"
- **KY:** "Поддерживать в нужный момент"

### `data.tasks.g4s_help_q4`

- **categories:** length_outlier
- **RU:** "Тали первый раз едет в новый район и не знает дороги. Он говорит: «Буду ехать наугад — не хочу спрашивать, это стыдно.» Согласен ли с ним Friendly?"
- **EN:** "How do you feel about helping others?"
- **KY:** " Башкаларга жардам берип жатканда өзүңдү кандай сезесиң?"

### `data.tasks.g4s_help_q4_a`

- **categories:** option_set_inconsistent
- **RU:** "Да, лучше разобраться самому"
- **EN:** "Плохо"
- **KY:** "Плохо"

### `data.tasks.g4s_help_q4_b`

- **categories:** length_outlier, option_set_inconsistent
- **RU:** "Нет — лучше спокойно спросить взрослого и назвать адрес"
- **EN:** "Хорошо и радостно"
- **KY:** "Хорошо и радостно"

### `data.tasks.g4s_help_q4_c`

- **categories:** option_set_inconsistent
- **RU:** "Да, просить помощи — это стыдно"
- **EN:** "Никак"
- **KY:** "Никак"

### `data.tasks.g4s_turn2_q1`

- **categories:** length_outlier
- **RU:** "Тали не знает, как честно разделить самокат между тремя друзьями. Friendly предлагает варианты. Какой самый справедливый?"
- **EN:** "Another is playing with a toy. What will you do?"
- **KY:** " Другой играет с игрушкой. Что сделаешь?"

### `data.tasks.g4s_turn2_q1_a`

- **categories:** length_outlier, option_set_inconsistent
- **RU:** "Тали берёт самокат себе — он же хозяин"
- **EN:** "Take it away"
- **KY:** "Тартып алуу"

### `data.tasks.g4s_turn2_q1_b`

- **categories:** option_set_inconsistent
- **RU:** "По очереди — каждому по одинаковому времени"
- **EN:** "Wait or ask politely"
- **KY:** "Күтүү же сылыктык менен суроо"

### `data.tasks.g4s_turn2_q1_c`

- **categories:** option_set_inconsistent
- **RU:** "Кто сильнее — тот и катается"
- **EN:** "Cry"
- **KY:** "Ыйлоо"

### `data.tasks.g4s_turn2_q2`

- **categories:** length_outlier
- **RU:** "Один ребёнок всегда берёт самый большой кусок пирога. Как объяснить ему про справедливость?"
- **EN:** "What is a compromise?"
- **KY:** " Компромисс деген эмне?"

### `data.tasks.g4s_turn2_q2_a`

- **categories:** length_outlier, option_set_inconsistent
- **RU:** "Решение, при котором всем понятно и никто не обижен — это и есть справедливость"
- **EN:** "A solution for both sides"
- **KY:** "Эки тарап үчүн чечим"

### `data.tasks.g4s_turn2_q2_b`

- **categories:** option_set_inconsistent
- **RU:** "Победа одного — это нормально"
- **EN:** "One person's victory"
- **KY:** "Бир адамдын жеңиши"

### `data.tasks.g4s_turn2_q2_c`

- **categories:** option_set_inconsistent
- **RU:** "Справедливость — это ссора"
- **EN:** "An argument"
- **KY:** "Талаш"

### `data.tasks.g4s_turn2_q3_a`

- **categories:** length_outlier
- **RU:** "Это слабость, уступать не надо"
- **EN:** "Weakness"
- **KY:** "Алсыздык"

### `data.tasks.g4s_turn2_q3_b`

- **categories:** length_outlier
- **RU:** "Это грубость в ответ на грубость"
- **EN:** "Rudeness"
- **KY:** "Дөрөкөлүк"

### `data.tasks.g4s_turn2_q3_c`

- **categories:** length_outlier
- **RU:** "Это решение, при котором каждая сторона чуть-чуть уступает ради общего блага"
- **EN:** "Willingness to compromise"
- **KY:** "Ийкемдүүлүк"

### `data.tasks.g4s_turn3_q4_a`

- **categories:** length_outlier
- **RU:** "Объявить — это правильно, Тали прав"
- **EN:** "Shout"
- **KY:** "Кыйкыруу"

### `data.tasks.g4s_turn3_q4_b`

- **categories:** length_outlier
- **RU:** "Сначала нужно поговорить со всеми участниками и получить согласие"
- **EN:** "Talk and find a solution together"
- **KY:** "Сүйлөшүп, чечим табуу"

### `data.tasks.g4s_turn_q1`

- **categories:** length_outlier
- **RU:** "Тали собирается прыгнуть к другу в середину очереди. Friendly тихо останавливает его. Как правильно поступить?"
- **EN:** "What does it mean to “wait your turn”?"
- **KY:** " Что значит «ждать своей очереди»?"

### `data.tasks.g4s_turn_q1_a`

- **categories:** option_set_inconsistent
- **RU:** "Прыгнуть — друг же позвал!"
- **EN:** "Take first"
- **KY:** "Биринчи алуу"

### `data.tasks.g4s_turn_q1_b`

- **categories:** option_set_inconsistent
- **RU:** "Уважать право других на очередь и встать в конец"
- **EN:** "Respect others and do not interrupt"
- **KY:** "Башкаларды урматтоо жана бөлбөө"

### `data.tasks.g4s_turn_q1_c`

- **categories:** option_set_inconsistent
- **RU:** "Кричать, чтобы пропустили быстрее"
- **EN:** "Shout louder"
- **KY:** "Катуураак кыйкыруу"

### `data.tasks.g4s_turn_q3_c`

- **categories:** length_outlier
- **RU:** "Потому что это нарушает право других на уважение"
- **EN:** "It shows respect"
- **KY:** "Бул урматтоонун белгиси"

### `data.tasks.g4s_turn_q4_b`

- **categories:** length_outlier
- **RU:** "Договориться заранее и соблюдать порядок"
- **EN:** "Raise your hand"
- **KY:** "Колду көтөрүү"

