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
> split, per‑piece cards, 8h/10-item capacity, no‑Friday publishing, preferred shoot
> day, strict unfinished-only lateness, publish-card company progress,
> daily-board task filtering, and the 2026‑07 audit fixes: regen preserves work
> history + photo-session status, ad-hoc of every priority is packed, day→day
> contiguous contract cycles, dynamic open-work carryover across months, and
> per-cycle card numbering with a carryover badge.

---

## 1. Tech stack & how to run

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind**. RTL, Tajawal font.
- **Prisma** ORM. **SQLite locally**, **Postgres (Neon) in production**.
- **Vitest** tests (**452** across 40 files at the 2026-08-26 QA baseline). Enums
  are stored as **String**; `Int[]` (workDays) as JSON.
- Two suites go beyond fixtures: **`tests/data-integrity.test.ts`** audits the REAL
  database read-only (orphan refs, duplicate detKeys, cycle sanity, piece
  numbering, impossible timestamps) — a failure there is a DATA problem to fix
  with a script, not a code bug. **`tests/operations-e2e.test.ts`** drives the
  real server actions (company CRUD, generate, pin, delete, renew, end, archive)
  against a scratch COPY of `dev.db`; it mocks `@/lib/db`, `next/cache` and
  `@/lib/auth` and never touches `process.env`, so it cannot leak into the real DB.

### Two Prisma schemas (keep models in sync!)
- `prisma/schema.prisma` — SQLite (local). `prisma/schema.postgres.prisma` —
  Postgres (Vercel, via `--schema`).

### Commands
```bash
npm run dev          # local dev (SQLite)
npm test             # vitest (452 at the QA baseline)
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
- Schema deployment is an explicit operator step (`npm run db:deploy:schema`),
  while `npm run build` only generates the Postgres client and compiles Next.js.
  Data repair/import/seed scripts are never build side effects. After deploy,
  click **إعادة الجدولة** per
  month to (re)build the pipeline with the latest rules.
- Local and production databases are separate. To apply the current targeted
  June data fixes to either one, set `DATABASE_URL` to that target and run
  `tsx scripts/sync-june-current-fixes.ts`. The production Neon URL must never be
  committed; paste it only in the shell/session that runs the sync.

---

## 2. Access model 🆕 — employees (open) vs admin (password-protected)

Same app, same data. The employee area is open; the admin area is behind a
password login (`src/lib/auth.ts`).
- **Employees → root URLs** (`/`, `/tasks`, `/publishing`, `/reports`): the
  shared pages, with **FULL functionality** (add/edit/delete tasks, regenerate,
  status moves). Sidebar shows only those four. No login.
- **Admin → `/admin/*`** (base = `ADMIN_BASE`): the shared pages PLUS the
  sensitive routes **finance, companies, team, workload, priorities**. Requires
  an admin session.
- Admin‑only routes physically live only under `/admin` → an employee hitting
  `/finance`, `/team`, etc. gets a **404** (salaries/contracts are unreachable).
- Shared pages render from one place (`OverviewView`, `tasks/TasksView`,
  re‑exported publishing/reports) so `/x` and `/admin/x` are identical.

### Admin authentication (§ lib/auth.ts, server actions/auth.ts)
Layered enforcement — admin pages/actions can't be reached or invoked without a
valid session, and direct-URL access is blocked:
1. **`middleware.ts`** (edge) redirects any `/admin/*` request lacking the
   session cookie to `/login` (cheap presence check).
2. **`app/admin/layout.tsx`** calls `requireAdminPage()` → real HMAC signature
   check on every admin render; a forged/expired cookie renders NO admin markup
   (server redirect before any data is computed).
3. Sensitive server actions (`companies.*`, `employees.*`, `changePassword`)
   call **`assertAdmin()`** so mutations can't run without a session even if
   POSTed directly.
- **Password/secret storage**: never hardcoded, never sent to the client.
  Password is scrypt-hashed (`salt:hash`); session cookie is `exp.HMAC`
  (HttpOnly, Secure, SameSite=Lax). Both live in the DB `Setting` table, or come
  from `ADMIN_PASSWORD` / `AUTH_SECRET` env vars when set (which override the DB).
- **First run has no default credential**: `/login` shows a "create password"
  flow until one is configured — then it's the login form. Logout button in the
  admin sidebar/drawer. Auth settings are preserved across a local→prod snapshot
  import so a re-sync never resets the admin login.
- The `/admin` base can still be renamed to an obscure path (rename
  `src/app/admin` + `ADMIN_BASE` + the middleware matcher) for defence in depth.

---

## 3. Data model (Prisma)

### Employee
`id, name, role (free‑text Arabic), hoursPerDay (default 8), workDays (JSON
int[] of getDay()), isScheduled, isPhotographer, salary (monthly $), costPerReel
(per‑reel $ for a freelance photographer; null=salaried), color, rates (JSON
items/day), …` + ownership relations postOwner/storyOwner/aiReelOwner/
defaultOwner/**photographer**.

### Company
`id, name (unique), managed, posts, reels, stories, aiReels (monthly plan),
contractValue (monthly $), contractStartDate (drives the 30‑day cycle),
**renewals** (JSON ISO dates — every cycle start AFTER the first),
**contractEndedAt** ("not renewed" cutoff), preferredShootDay (getDay 0..6, soft,
nullable), color, priority, status, postOwnerId, storyOwnerId, aiReelOwnerId,
defaultOwnerId, photographerId, tasks[], photoSessions[]`

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

Each content item usually flows: **كتابة (نوال) → تصميم/تصوير (مصمم/مصور) → نشر (عمر)**.
Each stage is a card on one person's board; downstream cards are soft‑locked
(«بانتظار…») until `blockedById` is DONE.
Exception: **التدريب** is managed for planning/publishing/progress, but its
content is supplied by the trainer according to monthly courses. It skips Nawal's
WRITE card and starts directly at design → publish.

**One numbered card per piece 🆕 (`lib/cards.ts`).** Posts/stories are **NOT
batched** — every piece is its own numbered card (`بوست-1`, `ستوري-2`, `ريل-1`,
`ريل AI-3`), like reels. Writing stays **one card per company** (Nawal writes the
whole batch). The **same number = the same piece** across design → publish →
publishing calendar, so a piece is traceable end‑to‑end and the publisher marks
each one published on its own day.
- **Piece numbers are STORED (`Task.pieceNo`)**, assigned once at generation in
  `expandPipeline` per (company,type) by publish order within the cycle, shared
  by a piece's design + publish cards. A piece keeps its number for life: the
  June cycle's ستوري-6 stays 6 in every view even when its 5 published siblings
  are archived out of the loaded set. Numbering restarts at 1 every cycle
  (a 6-piece plan always reads 1..6, never 7..12). `buildContentNumbers`
  prefers the stored number and falls back to computing per
  (company,type,cycle) for legacy rows; `scripts/backfill-piece-numbers.ts`
  (`db:backfill-numbers[:prod]`) backfills those once, idempotently.
  `cardLabelFor` → `بوست-N` / `جدولة بوست-N` (feed) / `نشر ريل-N` (reels).
  `groupTasksIntoCards` = one card per task.
- **Carryover badge (`CyclePill`)**: a card whose bucket month differs from the
  month being viewed shows «متبقّي من دورة <شهر>» (kanban, critical panel, daily
  queue) — fully dynamic: in August the badge reads تموز/حزيران automatically.

---

## 5. Capacity / productivity (`lib/capacity.ts`, `lib/constants.ts`)

Designer day = **8h** → **10 posts/day OR 10 stories/day OR 1 AI‑reel/day** (mixes
allowed up to 8h). Per-employee rates can override these defaults. The two models are kept aligned:
- `TYPE_HOURS` (schedule packing): POST 0.8h, STORY 0.8h, AI_REEL 8h, REEL 0
  (photographer).
- `DEFAULT_RATES` (workload, items/day): POST 10, STORY 10, AI_REEL 1, REEL 3/2
  (3 reels per 2 days), PLAN 0.5 (=2 days/company). Per‑employee overrides in
  `Employee.rates`.
- **Ad‑hoc effort is in WORK DAYS** (`hours = days × 8`); normalized by the fixed
  8 so a work‑day = one calendar working day for everyone.
- **Carousel posts**: the publish card remains `quantity=1` because it is one
  client-facing post, while the design card's `quantity` is the design-unit /
  slide count. Example: one 5-slide carousel = 1 published post, 5 design units.
  Example: carousel 3 + carousel 4 for the same company = 2 published posts,
  7 design units, and 3 remaining single-post units in a 10-post designer day.

---

## 6. Scheduling engine (`lib/scheduler.ts`, `lib/photographer.ts`)

`buildSchedule(state)` is **pure & deterministic** (no DB, no `Date.now()`).

### Contract renewals — cycles do NOT continue automatically 🆕 (`lib/contract.ts`)
A cycle used to be pure arithmetic on the contract's day-of-month, so every month
bucket produced one forever, as if every contract auto-renewed. Now cycle starts
are an **explicit list** — `[contractStartDate, ...renewals]` — and
`cycleForBucket(co, year, month)` returns **null** when no cycle owns that bucket:
the engine then generates **nothing at all** for that company (no tasks, no
shoots, no writer card) until a renewal is recorded.
- Cycle N runs `[start_N → min(natural day→day end, start_{N+1}))`, so an early
  renewal truncates instead of overlapping. A cycle belongs to the bucket of its
  **start month**.
- **Cold start** = the first cycle, or one beginning after a gap **> 1 day**
  (nobody wrote a plan while the contract sat unrenewed) → the full pipeline lead
  re-applies (كتابة يومان → إنتاج → نشر, per-type publish floors). A contiguous
  renewal is **warm** and behaves exactly like the pre-renewal engine — including
  an ongoing client's prior-month prep. The >1-day tolerance exists because a
  day-31 contract chains 31→30→30 while the old per-bucket formula gave 31→30→31.
- `contractEndedAt` ("لم يُجدد") is a hard stop; recording a renewal later clears
  it and reactivates the company. Companies with **no** `contractStartDate`
  (المدارس, كابرياني) have no contract concept — ungated calendar months forever.
- Recorded from **/admin/companies** (`renewContract` / `endContract`), which
  regenerate the new cycle's month immediately. `contractStateOf` drives the card
  chip: نشط · تنتهي خلال N يوم (≤ `RENEWAL_NOTICE_DAYS` = 3) · بانتظار التجديد ·
  موقوف. `CompanyForm` lists the cycle history read-only.
- Migration: `scripts/backfill-contract-cycles.ts` (`db:backfill-cycles[:prod]`,
  idempotent) materialised the cycles every existing company had already run, up
  to the one containing today — using the OLD per-bucket formula so nothing
  shifted — and corrected **برو** to `["2026-07-19"]` (cycle 1 ended 7 July, it
  renewed on the 19th → a real 7–19 July gap with no work).

### Contract cycles (`lib/dates.ts`)
Each company distributes its plan over its **contract cycle**:
`companyCycle(year, month, contractDay)` = `[day of THIS month → day of NEXT
month)` (e.g. signed on the 20th → a **20→20** window). The end is anchored to
the **same day of the next month** (clamped to its real length), NOT a fixed
+30 days — so consecutive cycles are exactly **contiguous** (bucket N's end ==
bucket N+1's start; no dead day after 31-day months, no February overlap).
`contractStartDate` null → the calendar month. Tasks stay tagged with the
cycle's **start** month even when dates spill into the next calendar month.
`packingWindowDays` extends the employee packing canvas to the furthest
deadline; `monthGridDays(…, until)` extends calendar grids to show the
spill‑over. Seeded: جدارات 15→15, المول 20→20.

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

### New-contract pipeline lead — no work before the contract start 🆕
A company's `contractStartDate` is a HARD floor, and in the contract's **FIRST
cycle** the whole production chain is sequenced from day one:
**العقد (يوم 1) → كتابة الخطة (يومان) → تصميم/تصوير → نشر**.
- The writer card starts ON the contract date; NOTHING production-facing
  (design/story/AI deadlines & work days, reel shoots, deliveries, the
  photoshoot session) is dated before **contract + 2 writing days**.
- Publish floors per type = writing + the type's own lead: POST/AI_REEL
  2+2 → day 5, STORY 2+1 → day 4, REEL 2+3 (scenario → shoot → publish) →
  day 6. So a July-1 client's first story publishes ≥ Jul 4, first post ≥
  Jul 5, first reel ≥ Jul 6 — and NEVER gets June prep dates or phantom
  "late" June work.
Later cycles are untouched: an ONGOING client's prior-month prep (photoshoot
staging, early shoots) is legitimate and unchanged. Manual (ad-hoc, pinned)
tasks are the user's authority and are never clamped.

### Packing (§5.4)
**URGENT and ALL ad-hoc tasks (any priority) pack ASAP** — earliest free day ≤
deadline, URGENT first via the rank sort; routine plan content packs JIT
(latest day ≤ deadline). Every packed task consumes daily capacity; overflow is
flagged, never silent. Candidate days respect the company's contract-start
floor.

Wrapped by **`generateSchedule`** (server action) which expands the pipeline and
persists, preserving board/status + pinned edits + ad‑hoc + **work-history
timestamps** (`startedAt`/`finishedAt`/`completedAt`) + **photo-session
statuses** (matched by detKey, falling back to company|kind|no when a
regenerated shoot date moved).

### 6.1 Task Deletion Rules
- **Manual/Ad-hoc Tasks (`isAuto: false`)**: Deleted permanently from the database.
- **Auto-generated Tasks (`isAuto: true`)**: Soft-deleted (set to `status: "CANCELED"`, pinned). For content pieces, deleting either the production card or the PUBLISH card cancels the matching piece stages for the current month, so the deleted item stays out of both task boards and publishing. The underlying company plan is unchanged, so the item regenerates fresh in the following month's cycle.

---

## 7. Workload — plan‑driven burndown (`lib/workload.ts`)

Per person: **committed / done / remaining / free** days (+ pct, type breakdown).
Dated task effort is computed from the task `quantity` and the employee's rates;
**completion never lowers committed**. Writer cards use the PLAN rate — a company
plan split into DESIGN and SHOOT write scopes is still charged **once** (the plan
days are divided across its scopes, never double-counted). Designer
POST/STORY/AI_REEL cards use their design-unit quantities, photographer load
uses assigned reel work, and **Publisher (عمر)** = one duty-day per publishing
day, **capped at capacity** so publishing alone never exceeds 100%. A Friday
publish date is charged to the previous workday (Thursday). **capacity = all
period days EXCEPT Friday** 🆕. Shown on `/workload` (admin).

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
  pipelineKey+stage), pinned title/dates/owner/priority/quantity, **work-history
  timestamps** (startedAt/finishedAt/completedAt — reports' actual-duration
  metrics survive every regen), **photo-session statuses** (detKey →
  company|kind|no fallback), monthly deleted content-piece counts,
  trainer-supplied training content, and ad‑hoc. Deterministic.
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
- **scripts/clean-orphan-writes.ts** (`db:clean-orphans[:prod]`): idempotent —
  removes legacy pre-cycle WRITE cards (ids `w_c_*`, `isAuto=false`) that the
  seed/regenerate never clear and that duplicate the engine's per-cycle write
  cards (the phantom mis-dated "كتابة …" card). Nothing depends on them; stray
  `blockedById` refs are nulled first. Run against the prod URL after deploy.
- **Seed is NON‑destructive** (`prisma/seed.ts`): seeds a month only when empty;
  upserts employees/companies without overwriting edits (full rebuild =
  `SEED_FORCE=1`). Includes **safe idempotent rate corrections** (designers POST
  & STORY 6/8→10, writer PLAN 1→0.5, photographer REEL 2/3→3/2 — each applied only
  when still on a known old value, so a custom rate is never clobbered) so
  production picks up the new capacity on deploy. It also removes the legacy
  generic "publish all companies" ad-hoc task and skips التدريب's writer card.
  `seed-data.json` carries colors, contract dates, **and contract values** (the
  company payload seeds `contractValue`/`photographerId` when present, on create
  or a `SEED_FORCE` rebuild).

### Seed team / companies
6 employees: أيمن (Sun→Thu), سابين, حلا (lead/designer), نوال (writer), عمر
(publisher), المصور (photographer — may be renamed / a 2nd photographer added).
Managed companies with plans + owners + colors (BW, Phoenitech, مخبر د.نور, برو,
المول الصيني 20→20, جدارات 15→15, التدريب, **وصل للتداول** $600 15P/8R/20S,
**أغاليا** $150 10P/6R/15S, **التوظيف** 10P/8R — Phoeni Jobs launch); design‑only:
المدارس, كابرياني. Salaries and any further companies you add live in the DB.

---

## 10. Screens (routes) — `src/app/**`

Root = employee area; `/admin/*` = admin area (same shared pages + the rest).

| Route (employee `/` · admin `/admin/…`) | Shows |
|---|---|
| `/` , `/admin` | KPIs · **المهام الحرجة** (only not-done tasks overdue or due ≤2 working days, days‑late) · **إنجاز الفريق** (per‑person donuts: done/total/remaining, counts all assigned) · **مهام اليوم** = a **tab per employee** (always all of them), each showing tasks / **عطلة** / **متفرّغ لعمل إضافي** · **إنجاز الشركات** (published PUBLISH cards ÷ plan over the cycle) · إعادة الجدولة. **Loads the same live set as the board**: bucket + cycle continuation + open carryover, so overdue prior-month work reaches the daily queue and critical panel (with the «متبقّي من دورة …» badge). |
| `/tasks` | Kanban board (default) + **daily view using the same KanbanBoard filtered to today only** + weekly/monthly production calendars. One numbered card per piece; full add/edit/delete; status/board moves. **Month view = the month's own cycle bucket + the still-open tail of adjacent cycles dated in this calendar month (`monthContinuationWhere`) + ALL still-open work from earlier buckets regardless of dates (`openCarryoverWhere` — dynamic: any past month)**, so a 20→20 company (المول) keeps its ongoing 1st–19th pieces visible and overdue June cards follow the team into July until finished/deleted. Carryover cards carry the «متبقّي من دورة …» badge. Weekly/monthly calendar excludes REEL & PUBLISH (production view, on workdays). Late badge shows **N days** only for unfinished overdue cards. |
| `/publishing` | Publishing calendar by publishDate (no Fridays); numbered chips; no‑interruption banner |
| `/admin/workload` | Whole‑team burndown |
| `/reports`, `/admin/reports` | KPIs · إنجاز خطة الشركات (published PUBLISH cards) · **تشخيص التأخيرات** (unfinished overdue grouped by stage + by person, with days) · per‑person ledger (every task: start→end · actual duration · lateness days) · CSV |
| `/admin/finance` | P&L per contract, break‑even, team capacity |
| `/admin/companies` | CRUD + plan + owners + color + contract value + contract date + photographer + **preferred shoot day** |
| `/admin/team` | CRUD + rates (designers items/day; photographer “X reels every Y days”) + workdays + salary + per‑reel cost |
| `/admin/priorities` | company priority ordering |

Shared UI: `Sidebar` (path‑aware), `MonthBar`, `calendar/*`, `KanbanBoard`
(takes `year`/`month` to badge carryover cards), `components/ui/{Donut,pills}`
(`Pill`/`PriorityPill`/`LatePill`/`CyclePill`/`daysLateOf`), forms
`{Task,Member,Company}Form`.

### Responsive layout 🆕
Mobile-first, verified at 360/768/1280.
- **Navigation** (`Sidebar.tsx`): a 260px sticky rail at **lg+**; below lg it
  collapses to a slim **sticky top bar + hamburger drawer** (slides from the
  right for RTL; closes on navigate/overlay/Esc; includes the admin logout). The
  layout is `lg:flex` — stacked (bar above content) on mobile/tablet, a row
  (rail beside content) on desktop. The bar is `sticky` (not `fixed`) so it never
  depends on the fixed initial-containing-block width.
- **No horizontal scroll**: `body { overflow-x: clip }` (keeps the sticky rail
  working, unlike `hidden`); the tasks toolbar and report actions wrap; the
  critical-panel person cards truncate (`min-w-0` + `flex-1`) instead of forcing
  width. Intentional horizontal scroll (wide tables, kanban columns) stays inside
  its own `overflow-x-auto` wrappers.
- Grids already use responsive column counts (`grid-cols-2 lg:grid-cols-4`,
  `md:grid-cols-2 xl:grid-cols-3`); the Radix dialog is `w-[calc(100vw-32px)]
  max-w-xl max-h-[90vh]` so forms/modals fit and scroll on mobile.

---

## 11. Business rules (authoritative)

- **Access**: employees on root (full task CRUD); admin on `/admin` (everything
  incl. finance/team/companies/workload/priorities); admin routes 404 for
  employees. No login — keep `/admin` private.
- **Work days**: off Thu+Fri (Sat→Wed) except Ayman off Sat (Sun→Thu).
- **Publishing**: per contract cycle; **NO Friday publishing** (Thu OK); feed ≥1
  day apart; stories one/day (may share a feed day); no week is empty.
- **Contract cycle**: a `contractStartDate` makes the plan run day→day (e.g.
  20→20); else calendar month. Consecutive cycles are contiguous — no gap, no
  overlap.
- **No new cycle without a renewal** 🆕: when a cycle ends, NOTHING is generated
  for that company until the renewal question is answered on /admin/companies.
  Renewing from a later date starts the cycle **from that date** and leaves the
  in-between days genuinely empty; a cycle resumed after a gap re-runs the full
  writing→production→publishing lead. «لم يُجدد» pauses the company and blocks
  every later cycle until a renewal is recorded.
- **New-contract pipeline lead**: the first cycle sequences
  عقد → كتابة (يومان) → تصميم/تصوير → نشر. No auto-generated date precedes
  `contractStartDate`; no production date precedes contract+2 (the written
  plan); first publishes per type: STORY day 4, POST/AI day 5, REEL day 6.
  Ongoing clients keep prior-month prep.
- **PREP WEEK for contracts signed from 2026-07-20** 🆕: signing does not start
  publishing. The writer needs ~2 days for the plan, then the client approves it,
  and only then may design/shoot begin — so **design/shoot waits 3 WORKING days**
  (`PREP_PRODUCTION_WORKDAYS`) and **nothing publishes for 7 CALENDAR days**
  (`PREP_PUBLISH_DAYS`), for every type. A client signed on 20 July first
  publishes on the **27th**; its first week is full of WRITE tasks, just no
  published pieces. Gated by `PREP_WEEK_RULE_FROM` in `lib/scheduler.ts`: cycles
  that began BEFORE that date keep the older, shorter leads, so contracts already
  running (أغاليا, التوظيف, وصل, جدارات) and برو's 19 July renewal are never
  re-planned retroactively. Applies to any cold start — a new contract OR a
  renewal resumed after a gap.
- **Open-work carryover (dynamic)**: unfinished work from ANY earlier cycle
  bucket follows the team into the current month's board/overview until it is
  finished or deleted — never month-specific; in August the carryover shows
  July's (and any older) leftovers automatically, each badged with its cycle.
- **Card numbering is per cycle**: every cycle numbers its pieces 1..N per
  (company, type); numbers never continue across months.
- **Regen never erases history**: startedAt/finishedAt/completedAt and
  photo-session statuses survive إعادة الجدولة (which runs implicitly on every
  task add/edit/delete).
- **Ad-hoc of any priority is packed ASAP** and consumes capacity; URGENT goes
  first.
- **Capacity**: designer 10 posts/day OR 10 stories/day OR 1 AI‑reel/day;
  photographer 3 reels/2 days; writer 2 days/company; publisher daily coverage.
- **Carousel capacity**: a carousel is one post in the company plan/publishing
  progress, but it consumes one design unit per slide on the designer workload.
- **Regenerate preservation**: إعادة الجدولة may reorder work dates and publish
  dates, but it preserves pinned card edits including carousel quantity. A
  deleted auto-generated content piece remains canceled for the current month
  across production and PUBLISH stages, even if dates move after priority changes.
- **Trainer-supplied training content**: التدريب stays managed and keeps its
  design/publish workload, company progress, and publishing calendar entries,
  but it does not generate Nawal WRITE work or writer cost allocation.
- **Cards**: one numbered card per piece (no batching); writing per company.
- **Multiple photographers**: assign reels per company; optional **soft preferred
  shoot day** per company (editable).
- **Company priority order** (2026-07-20): وصل للتداول · أغاليا · جدارات ·
  برو · مخبر د.نور · مركز البلسم · Siizen · المول الصيني — then OUR OWN
  companies التوظيف · التدريب · Phoenitech · BW — then on-demand only
  كابرياني · المدارس. Priority is a tie-breaker for placement/stagger, not a
  hard gate (see priority.test.ts).
- **Company achievement = publish-card completion**. A content piece counts when
  its PUBLISH card is done/published; upstream production closure is operational
  state and is not required for company-facing progress.
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
- Photographer “week 4 no‑shoot” is computed per company on its **contract
  cycle** (`shootCapFor`), falling back to the calendar month only when the
  company has no cycle. Preferred shoot day is soft.
- **Two cycles in one calendar month** (a very early renewal) share a bucket;
  `cycleForBucket` returns the first. Tasks stay distinct via `detKey`, but
  per-cycle piece numbering could repeat inside that bucket. Not handled.
- A **late renewal can outrun the photographer**: a cold restart compresses
  shoot+deliver, and the per-type publish floors are static offsets that ignore
  photographer contention, so the first reels of a resumed cycle may deliver
  on/after their publish date. The engine WARNS
  («تسليم ريلات بعد موعد النشر — هامش غير كافٍ») rather than inventing an
  impossible schedule; `db-integration.test.ts` asserts every violation is warned.
  Fix manually (move the reel, or reassign the shoot).
- Late tasks are flagged/diagnosed but **not auto‑rescheduled** — a separate
  “معالجة المتأخرات” recovery action (re‑pack overdue forward with overtime) is a
  planned, deliberate step kept out of the deterministic regenerate. (They DO
  carry over visibly into the current month now.)
- `/reports` actual duration is “—” until a task is moved through the board.
- June achievements hard‑coded (`JUNE_2026_DONE`); other months start empty.
- Two Prisma schema files kept in sync manually.
- Publisher workload is capped at 100% by design — a publisher never shows
  “over” even with extra ad-hoc load.
- When a plan is denser than its cycle allows (e.g. 14 feed items in a 26-day
  canvas), the ≥1-day feed gap falls back to adjacent days **silently** (no
  warning yet).
- `validatePublishing` (§9 plan-match / no-interruption checks) exists and is
  tested but is not wired into any screen.
- No ESLint config — `npm run lint` opens an interactive setup prompt.

---

## 14. Telegram follow-up + «متابعة اليوم» 🆕 (2026-08-01)

The team runs **ONE forum supergroup** («Desgin only (Team)»), where each
company is a **topic**, not a separate group — so the unit of linking is the
topic (`TelegramChat.id` = `<chatId>#<threadId>`). Plans, designs and reels are
all delivered there. The dashboard watches those topics so it knows what ACTUALLY
went out, and builds the morning brief the lead used to write by hand.

### Canonical asset name — «Agalia 7-1» (`lib/asset-name.ts`)
Every delivered file is named `<Slug> <month>-<pieceNo>`: the LATIN company short
name (`Company.slug`, editable; `SLUG_BY_NAME` seeds it), the 1-based month, and
the piece number inside that month's plan. The name does NOT encode the type —
the file does (mp4 → ريل, jpg → بوست). `parseAssetName` reads it back and is
deliberately forgiving (`Bru1-7`, `agalya laser reel 7-14`, and the old
piece-first `wasl 14-7`). Same vocabulary in the cards, the brief and the matcher.

### Ingest (`lib/telegram/{client,match,ingest}.ts`, `/api/telegram/webhook`)
Bot token in `TELEGRAM_BOT_TOKEN`, webhook authenticated with
`TELEGRAM_WEBHOOK_SECRET`. Rows are keyed `<chatId>:<messageId>` so Telegram's
retries can't double-count. A chat is auto-discovered on first message and
linked to a company from `/admin/telegram`. Matching runs in three tiers:
1. **NAME** — the canonical name, type-aware (a VIDEO named `wasl 4-7` is reel 4,
   never story 4) and tolerant of one typo in the slug (`Agalya`≈`Agalia`).
   `N-N` is ambiguous while the team migrates from piece-first to month-first, so
   BOTH readings are tried and the one naming a real open piece wins.

   **قاعدة الدورة (2026-08-03, the lead's rule — READ THIS BEFORE TOUCHING
   `matchDelivery`):** a piece's identity is *company + type + pieceNo + the
   contract cycle active when the file was SENT* (`currentCycleBucket(co,
   sentAt)` — sent-time, never read-time). The month written in the file name is
   a human label, NOT identity. It is accepted when it can be *explained* as
   either the cycle-start month (`Makhbar 7-4` for the 15/7→14/8 cycle) or the
   piece's actual publish month (`Makhbar 8-4`, because it publishes in August —
   what the team actually types once the calendar flips). Any other month is a
   naming MISTAKE and must not match. Consequences, each learned from a real
   incident:
   - A reel has TWO production cards (SHOOT then EDIT) with the same pieceNo —
     that is one piece in stages, not ambiguity. Match the earliest-deadline
     open stage. (Before: `Makhbar 8-4.mp4` matched nothing and the card sat
     "متأخر" while the work was in the group.)
   - Same number open in two cycles → the cycle active at send time wins; an
     explicit old-cycle name (`Makhbar 6-4`) still reaches the old piece.
   - A name that resolves to an already-DELIVERED piece is a re-send/revision —
     it must NOT fall through to close some other open piece. But check this
     AFTER stage matching, per piece not per card: a closed SHOOT with an open
     EDIT is a piece still in production, and its montage must land. (Both
     directions went wrong once: `BW reel 2 July` closed August's reel; then the
     over-eager fix made 8 open pieces unmatchable.)
   - `full-system-audit` §12 generates BOTH names for every open piece and runs
     them through the real matcher — if a rename breaks either naming, the audit
     fails before the team ever hits it.
2. **BRIEF** — the plan's own words (`Task.brief`) matched against the file
   name/caption, Arabic-normalised and rarity-weighted. This is what makes the
   accounting honest: four «خبر عاجل» plan rows absorb four files and no more.
3. **TYPE** — video → reel, photo → post/story, refined by a type word in the
   name (`POST صرف تركيا`, `… july 3rd reel`). **Only for companies whose cards
   carry no brief yet**: once the plan text is in the system it is the authority,
   and a delivery matching no plan row is simply not a planned piece.

**Off-plan content** (`Company.offPlanKeywords`, JSON array): وصل publishes the
client's own exchange-rate bulletins, «المفكرة الاقتصادية», «نتيجة الخبر» and
«التحليل الفني» on the same channels. They go out but are NOT what the contract
counts, so a keyword hit blocks matching entirely. Set with
`scripts/set-off-plan.ts`. Ignoring this once reported وصل at 29/43 produced when
the real figure was 4/43.

A match **closes the piece's production card** (READY/DONE,
`finishedAt` = the real delivery time) — reversible with «مو هي» on the اليوم
screen (`unmatchMessage`). Albums (carousels) close their piece once.

**The credit follows the SENDER, not the plan.** The plan says who was *supposed*
to make a piece; the group says who *did*. سابين delivered the Jobs posts and
they closed حلا's cards, so every report read as حلا's work — the lead caught it
and the rule is now enforced in `closeProductionCard`: the card is re-assigned to
the employee whose `Employee.telegramUserId` matches the sender, and pinned so a
regeneration can't hand it back. Matching is by NUMERIC id, never display name (a
name changes, an id doesn't); an unknown sender leaves the owner alone, because a
wrong name is worse than a stale one. Populate ids from observed senders — the
`/admin/telegram` message list shows them.

### Morning brief (`lib/telegram/brief.ts` + `service.ts`, `/api/cron/daily-brief`)
**The bot never posts into a client group.** Every message goes to the LEAD's
private chat (`Setting["telegram.leadChatId"]` or `TELEGRAM_LEAD_CHAT_ID`), one
Telegram message each, so she forwards what she wants — by her rule, nothing may
look machine-written to a client.

Sent in **TWO WAVES**, because that is how she actually works — she showed us
her own hand-written brief and the bot's was far too detailed for the 07:45 slot
(`briefMessagesFor(brief, wave)`; `?wave=general|detail`, two `vercel.json` crons):

**07:45 — `general`.** The message she forwards to the team group *verbatim*, so
it has to read like she typed it: `صباح الخير`, then ONE bare line per person —
`أيمن ريلات جدارات`, `@Omar_ORR متابعة الصفحات والنشر`. **No** bullets, emoji,
dates, piece names, or day counts; work is named by company only. Overdue work
that today's queue can't reach becomes a short chase — `والمتأخر وصل وبرو وغيرها`
— capped at two companies, and a company already named in today's half is not
repeated. `Employee.telegramUsername` (no `@`) turns a name into a real mention;
unset → the plain name, as she does for anyone whose handle she doesn't use.
Someone idle or off today gets **no line at all**; idle names go only to her own
risk report (`🟢 فاضي اليوم`), which rides along in this wave since it is private.

**08:00 — `detail`.** النشر اليوم / تسليم اليوم / مونتاج اليوم / المتأخر piece by
piece with the canonical name, then the per-company and per-employee sheets (the
employee sheet inlines the piece's `brief`, so nobody opens a Word file to
start). This is the wave that is *allowed* to be long.

The rule to keep: **anything with a piece name, a date or a day-count in it
belongs to the 08:00 wave.** `tests/telegram.test.ts` pins that boundary.

**Editing queue**: montage starts the DAY AFTER the shoot and the editor gets
through 3 reels/day (`EDIT_STARTS_AFTER_DAYS`, `EDITS_PER_DAY`), so أليسار's list
is derived from ماجد's completed shoots rather than scheduled separately.

Vercel cron at `45 4 * * *` (**07:45 Damascus**, the lead's chosen time);
`/admin/telegram` previews the exact text and has «ابعتيلي البريف هلق».

### Recovering history + one-off reconciliation tools (`scripts/`)
A bot cannot read messages sent before it joined, so the July backlog was
invisible. Recovered from a **Telegram Desktop export**:
- `telegram-html-to-json.ts <ChatExport dir>` — the export is HTML by default;
  this converts it to the JSON the importer eats, keeping the ORIGINAL file name
  (the visible title, not the de-duplicated path on disk). Works even when the
  media itself was too large to download — the names are all that matter.
- `import-telegram-export.ts <result.json> [--apply] [--strict]` — topics →
  companies (alias table + fuzzy), then the three-tier matcher. Fenced by: the
  piece must belong to the delivery's own cycle (±10/25 days), the file must look
  like finished work (not `WhatsApp Image…`, `IMG_…`, logos, link previews), and
  the sender must be someone who produces content. **Re-sending the same file
  name within 14 days is a REVISION, not a second piece** — the run collapses
  them and the LAST send is the one that counts.
- `telegram-relink.ts [--apply]` — the HTML export carries no Bot-API chat id, so
  imported topics were keyed `export#N` while live updates arrive as
  `-100…#N`; this merges them and re-matches messages stored while unlinked.
- `telegram-poll.ts [--watch]` — local stand-in for the webhook (Telegram cannot
  reach `localhost`). Same ingest path as production.
- `reconcile-from-downloads.ts` — closes pieces from files already downloaded to
  `Downloads/Telegram Desktop`, name evidence only.
- `import-plan-briefs.ts <dir> [--apply]` — reads the month's plan `.docx`
  directly (minimal inline zip reader, no dependency) and writes each numbered
  row onto its piece as `Task.brief`, production AND publish card. Re-run monthly.
- `cycle-status.ts [year month0] [--current]` — production **per cycle, never
  summed across months**. A contract is monthly, so «Phoenitech 8/12 بوست» is a
  number that matches no agreement — the lead caught exactly that («انت عم تدمج
  الخطط كلها؟ مو حسب الشهر يعني؟»). Prints each company's monthly plan, then one
  line per cycle, and flags a cycle whose card count ≠ the contracted figure.
- `company-status.ts [company]` · `ready-to-publish.ts [company]` — the review
  sheets for going through the roster; the second lists pieces whose production
  is DONE and are only waiting to be published (the fastest daily win).
- `set-done-counts.ts <co> STORY=6 POST=9 [--apply]` — **stories are counted,
  not numbered**: «بالستوري مو مهم الترتيب، المهم الكمية». For any type without a
  numbered brief, asking WHICH file is story #4 is a question with no answer —
  ask HOW MANY are done. Closes oldest-first, and reopens (publish card too) when
  the recorded figure is higher than reality.
- `mark-pieces-done.ts <co> <TYPE> <n> [--apply] [--publish]` — the lead knows
  totals («عملنا 4 ريلات») far better than which numbered piece each was; closes
  the oldest open pieces of that type.
- `reject-pieces.ts <co> <TYPE> <nums> "reason" [--apply]` — a delivery landing
  in the group proves it was SENT, never that it was ACCEPTED. Rejected pieces
  reopen at IMPORTANT with the reason on the card. Rare by design: the lead
  declined a «مرفوض» button, the card simply stays put and is not moved to نشر.
- `set-off-plan.ts <co> "kw,kw" [--apply] [--reset]` — declare off-plan content.

### When the delay is the CLIENT's (`Company.lateExemptReason`)
Different from pausing: the team keeps producing, but nothing may be counted
against them. جدارات's page access never arrived, so its pieces can be made and
not published — a non-null reason takes the whole company out of every «متأخر»
list (brief, per-company sheet, her risk report) while leaving the real
deadlines underneath intact. The company sheet prints the reason, so a clean
sheet never reads as an oversight. Clear the field the day the blocker lifts.

### Shooting and editing run in parallel (`DEFAULT_RATES.REEL`)
`REEL` was `3/2` (three reels per two days) from when ONE person shot and cut
the same reel. ماجد shoots 3/day and أليسار edits 3/day as separate people, so
the rate is now `3` and `isExclusiveDayTask` no longer hard-codes REEL/AI_REEL —
exclusivity follows the rate (AI_REEL is still 1/day, so it still owns its day).
Editing stays derived from completed shoots (`EDITS_PER_DAY`), not scheduled.

### Paused companies (`Company.status`)
`scheduler.ts` plans only `managed && status === "active"`. Pausing is the right
tool for a **signed but not-yet-started** client (Siizen: contract dated, but the
page details and product list never arrived) — the contract dates stay intact and
one flag resumes it. Caveat: unwanted auto work must be deleted explicitly (step
11 of `apply-2026-08-updates.ts` does this: only `isAuto && !isPinned &&
NOT_STARTED` with no timestamps, and its stray `blockedById` refs are nulled
first).

**A regeneration must never touch a dormant company.** `generateSchedule`
replaces the month by deleting every `isAuto` card and rebuilding from the plan
— but the engine plans only `managed && active`, so a paused or archived company
got deleted and never rebuilt. Siizen's 26 filled-in cards (plan text and all)
vanished on a regeneration triggered for someone else entirely; `fill-siizen-
cards.ts` had to recreate them. The delete is now scoped with
`NOT: { companyId: { in: dormantIds } }`: parked work stays parked.

### Screen — `/today` · `/admin/today` (employee + admin, shared view)
Per company: ينزل اليوم (with a **readiness** signal from the piece's open
production siblings) · تسليم اليوم · معرّض للتأخير · متأخر (capped at 5 + tail
count) · **شو وصل على المجموعة اليوم**. One-click «تم النشر». `lib/live-tasks.ts`
extracts the bucket+continuation+carryover rule the other screens already used.

## 13. Conventions for the next session

- `main` is production (Vercel auto‑deploys). Use preview branches to test before
  merging to `main`. After data/engine changes: `npm run typecheck && npm test &&
  npx next build` (dev stopped), verify in preview, then commit + push.
- Stop the dev server before `prisma generate`/`db push`/`next build` (Windows
  locks). Commit messages end with the Co‑Authored‑By trailer; don't commit
  `.claude/` settings into feature work.
- Dates are LOCAL midnight; months are **0‑based**. Never reintroduce destructive
  seed behavior; never gate edit‑persistence on a checkbox (manual edits pin).
