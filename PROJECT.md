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

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind**. RTL, Tajawal font.
- **Prisma** ORM. **SQLite locally**, **Postgres (Neon) in production**.
- **Vitest** tests (**130**). Enums stored as **String**; `Int[]` (workDays) as JSON.

### Two Prisma schemas (keep models in sync!)
- `prisma/schema.prisma` — SQLite (local). `prisma/schema.postgres.prisma` —
  Postgres (Vercel, via `--schema`).

### Commands
```bash
npm run dev          # local dev (SQLite)
npm test             # vitest (130)
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
`id, name, role (free‑text Arabic), hoursPerDay (default 8), workDays (JSON
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
- `buildContentNumbers` numbers per `(company,type,CYCLE)` by publish order —
  **numbering restarts at 1 every cycle bucket** (year/month), so June leftovers
  shown next to July's plan never inflate the numbers (a 6-piece plan always
  reads 1..6, never 7..12). The number is shared across a piece's stages via
  pipelineKey. `cardLabelFor` → `بوست-N` / `جدولة بوست-N` (feed) / `نشر ريل-N`
  (reels). `groupTasksIntoCards` = one card per task.
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
- **New-contract pipeline lead**: the first cycle sequences
  عقد → كتابة (يومان) → تصميم/تصوير → نشر. No auto-generated date precedes
  `contractStartDate`; no production date precedes contract+2 (the written
  plan); first publishes per type: STORY day 4, POST/AI day 5, REEL day 6.
  Ongoing clients keep prior-month prep.
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
- Photographer “week 4 no‑shoot” is computed on the **calendar month**, not the
  contract cycle (safe — only pulls shoots earlier). Preferred shoot day is soft.
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

## 13. Conventions for the next session

- `main` is production (Vercel auto‑deploys). Use preview branches to test before
  merging to `main`. After data/engine changes: `npm run typecheck && npm test &&
  npx next build` (dev stopped), verify in preview, then commit + push.
- Stop the dev server before `prisma generate`/`db push`/`next build` (Windows
  locks). Commit messages end with the Co‑Authored‑By trailer; don't commit
  `.claude/` settings into feature work.
- Dates are LOCAL midnight; months are **0‑based**. Never reintroduce destructive
  seed behavior; never gate edit‑persistence on a checkbox (manual edits pin).
