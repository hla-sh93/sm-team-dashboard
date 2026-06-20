# sm-team-dashboard — Project Handoff / Context

A social‑media team management & scheduling dashboard (Arabic, RTL). Manages a
team that serves multiple client companies: content **planning → writing →
design/shoot → publishing**, with per‑person capacity, a Kanban workflow, a
publishing calendar, and monthly achievement reports.

> This file is the single source of context for a new session. It reflects the
> code as of git `7b0e055` on branch `feature/social-publishing-schedule`
> (= `main`). The original spec is `SOCIAL_SCHEDULER_SPEC.md`; several rules have
> since been overridden by the user — **this file wins on conflict**.

---

## 1. Tech stack & how to run

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind** (RTL, Tajawal font, Navy `#17314D` / Gold `#C8A84E`).
- **Prisma** ORM. **SQLite locally**, **Postgres (Neon) in production**.
- **Vitest** tests. Enums are stored as **String** (SQLite has no enums); `Int[]` stored as JSON strings.

### Two Prisma schemas (keep models in sync!)
- `prisma/schema.prisma` — **SQLite**, local dev.
- `prisma/schema.postgres.prisma` — **Postgres**, used by Vercel via `--schema`.

### Commands
```bash
npm run dev          # local dev (SQLite)
npm test             # vitest (44 tests)
npm run typecheck    # tsc --noEmit  (ignore stale .next/types/app/calendar errors)
npm run db:push      # prisma db push (SQLite)
npm run db:seed      # tsx prisma/seed.ts  (seeds July dataset + June actuals)
# Vercel build:
#   prisma generate --schema=schema.postgres.prisma
#   && prisma db push --schema=schema.postgres.prisma --accept-data-loss --skip-generate
#   && tsx prisma/seed.ts && next build
```
Local first run: `npm run db:push && npm run db:seed` (SQLite `prisma/dev.db`).
`.env` holds `DATABASE_URL` (local = `file:...dev.db`; prod = Neon URL).

### Deploy
- Git remote: **GitLab** `https://gitlab.com/hla2.sh93/socialmediateam.git` (NOT GitHub).
- Hosting: **Vercel**, project `socialmediateam`, tracks branch **`main`** (auto‑deploy on push). Live: `https://socialmediateam.vercel.app`.
- DB: **Neon Postgres** via Vercel Storage; the env var **must be named `DATABASE_URL`** (Neon connect used custom prefix `DATABASE`).
- Build seeds idempotently by a content **hash** stored in `Setting` (`seedHash:<year>-<month>`), so redeploys don't wipe status edits unless the dataset changed.
- See `DEPLOY.md` for the click‑through.

---

## 2. Data model (Prisma)

### Employee
`id, name, role (free text Arabic), hoursPerDay (internal, ~legacy), workDays (JSON int[] getDay()), isScheduled, isPhotographer, color, rates (JSON items/day, nullable), tasks[]`
+ per‑type ownership relations (postOwner/storyOwner/aiReelOwner/defaultOwner).

### Company
`id, name (unique), managed, posts, reels, stories, aiReels (monthly plan), color, priority, status, postOwnerId, storyOwnerId, aiReelOwnerId, defaultOwnerId, tasks[], photoSessions[]`

### Task  (the central entity — also the kanban card)
`id, kind, type, title, hours, quantity, priority, status, publishDate, readyDate, workDate, week, overflow, month (0‑based), year, isPinned, isAuto, stage, board, blockedById, pipelineKey, detKey, notes, completedAt, startedAt, finishedAt, companyId, assigneeId`
- **kind**: `CONTENT | ADHOC | PHOTOSHOOT | REPORT | CONTENT_WRITING | PUBLISH`
- **type**: `POST | REEL | AI_REEL | STORY | null`
- **priority**: `NORMAL | IMPORTANT | URGENT`
- **status**: `NOT_STARTED | IN_PROGRESS | AWAITING_APPROVAL | READY | PUBLISHED`
- **stage** (pipeline): `WRITE | DESIGN | SHOOT | PUBLISH`
- **board** (kanban column): `TODO | DOING | REVIEW | DONE`
- **blockedById**: predecessor stage‑task id (SOFT gate → warning only)
- **pipelineKey**: groups the stages of one content item
- **quantity**: batch size (e.g. a grouped "6 posts" card)

### PhotoSession
`id, no (1=photoshoot), kind (PHOTOSHOOT|REELS), shootDate, deliverBy, reelCount, status (NOT_STARTED|SHOT|EDITING|DELIVERED), month, year, isAuto, detKey, companyId`

### Setting
`key, value (JSON)` — used for seed hashes.

---

## 3. The pipeline / agile workflow (core concept)

Every content item flows through stages, each a **card on one person's board**:
```
كتابة (Nawal) → تصميم/تصوير (designer/photographer) → نشر (Omar)
```
- **WRITE**: Nawal, **2 cards per company** — one gating posts+stories+ai‑reels (scope DESIGN), one gating reels (scope SHOOT).
- **DESIGN**: posts/stories/ai‑reels → the company's owner (Ayman/Sabin/Hla).
- **SHOOT**: real reels → photographer.
- **PUBLISH**: Omar — one publish card per content item.
- Cards are **all created upfront** in `TODO`; downstream cards are **soft‑locked** (show "بانتظار: …") until `blockedById` is `DONE`. Moving a card to `DONE` "unlocks" the next.

### Kanban display rules (KanbanBoard.tsx)
- **Posts & stories are BATCHED** into one card per `(assignee, company, type, stage)` with `quantity` = count. Label e.g. `بوستات · BW (4)`; Omar side `جدولة بوستات · BW (4)` / `جدولة ستوريز · …`.
- **AI‑reels & real reels are INDIVIDUAL & numbered** (`ريل‑1`, `ريل AI‑2`, Omar side `نشر ريل‑1`). Numbering = per `(company,type)` by publish order, shared by shoot/design and its publish card via `pipelineKey`.
- Moving a batched card moves all underlying tasks together.
- Board view is the default tab on `/tasks` (calendars still available).

The pipeline data is produced by **`lib/pipeline.ts → expandPipeline()`** (used by the regen script, the June seed, and the live `generateSchedule`).

---

## 4. Capacity / productivity model  (`lib/capacity.ts`)

Capacity is expressed in **items per working day** (hours were dropped from the UI; `hoursPerDay` survives only for ad‑hoc duration estimates).

`DEFAULT_RATES` (items/day): `POST 6, STORY 8, AI_REEL 1, REEL 2/3 (2 reels per 3 days), PLAN 0.5 (=2 days per plan)`.
Per‑person overrides stored in `Employee.rates` (JSON). Seeded:
- Ayman / Sabin: `{POST:6, STORY:8, AI_REEL:1}`
- Hla: `{POST:6, STORY:8}` (no AI reels)
- Nawal: `{PLAN:0.5}`  ·  Photographer: `{REEL:2/3}`  ·  Omar: default

Helpers: `ratePerDay`, `hoursPerItem`, `taskDays(emp,type,qty)` (= qty/rate, **expected duration in working days**), `adhocDays(emp,hours)`, `cardDurationDays`, `daysLabel`.

**Workload** (`lib/workload.ts`, `computeWorkload`) is in **DAYS**: `neededDays` (Σ quantity/rate over a person's live tasks) vs `capacityDays` (their working days in the month's period) → `pct`. Photographer's reels and Omar's PUBLISH cards are folded in; the Team form edits rates. Editable per person from `/team` (MemberForm: items/day inputs + "مدة إعداد الخطة (أيام)").

---

## 5. Scheduling engine  (`lib/scheduler.ts`, `lib/photographer.ts`)

`buildSchedule(state)` is a **pure, deterministic** function (no DB, no `Date.now()`): generates content tasks (publishDate/readyDate/workDate/week/overflow) + photographer sessions for a month.

- **Publishing distribution** (overrides spec's split4+ORDER): each company's items are spread **evenly across the whole month** (all 7 days usable). Feed items (POST/REEL/AI_REEL) are interleaved and placed **≥1 day apart** (no same‑day, no consecutive‑day for a company — "a day on, a day off"); spacing = `monthLen / itemCount`; companies staggered by an offset. Stories spread evenly and may share a feed day. Helpers: `interleaveTypes`, `placeAvoidingAdjacent`, `placeUnique`. `week` = quarter of month.
- **Photographer** (`buildPhotoSessions`): photoshoot (session 1, late prior month) + reel batches of 2–3; `shoot = backWorkday(earliestPublish−3, photoWorkDays)`, `deliver ≤ shoot+3` and `< publish`; **no Thursday/Friday shooting**; no shooting in week 4 (SHOOT_CAP).

The engine is wrapped by **`generateSchedule`** (server action) which expands it into the pipeline.

---

## 6. Screens (routes)  — `src/app/**`

| Route | File | Shows |
|---|---|---|
| `/` | page.tsx + overview-client | KPIs, **team workload (days)**, today's tasks, urgent list, **"إعادة الجدولة" button** |
| `/tasks` | tasks-client | **Kanban board** (default) per person + calendar (day/week/month) + Side Drawer; filters person/company; reassign + start/finish time + late badge |
| `/publishing` | publishing-client | Publishing **calendar** by `publishDate`, filters company/type, numbered (بوست‑1…), no‑interruption banner. Defaults to a month that has publishes (`resolvePublishMonth`) |
| `/workload` | page.tsx | Whole‑team load in **days** (needed vs available), role‑aware (publisher=count, others=days) |
| `/reports` | page.tsx + ReportActions | **إنجاز خطة الشركات** (published‑only %), per‑person done lists, CSV/print export |
| `/companies` | companies-client | CRUD companies + plan + per‑type owners |
| `/team` | team-client | CRUD employees + **rates (items/day)** + workdays |
| `/priorities` | priorities-client | company priority ordering |

Reusable UI: `components/calendar/{Calendar,SideDrawer}`, `KanbanBoard`, `MonthBar` (month switcher + regenerate), `ReportActions`, `Sidebar`, `components/ui/*`, `components/forms/{Task,Member,Company}Form`.

Month resolution (`lib/month.ts`): `resolveActiveMonth` lands on a month that has data; `resolvePublishMonth` on a month with scheduled publishes.

---

## 7. Server actions  (`src/server/actions/**`)

- **schedule.ts** — `generateSchedule(year,month)`: builds the full pipeline from company plans, applies reported achievements (`JUNE_2026_DONE` for 2026‑06), **preserves manual board moves** (by `pipelineKey+stage`), keeps ad‑hoc; `clearMonthSchedule`.
- **tasks.ts** — `createTask, updateTask, deleteTask, updateTaskStatus, moveCard(id,board)` (stamps start/finish, board↔status), `reassignTask(id,assignee)` (pins), `togglePin`, `updatePhotoSessionStatus`.
- **employees.ts** — `createEmployee/updateEmployee/deleteEmployee` (persists `rates` JSON via `buildRates`, `planDays → PLAN=1/planDays`).
- **companies.ts** — company CRUD.

`lib/schemas.ts` = Zod schemas (employee with `rates`+`planDays`, task, company). `lib/persistence.ts` = status‑preservation helpers across regen.

---

## 8. Seed data & scripts

- **`prisma/seed.ts`** — authoritative seed: upserts 6 employees + 9 companies (deletes any not in the dataset), seeds **July** from `seed-data.json` and **June actuals** from `actuals-june.json` (idempotent by hash; `SEED_FORCE=1` forces). June content → pipeline with **design/shoot = DONE, publish = TODO**.
- **`prisma/seed-data.json`** — July 2026 dataset (pipeline cards + sessions). `meta.month` is **1‑based** (7=July) → stored 0‑based (6).
- **`prisma/actuals-june.json`** — the lead's reported June work (in/out‑of‑plan, shared).
- **`scripts/regen-july.ts`** — regenerate July via the engine+pipeline.
- **`scripts/fix-shoot-days.mjs`** — move shoots off Thu/Fri.
- **`scripts/fix-noor-tuesday.mjs`** — snap مخبر د.نور reel shoots to Tuesday.

### Team (current)
| id | name | role | workDays | scheduled |
|---|---|---|---|---|
| e_ayman | أيمن | designer | Sun→Thu `[0,1,2,3,4]` (off Sat) | yes |
| e_sabin | سابين | designer | Sat→Wed `[6,0,1,2,3]` | yes |
| e_hla | حلا | lead+half‑designer | Sat→Wed | yes |
| e_nawal | نوال | writer | Sat→Wed | no |
| e_omar | عمر | publisher | Sat→Wed | no |
| e_photo | المصور | photographer | Sat→Wed (no Thu) | no, isPhotographer |

### Companies (managed plan: post/reel/story/aiReel · owners)
BW 4/4/8/0 (Ayman) · Phoenitech 4/4/8/0 (Sabin) · مخبر د.نور 6/6/8/0 (Sabin) · برو 6/8/12/0 (post Sabin, story Ayman) · المول الصيني 10/3/15/0 (Ayman) · جدارات 6/0/12/6 (post/story Sabin, ai‑reel Ayman) · التدريب 7/0/0/0 (Ayman). Design‑only: المدارس, كابرياني (defaultOwner Hla).

---

## 9. Business rules (authoritative, user‑confirmed)

- **Work days**: everyone off **Thu+Fri** (Sat→Wed) EXCEPT Ayman off **Sat** (Sun→Thu). Photographer Sat→Wed (no Thursday shooting except special cases). مخبر د.نور reels shoot on **Tuesday** (client availability).
- **Publishing**: all 7 days allowed (Thu/Fri OK now); spread across the whole month; no same/consecutive‑day feed per company; posts/stories may share a day.
- **Rates** (items/day): 6 post · 8 story · 1 ai‑reel; photographer 2 reels per 3 days; Nawal plan = 2 days/company; Omar schedules/publishes daily per plan.
- **Achievement = PUBLISHED only**: a company's plan completion counts items whose **PUBLISH** stage is DONE — not merely designed/shot. (June reads 0% while publishing is pending.)
- **Regenerate** (Home button) rebuilds the whole month's pipeline from plans, applies achievements, preserves manual board moves, keeps ad‑hoc. Run after editing tasks/companies/plans.

---

## 10. Known limitations / TODO

- `generateSchedule` produces individual post/story cards; the **batching is a Kanban view concern** (KanbanBoard). Publishing calendar uses the granular per‑item data.
- **Auto‑generate on month‑open is NOT implemented** (would mutate on GET). Regeneration is the Home button (or scripts). The seed gives an initial state; click **إعادة الجدولة** per month to get the full pipeline + achievements.
- June seed is "actuals only" until you click regenerate (which expands to the full June plan with achievements applied).
- Drag‑and‑drop between kanban columns is not done (uses a per‑card dropdown).
- Reported achievements are hard‑coded for June 2026 in `schedule.ts` (`JUNE_2026_DONE`); other months start empty.
- Two Prisma schema files must be kept in sync manually.
- `src/app/calendar` route was removed; ignore stale `.next/types/app/calendar` tsc errors (clear with `rm -rf .next`).

---

## 11. Conventions for the next session

- Work on branch `feature/social-publishing-schedule`; `main` is fast‑forwarded to it and pushed to GitLab (Vercel auto‑deploys `main`).
- After data/engine changes: re‑seed locally, run `npm run typecheck && npm test && npx next build`, verify in the preview, then commit + push.
- Don't commit `.claude/worktrees/`. Commit messages end with the Co‑Authored‑By trailer.
- Dates are LOCAL midnight (`toISODate` reads local Y/M/D); months are **0‑based** internally.
