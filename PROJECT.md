# sm-team-dashboard — Project Handoff / Full Documentation

A social‑media team management, scheduling **and finance** dashboard (Arabic,
**RTL**). It runs a digital‑marketing team that serves multiple client companies
through the full content lifecycle — **planning → writing → design/shoot →
publishing** — with per‑person capacity planning, a Kanban workflow, a publishing
calendar, editable task cards, achievement reports, and a **profit/loss** view per
contract.

> Single source of context for a new session. The original spec is
> `SOCIAL_SCHEDULER_SPEC.md`; many rules below override it — **this file wins on
> conflict.** Sections marked 🆕 changed materially in the latest work cycle
> (contract cycles, multi‑photographer, finance, home/report rework).

---

## 1. Tech stack & how to run

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind**. RTL, Tajawal font.
- **Design system**: **light theme** (Vuexy‑style), primary = **aqua `#0a8fa3`**,
  tight border radius. See §11.
- **Prisma** ORM. **SQLite locally**, **Postgres (Neon) in production**.
- **Vitest** tests (**50 tests**). Enums stored as **String** (SQLite has no
  enums); `Int[]` (workDays) stored as JSON strings.

### Two Prisma schemas (keep models in sync!)
- `prisma/schema.prisma` — **SQLite**, local dev.
- `prisma/schema.postgres.prisma` — **Postgres**, used by Vercel via `--schema`.

### Commands
```bash
npm run dev          # local dev (SQLite)
npm test             # vitest (50 tests)
npm run typecheck    # tsc --noEmit  (ignore stale .next/types errors)
npm run db:push      # prisma db push (SQLite)
npm run db:seed      # tsx prisma/seed.ts  (NON-destructive — see §9)
# Vercel build:
#   prisma generate --schema=schema.postgres.prisma
#   && prisma db push --schema=schema.postgres.prisma --accept-data-loss --skip-generate
#   && tsx prisma/seed.ts && next build
```
Local first run: `npm run db:push && npm run db:seed` (SQLite `prisma/dev.db`).
`.env` holds `DATABASE_URL`. **DB backups** live in `backups/dev-<timestamp>.db`
(git‑ignored copies of `dev.db`); take one before risky data work.

### Deploy
- Hosting: **Vercel**, auto‑deploy on push to **`main`**. DB: **Neon Postgres** via
  Vercel Storage; env var **must be named `DATABASE_URL`**.
- The seed is **non‑destructive** (§9): a deploy seeds only an EMPTY month and never
  overwrites edits. After a fresh deploy, click **إعادة الجدولة** once per month to
  expand the full pipeline. **Adding a nullable column is a safe `db push`.**

---

## 2. Data model (Prisma)

### Employee
`id, name, role (free‑text Arabic), hoursPerDay (only Hla≠6, she=3),
workDays (JSON int[] of getDay()), isScheduled, isPhotographer,
salary 🆕, costPerReel 🆕, color, rates (JSON items/day, nullable), tasks[]`
+ ownership relations: postOwner / storyOwner / aiReelOwner / defaultOwner /
**photographer 🆕**.
- **salary** — monthly fixed cost ($), for the finance P&L (§7).
- **costPerReel** — per‑reel variable cost for a freelance photographer paid by
  the job (null = paid by salary). A photographer may have either or both.

### Company
`id, name (unique), managed, posts, reels, stories, aiReels (monthly plan),
contractValue 🆕, contractStartDate 🆕, color, priority, status,
postOwnerId, storyOwnerId, aiReelOwnerId, defaultOwnerId,
photographerId 🆕, tasks[], photoSessions[]`
- **contractValue** — monthly contract revenue ($), for finance (§7).
- **contractStartDate** — when set, the plan distributes over the company's
  **30‑day contract cycle** (day→day next month) instead of the calendar month
  (§5). Null = calendar month.
- **photographerId** — which photographer shoots THIS company's reels; null →
  the first/only photographer. Splits reel work across photographers (§5).

### Task  (the central entity — also the kanban card)
`id, kind, type, title, hours, quantity, priority, status, publishDate,
readyDate, workDate, week, overflow, month (0‑based), year, isPinned, isAuto,
stage, board, blockedById, pipelineKey, detKey, notes, completedAt, startedAt,
finishedAt, companyId, assigneeId`
- **kind**: `CONTENT | ADHOC | PHOTOSHOOT | REPORT | CONTENT_WRITING | PUBLISH`
- **type**: `POST | REEL | AI_REEL | STORY | null`
- **priority**: `NORMAL | IMPORTANT | URGENT`
- **status**: `NOT_STARTED | IN_PROGRESS | AWAITING_APPROVAL | READY | PUBLISHED`
- **stage** (pipeline): `WRITE | DESIGN | SHOOT | PUBLISH`
- **board** (kanban column): `TODO | DOING | REVIEW | DONE`
- **blockedById**: predecessor stage‑task id (SOFT gate → warning only)
- **pipelineKey**: groups stages of one content item (`companyId|type|publishDate`)
- **quantity**: batch size · **workDate** = START day · **readyDate** = END/deadline
- **hours**: internal effort store. **Ad‑hoc** tasks: `hours = work‑days × 6` (the
  UI edits **work‑days**, §4). Content cards keep `hours = 0` (rate‑based).
- **isPinned**: a manual edit / lock — preserved verbatim across regenerate (§8).

### PhotoSession
`id, no (1=photoshoot), kind (PHOTOSHOOT|REELS), shootDate, deliverBy, reelCount,
status (NOT_STARTED|SHOT|EDITING|DELIVERED), month, year, isAuto, detKey, companyId`

### Setting
`key, value (JSON)` — seed hashes (`seedHash:<year>-<month>`).

---

## 3. The pipeline / agile workflow (core concept)

Every content item flows through stages, each a **card on one person's board**:
```
كتابة (نوال) → تصميم/تصوير (مصمم/مصور) → نشر (عمر)
```
- **WRITE**: Nawal, **2 cards per company** — one gating posts+stories+ai‑reels
  (scope DESIGN), one gating reels (scope SHOOT). Write cards carry a **start
  (workDate)** and **end (readyDate)**.
- **DESIGN**: posts/stories/ai‑reels → the company's owner.
- **SHOOT**: real reels → the company's photographer (§5).
- **PUBLISH**: Omar — one publish card per content item.
- Cards are **all created upfront** in `TODO`; downstream cards are **soft‑locked**
  ("بانتظار: …") until `blockedById` is `DONE`.

### Kanban / label rules (`KanbanBoard.tsx` + `lib/cards.ts`)
A shared module so every view shows identical labels:
- `buildReelNumbers(allTasks)` — numbers **every** reel per `(company,type)` in
  publish order; shoot/design + publish share a number via `pipelineKey`. A reel
  **never shows "?"**.
- `cardLabelFor(t,count,reelNum,coName)` — a custom `title` overrides the auto
  label; else posts/stories batched and reels numbered. 🆕 **Posts/stories ALWAYS
  show the count — even `(1)`** — and reels always show their number; no bare
  "بوست/ستوري/ريل" without a count/number anywhere.
- `groupTasksIntoCards(tasks)` — batches posts/stories per
  `(assignee,company,type,stage)`; everything else stays individual.

The pipeline is produced by **`lib/pipeline.ts → expandPipeline()`**.

---

## 4. Capacity / productivity model  (`lib/capacity.ts`)

Capacity = **items per working day** per person+type.

`DEFAULT_RATES` (items/day): `POST 6, STORY 6, AI_REEL 1, REEL 2/3 (2 reels per 3
days), PLAN 0.5 (=2 days per plan)`. Per‑person overrides in `Employee.rates`.

**Ad‑hoc effort is in WORK DAYS.** Entered in **أيام العمل**, stored as
`hours = days × WORK_DAY_HOURS (6)`. `adhocDays()` normalizes by the **fixed** 6
(NOT the person's `hoursPerDay`) so "a work‑day" is one calendar working day for
everyone (critical because Hla is a half‑designer). Hours never appear in the UI.

Helpers: `ratePerDay`, `taskDays(emp,type,qty)`, `adhocDays(emp,hours)`,
`cardDurationDays`, `daysLabel`, `WORK_DAY_HOURS`.

---

## 5. Scheduling engine  (`lib/scheduler.ts`, `lib/photographer.ts`)

`buildSchedule(state)` is **pure & deterministic** (no DB, no `Date.now()`):
content tasks + photographer sessions for a month.

### Contract cycles 🆕  (`lib/dates.ts`)
Each company distributes its plan over its **contract cycle**, not the calendar
month:
- `companyCycle(year, month, contractDay)` → window `[day of THIS month → day of
  NEXT month)`. A company signed on the 20th gets a **20→20** window.
  `contractDay` comes from `Company.contractStartDate` (`contractDayOf`). Null/day‑1
  → the plain calendar month (back‑compatible default).
- Tasks stay tagged with the **bucket** month the cycle STARTS in, even when
  publishDates spill into the next calendar month.
- `cycleWeekOf` sets `week` (1..4) within the cycle.
- **Packing window extended**: `packingWindowDays(year, month, until)` reaches the
  furthest readyDate/publishDate so cross‑month work still lands on real workdays
  (the old fixed 33‑day `periodDays` window would force overflow).
- **Calendar grids extend**: `monthGridDays(year, month, until?)` + `Calendar`
  stretch the monthly view to show the spill‑over days.
- Seeded examples: جدارات `2026‑05‑15`, المول الصيني `2026‑06‑20`.

### Multi‑photographer 🆕
Reels route to the company's assigned photographer:
`photographerOf(c) = c.photographerId ?? firstPhotographer`. Reel companies are
**grouped by photographer**, and `buildPhotoSessions` runs **once per
photographer** on that person's own working days (sessions/reelDates merged). A
single‑photographer setup is unchanged. The photographer engine itself stays
calendar‑month‑bound (week‑4 shoot cap, prior‑month photoshoot) — safe because its
cap only ever pulls a shoot *earlier* (§13).

### Distribution
Each company's items spread evenly across its **cycle window** (all 7 days usable).
Feed items (POST/REEL/AI_REEL) interleaved and placed **≥1 day apart**; stories may
share a day. Companies staggered by an offset. Helpers: `interleaveTypes`,
`placeAvoidingAdjacent`, `placeUnique`.

Wrapped by **`generateSchedule`** (server action, §8) which expands it into the
pipeline and persists.

---

## 6. Workload model — PLAN‑DRIVEN BURNDOWN  (`lib/workload.ts`)

Workload is the month's **committed load** from **company plans + ownership**, shown
as a capacity‑planning **burndown**. `computeWorkload(...)` returns per person:
- **committedDays** (plan + ad‑hoc, stable), **doneDays**, **remainingDays**,
  **freeDays** = capacity − remaining, **pct** (committed÷capacity), **donePct**.

Rules:
- **Completion never lowers committed** (moves from remaining into done). Ad‑hoc
  adds to the current month only.
- **Writer (نوال)**: managed companies with a plan × 2 days.
- **Designer**: Σ owned `posts/6 + stories/6 + aiReels/1`.
- **Photographer**: Σ reels of the companies **assigned to THIS photographer** ÷
  rate 🆕 (was: all reels — fixed for the multi‑photographer split).
- **Publisher (عمر)**: on duty **every day** with publishing (capacity = all period
  days); load = one duty‑day per publishing day, `max(1, companies/5)`.

Shown on **`/workload`** only (the home page now shows achievement instead, §10).

---

## 7. Finance — profit / loss per contract 🆕  (`lib/finance.ts`, `/finance`)

`computeFinance(employees, companies, year, month)` — monthly, plan‑driven,
independent of task completion. Currency is **$**.
- **Revenue** = Σ `company.contractValue`.
- **Cost** = fixed salaries (Σ `employee.salary`) + variable per‑reel costs
  (freelance photographer: `costPerReel × reels` of the companies he shoots).
- **Per‑contract cost = activity‑based**: each salaried employee's salary is spread
  across the companies they work for, **proportional to the work‑days each company
  consumes from them** (designers by owned items, photographer by reels, writer 2
  days/company, publisher by item share). So per‑contract profits roll up to the
  overall profit — minus **overhead** (salaries no contract consumes, e.g. the team
  lead) which is shown as a separate line and subtracted from net profit.
- **Per‑contract P&L**: `revenue − allocated cost = profit`, with margin %.
- **Break‑even** = `ceil(fixedSalaries ÷ avgContribution)` where
  `contribution = revenue − variableCost` — the **min contracts to cover wages**,
  with an above/below indicator.
- **Team capacity** = how many contracts the production roles can carry; the
  **bottleneck** role (`min` over employees of `numContracts × capacityDays ÷
  usedDays`) caps it; surfaces "fits N more contracts".

Inputs are entered in `/companies` (قيمة العقد الشهرية) and `/team` (الراتب الشهري
+ تكلفة الريل الواحد for photographers). Page sections: KPIs (revenue / cost / net /
margin), ربح‑خسارة لكل عقد (table), نقطة التعادل, سعة الفريق (per‑producer bars).
Empty state until any value is entered.

---

## 8. Server actions  (`src/server/actions/**`)

- **schedule.ts** — `generateSchedule(year,month)`: builds the full pipeline from
  plans (over each company's cycle), applies achievements (`JUNE_2026_DONE`),
  **preserves manual edits**: board/status for all cards (by `pipelineKey|stage`),
  and for **pinned** cards their `title/workDate/readyDate/assigneeId/priority` —
  so **إعادة الجدولة never throws away an edit**. Keeps ad‑hoc (isAuto=false).
  `clearMonthSchedule`.
- **tasks.ts** — `createTask` (ad‑hoc, work‑days), `updateTaskStatus`,
  `moveCard(id,board)` (stamps start/finish), `reassignTask` (pins),
  `updatePhotoSessionStatus`, **`updateTaskDetails(ids, fields)`** (the card تعديل —
  ALWAYS pins so edits survive regenerate), **`deleteTasks(ids)`** (the card حذف —
  no regenerate).
- **companies.ts** — company CRUD; persists `contractValue`, `contractStartDate`
  (local‑midnight), `photographerId`. Revalidates `/finance`.
- **employees.ts** — employee CRUD; persists `salary`, `costPerReel`, rates JSON
  (`buildRates`, `planDays → PLAN=1/planDays`). Revalidates `/finance`.

`lib/schemas.ts` = Zod (employee w/ salary+costPerReel, task w/ days+workDate,
company w/ contractValue+contractStartDate+photographerId).

---

## 9. Seed & scripts — NON‑DESTRUCTIVE  (`prisma/seed.ts`)

**A deploy must never wipe live data.** By default the seed:
- **Seeds a month only when it is EMPTY**; never deletes existing tasks.
- **Creates** missing employees/companies but does **not** overwrite existing ones
  (`update: force ? payload : {}`). A full destructive rebuild requires
  **`SEED_FORCE=1`**.

`prisma/seed-data.json` (July 2026 dataset) carries per‑company colors **and
`contractStartDate`** (جدارات/المول). `prisma/actuals-june.json` (June actuals).
Scripts: `regen-july.ts`, `fix-shoot-days.mjs`, `fix-noor-tuesday.mjs`,
`distribute-hla-june.mjs`.

### Team (current)
| id | name | role | hoursPerDay | workDays | scheduled |
|---|---|---|---|---|---|
| e_ayman | أيمن | designer | 6 | Sun→Thu `[0,1,2,3,4]` | yes |
| e_sabin | سابين | designer | 6 | Sat→Wed `[6,0,1,2,3]` | yes |
| e_hla | حلا | lead + half‑designer | **3** | Sat→Wed | yes |
| e_nawal | نوال | writer | 6 | Sat→Wed | no |
| e_omar | عمر | publisher | 6 | Sat→Wed | no |
| e_photo | المصور (renamed by user, e.g. غسان‑مايك) | photographer | 6 | Sat→Wed | no, isPhotographer |

> Multiple photographers are supported (e.g. a salaried one + a per‑reel
> freelancer); assign each company's reels via `Company.photographerId`.

### Companies (plan post/reel/story/aiReel · owners · color)
BW 4/4/8/0 (Ayman) · Phoenitech 4/4/8/0 (Sabin) · مخبر د.نور 6/6/8/0 (Sabin) ·
برو 6/8/12/0 (post Sabin, story Ayman) · المول الصيني 10/3/15/0 (Ayman, **cycle
20→20**) · جدارات 6/0/12/6 (post/story Sabin, ai‑reel Ayman, **cycle 15→15**) ·
التدريب 7/0/0/0 (Ayman). Design‑only/unmanaged: المدارس, كابرياني (defaultOwner
Hla, ad‑hoc only). Contract values/salaries start at 0 until entered (§7).

---

## 10. Screens (routes)  — `src/app/**`

| Route | Shows |
|---|---|
| `/` 🆕 | KPIs (managed cos / monthly posts / designers / open URGENT) · **المهام الحرجة** (overdue or due ≤2 working days) · **إنجاز الفريق** (per‑person donuts: done/total/remaining, counts ALL assigned tasks so عمر shows too) · **مهام اليوم** (per‑person **tabs**, board‑matched labels with counts/numbers) · **إنجاز الشركات** (PUBLISHED ÷ plan over the cycle) · **إعادة الجدولة** |
| `/tasks` 🆕 | **Kanban board** (default) + calendar (day/week/month). Owner is **read‑only** on cards (change via تعديل); board cards show start/end/duration + priority + lateness **pills**. Calendar **excludes REEL & PUBLISH** (production view, all on workdays). Every card has تعديل ✏️ + حذف 🗑️. **مهمة إضافية** create |
| `/publishing` | Publishing **calendar** by `publishDate` (grid extends for cycle spill‑over), filters, numbered chips, no‑interruption banner |
| `/workload` | Whole‑team **burndown** cards |
| `/reports` 🆕 | KPIs · إنجاز خطة الشركات (PUBLISHED‑only %) · **per‑person ledger** (every task batched: start→end · actual duration · lateness · done/total by name) · CSV/print |
| `/finance` 🆕 | **Profit/loss per contract**, break‑even, team capacity (§7) |
| `/companies` 🆕 | CRUD + plan + owners + color + **contract value** + **contract start date** + **photographer** |
| `/team` 🆕 | CRUD + rates (designers items/day; **photographer "X reels every Y days"**) + workdays + **salary** + **per‑reel cost** |
| `/priorities` | company priority ordering |

Reusable UI: `components/calendar/{Calendar,SideDrawer}`, `KanbanBoard`, `MonthBar`,
`ReportActions`, `Sidebar` (now includes **المالية**), `components/forms/{Task,
Member,Company}Form`, and 🆕 `components/ui/Donut.tsx` (completion donut) +
`components/ui/pills.tsx` (`Pill`, `PriorityPill`, `LatePill` — shared by the board,
calendar, home, reports). Month resolution in `lib/month.ts`.

---

## 11. Design system  (`globals.css`, `tailwind.config.ts`, `lib/utils.ts`)

- **Light theme** (Vuexy‑style). Tokens in BOTH `tailwind.config.ts` and
  `globals.css` (:root vars) — **keep in sync**.
- **accent (aqua) `#0a8fa3`**; success `#1e9e68`, warning `#c77e1b`, danger
  `#d6453b`, info `#2d72c8`. Radius tightened (DEFAULT 6).
- Distinct per‑company colors; STORY darkened to `#b07a0e`.
- Contrast helpers in `lib/utils.ts`: `readableOn(bg)`, `withAlpha(hex,a)`.
- Toast viewport width capped (`w-[min(24rem,calc(100vw-3rem))]`) — no mobile
  horizontal overflow.

---

## 12. Business rules (authoritative, user‑confirmed)

- **Work days**: everyone off Thu+Fri (Sat→Wed) EXCEPT Ayman off Sat (Sun→Thu).
  Photographer Sat→Wed. مخبر د.نور reels shoot Tuesday.
- **Contract cycles** 🆕: a company with a `contractStartDate` runs its monthly plan
  over a 30‑day day→day cycle (e.g. 20→20), bucketed by the start month. Null =
  calendar month.
- **Multiple photographers** 🆕: assign each company's reels via `photographerId`;
  reels and shoot sessions split per photographer on their own workdays.
- **Publishing**: all 7 days; spread across the cycle; no same/consecutive‑day feed
  per company; Omar publishes every publishing day.
- **Rates** (items/day): 6 post · 6 story · 1 ai‑reel; photographer 2 reels/3 days;
  Nawal 2 days/company; Omar 4–5 companies/day.
- **Workload = committed monthly load** (burndown). Completion doesn't lower it.
- **Ad‑hoc effort is in work‑days**; the create dialog's **"قفل يدوي"** checkbox
  pins the task to its chosen date (else the engine auto‑places it).
- **A manual card edit is always pinned** and survives **إعادة الجدولة**.
- **Achievement = PUBLISHED only** — a plan item counts for a company **only when
  its PUBLISH stage is DONE** (not when designed/shot). Used by `/reports` plan %
  and `/` إنجاز الشركات.
- **Finance** 🆕: revenue = contract values; cost = salaries (fixed) + per‑reel
  (variable); per‑contract cost allocated by work‑days; break‑even on fixed salaries
  ÷ avg contribution.
- **"مهمة مستعجلة" was renamed to "مهمة إضافية"** (priority is chosen per task).
- **Regenerate** rebuilds the month's pipeline from plans, preserves pinned edits +
  manual board moves + statuses, keeps ad‑hoc; does **not** touch
  company/employee/finance records. Deterministic.

---

## 13. Known limitations / TODO

- Auto‑generate on month‑open is intentionally NOT done; use **إعادة الجدولة**.
- Reported achievements are hard‑coded for June 2026 (`JUNE_2026_DONE`); other months
  start empty.
- The **photographer engine is still calendar‑month‑bound** (week‑4 shoot cap,
  prior‑month photoshoot). Safe today because its cap only pulls shoots earlier and
  the one cycle‑reel company batches its reels; revisit if a reel‑heavy company gets
  a late contract day.
- `/reports` "actual duration" is "—" until a task is moved through the board (no
  start/finish stamp yet).
- Editing the name of a *batched* card sets the title on its primary only.
- Two Prisma schema files kept in sync manually.
- Clear stale `.next/types` tsc errors with `rm -rf .next` while the dev server is
  **stopped** (wiping `.next` under a running dev server corrupts it).

---

## 14. Conventions for the next session

- Work on `feature/social-publishing-schedule`; `main` is fast‑forwarded to it
  (Vercel auto‑deploys `main`).
- After data/engine changes: `npm run typecheck && npm test && npx next build`
  (stop the dev server before `next build`), verify in preview, then commit + push.
  **Stop the dev server before `prisma generate`** (it locks the query‑engine DLL on
  Windows).
- Commit messages end with the Co‑Authored‑By trailer. Don't commit
  `.claude/worktrees/` or feature‑bump the local Claude settings into feature work.
- Dates are LOCAL midnight (`toISODate` reads local Y/M/D); months are **0‑based**.
- **Never reintroduce destructive seed behavior** (§9). **Never gate
  edit‑persistence on a checkbox** — manual edits must always pin (§8).
