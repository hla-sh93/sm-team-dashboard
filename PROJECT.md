# sm-team-dashboard — Project Handoff / Full Documentation

A social‑media team management, scheduling **and finance** dashboard (Arabic,
**RTL**, light theme, aqua primary). It runs a digital‑marketing team that serves
multiple client companies through the full content lifecycle —
**planning → writing → design/shoot → publishing** — with per‑person capacity
planning, a Kanban workflow, a publishing calendar, editable per‑piece task
cards, achievement + delay reports, and a profit/loss view per contract.

> Single source of context for a new session. The original spec is
> `SOCIAL_SCHEDULER_SPEC.md`; many rules below override it — **this file wins on
> conflict.** Reflects the code on branch `main` (production) after the access
> split, per‑piece cards, 6/8 capacity, no‑Friday publishing, preferred shoot
> day, strict unfinished-only lateness, production+publish company progress, and
> daily-board task filtering.

---

## 1. Tech stack & how to run

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind**. RTL, Tajawal font.
- **Prisma** ORM. **SQLite locally**, **Postgres (Neon) in production**.
- **Vitest** tests (**85**). Enums stored as **String**; `Int[]` (workDays) as JSON.

### Two Prisma schemas (keep models in sync!)
- `prisma/schema.prisma` — SQLite (local). `prisma/schema.postgres.prisma` —
  Postgres (Vercel, via `--schema`).

### Commands
```bash
npm run dev          # local dev (SQLite)
npm test             # vitest (85)
npm run typecheck    # tsc --noEmit
npm run db:push      # prisma db push (SQLite)
npm run db:seed      # tsx prisma/seed.ts  (NON-destructive — §9)
```
Stop the dev server before `next build` AND before `prisma generate`/`db push`
(Windows locks the query‑engine DLL). DB backups live in `backups/`.

### Deploy
- Git remote **GitLab** (`gitlab.com/hla2.sh93/socialmediateam`). **Vercel
  auto‑deploys `main`** (production) on push; non‑main branches get **preview**
  deployments. DB: **Neon Postgres**; env var must be `DATABASE_URL`.
- Build runs `prisma db push --accept-data-loss` (additive columns are safe) +
  non‑destructive seed + `next build`. After deploy, click **إعادة الجدولة** per
  month to (re)build the pipeline with the latest rules.
- Local and production databases are separate. To apply the current targeted
  June data fixes to either one, set `DATABASE_URL` to that target and run
  `tsx scripts/sync-june-current-fixes.ts`. The production Neon URL must never be
  committed; paste it only in the shell/session that runs the sync.

---

## 2. Access model 🆕 — employees vs admin, by URL (NO login)

Same app, same data — the **URL** decides what you see. No authentication.
- **Employees → root URLs** (`/`, `/tasks`, `/publishing`, `/reports`): the
  shared pages, with **FULL functionality** (add/edit/delete tasks, regenerate,
  status moves). Sidebar shows only those four.
- **Admin → `/admin/*`** (base = `ADMIN_BASE` in `components/Sidebar.tsx`): sees
  everything — the shared pages PLUS the sensitive routes **finance, companies,
  team, workload, priorities**.
- Admin‑only routes physically live only under `/admin` → an employee hitting
  `/finance`, `/team`, etc. gets a **404** (salaries/contracts are unreachable).
- Shared pages render from one place (`OverviewView`, `tasks/TasksView`,
  re‑exported publishing/reports) so `/x` and `/admin/x` are identical. The
  Sidebar is path‑aware (`pathname.startsWith(ADMIN_BASE)`). Server actions
  `revalidatePath('/', 'layout')` so both areas refresh after a mutation.
- **Only the `/admin` URL protects the sensitive data** — keep it private (it can
  be renamed to an obscure path by renaming `src/app/admin` + `ADMIN_BASE`).

---

## 3. Data model (Prisma)

### Employee
`id, name, role (free‑text Arabic), hoursPerDay (Hla=3, rest 6), workDays (JSON
int[] of getDay()), isScheduled, isPhotographer, salary (monthly $), costPerReel
(per‑reel $ for a freelance photographer; null=salaried), color, rates (JSON
items/day), …` + ownership relations postOwner/storyOwner/aiReelOwner/
defaultOwner/**photographer**.

### Company
`id, name (unique), managed, posts, reels, stories, aiReels (monthly plan),
contractValue (monthly $), contractStartDate (drives the 30‑day cycle),
preferredShootDay (getDay 0..6, soft, nullable), color, priority, status,
postOwnerId, storyOwnerId, aiReelOwnerId, defaultOwnerId, photographerId,
tasks[], photoSessions[]`

### Task (central entity = kanban card; one card per content PIECE)
`id, kind, type, title, hours, quantity, priority, status, publishDate, readyDate,
workDate, week, overflow, month (0‑based), year, isPinned, isAuto, stage, board,
blockedById, pipelineKey, detKey, notes, completedAt, startedAt, finishedAt,
companyId, assigneeId`
- **kind** `CONTENT|ADHOC|PHOTOSHOOT|REPORT|CONTENT_WRITING|PUBLISH` · **type**
  `POST|REEL|AI_REEL|STORY|null` · **priority** `NORMAL|IMPORTANT|URGENT` ·
  **status** `NOT_STARTED|IN_PROGRESS|AWAITING_APPROVAL|READY|PUBLISHED` ·
  **stage** `WRITE|DESIGN|SHOOT|PUBLISH` · **board** `TODO|DOING|REVIEW|DONE`.
- **workDate** = start day · **readyDate** = deadline/end · **pipelineKey** groups
  one piece's stages (`companyId|type|publishDate`). **isPinned** = manual edit,
  preserved across regenerate. Content cards store `hours=0` (rate‑based).

### PhotoSession
`no (1=photoshoot), kind (PHOTOSHOOT|REELS), shootDate, deliverBy, reelCount,
status, month, year, companyId, …`

### Setting
`key, value (JSON)` — seed hashes.

---

## 4. Pipeline / workflow + card display

Each content item flows: **كتابة (نوال) → تصميم/تصوير (مصمم/مصور) → نشر (عمر)**.
Each stage is a card on one person's board; downstream cards are soft‑locked
(«بانتظار…») until `blockedById` is DONE.

**One numbered card per piece 🆕 (`lib/cards.ts`).** Posts/stories are **NOT
batched** — every piece is its own numbered card (`بوست-1`, `ستوري-2`, `ريل-1`,
`ريل AI-3`), like reels. Writing stays **one card per company** (Nawal writes the
whole batch). The **same number = the same piece** across design → publish →
publishing calendar, so a piece is traceable end‑to‑end and the publisher marks
each one published on its own day.
- `buildContentNumbers` numbers per `(company,type)` by publish order (shared
  across a piece's stages via pipelineKey). `cardLabelFor` → `بوست-N` / `جدولة
  بوست-N` (feed) / `نشر ريل-N` (reels). `groupTasksIntoCards` = one card per task.

---

## 5. Capacity / productivity (`lib/capacity.ts`, `lib/constants.ts`)

Designer day = **6h** → **6 posts/day OR 8 stories/day OR 1 AI‑reel/day** (mixes
allowed up to 6h). Hla (3h) → half. The two models are kept aligned:
- `TYPE_HOURS` (schedule packing): POST 1h, STORY 0.75h, AI_REEL 6h, REEL 0
  (photographer).
- `DEFAULT_RATES` (workload, items/day): POST 6, STORY 8, AI_REEL 1, REEL 2/3
  (2 reels per 3 days), PLAN 0.5 (=2 days/company). Per‑employee overrides in
  `Employee.rates`.
- **Ad‑hoc effort is in WORK DAYS** (`hours = days × 6`); normalized by the fixed
  6 so a work‑day = one calendar working day for everyone.

---

## 6. Scheduling engine (`lib/scheduler.ts`, `lib/photographer.ts`)

`buildSchedule(state)` is **pure & deterministic** (no DB, no `Date.now()`).

### Contract cycles (`lib/dates.ts`)
Each company distributes its plan over its **contract cycle**:
`companyCycle(year, month, contractDay)` = `[day of THIS month → day of NEXT
month)` (e.g. signed on the 20th → a **20→20** window). `contractStartDate` null
→ the calendar month. Tasks stay tagged with the cycle's **start** month even
when dates spill into the next calendar month. `packingWindowDays` extends the
employee packing canvas to the furthest deadline; `monthGridDays(…, until)`
extends calendar grids to show the spill‑over. Seeded: جدارات 15→15, المول 20→20.

### Publishing distribution
- **NO publishing on Friday** 🆕 — each company's cycle days are filtered to
  exclude Fridays; everything spreads over the remaining days (Thursday allowed).
- Feed (POST/REEL/AI_REEL): interleaved by type, placed **≥1 day apart** per
  company (no same/consecutive day). Stories: even spread, **one/day** per
  company, **may share a feed day**. Companies staggered by an offset.
- **No‑interruption**: each managed company gets ≥1 publish in each of 4 weeks.
  **Plan‑match**: scheduled per‑type counts == plan exactly.

### Photographer (multi‑photographer + preferred day)
- Reels route to the **company's photographer** (`photographerId` → first
  photographer). Reel companies are grouped **per photographer**, and
  `buildPhotoSessions` runs on **that photographer's** workdays — splitting the
  shoot load. Workload counts each photographer's **own** companies only.
- Per company: photoshoot (session 1) + reel batches of 2–3. `shoot ≈
  backWorkday(earliestPublish − 3)`, `deliver ≤ shoot+3` and `< publish`; no
  Thu/Fri shooting; no week‑4 shooting (week computed on the **calendar month** —
  a known limitation for cycle companies, §13).
- **Preferred shoot day (soft) 🆕**: `Company.preferredShootDay` nudges the shoot
  back to that weekday when possible (earlier only → safe); not mandatory; any
  shoot is editable manually.

Wrapped by **`generateSchedule`** (server action) which expands the pipeline and
persists, preserving board/status + pinned edits + ad‑hoc.

### 6.1 Task Deletion Rules
- **Manual/Ad-hoc Tasks (`isAuto: false`)**: Deleted permanently from the database.
- **Auto-generated Tasks (`isAuto: true`)**: Soft-deleted (set to `status: "CANCELED"`, pinned). This hides them from the current month's cycle but preserves the underlying company plan, ensuring they regenerate fresh in the following month.

---

## 7. Workload — plan‑driven burndown (`lib/workload.ts`)

Per person: **committed / done / remaining / free** days (+ pct, type breakdown).
Plan‑driven (so correct even before a regenerate); **completion never lowers
committed**. Writer = managed companies with a plan × 2 days. Designer = Σ owned
posts/6 + stories/8 + aiReels/1. Photographer = Σ **assigned** companies' reels ÷
rate. **Publisher (عمر)** = one duty‑day per publishing day (≤5 companies/day);
**capacity = all period days EXCEPT Friday** 🆕. Shown on `/workload` (admin).

---

## 8. Finance — P&L per contract (`lib/finance.ts`, `/admin/finance`)

Monthly, plan‑driven, currency `$`. Revenue = Σ `contractValue`. Cost = fixed
salaries + variable per‑reel costs (freelance photographer = `costPerReel ×
reels`). Each salary is **activity‑based allocated** to companies by the work‑days
each consumes; idle/unallocated salary = **overhead** (subtracted from net).
Sections: KPIs (revenue/cost/net/margin), per‑contract P&L, **break‑even** (fixed
÷ avg contribution), **team capacity** (bottleneck role + how many more contracts
fit). Empty‑state until values are entered (companies → contract value; team →
salary + per‑reel cost).

---

## 9. Server actions & seed

- **schedule.ts** `generateSchedule(year,month)`: rebuild pipeline from plans over
  each cycle; apply June achievements; **preserve** board/status (by
  pipelineKey+stage) + pinned title/dates/owner/priority + ad‑hoc. Deterministic.
- **tasks.ts** create/`updateTaskStatus`/`moveCard`/`updateTaskDetails` (always
  pins) / `deleteTasks`. **companies.ts** / **employees.ts** CRUD (persist the new
  finance + cycle + photographer + preferredShootDay fields). All revalidate the
  whole tree.
- **scripts/sync-june-current-fixes.ts**: idempotent targeted June 2026 data
  reconciliation for the currently reported reality. It reopens Nawal's unfinished
  writing cards, reopens the remaining Phoenitech reel production pieces, adds the
  late-June manual tasks, and records Alber's completed University/Tishreen and
  National College shoots with historical completion dates. `DATABASE_URL`
  chooses local SQLite vs production Postgres.
- **Seed is NON‑destructive** (`prisma/seed.ts`): seeds a month only when empty;
  upserts employees/companies without overwriting edits (full rebuild =
  `SEED_FORCE=1`). Includes a **safe idempotent rate correction** (designers
  STORY 6→8 only if still on the old value) so production picks up the new
  capacity on deploy. `seed-data.json` carries colors + contract dates.

### Seed team / companies
6 employees: أيمن (Sun→Thu), سابين, حلا (lead, 3h), نوال (writer), عمر
(publisher), المصور (photographer — may be renamed / a 2nd photographer added).
Managed companies with plans + owners + colors (BW, Phoenitech, مخبر د.نور, برو,
المول الصيني 20→20, جدارات 15→15, التدريب); design‑only: المدارس, كابرياني.
Finance values/salaries and any companies you add live in the DB.

---

## 10. Screens (routes) — `src/app/**`

Root = employee area; `/admin/*` = admin area (same shared pages + the rest).

| Route (employee `/` · admin `/admin/…`) | Shows |
|---|---|
| `/` , `/admin` | KPIs · **المهام الحرجة** (only not-done tasks overdue or due ≤2 working days, days‑late) · **إنجاز الفريق** (per‑person donuts: done/total/remaining, counts all assigned) · **مهام اليوم** = a **tab per employee** (always all of them), each showing tasks / **عطلة** / **متفرّغ لعمل إضافي** · **إنجاز الشركات** (production done + publish done ÷ plan over the cycle) · إعادة الجدولة |
| `/tasks` | Kanban board (default) + **daily view using the same KanbanBoard filtered to today only** + weekly/monthly production calendars. One numbered card per piece; full add/edit/delete; status/board moves. Weekly/monthly calendar excludes REEL & PUBLISH (production view, on workdays). Late badge shows **N days** only for unfinished overdue cards. |
| `/publishing` | Publishing calendar by publishDate (no Fridays); numbered chips; no‑interruption banner |
| `/admin/workload` | Whole‑team burndown |
| `/reports`, `/admin/reports` | KPIs · إنجاز خطة الشركات (production done + publish done) · **تشخيص التأخيرات** (unfinished overdue grouped by stage + by person, with days) · per‑person ledger (every task: start→end · actual duration · lateness days) · CSV |
| `/admin/finance` | P&L per contract, break‑even, team capacity |
| `/admin/companies` | CRUD + plan + owners + color + contract value + contract date + photographer + **preferred shoot day** |
| `/admin/team` | CRUD + rates (designers items/day; photographer “X reels every Y days”) + workdays + salary + per‑reel cost |
| `/admin/priorities` | company priority ordering |

Shared UI: `Sidebar` (path‑aware), `MonthBar`, `calendar/*`, `KanbanBoard`,
`components/ui/{Donut,pills}` (`Pill`/`PriorityPill`/`LatePill`/`daysLateOf`),
forms `{Task,Member,Company}Form`.

---

## 11. Business rules (authoritative)

- **Access**: employees on root (full task CRUD); admin on `/admin` (everything
  incl. finance/team/companies/workload/priorities); admin routes 404 for
  employees. No login — keep `/admin` private.
- **Work days**: off Thu+Fri (Sat→Wed) except Ayman off Sat (Sun→Thu).
- **Publishing**: per contract cycle; **NO Friday publishing** (Thu OK); feed ≥1
  day apart; stories one/day (may share a feed day); no week is empty.
- **Contract cycle**: a `contractStartDate` makes the plan run day→day (e.g.
  20→20); else calendar month.
- **Capacity**: designer 6 posts/day OR 8 stories/day OR 1 AI‑reel/day (Hla half);
  photographer 2 reels/3 days; writer 2 days/company; publisher 4–5 companies/day.
- **Cards**: one numbered card per piece (no batching); writing per company.
- **Multiple photographers**: assign reels per company; optional **soft preferred
  shoot day** per company (editable).
- **Company achievement = production DONE + publish DONE**. A reel/photoshoot or
  design piece does not count toward company progress just because the publish
  card is done; both the production stage and the publish stage for the same
  `pipelineKey` must be done.
- **Lateness = unfinished + deadline before today**. Done states are `READY`,
  `PUBLISHED`, `DELIVERED`, `board=DONE`, `completedAt`, or `finishedAt`.
  Completed historical June tasks keep their real task date as completion date,
  not the date they were entered into the system. The scheduler does NOT auto‑move
  late work — handle manually (edit date / mark done) or via a future recovery
  action.
- **Daily task view** on `/tasks` is the same Kanban board as the main board, but
  filtered to tasks whose `workDate`, `readyDate`, or `publishDate` is today.
- **Finance**: revenue = contract values; cost = salaries (fixed) + per‑reel
  (variable); per‑contract cost allocated by work‑days; break‑even on fixed ÷ avg
  contribution.
- A manual card edit is always pinned and survives إعادة الجدولة.

---

## 12. Known limitations / TODO

- No login — the obscure `/admin` URL is the only gate for sensitive data.
- Photographer “week 4 no‑shoot” is computed on the **calendar month**, not the
  contract cycle (safe — only pulls shoots earlier). Preferred shoot day is soft.
- Late tasks are flagged/diagnosed but **not auto‑rescheduled** — a separate
  “معالجة المتأخرات” recovery action (re‑pack overdue forward with overtime) is a
  planned, deliberate step kept out of the deterministic regenerate.
- `/reports` actual duration is “—” until a task is moved through the board.
- June achievements hard‑coded (`JUNE_2026_DONE`); other months start empty.
- Two Prisma schema files kept in sync manually.

---

## 13. Conventions for the next session

- `main` is production (Vercel auto‑deploys). Use preview branches to test before
  merging to `main`. After data/engine changes: `npm run typecheck && npm test &&
  npx next build` (dev stopped), verify in preview, then commit + push.
- Stop the dev server before `prisma generate`/`db push`/`next build` (Windows
  locks). Commit messages end with the Co‑Authored‑By trailer; don't commit
  `.claude/` settings into feature work.
- Dates are LOCAL midnight; months are **0‑based**. Never reintroduce destructive
  seed behavior; never gate edit‑persistence on a checkbox (manual edits pin).
