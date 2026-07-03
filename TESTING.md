# sm-team-dashboard — QA Test Plan (current system)

Block‑by‑block test plan for the **current** build: employee/admin access split,
per‑piece numbered cards (per‑cycle numbering + carryover badge), contract
cycles (day→day contiguous), **no Friday publishing**, multi‑photographer +
soft preferred shoot day, plan‑driven workload, finance P&L, delay diagnosis,
dynamic open‑work carryover across months, and regen‑safe work history +
photo‑session statuses. Each case: **steps → expected → side effects**.

- Reference: `PROJECT.md` (wins on conflict). Locale Arabic/RTL, light/aqua,
  months 0‑based, dates LOCAL midnight, currency `$`.

## Severity
- **S1** data loss / crash / wrong numbers / deploy wipes data / sensitive‑data leak.
- **S2** feature broken or misleading. **S3** cosmetic / edge.

A case PASSES only if the expected result AND every side effect hold.

---

## 0. Build gate
| ID | Steps | Expected | Sev |
|---|---|---|---|
| ENV‑1 | `npm ci` | clean install | S2 |
| ENV‑2 | `npm run typecheck` | no errors | S1 |
| ENV‑3 | `npm test` | **130/130 pass** | S1 |
| ENV‑4 | stop dev, `rm -rf .next && npx next build` | compiles; all routes incl. `/admin/*` build | S1 |
| ENV‑5 | fresh DB: delete `dev.db`, `db:push && db:seed` | seeds; جدارات/المول contract dates; seeded designers use 8h days and POST/STORY=10 rates | S1 |
| ENV‑6 | backup `dev.db` before destructive tests | copy exists | S2 |
| ENV‑7 | stop dev before `prisma generate`/`db push` | no Windows DLL lock (EPERM) | S3 |

### 0.1 Automated test suite (`npm test`, Vitest) — 22 files / 130 tests
| File | Tests | Covers |
|---|---|---|
| `tests/dates.test.ts` | 15 | working days, Thu/Fri skip, Levantine month names, formats |
| `tests/acceptance.test.ts` | 18 | SPEC acceptance (scheduling, ownership, photographer, determinism, canceled publishing, **ad-hoc of every priority gets packed — URGENT first**) |
| `tests/schemas.test.ts` | 9 | Zod validation (employee / company / task) |
| `tests/access-control.test.ts` | 7 | **employee area never exposes any `/admin` route** (guards ACC‑1/6/7) |
| `tests/schema-sync.test.ts` | 7 | SQLite ↔ Postgres Prisma models stay identical |
| `tests/cycles.test.ts` | 12 | contract-cycle plan distribution (20→20, 15→15), cross-month packing, **day→day cycle end (not +30d), consecutive-cycle contiguity across 31-day months/February/year boundary, NO work before a new contract's start date (first-cycle clamp + reel lead) while ongoing clients keep prior-month prep** |
| `tests/workload.test.ts` | 9 | default rates; required‑vs‑capacity load; over ⇒ 0 free; publisher cap at capacity; Friday→previous‑workday charge; single‑count of a split write plan; month window |
| `tests/task-state.test.ts` | 6 | done-state markers, historical completion date, unfinished-only lateness, board/status normalization |
| `tests/daily-work.test.ts` | 6 | today queue selection, active-work precedence, capacity fill, carousel slide units, publisher grouping |
| `tests/carousel-design-units.test.ts` | 3 | carousel posts count as one published post but multiple design units |
| `tests/task-filters.test.ts` | 3 | daily board task filtering by work/deadline/publish date |
| `tests/person-day-state.test.ts` | 3 | task/backlog/off/free day labels for the overview daily tabs |
| `tests/progress.test.ts` | 4 | company progress follows done/published PUBLISH cards |
| `tests/persistence.test.ts` | 4 | manual edits, soft-deletes, and photo-session status survive a regen |
| `tests/csv.test.ts` | 3 | report CSV export |
| `tests/priority.test.ts` | 3 | company priority is a tiebreaker only (deadline dominates) |
| `tests/pipeline.test.ts` | 7 | pipeline expansion, distinct deterministic keys, carousel quantity, deleted-piece preservation, trainer-supplied training content, **work-history timestamps carried across regeneration** |
| `tests/cards.test.ts` | 2 | **per-cycle card numbering restarts at 1 each bucket; design+publish share one number** |
| `tests/seed-data.test.ts` | 3 | seed files avoid broad publishing tasks, use per-piece publisher cards, and skip training write cards |
| `tests/finance.test.ts` | 2 | writer cost not allocated to trainer-supplied training content; contribution-margin (direct per-piece cost) vs full-absorption |
| `tests/month-continuation.test.ts` | 3 | month view = cycle bucket **+** the still-open tail of other cycles dated in the calendar month, **+ `openCarryoverWhere` (open work from ANY earlier bucket, done-state mirrored)** |
| `tests/db-integration.test.ts` | 1 | DB integration; self-skips if DB/env is unavailable |

### 0.2 Current locked logic rules
- **Late means exactly**: not done + `readyDate`/`publishDate` is before today. A done task is never late.
- **Done markers**: `READY`, `PUBLISHED`, `DELIVERED`, `board=DONE`, `completedAt`, or `finishedAt`.
- **Company progress**: a content piece counts when its PUBLISH card is done/published; production done alone does not count.
- **Carousel posts**: PUBLISH cards count posts (`quantity=1`); DESIGN cards count design units/slides (`quantity=N`).
- **Training content source**: التدريب is managed, but trainer-supplied; it has no Nawal WRITE card and no writer cost allocation.
- **Daily tasks view**: `يومي` on `/tasks` renders the same Kanban board as `بورد`, filtered to today's task dates. Carousel quantity fills designer capacity by slide/design units.
- **Task Deletion**: Manual tasks (`isAuto=false`) are permanently deleted. Auto-generated tasks (`isAuto=true`) are soft-deleted (`status="CANCELED"`, pinned) for the current month only. Content-piece deletion cancels both production and PUBLISH stages, remains hidden from publishing, and still suppresses one monthly piece if regenerated dates move.
- **Local/production DB parity**: use one idempotent data-fix script against the chosen `DATABASE_URL`; no manual divergent local-only edits.
- **Month-view continuity (contract cycles)**: a calendar-month board/overview shows its own cycle bucket **plus** the still-open tail of adjacent cycles whose publish/work/deadline date falls inside that calendar month — so a 20→20 company (e.g. المول) keeps its ongoing pieces visible on the 1st–19th instead of appearing to "restart from post 1". Completed prior-cycle work stays archived (only unfinished continuation is added). Engine/bucket tagging is unchanged; this is a read/view union only.
- **Open-work carryover (DYNAMIC, any earlier month)**: `openCarryoverWhere` additionally pulls ALL still-open tasks from every EARLIER bucket regardless of their dates — overdue June cards follow the team into July, and in August the same rule automatically surfaces July's (and any older) leftovers. Used by BOTH the tasks board and the home overview (daily queue + critical panel). Carryover cards show the «متبقّي من دورة <شهر>» badge (month name read from the card's own bucket — never hardcoded).
- **Per-cycle numbering**: `buildContentNumbers` groups by (company | type | year | month) — every cycle numbers its pieces 1..N; numbers never continue across months (a 6-piece plan can never read AI-8..AI-12).
- **Regen-safe history**: إعادة الجدولة (also triggered implicitly by task add/edit/delete) preserves `startedAt`/`finishedAt`/`completedAt` and photo-session statuses (detKey match, company|kind|no fallback). Reports' actual-duration metrics never reset.
- **Ad-hoc packing**: ad-hoc tasks of EVERY priority are packed ASAP and consume capacity; URGENT still goes first.
- **Contract cycles are contiguous**: cycle end = same day of the next month (clamped), so bucket N's end == bucket N+1's start — no dead day after 31-day months, no February overlap.
- **No work before contract start**: every auto-generated date (design/story deadline, packed work day, WRITE start, reel shoot, delivery, photoshoot session) is clamped to ≥ `contractStartDate`; a new contract's FIRST-cycle reels publish ≥ 4 days in (shoot −3 + deliver −1 fit inside the contract). Ongoing clients (contract long past) keep prior-month prep unchanged. Manual/pinned tasks are never clamped.

---

## 1. Access split (employee vs admin) 🆕 — S1 (privacy)
> ACC‑1/6/7 are also enforced automatically by `tests/access-control.test.ts`,
> which reads the nav config in `src/lib/nav.ts` and fails CI if the employee
> area ever links to `/admin`.

| ID | Steps | Expected | Sev |
|---|---|---|---|
| ACC‑1 | Open `/` (employee) | sidebar shows only: نظرة عامة, جدول المهام, جدول النشر, تقرير الإنجاز | S2 |
| ACC‑2 | As employee, open `/finance`, `/team`, `/companies`, `/workload`, `/priorities` | **404** each (sensitive data unreachable) | **S1** |
| ACC‑3 | Open `/admin` | full sidebar (+ المالية, الشركات, الفريق, الأحمال, الأولويات); brand “ADMIN”; nav links are `/admin/*` | S2 |
| ACC‑4 | Shared pages identical | `/tasks` and `/admin/tasks` both have full add/edit/delete + status moves | **S2** |
| ACC‑5 | Edit reflects in both | a change on `/admin/...` shows on `/...` after refresh (one data source) | S2 |
| ACC‑6 | Employee sidebar has **no admin link/hint** | no “لوحة الإدارة” link, no footer mentioning الإدارة; nothing points at `/admin` | **S1** |
| ACC‑7 | Admin sidebar area‑switch | a single “واجهة الموظفين” link back to `/`; never the reverse on the employee side | S2 |
| ACC‑8 | Employee `/reports` carries no money | shows task ledger + workload only; **no salary / contract value / P&L** | **S1** |

---

## 2. Seed & data integrity — S1
| ID | Steps | Expected | Sev |
|---|---|---|---|
| SEED‑1 | re‑run `db:seed` on populated DB | “preserving” logs; no deletion; counts unchanged | **S1** |
| SEED‑2 | edit a task → `db:seed` | edit kept | **S1** |
| SEED‑3 | add company/employee → `db:seed` | not deleted | **S1** |
| SEED‑4 | rate migration | designers on POST/STORY 6/8 → become 10; writer PLAN 1→0.5; photographer REEL 2/3→3/2; a custom rate is NOT touched | S2 |
| SEED‑5 | `SEED_FORCE=1` | full rebuild | S2 |
| SEED‑6 | run `tsx scripts/sync-june-current-fixes.ts` with local SQLite `DATABASE_URL` | idempotent; Nawal unfinished writing remains open; remaining Phoenitech reel production remains open; Alber completed tasks stay completed with 12/06 and 21/06 dates | **S1** |
| SEED‑7 | run same script with production Postgres `DATABASE_URL` | production DB receives the same targeted June fixes as local; no code or env secret committed | **S1** |

---

## 3. Home / Overview (`/` and `/admin`) 🆕
| ID | Steps | Expected | Sev |
|---|---|---|---|
| HOME‑1 | KPIs | managed companies · monthly content · designers · open URGENT | S2 |
| HOME‑2 | **المهام الحرجة حسب الفريق** | not‑done tasks overdue or due ≤2 working days, **grouped per person**; each block: counters متأخرة/اليوم/الأسبوع, top‑6 cards (overflow “+N مهمة أخرى”), and a “عرض في البورد ←” link | S2 |
| HOME‑2b | critical card link | “عرض في البورد” opens the board pre‑filtered to that person (`?person=<id>`), in the same area (`/` or `/admin`) | S2 |
| HOME‑3 | **إنجاز الفريق** | a donut per person (done/total/remaining), counts ALL assigned tasks — **عمر appears** | **S2** |
| HOME‑4 | **مهام اليوم** | a **tab per employee, always all of them**; active tab shows: their tasks, or **عطلة** (day off), or **متفرّغ لعمل إضافي** (working, no tasks) | **S2** |
| HOME‑5 | publisher on a Thursday | عمر shows his publish tasks (tasks take precedence over an “off” weekday) | S2 |
| HOME‑6 | **إنجاز الشركات** | done ÷ plan over the cycle; counts a piece when its PUBLISH card is DONE/PUBLISHED | S2 |
| HOME‑7 | إعادة الجدولة | success toast (stage counts); pipeline rebuilt. On failure → error toast with the real reason. If the run has gaps (missing writer/designer/photographer) → a **warning** toast lists them | S1 |
| HOME‑8 | **carryover reaches the home page** | with unfinished prior-month tasks (any dates), the critical panel + daily queue show them with the «متبقّي من دورة …» badge; finishing/deleting them removes them everywhere | **S2** |

---

## 4. Tasks — board + calendar 🆕
| ID | Steps | Expected | Sev |
|---|---|---|---|
| KAN‑1 | board | 4 columns; one card **per piece** | S2 |
| KAN‑2 | numbering | every post/story/reel is an individual numbered card (`بوست-1`, `ستوري-2`, `ريل-1`, `ريل AI-3`); **no batched “(N)”**; no `؟` | **S2** |
| KAN‑3 | same number across stages | design `بوست-3` ↔ publish `جدولة بوست-3` ↔ publishing `بوست-3` = same piece | S2 |
| KAN‑4 | board card meta | stage badge · owner · priority pill · pills ⏱ duration / 📅 يبدأ / تسليم / ✈ نشر · **متأخّر N يوم** when late | S2 |
| KAN‑5 | status/board move | updates; reflects in workload/donuts after refresh | S2 |
| KAN‑6 | **grouping (default شركة)** | within each status column, cards grouped by company (color dot + name + count), companies by priority, cards by nearest deadline then stage | S2 |
| KAN‑7 | **تجميع toggle** | switch شركة / نوع / شخص / بدون regroups the columns; default is شركة | S2 |
| KAN‑8 | **deep‑link filter** | open `/tasks?person=<id>` (or `?company=`) → the person/company filter is pre‑selected | S2 |
| KAN‑9 | **خطة دورة label** | نوال’s write cards read “كتابة بوستات وستوريز — <company> · دورة <start> – <end>” for the cycle they cover (e.g. المول 20 حزيران – 19 تموز) after إعادة الجدولة | S2 |
| KAN‑10 | **collapse groups** | click a group header → its cards fold away (chevron flips), header + count stay; click again → expand. “طيّ الكل / فتح الكل” folds/unfolds every group at once. Reduces clutter/scroll on heavy columns | S2 |
| KAN‑11 | **يومي** | renders the exact same Kanban board UI/grouping/actions as `بورد`, but only cards whose `workDate`/`readyDate`/`publishDate` is today | **S2** |
| KAN‑12 | **per-cycle numbering** | in a month view that shows carryover, each cycle numbers its own pieces 1..N (e.g. جدارات July AI reels read `ريل AI-1..6`, never `7..12`); the same piece keeps one number across design/publish | **S2** |
| KAN‑13 | **carryover badge** | every card from another cycle bucket shows «متبقّي من دورة <شهر>» with that card’s own month name; current-month cards never show it; in the NEXT month the badge text follows automatically (dynamic) | **S2** |
| CAL‑1 | calendar (شهري/أسبوعي) | items by workDate; **REEL & PUBLISH excluded** (production view); Friday column clear of work | **S2** |
| CAL‑2 | calendar card | owner read‑only (edit via ✏️); status select; pills incl. متأخّر N يوم | S2 |
| CAL‑3 | cycle spill | monthly grid extends to show a 20→20 company’s next‑month days | S2 |

---

## 5. Task edit / create / delete
| ID | Steps | Expected | Sev |
|---|---|---|---|
| EDIT‑1 | ✏️ a card → change name/date/owner/priority/status | persists; card pinned | S2 |
| EDIT‑2 | edit then إعادة الجدولة | edit survives (pinned) | **S1** |
| NEW‑1 | **مهمة إضافية** | dialog “إضافة مهمة إضافية”; created within capacity | S2 |
| NEW‑2 | **قفل يدوي** checked + date | locked to that exact date (incl. across regenerate) | S2 |
| DEL‑1 | 🗑️ ad‑hoc | removed, stays gone | S2 |
| DEL‑2 | parity | CONTENT (type+publishDate) == PUBLISH per month; 0 orphans | **S1** |

---

## 5.1 Completion, lateness, and daily-board rules — S1/S2
| ID | Steps | Expected | Sev |
|---|---|---|---|
| STATE‑1 | set a past-due task to `READY`/`DONE` | disappears from late/critical lists; no late badge | **S1** |
| STATE‑2 | create a not-started task with yesterday `readyDate` | appears as late by exactly calendar-day difference | **S1** |
| STATE‑3 | create a not-started task due today | appears in today/daily board but **not** as late | **S2** |
| STATE‑4 | enter historical completed June work today | `completedAt`/`finishedAt` uses the task date; it is still done and not late | **S1** |
| STATE‑5 | `/tasks` → `يومي` | same board columns/actions/grouping as `بورد`; dataset is today's tasks only | **S2** |
| STATE‑6 | company has publish card DONE/PUBLISHED but production card TODO | company progress counts that piece because publishing is the final company-facing state | **S1** |
| STATE‑7 | company has production DONE but publish card TODO | company progress does not count that piece | **S1** |

---

## 6. Generate / Regenerate — S1, side‑effect heavy
| ID | Steps | Expected | Sev |
|---|---|---|---|
| GEN‑1 | empty month | full pipeline from plans, over each cycle | S1 |
| GEN‑2 | move/edit a card, regenerate | board/status + pinned title/dates/owner/priority preserved | **S1** |
| GEN‑3 | ad‑hoc kept | ad‑hoc preserved; re‑packed (unless locked) | S2 |
| GEN‑4 | run twice | deterministic — identical result | S2 |
| GEN‑5 | does NOT touch | company/employee/finance records, statuses, edits | **S1** |
| GEN‑6 | priority tiebreak | among routine tasks with the **same deadline**, the higher‑priority company is placed first; **different deadlines are unaffected** (publish‑driven) | S2 |
| GEN‑7 | edit carousel quantity → regenerate | design `quantity`/slide count survives; publish remains one post | **S1** |
| GEN‑8 | delete a content card → regenerate after date/priority changes | the deleted monthly piece remains `CANCELED`; no matching PUBLISH card appears | **S1** |
| GEN‑9 | regenerate التدريب | content pieces start at design; no WRITE card for Nawal; publishing still generated | **S1** |
| GEN‑10 | move a card to DOING/DONE (timestamps set) → regenerate | `startedAt`/`finishedAt`/`completedAt` unchanged; reports’ المدة الفعلية unchanged | **S1** |
| GEN‑11 | mark a photo session تم التصوير/تم التسليم → add any ad-hoc task (implicit regen) | session status is NOT reset to لم يبدأ | **S1** |
| GEN‑12 | create a NORMAL-priority ad-hoc task | it gets a workDate (ASAP) and consumes that day’s capacity; URGENT still lands earlier | **S1** |

---

## 7. Capacity / rates 🆕
| ID | Check | Expected |
|---|---|---|
| RATE‑1 | designer posts | **10/day** (0.8h each, 8h day) |
| RATE‑2 | designer stories | **10/day** (0.8h each, 8h day) |
| RATE‑3 | AI‑reel | 1/day (8h) |
| RATE‑4 | per-employee overrides | custom `hoursPerDay`/`rates` are respected without changing the global defaults |
| RATE‑5 | mixed day | sums to ≤ hoursPerDay (no day over capacity unless overflow) |
| RATE‑6 | photographer | 3 reels / 2 days |
| RATE‑7 | schedule = workload | per‑day packing matches the workload rates |
| RATE‑8 | carousel posts | carousel 3 + carousel 4 = 2 published posts and 7 design units; at POST=10/day, only 3 single-post units remain in that designer day |

---

## 8. Contract cycles 🆕
| ID | Steps | Expected | Sev |
|---|---|---|---|
| CYC‑1 | regenerate; المول (day 20) | all publishDates in **[20 this → 20 next)** | **S2** |
| CYC‑2 | جدارات (day 15) | in [15 → 15) | S2 |
| CYC‑3 | company w/o contract date | stays within the calendar month | S2 |
| CYC‑4 | cross‑month work | every non‑reel design task gets a workDate (extended packing window) | S2 |
| CYC‑5 | **cycle contiguity** | for any contract day, bucket N’s cycle END equals bucket N+1’s START (check a 31-day month and February) — no un-covered day, no double-covered day | **S2** |
| CYC‑6 | **new-contract floor** | a company signed on the 1st of this month → after regenerate, NO card (write/design/shoot/publish prep) and NO photo session is dated before the contract date; its reels publish ≥ day 4; an ongoing client (contract months ago) still stages its photoshoot in the prior month | **S1** |

---

## 9. Publishing (`/publishing`) 🆕 no Friday
| ID | Steps | Expected | Sev |
|---|---|---|---|
| PUB‑1 | regenerate a month, inspect publishDates | **0 on Friday** (getDay 5); spread over the other days incl. Thursday | **S2** |
| PUB‑2 | feed spacing | POST/REEL/AI_REEL ≥1 day apart per company; stories may share a feed day | S2 |
| PUB‑3 | no‑interruption | each managed company ≥1 publish per week → green “لا انقطاع” banner | S2 |
| PUB‑4 | match Omar | publishing items ↔ Omar’s PUBLISH cards 1:1; parity after delete+regen | **S1** |
| PUB‑5 | plan‑match | scheduled per‑type counts == plan exactly | S2 |
| PUB‑6 | deleted content piece | `CANCELED` publish cards are excluded from schedule counts/calendar | **S1** |

---

## 10. Photographer / shoot day 🆕
| ID | Steps | Expected | Sev |
|---|---|---|---|
| PHO‑1 | single photographer | all reels → that person (unchanged) | S2 |
| PHO‑2 | 2nd photographer + assign companies → regenerate | reels routed per company; sessions on each photographer’s workdays; workloads not double‑counted | **S2** |
| PHO‑3 | preferred shoot day (e.g. نور = Tuesday) → regenerate | نور’s reel shoots land on **Tuesday** when possible; company with no preference uses default; a shoot is editable manually | **S2** |
| PHO‑4 | invariants | shoot ≤ deliver ≤ shoot+3 < publish; no Thu/Fri shooting; no week‑4 (calendar) shooting | S2 |

---

## 11. Workload (`/admin/workload`)
| ID | Steps | Expected | Sev |
|---|---|---|---|
| WL‑1 | per person | **الحمل% = مطلوب ÷ الطاقة** · منجز% · مطلوب/منجز/متبقّي/متاح + bar | S2 |
| WL‑2 | designer | committed = dated task effort inside calendar month, not company plan totals | S2 |
| WL‑3 | photographer | committed = dated shoot/reel task effort inside calendar month | S2 |
| WL‑4 | publisher | capacity = calendar month days excluding Friday; load = publish duty‑days dated inside month, **capped at capacity** (publishing alone never >100%); a Friday publish charges the previous workday | **S2** |
| WL‑5 | required‑based & consistent | متاح = الطاقة − المطلوب (**لا يتأثر بالمنجز**); **over ⇒ متاح = 0** (لا "تجاوز مع وجود أيام متاحة"); تعليم مهمة منجزة يحرّك منجز/متبقّي فقط | **S1** |
| WL‑6 | publisher over | عمر يتجاوز فقط لو المطلوب (أيام نشر + مستعجلة) > أيام الشهر بلا جُمَع — وإلا يبقى ≤100% | S2 |

---

## 12. Reports (`/reports`) 🆕
| ID | Steps | Expected | Sev |
|---|---|---|---|
| REP‑1 | KPIs | المنجز · متوسط المدة الفعلية · المساهمون · إجمالي المهام | S2 |
| REP‑2 | إنجاز خطة الشركات | per company % = done/published PUBLISH cards vs plan | S2 |
| REP‑3 | **تشخيص التأخيرات** | overdue unfinished tasks grouped by **stage** (كتابة/تصميم/تصوير/نشر) + by **person** (count + worst delay); completed tasks never appear | **S2** |
| REP‑4 | per‑person ledger | every task: البداية ← النهاية · المدة الفعلية · **متأخّر N يوم** · الحالة; done/total by name | S2 |
| REP‑5 | CSV export | columns incl. dates/actual‑duration; UTF‑8 BOM (Arabic in Excel) | S3 |

---

## 13. Finance (`/admin/finance`) 🆕
| ID | Steps | Expected | Sev |
|---|---|---|---|
| FIN‑1 | no values | empty‑state hint; all `$0` | S2 |
| FIN‑2 | set contract values + salaries | KPIs revenue/cost/net/margin update (no regen) | **S2** |
| FIN‑3 | per‑contract P&L | value · cost · profit (±, colored) · margin; Σ profit − overhead == net | **S2** |
| FIN‑4 | break‑even | min contracts = ceil(fixed ÷ avg contribution); above/below indicator | S2 |
| FIN‑5 | team capacity | max contracts (bottleneck) + “fits N more”; per‑producer bars | S2 |
| FIN‑6 | per‑reel photographer | costPerReel × reels charged to its companies (variable) | S2 |
| FIN‑7 | التدريب content source | Nawal/writer salary is not allocated to التدريب content supplied by the trainer | **S1** |

---

## 14. Companies / Team CRUD (`/admin/*`)
| ID | Steps | Expected | Sev |
|---|---|---|---|
| CO‑1 | add company w/ plan, owners, color, contract value/date, photographer, **preferred shoot day** | appears; after إعادة الجدولة its pipeline/publishing/finance show | S2 |
| CO‑2 | edit plan/owners | workload updates immediately; regenerate updates pipeline | S2 |
| CO‑3 | delete company | tasks/sessions cascade; others intact | S2 |
| TM‑1 | add employee w/ rates, workdays, **salary** | appears; feeds workload/finance | S2 |
| TM‑2 | photographer rate | “ينجز X ريل كل Y يوم” → rate X/Y; per‑reel cost field shows | S2 |

---

## 15. End‑to‑end
| ID | Scenario | Expected |
|---|---|---|
| E2E‑1 | new company (6 posts/12 stories/3 reels) → regenerate | split into individual numbered cards per owner; parity holds; no Friday publishing |
| E2E‑2 | give a company contract day 20 + preferred Tuesday + 2nd photographer → regenerate | publishes 20→20, shoots Tuesday, routed to the chosen photographer |
| E2E‑3 | set contract values + salaries → `/admin/finance` | P&L, break‑even, capacity populate consistently |
| E2E‑4 | leave June unpublished till late June → `/reports` | تشخيص التأخيرات shows نشر as the biggest late stage (عمر) with days |

---

## 16. Known limitations (don’t log as bugs)
- No login — `/admin` URL is the only gate; keep it private.
- Photographer week‑4 no‑shoot is calendar‑month based (safe); preferred shoot day is soft.
- Late tasks are diagnosed but not auto‑rescheduled (recovery action is a planned, separate step).
- The production/local DB parity script needs an explicit target `DATABASE_URL`; without the production URL only local can be verified.
- Actual duration “—” until a task moves through the board. June achievements hard‑coded.

---

## 17. Pre‑launch checklist
- [ ] ENV‑2/3/4 green (typecheck · 130 tests · build).
- [ ] **ACC‑2 + ACC‑6 + ACC‑8 PASS** (employees can’t reach OR see finance/team; no money in employee reports) — S1.
- [ ] SEED‑1..3, SEED‑6/7, GEN‑2/5, **GEN‑10/11/12**, DEL‑2/PUB‑4, WL‑5, STATE‑1/2/4/6/7 PASS — S1.
- [ ] PUB‑1 PASS (no Friday), CYC‑1..6, PHO‑2/3, RATE‑1/2, KAN‑11/12/13, HOME‑8, REP‑2/3 PASS.
- [ ] One DB backup stored outside the repo.

**Owner:** ____  **Date:** ____  **Result:** PASS / FAIL
