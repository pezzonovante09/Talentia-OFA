# Phase 7 — Manual QA checklist (in-app)

Automated checks done: `audit:i18n`, `check:i18n`, `audit:aba-en-ky` (0 mismatches), `audit:locale-quality`, `npm test` (56), `export:curriculum-grades`, inventory `pureMcCount: 0`.

**Что это за чеклист:** это пункт 7 плана (ручной прогон в приложении) — не авто-скоринг связности.  
Офлайн-переоценка связности (пункт 6 плана) уже сделана отдельно (`_audit_phase34_coherence.json`, `_audit_g1world_coherence.json`). Чеклист A нужен, чтобы увидеть уроки в UI (оба профиля), поймать рантайм/ABA/опечатки и субъективно оценить «цельность» — он **не** дублирует unit-тесты и **не** заменяется JSON-скорами.

## A. Text-changed lessons (Phases 3–4) — run **100%**

Run each lesson in **standard** and **special_aba** profiles.

### Phase 3 (option pools / phrasing)
- [ ] g2e-phr-l1, g2e-days-l1
- [ ] g3r-gen-l1, g3r-gen-l2, g3r-gen-l3
- [ ] g3r-adj-l1, g3r-adj-l2, g3r-adj-l3
- [ ] g3r-verb-l1, g3r-verb-l2, g3r-verb-l3
- [ ] g3e-tobe-l1, g3e-tobe-l2, g3e-tobe-l3
- [ ] g2r-sh-l1..l3, g2r-sp-l1..l3, g2r-sent-l1, g2r-sent-l3
- [ ] g2s-plt-l2, g2s-ani-l1..l3, g2s-bdy-l1, g2s-bdy-l3

### Phase 4 (topic rewrites / roles)
- [ ] g1w-sch-l3, g1w-nat-l1, g1w-nat-l2, g1w-nat-l3
- [ ] g1w-bdy-l1, g1w-bdy-l2, g1w-bdy-l3 (confirm ABA task appears)
- [ ] g3m-1000-l3, g2e-days-l2, g2e-sch-l3
- [ ] g1e-grt-l2, g1e-grt-l3, g1m-add-l1, g1e-abc-l1, g1e-abc-l2
- [ ] Spot-check ≥5 g4 lessons after speaker swap (NPC mentor / Tali student)

Also see engagement review list: `_rewritten_lessons_for_review.md`.

## B. Mechanic-only sample (Phase 5) — **10–15%** (~12–18 lessons)

Cover each new mechanic at least once:

| Mechanic | Suggested sample lesson |
|----------|-------------------------|
| input (math) | meadow-c5-l3, jungle-add-1, any g1m/g2m converted |
| input (EN word) | canyon-words-2, space-planets-2 |
| input (science) | lab-animals-1 / lab-animals-2 |
| input (g1world rewrite) | g1w-nat-l1 or g1w-bdy-l3 |
| fill_blank / sorting / routine_chain / image_word_match / world_knowledge | pick any pre-existing mixed lesson from inventory type counts |

- [ ] Sample set completed in app
- [ ] Input answers accept expected RU strings / numbers
