# Locale semantic mismatch audit

> **Internal QA / AI-generated.** Self-review of the repo's own locale content, not feedback from a human reviewer, specialist, or user. See `docs/FIELD_TEST_FEEDBACK.md` for real field-test notes.

## 1. Birds / mc10l1-t2
### pre_birds_tree_vs_bush
- RU: На дереве 6 птичек, на кустике — 4. Тали думает, что на кустике больше, «потому что куст ближе». Прав?
- EN: Six birds sit in a tree, and four birds sit on a bush. Where are more birds?
- KY: Даракта 6 куш, бадалда — 4 куш. Кай жерде көбүрөөк?

### pre_opt_birds_equal_spots
- RU: Поровну
- EN: The same
- KY: Тең

### pre_opt_bush_four_birds
- RU: На дереве (где 6) больше
- EN: On the bush (4)
- KY: Бадалда (4)

### pre_opt_tree_six_birds
- RU: Тали прав
- EN: In the tree (6)
- KY: Даракта (6)

## 2. g4s_emo*
### g4s_emo2_q1
- taskId: `g4s-emo-l2-t1` correct: **b**
- options: a(N:g4s_emo2_q1_a), b(Y:g4s_emo2_q1_b), c(N:g4s_emo2_q1_c)
- RU: Тали злится на брата и хочет бросить вещь. Friendly останавливает его. Какой способ выразить злость безопасен для обоих?
- EN: Think it through: What is empathy?
- KY: Ойлонуп көр: Эмпатия деген эмне?

### g4s_emo2_q1_a
- RU: Ударить брата
- EN: Умение злиться
- KY: Умение злиться

### g4s_emo2_q1_b
- RU: Сказать, что обидно, и предложить исправить вместе
- EN: Понимать чувства других
- KY: Понимать чувства других

### g4s_emo2_q1_c
- RU: Сломать его игрушку в ответ
- EN: Молчать
- KY: Молчать

### g4s_emo2_q2
- taskId: `g4s-emo-l2-t2` correct: **b**
- options: a(N:g4s_emo2_q2_a), b(Y:g4s_emo2_q2_b), c(N:g4s_emo2_q2_c)
- RU: Перед выступлением на сцене сердце бьётся быстро и хочется убежать. Как называется эта эмоция?
- EN: Think it through: If a friend is upset, what do you need?
- KY: Ойлонуп көр: Досуң капа болсо, эмне кылуу керек?

### g4s_emo2_q2_a
- RU: Радость
- EN: Поддержать и выслушать
- KY: Поддержать и выслушать

### g4s_emo2_q2_b
- RU: Волнение и страх
- EN: Смеяться
- KY: Смеяться

### g4s_emo2_q2_c
- RU: Скука
- EN: Уйти
- KY: Уйти

### g4s_emo2_q3
- taskId: `g4s-emo-l2-t3` correct: **a**
- options: a(Y:g4s_emo2_q3_a), b(N:g4s_emo2_q3_b), c(N:g4s_emo2_q3_c)
- RU: Чем злость отличается от страха?
- EN: Think it through: What word is a positive emotion?
- KY: Ойлонуп көр: Какое слово — положительная эмоция?

### g4s_emo2_q3_a
- RU: Страх — реакция на угрозу, желание избежать; злость — реакция на несправедливость, желание изменить
- EN: Страх
- KY: Страх

### g4s_emo2_q3_b
- RU: Это одно и то же чувство
- EN: Злость
- KY: Злость

### g4s_emo2_q3_c
- RU: Злость всегда приятная
- EN: Восторг
- KY: Восторг

### g4s_emo2_q4
- taskId: `g4s-emo-l2-t4` correct: **a**
- options: a(Y:g4s_emo2_q4_a), b(N:g4s_emo2_q4_b), c(N:g4s_emo2_q4_c)
- RU: Тали прочитал: «Петя закричал и бросил тетрадь». Friendly спрашивает: «Тали, что Петя испытывал и что ему лучше было сделать?» Тали говорит: «Он был рад!» Это верно?
- EN: Think it through: How to express joy culturally?
- KY: Ойлонуп көр: Кубанычты маданияттуу түрдө кантип билдирүү керек?

### g4s_emo2_q4_a
- RU: Да, он был рад
- EN: Кричать
- KY: Кричать

### g4s_emo2_q4_b
- RU: Нет — он испытывал злость; лучше — остановиться и объяснить словами
- EN: Улыбнуться и сказать «ура!»
- KY: Улыбнуться и сказать «ура!»

### g4s_emo2_q4_c
- RU: Нет — он был напуган
- EN: Плакать
- KY: Плакать

### g4s_emo3_q1
- taskId: `g4s-emo-l3-t1` correct: **a**
- options: a(Y:g4s_emo3_q1_a), b(N:g4s_emo3_q1_b), c(N:g4s_emo3_q1_c)
- RU: Широко открытые глаза и приоткрытый рот после сюрприза — это признаки какой эмоции?
- EN: Think it through: Better mood
- KY: Ойлонуп көр: Что улучшает настроение?

### g4s_emo3_q1_a
- RU: Удивление
- EN: Ссора
- KY: Ссора

### g4s_emo3_q1_b
- RU: Злость
- EN: Любимое занятие или друг
- KY: Любимое занятие или друг

### g4s_emo3_q1_c
- RU: Равнодушие
- EN: Одиночество
- KY: Одиночество

### g4s_emo3_q2
- taskId: `g4s-emo-l3-t2` correct: **a**
- options: a(Y:g4s_emo3_q2_a), b(N:g4s_emo3_q2_b), c(N:g4s_emo3_q2_c)
- RU: Что называют «спокойствием»?
- EN: Think it through: Why is it important to name feelings?
- KY: Ойлонуп көр: Почему важно называть чувства?

### g4s_emo3_q2_a
- RU: Ровное, устойчивое внутреннее состояние
- EN: Это помогает понять себя
- KY: Это помогает понять себя

### g4s_emo3_q2_b
- RU: Постоянная сонливость
- EN: Чтобы пожаловаться
- KY: Чтобы пожаловаться

### g4s_emo3_q2_c
- RU: Только ощущение голода
- EN: Это не важно
- KY: Это не важно

### g4s_emo3_q3
- taskId: `g4s-emo-l3-t3` correct: **c**
- options: a(N:g4s_emo3_q3_a), b(N:g4s_emo3_q3_b), c(Y:g4s_emo3_q3_c)
- RU: Тали замолчал посреди разговора и начал дышать глубоко. Friendly спрашивает: «Что он делает?» Тали говорит: «Хочет уснуть!» Исправь Тали.
- EN: Think it through: What is self-control?
- KY: Ойлонуп көр: Өзүн-өзү көзөмөлдөө деген эмне?

### g4s_emo3_q3_a
- RU: Да, он засыпает
- EN: Делать всё что хочешь
- KY: Делать всё что хочешь

### g4s_emo3_q3_b
- RU: Нет — он пытается успокоиться и собраться с мыслями
- EN: Никогда не чувствовать
- KY: Никогда не чувствовать

### g4s_emo3_q3_c
- RU: Нет — он убегает из разговора
- EN: Управлять своими реакциями
- KY: Управлять своими реакциями

### g4s_emo3_q4
- taskId: `g4s-emo-l3-t4` correct: **b**
- options: a(N:g4s_emo3_q4_a), b(Y:g4s_emo3_q4_b), c(N:g4s_emo3_q4_c)
- RU: Удивление бывает приятным и неприятным. Пример каждого:
- EN: Think it through: You're afraid to perform. Which is better?
- KY: Ойлонуп көр: Ты боишься выступать. Что лучше?

### g4s_emo3_q4_a
- RU: Приятное: неожиданный комплимент; неприятное: плохая оценка, которую не ждал
- EN: Отказаться
- KY: Отказаться

### g4s_emo3_q4_b
- RU: Удивление бывает только неприятным
- EN: Сделать глубокий вдох и выйти
- KY: Сделать глубокий вдох и выйти

### g4s_emo3_q4_c
- RU: Удивления не существует
- EN: Убежать
- KY: Убежать

### g4s_emo_q1
- taskId: `g4s-emo-l1-t1` correct: **a**
- options: a(Y:g4s_emo_q1_a), b(N:g4s_emo_q1_b), c(N:g4s_emo_q1_c)
- RU: Друг Тали пришёл с опущенными плечами и тихим голосом. Какую эмоцию он, скорее всего, испытывает?
- EN: Think it through: You got a fiver. How do you feel?
- KY: Ойлонуп көр: Ты получил пятёрку. Что ты чувствуешь?

### g4s_emo_q1_a
- RU: Грусть
- EN: Sadness
- KY: Кайгы

### g4s_emo_q1_b
- RU: Радость
- EN: Радость и гордость
- KY: Радость и гордость

### g4s_emo_q1_c
- RU: Злость
- EN: Страх
- KY: Страх

### g4s_emo_q2
- taskId: `g4s-emo-l1-t2` correct: **a**
- options: a(Y:g4s_emo_q2_a), b(N:g4s_emo_q2_b), c(N:g4s_emo_q2_c)
- RU: Что у большинства людей вызывает настоящую радость?
- EN: Think it through: What is the name of the feeling when sad?
- KY: Ойлонуп көр: Капа болгондо пайда болгон сезим кантип аталат?

### g4s_emo_q2_a
- RU: Получить неожиданный подарок
- EN: Печаль
- KY: Печаль

### g4s_emo_q2_b
- RU: Потерять любимую вещь
- EN: Радость
- KY: Радость

### g4s_emo_q2_c
- RU: Скучать в очереди
- EN: Удивление
- KY: Удивление

### g4s_emo_q3
- taskId: `g4s-emo-l1-t3` correct: **b**
- options: a(N:g4s_emo_q3_a), b(Y:g4s_emo_q3_b), c(N:g4s_emo_q3_c)
- RU: Тали видит грустящего друга и говорит: «Не грусти!» Friendly качает головой. Почему это не лучшая поддержка и что лучше сделать?
- EN: Think it through: What helps to cope with anxiety?
- KY: Ойлонуп көр: Что помогает справиться с тревогой?

### g4s_emo_q3_a
- RU: Это лучшая поддержка — слова помогают
- EN: Игнорировать
- KY: Игнорировать

### g4s_emo_q3_b
- RU: Лучше просто побыть рядом и поддержать молчанием или тихим словом
- EN: Кричать
- KY: Кричать

### g4s_emo_q3_c
- RU: Лучше уйти — не мешать
- EN: Поговорить с близким
- KY: Поговорить с близким

### g4s_emo_q4
- taskId: `g4s-emo-l1-t4` correct: **b**
- options: a(N:g4s_emo_q4_a), b(Y:g4s_emo_q4_b), c(N:g4s_emo_q4_c)
- RU: Поднятые уголки губ, блеск в глазах — это какая эмоция?
- EN: Think it through: You're angry. What's right?
- KY: Ойлонуп көр: Ты злишься. Что правильно?

### g4s_emo_q4_a
- RU: Злость
- EN: Ударить
- KY: Ударить

### g4s_emo_q4_b
- RU: Радость
- EN: Сделать глубокий вдох
- KY: Сделать глубокий вдох

### g4s_emo_q4_c
- RU: Страх
- EN: Плакать
- KY: Плакать

## 3. g4m_md_*
### g4m_md_q1
- taskId: `g4m-md-l1-t1` correct: **b**
- options: a(N:g4m_md_q1_a), b(Y:g4m_md_q1_b), c(N:g4m_md_q1_c)
- RU: Тали читает надпись на карте: «3 475». Он запыхался и говорит: «Это три тысячи сорок семь тысяч пять!» Тали явно запутался. Как читается это число на самом деле?
- EN: Think it through: Solve: 24 × 3 =?
- KY: Ойлонуп көр: Чеч: 24 × 3 =?

### g4m_md_q1_a
- RU: Триста сорок семьдесят пять
- EN: 64
- KY: 64

### g4m_md_q1_b
- RU: Три тысячи четыреста семьдесят пять
- EN: 72
- KY: 72

### g4m_md_q1_c
- RU: Тридцать четыре тысячи семьдесят пять
- EN: 80
- KY: 80

### g4m_md_q2
- taskId: `g4m-md-l1-t2` correct: **a**
- options: a(Y:g4m_md_q2_a), b(N:g4m_md_q2_b), c(N:g4m_md_q2_c)
- RU: На складе у Digit лежат 12 080 апельсинов для праздника динозавров. Тали хочет написать на коробке «двенадцать тысяч восемьдесят», но не знает, как назвать это число правильно. Помоги ему: сколько здесь тысяч и сколько десятков?
- EN: Think it through: Decisions: 56 ÷ 8 =?
- KY: Ойлонуп көр: Чеч: 56 ÷ 8 =?

### g4m_md_q2_a
- RU: 12 тысяч 8 десятков
- EN: 7
- KY: 7

### g4m_md_q2_b
- RU: 12 тысяч 8 сотен
- EN: 6
- KY: 6

### g4m_md_q2_c
- RU: 120 тысяч 80 единиц
- EN: 8
- KY: 8

### g4m_md_q3
- taskId: `g4m-md-l1-t3` correct: **c**
- options: a(N:g4m_md_q3_a), b(N:g4m_md_q3_b), c(Y:g4m_md_q3_c)
- RU: Тали разглядывает библиотеку Digit: «7 304 книги! Интересно, цифра 3 — это три тысячи?» Тали снова ошибается. В каком разряде стоит цифра 3 в числе 7 304?
- EN: Think it through: Decide: 15 × 6 =?
- KY: Ойлонуп көр: Чеч: 15 × 6 =?

### g4m_md_q3_a
- RU: В разряде единиц
- EN: 80
- KY: 80

### g4m_md_q3_b
- RU: В разряде сотен
- EN: 85
- KY: 85

### g4m_md_q3_c
- RU: В разряде тысяч
- EN: 90
- KY: 90

### g4m_md_q4
- taskId: `g4m-md-l1-t4` correct: **b**
- options: a(N:g4m_md_q4_a), b(Y:g4m_md_q4_b), c(N:g4m_md_q4_c)
- RU: Экспедиция Тали прошла 25 600 шагов за неделю. Исследователь записал это число в дневник. Как правильно его прочитать?
- EN: Think it through: Solve: 84 ÷ 4 =?
- KY: Ойлонуп көр: Чеч: 84 ÷ 4 =?

### g4m_md_q4_a
- RU: Двадцать пять тысяч шестьсот
- EN: 19
- KY: 19

### g4m_md_q4_b
- RU: Два миллиона пятьсот шестьдесят
- EN: 21
- KY: 21

### g4m_md_q4_c
- RU: Двадцать пять тысяч шестьдесят
- EN: 23
- KY: 23

## 4. g4r_conj*
### g4r_conj2_q1
- taskId: `g4r-conj-l2-t1` correct: **a**
- options: a(Y:g4r_conj2_q1_a), b(N:g4r_conj2_q1_b), c(N:g4r_conj2_q1_c)
- RU: Тали написал в пьесе: «Мы петь вместе на сцене!» Слово говорит, что это не спряжённый глагол. Как правильно?
- EN: Think and choose: Choose an alliance: I'm cold, ___ I'll put on a jacket.
- KY: Ойлонуп, танда: Жалгооч тандо: Мага суук, ___ мен курткамды кийем.

### g4r_conj2_q1_a
- RU: Мы поём
- EN: хотя
- KY: хотя

### g4r_conj2_q1_b
- RU: Мы поёте
- EN: поэтому
- KY: поэтому

### g4r_conj2_q1_c
- RU: Мы поют
- EN: если
- KY: если

### g4r_conj2_q2
- taskId: `g4r-conj-l2-t2` correct: **b**
- options: a(N:g4r_conj2_q2_a), b(Y:g4r_conj2_q2_b), c(N:g4r_conj2_q2_c)
- RU: Тали меняет реплику в пьесе: «Он читает книгу» → «Они ___ книгу». Что изменится в глаголе?
- EN: Think and choose: Choose an alliance: ___ you will come, we will start.
- KY: Ойлонуп, танда: Жалгооч тандо: ___ ты придёшь, мы начнём.

### g4r_conj2_q2_a
- RU: читают
- EN: Когда
- KY: Когда

### g4r_conj2_q2_b
- RU: читает
- EN: Зато
- KY: Зато

### g4r_conj2_q2_c
- RU: читали
- EN: Потому что
- KY: Потому что

### g4r_conj2_q3
- taskId: `g4r-conj-l2-t3` correct: **c**
- options: a(N:g4r_conj2_q3_a), b(N:g4r_conj2_q3_b), c(Y:g4r_conj2_q3_c)
- RU: Слово задаёт Тали вопрос для пьесы: «Вы ___ правильный ответ?» (глагол «знать»). Тали написал «знаешь». Правильно ли?
- EN: Think and choose: Choose an alliance: Mom sang, ___ dad played.
- KY: Ойлонуп, танда: Жалгооч тандо: Мама пела, ___ папа играл.

### g4r_conj2_q3_a
- RU: Нет, правильно «знаете»
- EN: поэтому
- KY: поэтому

### g4r_conj2_q3_b
- RU: Да, «знаешь» верно
- EN: если
- KY: если

### g4r_conj2_q3_c
- RU: Нет, правильно «знают»
- EN: а
- KY: а

### g4r_conj2_q4
- taskId: `g4r-conj-l2-t4` correct: **b**
- options: a(N:g4r_conj2_q4_a), b(Y:g4r_conj2_q4_b), c(N:g4r_conj2_q4_c)
- RU: В пьесе Тали отряд рыцарей-динозавров отправился в поход. «Они ___ через лес». Вставь глагол «идти» в правильной форме.
- EN: Think and choose: Choose an alliance: Study well, ___ get a five.
- KY: Ойлонуп, танда: Жалгооч тандо: Учись хорошо, ___ получишь пятёрку.

### g4r_conj2_q4_a
- RU: идёт
- EN: или
- KY: или

### g4r_conj2_q4_b
- RU: идут
- EN: и
- KY: и

### g4r_conj2_q4_c
- RU: идём
- EN: но
- KY: но

### g4r_conj3_q1
- taskId: `g4r-conj-l3-t1` correct: **b**
- options: a(N:g4r_conj3_q1_a), b(Y:g4r_conj3_q1_b), c(N:g4r_conj3_q1_c)
- RU: К какому спряжению относится глагол «любить»?
- EN: Think it through: Which alliance is oppositional?
- KY: Ойлонуп көр: Кайсы жалгооч карама-каршылык билдирет?

### g4r_conj3_q1_a
- RU: I спряжение
- EN: и
- KY: и

### g4r_conj3_q1_b
- RU: II спряжение
- EN: но
- KY: но

### g4r_conj3_q1_c
- RU: оба возможны
- EN: или
- KY: или

### g4r_conj3_q2
- taskId: `g4r-conj-l3-t2` correct: **a**
- options: a(Y:g4r_conj3_q2_a), b(N:g4r_conj3_q2_b), c(N:g4r_conj3_q2_c)
- RU: Слово предлагает Тали найти глагол II спряжения: писать, говорить, читать, рисовать. Тали смотрит в список... Что выберешь ты?
- EN: Think it through: Which union is connecting?
- KY: Ойлонуп көр: Кайсы жалгооч байланыштыруучу?

### g4r_conj3_q2_a
- RU: говорить
- EN: и
- KY: и

### g4r_conj3_q2_b
- RU: писать
- EN: но
- KY: но

### g4r_conj3_q2_c
- RU: читать
- EN: хотя
- KY: хотя

### g4r_conj3_q3
- taskId: `g4r-conj-l3-t3` correct: **c**
- options: a(N:g4r_conj3_q3_a), b(N:g4r_conj3_q3_b), c(Y:g4r_conj3_q3_c)
- RU: Тали написал последнюю реплику пьесы: «Мы бежит к финишу!» Слово говорит, что форма глагола неверная. Исправь за Тали!
- EN: Think and choose: Choose a separation alliance.
- KY: Ойлонуп, танда: Ажыратуучу жалгоочту тандо.

### g4r_conj3_q3_a
- RU: бежит
- EN: и
- KY: и

### g4r_conj3_q3_b
- RU: бежите
- EN: но
- KY: но

### g4r_conj3_q3_c
- RU: бежим
- EN: или
- KY: или

### g4r_conj3_q4
- taskId: `g4r-conj-l3-t4` correct: **b**
- options: a(N:g4r_conj3_q4_a), b(Y:g4r_conj3_q4_b), c(N:g4r_conj3_q4_c)
- RU: По какому признаку определяют спряжение глагола в неопределённой форме?
- EN: Think it through: Find a sentence with a causal union.
- KY: Ойлонуп көр: Себеп жалгоочу бар сүйлөмдү тап.

### g4r_conj3_q4_a
- RU: По роду существительного рядом
- EN: Светло, хотя облачно.
- KY: Светло, хотя облачно.

### g4r_conj3_q4_b
- RU: По окончанию инфинитива и личным окончаниям
- EN: Холодно, потому что зима.
- KY: Холодно, потому что зима.

### g4r_conj3_q4_c
- RU: Только по ударению
- EN: Читай и пиши.
- KY: Читай и пиши.

### g4r_conj_q1
- taskId: `g4r-conj-l1-t1` correct: **b**
- options: a(N:g4r_conj_q1_a), b(Y:g4r_conj_q1_b), c(N:g4r_conj_q1_c)
- RU: Тали написал: «Я хожу в школу каждый день.» Слово проверяет: правильно ли выбрана форма глагола?
- EN: Think and choose: Choose an alliance: It rained, ___ we stayed at home.
- KY: Ойлонуп, танда: Жалгооч тандо: Пошёл дождь, ___ мы остались дома.

### g4r_conj_q1_a
- RU: Нет, надо «иду»
- EN: или
- KY: или

### g4r_conj_q1_b
- RU: Да, форма верна
- EN: поэтому
- KY: поэтому

### g4r_conj_q1_c
- RU: Нет, надо «хожал»
- EN: хотя
- KY: хотя

### g4r_conj_q2
- taskId: `g4r-conj-l1-t2` correct: **a**
- options: a(Y:g4r_conj_q2_a), b(N:g4r_conj_q2_b), c(N:g4r_conj_q2_c)
- RU: Слово спрашивает Тали: как будет глагол «читать» для «ты»? Тали думает... Помоги ему!
- EN: Think and choose: Choose an alliance: I was tired, ___ continued to walk.
- KY: Ойлонуп, танда: Жалгооч тандо: Я устал, ___ продолжал идти.

### g4r_conj_q2_a
- RU: читаешь
- EN: но
- KY: но

### g4r_conj_q2_b
- RU: читает
- EN: потому что
- KY: потому что

### g4r_conj_q2_c
- RU: читали
- EN: или
- KY: или

### g4r_conj_q3
- taskId: `g4r-conj-l1-t3` correct: **c**
- options: a(N:g4r_conj_q3_a), b(N:g4r_conj_q3_b), c(Y:g4r_conj_q3_c)
- RU: Тали читает вслух: «Мальчик идёт по улице». Слово хочет знать — в каком лице стоит глагол «идёт»? Тали говорит: «Во втором!» Прав ли Тали?
- EN: Think and choose: Choose an alliance: He took an umbrella, ___ it was raining.
- KY: Ойлонуп, танда: Жалгооч тандо: Он взял зонт, ___ шёл дождь.

### g4r_conj_q3_a
- RU: Да, Тали прав — это второе лицо
- EN: а
- KY: а

### g4r_conj_q3_b
- RU: Нет, это третье лицо единственного числа
- EN: и
- KY: и

### g4r_conj_q3_c
- RU: Нет, это первое лицо
- EN: потому что
- KY: потому что

### g4r_conj_q4
- taskId: `g4r-conj-l1-t4` correct: **b**
- options: a(N:g4r_conj_q4_a), b(Y:g4r_conj_q4_b), c(N:g4r_conj_q4_c)
- RU: Детектив-грамматик нашёл ошибку: «Она пишет письмо и отправляю его.» Что неверно в этом предложении?
- EN: Think and choose: Choose an alliance: Read carefully, ___ you will understand everything.
- KY: Ойлонуп, танда: Жалгооч тандо: Читай внимательно, ___ всё поймёшь.

### g4r_conj_q4_a
- RU: Неверный союз
- EN: или
- KY: или

### g4r_conj_q4_b
- RU: Неверное лицо у второго глагола: надо «отправляет»
- EN: тогда
- KY: тогда

### g4r_conj_q4_c
- RU: Неверный порядок слов
- EN: но
- KY: но

## 5. Other g4r question keys (questions only)
### g4r_cases2_q1
- taskId: `g4r-cases-l2-t1` correct: **b**
- options: a(N:g4r_cases2_q1_a), b(Y:g4r_cases2_q1_b), c(N:g4r_cases2_q1_c)
- RU: На какой вопрос отвечает слово в родительном падеже?
- EN: Think it through: The word "table" — what is the case?
- KY: Ойлонуп көр: «стола» сөзү — кайсы жөндөмө?

### g4r_cases2_q2
- taskId: `g4r-cases-l2-t2` correct: **a**
- options: a(Y:g4r_cases2_q2_a), b(N:g4r_cases2_q2_b), c(N:g4r_cases2_q2_c)
- RU: Тали написал письмо: «Я дал корм собака.» Слово говорит, что падеж неверный. «Дал кому?» — значит нужен...
- EN: Think it through: Questions about the dative case?
- KY: Ойлонуп көр: Берүү жөндөмөсүнүн суроолору?

### g4r_cases2_q3
- taskId: `g4r-cases-l2-t3` correct: **b**
- options: a(N:g4r_cases2_q3_a), b(Y:g4r_cases2_q3_b), c(N:g4r_cases2_q3_c)
- RU: Тали не дождался друга и написал: «Подожди — не хватает ___ (друг).» Какой падеж нужен?
- EN: Think it through: The word "forest" — what is the case?
- KY: Ойлонуп көр: «лесом» сөзү — кайсы жөндөмө?

### g4r_cases2_q4
- taskId: `g4r-cases-l2-t4` correct: **a**
- options: a(Y:g4r_cases2_q4_a), b(N:g4r_cases2_q4_b), c(N:g4r_cases2_q4_c)
- RU: Почтальон-динозавр разносит письма: «Отправить письмо ___ (мама).» Поставь слово в правильный падеж.
- EN: Think it through: Find the word in the propositional case.
- KY: Ойлонуп көр: Жатыш жөндөмөсүндөгү сөздү тап.

### g4r_cases3_q1
- taskId: `g4r-cases-l3-t1` correct: **a**
- options: a(Y:g4r_cases3_q1_a), b(N:g4r_cases3_q1_b), c(N:g4r_cases3_q1_c)
- RU: Тали написал: «Мы говорили о лес.» Слово смотрит и говорит: «Тали, здесь нужен предложный падеж — он всегда с предлогом!» Как правильно?
- EN: Think it through: The word "mother" — what is the case?
- KY: Ойлонуп көр: «маме» сөзү — кайсы жөндөмө?

### g4r_cases3_q2
- taskId: `g4r-cases-l3-t2` correct: **b**
- options: a(N:g4r_cases3_q2_a), b(Y:g4r_cases3_q2_b), c(N:g4r_cases3_q2_c)
- RU: Тали рисует автопортрет и пишет подпись: «Я стал ___ (художник)». Какой падеж нужен после «стал»?
- EN: Think it through: How many cases are there in Russian?
- KY: Ойлонуп көр: Орус тилинде канча жөндөмө бар?

### g4r_cases3_q3
- taskId: `g4r-cases-l3-t3` correct: **b**
- options: a(N:g4r_cases3_q3_a), b(Y:g4r_cases3_q3_b), c(N:g4r_cases3_q3_c)
- RU: Слово задаёт Тали вопрос: «Какой падеж никогда не употребляется без предлога?» Тали думает и говорит: «Дательный!» Прав ли Тали?
- EN: Think it through: Find the word in the genitive case.
- KY: Ойлонуп көр: Илик жөндөмөсүндөгү сөздү тап.

### g4r_cases3_q4
- taskId: `g4r-cases-l3-t4` correct: **c**
- options: a(N:g4r_cases3_q4_a), b(N:g4r_cases3_q4_b), c(Y:g4r_cases3_q4_c)
- RU: Назови все 6 падежей русского языка по порядку. Какой стоит на пятом месте?
- EN: Think it through: "On the mountain" — the word "mountain" in which case?
- KY: Ойлонуп көр: «На горе» — «горе» сөзү кайсы жөндөмөдө?

### g4r_cases_q1
- taskId: `g4r-cases-l1-t1` correct: **a**
- options: a(Y:g4r_cases_q1_a), b(N:g4r_cases_q1_b), c(N:g4r_cases_q1_c)
- RU: В предложении «Кот лежит на коврике» — слово «кот» стоит в каком падеже?
- EN: Think it through: In what case is the word "home" (I stayed at home)?
- KY: Ойлонуп көр: «дома» сөзү (Я остался дома) кайсы жөндөмөдө?

### g4r_cases_q2
- taskId: `g4r-cases-l1-t2` correct: **a**
- options: a(Y:g4r_cases_q2_a), b(N:g4r_cases_q2_b), c(N:g4r_cases_q2_c)
- RU: Слово просит найти подлежащее в предложении «Книга лежит на столе». Тали отвечает: «Подлежащее — "столе"!» Верно ли?
- EN: Think it through: The word "friend" is what case?
- KY: Ойлонуп көр: «другу» сөзү — кайсы жөндөмө?

### g4r_cases_q3
- taskId: `g4r-cases-l1-t3` correct: **c**
- options: a(N:g4r_cases_q3_a), b(N:g4r_cases_q3_b), c(Y:g4r_cases_q3_c)
- RU: Тали составляет предложение: «Я вижу книга.» Слово говорит, что падеж неверный. Какую форму нужно использовать?
- EN: Think it through: Find the word in the accusatory case.
- KY: Ойлонуп көр: Табыш жөндөмөсүндөгү сөздү тап.

### g4r_cases_q4
- taskId: `g4r-cases-l1-t4` correct: **b**
- options: a(N:g4r_cases_q4_a), b(Y:g4r_cases_q4_b), c(N:g4r_cases_q4_c)
- RU: Чем именительный падеж отличается от винительного? Выбери верное объяснение.
- EN: Think it through: "I see a book" — the word "book" in which case?
- KY: Ойлонуп көр: «Вижу книгу» — «книгу» сөзү кайсы жөндөмөдө?

### g4r_text2_q1
- taskId: `g4r-text-l2-t1` correct: **a**
- options: a(Y:g4r_text2_q1_a), b(N:g4r_text2_q1_b), c(N:g4r_text2_q1_c)
- RU: Текст: «Ёж свернулся в клубок. Иголки торчат во все стороны. Никто не тронет ежа.» Главная мысль — это...
- EN: Think it through: "Autumn is beautiful" text type.
- KY: Ойлонуп көр: Тип текста «Осень красива».

### g4r_text2_q2
- taskId: `g4r-text-l2-t2` correct: **b**
- options: a(N:g4r_text2_q2_a), b(Y:g4r_text2_q2_b), c(N:g4r_text2_q2_c)
- RU: Как называется предложение, которое выражает главную мысль всего текста?
- EN: Think it through: What is a headline?
- KY: Ойлонуп көр: Аталыш деген эмне?

### g4r_text2_q3
- taskId: `g4r-text-l2-t3` correct: **a**
- options: a(Y:g4r_text2_q3_a), b(N:g4r_text2_q3_b), c(N:g4r_text2_q3_c)
- RU: Тали перемешал предложения своего рассказа о дожде. Какое должно быть первым, чтобы текст был связным?
- EN: Think it through: How to check the statement?
- KY: Ойлонуп көр: Баяндаманы кантип текшерүү керек?

### g4r_text2_q4
- taskId: `g4r-text-l2-t4` correct: **b**
- options: a(N:g4r_text2_q4_a), b(Y:g4r_text2_q4_b), c(N:g4r_text2_q4_c)
- RU: Слово спрашивает Тали: «Где чаще всего прячется главная мысль рассказа?» Тали говорит: «Только в середине!» Верно ли?
- EN: Think it through: Reasoning text starts with...
- KY: Ойлонуп көр: Текст-рассуждение начинается с...

### g4r_text3_q1
- taskId: `g4r-text-l3-t1` correct: **c**
- options: a(N:g4r_text3_q1_a), b(N:g4r_text3_q1_b), c(Y:g4r_text3_q1_c)
- RU: Тали прочитал: «Сначала Маша нашла гриб. Потом позвала сестру. Наконец они набрали полную корзину.» Он думает, что первым было «позвала сестру». Исправь Тали — что было самым первым?
- EN: Think it through: In the description, the main thing is...
- KY: Ойлонуп көр: В описании главное — это...

### g4r_text3_q2
- taskId: `g4r-text-l3-t2` correct: **b**
- options: a(N:g4r_text3_q2_a), b(Y:g4r_text3_q2_b), c(N:g4r_text3_q2_c)
- RU: Слово просит найти слово-«маяк», которое указывает на последнее событие в цепочке. Какое это слово?
- EN: Think it through: What connects sentences in the text?
- KY: Ойлонуп көр: Что связывает предложения в тексте?

### g4r_text3_q3
- taskId: `g4r-text-l3-t3` correct: **c**
- options: a(N:g4r_text3_q3_a), b(N:g4r_text3_q3_b), c(Y:g4r_text3_q3_c)
- RU: Тали описывает любимый камень: «Он гладкий, серый, тёплый на ощупь и пахнет дождём.» Какой это тип текста?
- EN: Think it through: What is the name of the end of the
- KY: Ойлонуп көр: Тексттин аягы кантип аталат?

### g4r_text3_q4
- taskId: `g4r-text-l3-t4` correct: **b**
- options: a(N:g4r_text3_q4_a), b(Y:g4r_text3_q4_b), c(N:g4r_text3_q4_c)
- RU: Тали пишет инструкцию для друга: «Потом налей воду. Сначала возьми стакан. Наконец размешай.» Слово говорит, что шаги перепутаны. Какое слово подскажет, что шаг НЕ первый?
- EN: Think it through: Type: "First... Then... Finally..."
- KY: Ойлонуп көр: Тип: «Сначала... Потом... Наконец...»

### g4r_text_q1
- taskId: `g4r-text-l1-t1` correct: **a**
- options: a(Y:g4r_text_q1_a), b(N:g4r_text_q1_b), c(N:g4r_text_q1_c)
- RU: Тали читает: «Солнце зашло. Стало темно. Птицы умолкли.» Он говорит: «Этот текст о птицах!» Но Слово не соглашается. О чём на самом деле этот текст?
- EN: Think it through: What is the subject of the text?
- KY: Ойлонуп көр: Тексттин темасы деген эмне?

### g4r_text_q2
- taskId: `g4r-text-l1-t2` correct: **b**
- options: a(N:g4r_text_q2_a), b(Y:g4r_text_q2_b), c(N:g4r_text_q2_c)
- RU: Как называется последняя часть текста из трёх частей?
- EN: Think it through: What does the text consist of?
- KY: Ойлонуп көр: Из чего состоит текст?

### g4r_text_q3
- taskId: `g4r-text-l1-t3` correct: **c**
- options: a(N:g4r_text_q3_a), b(N:g4r_text_q3_b), c(Y:g4r_text_q3_c)
- RU: Тали читает: «Дождь шёл всю ночь, поэтому утром лужи блестели.» Какая связь между частями предложения?
- EN: Think it through: What is the name of the beginning of the
- KY: Ойлонуп көр: Тексттин башталышы кантип аталат?

### g4r_text_q4
- taskId: `g4r-text-l1-t4` correct: **b**
- options: a(N:g4r_text_q4_a), b(Y:g4r_text_q4_b), c(N:g4r_text_q4_c)
- RU: Тали пишет рассказ о котёнке. Называет первую часть «оглавление». Слово говорит, что название неверное. Как правильно называется первая часть рассказа?
- EN: Think it through: What is a paragraph?
- KY: Ойлонуп көр: Абзац деген эмне?

## 6. Dialog stubs
EN Hi! Lesson g2-4: 36
- g4e_past_l1_0: Hi! Lesson: «Правильные глаголы». We'll review the key idea, then practice.
- g4e_past_l2_0: Hi! Lesson: «Неправильные глаголы». We'll review the key idea, then practice.
- g4e_past_l3_0: Hi! Lesson: «Смешанная практика». We'll review the key idea, then practice.
- g4e_pres_l1_0: Hi! Lesson: «He / She / It». We'll review the key idea, then practice.
- g4e_pres_l2_0: Hi! Lesson: «Отрицание». We'll review the key idea, then practice.
- g4e_pres_l3_0: Hi! Lesson: «Вопросы». We'll review the key idea, then practice.
- g4e_quest_l1_0: Hi! Lesson: «Да/нет вопросы». We'll review the key idea, then practice.
- g4e_quest_l2_0: Hi! Lesson: «Wh-questions». We'll review the key idea, then practice.
- g4e_quest_l3_0: Hi! Lesson: «Краткие ответы». We'll review the key idea, then practice.
- g4m_cm_l1_0: Hi! Lesson: «Основы умножения». We'll review the key idea, then practice.
- g4m_cm_l2_0: Hi! Lesson: «Многозначное × однозначное». We'll review the key idea, then practice.
- g4m_cm_l3_0: Hi! Lesson: «Многозначное × многозначное». We'll review the key idea, then practice.
- g4m_fr_l1_0: Hi! Lesson: «Что такое дробь?». We'll review the key idea, then practice.
- g4m_fr_l2_0: Hi! Lesson: «Равные части». We'll review the key idea, then practice.
- g4m_fr_l3_0: Hi! Lesson: «Сравнение дробей». We'll review the key idea, then practice.
- g4m_md_l1_0: Hi! Lesson: «Чтение больших чисел». We'll review the key idea, then practice.
- g4m_md_l2_0: Hi! Lesson: «Разряды числа». We'll review the key idea, then practice.
- g4m_md_l3_0: Hi! Lesson: «Сравнение чисел». We'll review the key idea, then practice.
- g4r_cases_l1_0: Hi! Lesson: «Именительный и Винительный». We'll review the key idea, then practice.
- g4r_cases_l2_0: Hi! Lesson: «Родительный и Дательный». We'll review the key idea, then practice.
KY Привет! Урок g2-4: 33
- g4e_past_l1_0: Привет! Урок «Правильные глаголы». Сейчас коротко вспомним правило — и к заданиям.
- g4e_past_l2_0: Привет! Урок «Неправильные глаголы». Сейчас коротко вспомним правило — и к заданиям.
- g4e_past_l3_0: Привет! Урок «Смешанная практика». Сейчас коротко вспомним правило — и к заданиям.
- g4e_pres_l1_0: Привет! Урок «He / She / It». Сейчас коротко вспомним правило — и к заданиям.
- g4e_pres_l2_0: Привет! Урок «Отрицание». Сейчас коротко вспомним правило — и к заданиям.
- g4e_pres_l3_0: Привет! Урок «Вопросы». Сейчас коротко вспомним правило — и к заданиям.
- g4e_quest_l1_0: Привет! Урок «Да/нет вопросы». Сейчас коротко вспомним правило — и к заданиям.
- g4e_quest_l3_0: Привет! Урок «Краткие ответы». Сейчас коротко вспомним правило — и к заданиям.
- g4m_cm_l1_0: Привет! Урок «Основы умножения». Сейчас коротко вспомним правило — и к заданиям.
- g4m_cm_l2_0: Привет! Урок «Многозначное × однозначное». Сейчас коротко вспомним правило — и к заданиям.
- g4m_cm_l3_0: Привет! Урок «Многозначное × многозначное». Сейчас коротко вспомним правило — и к заданиям.
- g4m_fr_l2_0: Привет! Урок «Равные части». Сейчас коротко вспомним правило — и к заданиям.
- g4m_fr_l3_0: Привет! Урок «Сравнение дробей». Сейчас коротко вспомним правило — и к заданиям.
- g4m_md_l1_0: Привет! Урок «Чтение больших чисел». Сейчас коротко вспомним правило — и к заданиям.
- g4m_md_l2_0: Привет! Урок «Разряды числа». Сейчас коротко вспомним правило — и к заданиям.
- g4m_md_l3_0: Привет! Урок «Сравнение чисел». Сейчас коротко вспомним правило — и к заданиям.
- g4r_cases_l1_0: Привет! Урок «Именительный и Винительный». Сейчас коротко вспомним правило — и к заданиям.
- g4r_cases_l2_0: Привет! Урок «Родительный и Дательный». Сейчас коротко вспомним правило — и к заданиям.
- g4r_cases_l3_0: Привет! Урок «Творительный и Предложный». Сейчас коротко вспомним правило — и к заданиям.
- g4r_conj_l1_0: Привет! Урок «Я, ты, он/она». Сейчас коротко вспомним правило — и к заданиям.
KY Салам! Сабак g2-4: 2
- g4e_quest_l2_0: Салам! Сабак: «Wh-суроолор». Азыр эрежени кыскача эстеп, тапшырмаларга өтөбүз.
- g4s_help_l2_0: Салам! Сабак: «Кылдаттык менен суроо». Азыр эрежени кыскача эстеп, тапшырмаларга өтөбүз.

## 7. Systematic flagged (427)
### g2m_2x6_check
- RU: Арчи утверждает: «2 × 6 = 14!» Тали не верит. Кто прав?
- EN: Think it through: 2 × 6 = 12. Right?
- KY: Ойлонуп көр: 2 × 6 = 12. Верно?

### g2m_2x4
- RU: Тали купил 4 пары носков. 2 × 4 = ? Сколько носков всего? _(ответ: 8)_
- EN: Think it through: 2 × 4 =?
- KY: Ойлонуп көр: 2 × 4 =?

### g2m_5x3
- taskId: `g2mtimesl2t1` correct: **b**
- options: a(N:opt_40), b(Y:opt_45), c(N:opt_50)
- RU: 5 × 3 = ? _(ответ: 15)_
- EN: Think it through: 5 × 3 =?
- KY: Ойлонуп көр: 5 × 3 =?

### g2e_days_in_week
- taskId: `g2edaysl2t4` correct: **c**
- options: a(N:opt_five), b(N:opt_six), c(Y:opt_seven)
- RU: Сколько дней в неделе?
- EN: Think it through: How many days are there in a week?
- KY: Ойлонуп көр: Жумада канча күн бар?

### g2e_months_in_year
- taskId: `g2edaysl3t3` correct: **c**
- options: a(N:opt_ten), b(N:opt_11), c(Y:opt_12)
- RU: Тали забыл! Какой день идёт перед пятницей?
- EN: Think it through: How many months are there in a year
- KY: Ойлонуп көр: Жылда канча ай бар?

### g2e_monday_ru
- taskId: `g2edaysl1t1` correct: **a**
- options: a(Y:g2e_opt_monday), b(N:g2e_opt_tuesday), c(N:g2e_opt_wednesday)
- RU: Понедельник по-английски:
- EN: Think it through: Monday in English:
- KY: Ойлонуп көр: Дүйшөмбү англисче:

### g2e_tuesday_ru
- taskId: `g2edaysl1t2` correct: **b**
- options: a(N:g2e_opt_monday), b(Y:g2e_opt_tuesday), c(N:g2e_opt_wednesday)
- RU: Вторник по-английски:
- EN: Think it through: Tuesday in English:
- KY: Ойлонуп көр: Шейшемби англисче:

### g2e_wednesday_ru
- taskId: `g2edaysl1t3` correct: **c**
- options: a(N:g2e_opt_monday), b(N:g2e_opt_tuesday), c(Y:g2e_opt_wednesday)
- RU: Среда по-английски:
- EN: Think it through: Wednesday in English:
- KY: Ойлонуп көр: Шаршемби англисче:

### g2e_thursday_ru
- taskId: `g2edaysl2t1` correct: **a**
- options: a(Y:g2e_opt_thursday), b(N:g2e_opt_friday), c(N:g2e_opt_saturday)
- RU: Четверг по-английски:
- EN: Think it through: Thursday in English:
- KY: Ойлонуп көр: Бейшемби англисче:

### g2e_friday_ru
- taskId: `g2edaysl2t2` correct: **b**
- options: a(N:g2e_opt_thursday), b(Y:g2e_opt_friday), c(N:g2e_opt_sunday)
- RU: Пятница по-английски:
- EN: Think it through: Friday in English:
- KY: Ойлонуп көр: Жума англисче:

### g2e_weekend_days
- taskId: `g2edaysl2t3` correct: **a**
- options: a(Y:g2e_opt_sat_sun), b(N:g2e_opt_mon_fri), c(N:g2e_opt_thu_fri)
- RU: Тали спрашивает: какие дни — выходные?
- EN: Think it through: What days are weekends?
- KY: Ойлонуп көр: Какие дни — выходные?

### g2e_january_ru
- taskId: `g2edaysl3t1` correct: **a**
- options: a(Y:g2e_opt_january), b(N:g2e_opt_february), c(N:g2e_opt_march)
- RU: Суббота по-английски — это:
- EN: Think it through: January in English:
- KY: Ойлонуп көр: Январь англисче:

### g2e_march_ru
- taskId: `g2edaysl3t2` correct: **c**
- options: a(N:g2e_opt_january), b(N:g2e_opt_february), c(Y:g2e_opt_march)
- RU: Воскресенье по-английски — это:
- EN: Think it through: March in English:
- KY: Ойлонуп көр: Март англисче:

### g2e_summer_months
- taskId: `g2edaysl3t4` correct: **a**
- options: a(Y:g2e_opt_jun_aug), b(N:g2e_opt_dec_feb), c(N:g2e_opt_mar_may)
- RU: Какой день идёт после среды?
- EN: Think it through: Summer months:
- KY: Ойлонуп көр: Летние месяцы:

### g2e_i_am_blank_student
- taskId: `g2ephrl1t1` correct: **a**
- options: a(Y:g1e_opt_am), b(N:g1e_opt_is), c(N:g1e_opt_are)
- RU: «Thank you» по-русски:
- EN: Think it through: I ___ a student. What word?
- KY: Ойлонуп көр: I ___ a student. Какое слово?

### g2e_you_are_blank
- taskId: `g2ephrl1t2` correct: **c**
- options: a(N:g1e_opt_am), b(N:g1e_opt_is), c(Y:g1e_opt_are)
- RU: «Please» по-русски:
- EN: Think it through: You ___ nice. What word?
- KY: Ойлонуп көр: You ___ nice. Какое слово?

### g2e_i_am_means
- taskId: `g2ephrl1t3` correct: **a**
- options: a(Y:g2e_opt_ya_yavlyayus), b(N:g2e_opt_on_yavlyaetsya), c(N:g2e_opt_my_yavlyaemsya)
- RU: Поли сделал Тали подарок. Тали говорит «Thank you!» Поли отвечает:
- EN: Think it through: I am is Russian for:
- KY: Ойлонуп көр: I am — кыргызча кандай?

### g2e_we_blank_friends
- taskId: `g2ephrl1t4` correct: **c**
- options: a(N:g1e_opt_am), b(N:g1e_opt_is), c(Y:g1e_opt_are)
- RU: «Thank you very much» означает:
- EN: Think it through: We ___ friends. What word?
- KY: Ойлонуп көр: We ___ friends. Какое слово?

### g2e_i_have_blank_cat
- taskId: `g2ephrl2t1` correct: **a**
- options: a(Y:g2e_opt_have), b(N:g2e_opt_has), c(N:g2e_opt_had)
- RU: «Sorry» по-русски:
- EN: Think it through: I ___ a cat. What word?
- KY: Ойлонуп көр: I ___ a cat. Какое слово?

### g2e_he_blank_dog
- taskId: `g2ephrl2t2` correct: **b**
- options: a(N:g2e_opt_have), b(Y:g2e_opt_has), c(N:g2e_opt_had)
- RU: Тали хочет пройти мимо Поли. Что он скажет?
- EN: Think it through: He ___ a dog. What word?
- KY: Ойлонуп көр: He ___ a dog. Какое слово?

### g2e_she_blank_book
- taskId: `g2ephrl2t3` correct: **b**
- options: a(N:g2e_opt_have), b(Y:g2e_opt_has), c(N:g2e_opt_had)
- RU: Как ответить на «Sorry»?
- EN: Think it through: She ___ a book. What word?
- KY: Ойлонуп көр: She ___ a book. Какое слово?

### g2e_they_blank_pens
- RU: They ___ pens. Какое слово?
- EN: Think it through: They ___ pens. What word?
- KY: Ойлонуп көр: They ___ pens. Какое слово?

### g2e_where_is_cat
- taskId: `g2ephrl3t1` correct: **a**
- options: a(Y:g2e_opt_where), b(N:g2e_opt_what), c(N:g2e_opt_who)
- RU: «Can I…?» используют, чтобы:
- EN: Think it through: “Where is the cat?” he asks.
- KY: Ойлонуп көр: «Where is the cat?» — спрашивает:

### g2e_what_is_this
- taskId: `g2ephrl3t2` correct: **b**
- options: a(N:g2e_opt_where), b(Y:g2e_opt_what), c(N:g2e_opt_who)
- RU: «You can't» по-русски:
- EN: Think it through: “What is this?” he asks.
- KY: Ойлонуп көр: «What is this?» — спрашивает:

### g2e_who_is_this_person
- taskId: `g2ephrl3t3` correct: **c**
- options: a(N:g2e_opt_where), b(N:g2e_opt_what), c(Y:g2e_opt_who)
- RU: Тали хочет войти в комнату. Как он спросит?
- EN: Think it through: “Who is this?” he asks.
- KY: Ойлонуп көр: «Who is this?» — спрашивает:

### g2e_is_he_student
- taskId: `g2ephrl3t4` correct: **a**
- options: a(Y:g2e_opt_yes_he_is), b(N:g2e_opt_yes_he_are), c(N:g2e_opt_yes_he_am)
- RU: Поли говорит Тали: «No, you can't eat my sandwich!» Что это значит?
- EN: Think it through: "Is he a student?" is the correct answer:
- KY: Ойлонуп көр: «Is he a student?» — правильный ответ:

### g2e_book_en
- taskId: `g2eschl1t1` correct: **a**
- options: a(Y:g2e_opt_book), b(N:g2e_opt_pen), c(N:g2e_opt_desk)
- RU: Книга по-английски:
- EN: Think it through: Book in English:
- KY: Ойлонуп көр: Китеп англисче:

### g2e_pen_en
- taskId: `g2eschl1t2` correct: **b**
- options: a(N:g2e_opt_book), b(Y:g2e_opt_pen), c(N:g2e_opt_board)
- RU: Ручка по-английски:
- EN: Think it through: Pen in English:
- KY: Ойлонуп көр: Калем англисче:

### g2e_chair_en
- taskId: `g2eschl1t3` correct: **b**
- options: a(N:g2e_opt_desk), b(Y:g2e_opt_chair), c(N:g2e_opt_board)
- RU: Стул по-английски:
- EN: Think it through: Chair in English:
- KY: Ойлонуп көр: Отургуч англисче:

### g2e_board_en
- taskId: `g2eschl1t4` correct: **c**
- options: a(N:g2e_opt_desk), b(N:g2e_opt_chair), c(Y:g2e_opt_board)
- RU: Доска по-английски:
- EN: Think it through: English board:
- KY: Ойлонуп көр: Такта англисче:

### g2e_math_in_en
- taskId: `g2eschl2t1` correct: **a**
- options: a(Y:g2e_opt_maths), b(N:g2e_opt_music), c(N:g2e_opt_art)
- RU: Математика по-английски:
- EN: Think it through: Mathematics in English:
- KY: Ойлонуп көр: Математика англисче:

### g2e_art_in_en
- taskId: `g2eschl2t2` correct: **c**
- options: a(N:g2e_opt_maths), b(N:g2e_opt_music), c(Y:g2e_opt_art)
- RU: Рисование по-английски:
- EN: Think it through: Drawing in English:
- KY: Ойлонуп көр: Сүрөт тартуу англисче:

### g2e_pe_in_en
- taskId: `g2eschl2t3` correct: **a**
- options: a(Y:g2e_opt_pe), b(N:g2e_opt_science), c(N:g2e_opt_history)
- RU: Физкультура по-английски:
- EN: Think it through: Physical Education in English:
- KY: Ойлонуп көр: Дене тарбия англисче:

### g2e_english_subject
- taskId: `g2eschl2t4` correct: **a**
- options: a(Y:g2e_opt_english), b(N:g2e_opt_maths), c(N:g2e_opt_art)
- RU: Английский язык по-английски:
- EN: Think it through: English to English:
- KY: Ойлонуп көр: Англис тили англисче:

### g2e_wake_up_means
- taskId: `g2eschl3t1` correct: **a**
- options: a(Y:g2e_opt_wake_up), b(N:g2e_opt_go_to_bed), c(N:g2e_opt_eat_lunch)
- RU: Wake up по-русски:
- EN: Think it through: Wake up is:
- KY: Ойлонуп көр: Wake up — это:

### g2e_go_to_school
- taskId: `g2eschl3t2` correct: **b**
- options: a(N:g2e_opt_wake_up), b(Y:g2e_opt_go_school), c(N:g2e_opt_go_to_bed)
- RU: «Идти в школу» по-английски:
- EN: Think it through: "Going to school" in English:
- KY: Ойлонуп көр: «Мектепке баруу» англисче:

### g2e_go_home_after
- taskId: `g2eschl3t3` correct: **a**
- options: a(Y:g2e_opt_go_home), b(N:g2e_opt_go_school), c(N:g2e_opt_wake_up)
- RU: «Идти домой» по-английски:
- EN: Think it through: "Going home" in English:
- KY: Ойлонуп көр: «Үйгө баруу» англисче:

### g2e_do_homework_means
- taskId: `g2eschl3t4` correct: **a**
- options: a(Y:g2e_opt_do_hw), b(N:g2e_opt_play_games), c(N:g2e_opt_go_to_bed)
- RU: Do homework по-русски:
- EN: Think it through: Do homework is:
- KY: Ойлонуп көр: Do homework — это:

### g2m_10x3
- taskId: `g2m100l1t1` correct: **b**
- options: a(N:opt_20), b(Y:opt_30), c(N:opt_40)
- RU: Тали пытается помочь Арчи: «Три коробки по 10 перьев — это… 30? Или 13?» Тали запутался! Кто прав?
- EN: Think it through: 10 × 3 =?
- KY: Ойлонуп көр: 10 × 3 =?

### g2m_10x7
- taskId: `g2m100l1t2` correct: **b**
- options: a(N:opt_60), b(Y:opt_70), c(N:opt_80)
- RU: Арчи летел над полем и насчитал 7 стогов сена. В каждом стогу ровно 10 мышей. Сколько мышей всего?
- EN: Think it through: 10 × 7 =?
- KY: Ойлонуп көр: 10 × 7 =?

### g2m_10x5
- taskId: `g2m100l1t3` correct: **b**
- options: a(N:opt_five), b(Y:opt_ten), c(N:opt_20)
- RU: Тали хочет собрать ровно 50 ракушек для своей коллекции. Он уже нашёл 5 коробок по 10. Хватит? 10 × 5 = ? _(ответ: 50)_
- EN: Think it through: 10 × 5 =?
- KY: Ойлонуп көр: 10 × 5 =?

### g2m_how_many_tens_in_100
- RU: Арчи хвастается: «Сто — это пять десятков!» Тали говорит: «Нет, десять!» Кто из них прав?
- EN: Think it through: How many tens in a hundred?
- KY: Ойлонуп көр: Жүздө канча ондук бар?

### g2m_tens_in_48
- taskId: `g2m100l2t3` correct: **a**
- options: a(Y:opt_78), b(N:opt_82), c(N:opt_91)
- RU: Детектив Тали расследует число 73. Сколько десятков он нашёл в этом числе? _(ответ: 7)_
- EN: Think it through: How many tens are there among the 48?
- KY: Ойлонуп көр: 48 санында канча ондук бар?

### g2m_units_in_37
- RU: Арчи собрал запасы: 5 мешков по 10 желудей и ещё 6 желудей в кармане. Запиши число. _(ответ: 56)_
- EN: Think it through: How many units are there among the 37?
- KY: Ойлонуп көр: 37 санында канча бирдик бар?

### g2m_before_100
- RU: Арчи летит к самому большому двузначному числу. Оно стоит прямо перед 100. Что это за число? _(ответ: 99)_
- EN: Think it through: What is the number before 100?
- KY: Ойлонуп көр: Какое число перед 100?

### g2m_tens_in_90
- taskId: `g2m100l3t3` correct: **b**
- options: a(N:opt_60), b(Y:opt_70), c(N:opt_80)
- RU: Сколько десятков в числе 90? _(ответ: 9)_
- EN: Think it through: How many tens are there in the number 90?
- KY: Ойлонуп көр: 90 санында канча ондук бар?

### g2m_num_5tens_6units
- RU: Тали записал число: «пять десятков и шесть единиц». Что это за число? _(ответ: 56)_
- EN: Think it through: Write down the number: 5 tens and 6 units
- KY: Ойлонуп көр: Запиши число: 5 десятков и 6 единиц

### g2m_20plus30
- RU: Тали покупает 20 бананов и 30 кокосов. Он говорит: «Это 23 штуки!» Нет, Тали! Подсчитай правильно: 20 + 30 = ? _(ответ: 50)_
- EN: Think it through: 20 + 30 =?
- KY: Ойлонуп көр: 20 + 30 =?

### g2m_40plus50
- RU: 40 + 50 = ? _(ответ: 90)_
- EN: Think it through: 40 + 50 =?
- KY: Ойлонуп көр: 40 + 50 =?

### g2m_30plus_eq100
- RU: Арчи летел 30 км утром и ещё сколько-то вечером. Всего получилось 100 км. Сколько он летел вечером?
- EN: Think it through: 30 +? = 100. What number is missing?
- KY: Ойлонуп көр: 30 +? = 100. Какое число пропущено?

### g2m_60plus40
- taskId: `g2madd2l1t4` correct: **a**
- options: a(Y:opt_17), b(N:opt_18), c(N:opt_19)
- RU: 60 + 40 = ? _(ответ: 100)_
- EN: Think it through: 60 + 40 =?
- KY: Ойлонуп көр: 60 + 40 =?

### g2m_23plus14
- RU: 23 + 14 = ? _(ответ: 37)_
- EN: Think it through: 23 + 14 =?
- KY: Ойлонуп көр: 23 + 14 =?

### g2m_35plus42
- RU: Тали считал: 35 + 42. Он получил 88. Арчи говорит, что это неверно. Посчитай правильно! 35 + 42 = ? _(ответ: 77)_
- EN: Think it through: 35 + 42 =?
- KY: Ойлонуп көр: 35 + 42 =?

### g2m_47plus26
- RU: 47 + 26 = ? _(ответ: 73)_
- EN: Think it through: 47 + 26 =?
- KY: Ойлонуп көр: 47 + 26 =?

### g2m_58plus35
- RU: 58 + 35 = ? _(ответ: 93)_
- EN: Think it through: 58 + 35 =?
- KY: Ойлонуп көр: 58 + 35 =?

### g2m_sub_65minus23
- RU: 65 − 23 = ? (Тали прав?) _(ответ: 42)_
- EN: Think it through: 65 − 23 =?
- KY: Ойлонуп көр: 65 − 23 =?

### g2m_sub_80minus47
- RU: 80 − 47 = ? _(ответ: 33)_
- EN: Think it through: 80 − 47 =?
- KY: Ойлонуп көр: 80 − 47 =?

### g2m_word_apples_30_give_13
- RU: Было 30 яблок, Тали отдал 13 Арчи. Сколько осталось?
- EN: Think it through: There were 30 apples, they gave 13. How many are left?
- KY: Ойлонуп көр: 30 алма болду, 13үн берди. Канчасы калды?

### g2m_word_45plus27
- taskId: `g2madd2l3t4` correct: **b**
- options: a(N:opt_10), b(Y:opt_12), c(N:opt_14)
- RU: 91 − 38 = ? _(ответ: 53)_
- EN: Think it through: 45 + 27 =?
- KY: Ойлонуп көр: 45 + 27 =?

### g2m_2x7
- RU: 2 × 7 = ? _(ответ: 14)_
- EN: Think it through: 2 × 7 =?
- KY: Ойлонуп көр: 2 × 7 =?

### g2m_2x9
- RU: 2 × 9 = ? _(ответ: 18)_
- EN: Think it through: 2 × 9 =?
- KY: Ойлонуп көр: 2 × 9 =?

### g2m_5x6
- RU: 5 × 6 = ? _(ответ: 30)_
- EN: Think it through: 5 × 6 =?
- KY: Ойлонуп көр: 5 × 6 =?

### g2m_5x8
- RU: 5 × 8 = ? _(ответ: 40)_
- EN: Think it through: 5 × 8 =?
- KY: Ойлонуп көр: 5 × 8 =?

### g2m_5x9_check
- RU: Тали говорит: «5 × 9 = 46!» Арчи смеётся и объясняет, почему Тали неправ. Что ответил Арчи?
- EN: Think it through: 5 × 9 = 45. Right?
- KY: Ойлонуп көр: 5 × 9 = 45. Верно?

### g2m_3x4
- taskId: `g2mtimesl3t1` correct: **b**
- options: a(N:opt_22), b(Y:opt_24), c(N:opt_26)
- RU: У Тали три кармана по 4 монеты. 3 × 4 = ? _(ответ: 12)_
- EN: Think it through: 3 × 4 =?
- KY: Ойлонуп көр: 3 × 4 =?

### g2m_3x7
- RU: 3 × 7 = ? (Сколько монет у Тали?) _(ответ: 21)_
- EN: Think it through: 3 × 7 =?
- KY: Ойлонуп көр: 3 × 7 =?

### g2m_3x9
- RU: 3 × 9 = ? _(ответ: 27)_
- EN: Think it through: 3 × 9 =?
- KY: Ойлонуп көр: 3 × 9 =?

### g2m_3x8_check
- RU: Арчи считает: «3 × 8 = 24!» — Тали говорит: «Нет, 26!» Кто из них прав?
- EN: Think it through: 3 × 8 = 24. Right?
- KY: Ойлонуп көр: 3 × 8 = 24. Верно?

### g2r_nos_consonant
- taskId: `g2rshl1t1` correct: **b**
- options: a(N:opt_soft), b(Y:opt_hard)
- RU: Тали читает слово НОС и задаётся вопросом: «Н здесь твёрдая или мягкая?» Помоги ему!
- EN: Think it through: Consonant H in the word NOSE:
- KY: Ойлонуп көр: НОС сөзүндөгү Н тамгасы:

### g2r_zha_hard
- taskId: `g2rshl1t2` correct: **a**
- options: a(Y:opt_yes), b(N:opt_no)
- RU: Маша говорит: «Буква Ж в любом слове всегда твёрдая — исключений нет!» Тали не верит. А ты?
- EN: Think it through: Is the letter F always solid?
- KY: Ойлонуп көр: Буква Ж всегда твёрдая?

### g2r_which_always_hard
- taskId: `g2rshl1t3` correct: **a**
- options: a(Y:g2r_opt_Zh), b(N:g2r_opt_L), c(N:g2r_opt_N)
- RU: Какая буква в русском языке ВСЕГДА твёрдая, без исключений?
- EN: Think it through: Which letter is always solid?
- KY: Ойлонуп көр: Кайсы тамга дайыма катуу?

### g2r_hard_consonants_count
- taskId: `g2rshl1t4` correct: **b**
- options: a(N:opt_two), b(Y:opt_three), c(N:opt_four)
- RU: В слове НОС три согласных. Тали говорит: «Все три твёрдые!» Маша сомневается. Сколько твёрдых согласных в слове НОС?
- EN: Think it through: How many firm consonants are there in the word NOSE?
- KY: Ойлонуп көр: НОС сөзүндө канча катуу үнсүз тамга бар?

### g2r_kon_konj
- taskId: `g2rshl2t1` correct: **b**
- options: a(N:g2r_opt_kon), b(Y:g2r_opt_konj)
- RU: Тали написал «КОН». Маша говорит, нужно «КОНЬ». Как правильно написать слово про лошадь?
- EN: Think it through: Which is correct: horse or horse?
- KY: Ойлонуп көр: Кайсынысы туура: кон же конь?

### g2r_soft_sign_role
- taskId: `g2rshl2t2` correct: **a**
- options: a(Y:g2r_opt_softens), b(N:g2r_opt_hardens), c(N:g2r_opt_no_role)
- RU: Что делает мягкий знак в слове?
- EN: Think it through: What does a soft sign do?
- KY: Ойлонуп көр: Что делает мягкий знак?

### g2r_ryb_needs_soft
- taskId: `g2rshl2t3` correct: **a**
- options: a(Y:opt_yes), b(N:opt_no)
- RU: Маша написала слово «РЫБЬ» и спрашивает: «Нужен ли тут мягкий знак?» Тали говорит «да». А ты как думаешь?
- EN: Think it through: Do you need a soft sign in the word Fish?
- KY: Ойлонуп көр: РЫБЬ сөзүндө жумшак белги керекпи?

### g2r_soft_sign_between
- taskId: `g2rshl2t4` correct: **a**
- options: a(Y:opt_yes), b(N:opt_no)
- RU: Мягкий знак может стоять между двумя согласными (например: ПИСЬМО). Это правда?
- EN: Think it through: Can a soft sign stand between consonants?
- KY: Ойлонуп көр: Мягкий знак может стоять между согласными?

### g2r_li_is_soft
- taskId: `g2rshl3t1` correct: **a**
- options: a(Y:opt_yes), b(N:opt_no)
- RU: В слове ЛИМОН: слог ЛИ делает согласный Л мягким?
- EN: Think it through: Does the syllable give softness TO the consonant?
- KY: Ойлонуп көр: Слог ЛИ даёт мягкость согласному?

### g2r_lu_is_hard
- taskId: `g2rshl3t2` correct: **a**
- options: a(Y:opt_yes), b(N:opt_no)
- RU: Тали читает: ЛУЖА. Слог ЛУ — какой здесь Л?
- EN: Think it through: Does the syllable LU give firmness according to?
- KY: Ойлонуп көр: Слог ЛУ даёт твёрдость согласному?

### g2r_le_is_what
- taskId: `g2rshl3t3` correct: **a**
- options: a(Y:opt_soft), b(N:opt_hard)
- RU: Маша написала: ЛЕТО. Слог ЛЕ делает Л…
- EN: Think it through: Is the syllable LE soft or hard?
- KY: Ойлонуп көр: Слог ЛЕ — мягкий или твёрдый?

### g2r_la_is_what
- taskId: `g2rshl3t4` correct: **b**
- options: a(N:opt_soft), b(Y:opt_hard)
- RU: Тали читает ЛАМПА. Слог ЛА — какой Л?
- EN: Think it through: Is the PA syllable soft or hard?
- KY: Ойлонуп көр: Слог ЛА — мягкий или твёрдый?

### g2r_noun_question
- taskId: `g2rspl1t1` correct: **a**
- options: a(Y:g2r_opt_kto_chto), b(N:g2r_opt_chto_delaet), c(N:g2r_opt_kakoy)
- RU: На какой вопрос отвечает существительное?
- EN: Think it through: What question does the noun answer?
- KY: Ойлонуп көр: Зат атооч кайсы суроого жооп берет?

### g2r_kot_noun
- taskId: `g2rspl1t2` correct: **a**
- options: a(Y:opt_yes), b(N:opt_no)
- RU: Тали говорит: «КОТ — это существительное!» Маша сомневается. Кто прав?
- EN: Think it through: Is the word CAT a noun?
- KY: Ойлонуп көр: КОТ сөзү зат атоочпу?

### g2r_beg_noun
- taskId: `g2rspl1t3` correct: **b**
- options: a(N:opt_yes), b(Y:opt_no)
- RU: Тали смотрит на слово БЕГ и думает: «Это что делает? Нет, это ЧТО — значит существительное!» Он прав?
- EN: Think it through: Is the word RUNNING a noun?
- KY: Ойлонуп көр: БЕГ сөзү зат атоочпу?

### g2r_which_is_noun
- taskId: `g2rspl1t4` correct: **c**
- options: a(N:g2r_opt_beg_word), b(N:g2r_opt_krasivyi), c(Y:g2r_opt_kniga)
- RU: Какое слово из списка является существительным?
- EN: Think it through: Which word is a noun?
- KY: Ойлонуп көр: Какое слово — существительное?

### g2r_verb_question
- taskId: `g2rspl2t1` correct: **b**
- options: a(N:g2r_opt_kto_chto), b(Y:g2r_opt_chto_delaet), c(N:g2r_opt_kakoy)
- RU: На какой вопрос отвечает глагол?
- EN: Think it through: What question does the verb answer?
- KY: Ойлонуп көр: Этиш кайсы суроого жооп берет?

### g2r_idet_verb
- taskId: `g2rspl2t2` correct: **a**
- options: a(Y:opt_yes), b(N:opt_no)
- RU: Тали говорит: «ИДЁТ — это глагол!» Маша спрашивает: почему?
- EN: Think it through: The word GOES — is it a verb?
- KY: Ойлонуп көр: ИДЁТ сөзү этишпи?

### g2r_which_is_verb
- taskId: `g2rspl2t3` correct: **b**
- options: a(N:g2r_opt_koshka), b(Y:g2r_opt_sidit), c(N:g2r_opt_krasivyi)
- RU: Какое слово из списка является глаголом?
- EN: Think it through: What word is a verb?
- KY: Ойлонуп көр: Какое слово — глагол?

### g2r_verb_changes_time
- taskId: `g2rspl2t4` correct: **a**
- options: a(Y:opt_yes), b(N:opt_no)
- RU: Тали задаёт вопрос: «Глагол меняется по временам — был, есть, будет?» Это правда?
- EN: Think it through: Does the verb change over time?
- KY: Ойлонуп көр: Глагол меняется по временам?

### g2r_adj_question
- taskId: `g2rspl3t1` correct: **c**
- options: a(N:g2r_opt_kto_chto), b(N:g2r_opt_chto_delaet), c(Y:g2r_opt_kakoy)
- RU: На какой вопрос отвечает прилагательное?
- EN: Think it through: What question does the adjective answer?
- KY: Ойлонуп көр: Сын атооч кайсы суроого жооп берет?

### g2r_krasivyi_adj
- taskId: `g2rspl3t2` correct: **a**
- options: a(Y:opt_yes), b(N:opt_no)
- RU: Тали говорит: «КРАСИВЫЙ — это прилагательное!» Он прав?
- EN: Think it through: Is the word BEAUTIFUL an adjective?
- KY: Ойлонуп көр: КРАСИВЫЙ сөзү сын атоочпу?

### g2r_which_is_adj
- taskId: `g2rspl3t3` correct: **c**
- options: a(N:g2r_opt_sidit), b(N:g2r_opt_koshka), c(Y:g2r_opt_belyi)
- RU: Маша описывает Тали: «Он ___ и ___». Какие слова подойдут?
- EN: Think it through: Which word is an adjective?
- KY: Ойлонуп көр: Какое слово — прилагательное?

### g2r_adj_describes
- taskId: `g2rspl3t4` correct: **a**
- options: a(Y:g2r_opt_noun_w), b(N:g2r_opt_verb_w), c(N:g2r_opt_sentence)
- RU: Прилагательное описывает признак чего?
- EN: Think it through: The adjective describes:
- KY: Ойлонуп көр: Прилагательное описывает:

### g2r_statement_type
- taskId: `g2rsentl1t1` correct: **a**
- options: a(Y:g2r_opt_statement), b(N:g2r_opt_question_s), c(N:g2r_opt_exclaim_s)
- RU: Тали написал «Бежит». Маша говорит, что это неполное предложение — не хватает подлежащего. Что нужно добавить?
- EN: Think it through: “Mommy cooking” means:
- KY: Ойлонуп көр: «Мама готовит» — это:

### g2r_question_type
- RU: «Кто пришёл?» — это:
- EN: Think it through: “Who came?” is:
- KY: Ойлонуп көр: «Кто пришёл?» — это:

### g2r_exclaim_type
- taskId: `g2rsentl1t3` correct: **c**
- options: a(N:g2r_opt_statement), b(N:g2r_opt_question_s), c(Y:g2r_opt_exclaim_s)
- RU: Подлежащее отвечает на вопрос:
- EN: Think it through: "Hooray!" is:
- KY: Ойлонуп көр: «Ура!» — это:

### g2r_sentence_types_count
- taskId: `g2rsentl1t4` correct: **b**
- options: a(N:opt_two), b(Y:opt_three), c(N:opt_four)
- RU: Сказуемое отвечает на вопрос:
- EN: Think it through: How many types of sentences on the purpose of the utterance
- KY: Ойлонуп көр: Айтылыш максатына жараша канча түрдөгү сүйлөм бар?

### g3m_3hundreds
- taskId: `g3m1000l1t1` correct: **b**
- options: a(N:opt_200), b(Y:opt_300), c(N:opt_400)
- RU: Тали считает чешуйки блоками по 100. У него 3 блока. Сколько чешуек?
- EN: Think it through: 3 hundred is what number?
- KY: Ойлонуп көр: 3 жүздүк — бул кайсы сан?

### g3m_5hundreds
- taskId: `g3m1000l1t2` correct: **b**
- options: a(N:opt_400), b(Y:opt_500), c(N:opt_600)
- RU: На складе 5 ящиков, в каждом по 100 предметов. Сколько предметов всего?
- EN: Think it through: Five hundred is what number?
- KY: Ойлонуп көр: 5 жүздүк — бул кайсы сан?

### g3m_100x7
- taskId: `g3m1000l1t3` correct: **c**
- options: a(N:opt_five), b(N:opt_eight), c(Y:opt_ten)
- RU: Тали нашёл волшебника, который умножает всё на 7. Он взял 100 и начал колдовать: 100 × 7 = ? _(ответ: 700)_
- EN: Think it through: 100 × 7 =?
- KY: Ойлонуп көр: 100 × 7 =?

### g3m_how_hundreds_in_1000
- RU: Тали копил монеты по 100 штук. Когда у него стала тысяча, сколько стопок он насчитал?
- EN: Think it through: How many hundreds in a thousand?
- KY: Ойлонуп көр: Миңде канча жүздүк бар?

### g3m_hundreds_in_347
- taskId: `g3m1000l2t1` correct: **b**
- options: a(N:opt_398), b(Y:opt_403), c(N:opt_389)
- RU: Детектив Тали изучает число 347 под лупой. Сколько сотен он насчитал? _(ответ: 3)_
- EN: Think it through: How many hundreds are there among 347?
- KY: Ойлонуп көр: 347 санында канча жүздүк бар?

### g3m_tens_in_456
- RU: В числе 456 спрятались десятки. Сколько их там притаилось? _(ответ: 5)_
- EN: Think it through: How many dozen are 456?
- KY: Ойлонуп көр: 456 санында канча ондук бар?

### g3m_num_2h_3t_5u
- RU: Тали собирает число из запчастей: 2 сотни, 3 десятка и 5 единиц. Что получилось? _(ответ: 235)_
- EN: Think it through: Write down the number: 2 hundreds, 3 tens, 5 units
- KY: Ойлонуп көр: Запиши число: 2 сотни, 3 десятка, 5 единиц

### g3m_200plus350
- taskId: `g3m1000l3t1` correct: **b**
- options: a(N:opt_52), b(Y:opt_54), c(N:opt_56)
- RU: Путешественник прошёл 200 км, потом ещё 350. Тали хочет узнать: какой путь он прошёл всего? _(ответ: 550)_
- EN: Think it through: 200 + 350 =?
- KY: Ойлонуп көр: 200 + 350 =?

### g3m_600minus240
- RU: В библиотеке было 600 книг, 240 раздали. Тали спрашивает: сколько книг осталось скучать на полках? _(ответ: 360)_
- EN: Think it through: 600 − 240 =?
- KY: Ойлонуп көр: 600 − 240 =?

### g3m_450plus275
- RU: Строители уложили 450 кирпичей утром и 275 вечером. Тали считает итог рабочего дня: _(ответ: 725)_
- EN: Think it through: 450 + 275 =?
- KY: Ойлонуп көр: 450 + 275 =?

### g3m_800minus356
- RU: Корабль вмещал 800 пассажиров, 356 сошли на берег. Сколько продолжили плавание? Тали ставит на 444 — он прав? _(ответ: 444)_
- EN: Think it through: 800 − 356 =?
- KY: Ойлонуп көр: 800 − 356 =?

### g3m_4x6
- RU: У осьминога 4 друга, у каждого по 6 рук. Тали считает: 4 × 6 = ? _(ответ: 24)_
- EN: Think it through: 4 × 6 =?
- KY: Ойлонуп көр: 4 × 6 =?

### g3m_4x8
- RU: Паук сплёл 4 паутины, в каждой 8 узелков. Сколько узелков завязал трудолюбивый паук? 4 × 8 = ? _(ответ: 32)_
- EN: Think it through: 4 × 8 =?
- KY: Ойлонуп көр: 4 × 8 =?

### g3m_6x7
- RU: На каждой из 6 полок по 7 книг. Тали считает всю библиотеку: 6 × 7 = ? _(ответ: 42)_
- EN: Think it through: 6 × 7 =?
- KY: Ойлонуп көр: 6 × 7 =?

### g3m_6x9
- RU: Пчела облетела 6 цветков и собрала с каждого по 9 капель нектара. Тали хочет узнать итог: 6 × 9 = ? _(ответ: 54)_
- EN: Think it through: 6 × 9 =?
- KY: Ойлонуп көр: 6 × 9 =?

### g3m_7x5
- RU: Неделя — 7 дней. За 5 недель сколько дней? 7 × 5 = ? _(ответ: 35)_
- EN: Think it through: 7 × 5 =?
- KY: Ойлонуп көр: 7 × 5 =?

### g3m_7x8
- RU: Осьминог купил 7 тетрадей по 8 листов. Тали помогает считать: 7 × 8 = ? _(ответ: 56)_
- EN: Think it through: 7 × 8 =?
- KY: Ойлонуп көр: 7 × 8 =?

### g3m_8x6
- RU: В 8 корзинах по 6 яблок. Тали готовится к пирогу: 8 × 6 = ? _(ответ: 48)_
- EN: Think it through: 8 × 6 =?
- KY: Ойлонуп көр: 8 × 6 =?

### g3m_8x9
- RU: Стадо из 8 коров даёт по 9 литров молока. Сколько литров получит фермер? 8 × 9 = ? _(ответ: 72)_
- EN: Think it through: 8 × 9 =?
- KY: Ойлонуп көр: 8 × 9 =?

### g3m_9x4
- RU: Кот прожил 4 из своих 9 жизней. Но сейчас важнее: 9 × 4 = ? _(ответ: 36)_
- EN: Think it through: 9 × 4 =?
- KY: Ойлонуп көр: 9 × 4 =?

### g3m_9x7
- RU: На 9 ёлках по 7 шишек. Белка хочет знать итог: 9 × 7 = ? _(ответ: 63)_
- EN: Think it through: 9 × 7 =?
- KY: Ойлонуп көр: 9 × 7 =?

### g3m_9x9
- RU: Магический квадрат: 9 рядов по 9 клеток. Сколько клеток на доске? 9 × 9 = ? _(ответ: 81)_
- EN: Think it through: 9 × 9 =?
- KY: Ойлонуп көр: 9 × 9 =?

### g3m_9x6_check
- RU: Тали утверждает: «9 × 6 = 54!» И добавляет: «5+4=9 — правило работает!» Он прав?
- EN: Think it through: 9 × 6 = 54. Right?
- KY: Ойлонуп көр: 9 × 6 = 54. Верно?

### g3m_div_concept
- RU: Деление — это:
- EN: Think it through: Division is:
- KY: Ойлонуп көр: Деление — это:

### g3m_6div2
- RU: 6 ÷ 2 =?
- EN: Think it through: 6 ÷ 2 =?
- KY: Ойлонуп көр: 6 ÷ 2 =?

### g3m_10div2
- RU: 10 ÷ 2 =?
- EN: Think it through: 10 ÷ 2 =?
- KY: Ойлонуп көр: 10 ÷ 2 =?

### g3m_8div2_check
- RU: 8 ÷ 2 = 4. Верно?
- EN: Think it through: 8 ÷ 2 = 4. Right?
- KY: Ойлонуп көр: 8 ÷ 2 = 4. Верно?

### g3m_18div2
- RU: 18 ÷ 2 =?
- EN: Think it through: 18 ÷ 2 =?
- KY: Ойлонуп көр: 18 ÷ 2 =?

### g3m_14div2
- RU: 14 ÷ 2 =?
- EN: Think it through: 14 ÷ 2 =?
- KY: Ойлонуп көр: 14 ÷ 2 =?

### g3m_16div2
- RU: 16 ÷ 2 =?
- EN: Think it through: 16 ÷ 2 =?
- KY: Ойлонуп көр: 16 ÷ 2 =?

### g3m_20div2
- RU: 20 ÷ 2 =?
- EN: Think it through: 20 ÷ 2 =?
- KY: Ойлонуп көр: 20 ÷ 2 =?

### g3m_25div5
- RU: Знаешь, что 5 × 5 = 25? Реши обратную задачу: 25 ÷ 5 = ? _(ответ: 5)_
- EN: Think it through: 25 ÷ 5 =?
- KY: Ойлонуп көр: 25 ÷ 5 =?

### g3m_45div5
- RU: 45 ÷ 5 =?
- EN: Think it through: 45 ÷ 5 =?
- KY: Ойлонуп көр: 45 ÷ 5 =?

### g3m_30div10
- taskId: `g3mdivl3t3` correct: **a**
- options: a(Y:g3r_opt_on), b(N:g3r_opt_ona), c(N:g3r_opt_ono)
- RU: Раз 3 × 10 = 30, то 30 ÷ 10 = ? _(ответ: 3)_
- EN: Think it through: 30 ÷ 10 =?
- KY: Ойлонуп көр: 30 ÷ 10 =?

### g3m_50div10
- RU: 50 ÷ 10 =?
- EN: Think it through: 50 ÷ 10 =?
- KY: Ойлонуп көр: 50 ÷ 10 =?

### g3r_masc_question
- RU: Тали говорит про слово ДОМ: «Это ОН!» Какой это род?
- EN: Think it through: What is the masculine pronoun?
- KY: Ойлонуп көр: Какое местоимение для мужского рода?

### g3r_dom_gender
- taskId: `g3rgenl1t2` correct: **a**
- options: a(Y:g3r_opt_muzhskoy), b(N:g3r_opt_zhenskiy), c(N:g3r_opt_sredniy)
- RU: Слово СТОЛ — с каким местоимением дружит?
- EN: Think it through: What is the gender of the word HOME?
- KY: Ойлонуп көр: Какой род у слова ДОМ?

### g3r_stol_gender
- taskId: `g3rgenl1t3` correct: **a**
- options: a(Y:g3r_opt_muzhskoy), b(N:g3r_opt_zhenskiy), c(N:g3r_opt_sredniy)
- RU: Найди слово мужского рода: КОШКА, ДРУГ, КНИГА.
- EN: Think it through: What is the gender of the word TABLE?
- KY: Ойлонуп көр: Какой род у слова СТОЛ?

### g3r_drug_gender
- taskId: `g3rgenl1t4` correct: **a**
- options: a(Y:g3r_opt_muzhskoy), b(N:g3r_opt_zhenskiy), c(N:g3r_opt_sredniy)
- RU: Тали говорит: «Я рыцарь мужского рода!» Какое местоимение — боевой клич мужского рода?
- EN: Think it through: What is the gender of the word FRIEND?
- KY: Ойлонуп көр: Какой род у слова ДРУГ?

### g3r_fem_question
- taskId: `g3rgenl2t1` correct: **b**
- options: a(N:g3r_opt_on), b(Y:g3r_opt_ona), c(N:g3r_opt_ono)
- RU: Тали смотрит на слово ОКНО: «оно моё». Какой у ОКНО род?
- EN: Think it through: What is the feminine pronoun?
- KY: Ойлонуп көр: Какое местоимение для женского рода?

### g3r_koshka_gender
- taskId: `g3rgenl2t2` correct: **b**
- options: a(N:g3r_opt_muzhskoy), b(Y:g3r_opt_zhenskiy), c(N:g3r_opt_sredniy)
- RU: СОЛНЦЕ — какой род? Подставь местоимение: «___ моё»?
- EN: Think it through: What is the gender of the word CAT?
- KY: Ойлонуп көр: Какой род у слова КОШКА?

### g3r_kniga_gender
- taskId: `g3rgenl2t3` correct: **b**
- options: a(N:g3r_opt_muzhskoy), b(Y:g3r_opt_zhenskiy), c(N:g3r_opt_sredniy)
- RU: Среди слов МОЛОКО, КОШКА, СТОЛ найди слово среднего рода.
- EN: Think it through: What is the gender of the word BOOK?
- KY: Ойлонуп көр: Какой род у слова КНИГА?

### g3r_devochka_gender
- taskId: `g3rgenl2t4` correct: **b**
- options: a(N:g3r_opt_muzhskoy), b(Y:g3r_opt_zhenskiy), c(N:g3r_opt_sredniy)
- RU: Какое местоимение «дружит» со словами среднего рода: ПОЛЕ, НЕБО, ДЕРЕВО?
- EN: Think it through: What is the gender of the word GIRL?
- KY: Ойлонуп көр: Какой род у слова ДЕВОЧКА?

### g3r_neut_question
- taskId: `g3rgenl3t1` correct: **c**
- options: a(N:g3r_opt_on), b(N:g3r_opt_ona), c(Y:g3r_opt_ono)
- RU: Тали пишет про ДОМ. «Высокий дом» или «Высокое дом»?
- EN: Think it through: What is the middle gender pronoun?
- KY: Ойлонуп көр: Какое местоимение для среднего рода?

### g3r_okno_gender
- taskId: `g3rgenl3t2` correct: **c**
- options: a(N:g3r_opt_muzhskoy), b(N:g3r_opt_zhenskiy), c(Y:g3r_opt_sredniy)
- RU: «Синяя птица» или «Синий птица»? Птица — женский род, значит:
- EN: Think it through: What is the gender of the word WINDOW?
- KY: Ойлонуп көр: Какой род у слова ОКНО?

### g3r_solnce_gender
- taskId: `g3rgenl3t3` correct: **c**
- options: a(N:g3r_opt_muzhskoy), b(N:g3r_opt_zhenskiy), c(Y:g3r_opt_sredniy)
- RU: Тали пишет про МОЛОКО. «ТЁПЛОЕ молоко» — почему такое окончание?
- EN: Think it through: What is the gender of the word SUN?
- KY: Ойлонуп көр: Какой род у слова СОЛНЦЕ?

### g3r_moloko_gender
- taskId: `g3rgenl3t4` correct: **c**
- options: a(N:g3r_opt_muzhskoy), b(N:g3r_opt_zhenskiy), c(Y:g3r_opt_sredniy)
- RU: Подбери прилагательное к слову КНИГА: интересный, интересная или интересное?
- EN: Think it through: What is the gender of the word MILK?
- KY: Ойлонуп көр: Какой род у слова МОЛОКО?

### g3r_idet_present
- RU: Слово ИДЁТ — это настоящее время?
- EN: Think it through: The word IS COMING — is this the present time?
- KY: Ойлонуп көр: ИДЁТ сөзү учур чакпы?

### g3r_present_question
- taskId: `g3rverbl1t2` correct: **b**
- options: a(N:g3r_opt_chto_delal), b(Y:g3r_opt_chto_delaet), c(N:g3r_opt_chto_budet)
- RU: Глагол в настоящем времени отвечает на вопрос:
- EN: Think it through: At what time does he answer "what does he do?"?
- KY: Ойлонуп көр: «Эмне кылат?» кайсы чакка жооп берет?

### g3r_chital_is_present
- RU: Слово ЧИТАЛ — это настоящее время?
- EN: Think it through: READ the word — is this the present time?
- KY: Ойлонуп көр: ЧИТАЛ сөзү учур чакпы?

### g3r_which_present
- taskId: `g3rverbl1t4` correct: **b**
- options: a(N:g3r_opt_chital), b(Y:g3r_opt_chitaet), c(N:g3r_opt_budet_chitat)
- RU: Тали пишет дневник о событиях прямо сейчас. Какое слово он использует?
- EN: Think it through: What is the word in the present tense?
- KY: Ойлонуп көр: Какое слово в настоящем времени?

### g3r_past_question
- taskId: `g3rverbl2t1` correct: **a**
- options: a(Y:g3r_opt_chto_delal), b(N:g3r_opt_chto_delaet), c(N:g3r_opt_chto_budet)
- RU: Дедушка рассказывает о вчерашнем дне. «Я ___ в лесу». Какой глагол?
- EN: Think it through: At what time does he answer "what did you do?"?
- KY: Ойлонуп көр: «Эмне кылды?» кайсы чакка жооп берет?

### g3r_chital_past
- RU: Слово ЧИТАЛ — это прошедшее время?
- EN: Think it through: DID YOU READ the word — is it the past tense?
- KY: Ойлонуп көр: ЧИТАЛ сөзү өткөн чакпы?

### g3r_which_past
- taskId: `g3rverbl2t3` correct: **b**
- options: a(N:g3r_opt_chitaet), b(Y:g3r_opt_chital), c(N:g3r_opt_budet_chitat)
- RU: Выбери глагол в прошедшем времени: ПОБЕЖИТ, БЕЖИТ, ПОБЕЖАЛ.
- EN: Think it through: What is the word in the past tense?
- KY: Ойлонуп көр: Какое слово в прошедшем времени?

### g3r_past_changes_gender
- RU: Глагол в прошедшем времени меняется по роду?
- EN: Think it through: Does the verb change in gender in the past tense?
- KY: Ойлонуп көр: Глагол в прошедшем времени меняется по роду?

### g3r_future_question
- taskId: `g3rverbl3t1` correct: **c**
- options: a(N:g3r_opt_chto_delal), b(N:g3r_opt_chto_delaet), c(Y:g3r_opt_chto_budet)
- RU: Тали мечтает о будущем: «Я ___ в космос!» Глагол в 1-м лице:
- EN: Think it through: At what time does he answer "what will he do?"?
- KY: Ойлонуп көр: «Эмне кыла турган?» кайсы чакка жооп берет?

### g3r_which_future
- taskId: `g3rverbl3t2` correct: **c**
- options: a(N:g3r_opt_chital), b(N:g3r_opt_chitaet), c(Y:g3r_opt_budet_chitat)
- RU: Слово «читаю» — какое лицо? Подсказка: «я читаю»
- EN: Think it through: What word is in the future tense?
- KY: Ойлонуп көр: Какое слово в будущем времени?

### g3r_budet_idet_future
- RU: «Будет идёт» — правильная форма?
- EN: Think it through: "Will it go" is the correct form?
- KY: Ойлонуп көр: «Будет идёт» — правильная форма?

### g3r_budet_idti_future
- RU: «Будет идти» — правильная форма?
- EN: Think it through: “Will it go” is the correct form?
- KY: Ойлонуп көр: «Будет идти» — правильная форма?

### g3r_krasny_adj
- taskId: `g3radjl1t1` correct: **a**
- options: a(Y:opt_yes), b(N:opt_no)
- RU: Художник рисует дом. «Дом какой?» — это вопрос к прилагательному или существительному?
- EN: Think it through: Is the word RED an adjective?
- KY: Ойлонуп көр: КРАСНЫЙ сөзү сын атоочпу?

### g3r_adj_color_examples
- taskId: `g3radjl1t2` correct: **a**
- options: a(Y:g3r_opt_sinil_belyj), b(N:g3r_opt_idet_sidit), c(N:g3r_opt_stol_kniga)
- RU: «___ шар» — прилагательное КРАСНЫЙ. Какая форма нужна?
- EN: Think it through: Which words are adjective colors?
- KY: Ойлонуп көр: Какие слова — прилагательные цвета?

### g3r_zeleny_dom_adj
- taskId: `g3radjl1t3` correct: **a**
- options: a(Y:g3r_opt_zeleny), b(N:g3r_opt_dom)
- RU: «Высокое дерево» или «высокий дерево»? ДЕРЕВО — средний род.
- EN: Think it through: Which adjective fits the word HOME?
- KY: Ойлонуп көр: Какое прилагательное подходит к слову ДОМ?

### g3r_adj_for_masc
- taskId: `g3radjl1t4` correct: **a**
- options: a(Y:g3r_opt_krasny), b(N:g3r_opt_krasnaya), c(N:g3r_opt_krasnoe)
- RU: «КРАСИВЫЙ закат» или «красивое закат»? ЗАКАТ — мужской род.
- EN: Think it through: What is the masculine form of the adjective?
- KY: Ойлонуп көр: Какая форма прилагательного для мужского рода?

### g3r_bolshoy_adj
- RU: Слово БОЛЬШОЙ — это прилагательное?
- EN: Think it through: Is the word BIG an adjective?
- KY: Ойлонуп көр: БОЛЬШОЙ сөзү сын атоочпу?

### g2r_subject_is
- taskId: `g2rsentl2t1` correct: **a**
- options: a(Y:g2r_opt_about_who), b(N:g2r_opt_action), c(N:g2r_opt_sign)
- RU: Подлежащее — это…
- EN: Think it through: Subject is:
- KY: Ойлонуп көр: Подлежащее — это:

### g2r_predicate_is
- taskId: `g2rsentl2t2` correct: **b**
- options: a(N:g2r_opt_about_who), b(Y:g2r_opt_action), c(N:g2r_opt_sign)
- RU: Сказуемое — это…
- EN: Think it through: The predicate is:
- KY: Ойлонуп көр: Сказуемое — это:

### g2r_kot_sidit_subject
- taskId: `g2rsentl2t3` correct: **a**
- options: a(Y:g2r_opt_kot), b(N:g2r_opt_sidit)
- RU: В предложении «Кот сидит» подлежащее — это:
- EN: Think it through: In the sentence "The cat sits", the following is subject to:
- KY: Ойлонуп көр: «Кот сидит» сүйлөмүндө ээ:

### g2r_kot_sidit_predicate
- taskId: `g2rsentl2t4` correct: **b**
- options: a(N:g2r_opt_kot), b(Y:g2r_opt_sidit)
- RU: В предложении «Кот сидит» сказуемое — это:
- EN: Think it through: In the sentence "The cat sits", the predicate:
- KY: Ойлонуп көр: «Кот сидит» сүйлөмүндө баяндооч:

### g2r_sentence_first_word
- taskId: `g2rsentl3t1` correct: **a**
- options: a(Y:opt_yes), b(N:opt_no)
- RU: Слова в предложении связаны между собой?
- EN: Think it through: Is the first word in the sentence capitalized?
- KY: Ойлонуп көр: Сүйлөмдөгү биринчи сөз баш тамга менен жазылатбы?

### g2r_sentence_end_dot
- taskId: `g2rsentl3t2` correct: **a**
- options: a(Y:opt_yes), b(N:opt_no)
- RU: Тали написал: «Кот. Бежит. Быстро.» — Маша говорит, это три отдельных слова, а не предложение. Права ли Маша?
- EN: Think it through: Is there a period at the end of the sentence?
- KY: Ойлонуп көр: В конце предложения ставится точка?

### g2r_names_capital
- taskId: `g2rsentl3t3` correct: **a**
- options: a(Y:opt_yes), b(N:opt_no)
- RU: Выбери правильное сочетание слов:
- EN: Think it through: Are names capitalized?
- KY: Ойлонуп көр: Аттар баш тамга менен жазылатбы?

### g2r_which_correct_sent
- taskId: `g2rsentl3t4` correct: **b**
- options: a(N:g2r_opt_wrong_sent), b(Y:g2r_opt_correct_sent)
- RU: Тали написал: «мама готовит обед.» Маша говорит, что предложение начинается с маленькой буквы — это ошибка. Как правильно?
- EN: Think it through: Which sentence is written correctly?
- KY: Ойлонуп көр: Какое предложение написано правильно?

### g2s_root_function
- taskId: `g2spltl1t1` correct: **a**
- options: a(Y:g2s_opt_water_food), b(N:g2s_opt_photosyn), c(N:g2s_opt_flowers)
- RU: Тали поливает цветок, но вода утекает в землю. «Зря лью!» — говорит он. Для чего корень поглощает воду?
- EN: Think it through: The root of the plant is needed for:
- KY: Ойлонуп көр: Корень растения нужен для:

### g2s_leaf_function
- taskId: `g2spltl1t2` correct: **b**
- options: a(N:g2s_opt_water_food), b(Y:g2s_opt_photosyn), c(N:g2s_opt_flowers)
- RU: Арчи видит листья и спрашивает: зачем они нужны?
- EN: Think it through: The leaves are needed for:
- KY: Ойлонуп көр: Листья нужны для:

### g2s_stem_carries
- RU: Стебель проводит воду и питательные вещества?
- EN: Think it through: Does the stem conduct water and nutrients?
- KY: Ойлонуп көр: Стебель проводит воду и питательные вещества?

### g2s_plant_parts_count
- taskId: `g2spltl1t4` correct: **c**
- options: a(N:opt_three), b(N:opt_four), c(Y:opt_five)
- RU: Тали считает части растения: корень, стебель, листья, цветок, плод. Сколько он насчитал?
- EN: Think it through: How many main parts does the plant have?
- KY: Ойлонуп көр: Өсүмдүктүн канча негизги бөлүгү бар?

### g2s_plants_need_sun
- RU: Растениям нужен свет?
- EN: Think it through: Do plants need light?
- KY: Ойлонуп көр: Растениям нужен свет?

### g2s_photosyn_needs
- taskId: `g2spltl2t2` correct: **a**
- options: a(Y:g2s_opt_sun_water_co2), b(N:g2s_opt_only_water), c(N:g2s_opt_only_sun)
- RU: Что нужно растению для фотосинтеза? Тали перечисляет: «свет, вода и… и… что ещё?»
- EN: Think it through: Photosynthesis requires:
- KY: Ойлонуп көр: Для фотосинтеза нужны:

### g2s_plants_make_oxygen
- taskId: `g2spltl2t3` correct: **a**
- options: a(Y:opt_yes), b(N:opt_no)
- RU: Тали восклицает: «Растения дышат и выделяют кислород — значит, они помогают нам дышать?!» Это правда?
- EN: Think it through: Do plants release oxygen?
- KY: Ойлонуп көр: Растения выделяют кислород?

### g2s_seed_grows_into
- taskId: `g2spltl2t4` correct: **a**
- options: a(Y:g2s_opt_plant_f), b(N:g2s_opt_animal_f), c(N:g2s_opt_stone_f)
- RU: Где в растении происходит фотосинтез?
- EN: Think it through: From the seed grows:
- KY: Ойлонуп көр: Из семени вырастает:

### g2s_carrot_part
- taskId: `g2spltl3t1` correct: **a**
- options: a(Y:g2s_opt_root_p), b(N:g2s_opt_fruit_p), c(N:g2s_opt_leaf_p)
- RU: Тали держит морковь и спрашивает: «Какая это часть растения?»
- EN: Think it through: What part of the plant are carrots?
- KY: Ойлонуп көр: Сабиз — өсүмдүктүн кайсы бөлүгү?

### g2s_tomato_part
- taskId: `g2spltl3t2` correct: **b**
- options: a(N:g2s_opt_root_p), b(Y:g2s_opt_fruit_p), c(N:g2s_opt_leaf_p)
- RU: Арчи нашёл помидор и задумался: «Это плод или лист?»
- EN: Think it through: What part of the plant is a tomato?
- KY: Ойлонуп көр: Помидор — өсүмдүктүн кайсы бөлүгү?

### g2s_spinach_part
- taskId: `g2spltl3t3` correct: **c**
- options: a(N:g2s_opt_root_p), b(N:g2s_opt_fruit_p), c(Y:g2s_opt_leaf_p)
- RU: Тали видит шпинат и говорит: «Это плод!» Арчи сомневается. Что такое шпинат?
- EN: Think it through: Spinach — what part of the plant is it?
- KY: Ойлонуп көр: Шпинат — өсүмдүктүн кайсы бөлүгү?

### g2s_potato_part
- taskId: `g2spltl3t4` correct: **a**
- options: a(Y:g2s_opt_root_p), b(N:g2s_opt_fruit_p), c(N:g2s_opt_stem_p)
- RU: Картофель растёт под землёй. Какая это часть растения?
- EN: Think it through: Potatoes — what part of the plant?
- KY: Ойлонуп көр: Картошка — өсүмдүктүн кайсы бөлүгү?

### g2s_mammal_is
- taskId: `g2sanil1t1` correct: **a**
- options: a(Y:g2s_opt_dog_cl), b(N:g2s_opt_eagle_cl), c(N:g2s_opt_frog_cl)
- RU: Кто из перечисленных — млекопитающее?
- EN: Think it through: Who is the mammal?
- KY: Ойлонуп көр: Кто млекопитающее?

### g2s_mammal_feature
- RU: Признак млекопитающих:
- EN: Think it through: Mammalian trait:
- KY: Ойлонуп көр: Признак млекопитающих:

### g2s_whale_mammal
- taskId: `g2sanil1t3` correct: **a**
- options: a(Y:opt_yes), b(N:opt_no)
- RU: Тали удивлён: «Кит живёт в воде — он точно не млекопитающее!» Это правда?
- EN: Think it through: Is a whale a mammal?
- KY: Ойлонуп көр: Кит — млекопитающее?

### g2s_bat_mammal
- taskId: `g2sanil1t4` correct: **a**
- options: a(Y:opt_yes), b(N:opt_no)
- RU: Летучая мышь — млекопитающее?
- EN: Think it through: Is a bat a mammal?
- KY: Ойлонуп көр: Летучая мышь — млекопитающее?

### g2s_bird_is
- taskId: `g2sanil2t1` correct: **a**
- options: a(Y:g2s_opt_sparrow_cl), b(N:g2s_opt_bat_cl), c(N:g2s_opt_fish_cl)
- RU: Кто из перечисленных — птица?
- EN: Think it through: Who is the bird?
- KY: Ойлонуп көр: Кто птица?

### g2s_bird_feature
- taskId: `g2sanil2t2` correct: **a**
- options: a(Y:g2s_opt_has_feathers), b(N:g2s_opt_has_fur), c(N:g2s_opt_has_scales)
- RU: Главный признак птиц — это:
- EN: Think it through: Feature of birds:
- KY: Ойлонуп көр: Признак птиц:

### g2s_penguin_bird
- taskId: `g2sanil2t3` correct: **a**
- options: a(Y:opt_yes), b(N:opt_no)
- RU: Тали спрашивает: «Пингвин — птица или нет?» Арчи сомневается. Помоги им!
- EN: Think it through: Is a penguin a bird?
- KY: Ойлонуп көр: Пингвин — птица?

### g2s_all_birds_fly
- taskId: `g2sanil2t4` correct: **b**
- options: a(N:opt_yes), b(Y:opt_no)
- RU: Все ли птицы умеют летать?
- EN: Think it through: Can all birds fly?
- KY: Ойлонуп көр: Все птицы умеют летать?

### g2s_fish_breathes
- taskId: `g2sanil3t1` correct: **a**
- options: a(Y:g2s_opt_gills), b(N:g2s_opt_lungs), c(N:g2s_opt_skin)
- RU: Рыба дышит с помощью:
- EN: Think it through: The fish breathes:
- KY: Ойлонуп көр: Рыба дышит:

### g2s_insect_legs
- RU: Сколько ног у насекомого?
- EN: Think it through: How many legs does an insect have?
- KY: Ойлонуп көр: Курт-кумурскада канча бут бар?

### g2s_spider_insect
- taskId: `g2sanil3t3` correct: **b**
- options: a(N:opt_yes), b(Y:opt_no)
- RU: Тали утверждает: «Паук — это насекомое!» Арчи теперь знает ответ. Прав ли Тали?
- EN: Think it through: Is a spider an insect?
- KY: Ойлонуп көр: Паук — насекомое?

### g2s_butterfly_insect
- taskId: `g2sanil3t4` correct: **a**
- options: a(Y:opt_yes), b(N:opt_no)
- RU: Бабочка — это насекомое?
- EN: Think it through: Is a butterfly an insect?
- KY: Ойлонуп көр: Бабочка — насекомое?

### g2s_skeleton_function
- taskId: `g2sbdyl1t1` correct: **a**
- options: a(Y:g2s_opt_support), b(N:g2s_opt_digestion), c(N:g2s_opt_breathing)
- RU: Тали хочет понять: для чего нужен скелет?
- EN: Think it through: The skeleton is needed for:
- KY: Ойлонуп көр: Скелет нужен для:

### g2s_muscles_do
- taskId: `g2sbdyl1t2` correct: **a**
- options: a(Y:g2s_opt_move_body), b(N:g2s_opt_digest), c(N:g2s_opt_breathe)
- RU: Арчи спрашивает: мышцы нужны для того, чтобы…
- EN: Think it through: Muscles are needed for:
- KY: Ойлонуп көр: Мышцы нужны для:

### g3r_size_adj_examples
- taskId: `g3radjl2t2` correct: **a**
- options: a(Y:g3r_opt_bolshoy_maliy), b(N:g3r_opt_idet_bezhit), c(N:g3r_opt_dom_shkola)
- RU: Как образуется сравнительная степень от БЫСТРЫЙ?
- EN: Think it through: Which words are size adjectives?
- KY: Ойлонуп көр: Какие слова — прилагательные размера?

### g3r_malenkaya_sobaka_adj
- RU: Какое прилагательное подходит к слову СОБАКА?
- EN: Think it through: Which adjective fits the word DOG?
- KY: Ойлонуп көр: Какое прилагательное подходит к слову СОБАКА?

### g3r_adj_for_fem
- taskId: `g3radjl2t4` correct: **b**
- options: a(N:g3r_opt_krasny), b(Y:g3r_opt_krasnaya), c(N:g3r_opt_krasnoe)
- RU: Черепаха медленная. Улитка ___ черепахи. Нужна сравнительная степень:
- EN: Think it through: What is the form of the feminine adjective?
- KY: Ойлонуп көр: Какая форма прилагательного для женского рода?

### g3r_krasny_for_stol
- taskId: `g3radjl3t1` correct: **a**
- options: a(Y:g3r_opt_krasny), b(N:g3r_opt_krasnaya), c(N:g3r_opt_krasnoe)
- RU: Антоним к слову ВЕСЁЛЫЙ:
- EN: Think it through: What is the form of the adjective for the word TABLE?
- KY: Ойлонуп көр: Какая форма прилагательного для слова СТОЛ?

### g3r_krasnoe_for_okno
- taskId: `g3radjl3t2` correct: **c**
- options: a(N:g3r_opt_krasny), b(N:g3r_opt_krasnaya), c(Y:g3r_opt_krasnoe)
- RU: Антоним к слову ТЁПЛЫЙ:
- EN: Think it through: What is the form of the adjective for the word WINDOW?
- KY: Ойлонуп көр: Какая форма прилагательного для слова ОКНО?

### g3r_krasnaya_for_kniga
- taskId: `g3radjl3t3` correct: **b**
- options: a(N:g3r_opt_krasny), b(Y:g3r_opt_krasnaya), c(N:g3r_opt_krasnoe)
- RU: Пара антонимов — как день и ночь. Выбери настоящую пару:
- EN: Think it through: What is the form of the adjective for the word BOOK?
- KY: Ойлонуп көр: Какая форма прилагательного для слова КНИГА?

### g3r_adj_agrees_noun
- RU: Прилагательное согласуется с существительным в роде?
- EN: Think it through: Is the adjective consistent with a gender noun?
- KY: Ойлонуп көр: Прилагательное согласуется с существительным в роде?

### g3w_continents_count
- taskId: `g3wgeol1t1` correct: **b**
- options: a(N:g3w_geol1t1_a), b(Y:g3w_geol1t1_b), c(N:g3w_geol1t1_c)
- RU: Компас показывает четыре направления. Какие — основные?
- EN: Think it through: How many continents are there on Earth?
- KY: Ойлонуп көр: Жерде канча континент бар?

### g3w_largest_continent
- taskId: `g3wgeol1t2` correct: **a**
- options: a(Y:g3w_geol1t2_a), b(N:g3w_geol1t2_b), c(N:g3w_geol1t2_c)
- RU: Тали идёт навстречу восходящему солнцу. В какую сторону он движется?
- EN: Think it through: Largest continent:
- KY: Ойлонуп көр: Самый большой материк:

### g3w_smallest_continent
- taskId: `g3wgeol1t3` correct: **b**
- options: a(N:g3w_geol1t3_a), b(Y:g3w_geol1t3_b), c(N:g3w_geol1t3_c)
- RU: На карте «север» сверху. Где находится «юг»?
- EN: Think it through: d) The smallest continent is ... .
- KY: Ойлонуп көр: Самый маленький материк:

### g3w_russia_on_continent
- taskId: `g3wgeol1t4` correct: **a**
- options: a(Y:g3w_geol1t4_a), b(N:g3w_geol1t4_b), c(N:g3w_geol1t4_c)
- RU: Тали встал лицом на север. Что справа?
- EN: Think it through: What continent is Russia on?
- KY: Ойлонуп көр: На каком материке находится Россия?

### g3w_oceans_count
- taskId: `g3wgeol2t1` correct: **b**
- options: a(N:g3w_geol2t1_a), b(Y:g3w_geol2t1_b), c(N:g3w_geol2t1_c)
- RU: Тали спрашивает: чем карта отличается от глобуса?
- EN: Think it through: How many oceans are there on Earth?
- KY: Ойлонуп көр: Жерде канча океан бар?

### g3w_largest_ocean
- taskId: `g3wgeol2t2` correct: **b**
- options: a(N:g3w_geol2t2_a), b(Y:g3w_geol2t2_b), c(N:g3w_geol2t2_c)
- RU: На карте синим обозначены моря и океаны, а зелёным — что?
- EN: Think it through: The largest ocean:
- KY: Ойлонуп көр: Самый большой океан:

### g3w_arctic_ocean
- taskId: `g3wgeol2t3` correct: **a**
- options: a(Y:g3w_geol2t3_a), b(N:g3w_geol2t3_b), c(N:g3w_geol2t3_c)
- RU: Масштаб 1:100 000 означает:
- EN: Think it through: The Arctic Ocean is located at:
- KY: Ойлонуп көр: Северный Ледовитый океан находится у:

### g3w_water_more
- taskId: `g3wgeol2t4` correct: **a**
- options: a(Y:g3w_geol2t4_a), b(N:g3w_geol2t4_b), c(N:g3w_geol2t4_c)
- RU: Сколько материков на планете Земля?
- EN: Think it through: Is there more water than land on Earth?
- KY: Ойлонуп көр: На Земле воды больше, чем суши?

### g3w_russia_capital
- taskId: `g3wgeol3t1` correct: **a**
- options: a(Y:g3w_opt_moscow), b(N:g3w_opt_spb), c(N:g3w_opt_novosibirsk)
- RU: Столица России:
- EN: Think it through: The capital of Russia
- KY: Ойлонуп көр: Столица России:

### g3w_france_capital
- taskId: `g3wgeol3t2` correct: **b**
- options: a(N:g3w_opt_london), b(Y:g3w_opt_paris), c(N:g3w_opt_berlin)
- RU: Эйфелева башня стоит в столице Франции. Это:
- EN: Think it through: Capital of France:
- KY: Ойлонуп көр: Столица Франции:

### g3w_uk_capital
- taskId: `g3wgeol3t3` correct: **a**
- options: a(Y:g3w_opt_london), b(N:g3w_opt_paris), c(N:g3w_opt_berlin)
- RU: Столица Великобритании:
- EN: Think it through: Capital of the United Kingdom:
- KY: Ойлонуп көр: Столица Великобритании:

### g3w_kyrgyzstan_capital
- taskId: `g3wgeol3t4` correct: **a**
- options: a(Y:g3w_opt_bishkek), b(N:g3w_opt_almaty), c(N:g3w_opt_tashkent)
- RU: Тали живёт в Бишкеке. Бишкек — столица какой страны?
- EN: Think it through: Capital of Kyrgyzstan:
- KY: Ойлонуп көр: Столица Кыргызстана:

### g3w_water_cycle_steps
- taskId: `g3wnatl1t1` correct: **a**
- options: a(Y:g3w_opt_evaporation), b(N:g3w_opt_explosion), c(N:g3w_opt_erosion)
- RU: Тали смотрит на лужу — она исчезла. Это первый шаг круговорота воды. Как он называется?
- EN: Think it through: The first stage of the water cycle:
- KY: Ойлонуп көр: Первый этап круговорота воды:

### g3w_clouds_form_from
- taskId: `g3wnatl1t2` correct: **a**
- options: a(Y:g3w_opt_water_vapor), b(N:g3w_opt_dust), c(N:g3w_opt_smoke)
- RU: Водяной пар поднялся и охладился. Во что он превратился?
- EN: Think it through: Clouds are formed from:
- KY: Ойлонуп көр: Облака образуются из:

### g3w_rain_comes_from
- taskId: `g3wnatl1t3` correct: **a**
- options: a(Y:g3w_opt_clouds), b(N:g3w_opt_rivers), c(N:g3w_opt_sea)
- RU: Облака набрали тяжесть. Что происходит дальше?
- EN: Think it through: It rains from:
- KY: Ойлонуп көр: Дождь идёт из:

### g3w_water_evaporates
- RU: Вода испаряется с поверхности?
- EN: Think it through: Is water evaporating from the surface?
- KY: Ойлонуп көр: Вода испаряется с поверхности?

### g3w_hottest_zone
- taskId: `g3wnatl2t1` correct: **a**
- options: a(Y:g3w_opt_equatorial), b(N:g3w_opt_temperate), c(N:g3w_opt_polar)
- RU: Уголь, нефть и газ образовались из остатков древних живых существ. Как называются такие ископаемые?
- EN: Think it through: The hottest zone of the Earth:
- KY: Ойлонуп көр: Самая жаркая зона Земли:

### g3w_coldest_zone
- taskId: `g3wnatl2t2` correct: **c**
- options: a(N:g3w_opt_equatorial), b(N:g3w_opt_temperate), c(Y:g3w_opt_polar)
- RU: Нефть добывают и используют для:
- EN: Think it through: The coldest zone of the Earth:
- KY: Ойлонуп көр: Самая холодная зона Земли:

### g3w_russia_zone
- taskId: `g3wnatl2t3` correct: **a**
- options: a(Y:g3w_opt_temperate), b(N:g3w_opt_equatorial), c(N:g3w_opt_polar)
- RU: Железная руда — полезное ископаемое. Что из неё производят?
- EN: Think it through: Russia is in the zone:
- KY: Ойлонуп көр: Россия находится в зоне:

### g3w_desert_zone
- taskId: `g3wnatl2t4` correct: **b**
- options: a(N:g3w_opt_equatorial), b(Y:g3w_opt_desert_z), c(N:g3w_opt_polar)
- RU: Гранит — очень твёрдая горная порода. К каким ископаемым она относится?
- EN: Think it through: The desert is a zone:
- KY: Ойлонуп көр: Пустыня — это зона:

### g3w_protect_nature_how
- taskId: `g3wnatl3t1` correct: **a**
- options: a(Y:g3w_opt_recycle), b(N:g3w_opt_burn_trash), c(N:g3w_opt_cut_trees)
- RU: Зачем создали Красную книгу?
- EN: Think it through: How to protect nature?
- KY: Ойлонуп көр: Табиятты кантип коргоо керек?

### g3w_plant_trees_help
- RU: Посадка деревьев помогает природе?
- EN: Think it through: Does planting trees help nature?
- KY: Ойлонуп көр: Посадка деревьев помогает природе?

### g3w_red_book_is
- taskId: `g3wnatl3t3` correct: **a**
- options: a(Y:g3w_opt_endangered), b(N:g3w_opt_extinct), c(N:g3w_opt_recipe_book)
- RU: Деревья в городе дают:
- EN: Think it through: Red Book:
- KY: Ойлонуп көр: Красная книга — это:

### g3w_recycling_good
- RU: Переработка мусора — это хорошо?
- EN: Think it through: Is recycling a good thing?
- KY: Ойлонуп көр: Переработка мусора — это хорошо?

### g3w_ecology_studies
- taskId: `g3wecol1t1` correct: **a**
- options: a(Y:g3w_opt_nature_relations), b(N:g3w_opt_math_calc), c(N:g3w_opt_history)
- RU: Если вырубить все деревья в лесу, что произойдёт с его жителями?
- EN: Think it through: Ecology studies:
- KY: Ойлонуп көр: Экология изучает:

### g3e_i_blank_happy
- taskId: `g3etobel1t1` correct: **a**
- options: a(Y:g1e_opt_am), b(N:g1e_opt_is), c(N:g1e_opt_are)
- RU: «I ___ happy today!» Тали не уверен: am, is или are?
- EN: Think it through: I ___ happy. What word?
- KY: Ойлонуп көр: I ___ happy. Какое слово?

### g3e_you_blank_smart
- taskId: `g3etobel1t2` correct: **c**
- options: a(N:g1e_opt_am), b(N:g1e_opt_is), c(Y:g1e_opt_are)
- RU: «You ___ my best friend.»
- EN: Think it through: You ___ smart. What word?
- KY: Ойлонуп көр: You ___ smart. Какое слово?

### g3e_am_used_with
- taskId: `g3etobel1t3` correct: **a**
- options: a(Y:g3e_opt_I_pron), b(N:g3e_opt_you_pron), c(N:g3e_opt_he_pron)
- RU: С каким местоимением используется «am»?
- EN: Think it through: Am is used with:
- KY: Ойлонуп көр: Am используется с:

### g3e_am_negative
- taskId: `g3etobel1t4` correct: **a**
- options: a(Y:g3e_opt_i_am_not), b(N:g3e_opt_i_is_not), c(N:g3e_opt_i_are_not)
- RU: «Я не счастлив» по-английски:
- EN: Think it through: Negation I am:
- KY: Ойлонуп көр: Отрицание I am:

### g3e_he_blank_tall
- taskId: `g3etobel2t1` correct: **b**
- options: a(N:g1e_opt_am), b(Y:g1e_opt_is), c(N:g1e_opt_are)
- RU: «He ___ tall» — выбери форму для утверждения:
- EN: Think it through: He ___ tall. What word?
- KY: Ойлонуп көр: He ___ tall. Какое слово?

### g3e_she_blank_kind
- taskId: `g3etobel2t2` correct: **b**
- options: a(N:g1e_opt_am), b(Y:g1e_opt_is), c(N:g1e_opt_are)
- RU: Превращаем в отрицание: «She is kind» → «She ___ kind»:
- EN: Think it through: She ___ kind. What word?
- KY: Ойлонуп көр: She ___ kind. Какое слово?

### g3e_it_blank_big
- taskId: `g3etobel2t3` correct: **b**
- options: a(N:g1e_opt_am), b(Y:g1e_opt_is), c(N:g1e_opt_are)
- RU: «It isn't big» — это правильное отрицание?
- EN: Think it through: It ___ big. What word?
- KY: Ойлонуп көр: It ___ big. Какое слово?

### g3e_is_question_tag
- taskId: `g3etobel2t4` correct: **a**
- options: a(Y:g3e_opt_is_he), b(N:g3e_opt_am_he), c(N:g3e_opt_are_he)
- RU: «He is late» → отрицание:
- EN: Think it through: Question to "He is":
- KY: Ойлонуп көр: Вопрос к «He is»:

### g3e_we_blank_ready
- taskId: `g3etobel3t1` correct: **c**
- options: a(N:g1e_opt_am), b(N:g1e_opt_is), c(Y:g1e_opt_are)
- RU: «We are ready» → «___ we ready?»
- EN: Think it through: We ___ ready. What word?
- KY: Ойлонуп көр: We ___ ready. Какое слово?

### g3e_they_blank_students
- taskId: `g3etobel3t2` correct: **c**
- options: a(N:g1e_opt_am), b(N:g1e_opt_is), c(Y:g1e_opt_are)
- RU: «They are students.» → Вопрос:
- EN: Think it through: They ___ students. What word?
- KY: Ойлонуп көр: They ___ students. Какое слово?

### g3e_are_they_question
- taskId: `g3etobel3t3` correct: **a**
- options: a(Y:g3e_opt_are_they), b(N:g3e_opt_is_they), c(N:g3e_opt_am_they)
- RU: Правильный вопрос к ответу «Yes, she is»:
- EN: Think it through: Question to "They are":
- KY: Ойлонуп көр: Вопрос к «They are»:

### g3e_are_we_question
- taskId: `g3etobel3t4` correct: **a**
- options: a(Y:g3e_opt_are_we), b(N:g3e_opt_is_we), c(N:g3e_opt_am_we)
- RU: «Они дома?» по-английски:
- EN: Think it through: Question to "We are":
- KY: Ойлонуп көр: Вопрос к «We are»:

### g3e_apple_en
- taskId: `g3efoodl1t1` correct: **a**
- options: a(Y:g3e_opt_apple), b(N:g3e_opt_orange), c(N:g3e_opt_banana)
- RU: Juice — это:
- EN: Think it through: Apple in English:
- KY: Ойлонуп көр: Алма англисче:

### g3e_orange_en
- taskId: `g3efoodl1t2` correct: **b**
- options: a(N:g3e_opt_apple), b(Y:g3e_opt_orange), c(N:g3e_opt_grape)
- RU: Porridge — это:
- EN: Think it through: Orange in English:
- KY: Ойлонуп көр: Апельсин англисче:

### g3e_banana_is_fruit
- RU: Banana — это фрукт?
- EN: Think it through: Is Banana a fruit?
- KY: Ойлонуп көр: Banana — это фрукт?

### g3e_what_fruit_grape
- taskId: `g3efoodl1t4` correct: **b**
- options: a(N:g3e_opt_apple), b(Y:g3e_opt_grape), c(N:g3e_opt_banana)
- RU: «I drink water every day» — что пьёт этот человек?
- EN: Think it through: Which fruit is grape?
- KY: Ойлонуп көр: Какой фрукт — grape?

### g3e_carrot_en
- taskId: `g3efoodl2t1` correct: **a**
- options: a(Y:g3e_opt_carrot), b(N:g3e_opt_potato), c(N:g3e_opt_tomato)
- RU: «I like apples!» — Маша это говорит. Что это значит?
- EN: Think it through: Carrots in English:
- KY: Ойлонуп көр: Сабиз англисче:

### g3e_tomato_en
- taskId: `g3efoodl2t2` correct: **c**
- options: a(N:g3e_opt_carrot), b(N:g3e_opt_potato), c(Y:g3e_opt_tomato)
- RU: «I don't like onions» — Ваня морщится. Onions — это:
- EN: Think it through: Tomato in English:
- KY: Ойлонуп көр: Помидор англисче:

### g3e_onion_is_veg
- RU: Onion — это овощ?
- EN: Think it through: Is Onion a vegetable?
- KY: Ойлонуп көр: Onion — это овощ?

### g3e_potato_en
- taskId: `g3efoodl2t4` correct: **b**
- options: a(N:g3e_opt_carrot), b(Y:g3e_opt_potato), c(N:g3e_opt_tomato)
- RU: Другу не нравится суп. Как он скажет?
- EN: Think it through: Potatoes in English:
- KY: Ойлонуп көр: Картошка англисче:

### g3e_i_like_apples
- taskId: `g3efoodl3t1` correct: **a**
- options: a(Y:g3e_opt_i_like), b(N:g3e_opt_i_dont_like), c(N:g3e_opt_i_eat)
- RU: «Can I have some bread, please?» — о чём просит человек?
- EN: Think it through: "I like apples" in English:
- KY: Ойлонуп көр: «Мага алма жагат» англисче:

### g3e_i_dont_like_means
- taskId: `g3efoodl3t2` correct: **b**
- options: a(N:g3e_opt_i_like_ru), b(Y:g3e_opt_i_dont_like_ru), c(N:g3e_opt_i_eat_ru)
- RU: «Pass me the salt, please» — о чём просит человек?
- EN: Think it through: I don't like is:
- KY: Ойлонуп көр: I don't like — это:

### g3e_do_you_like_pizza
- taskId: `g3efoodl3t3` correct: **a**
- options: a(Y:g3e_opt_yes_i_like), b(N:g3e_opt_yes_he_like), c(N:g3e_opt_yes_i_likes)
- RU: «It's delicious!» — гость говорит это про еду. Что он чувствует?
- EN: Think it through: "Do you like pizza?" is the correct answer:
- KY: Ойлонуп көр: «Do you like pizza?» — правильный ответ:

### g3e_she_likes_pasta
- taskId: `g3efoodl3t4` correct: **b**
- options: a(N:g3e_opt_she_like), b(Y:g3e_opt_she_likes), c(N:g3e_opt_she_liked)
- RU: Как вежливо отказаться от добавки?
- EN: Think it through: "She likes pasta" in English:
- KY: Ойлонуп көр: «Ага макарон жагат» англисче:

### g3e_wake_up_en
- taskId: `g3edailyl1t1` correct: **a**
- options: a(Y:g3e_opt_wake_up_f), b(N:g3e_opt_go_sleep), c(N:g3e_opt_have_lunch)
- RU: Будильник звонит в 7 утра. «Wake up» — это:
- EN: Think it through: Wake up in English:
- KY: Ойлонуп көр: «Ойгонуу» англисче:

### g3e_brush_teeth_en
- taskId: `g3edailyl1t2` correct: **a**
- options: a(Y:g3e_opt_brush_teeth), b(N:g3e_opt_eat_breakfast), c(N:g3e_opt_take_shower)
- RU: После завтрака Том чистит зубы. «Brush teeth» — это:
- EN: Think it through: "Brush your teeth" in English:
- KY: Ойлонуп көр: «Тишти тазалоо» англисче:

### g3e_i_wake_up_at_7
- taskId: `g3edailyl1t3` correct: **a**
- options: a(Y:g3e_opt_at_correct), b(N:g3e_opt_in_correct), c(N:g3e_opt_on_correct)
- RU: «I wake up at 7» — какой предлог перед временем?
- EN: Think it through: "I wake up at 7" is the correct preposition:
- KY: Ойлонуп көр: «I wake up at 7» — правильный предлог:

### g3e_eat_breakfast_means
- taskId: `g3edailyl1t4` correct: **a**
- options: a(Y:g3e_opt_breakfast_ru), b(N:g3e_opt_dinner_ru), c(N:g3e_opt_supper_ru)
- RU: «Eat breakfast» — это:
- EN: Think it through: Eat breakfast is:
- KY: Ойлонуп көр: Eat breakfast — это:

### g3e_study_en
- taskId: `g3edailyl2t1` correct: **a**
- options: a(Y:g3e_opt_study), b(N:g3e_opt_play), c(N:g3e_opt_sleep)
- RU: «Half past three» — это:
- EN: Think it through: “Learn” English:
- KY: Ойлонуп көр: «Окуу» англисче:

### g3e_write_en
- taskId: `g3edailyl2t2` correct: **b**
- options: a(N:g3e_opt_read_w), b(Y:g3e_opt_write_w), c(N:g3e_opt_count_w)
- RU: «Quarter past eight» — это:
- EN: Think it through: "Write" in English:
- KY: Ойлонуп көр: «Жазуу» англисче:

### g3e_i_study_math
- taskId: `g3edailyl2t3` correct: **a**
- options: a(Y:g3e_opt_study), b(N:g3e_opt_studies), c(N:g3e_opt_studied)
- RU: «It's five o'clock» — который час?
- EN: Think it through: "I ___ math" — what word?
- KY: Ойлонуп көр: «I ___ math» — кайсы сөз?

### g3e_he_studies
- taskId: `g3edailyl2t4` correct: **b**
- options: a(N:g3e_opt_study), b(Y:g3e_opt_studies), c(N:g3e_opt_studying)
- RU: Как спросить «Который час?» по-английски?
- EN: Think it through: "He ___" — what form?
- KY: Ойлонуп көр: «He ___» — кайсы форма?

### g3e_play_football_en
- taskId: `g3edailyl3t1` correct: **a**
- options: a(Y:g3e_opt_play_football), b(N:g3e_opt_watch_tv), c(N:g3e_opt_read_book)
- RU: «I always brush my teeth» — «always» означает:
- EN: Think it through: "Play Football" in English:
- KY: Ойлонуп көр: «Футбол ойноо» англисче:

### g3e_watch_tv_means
- taskId: `g3edailyl3t2` correct: **a**
- options: a(Y:g3e_opt_tv_ru), b(N:g3e_opt_football_ru), c(N:g3e_opt_book_ru)
- RU: Расставь по убыванию частоты:
- EN: Think it through: Watch TV is:
- KY: Ойлонуп көр: Watch TV — это:

### g3e_what_do_you_like
- taskId: `g3edailyl3t3` correct: **a**
- options: a(Y:g3e_opt_i_like_reading), b(N:g3e_opt_he_like_reading), c(N:g3e_opt_i_likes_reading)
- RU: «She sometimes plays football» — как часто она играет?
- EN: Think it through: "What do you like?" is the correct answer:
- KY: Ойлонуп көр: «What do you like?» — правильный ответ:

### g3e_hobbies_question
- taskId: `g3edailyl3t4` correct: **a**
- options: a(Y:g3e_opt_what_hobby), b(N:g3e_opt_where_hobby), c(N:g3e_opt_when_hobby)
- RU: «Я никогда не опаздываю» по-английски:
- EN: Think it through: Hobby question:
- KY: Ойлонуп көр: Вопрос о хобби:

### g2s_bones_protect
- taskId: `g2sbdyl1t3` correct: **a**
- options: a(Y:opt_yes), b(N:opt_no)
- RU: Тали задаёт провокационный вопрос: «Без мышц человек мог бы двигаться?»
- EN: Think it through: What is a skeleton for?
- KY: Ойлонуп көр: Для чего нужен скелет?

### g2s_biggest_bone
- taskId: `g2sbdyl1t4` correct: **a**
- options: a(Y:g2s_opt_femur), b(N:g2s_opt_finger_bone), c(N:g2s_opt_rib)
- RU: Какая кость самая длинная в теле человека?
- EN: Think it through: Which bone is the longest?
- KY: Ойлонуп көр: Какая кость самая длинная?

### g2s_heart_does
- taskId: `g2sbdyl2t1` correct: **a**
- options: a(Y:g2s_opt_pumps_blood), b(N:g2s_opt_digests), c(N:g2s_opt_breathes)
- RU: Тали спрашивает: что делает сердце?
- EN: Think it through: What does the heart do?
- KY: Ойлонуп көр: Что делает сердце?

### g2s_lungs_do
- taskId: `g2sbdyl2t2` correct: **b**
- options: a(N:g2s_opt_pumps_blood), b(Y:g2s_opt_breathe_f), c(N:g2s_opt_digest_f)
- RU: Для чего нужны лёгкие?
- EN: Think it through: What are lungs for?
- KY: Ойлонуп көр: Для чего нужны лёгкие?

### g2s_stomach_does
- RU: Что делает желудок?
- EN: Think it through: What does the stomach do?
- KY: Ойлонуп көр: Что делает желудок?

### g2s_brain_controls
- RU: Что контролирует мозг?
- EN: Think it through: What controls the brain?
- KY: Ойлонуп көр: Что контролирует мозг?

### g2s_vitamins_in
- taskId: `g2sbdyl3t1` correct: **a**
- options: a(Y:g2s_opt_fruits_veg), b(N:g2s_opt_candy), c(N:g2s_opt_chips)
- RU: Тали ел только печенье. В каких продуктах больше всего витаминов, которых ему не хватает?
- EN: Think it through: Which foods have a lot of vitamins?
- KY: Ойлонуп көр: В каких продуктах много витаминов?

### g2s_protein_in
- taskId: `g2sbdyl3t2` correct: **a**
- options: a(Y:g2s_opt_meat_eggs), b(N:g2s_opt_sugar_food), c(N:g2s_opt_water_only)
- RU: Арчи хочет стать сильнее. В каких продуктах больше всего белка?
- EN: Think it through: Which foods have the most protein?
- KY: Ойлонуп көр: В каких продуктах больше всего белка?

### g2s_water_daily
- taskId: `g2sbdyl3t3` correct: **a**
- options: a(Y:opt_yes), b(N:opt_no)
- RU: Тали спрашивает: «Нужно ли пить воду каждый день?»
- EN: Think it through: How much water should I drink per day?
- KY: Ойлонуп көр: Күнүнө канча суу ичүү керек?

### g2s_sport_good
- taskId: `g2sbdyl3t4` correct: **a**
- options: a(Y:opt_yes), b(N:opt_no)
- RU: Арчи не хочет делать зарядку. Тали объясняет, почему это важно. Что он скажет?
- EN: Think it through: Why is it important to play sports?
- KY: Ойлонуп көр: Почему важно заниматься спортом?

### g3w_pollution_is_bad
- RU: Почему загрязнение воды опасно?
- EN: Think it through: Why is water pollution dangerous?
- KY: Ойлонуп көр: Почему загрязнение воды опасно?

### g3w_save_water_how
- taskId: `g3wecol1t3` correct: **a**
- options: a(Y:g3w_opt_turn_off_tap), b(N:g3w_opt_leave_tap_on), c(N:g3w_opt_bath_daily)
- RU: Если исчезнут пчёлы, что случится с растениями?
- EN: Think it through: How can you save water?
- KY: Ойлонуп көр: Сууну кантип үнөмдөөгө болот?

### g3w_nature_belongs_to
- taskId: `g3wecol1t4` correct: **a**
- options: a(Y:g3w_opt_everyone), b(N:g3w_opt_no_one), c(N:g3w_opt_adults_only)
- RU: Что из перечисленного — экосистема?
- EN: Think it through: Who owns nature?
- KY: Ойлонуп көр: Кому принадлежит природа?

### g3w_air_pollution_cause
- taskId: `g3wecol2t1` correct: **a**
- options: a(Y:g3w_opt_factories), b(N:g3w_opt_trees), c(N:g3w_opt_rain)
- RU: Трава → заяц → лиса. Как называется такая последовательность?
- EN: Think it through: What pollutes the air the most?
- KY: Ойлонуп көр: Что загрязняет воздух больше всего?

### g3w_forest_importance
- taskId: `g3wecol2t2` correct: **a**
- options: a(Y:g3w_opt_makes_oxygen), b(N:g3w_opt_pollutes_air), c(N:g3w_opt_dries_rivers)
- RU: Кто стоит в начале почти любой цепи питания?
- EN: Think it through: Why do you need them?
- KY: Ойлонуп көр: Зачем нужны леса?

### g3w_plastic_problem
- RU: Чем опасен пластик в природе?
- EN: Think it through: Why is plastic dangerous in nature?
- KY: Ойлонуп көр: Чем опасен пластик в природе?

### g3w_garbage_sort
- RU: Зачем сортировать мусор?
- EN: Think it through: Why sort garbage?
- KY: Ойлонуп көр: Зачем сортировать мусор?

### g3w_amur_tiger_endangered
- RU: Амурский тигр — редкий зверь. Что это значит?
- EN: Think it through: The Amur tiger is a rare animal. What does it mean?
- KY: Ойлонуп көр: Амур жолборсу — сейрек жандык. Бул эмнени билдирет?

### g3w_poaching_is
- taskId: `g3wecol3t2` correct: **a**
- options: a(Y:g3w_opt_illegal_hunting), b(N:g3w_opt_legal_hunting), c(N:g3w_opt_bird_watching)
- RU: Браконьер охотится незаконно. Что такое браконьерство?
- EN: Think it through: What is poaching?
- KY: Ойлонуп көр: Мыйзамсыз аң уулоо деген эмне?

### g3w_zoo_protects
- RU: Как зоопарки помогают природе?
- EN: Think it through: How do zoos help nature?
- KY: Ойлонуп көр: Зоопарктар табиятка кантип жардам берет?

### g3w_child_help_nature
- RU: Что дети могут сделать для природы?
- EN: Think it through: What can children do for nature?
- KY: Ойлонуп көр: Что дети могут сделать для природы?

### g4m_md_q1
- taskId: `g4m-md-l1-t1` correct: **b**
- options: a(N:g4m_md_q1_a), b(Y:g4m_md_q1_b), c(N:g4m_md_q1_c)
- RU: Тали читает надпись на карте: «3 475». Он запыхался и говорит: «Это три тысячи сорок семь тысяч пять!» Тали явно запутался. Как читается это число на самом деле?
- EN: Think it through: Solve: 24 × 3 =?
- KY: Ойлонуп көр: Чеч: 24 × 3 =?

### g4m_md_q2
- taskId: `g4m-md-l1-t2` correct: **a**
- options: a(Y:g4m_md_q2_a), b(N:g4m_md_q2_b), c(N:g4m_md_q2_c)
- RU: На складе у Digit лежат 12 080 апельсинов для праздника динозавров. Тали хочет написать на коробке «двенадцать тысяч восемьдесят», но не знает, как назвать это число правильно. Помоги ему: сколько здесь тысяч и сколько десятков?
- EN: Think it through: Decisions: 56 ÷ 8 =?
- KY: Ойлонуп көр: Чеч: 56 ÷ 8 =?

### g4m_md_q3
- taskId: `g4m-md-l1-t3` correct: **c**
- options: a(N:g4m_md_q3_a), b(N:g4m_md_q3_b), c(Y:g4m_md_q3_c)
- RU: Тали разглядывает библиотеку Digit: «7 304 книги! Интересно, цифра 3 — это три тысячи?» Тали снова ошибается. В каком разряде стоит цифра 3 в числе 7 304?
- EN: Think it through: Decide: 15 × 6 =?
- KY: Ойлонуп көр: Чеч: 15 × 6 =?

### g4m_md_q4
- taskId: `g4m-md-l1-t4` correct: **b**
- options: a(N:g4m_md_q4_a), b(Y:g4m_md_q4_b), c(N:g4m_md_q4_c)
- RU: Экспедиция Тали прошла 25 600 шагов за неделю. Исследователь записал это число в дневник. Как правильно его прочитать?
- EN: Think it through: Solve: 84 ÷ 4 =?
- KY: Ойлонуп көр: Чеч: 84 ÷ 4 =?

### g4m_md2_q1
- taskId: `g4m-md-l2-t1` correct: **b**
- options: a(N:g4m_md2_q1_a), b(Y:g4m_md2_q1_b), c(N:g4m_md2_q1_c)
- RU: Тали набирает код сейфа: число 6 253. Он говорит: «Цифра 2 здесь — это 2 тысячи!» Сейф не открывается. Что цифра 2 значит на самом деле в числе 6 253?
- EN: Think it through: Solve: 34 × 5 =?
- KY: Ойлонуп көр: Чеч: 34 × 5 =?

### g4m_md2_q2
- taskId: `g4m-md-l2-t2` correct: **a**
- options: a(Y:g4m_md2_q2_a), b(N:g4m_md2_q2_b), c(N:g4m_md2_q2_c)
- RU: Digit разложил число 9 070 на разрядные слагаемые для Тали. Какое представление верное?
- EN: Think it through: Solve: 72 ÷ 9 =?
- KY: Ойлонуп көр: Чеч: 72 ÷ 9 =?

### g4m_md2_q3
- taskId: `g4m-md-l2-t3` correct: **c**
- options: a(N:g4m_md2_q3_a), b(N:g4m_md2_q3_b), c(Y:g4m_md2_q3_c)
- RU: В числе 4 816 Тали ищет цифру 8. «Она в разряде тысяч — самая важная!» — решил он. Исправь Тали: в каком разряде стоит 8?
- EN: Think it through: Decisions: 47 × 3 =?
- KY: Ойлонуп көр: Чеч: 47 × 3 =?

### g4m_md2_q4
- taskId: `g4m-md-l2-t4` correct: **b**
- options: a(N:g4m_md2_q4_a), b(Y:g4m_md2_q4_b), c(N:g4m_md2_q4_c)
- RU: Шифровальщик Тали закодировал число: «5 тысяч, 0 сотен, 3 десятка, 9 единиц». Теперь нужно его расшифровать. Что это за число?
- EN: Think it through: Decisions: 96 ÷ 6 =?
- KY: Ойлонуп көр: Чеч: 96 ÷ 6 =?

### g4m_md3_q1
- taskId: `g4m-md-l3-t1` correct: **b**
- options: a(N:g4m_md3_q1_a), b(Y:g4m_md3_q1_b), c(N:g4m_md3_q1_c)
- RU: Тали смотрит на два клада: 8 450 и 8 540 монет. Он говорит: «Они одинаковые — там и там восьмёрка в начале!» Тали торопится и не досматривает. Какой клад на самом деле больше?
- EN: Think it through: Solve: 23 × 7 =?
- KY: Ойлонуп көр: Чеч: 23 × 7 =?

### g4m_md3_q2
- taskId: `g4m-md-l3-t2` correct: **a**
- options: a(Y:g4m_md3_q2_a), b(N:g4m_md3_q2_b), c(N:g4m_md3_q2_c)
- RU: Digit просит расставить числа по порядку — от наименьшего к наибольшему: 3 099, 3 900 и 3 009. Тали пытается, но запутался в нулях. Помоги ему!
- EN: Think it through: Decisions: 120 ÷ 8 =?
- KY: Ойлонуп көр: Чеч: 120 ÷ 8 =?

### g4m_md3_q3
- taskId: `g4m-md-l3-t3` correct: **c**
- options: a(N:g4m_md3_q3_a), b(N:g4m_md3_q3_b), c(Y:g4m_md3_q3_c)
- RU: Тали написал в дневнике: «5 008 > 5 080 — это правда, ведь у первого числа восьмёрка стоит в начале!» Верно ли его рассуждение?
- EN: Think it through: Decisions: 45 × 4 =?
- KY: Ойлонуп көр: Чеч: 45 × 4 =?

### g4m_md3_q4
- taskId: `g4m-md-l3-t4` correct: **b**
- options: a(N:g4m_md3_q4_a), b(Y:g4m_md3_q4_b), c(N:g4m_md3_q4_c)
- RU: Два поезда соревнуются в длине маршрута: первый проехал 12 375 км, второй — 12 735 км. Тали болеет за второй. Прав ли он — второй действительно проехал больше?
- EN: Think it through: Solve: 108 ÷ 9 =?
- KY: Ойлонуп көр: Чеч: 108 ÷ 9 =?

### g4m_cm_q1
- taskId: `g4m-cm-l1-t1` correct: **b**
- options: a(N:g4m_cm_q1_a), b(Y:g4m_cm_q1_b), c(N:g4m_cm_q1_c)
- RU: Пекарня Тали работает три дня подряд: каждый день — 213 булочек. Тали считает в уме: «Это примерно шестьсот... или семьсот?» Помоги ему: 213 × 3 = ?
- EN: Think it through: Decide: 25 × 4 =?
- KY: Ойлонуп көр: Чеч: 25 × 4 =?

### g4m_cm_q2
- taskId: `g4m-cm-l1-t2` correct: **a**
- options: a(Y:g4m_cm_q2_a), b(N:g4m_cm_q2_b), c(N:g4m_cm_q2_c)
- RU: В каждой упаковке Digit упаковал 124 карандаша. Тали заказал 4 упаковки для школы динозавров. Сколько карандашей приедет? 124 × 4 = ?
- EN: Think it through: Solve: 144 ÷ 12 =?
- KY: Ойлонуп көр: Чеч: 144 ÷ 12 =?

### g4m_cm_q3
- taskId: `g4m-cm-l1-t3` correct: **c**
- options: a(N:g4m_cm_q3_a), b(N:g4m_cm_q3_b), c(Y:g4m_cm_q3_c)
- RU: Тали считает звёзды в телескоп: каждую ночь видит 312 звёзд. За три ночи он записал в дневник «916». Но Digit говорит, что Тали ошибся. Найди правильный ответ: 312 × 3 = ?
- EN: Think it through: Solve: 36 × 5 =?
- KY: Ойлонуп көр: Чеч: 36 × 5 =?

### g4m_cm_q4
- taskId: `g4m-cm-l1-t4` correct: **b**
- options: a(N:g4m_cm_q4_a), b(Y:g4m_cm_q4_b), c(N:g4m_cm_q4_c)
- RU: Посмотри на пример в столбик: 221 × 4. Тали уже написал ответ «864». Верен ли он?
- EN: Think it through: Decisions: 150 ÷ 6 =?
- KY: Ойлонуп көр: Чеч: 150 ÷ 6 =?

### g4m_cm2_q1
- taskId: `g4m-cm-l2-t1` correct: **a**
- options: a(Y:g4m_cm2_q1_a), b(N:g4m_cm2_q1_b), c(N:g4m_cm2_q1_c)
- RU: Тали заказывает кирпичи: 1 346 в день × 5 дней. Он прикинул «примерно пять тысяч», но поставщик говорит цифру другую. Помоги Тали: 1 346 × 5 = ?
- EN: Think it through: Decisions: 48 × 3 =?
- KY: Ойлонуп көр: Чеч: 48 × 3 =?

### g4m_cm2_q2
- taskId: `g4m-cm-l2-t2` correct: **b**
- options: a(N:g4m_cm2_q2_a), b(Y:g4m_cm2_q2_b), c(N:g4m_cm2_q2_c)
- RU: Фермер Тали собрал 2 417 яблок с одного сада. У него три таких же сада. Сколько яблок всего? 2 417 × 3 = ?
- EN: Think it through: Decisions: 180 ÷ 9 =?
- KY: Ойлонуп көр: Чеч: 180 ÷ 9 =?

### g4m_cm2_q3
- taskId: `g4m-cm-l2-t3` correct: **c**
- options: a(N:g4m_cm2_q3_a), b(N:g4m_cm2_q3_b), c(Y:g4m_cm2_q3_c)
- RU: В космическом корабле Тали 3 208 болтов. Для экспедиции нужно ещё 6 таких же кораблей. Болтов нужно: 3 208 × 6 = ?
- EN: Think it through: Decide: 27 × 6 =?
- KY: Ойлонуп көр: Чеч: 27 × 6 =?

### g4m_cm2_q4
- taskId: `g4m-cm-l2-t4` correct: **a**
- options: a(Y:g4m_cm2_q4_a), b(N:g4m_cm2_q4_b), c(N:g4m_cm2_q4_c)
- RU: Digit даёт Тали задачку на прикидку: 4 135 × 7. Какой знак нужно поставить: 4 135 × 7 ○ 29 000?
- EN: Think it through: Solve: 196 ÷ 7 =?
- KY: Ойлонуп көр: Чеч: 196 ÷ 7 =?

### g4m_cm3_q1
- taskId: `g4m-cm-l3-t1` correct: **a**
- options: a(Y:g4m_cm3_q1_a), b(N:g4m_cm3_q1_b), c(N:g4m_cm3_q1_c)
- RU: Тали открыл завод: 236 деталей в час × 12 часов. Он подсчитал «2 732». Digit говорит, что в одном из промежуточных умножений Тали ошибся. Найди правильный ответ: 236 × 12 = ?
- EN: Think it through: Decide: 19 × 8 =?
- KY: Ойлонуп көр: Чеч: 19 × 8 =?

### g4m_cm3_q2
- taskId: `g4m-cm-l3-t2` correct: **b**
- options: a(N:g4m_cm3_q2_a), b(Y:g4m_cm3_q2_b), c(N:g4m_cm3_q2_c)
- RU: В кинотеатре динозавров 345 мест. Всего прошёл 24 сеанса, и каждый раз — полный зал. Сколько всего зрителей посмотрели фильм? 345 × 24 = ?
- EN: Think it through: Solve: 210 ÷ 7 =?
- KY: Ойлонуп көр: Чеч: 210 ÷ 7 =?

### g4m_cm3_q3
- taskId: `g4m-cm-l3-t3` correct: **c**
- options: a(N:g4m_cm3_q3_a), b(N:g4m_cm3_q3_b), c(Y:g4m_cm3_q3_c)
- RU: Корабль Тали проплывает 418 км в сутки. За 13 суток экспедиции он преодолеет... 418 × 13 = ?
- EN: Think it through: Solve: 54 × 4 =?
- KY: Ойлонуп көр: Чеч: 54 × 4 =?

### g4m_cm3_q4
- taskId: `g4m-cm-l3-t4` correct: **b**
- options: a(N:g4m_cm3_q4_a), b(Y:g4m_cm3_q4_b), c(N:g4m_cm3_q4_c)
- RU: Тали хочет понять: сколько промежуточных произведений получится в столбике при умножении 527 × 15?
- EN: Think it through: Solve: 228 ÷ 4 =?
- KY: Ойлонуп көр: Чеч: 228 ÷ 4 =?

### g4m_fr_q1
- taskId: `g4m-fr-l1-t1` correct: **a**
- options: a(Y:g4m_fr_q1_a), b(N:g4m_fr_q1_b), c(N:g4m_fr_q1_c)
- RU: Тали разрезал пиццу ровно на 4 части и съел одну. Какую дробь пиццы он съел?
- EN: Think it through: Which fraction is greater, 1/2 or 1/3?
- KY: Ойлонуп көр: Кайсы бөлчөк чоңураак: 1/2 же 1/3?

### g4m_fr_q2
- taskId: `g4m-fr-l1-t2` correct: **b**
- options: a(N:g4m_fr_q2_a), b(Y:g4m_fr_q2_b), c(N:g4m_fr_q2_c)
- RU: Digit закрасил 3 части из 8 на полоске бумаги и написал дробь «8/3». Тали смотрит и говорит: «Что-то здесь не так!» Тали прав — запись неверная. Как правильно записать закрашенную часть?
- EN: Think it through: What is 1/4 + 1/4?
- KY: Ойлонуп көр: 1/4 + 1/4 канча болот?

### g4m_fr_q3
- taskId: `g4m-fr-l1-t3` correct: **c**
- options: a(N:g4m_fr_q3_a), b(N:g4m_fr_q3_b), c(Y:g4m_fr_q3_c)
- RU: Тали объясняет Digit, что такое знаменатель: «Это сколько частей мы взяли!» Но Тали снова ошибся — перепутал числитель и знаменатель. Что на самом деле показывает знаменатель (нижнее число)?
- EN: Think it through: Write three-fourths as a fraction.
- KY: Ойлонуп көр: Үч төртүнчүнү бөлчөк катары жаз.

### g4m_fr_q4
- taskId: `g4m-fr-l1-t4` correct: **b**
- options: a(N:g4m_fr_q4_a), b(Y:g4m_fr_q4_b), c(N:g4m_fr_q4_c)
- RU: Тали взял 1 дольку из шоколадки, разломленной на 6 равных долей. Верно ли, что он взял 1/6 шоколадки?
- EN: Think it through: Decisions: 3/5 − 1/5 =?
- KY: Ойлонуп көр: Чеч: 3/5 − 1/5 =?

### g4m_fr2_q1
- taskId: `g4m-fr-l2-t1` correct: **b**
- options: a(N:g4m_fr2_q1_a), b(Y:g4m_fr2_q1_b), c(N:g4m_fr2_q1_c)
- RU: Тали разрезал яблоко на 4 части и записал: «Одна часть — это 4/1». Digit смотрит на запись с удивлением. Как правильно записать одну часть из четырёх?
- EN: Think it through: Which fraction is smaller: 2/5 or 3/5?
- KY: Ойлонуп көр: Кайсы бөлчөк кичирээк: 2/5 же 3/5?

### g4m_fr2_q2
- taskId: `g4m-fr-l2-t2` correct: **a**
- options: a(Y:g4m_fr2_q2_a), b(N:g4m_fr2_q2_b), c(N:g4m_fr2_q2_c)
- RU: Digit закрасил 3 клетки из 9 в прямоугольнике. Какая дробь показывает закрашенную часть?
- EN: Think it through: What is 2/6 + 1/6?
- KY: Ойлонуп көр: 2/6 + 1/6 канча болот?

### g4m_fr2_q3
- taskId: `g4m-fr-l2-t3` correct: **c**
- options: a(N:g4m_fr2_q3_a), b(N:g4m_fr2_q3_b), c(Y:g4m_fr2_q3_c)
- RU: Тали разрезал торт пополам (1/2), а Digit разрезал такой же торт на четыре части и взял две (2/4). Кто получил больше торта?
- EN: Think it through: Write down one eighth.
- KY: Ойлонуп көр: Бир сегизинчини жаз.

### g4m_fr2_q4
- taskId: `g4m-fr-l2-t4` correct: **b**
- options: a(N:g4m_fr2_q4_a), b(Y:g4m_fr2_q4_b), c(N:g4m_fr2_q4_c)
- RU: Круг поделён на 5 равных секторов. Сколько таких секторов нужно, чтобы собрать целый круг?
- EN: Think it through: Decisions: 5/7 − 2/7 =?
- KY: Ойлонуп көр: Чеч: 5/7 − 2/7 =?

### g4m_fr3_q1
- taskId: `g4m-fr-l3-t1` correct: **a**
- options: a(Y:g4m_fr3_q1_a), b(N:g4m_fr3_q1_b), c(N:g4m_fr3_q1_c)
- RU: Тали взял 3/8 пиццы, его друг — 5/8 той же пиццы. Тали спорит: «Мы взяли одинаково — ведь восьмёрки одинаковые!» Кто на самом деле взял больше?
- EN: Think it through: Which fraction is greater, 3/8 or 5/8?
- KY: Ойлонуп көр: Кайсы бөлчөк чоңураак: 3/8 же 5/8?

### g4m_fr3_q2
- taskId: `g4m-fr-l3-t2` correct: **b**
- options: a(N:g4m_fr3_q2_a), b(Y:g4m_fr3_q2_b), c(N:g4m_fr3_q2_c)
- RU: Digit записал: 2/5 ○ 4/5. Какой знак нужно поставить?
- EN: Think it through: What is 1/3 + 1/3 + 1/3?
- KY: Ойлонуп көр: 1/3 + 1/3 + 1/3 канча болот?

### g4m_fr3_q3
- taskId: `g4m-fr-l3-t3` correct: **c**
- options: a(N:g4m_fr3_q3_a), b(N:g4m_fr3_q3_b), c(Y:g4m_fr3_q3_c)
- RU: Тали пытается расставить три дроби по порядку от наименьшей: 1/4, 3/4, 2/4. Он написал: «3/4, 2/4, 1/4» — от наибольшей. Исправь порядок: от наименьшей к наибольшей.
- EN: Think it through: Decisions: 7/9 − 4/9 =?
- KY: Ойлонуп көр: Чеч: 7/9 − 4/9 =?

### g4m_fr3_q4
- taskId: `g4m-fr-l3-t4` correct: **b**
- options: a(N:g4m_fr3_q4_a), b(Y:g4m_fr3_q4_b), c(N:g4m_fr3_q4_c)
- RU: Тали и Digit сравнивают 3/4 и 3/7. Числители одинаковые — 3 и 3. Тали говорит: «Значит дроби равные!» Но Digit не соглашается. Кто прав?
- EN: Think it through: What fraction is 1/2?
- KY: Ойлонуп көр: Кайсы бөлчөк 1/2 ге барабар?

### g4r_conj_q1
- taskId: `g4r-conj-l1-t1` correct: **b**
- options: a(N:g4r_conj_q1_a), b(Y:g4r_conj_q1_b), c(N:g4r_conj_q1_c)
- RU: Тали написал: «Я хожу в школу каждый день.» Слово проверяет: правильно ли выбрана форма глагола?
- EN: Think and choose: Choose an alliance: It rained, ___ we stayed at home.
- KY: Ойлонуп, танда: Жалгооч тандо: Пошёл дождь, ___ мы остались дома.

### g4r_conj_q2
- taskId: `g4r-conj-l1-t2` correct: **a**
- options: a(Y:g4r_conj_q2_a), b(N:g4r_conj_q2_b), c(N:g4r_conj_q2_c)
- RU: Слово спрашивает Тали: как будет глагол «читать» для «ты»? Тали думает... Помоги ему!
- EN: Think and choose: Choose an alliance: I was tired, ___ continued to walk.
- KY: Ойлонуп, танда: Жалгооч тандо: Я устал, ___ продолжал идти.

### g4r_conj_q3
- taskId: `g4r-conj-l1-t3` correct: **c**
- options: a(N:g4r_conj_q3_a), b(N:g4r_conj_q3_b), c(Y:g4r_conj_q3_c)
- RU: Тали читает вслух: «Мальчик идёт по улице». Слово хочет знать — в каком лице стоит глагол «идёт»? Тали говорит: «Во втором!» Прав ли Тали?
- EN: Think and choose: Choose an alliance: He took an umbrella, ___ it was raining.
- KY: Ойлонуп, танда: Жалгооч тандо: Он взял зонт, ___ шёл дождь.

### g4r_conj_q4
- taskId: `g4r-conj-l1-t4` correct: **b**
- options: a(N:g4r_conj_q4_a), b(Y:g4r_conj_q4_b), c(N:g4r_conj_q4_c)
- RU: Детектив-грамматик нашёл ошибку: «Она пишет письмо и отправляю его.» Что неверно в этом предложении?
- EN: Think and choose: Choose an alliance: Read carefully, ___ you will understand everything.
- KY: Ойлонуп, танда: Жалгооч тандо: Читай внимательно, ___ всё поймёшь.

### g4r_conj2_q1
- taskId: `g4r-conj-l2-t1` correct: **a**
- options: a(Y:g4r_conj2_q1_a), b(N:g4r_conj2_q1_b), c(N:g4r_conj2_q1_c)
- RU: Тали написал в пьесе: «Мы петь вместе на сцене!» Слово говорит, что это не спряжённый глагол. Как правильно?
- EN: Think and choose: Choose an alliance: I'm cold, ___ I'll put on a jacket.
- KY: Ойлонуп, танда: Жалгооч тандо: Мага суук, ___ мен курткамды кийем.

### g4r_conj2_q2
- taskId: `g4r-conj-l2-t2` correct: **b**
- options: a(N:g4r_conj2_q2_a), b(Y:g4r_conj2_q2_b), c(N:g4r_conj2_q2_c)
- RU: Тали меняет реплику в пьесе: «Он читает книгу» → «Они ___ книгу». Что изменится в глаголе?
- EN: Think and choose: Choose an alliance: ___ you will come, we will start.
- KY: Ойлонуп, танда: Жалгооч тандо: ___ ты придёшь, мы начнём.

### g4r_conj2_q3
- taskId: `g4r-conj-l2-t3` correct: **c**
- options: a(N:g4r_conj2_q3_a), b(N:g4r_conj2_q3_b), c(Y:g4r_conj2_q3_c)
- RU: Слово задаёт Тали вопрос для пьесы: «Вы ___ правильный ответ?» (глагол «знать»). Тали написал «знаешь». Правильно ли?
- EN: Think and choose: Choose an alliance: Mom sang, ___ dad played.
- KY: Ойлонуп, танда: Жалгооч тандо: Мама пела, ___ папа играл.

### g4r_conj2_q4
- taskId: `g4r-conj-l2-t4` correct: **b**
- options: a(N:g4r_conj2_q4_a), b(Y:g4r_conj2_q4_b), c(N:g4r_conj2_q4_c)
- RU: В пьесе Тали отряд рыцарей-динозавров отправился в поход. «Они ___ через лес». Вставь глагол «идти» в правильной форме.
- EN: Think and choose: Choose an alliance: Study well, ___ get a five.
- KY: Ойлонуп, танда: Жалгооч тандо: Учись хорошо, ___ получишь пятёрку.

### g4r_conj3_q1
- taskId: `g4r-conj-l3-t1` correct: **b**
- options: a(N:g4r_conj3_q1_a), b(Y:g4r_conj3_q1_b), c(N:g4r_conj3_q1_c)
- RU: К какому спряжению относится глагол «любить»?
- EN: Think it through: Which alliance is oppositional?
- KY: Ойлонуп көр: Кайсы жалгооч карама-каршылык билдирет?

### g4r_conj3_q2
- taskId: `g4r-conj-l3-t2` correct: **a**
- options: a(Y:g4r_conj3_q2_a), b(N:g4r_conj3_q2_b), c(N:g4r_conj3_q2_c)
- RU: Слово предлагает Тали найти глагол II спряжения: писать, говорить, читать, рисовать. Тали смотрит в список... Что выберешь ты?
- EN: Think it through: Which union is connecting?
- KY: Ойлонуп көр: Кайсы жалгооч байланыштыруучу?

### g4r_conj3_q3
- taskId: `g4r-conj-l3-t3` correct: **c**
- options: a(N:g4r_conj3_q3_a), b(N:g4r_conj3_q3_b), c(Y:g4r_conj3_q3_c)
- RU: Тали написал последнюю реплику пьесы: «Мы бежит к финишу!» Слово говорит, что форма глагола неверная. Исправь за Тали!
- EN: Think and choose: Choose a separation alliance.
- KY: Ойлонуп, танда: Ажыратуучу жалгоочту тандо.

### g4r_conj3_q4
- taskId: `g4r-conj-l3-t4` correct: **b**
- options: a(N:g4r_conj3_q4_a), b(Y:g4r_conj3_q4_b), c(N:g4r_conj3_q4_c)
- RU: По какому признаку определяют спряжение глагола в неопределённой форме?
- EN: Think it through: Find a sentence with a causal union.
- KY: Ойлонуп көр: Себеп жалгоочу бар сүйлөмдү тап.

### g4r_cases_q1
- taskId: `g4r-cases-l1-t1` correct: **a**
- options: a(Y:g4r_cases_q1_a), b(N:g4r_cases_q1_b), c(N:g4r_cases_q1_c)
- RU: В предложении «Кот лежит на коврике» — слово «кот» стоит в каком падеже?
- EN: Think it through: In what case is the word "home" (I stayed at home)?
- KY: Ойлонуп көр: «дома» сөзү (Я остался дома) кайсы жөндөмөдө?

### g4r_cases_q2
- taskId: `g4r-cases-l1-t2` correct: **a**
- options: a(Y:g4r_cases_q2_a), b(N:g4r_cases_q2_b), c(N:g4r_cases_q2_c)
- RU: Слово просит найти подлежащее в предложении «Книга лежит на столе». Тали отвечает: «Подлежащее — "столе"!» Верно ли?
- EN: Think it through: The word "friend" is what case?
- KY: Ойлонуп көр: «другу» сөзү — кайсы жөндөмө?

### g4r_cases_q3
- taskId: `g4r-cases-l1-t3` correct: **c**
- options: a(N:g4r_cases_q3_a), b(N:g4r_cases_q3_b), c(Y:g4r_cases_q3_c)
- RU: Тали составляет предложение: «Я вижу книга.» Слово говорит, что падеж неверный. Какую форму нужно использовать?
- EN: Think it through: Find the word in the accusatory case.
- KY: Ойлонуп көр: Табыш жөндөмөсүндөгү сөздү тап.

### g4r_cases_q4
- taskId: `g4r-cases-l1-t4` correct: **b**
- options: a(N:g4r_cases_q4_a), b(Y:g4r_cases_q4_b), c(N:g4r_cases_q4_c)
- RU: Чем именительный падеж отличается от винительного? Выбери верное объяснение.
- EN: Think it through: "I see a book" — the word "book" in which case?
- KY: Ойлонуп көр: «Вижу книгу» — «книгу» сөзү кайсы жөндөмөдө?

### g4r_cases2_q1
- taskId: `g4r-cases-l2-t1` correct: **b**
- options: a(N:g4r_cases2_q1_a), b(Y:g4r_cases2_q1_b), c(N:g4r_cases2_q1_c)
- RU: На какой вопрос отвечает слово в родительном падеже?
- EN: Think it through: The word "table" — what is the case?
- KY: Ойлонуп көр: «стола» сөзү — кайсы жөндөмө?

### g4r_cases2_q2
- taskId: `g4r-cases-l2-t2` correct: **a**
- options: a(Y:g4r_cases2_q2_a), b(N:g4r_cases2_q2_b), c(N:g4r_cases2_q2_c)
- RU: Тали написал письмо: «Я дал корм собака.» Слово говорит, что падеж неверный. «Дал кому?» — значит нужен...
- EN: Think it through: Questions about the dative case?
- KY: Ойлонуп көр: Берүү жөндөмөсүнүн суроолору?

### g4r_cases2_q3
- taskId: `g4r-cases-l2-t3` correct: **b**
- options: a(N:g4r_cases2_q3_a), b(Y:g4r_cases2_q3_b), c(N:g4r_cases2_q3_c)
- RU: Тали не дождался друга и написал: «Подожди — не хватает ___ (друг).» Какой падеж нужен?
- EN: Think it through: The word "forest" — what is the case?
- KY: Ойлонуп көр: «лесом» сөзү — кайсы жөндөмө?

### g4r_cases2_q4
- taskId: `g4r-cases-l2-t4` correct: **a**
- options: a(Y:g4r_cases2_q4_a), b(N:g4r_cases2_q4_b), c(N:g4r_cases2_q4_c)
- RU: Почтальон-динозавр разносит письма: «Отправить письмо ___ (мама).» Поставь слово в правильный падеж.
- EN: Think it through: Find the word in the propositional case.
- KY: Ойлонуп көр: Жатыш жөндөмөсүндөгү сөздү тап.

### g4r_cases3_q1
- taskId: `g4r-cases-l3-t1` correct: **a**
- options: a(Y:g4r_cases3_q1_a), b(N:g4r_cases3_q1_b), c(N:g4r_cases3_q1_c)
- RU: Тали написал: «Мы говорили о лес.» Слово смотрит и говорит: «Тали, здесь нужен предложный падеж — он всегда с предлогом!» Как правильно?
- EN: Think it through: The word "mother" — what is the case?
- KY: Ойлонуп көр: «маме» сөзү — кайсы жөндөмө?

### g4r_cases3_q2
- taskId: `g4r-cases-l3-t2` correct: **b**
- options: a(N:g4r_cases3_q2_a), b(Y:g4r_cases3_q2_b), c(N:g4r_cases3_q2_c)
- RU: Тали рисует автопортрет и пишет подпись: «Я стал ___ (художник)». Какой падеж нужен после «стал»?
- EN: Think it through: How many cases are there in Russian?
- KY: Ойлонуп көр: Орус тилинде канча жөндөмө бар?

### g4r_cases3_q3
- taskId: `g4r-cases-l3-t3` correct: **b**
- options: a(N:g4r_cases3_q3_a), b(Y:g4r_cases3_q3_b), c(N:g4r_cases3_q3_c)
- RU: Слово задаёт Тали вопрос: «Какой падеж никогда не употребляется без предлога?» Тали думает и говорит: «Дательный!» Прав ли Тали?
- EN: Think it through: Find the word in the genitive case.
- KY: Ойлонуп көр: Илик жөндөмөсүндөгү сөздү тап.

### g4r_cases3_q4
- taskId: `g4r-cases-l3-t4` correct: **c**
- options: a(N:g4r_cases3_q4_a), b(N:g4r_cases3_q4_b), c(Y:g4r_cases3_q4_c)
- RU: Назови все 6 падежей русского языка по порядку. Какой стоит на пятом месте?
- EN: Think it through: "On the mountain" — the word "mountain" in which case?
- KY: Ойлонуп көр: «На горе» — «горе» сөзү кайсы жөндөмөдө?

### g4r_text_q1
- taskId: `g4r-text-l1-t1` correct: **a**
- options: a(Y:g4r_text_q1_a), b(N:g4r_text_q1_b), c(N:g4r_text_q1_c)
- RU: Тали читает: «Солнце зашло. Стало темно. Птицы умолкли.» Он говорит: «Этот текст о птицах!» Но Слово не соглашается. О чём на самом деле этот текст?
- EN: Think it through: What is the subject of the text?
- KY: Ойлонуп көр: Тексттин темасы деген эмне?

### g4r_text_q2
- taskId: `g4r-text-l1-t2` correct: **b**
- options: a(N:g4r_text_q2_a), b(Y:g4r_text_q2_b), c(N:g4r_text_q2_c)
- RU: Как называется последняя часть текста из трёх частей?
- EN: Think it through: What does the text consist of?
- KY: Ойлонуп көр: Из чего состоит текст?

### g4r_text_q3
- taskId: `g4r-text-l1-t3` correct: **c**
- options: a(N:g4r_text_q3_a), b(N:g4r_text_q3_b), c(Y:g4r_text_q3_c)
- RU: Тали читает: «Дождь шёл всю ночь, поэтому утром лужи блестели.» Какая связь между частями предложения?
- EN: Think it through: What is the name of the beginning of the
- KY: Ойлонуп көр: Тексттин башталышы кантип аталат?

### g4r_text_q4
- taskId: `g4r-text-l1-t4` correct: **b**
- options: a(N:g4r_text_q4_a), b(Y:g4r_text_q4_b), c(N:g4r_text_q4_c)
- RU: Тали пишет рассказ о котёнке. Называет первую часть «оглавление». Слово говорит, что название неверное. Как правильно называется первая часть рассказа?
- EN: Think it through: What is a paragraph?
- KY: Ойлонуп көр: Абзац деген эмне?

### g4r_text2_q1
- taskId: `g4r-text-l2-t1` correct: **a**
- options: a(Y:g4r_text2_q1_a), b(N:g4r_text2_q1_b), c(N:g4r_text2_q1_c)
- RU: Текст: «Ёж свернулся в клубок. Иголки торчат во все стороны. Никто не тронет ежа.» Главная мысль — это...
- EN: Think it through: "Autumn is beautiful" text type.
- KY: Ойлонуп көр: Тип текста «Осень красива».

### g4r_text2_q2
- taskId: `g4r-text-l2-t2` correct: **b**
- options: a(N:g4r_text2_q2_a), b(Y:g4r_text2_q2_b), c(N:g4r_text2_q2_c)
- RU: Как называется предложение, которое выражает главную мысль всего текста?
- EN: Think it through: What is a headline?
- KY: Ойлонуп көр: Аталыш деген эмне?

### g4r_text2_q3
- taskId: `g4r-text-l2-t3` correct: **a**
- options: a(Y:g4r_text2_q3_a), b(N:g4r_text2_q3_b), c(N:g4r_text2_q3_c)
- RU: Тали перемешал предложения своего рассказа о дожде. Какое должно быть первым, чтобы текст был связным?
- EN: Think it through: How to check the statement?
- KY: Ойлонуп көр: Баяндаманы кантип текшерүү керек?

### g4r_text2_q4
- taskId: `g4r-text-l2-t4` correct: **b**
- options: a(N:g4r_text2_q4_a), b(Y:g4r_text2_q4_b), c(N:g4r_text2_q4_c)
- RU: Слово спрашивает Тали: «Где чаще всего прячется главная мысль рассказа?» Тали говорит: «Только в середине!» Верно ли?
- EN: Think it through: Reasoning text starts with...
- KY: Ойлонуп көр: Текст-рассуждение начинается с...

### g4r_text3_q1
- taskId: `g4r-text-l3-t1` correct: **c**
- options: a(N:g4r_text3_q1_a), b(N:g4r_text3_q1_b), c(Y:g4r_text3_q1_c)
- RU: Тали прочитал: «Сначала Маша нашла гриб. Потом позвала сестру. Наконец они набрали полную корзину.» Он думает, что первым было «позвала сестру». Исправь Тали — что было самым первым?
- EN: Think it through: In the description, the main thing is...
- KY: Ойлонуп көр: В описании главное — это...

### g4r_text3_q2
- taskId: `g4r-text-l3-t2` correct: **b**
- options: a(N:g4r_text3_q2_a), b(Y:g4r_text3_q2_b), c(N:g4r_text3_q2_c)
- RU: Слово просит найти слово-«маяк», которое указывает на последнее событие в цепочке. Какое это слово?
- EN: Think it through: What connects sentences in the text?
- KY: Ойлонуп көр: Что связывает предложения в тексте?

### g4r_text3_q3
- taskId: `g4r-text-l3-t3` correct: **c**
- options: a(N:g4r_text3_q3_a), b(N:g4r_text3_q3_b), c(Y:g4r_text3_q3_c)
- RU: Тали описывает любимый камень: «Он гладкий, серый, тёплый на ощупь и пахнет дождём.» Какой это тип текста?
- EN: Think it through: What is the name of the end of the
- KY: Ойлонуп көр: Тексттин аягы кантип аталат?

### g4r_text3_q4
- taskId: `g4r-text-l3-t4` correct: **b**
- options: a(N:g4r_text3_q4_a), b(Y:g4r_text3_q4_b), c(N:g4r_text3_q4_c)
- RU: Тали пишет инструкцию для друга: «Потом налей воду. Сначала возьми стакан. Наконец размешай.» Слово говорит, что шаги перепутаны. Какое слово подскажет, что шаг НЕ первый?
- EN: Think it through: Type: "First... Then... Finally..."
- KY: Ойлонуп көр: Тип: «Сначала... Потом... Наконец...»

### g4e_pres_q1
- taskId: `g4e-pres-l1-t1` correct: **b**
- options: a(N:g4e_pres_q1_a), b(Y:g4e_pres_q1_b), c(N:g4e_pres_q1_c)
- RU: Тали написал: «She go to school every day.» Spark говорит, что ошибка в глаголе. Как правильно?
- EN: Think it through: Choose: She ___ to school every day.
- KY: Ойлонуп көр: Choose: She ___ to school every day.

### g4e_pres_q2
- taskId: `g4e-pres-l1-t2` correct: **b**
- options: a(N:g4e_pres_q2_a), b(Y:g4e_pres_q2_b), c(N:g4e_pres_q2_c)
- RU: Каждое утро робот Тали просыпается и выполняет задачи. «Every morning, the robot wakes up and ___ its tasks.» (do / does / doing)
- EN: Think it through: Choose: They ___ football on Sundays.
- KY: Ойлонуп көр: Choose: They ___ football on Sundays.

### g4e_pres_q3
- taskId: `g4e-pres-l1-t3` correct: **b**
- options: a(N:g4e_pres_q3_a), b(Y:g4e_pres_q3_b), c(N:g4e_pres_q3_c)
- RU: «My little brother ___ pizza more than anything!» (love / loves / is loves)
- EN: Think it through: Choose: He ___ his homework now.
- KY: Ойлонуп көр: Choose: He ___ his homework now.

### g4e_pres_q4
- taskId: `g4e-pres-l1-t4` correct: **a**
- options: a(Y:g4e_pres_q4_a), b(N:g4e_pres_q4_b), c(N:g4e_pres_q4_c)
- RU: Тали смотрит на список: I, he, she, it. «Все они добавляют -s к глаголу!» — говорит он. Spark качает головой. Кто из этого списка НЕ добавляет -s?
- EN: Think it through: Choose: My cat ___ milk every morning.
- KY: Ойлонуп көр: Choose: My cat ___ milk every morning.

### g4e_pres2_q1
- taskId: `g4e-pres-l2-t1` correct: **b**
- options: a(N:g4e_pres2_q1_a), b(Y:g4e_pres2_q1_b), c(N:g4e_pres2_q1_c)
- RU: Тали написал: «The cat not eats fish — only milk!» Spark говорит, что нужно doesn't. Исправь Тали!
- EN: Think it through: Choose: The dog ___ in the garden.
- KY: Ойлонуп көр: Choose: The dog ___ in the garden.

### g4e_pres2_q2
- taskId: `g4e-pres-l2-t2` correct: **a**
- options: a(Y:g4e_pres2_q2_a), b(N:g4e_pres2_q2_b), c(N:g4e_pres2_q2_c)
- RU: «He plays football.» → «He ___ football.» Какая отрицательная форма верна?
- EN: Think it through: Choose: We ___ English at school.
- KY: Ойлонуп көр: Choose: We ___ English at school.

### g4e_pres2_q3
- taskId: `g4e-pres-l2-t3` correct: **c**
- options: a(N:g4e_pres2_q3_a), b(N:g4e_pres2_q3_b), c(Y:g4e_pres2_q3_c)
- RU: Тали написал отрицание: «She don't like cold weather.» Spark говорит: «Тали, ошибка! С she нужно...»
- EN: Think it through: Choose: My brother ___ music every evening.
- KY: Ойлонуп көр: Choose: My brother ___ music every evening.

### g4e_pres2_q4
- taskId: `g4e-pres-l2-t4` correct: **a**
- options: a(Y:g4e_pres2_q4_a), b(N:g4e_pres2_q4_b), c(N:g4e_pres2_q4_c)
- RU: «They watch TV in the evening.» → Сделай отрицательным.
- EN: Think it through: Choose: She ___ her room on Saturdays.
- KY: Ойлонуп көр: Choose: She ___ her room on Saturdays.

### g4e_pres3_q1
- taskId: `g4e-pres-l3-t1` correct: **b**
- options: a(N:g4e_pres3_q1_a), b(Y:g4e_pres3_q1_b), c(N:g4e_pres3_q1_c)
- RU: Тали написал вопрос: «She speak French?» Spark говорит, что нужен вспомогательный глагол. Как правильно?
- EN: Think it through: Choose: Birds ___ in spring.
- KY: Ойлонуп көр: Choose: Birds ___ in spring.

### g4e_pres3_q2
- taskId: `g4e-pres-l3-t2` correct: **a**
- options: a(Y:g4e_pres3_q2_a), b(N:g4e_pres3_q2_b), c(N:g4e_pres3_q2_c)
- RU: «Tom reads books.» → Сделай вопрос: «___ Tom read books?»
- EN: Think it through: Choose: My father ___ to work by bus.
- KY: Ойлонуп көр: Choose: My father ___ to work by bus.

### g4e_pres3_q3
- taskId: `g4e-pres-l3-t3` correct: **a**
- options: a(Y:g4e_pres3_q3_a), b(N:g4e_pres3_q3_b), c(N:g4e_pres3_q3_c)
- RU: «___ your parents work on weekends?»
- EN: Think it through: Choose: She ___ books in the library now.
- KY: Ойлонуп көр: Choose: She ___ books in the library now.

### g4e_pres3_q4
- taskId: `g4e-pres-l3-t4` correct: **a**
- options: a(Y:g4e_pres3_q4_a), b(N:g4e_pres3_q4_b), c(N:g4e_pres3_q4_c)
- RU: Тали спрашивает про музей: «___ the museum open on Mondays?» Какое слово начинает этот вопрос?
- EN: Think it through: Choose: The sun ___ in the east.
- KY: Ойлонуп көр: Choose: The sun ___ in the east.

### g4e_past_q1
- taskId: `g4e-past-l1-t1` correct: **b**
- options: a(N:g4e_past_q1_a), b(Y:g4e_past_q1_b), c(N:g4e_past_q1_c)
- RU: Тали написал: «Yesterday we climb the mountain.» Spark говорит: «Тали, добавь -ed!» Как правильно?
- EN: Think it through: Choose: Yesterday she ___ to the park.
- KY: Ойлонуп көр: Choose: Yesterday she ___ to the park.

### g4e_past_q2
- taskId: `g4e-past-l1-t2` correct: **b**
- options: a(N:g4e_past_q2_a), b(Y:g4e_past_q2_b), c(N:g4e_past_q2_c)
- RU: «She ___ her room before the guests arrived.» (clean / cleans / cleaned)
- EN: Think it through: Choose: They ___ football last Sunday.
- KY: Ойлонуп көр: Choose: They ___ football last Sunday.

### g4e_past_q3
- taskId: `g4e-past-l1-t3` correct: **a**
- options: a(Y:g4e_past_q3_a), b(N:g4e_past_q3_b), c(N:g4e_past_q3_c)
- RU: Правильная форма Past Simple от «to open»:
- EN: Think it through: Choose: He ___ his homework yesterday.
- KY: Ойлонуп көр: Choose: He ___ his homework yesterday.

### g4e_past_q4
- taskId: `g4e-past-l1-t4` correct: **b**
- options: a(N:g4e_past_q4_a), b(Y:g4e_past_q4_b), c(N:g4e_past_q4_c)
- RU: «They play in the park every day.» → «Yesterday they ___…»
- EN: Think it through: Choose: We ___ a film last night.
- KY: Ойлонуп көр: Choose: We ___ a film last night.

### g4e_past2_q1
- taskId: `g4e-past-l2-t1` correct: **b**
- options: a(N:g4e_past2_q1_a), b(Y:g4e_past2_q1_b), c(N:g4e_past2_q1_c)
- RU: Тали написал: «Last night I haved a strange dream.» Spark говорит: «have» — неправильный! Как правильно?
- EN: Think it through: Choose: I ___ a letter last week.
- KY: Ойлонуп көр: Choose: I ___ a letter last week.

### g4e_past2_q2
- taskId: `g4e-past-l2-t2` correct: **b**
- options: a(N:g4e_past2_q2_a), b(Y:g4e_past2_q2_b), c(N:g4e_past2_q2_c)
- RU: Волшебник промахнулся: «The wizard ___ a rabbit, not a dragon!» (maked / made / make)
- EN: Think it through: Choose: She ___ a dress at the party.
- KY: Ойлонуп көр: Choose: She ___ a dress at the party.

### g4e_past2_q3
- taskId: `g4e-past-l2-t3` correct: **c**
- options: a(N:g4e_past2_q3_a), b(N:g4e_past2_q3_b), c(Y:g4e_past2_q3_c)
- RU: Past Simple от «go»:
- EN: Think it through: Choose: My dog ___ under the table.
- KY: Ойлонуп көр: Choose: My dog ___ under the table.

### g4e_past2_q4
- taskId: `g4e-past-l2-t4` correct: **a**
- options: a(Y:g4e_past2_q4_a), b(N:g4e_past2_q4_b), c(N:g4e_past2_q4_c)
- RU: Тали смотрит на список глаголов: bring, think, walk, see. Он говорит: «Все они неправильные!» Какой на самом деле правильный (просто добавляет -ed)?
- EN: Think it through: Choose: We ___ our grandparents last Sunday.
- KY: Ойлонуп көр: Choose: We ___ our grandparents last Sunday.

### g4e_past3_q1
- taskId: `g4e-past-l3-t1` correct: **b**
- options: a(N:g4e_past3_q1_a), b(Y:g4e_past3_q1_b), c(N:g4e_past3_q1_c)
- RU: Тали написал: «Anna meet her friends and they watch a film.» Spark видит две ошибки. Как правильно?
- EN: Think it through: Choose: The baby ___ all night.
- KY: Ойлонуп көр: Choose: The baby ___ all night.

### g4e_past3_q2
- taskId: `g4e-past-l3-t2` correct: **a**
- options: a(Y:g4e_past3_q2_a), b(N:g4e_past3_q2_b), c(N:g4e_past3_q2_c)
- RU: Найди ошибку: «He buyed a new bicycle last week.»
- EN: Think it through: Choose: They ___ the problem together.
- KY: Ойлонуп көр: Choose: They ___ the problem together.

### g4e_past3_q3
- taskId: `g4e-past-l3-t3` correct: **c**
- options: a(N:g4e_past3_q3_a), b(N:g4e_past3_q3_b), c(Y:g4e_past3_q3_c)
- RU: «The explorers ___ the cave and ___ gold inside.» (entered/found / enter/find / entered/find)
- EN: Think it through: Choose: She ___ the answer immediately.
- KY: Ойлонуп көр: Choose: She ___ the answer immediately.

### g4e_past3_q4
- taskId: `g4e-past-l3-t4` correct: **b**
- options: a(N:g4e_past3_q4_a), b(Y:g4e_past3_q4_b), c(N:g4e_past3_q4_c)
- RU: «She wrote a letter yesterday.» → Сделай отрицательным.
- EN: Think it through: Choose: He ___ home early yesterday.
- KY: Ойлонуп көр: Choose: He ___ home early yesterday.

### g4e_quest_q1
- taskId: `g4e-quest-l1-t1` correct: **b**
- options: a(N:g4e_quest_q1_a), b(Y:g4e_quest_q1_b), c(N:g4e_quest_q1_c)
- RU: «___ you like ice cream?» (Are / Do / Does)
- EN: Think it through: Choose: ___ does she live?
- KY: Ойлонуп көр: Choose: ___ does she live?

### g4e_quest_q2
- taskId: `g4e-quest-l1-t2` correct: **a**
- options: a(Y:g4e_quest_q2_a), b(N:g4e_quest_q2_b), c(N:g4e_quest_q2_c)
- RU: Какой вопрос можно закончить ответом «Yes» или «No»?
- EN: Think it through: Choose: ___ old are you?
- KY: Ойлонуп көр: Choose: ___ old are you?

### g4e_quest_q3
- taskId: `g4e-quest-l1-t3` correct: **c**
- options: a(N:g4e_quest_q3_a), b(N:g4e_quest_q3_b), c(Y:g4e_quest_q3_c)
- RU: Тали спрашивает про сестру: «Do your sister go to the same school?» Spark говорит, что помощник выбран неверно. Как правильно?
- EN: Think it through: Choose: ___ is your favourite colour?
- KY: Ойлонуп көр: Choose: ___ is your favourite colour?

### g4e_quest_q4
- taskId: `g4e-quest-l1-t4` correct: **b**
- options: a(N:g4e_quest_q4_a), b(Y:g4e_quest_q4_b), c(N:g4e_quest_q4_c)
- RU: Инопланетянин приземлился и задаёт вопрос: «___ humans sleep at night?» Какое слово начинает вопрос?
- EN: Think it through: Choose: ___ did you go yesterday?
- KY: Ойлонуп көр: Choose: ___ did you go yesterday?

### g4e_quest2_q1
- taskId: `g4e-quest-l2-t1` correct: **b**
- options: a(N:g4e_quest2_q1_a), b(Y:g4e_quest2_q1_b), c(N:g4e_quest2_q1_c)
- RU: Тали хочет узнать, где его шляпа: написал «What is my hat?» Spark говорит: «Тали, не "what", а...» Какое слово нужно?
- EN: Think it through: Choose: ___ is your birthday?
- KY: Ойлонуп көр: Choose: ___ is your birthday?

### g4e_quest2_q2
- taskId: `g4e-quest-l2-t2` correct: **a**
- options: a(Y:g4e_quest2_q2_a), b(N:g4e_quest2_q2_b), c(N:g4e_quest2_q2_c)
- RU: «___ is your best friend?» — хочешь узнать имя человека. Какое слово?
- EN: Think it through: Choose: ___ is your teacher?
- KY: Ойлонуп көр: Choose: ___ is your teacher?

### g4e_quest2_q3
- taskId: `g4e-quest-l2-t3` correct: **c**
- options: a(N:g4e_quest2_q3_a), b(N:g4e_quest2_q3_b), c(Y:g4e_quest2_q3_c)
- RU: Ты ищешь рюкзак Тали. «___ is my bag?» (Who / Where / Why)
- EN: Think it through: Choose: ___ do you come to school?
- KY: Ойлонуп көр: Choose: ___ do you come to school?

### g4e_quest2_q4
- taskId: `g4e-quest-l2-t4` correct: **b**
- options: a(N:g4e_quest2_q4_a), b(Y:g4e_quest2_q4_b), c(N:g4e_quest2_q4_c)
- RU: «___ do you come to school by bike?» — хочешь узнать причину.
- EN: Think it through: Choose: ___ is the weather today?
- KY: Ойлонуп көр: Choose: ___ is the weather today?

### g4e_quest3_q1
- taskId: `g4e-quest-l3-t1` correct: **b**
- options: a(N:g4e_quest3_q1_a), b(Y:g4e_quest3_q1_b), c(N:g4e_quest3_q1_c)
- RU: Тали ответил: «Do you like cats?» → «Yes, I likes.» Spark говорит: «Нет, Тали, краткий ответ — это...»
- EN: Think it through: Choose: ___ books do you have?
- KY: Ойлонуп көр: Choose: ___ books do you have?

### g4e_quest3_q2
- taskId: `g4e-quest-l3-t2` correct: **a**
- options: a(Y:g4e_quest3_q2_a), b(N:g4e_quest3_q2_b), c(N:g4e_quest3_q2_c)
- RU: «Does he play chess?» → «No, ___.»
- EN: Think it through: Choose: ___ does the lesson start?
- KY: Ойлонуп көр: Choose: ___ does the lesson start?

### g4e_quest3_q3
- taskId: `g4e-quest-l3-t3` correct: **c**
- options: a(N:g4e_quest3_q3_a), b(N:g4e_quest3_q3_b), c(Y:g4e_quest3_q3_c)
- RU: Тали отвечает: «Did they visit the museum?» → «Yes, they are.» Spark говорит: «Нет! Вопрос с Did — ответ тоже с...»
- EN: Think it through: Choose: ___ is your school bag?
- KY: Ойлонуп көр: Choose: ___ is your school bag?

### g4e_quest3_q4
- taskId: `g4e-quest-l3-t4` correct: **b**
- options: a(N:g4e_quest3_q4_a), b(Y:g4e_quest3_q4_b), c(N:g4e_quest3_q4_c)
- RU: Ведущий викторины: «Do birds fly?» — какой модельный краткий ответ?
- EN: Think it through: Choose: ___ do you prefer: summer or winter?
- KY: Ойлонуп көр: Choose: ___ do you prefer: summer or winter?

### g4s_help_q1
- taskId: `g4s-help-l1-t1` correct: **b**
- options: a(N:g4s_help_q1_a), b(Y:g4s_help_q1_b), c(N:g4s_help_q1_c)
- RU: Тали стоит с пакетами перед тяжёлой дверью и говорит: «Сам справлюсь!» — и продолжает толкать её ногой. Это мудрое решение?
- EN: Think it through: What if a friend falls and gets hurt?
- KY: Ойлонуп көр: Что сделать, если друг упал и поранился?

### g4s_help_q3
- taskId: `g4s-help-l1-t3` correct: **c**
- options: a(N:g4s_help_q3_a), b(N:g4s_help_q3_b), c(Y:g4s_help_q3_c)
- RU: Одноклассник не понимает задание, но молчит и расстраивается. Что ему стоит сделать?
- EN: Think it through: What does it mean to “help”?
- KY: Ойлонуп көр: Что значит «помогать»?

### g4s_help_q4
- taskId: `g4s-help-l1-t4` correct: **b**
- options: a(N:g4s_help_q4_a), b(Y:g4s_help_q4_b), c(N:g4s_help_q4_c)
- RU: Тали первый раз едет в новый район и не знает дороги. Он говорит: «Буду ехать наугад — не хочу спрашивать, это стыдно.» Согласен ли с ним Friendly?
- EN: Think it through: How do you feel about helping others?
- KY: Ойлонуп көр: Башкаларга жардам берип жатканда өзүңдү кандай сезесиң?

### g4s_help2_q1
- taskId: `g4s-help-l2-t1` correct: **b**
- options: a(N:g4s_help2_q1_a), b(Y:g4s_help2_q1_b), c(N:g4s_help2_q1_c)
- RU: «Дай мне ластик!» vs. «Можешь одолжить ластик, пожалуйста?» Какой вариант вежливее?
- EN: Think it through: What does "mutual assistance" mean?
- KY: Ойлонуп көр: Что значит «взаимопомощь»?

### g4s_help2_q2
- taskId: `g4s-help-l2-t2` correct: **a**
- options: a(Y:g4s_help2_q2_a), b(N:g4s_help2_q2_b), c(N:g4s_help2_q2_c)
- RU: Тали хочет попросить незнакомого взрослого о помощи. С какой фразы лучше начать?
- EN: Think it through: How to ask for help correctly?
- KY: Ойлонуп көр: Жардам сурганды кантип туура кылуу керек?

### g4s_help2_q3
- taskId: `g4s-help-l2-t3` correct: **c**
- options: a(N:g4s_help2_q3_a), b(N:g4s_help2_q3_b), c(Y:g4s_help2_q3_c)
- RU: Друг помог Тали решить задачу. Что обязательно нужно сделать после?
- EN: Think it through: My kid can't press the elevator button, what should I do?
- KY: Ойлонуп көр: Малыш не может нажать кнопку лифта. Что сделать?

### g4s_help2_q4
- taskId: `g4s-help-l2-t4` correct: **b**
- options: a(N:g4s_help2_q4_a), b(Y:g4s_help2_q4_b), c(N:g4s_help2_q4_c)
- RU: Тали спрашивает Friendly: «Какое слово делает просьбу вежливой почти как волшебство?» Friendly улыбается. Тали думает, что это «сейчас же». Поправь Тали!
- EN: Think it through: What is most important with help?
- KY: Ойлонуп көр: Что важнее всего при помощи?

### g4s_help3_q1
- taskId: `g4s-help-l3-t1` correct: **b**
- options: a(N:g4s_help3_q1_a), b(Y:g4s_help3_q1_b), c(N:g4s_help3_q1_c)
- RU: Маша потеряла рюкзак на перемене. К кому ей сначала обратиться?
- EN: Think it through: Why help strangers?
- KY: Ойлонуп көр: Зачем помогают незнакомым?

### g4s_help3_q2
- taskId: `g4s-help-l3-t2` correct: **b**
- options: a(N:g4s_help3_q2_a), b(Y:g4s_help3_q2_b), c(N:g4s_help3_q2_c)
- RU: Младший брат Тали плачет, но не говорит почему. Что поможет ему рассказать о своей проблеме?
- EN: Think it through: What is a volunteer?
- KY: Ойлонуп көр: Ыктыярчы деген эмне?

### g4s_help3_q3
- taskId: `g4s-help-l3-t3` correct: **c**
- options: a(N:g4s_help3_q3_a), b(N:g4s_help3_q3_b), c(Y:g4s_help3_q3_c)
- RU: Тали хочет помочь пожилой соседке донести сумку. Как правильно предложить помощь, чтобы не обидеть?
- EN: Think it through: How to react if you were helped?
- KY: Ойлонуп көр: Сага жардам бергенде кандай жооп берүү керек?

### g4s_help3_q4
- taskId: `g4s-help-l3-t4` correct: **b**
- options: a(N:g4s_help3_q4_a), b(Y:g4s_help3_q4_b), c(N:g4s_help3_q4_c)
- RU: Учитель объяснил тему, но Тали не понял. Тали говорит: «Подниму руку прямо сейчас и перебью!» Friendly морщится. Как лучше поступить?
- EN: Think it through: What should you do if you see that someone is ill?
- KY: Ойлонуп көр: Что делать, если видишь, что кому-то плохо?

### g4s_emo_q1
- taskId: `g4s-emo-l1-t1` correct: **a**
- options: a(Y:g4s_emo_q1_a), b(N:g4s_emo_q1_b), c(N:g4s_emo_q1_c)
- RU: Друг Тали пришёл с опущенными плечами и тихим голосом. Какую эмоцию он, скорее всего, испытывает?
- EN: Think it through: You got a fiver. How do you feel?
- KY: Ойлонуп көр: Ты получил пятёрку. Что ты чувствуешь?

### g4s_emo_q2
- taskId: `g4s-emo-l1-t2` correct: **a**
- options: a(Y:g4s_emo_q2_a), b(N:g4s_emo_q2_b), c(N:g4s_emo_q2_c)
- RU: Что у большинства людей вызывает настоящую радость?
- EN: Think it through: What is the name of the feeling when sad?
- KY: Ойлонуп көр: Капа болгондо пайда болгон сезим кантип аталат?

### g4s_emo_q3
- taskId: `g4s-emo-l1-t3` correct: **b**
- options: a(N:g4s_emo_q3_a), b(Y:g4s_emo_q3_b), c(N:g4s_emo_q3_c)
- RU: Тали видит грустящего друга и говорит: «Не грусти!» Friendly качает головой. Почему это не лучшая поддержка и что лучше сделать?
- EN: Think it through: What helps to cope with anxiety?
- KY: Ойлонуп көр: Что помогает справиться с тревогой?

### g4s_emo_q4
- taskId: `g4s-emo-l1-t4` correct: **b**
- options: a(N:g4s_emo_q4_a), b(Y:g4s_emo_q4_b), c(N:g4s_emo_q4_c)
- RU: Поднятые уголки губ, блеск в глазах — это какая эмоция?
- EN: Think it through: You're angry. What's right?
- KY: Ойлонуп көр: Ты злишься. Что правильно?

### g4s_emo2_q1
- taskId: `g4s-emo-l2-t1` correct: **b**
- options: a(N:g4s_emo2_q1_a), b(Y:g4s_emo2_q1_b), c(N:g4s_emo2_q1_c)
- RU: Тали злится на брата и хочет бросить вещь. Friendly останавливает его. Какой способ выразить злость безопасен для обоих?
- EN: Think it through: What is empathy?
- KY: Ойлонуп көр: Эмпатия деген эмне?

### g4s_emo2_q2
- taskId: `g4s-emo-l2-t2` correct: **b**
- options: a(N:g4s_emo2_q2_a), b(Y:g4s_emo2_q2_b), c(N:g4s_emo2_q2_c)
- RU: Перед выступлением на сцене сердце бьётся быстро и хочется убежать. Как называется эта эмоция?
- EN: Think it through: If a friend is upset, what do you need?
- KY: Ойлонуп көр: Досуң капа болсо, эмне кылуу керек?

### g4s_emo2_q3
- taskId: `g4s-emo-l2-t3` correct: **a**
- options: a(Y:g4s_emo2_q3_a), b(N:g4s_emo2_q3_b), c(N:g4s_emo2_q3_c)
- RU: Чем злость отличается от страха?
- EN: Think it through: What word is a positive emotion?
- KY: Ойлонуп көр: Какое слово — положительная эмоция?

### g4s_emo2_q4
- taskId: `g4s-emo-l2-t4` correct: **a**
- options: a(Y:g4s_emo2_q4_a), b(N:g4s_emo2_q4_b), c(N:g4s_emo2_q4_c)
- RU: Тали прочитал: «Петя закричал и бросил тетрадь». Friendly спрашивает: «Тали, что Петя испытывал и что ему лучше было сделать?» Тали говорит: «Он был рад!» Это верно?
- EN: Think it through: How to express joy culturally?
- KY: Ойлонуп көр: Кубанычты маданияттуу түрдө кантип билдирүү керек?

### g4s_emo3_q1
- taskId: `g4s-emo-l3-t1` correct: **a**
- options: a(Y:g4s_emo3_q1_a), b(N:g4s_emo3_q1_b), c(N:g4s_emo3_q1_c)
- RU: Широко открытые глаза и приоткрытый рот после сюрприза — это признаки какой эмоции?
- EN: Think it through: Better mood
- KY: Ойлонуп көр: Что улучшает настроение?

### g4s_emo3_q2
- taskId: `g4s-emo-l3-t2` correct: **a**
- options: a(Y:g4s_emo3_q2_a), b(N:g4s_emo3_q2_b), c(N:g4s_emo3_q2_c)
- RU: Что называют «спокойствием»?
- EN: Think it through: Why is it important to name feelings?
- KY: Ойлонуп көр: Почему важно называть чувства?

### g4s_emo3_q3
- taskId: `g4s-emo-l3-t3` correct: **c**
- options: a(N:g4s_emo3_q3_a), b(N:g4s_emo3_q3_b), c(Y:g4s_emo3_q3_c)
- RU: Тали замолчал посреди разговора и начал дышать глубоко. Friendly спрашивает: «Что он делает?» Тали говорит: «Хочет уснуть!» Исправь Тали.
- EN: Think it through: What is self-control?
- KY: Ойлонуп көр: Өзүн-өзү көзөмөлдөө деген эмне?

### g4s_emo3_q4
- taskId: `g4s-emo-l3-t4` correct: **b**
- options: a(N:g4s_emo3_q4_a), b(Y:g4s_emo3_q4_b), c(N:g4s_emo3_q4_c)
- RU: Удивление бывает приятным и неприятным. Пример каждого:
- EN: Think it through: You're afraid to perform. Which is better?
- KY: Ойлонуп көр: Ты боишься выступать. Что лучше?

### g4s_turn_q1
- taskId: `g4s-turn-l1-t1` correct: **b**
- options: a(N:g4s_turn_q1_a), b(Y:g4s_turn_q1_b), c(N:g4s_turn_q1_c)
- RU: Тали собирается прыгнуть к другу в середину очереди. Friendly тихо останавливает его. Как правильно поступить?
- EN: Think it through: What does it mean to “wait your turn”?
- KY: Ойлонуп көр: Что значит «ждать своей очереди»?

### g4s_turn_q2
- taskId: `g4s-turn-l1-t2` correct: **a**
- options: a(Y:g4s_turn_q2_a), b(N:g4s_turn_q2_b), c(N:g4s_turn_q2_c)
- RU: На уроке все хотят ответить одновременно. Что нужно сделать, чтобы услышали каждого?
- EN: Think it through: Someone is skipping the line. What's the right thing to do?
- KY: Ойлонуп көр: Бирөө кезексиз кирип жатат. Кандай туура болот?

### g4s_turn_q3
- taskId: `g4s-turn-l1-t3` correct: **c**
- options: a(N:g4s_turn_q3_a), b(N:g4s_turn_q3_b), c(Y:g4s_turn_q3_c)
- RU: Почему нельзя проталкиваться в очереди, даже если очень торопишься?
- EN: Think it through: Why is it important not to interrupt?
- KY: Ойлонуп көр: Почему важно не перебивать?

### g4s_turn_q4
- taskId: `g4s-turn-l1-t4` correct: **b**
- options: a(N:g4s_turn_q4_a), b(Y:g4s_turn_q4_b), c(N:g4s_turn_q4_c)
- RU: Игра в настольный хоккей: как честно определить, чья сейчас очередь ходить?
- EN: Think it through: What should I do before speaking in a group?
- KY: Ойлонуп көр: Что сделать перед тем как говорить в группе?

### g4s_turn2_q1
- taskId: `g4s-turn-l2-t1` correct: **b**
- options: a(N:g4s_turn2_q1_a), b(Y:g4s_turn2_q1_b), c(N:g4s_turn2_q1_c)
- RU: Тали не знает, как честно разделить самокат между тремя друзьями. Friendly предлагает варианты. Какой самый справедливый?
- EN: Think it through: Another is playing with a toy. What will you do?
- KY: Ойлонуп көр: Другой играет с игрушкой. Что сделаешь?

### g4s_turn2_q2
- taskId: `g4s-turn-l2-t2` correct: **a**
- options: a(Y:g4s_turn2_q2_a), b(N:g4s_turn2_q2_b), c(N:g4s_turn2_q2_c)
- RU: Один ребёнок всегда берёт самый большой кусок пирога. Как объяснить ему про справедливость?
- EN: Think it through: What is a compromise?
- KY: Ойлонуп көр: Компромисс деген эмне?

### g4s_turn2_q3
- taskId: `g4s-turn-l2-t3` correct: **c**
- options: a(N:g4s_turn2_q3_a), b(N:g4s_turn2_q3_b), c(Y:g4s_turn2_q3_c)
- RU: Что такое «компромисс»?
- EN: Think it through: The ability to give in to others is...
- KY: Ойлонуп көр: Умение уступать другим — это...

### g4s_turn2_q4
- taskId: `g4s-turn-l2-t4` correct: **b**
- options: a(N:g4s_turn2_q4_a), b(Y:g4s_turn2_q4_b), c(N:g4s_turn2_q4_c)
- RU: Команда решила большинством голосов играть в прятки, а Тали хотел футбол. Что делает Тали?
- EN: Think it through: The team chose the game by the majority. You don't like it. What will you do?
- KY: Ойлонуп көр: Команда көпчүлүк добуш менен оюнду тандады. Сага жакпайт. Эмне кыласың?

### g4s_turn3_q1
- taskId: `g4s-turn-l3-t1` correct: **b**
- options: a(N:g4s_turn3_q1_a), b(Y:g4s_turn3_q1_b), c(N:g4s_turn3_q1_c)
- RU: Тали замечает, что игрок подглядывает. Тали хочет накричать. Friendly останавливает его. Что лучше сделать?
- EN: Think it through: Why is it important to share?
- KY: Ойлонуп көр: Почему важно делиться?

### g4s_turn3_q2
- taskId: `g4s-turn-l3-t2` correct: **a**
- options: a(Y:g4s_turn3_q2_a), b(N:g4s_turn3_q2_b), c(N:g4s_turn3_q2_c)
- RU: Зачем в играх вообще нужны правила?
- EN: Think it through: When everyone talks in turn, it's...
- KY: Ойлонуп көр: Когда каждый говорит по очереди — это...

### g4s_turn3_q3
- taskId: `g4s-turn-l3-t3` correct: **c**
- options: a(N:g4s_turn3_q3_a), b(N:g4s_turn3_q3_b), c(Y:g4s_turn3_q3_c)
- RU: Тали проиграл в шахматы и очень расстроен. Какая реакция будет уважительной?
- EN: Think it through: I disagree with the rules of the game. What should I do?
- KY: Ойлонуп көр: Не согласен с правилами игры. Что делать?

### g4s_turn3_q4
- taskId: `g4s-turn-l3-t4` correct: **b**
- options: a(N:g4s_turn3_q4_a), b(Y:g4s_turn3_q4_b), c(N:g4s_turn3_q4_c)
- RU: Тали предлагает новое правило для известной игры, чтобы было честнее. Friendly спрашивает: «С чего начать?» Тали говорит: «Просто объявить новое правило!» Почему Friendly не согласен?
- EN: Think it through: The best way to resolve a dispute is...
- KY: Ойлонуп көр: Лучший способ решить спор — это...

### pre_birds_tree_vs_bush
- RU: На дереве 6 птичек, на кустике — 4. Тали думает, что на кустике больше, «потому что куст ближе». Прав?
- EN: Six birds sit in a tree, and four birds sit on a bush. Where are more birds?
- KY: Даракта 6 куш, бадалда — 4 куш. Кай жерде көбүрөөк?
