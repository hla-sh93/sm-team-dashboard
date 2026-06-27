# sm-team-dashboard — QA Test Plan (current system)

Block‑by‑block test plan for the **current** build: employee/admin access split,
per‑piece numbered cards, 6/8 designer capacity, contract cycles, **no Friday
publishing**, multi‑photographer + soft preferred shoot day, plan‑driven workload,
finance P&L, and delay diagnosis. Each case: **steps → expected → side effects**.

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
| ENV‑3 | `npm test` | **85/85 pass** | S1 |
| ENV‑4 | stop dev, `rm -rf .next && npx next build` | compiles; all routes incl. `/admin/*` build | S1 |
| ENV‑5 | fresh DB: delete `dev.db`, `db:push && db:seed` | seeds; جدارات/المول contract dates; designers STORY=8 | S1 |
| ENV‑6 | backup `dev.db` before destructive tests | copy exists | S2 |
| ENV‑7 | stop dev before `prisma generate`/`db push` | no Windows DLL lock (EPERM) | S3 |

### 0.1 Automated test suite (`npm test`, Vitest) — 14 files / 85 tests
| File | Tests | Covers |
|---|---|---|
| `tests/dates.test.ts` | 15 | working days, Thu/Fri skip, Levantine month names, formats |
| `tests/acceptance.test.ts` | 15 | SPEC acceptance (scheduling, ownership, photographer…) |
| `tests/schemas.test.ts` | 9 | Zod validation (employee / company / task) |
| `tests/access-control.test.ts` | 7 | **employee area never exposes any `/admin` route** (guards ACC‑1/6/7) |
| `tests/schema-sync.test.ts` | 7 | SQLite ↔ Postgres Prisma models stay identical |
| `tests/cycles.test.ts` | 7 | contract-cycle plan distribution (20→20, 15→15), cross-month packing |
| `tests/workload.test.ts` | 5 | required‑vs‑capacity load; over ⇒ 0 free; publisher; month window |
| `tests/task-state.test.ts` | 4 | done-state markers, historical completion date, unfinished-only lateness |
| `tests/task-filters.test.ts` | 3 | daily board task filtering by work/deadline/publish date |
| `tests/progress.test.ts` | 3 | company progress requires production + publish done |
| `tests/persistence.test.ts` | 3 | manual edits survive a regen |
| `tests/csv.test.ts` | 3 | report CSV export |
| `tests/priority.test.ts` | 3 | company priority is a tiebreaker only (deadline dominates) |
| `tests/db-integration.test.ts` | 1 | DB integration (self-skips if Prisma absent) |

### 0.2 Current locked logic rules
- **Late means exactly**: not done + `readyDate`/`publishDate` is before today. A done task is never late.
- **Done markers**: `READY`, `PUBLISHED`, `DELIVERED`, `board=DONE`, `completedAt`, or `finishedAt`.
- **Company progress**: a content piece counts only when its production stage and publish stage are both done.
- **Daily tasks view**: `يومي` on `/tasks` renders the same Kanban board as `بورد`, filtered to today's task dates.
- **Local/production DB parity**: use one idempotent data-fix script against the chosen `DATABASE_URL`; no manual divergent local-only edits.

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
| SEED‑4 | rate migration | designers still on STORY=6 → become 8; a custom rate is NOT touched | S2 |
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
| HOME‑6 | **إنجاز الشركات** | done ÷ plan over the cycle; counts a piece only when production stage and PUBLISH stage are both DONE | S2 |
| HOME‑7 | إعادة الجدولة | success toast (stage counts); pipeline rebuilt. On failure → error toast with the real reason. If the run has gaps (missing writer/designer/photographer) → a **warning** toast lists them | S1 |

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
| STATE‑6 | company has publish card DONE but production card TODO | company progress does not count that piece | **S1** |

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

---

## 7. Capacity / rates 🆕
| ID | Check | Expected |
|---|---|---|
| RATE‑1 | designer posts | **6/day** (1h each, 6h day) |
| RATE‑2 | designer stories | **8/day** (0.75h each) |
| RATE‑3 | AI‑reel | 1/day (6h) |
| RATE‑4 | Hla (3h) | half — 3 posts/day or 4 stories/day |
| RATE‑5 | mixed day | sums to ≤ hoursPerDay (no day over capacity unless overflow) |
| RATE‑6 | photographer | 2 reels / 3 days |
| RATE‑7 | schedule = workload | per‑day packing matches the workload rates |

---

## 8. Contract cycles 🆕
| ID | Steps | Expected | Sev |
|---|---|---|---|
| CYC‑1 | regenerate; المول (day 20) | all publishDates in **[20 this → 20 next)** | **S2** |
| CYC‑2 | جدارات (day 15) | in [15 → 15) | S2 |
| CYC‑3 | company w/o contract date | stays within the calendar month | S2 |
| CYC‑4 | cross‑month work | every non‑reel design task gets a workDate (extended packing window) | S2 |

---

## 9. Publishing (`/publishing`) 🆕 no Friday
| ID | Steps | Expected | Sev |
|---|---|---|---|
| PUB‑1 | regenerate a month, inspect publishDates | **0 on Friday** (getDay 5); spread over the other days incl. Thursday | **S2** |
| PUB‑2 | feed spacing | POST/REEL/AI_REEL ≥1 day apart per company; stories may share a feed day | S2 |
| PUB‑3 | no‑interruption | each managed company ≥1 publish per week → green “لا انقطاع” banner | S2 |
| PUB‑4 | match Omar | publishing items ↔ Omar’s PUBLISH cards 1:1; parity after delete+regen | **S1** |
| PUB‑5 | plan‑match | scheduled per‑type counts == plan exactly | S2 |

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
| WL‑4 | publisher | capacity = calendar month days excluding Friday; load = publish duty‑days dated inside month (≤5 co/day) | **S2** |
| WL‑5 | required‑based & consistent | متاح = الطاقة − المطلوب (**لا يتأثر بالمنجز**); **over ⇒ متاح = 0** (لا "تجاوز مع وجود أيام متاحة"); تعليم مهمة منجزة يحرّك منجز/متبقّي فقط | **S1** |
| WL‑6 | publisher over | عمر يتجاوز فقط لو المطلوب (أيام نشر + مستعجلة) > أيام الشهر بلا جُمَع — وإلا يبقى ≤100% | S2 |

---

## 12. Reports (`/reports`) 🆕
| ID | Steps | Expected | Sev |
|---|---|---|---|
| REP‑1 | KPIs | المنجز · متوسط المدة الفعلية · المساهمون · إجمالي المهام | S2 |
| REP‑2 | إنجاز خطة الشركات | per company % = pieces with production DONE + publish DONE vs plan | S2 |
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
- [ ] ENV‑2/3/4 green (typecheck · 85 tests · build).
- [ ] **ACC‑2 + ACC‑6 + ACC‑8 PASS** (employees can’t reach OR see finance/team; no money in employee reports) — S1.
- [ ] SEED‑1..3, SEED‑6/7, GEN‑2/5, DEL‑2/PUB‑4, WL‑5, STATE‑1/2/4/6 PASS — S1.
- [ ] PUB‑1 PASS (no Friday), CYC‑1..4, PHO‑2/3, RATE‑1/2, KAN‑11, REP‑2/3 PASS.
- [ ] One DB backup stored outside the repo.

**Owner:** ____  **Date:** ____  **Result:** PASS / FAIL
