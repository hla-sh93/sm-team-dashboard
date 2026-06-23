# sm-team-dashboard — Pre‑Launch QA Test Plan

A full, block‑by‑block, feature‑by‑feature test plan to run **before going live**.
Written to catch bugs, errors, regressions, and leftover artifacts. Each case lists
**steps → expected result → side effects to verify**. Work top‑to‑bottom; do not
skip the **Side effects** column — most defects in this app hide there
(re‑schedule, pin preservation, pipeline pairing, workload recompute).

- **System reference**: `PROJECT.md` (architecture, rules). This plan tests that
  the implemented behavior matches those rules.
- **Locale**: Arabic, **RTL**. Light theme, aqua primary.
- **Months are 0‑based internally**; dates are LOCAL midnight.

## Severity
- **S1 Blocker** — data loss, crash, wrong numbers a manager would act on, deploy wipes data.
- **S2 Major** — feature broken or misleading, but a workaround exists.
- **S3 Minor** — cosmetic, label, edge case.

## How to record results
For each case mark **PASS / FAIL / BLOCKED** + note. A case is **PASS only if both
the expected result AND every listed side effect hold.**

---

## 0. Test environment & build gate (run first)

| ID | Steps | Expected | Side effects to verify | Sev |
|---|---|---|---|---|
| ENV‑1 | `npm ci` (clean install) | Installs with no peer/engine errors | `node_modules` present | S2 |
| ENV‑2 | `npm run typecheck` | No errors except stale `.next/types` (ignore) | — | S1 |
| ENV‑3 | `npm test` (vitest) | **44/44 pass** | No skipped/only tests | S1 |
| ENV‑4 | Stop dev server, then `rm -rf .next && npx next build` | "Compiled successfully", 11/11 pages | **Never run `next build` while `npm run dev` is live** (corrupts `.next`) | S1 |
| ENV‑5 | Fresh DB: delete `prisma/dev.db`, `npm run db:push && npm run db:seed` | Seeds without error; July + June actuals load | `dev.db` created; backups untouched | S1 |
| ENV‑6 | Take a backup: `cp prisma/dev.db backups/dev-<ts>.db` before any destructive test | Copy exists | — | S2 |

---

## 1. Seed & data integrity (the deploy safety net)

> The seed MUST be non‑destructive. This is the #1 production risk.

| ID | Steps | Expected | Side effects to verify | Sev |
|---|---|---|---|---|
| SEED‑1 | On a **populated** DB run `npm run db:seed` again | Logs "already has N tasks — preserving"; **no deletion** | June & July task counts **unchanged**; manual edits intact | **S1** |
| SEED‑2 | Edit a task in the app, then `npm run db:seed` | Seed preserves it | The edited task still has its new title/date/owner/priority | **S1** |
| SEED‑3 | Add a company in `/companies`, then `npm run db:seed` | New company **not deleted** | Company still present (no "authoritative cleanup") | **S1** |
| SEED‑4 | Change an employee's rate in `/team`, then `npm run db:seed` | Rate **not overwritten** | Employee keeps the edited rate | S2 |
| SEED‑5 | `SEED_FORCE=1 npm run db:seed` | Full rebuild (deletes + recreates) | Months reset to seed dataset; Hla's pinned June plan reproduced | S2 |
| SEED‑6 | Empty one month's tasks, run seed | That month re‑seeds; other months untouched | Only the empty month repopulates | S2 |
| SEED‑7 | Inspect `prisma/dev.db` employees/companies | 6 employees, 9 companies, e_* / c_* ids, no duplicates | Hla `hoursPerDay=3`; others 6 | S2 |

---

## 2. App shell, navigation, theme (cross‑cutting)

| ID | Steps | Expected | Side effects to verify | Sev |
|---|---|---|---|---|
| UI‑1 | Open `/`; click every sidebar link | All 8 routes load (نظرة عامة, المهام, النشر, الأحمال, التقارير, الأولويات, الشركات, الفريق) | Active link highlighted aqua; no 404 | S2 |
| UI‑2 | Verify direction | Whole UI is **RTL** | Text right‑aligned, sidebar on the right | S2 |
| UI‑3 | Theme check | **Light** background, **aqua** primary buttons/active state, tight corners | No dark‑theme remnants; cards white | S3 |
| UI‑4 | Console (every page) | **Zero** runtime errors/warnings (HMR "HotReload" warnings in dev are not real — confirm absent in `next build`/prod) | — | S2 |
| UI‑5 | Resize to mobile width | Layout reflows, no overflow/clipping | Tables scroll, cards stack | S3 |
| UI‑6 | Print `/reports` | Sidebar/controls hidden; report full‑width on white | — | S3 |

---

## 3. Contrast & color correctness (design)

| ID | Steps | Expected | Side effects | Sev |
|---|---|---|---|---|
| CLR‑1 | `/team` avatars | Each person's initial is **legible** on their color (white/dark auto by luminance) | Distinct color per person | S3 |
| CLR‑2 | `/companies` cards | **9 distinct** company colors (not all gold), readable names | Color dot/border matches | S3 |
| CLR‑3 | `/publishing` chips | Type colors readable (story = deep gold, not pale) | Legend matches chips | S3 |
| CLR‑4 | Workload bars | done=green, remaining=aqua/warn/danger, free=track — visually distinct | Over‑capacity shows red | S3 |

---

## 4. Overview / Home (`/`)

| ID | Steps | Expected | Side effects to verify | Sev |
|---|---|---|---|---|
| HOME‑1 | Open `/` for a month with data | KPIs: companies, monthly posts, designers, open‑urgent counts are correct | Numbers match DB | S2 |
| HOME‑2 | **أحمال الفريق** panel | Each person shows مطلوب/منجز/متاح + done/remaining bar | Matches `/workload` exactly | S2 |
| HOME‑3 | **مهام اليوم** panel | Tasks grouped **per person**; **done tasks excluded**; labels match the board (e.g. `بوستات · BW`, `نشر ريل‑1`) | A task you mark DONE disappears from this panel after refresh | **S2** |
| HOME‑4 | If today has no scheduled work | Panel shows the **nearest upcoming working day** with a label, not blank | Header reads "أقرب يوم عمل · …" | S3 |
| HOME‑5 | **المهام المستعجلة** table | Effort shown in **أيام العمل** (days), not hours | Priority/owner/date columns correct | S2 |
| HOME‑6 | Click **إعادة الجدولة** | Toast success; pipeline rebuilt | See §10 side effects (pins/board moves/ad‑hoc preserved) | **S1** |

---

## 5. Tasks — Kanban board (`/tasks`, default tab)

| ID | Steps | Expected | Side effects to verify | Sev |
|---|---|---|---|---|
| KAN‑1 | Open board | 4 columns (قيد الانتظار/التنفيذ/للمراجعة/منجز); cards grouped per stage label | Counts per column correct | S2 |
| KAN‑2 | Batching | Posts & stories **batched** per (owner,company,type,stage) with `(N)` count | Moving the card moves all N underlying tasks | S2 |
| KAN‑3 | Reel numbering | Reels/AI‑reels **individual & numbered** (`ريل‑1`, `ريل AI‑2`, `نشر ريل‑1`) | **No card shows `؟`** anywhere, any filter, any month | **S2** |
| KAN‑4 | Reel pair number | A reel's shoot card and its publish card share the **same number** | — | S3 |
| KAN‑5 | Soft gate | Downstream card shows "بانتظار: …" while predecessor not DONE | Moving predecessor to DONE clears the warning | S3 |
| KAN‑6 | Move card status dropdown | Status & board update; start/finish timestamps stamped | `/workload` & reports reflect the change after refresh | S2 |
| KAN‑7 | Reassign (owner change) | Task moves to the new person; gets **pinned** | Survives إعادة الجدولة | S2 |
| KAN‑8 | Filters person/company | Board narrows; **reel numbers stay correct** (built from full set) | Clearing filter restores all | S2 |
| KAN‑9 | Late badge | A task past its readyDate and not done shows late indicator | — | S3 |

---

## 6. Task EDIT dialog (تعديل ✏️ on every card)

| ID | Steps | Expected | Side effects to verify | Sev |
|---|---|---|---|---|
| EDIT‑1 | Click ✏️ on any card | Dialog opens: name, start date, end date, owner, priority, status (work‑days only for ad‑hoc) | Fields pre‑filled from the task | S2 |
| EDIT‑2 | Change **name** → تحديث | Card label shows the new name | Custom title overrides the auto label | S2 |
| EDIT‑3 | Change **start/end date** → تحديث | Dates persist on the card | Calendar view shows it on the new start day | S2 |
| EDIT‑4 | Change **owner** → تحديث | Task moves to that person | `/workload` of both people updates | S2 |
| EDIT‑5 | Change **priority** to مستعجل → تحديث | URGENT marker on card; month rescheduled | Other tasks may re‑order (priority/date changed) | S2 |
| EDIT‑6 | **Critical:** edit a card, then click **إعادة الجدولة** | The edit **survives** the regenerate (name/date/owner/priority kept) | Task is pinned; regenerate does NOT revert it | **S1** |
| EDIT‑7 | Edit a **batched** card (e.g. بوستات·BW(4)) | owner/priority/status apply to **all** items; name/dates to the primary | Batch stays consistent | S2 |
| EDIT‑8 | Edit work‑days of an ad‑hoc to 14 | Workload for that person increases by 14 days | `/workload` "مطلوب" rises | S2 |
| EDIT‑9 | Edit company select on a **content** card | Disabled (structural) | Only ad‑hoc may change company | S3 |

---

## 7. Task CREATE (مهمة مستعجلة)

| ID | Steps | Expected | Side effects to verify | Sev |
|---|---|---|---|---|
| NEW‑1 | Click **مهمة مستعجلة**, fill name/owner/work‑days/priority, save | Task created, scheduled ASAP within capacity | Month rescheduled; appears on board/calendar | S2 |
| NEW‑2 | Create URGENT ad‑hoc | Placed earliest available day | Other tasks re‑order around it | S2 |
| NEW‑3 | Work‑days field | Entered in **days**; stored = days×6 internally | Workload reflects the days exactly | S2 |
| NEW‑4 | Create with empty name | Blocked with "العنوان مطلوب" | No task created | S3 |

---

## 8. Task DELETE (حذف 🗑️)

| ID | Steps | Expected | Side effects to verify | Sev |
|---|---|---|---|---|
| DEL‑1 | Click 🗑️ on an **ad‑hoc** card → confirm | Task removed; **stays gone** | Month re‑distributed; others re‑pack | S2 |
| DEL‑2 | Delete then check pipeline integrity | **content cards with publishDate == publish cards** (no orphans) | Count parity holds (e.g. 137 == 137) | **S1** |
| DEL‑3 | Delete a **content** card | Card removed now; on regenerate it is **rebuilt from the plan** (to truly remove, lower the plan) | Publishing calendar stays consistent | S2 |
| DEL‑4 | Cancel the confirm dialog | Nothing deleted | — | S3 |

---

## 9. Tasks — Calendar views (day / week / month)

| ID | Steps | Expected | Side effects | Sev |
|---|---|---|---|---|
| CAL‑1 | Switch to شهري/أسبوعي/يومي | Items render by `workDate`; reels excluded from the calendar (shoot session is the unit); photographer sessions show by shootDate | Month navigation works | S2 |
| CAL‑2 | Open a day's Side Drawer | Lists that day's tasks; **+ إضافة مهمة مستعجلة** | Add opens the create dialog for that context | S3 |
| CAL‑3 | Card in calendar | Shows name, owner, status/reassign selects, **✏️ + 🗑️** | Edit/delete behave as §6/§8 | S2 |
| CAL‑4 | Labels match board | Same wording/numbers as the Kanban card | — | S3 |

---

## 10. Generate / Regenerate (`إعادة الجدولة`) — SIDE‑EFFECT HEAVY

| ID | Steps | Expected | Side effects to verify | Sev |
|---|---|---|---|---|
| GEN‑1 | Click إعادة الجدولة on an empty month | Full pipeline created (write→design/shoot→publish) from plans | Publish cards = plan totals per company | S1 |
| GEN‑2 | Regenerate June (has actuals) | Achievements (`JUNE_2026_DONE`) applied (some DESIGN/SHOOT = DONE) | Reports plan % reflects PUBLISHED only | S2 |
| GEN‑3 | Move a card to a column, regenerate | **Manual board move preserved** (by pipelineKey+stage) | Status/board kept | S1 |
| GEN‑4 | Pin/edit a card, regenerate | **Pinned title/dates/owner/priority preserved** | Edit not thrown away | **S1** |
| GEN‑5 | Add ad‑hoc, regenerate | Ad‑hoc **kept** (not deleted); workDate re‑packed | Ad‑hoc still present | S2 |
| GEN‑6 | Hla's distributed June (pinned) | كابرياني weekly + جدارات stages + follow‑ups stay on their pinned dates | No drift | S2 |
| GEN‑7 | Regenerate twice in a row | Deterministic — same result | No duplicate cards; ids namespaced per month | S2 |

---

## 11. Publishing calendar (`/publishing`)

| ID | Steps | Expected | Side effects to verify | Sev |
|---|---|---|---|---|
| PUB‑1 | Open `/publishing` | Calendar by `publishDate`; numbered (`بوست‑1`, `ريل‑1`, `ستوري‑3`) | Defaults to a month with publishes | S2 |
| PUB‑2 | Distribution | Feed items (post/reel/ai‑reel) **≥1 day apart** per company; **no same/consecutive‑day** feed | Stories may share a day | **S2** |
| PUB‑3 | Spread | Each company's items spread across the **whole month** (all 7 days incl. Thu/Fri) | No empty publishing week (no‑interruption banner green) | S2 |
| PUB‑4 | **Match Omar** | Publishing items correspond **one‑to‑one** with Omar's PUBLISH cards | After any delete+regen, count parity holds | **S1** |
| PUB‑5 | Filters company/type | Calendar narrows correctly | Numbers stable | S3 |
| PUB‑6 | Plan match | Per company, published‑type counts == plan exactly | Mismatch surfaces a problem note | S2 |

---

## 12. Workload — burndown (`/workload` + home panel)

> Plan‑driven, completion‑invariant. Verify the NUMBERS, not just rendering.

| ID | Steps | Expected | Side effects to verify | Sev |
|---|---|---|---|---|
| WL‑1 | Open `/workload` | Each person: **محجوز % · منجز % · مطلوب/منجز/متبقّي/متاح** + segmented bar | Sorted, type breakdown shown | S2 |
| WL‑2 | **Writer (نوال)** | committed ≈ (managed companies with a plan) × 2 days (+ her ad‑hoc) | 7 companies → 14 base | S2 |
| WL‑3 | **Designer** | committed = Σ owned posts/6 + stories/6 + aiReels/1 (+ ad‑hoc) | Matches owned plan (Ayman vs Sabin) | S2 |
| WL‑4 | **Photographer** | committed = Σ managed reels ÷ (2/3) | Can exceed 100% (flagged red) | S3 |
| WL‑5 | **Publisher (عمر)** | committed = publishing duty‑days (one per publish day, ≤5 companies/day); capacity = **all 7 days/week** | Matches the publishing calendar's day count | **S2** |
| WL‑6 | **Completion‑invariant** | Mark a plan task DONE → **committed unchanged**, منجز↑, متبقّي↓, متاح↑ | Load does NOT drop on completion | **S1** |
| WL‑7 | **Ad‑hoc adds** | Add an ad‑hoc to a person → committed & remaining rise | Removing it / next month → back to plan baseline | S2 |
| WL‑8 | **Story rate** | Stories counted at **6/day** (not 8) | Designer days reflect /6 | S3 |
| WL‑9 | **Hla half‑designer** | Ad‑hoc work‑days count as **calendar days** (not ÷3) — 14‑day task = 14 days | Not doubled to 28 | **S2** |
| WL‑10 | Ownership change | Change a company owner in `/companies` → workload of both people updates **immediately** (no regen needed) | Plan‑driven read | S2 |

---

## 13. Reports (`/reports`)

| ID | Steps | Expected | Side effects to verify | Sev |
|---|---|---|---|---|
| REP‑1 | Open `/reports` | KPIs: المنجز, **متوسط مدة الإنجاز الفعلية**, المساهمون, إجمالي المهام | Numbers correct | S2 |
| REP‑2 | **Plan completion** | Per company % = PUBLISHED‑only achievement vs plan | June reads low while publishing pending | S2 |
| REP‑3 | **Actual durations** | Per done task shows **start → finish + المدة الفعلية** (`finishedAt−startedAt`); "—" when never started | Move a task through the board (start then done) → its real elapsed shows | **S2** |
| REP‑4 | Avg duration KPI | = average of timed done tasks; "—" if none timed | Updates as tasks get timed | S3 |
| REP‑5 | Team workload in report | Uses **plan‑driven** numbers (companies passed) — NOT zero | Designers show real مطلوب days | **S2** |
| REP‑6 | CSV **تصدير المهام** | Columns incl. أيام مقدّرة, بدأ, أُنجز, **المدة الفعلية**, موعد النشر, الحالة | Opens in Excel, Arabic intact | S3 |
| REP‑7 | CSV **تصدير الفريق** | Per‑person needed/busy/free days + done count | — | S3 |

---

## 14. Companies CRUD (`/companies`) + dynamic behavior

| ID | Steps | Expected | Side effects to verify | Sev |
|---|---|---|---|---|
| CO‑1 | Create a managed company w/ plan + owners + color | Appears in list & everywhere | After **إعادة الجدولة**, its pipeline + publishing appear | S2 |
| CO‑2 | Edit plan numbers | Saved | Workload of owners updates immediately; regenerate updates the pipeline | S2 |
| CO‑3 | Change owners (post/story/aiReel) | Saved | Workload shifts between people immediately | S2 |
| CO‑4 | Delete a company | Removed | Its tasks/sessions cascade‑deleted; other months/companies intact | S2 |
| CO‑5 | Unmanaged (design‑only) company | No plan / no publishing generated; design via ad‑hoc only | defaultOwner gets ad‑hoc work | S3 |
| CO‑6 | Duplicate name | Rejected with error | No partial row | S3 |

---

## 15. Team CRUD (`/team`)

| ID | Steps | Expected | Side effects to verify | Sev |
|---|---|---|---|---|
| TM‑1 | Create employee w/ role, rates (items/day), workdays | Appears; rates stored as JSON | Eligible for ownership/assignment | S2 |
| TM‑2 | Edit rates / plan‑days | Saved | Workload recomputes with new rate | S2 |
| TM‑3 | Edit workdays | Saved | Capacity (working days) changes; over/under‑load recomputes | S2 |
| TM‑4 | Photographer flag | isPhotographer drives shoot scheduling | Reels route to this person | S3 |
| TM‑5 | Delete employee | Removed | Their tasks' assignee set to **null** (unassigned) — verify they're reassigned on regenerate | S2 |
| TM‑6 | Ayman workdays | Sun→Thu (off Sat); others Sat→Wed | Capacity counts match | S3 |

---

## 16. Priorities (`/priorities`)

| ID | Steps | Expected | Side effects to verify | Sev |
|---|---|---|---|---|
| PRI‑1 | Drag to reorder; set **clients before our companies** | Order saved (priority 1..n) | Publishing distribution favors higher‑priority companies | S2 |
| PRI‑2 | Regenerate after reorder | Higher‑priority companies' content distributed first | — | S3 |
| PRI‑3 | NOTE | Per‑designer **daily packing** orders by URGENT then deadline, **not** company priority — confirm this is acceptable (else log as enhancement, not bug) | — | S3 |

---

## 17. Capacity / rates correctness (spot‑check the math)

| ID | Check | Expected |
|---|---|---|
| RATE‑1 | Designer posts | 6/day → 6 posts = 1 day |
| RATE‑2 | Designer stories | **6/day** |
| RATE‑3 | Ayman AI‑reel | 1/day |
| RATE‑4 | Photographer reels | 2 reels per 3 days (0.667/day) → 6 reels = 9 days |
| RATE‑5 | Writer plan | 0.5/day → 1 plan = 2 days |
| RATE‑6 | Publisher | 4–5 companies/day (PUBLISH_COMPANIES_PER_DAY=5) |
| RATE‑7 | Ad‑hoc | work‑days entered directly; 1 day = 6h internal |

---

## 18. Dates, months, boundaries

| ID | Steps | Expected | Side effects | Sev |
|---|---|---|---|---|
| DT‑1 | Switch months via MonthBar | Each screen loads the right month's data | 0‑based internally, 1‑based labels correct | S2 |
| DT‑2 | A reel shoot in late prior month | Shows in the period (prep week) | No off‑by‑one day (local midnight) | S2 |
| DT‑3 | Thu/Fri | No content **production** on off‑days for designers; **publishing** allowed Thu/Fri | Ayman off Sat instead | S2 |
| DT‑4 | Month with no data | `resolveActiveMonth`/`resolvePublishMonth` land on a populated month | No blank crash | S3 |

---

## 19. Regression / integration scenarios (end‑to‑end)

| ID | Scenario | Expected outcome |
|---|---|---|
| E2E‑1 | Create ad‑hoc → edit its date → mark DONE → delete it | Each step reschedules; workload tracks add→done(invariant)→remove correctly |
| E2E‑2 | Reassign a batch → regenerate → check publishing | Owner change kept; publishing unaffected; Omar's cards intact |
| E2E‑3 | Change نور stories 8→12 in `/companies` → regenerate | 4 extra stories appear, distributed, no feed conflicts; Sabin's load +0.67 day |
| E2E‑4 | Delete a managed company → regenerate other companies | No orphan tasks; publishing recalculated; workload drops for its owners |
| E2E‑5 | Full month: regenerate → mark all DESIGN done → mark all PUBLISH done | Reports plan completion → 100%; workload منجز→committed, متاح→full |
| E2E‑6 | Set priorities clients‑first → regenerate | Clients' content scheduled/published ahead of BW/Phoenitech |

---

## 20. Deployment / production smoke test (Vercel + Neon)

| ID | Steps | Expected | Side effects to verify | Sev |
|---|---|---|---|---|
| DEP‑1 | Push to `main`, watch Vercel build | Build green; seed runs **non‑destructively** | Existing prod data **not wiped** | **S1** |
| DEP‑2 | First deploy on empty Neon | Seeds initial state | Click إعادة الجدولة per month for full pipeline | S2 |
| DEP‑3 | Re‑deploy after a content change | Existing edits/pipeline preserved; only EMPTY months seed | No data loss | **S1** |
| DEP‑4 | Prod smoke: open every route | All load, no 500s, numbers sane | `DATABASE_URL` = Neon | S1 |
| DEP‑5 | Prod regenerate a month | Works against Postgres | Pins/board moves preserved | S2 |
| DEP‑6 | Two Prisma schemas | `schema.prisma` (SQLite) and `schema.postgres.prisma` models **in sync** | Build uses the postgres schema | S2 |

---

## 21. Known limitations (do NOT log these as bugs)

- Auto‑generate on month‑open is intentionally **not** implemented — use **إعادة الجدولة**.
- `JUNE_2026_DONE` achievements are hard‑coded; other months start empty.
- Client‑approval is just the **للمراجعة** status (no separate gate) — by design.
- Dependencies (`blockedById`) are **soft** (warning), not a hard block — by design.
- Editing a **batched** card sets the name on its primary only; owner/priority/status apply to all.
- Multi‑day ad‑hoc shows as one card on its start day (not auto‑spread across days).
- Per‑designer daily packing does not use company priority (publishing distribution does).
- Reports' "actual duration" is "—" until a task is moved through the board (no start/finish stamp yet).

---

## 22. Pre‑launch sign‑off checklist

- [ ] ENV‑2/3/4 green (typecheck, 44 tests, prod build).
- [ ] **SEED‑1..3 PASS** (deploy never wipes data) — S1.
- [ ] **GEN‑4 / EDIT‑6 PASS** (manual edits survive regenerate) — S1.
- [ ] **DEL‑2 / PUB‑4 PASS** (no orphan cards; publishing == Omar) — S1.
- [ ] **WL‑6 PASS** (completion doesn't drop the load) — S1.
- [ ] HOME‑3 PASS (today excludes done, board‑matched labels).
- [ ] KAN‑3 PASS (no `؟` reel numbers).
- [ ] REP‑3/5 PASS (real durations; report workload not zero).
- [ ] Company plans, owners, priorities reviewed against the signed brief.
- [ ] DEP‑1/3/4 PASS on a staging Neon before pointing prod.
- [ ] One DB backup taken and stored **outside** the repo.

**Owner:** _________  **Date:** _________  **Result:** PASS / FAIL
