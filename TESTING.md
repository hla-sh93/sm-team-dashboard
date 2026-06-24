# sm-team-dashboard — Pre‑Launch QA Test Plan (full, current system)

A complete, block‑by‑block test plan for the **updated** system: pipeline +
Kanban, **contract cycles**, **multiple photographers**, plan‑driven workload,
publishing calendar, achievement reports, and the **finance** P&L. Each case lists
**steps → expected → side effects**. Work top‑to‑bottom; the side‑effect column is
where most defects hide (re‑schedule, pin preservation, pipeline parity, cycle
windows, per‑photographer split, cost allocation).

- **Reference**: `PROJECT.md` (architecture & rules — wins on conflict).
- **Locale**: Arabic, **RTL**, light theme, aqua primary. **Months 0‑based
  internally**, dates LOCAL midnight. Currency **$**.

## Severity
- **S1 Blocker** — data loss, crash, wrong numbers a manager acts on, deploy wipes data.
- **S2 Major** — feature broken/misleading, workaround exists.
- **S3 Minor** — cosmetic, label, edge case.

A case is **PASS only if the expected result AND every listed side effect hold.**

---

## 0. Build gate (run first)

| ID | Steps | Expected | Sev |
|---|---|---|---|
| ENV‑1 | `npm ci` | Installs, no peer/engine errors | S2 |
| ENV‑2 | `npm run typecheck` | No errors (ignore stale `.next/types`) | S1 |
| ENV‑3 | `npm test` | **50/50 pass**, no skips | S1 |
| ENV‑4 | Stop dev, `rm -rf .next && npx next build` | "Compiled successfully", **12/12 pages** (incl. `/finance`). Never build while `dev` runs | S1 |
| ENV‑5 | Fresh DB: delete `prisma/dev.db`, `npm run db:push && npm run db:seed` | Seeds with no error; July + June actuals load; جدارات/المول carry contract dates | S1 |
| ENV‑6 | Backup `cp prisma/dev.db backups/dev-<ts>.db` before destructive tests | Copy exists | S2 |
| ENV‑7 | Stop dev server **before** `prisma generate`/`db push` | No EPERM lock on the query‑engine DLL (Windows) | S3 |

---

## 1. Seed & data integrity (deploy safety net)

| ID | Steps | Expected | Side effects | Sev |
|---|---|---|---|---|
| SEED‑1 | On a populated DB run `npm run db:seed` | Logs "already has N tasks — preserving"; **no deletion** | June & July counts unchanged; manual edits intact | **S1** |
| SEED‑2 | Edit a task, then `db:seed` | Edit preserved | Title/date/owner/priority kept | **S1** |
| SEED‑3 | Add a company/employee, then `db:seed` | Not deleted | Still present (no authoritative cleanup) | **S1** |
| SEED‑4 | Set a rate/salary/contract value, then `db:seed` | Not overwritten | Edited value kept | S2 |
| SEED‑5 | `SEED_FORCE=1 npm run db:seed` | Full rebuild | Months reset; Hla's pinned June plan reproduced; جدارات `2026‑05‑15`, المول `2026‑06‑20` | S2 |
| SEED‑6 | Inspect DB | **6 employees, 9 companies**, `e_*`/`c_*` ids, no duplicates | Hla `hoursPerDay=3`, others 6; 9 distinct colors | S2 |

---

## 2. App shell, navigation, theme

| ID | Steps | Expected | Side effects | Sev |
|---|---|---|---|---|
| UI‑1 | Click every sidebar link | **9 routes** load: نظرة عامة, جدول المهام, جدول النشر, أحمال العمل, تقرير الإنجاز, **المالية** 🆕, الأولويات, الشركات, الفريق | Active link aqua; no 404 | S2 |
| UI‑2 | Direction | Whole UI **RTL**, sidebar on the right | Text right‑aligned | S2 |
| UI‑3 | Theme | **Light** bg, **aqua** primary, white cards, tight corners | No dark remnants | S3 |
| UI‑4 | Console on every page | **Zero** runtime errors (HMR dev warnings excepted; confirm clean in prod build) | — | S2 |
| UI‑5 | Mobile width (375px) | Layout reflows; tables scroll; **no toast horizontal overflow** | Cards stack | S3 |
| UI‑6 | Print `/reports` | Sidebar/controls hidden; full‑width on white | — | S3 |

---

## 3. Contrast & color

| ID | Check | Expected | Sev |
|---|---|---|---|
| CLR‑1 | `/team` avatars | Initial legible on each color (auto white/dark) | S3 |
| CLR‑2 | `/companies` cards | 9 distinct colors, readable names | S3 |
| CLR‑3 | `/publishing` chips | Type colors readable (story = deep gold) | S3 |
| CLR‑4 | Workload bars | done=green, remaining=aqua/warn/danger, over=red | S3 |
| CLR‑5 | Finance | profit=green, loss=red, over‑capacity bar=red | S3 |

---

## 4. Home / Overview (`/`) 🆕 — fully reworked

| ID | Steps | Expected | Side effects | Sev |
|---|---|---|---|---|
| HOME‑1 | Open `/` | KPIs: **الشركات المُدارة** (managed active), **منشورات الشهر** (CONTENT count), **المصممون** (scheduled non‑photographer), **مهام مستعجلة مفتوحة** = tasks with **priority URGENT and not done** (NOT all ad‑hoc) | Numbers match DB | S2 |
| HOME‑2 | **المهام الحرجة** | Not‑done tasks whose deadline (readyDate else publishDate) is **overdue (red)** or **due within ≤2 working days (orange)**; grouped cards, overdue first; owner + due date | A task you complete leaves this section after refresh | **S2** |
| HOME‑3 | **إنجاز الفريق** | A **donut per person**: % done in centre, **done/total** below, and منجز/متبقّي/الكل. Counts **ALL assigned tasks** (by quantity) | **عمر (publisher) appears** (e.g. 2/141) — not empty | **S2** |
| HOME‑4 | **مهام اليوم** | **A tab per person** (avatar + count); under the active tab, that person's **live** tasks for the reference day, **board‑matched labels** | Done tasks excluded; reels numbered; posts/stories show count | **S2** |
| HOME‑5 | Today has no work | Tab strip uses the **nearest upcoming working day**, header reads "أقرب يوم عمل · …" | Not blank | S3 |
| HOME‑6 | **إنجاز الشركات** | Per managed company: **published ÷ plan over the cycle** (published = PUBLISH stage DONE). June reads **0%** while publishing pending; subtitle states "لا تُحتسب إلا بعد النشر" | نُشر X/plan · باقي | **S2** |
| HOME‑7 | No team‑workload panel, no urgent table | Both **removed** from home (workload now only on `/workload`) | — | S3 |
| HOME‑8 | **إعادة الجدولة** | Toast success; pipeline rebuilt | See §10 side effects | **S1** |

---

## 5. Tasks — Kanban board (`/tasks`, default)

| ID | Steps | Expected | Side effects | Sev |
|---|---|---|---|---|
| KAN‑1 | Open board | 4 columns (قيد الانتظار/التنفيذ/للمراجعة/منجز); cards per stage | Counts per column correct | S2 |
| KAN‑2 | Batching | Posts/stories batched per (owner,company,type,stage) with **count always shown — even (1)** | Moving the card moves all N tasks | **S2** |
| KAN‑3 | Reel numbering | Reels/AI‑reels individual & numbered (`ريل‑1`, `ريل AI‑2`, `نشر ريل‑1`) | **No `؟`** anywhere; no bare بوست/ستوري/ريل without count/number | **S2** |
| KAN‑4 | Pair number | A reel's shoot & publish cards share the number | — | S3 |
| KAN‑5 | Board card meta 🆕 | Each card shows: stage badge, label, **owner + priority pill**, and **pills**: ⏱ duration · 📅 يبدأ (workDate) · تسليم (readyDate) · ✈ نشر (publishDate) · **متأخّر** when late | Lateness = past readyDate & not done, or finished late | **S2** |
| KAN‑6 | Soft gate | Downstream shows "بانتظار: …" until predecessor DONE | Clears on predecessor DONE | S3 |
| KAN‑7 | Status move dropdown | Status & board update; start/finish stamped | `/workload`, `/reports`, donuts reflect after refresh | S2 |
| KAN‑8 | Filters person/company | Board narrows; reel numbers stay correct (built from full set) | Clearing restores all | S2 |
| KAN‑9 | Ad‑hoc badge | Ad‑hoc card stage badge reads **إضافية** (not "مهمة") | — | S3 |

---

## 6. Tasks — Calendar views (day / week / month) 🆕

| ID | Steps | Expected | Side effects | Sev |
|---|---|---|---|---|
| CAL‑1 | Switch شهري/أسبوعي/يومي | Items render by `workDate`. **REEL excluded** (shoot session is the unit) **and PUBLISH excluded** (production view) → publishing lives on `/publishing` | No "مهمة" rows; **Friday column clear of work** | **S2** |
| CAL‑2 | Photographer sessions | Shown by `shootDate`, attributed to the **company's photographer** | Multi‑photographer split visible | S2 |
| CAL‑3 | Calendar card 🆕 | Owner is **read‑only** (avatar + name — change it via ✏️), a **status** select, and pills: duration · تسليم date · priority · **متأخّر** | No owner dropdown on the card | **S2** |
| CAL‑4 | Cycle spill‑over | Monthly grid **extends past month‑end** to show a 20→20 company's items in the next month | Trailing week dimmed; items visible | S2 |
| CAL‑5 | Day drawer | Lists day's tasks + **إضافة مهمة إضافية**; cards as CAL‑3 | Add opens create dialog | S3 |
| CAL‑6 | Labels match board | Same wording/numbers/counts as Kanban | — | S3 |

---

## 7. Task EDIT (✏️ on every card)

| ID | Steps | Expected | Side effects | Sev |
|---|---|---|---|---|
| EDIT‑1 | Click ✏️ | Dialog: name, start, end, owner, priority, status (work‑days only for ad‑hoc); company disabled for content | Pre‑filled from task | S2 |
| EDIT‑2 | Change **name** → تحديث | Custom title overrides the auto label | — | S2 |
| EDIT‑3 | Change **start/end** → تحديث | Dates persist; calendar shows it on the new start day | — | S2 |
| EDIT‑4 | Change **owner** → تحديث | Task moves; both people's workload + donuts update | — | S2 |
| EDIT‑5 | Change **priority** to مستعجل | URGENT pill on card; month rescheduled | Others may re‑order | S2 |
| EDIT‑6 | **Edit a card, then إعادة الجدولة** | Edit **survives** (name/date/owner/priority kept); task pinned | Regenerate does NOT revert it | **S1** |
| EDIT‑7 | Edit a **batched** card | owner/priority/status → all items; name/dates → primary | Batch consistent | S2 |
| EDIT‑8 | Edit ad‑hoc work‑days to 14 | That person's workload "مطلوب" rises by 14 days | — | S2 |

---

## 8. Task CREATE (مهمة إضافية) 🆕 renamed

| ID | Steps | Expected | Side effects | Sev |
|---|---|---|---|---|
| NEW‑1 | Click **مهمة إضافية**, fill name/owner/work‑days/priority, save | Dialog title is **"إضافة مهمة إضافية"**; task created & scheduled within capacity | Month rescheduled; appears on board/calendar | S2 |
| NEW‑2 | **قفل يدوي** checkbox checked + a start date | Task **locked to that exact date**; engine never moves it (incl. on regenerate) | Stays put | **S2** |
| NEW‑3 | قفل يدوي **unchecked** | Engine auto‑places at the earliest day within capacity (may differ from typed date) | Re‑packs with other work | S2 |
| NEW‑4 | URGENT ad‑hoc | Placed earliest available day; others re‑order | — | S2 |
| NEW‑5 | Empty name | Blocked "العنوان مطلوب"; no task created | — | S3 |

---

## 9. Task DELETE (🗑️)

| ID | Steps | Expected | Side effects | Sev |
|---|---|---|---|---|
| DEL‑1 | 🗑️ an **ad‑hoc** card → confirm | Removed; **stays gone** | Month re‑packs | S2 |
| DEL‑2 | Delete then check pipeline parity | content cards (kind=CONTENT, type+publishDate) **== PUBLISH cards** per month, **0 orphans** | e.g. 137 == 137 | **S1** |
| DEL‑3 | Delete a **content** card | Removed now; on regenerate **rebuilt from plan** (to truly remove, lower the plan) | Publishing stays consistent | S2 |
| DEL‑4 | Cancel confirm | Nothing deleted | — | S3 |

---

## 10. Generate / Regenerate (`إعادة الجدولة`) — SIDE‑EFFECT HEAVY

| ID | Steps | Expected | Side effects | Sev |
|---|---|---|---|---|
| GEN‑1 | On an empty month | Full pipeline (write→design/shoot→publish) from plans, over each company's cycle | Publish cards = plan totals | S1 |
| GEN‑2 | June (has actuals) | `JUNE_2026_DONE` applied (some DESIGN/SHOOT DONE) | Reports plan % reflects PUBLISHED only | S2 |
| GEN‑3 | Move a card, regenerate | **Board move preserved** (pipelineKey+stage) | Status/board kept | S1 |
| GEN‑4 | Pin/edit a card, regenerate | **Pinned title/dates/owner/priority preserved** | Edit not lost | **S1** |
| GEN‑5 | Add ad‑hoc, regenerate | Ad‑hoc **kept**; workDate re‑packed (unless locked) | Still present | S2 |
| GEN‑6 | Run twice | **Deterministic** — identical result | No duplicates; ids namespaced per month | S2 |
| GEN‑7 | Does NOT touch | company/employee/**finance** records, statuses, manual edits | Only auto content cards rebuilt | **S1** |

---

## 11. Publishing calendar (`/publishing`)

| ID | Steps | Expected | Side effects | Sev |
|---|---|---|---|---|
| PUB‑1 | Open `/publishing` | Calendar by `publishDate`; numbered (`بوست‑1`, `ريل‑1`, `ستوري‑3`) | Defaults to a month with publishes | S2 |
| PUB‑2 | Distribution | Feed (post/reel/ai‑reel) **≥1 day apart** per company (no same/consecutive day); stories may share | — | **S2** |
| PUB‑3 | Spread | Each company spread across its **whole cycle**; no empty week → green "لا انقطاع" banner | — | S2 |
| PUB‑4 | **Match Omar** | Publishing items correspond **1:1** with Omar's PUBLISH cards; parity holds after any delete+regen | — | **S1** |
| PUB‑5 | Cycle spill | A 20→20 company's chips appear into the next month; **grid extends** to show them | — | S2 |
| PUB‑6 | Plan match | Per company, scheduled type counts **== plan** | Mismatch flagged | S2 |

---

## 12. Contract cycles 🆕 (`Company.contractStartDate`)

| ID | Steps | Expected | Side effects | Sev |
|---|---|---|---|---|
| CYC‑1 | Regenerate June; inspect المول (day 20) | All its publishDates fall in **[June 20 → July 20)** | Tagged month=June (start bucket) | **S2** |
| CYC‑2 | جدارات (day 15) | publishDates in **[June 15 → July 15)** | — | S2 |
| CYC‑3 | A company with **no** contract date (e.g. BW) | Stays within the **calendar month** (June 1–30) | Back‑compatible | S2 |
| CYC‑4 | Cross‑month work packs | Every non‑reel design task gets a workDate (extended packing window) — **none forced to overflow** by a short window | — | **S2** |
| CYC‑5 | Set/clear a contract date in `/companies` → regenerate | Distribution window shifts accordingly | Calendar/publishing grids follow | S2 |
| CYC‑6 | `week` (1..4) | Computed **within the cycle**, so no‑interruption check still has weeks 1–4 | — | S3 |

---

## 13. Multiple photographers 🆕 (`Company.photographerId`)

| ID | Steps | Expected | Side effects | Sev |
|---|---|---|---|---|
| PHO‑1 | One photographer only | All reels → that photographer (unchanged behavior) | Determinism preserved | S2 |
| PHO‑2 | Add a 2nd photographer (`/team`, isPhotographer) + assign some companies' **المصور (للريلز)** → regenerate | Each company's reels routed to **its** photographer; shoot sessions built on **that person's workdays** | Reel tasks' assignee = assigned photographer | **S2** |
| PHO‑3 | Workload of each photographer | Counts **only their assigned companies' reels** (not all) | No double‑count | **S2** |
| PHO‑4 | Tasks calendar sessions | Each session attributed to its company's photographer | Filter by person works | S2 |
| PHO‑5 | Per‑reel freelancer | A photographer with `costPerReel` set (salary 0) shoots normally; cost is variable (§16) | — | S2 |

---

## 14. Workload burndown (`/workload`)

| ID | Steps | Expected | Side effects | Sev |
|---|---|---|---|---|
| WL‑1 | Open `/workload` | Per person: محجوز% · منجز% · مطلوب/منجز/متبقّي/متاح + segmented bar + type breakdown | Sorted | S2 |
| WL‑2 | **Writer (نوال)** | committed ≈ (managed companies with a plan) × 2 days | 7 → ~14 base | S2 |
| WL‑3 | **Designer** | committed = Σ owned posts/6 + stories/6 + aiReels/1 (+ ad‑hoc) | Ayman vs Sabin differ | S2 |
| WL‑4 | **Photographer** | committed = Σ reels of **assigned** companies ÷ (2/3) | Can exceed 100% (red) | S3 |
| WL‑5 | **Publisher (عمر)** | committed = publishing duty‑days (≤5 companies/day); capacity = **all days in the period** | Matches the publishing day count | **S2** |
| WL‑6 | **Completion‑invariant** | Mark a plan task DONE → **committed unchanged**, منجز↑, متبقّي↓, متاح↑ | Load does NOT drop on completion | **S1** |
| WL‑7 | Ad‑hoc | Add → committed & remaining rise; remove / next month → back to plan baseline | — | S2 |
| WL‑8 | Ownership change | Change an owner in `/companies` → both people's workload updates **immediately** (plan‑driven, no regen) | — | S2 |
| WL‑9 | Story rate | Stories at **6/day** | — | S3 |
| WL‑10 | Hla half‑designer | Ad‑hoc work‑days are calendar days (not ÷3); a 14‑day task = 14 days | Not doubled | **S2** |

---

## 15. Reports (`/reports`) 🆕

| ID | Steps | Expected | Side effects | Sev |
|---|---|---|---|---|
| REP‑1 | Open `/reports` | KPIs: المنجز (with quantities), **متوسط مدة الإنجاز الفعلية**, المساهمون, إجمالي المهام | Numbers correct | S2 |
| REP‑2 | **إنجاز خطة الشركات** | Per company % = **PUBLISHED‑only** vs plan | June low while publishing pending | S2 |
| REP‑3 | **تفاصيل المهام لكل شخص** 🆕 | Per person: **every task** (batched), columns **المهمة · البداية ← النهاية · المدة الفعلية · الحالة**, **متأخّر** badge, **late first**; beside the name **منجز / إجمالي المهام** | عمر shows his publish tasks (not empty) | **S2** |
| REP‑4 | Actual duration | `finishedAt − startedAt`; **"—"** until a task is moved through the board | Updates as tasks get timed | S3 |
| REP‑5 | CSV **تصدير المهام** | Columns incl. أيام مقدّرة, بدأ, أُنجز, المدة الفعلية, موعد النشر, الحالة; UTF‑8 BOM (Arabic intact in Excel) | — | S3 |
| REP‑6 | CSV **تصدير الفريق** | Per‑person needed/busy/free days + done count | — | S3 |

---

## 16. Finance (`/finance`) 🆕

| ID | Steps | Expected | Side effects | Sev |
|---|---|---|---|---|
| FIN‑1 | Open with no values | **Empty‑state hint** to enter contract values & salaries; all `$0` | No crash | S2 |
| FIN‑2 | Set company **contract values** (`/companies`) + employee **salaries** (`/team`) | KPIs: **الإيرادات** (Σ values), **التكاليف** (Σ salaries + variable), **صافي الربح/الخسارة** (green/red), **الهامش %** | Updates immediately (no regen) | **S2** |
| FIN‑3 | **ربح/خسارة لكل عقد** | Per company: قيمة العقد · التكلفة · ربح/خسارة (±, colored) · الهامش% | Σ per‑contract profit − overhead == net profit | **S2** |
| FIN‑4 | Cost allocation | Each salary spread across companies **by work‑days consumed** (designers by items, photographer by reels, writer 2/co, publisher by item share) | Allocation roll‑up consistent | S2 |
| FIN‑5 | Overhead | Salary of a non‑producer (e.g. Hla team‑lead) shows as **"رواتب غير موزّعة على العقود"**, subtracted from net | Not charged to any contract | S2 |
| FIN‑6 | **نقطة التعادل** | Min contracts to cover wages = ceil(fixed salaries ÷ avg contribution); above/below indicator vs current count | — | **S2** |
| FIN‑7 | **سعة الفريق** | Max contracts the team can carry (bottleneck role); "fits N more"; per‑producer utilization bars | Excludes publisher from the bottleneck | S2 |
| FIN‑8 | **Per‑reel photographer** | Set `costPerReel`, salary 0 → his cost is **variable** = costPerReel × reels, charged to the companies he shoots; enters contribution margin for break‑even | Salaried photographer's salary is fixed/allocated instead | **S2** |
| FIN‑9 | Finance never affected by regenerate | إعادة الجدولة doesn't change values | — | S2 |

---

## 17. Companies CRUD (`/companies`) 🆕

| ID | Steps | Expected | Side effects | Sev |
|---|---|---|---|---|
| CO‑1 | Create managed company w/ plan, owners, color, **contract value**, **contract date**, **photographer** | Appears everywhere; after **إعادة الجدولة** its pipeline + publishing appear over its cycle | Finance picks up its value | S2 |
| CO‑2 | Edit plan numbers | Workload of owners updates immediately; regenerate updates the pipeline | — | S2 |
| CO‑3 | Change owners (post/story/aiReel/photographer) | Workload shifts immediately; reels reroute on regenerate | — | S2 |
| CO‑4 | Delete a company | Its tasks/sessions cascade‑delete; other months/companies intact | Finance/publishing recompute | S2 |
| CO‑5 | Unmanaged (design‑only) company | No plan/publishing; defaultOwner gets ad‑hoc only | — | S3 |
| CO‑6 | Duplicate name | Rejected; no partial row | — | S3 |

---

## 18. Team CRUD (`/team`) 🆕

| ID | Steps | Expected | Side effects | Sev |
|---|---|---|---|---|
| TM‑1 | Create employee w/ role, rates, workdays, **salary** | Appears; eligible for ownership/assignment; salary feeds finance | — | S2 |
| TM‑2 | **Photographer rate** | When **مصور** is checked, the rate input becomes **"ينجز X ريل كل Y يوم"** → rate = X/Y (e.g. 2 & 3 → ≈0.67 ريل/يوم) | Designer rate fields hidden for photographers | **S2** |
| TM‑3 | **Per‑reel cost** | When مصور, a **تكلفة الريل الواحد ($)** field shows | Used as variable cost in finance | S2 |
| TM‑4 | Edit rates / workdays | Workload + capacity recompute | — | S2 |
| TM‑5 | Ayman workdays | Sun→Thu (Thursday IS his workday); others Sat→Wed | Capacity counts match | S3 |
| TM‑6 | Delete employee | Tasks' assignee set null; reassigned on regenerate | — | S2 |

---

## 19. Priorities (`/priorities`)

| ID | Steps | Expected | Sev |
|---|---|---|---|
| PRI‑1 | Drag to reorder | Order saved (priority 1..n); publishing favors higher‑priority companies on regenerate | S2 |
| PRI‑2 | NOTE | Per‑designer daily packing orders by URGENT then deadline, **not** company priority (acceptable, not a bug) | S3 |

---

## 20. Capacity / rates correctness (spot‑check the math)

| ID | Check | Expected |
|---|---|---|
| RATE‑1 | Designer posts | 6/day → 6 posts = 1 day |
| RATE‑2 | Designer stories | **6/day** |
| RATE‑3 | Ayman AI‑reel | 1/day |
| RATE‑4 | Photographer reels | 2 per 3 days (0.667/day) → 6 reels = 9 days |
| RATE‑5 | Writer plan | 0.5/day → 1 plan = 2 days |
| RATE‑6 | Publisher | 4–5 companies/day (`PUBLISH_COMPANIES_PER_DAY=5`) |
| RATE‑7 | Ad‑hoc | work‑days entered directly; 1 day = 6h internal |

---

## 21. Dates, months, cycles, boundaries

| ID | Steps | Expected | Sev |
|---|---|---|---|
| DT‑1 | Switch months via MonthBar | Each screen loads the right month; 0‑based internal, 1‑based labels | S2 |
| DT‑2 | Reel shoot in late prior month | Shows in the period; no off‑by‑one (local midnight) | S2 |
| DT‑3 | Thu/Fri | No content **production** on a person's off‑days; **publishing** allowed Thu/Fri (on `/publishing` only — production calendar excludes publish) | S2 |
| DT‑4 | Cycle boundary | A 20→20 company's last items land before the 20th of next month; bucketed by start month | S2 |
| DT‑5 | Month with no data | `resolveActiveMonth`/`resolvePublishMonth` land on a populated month; no blank crash | S3 |

---

## 22. End‑to‑end scenarios

| ID | Scenario | Expected |
|---|---|---|
| E2E‑1 | Create ad‑hoc → edit date → mark DONE → delete | Each step reschedules; workload tracks add→done(invariant)→remove; donuts update |
| E2E‑2 | Reassign a batch → regenerate → check publishing | Owner change kept; Omar's cards intact; parity holds |
| E2E‑3 | Change نور stories 8→12 → regenerate | 4 extra stories distributed, no feed conflict; Sabin's load +0.67 day |
| E2E‑4 | Give a reel company a contract date (e.g. 10) + a 2nd photographer → regenerate | Reels shift to a 10→10 window AND route to the chosen photographer; sessions on his workdays |
| E2E‑5 | Set all contract values + salaries → open `/finance` | P&L per contract, net profit, break‑even, and team capacity all populate consistently |
| E2E‑6 | Full month: regenerate → mark all DESIGN done → mark all PUBLISH done | `/reports` plan completion → 100%; `/` إنجاز الشركات → 100%; workload منجز→committed |

---

## 23. Deployment (Vercel + Neon)

| ID | Steps | Expected | Sev |
|---|---|---|---|
| DEP‑1 | Push to `main`, watch build | Green; seed runs **non‑destructively**; existing prod data not wiped | **S1** |
| DEP‑2 | First deploy on empty Neon | Seeds initial state; click إعادة الجدولة per month | S2 |
| DEP‑3 | Re‑deploy after edits | Edits/pipeline preserved; only EMPTY months seed | **S1** |
| DEP‑4 | Prod smoke: open every route incl. `/finance` | All load, no 500s, numbers sane | S1 |
| DEP‑5 | New columns | `contractValue/contractStartDate/photographerId/salary/costPerReel` exist in Postgres (nullable‑safe push) | S2 |
| DEP‑6 | Two Prisma schemas | Models in sync (incl. the new fields); build uses the postgres schema | S2 |

---

## 24. Known limitations (do NOT log as bugs)

- Auto‑generate on month‑open is intentionally **not** implemented — use **إعادة الجدولة**.
- `JUNE_2026_DONE` achievements are hard‑coded; other months start empty.
- The **photographer engine is calendar‑month‑bound** (week‑4 shoot cap, prior‑month
  photoshoot) even for cycle companies — safe (cap only pulls shoots earlier).
- `/reports` "actual duration" is "—" until a task is moved through the board.
- Editing a **batched** card sets the name on its primary only.
- Per‑designer daily packing does not use company priority (publishing does).
- Finance is **monthly, plan‑driven** (not actual invoices/payroll runs); per‑reel
  cost is the only variable component.

---

## 25. Pre‑launch sign‑off checklist

- [ ] ENV‑2/3/4 green (typecheck, **50** tests, **12/12** prod build).
- [ ] **SEED‑1..3 PASS** (deploy never wipes data) — S1.
- [ ] **GEN‑4 / EDIT‑6 PASS** (manual edits survive regenerate) — S1.
- [ ] **DEL‑2 / PUB‑4 PASS** (no orphans; publishing == Omar) — S1.
- [ ] **WL‑6 PASS** (completion doesn't drop the load) — S1.
- [ ] **CYC‑1..4 PASS** (contract cycles distribute & pack correctly).
- [ ] **PHO‑2/3 PASS** (reels split per photographer; workload not double‑counted).
- [ ] **FIN‑3/6/7 PASS** (P&L rolls up; break‑even & capacity sane).
- [ ] HOME‑2/3/4/6, KAN‑3, REP‑3 PASS.
- [ ] Company plans, owners, priorities, contract values/dates, salaries reviewed.
- [ ] DEP‑1/3/4 PASS on staging Neon before pointing prod.
- [ ] One DB backup stored **outside** the repo.

**Owner:** _________  **Date:** _________  **Result:** PASS / FAIL
