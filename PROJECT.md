# sm-team-dashboard — Project Handoff / Full Documentation

A social‑media team management & scheduling dashboard (Arabic, **RTL**). It runs a
digital‑marketing team that serves multiple client companies through the full
content lifecycle — **planning → writing → design/shoot → publishing** — with
per‑person capacity planning, a Kanban workflow, a publishing calendar, editable
task cards, and monthly achievement reports.

> Single source of context for a new session. Reflects the code as of git
> `da18071` on branch `feature/social-publishing-schedule` (= `main`). The
> original spec is `SOCIAL_SCHEDULER_SPEC.md`; many rules below override it —
> **this file wins on conflict.** Sections marked 🆕 changed materially in the
> 2026‑06 work cycle.

---

## 1. Tech stack & how to run

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind**. RTL, Tajawal font.
- **Design system 🆕**: **light theme** (Vuexy‑style), primary = **aqua `#0a8fa3`**,
  tight border radius. (Was a dark navy/gold theme.) See §10.
- **Prisma** ORM. **SQLite locally**, **Postgres (Neon) in production**.
- **Vitest** tests. Enums stored as **String** (SQLite has no enums); `Int[]`
  (workDays) stored as JSON strings.

### Two Prisma schemas (keep models in sync!)
- `prisma/schema.prisma` — **SQLite**, local dev.
- `prisma/schema.postgres.prisma` — **Postgres**, used by Vercel via `--schema`.

### Commands
```bash
npm run dev          # local dev (SQLite)
npm test             # vitest (44 tests)
npm run typecheck    # tsc --noEmit  (ignore stale .next/types errors)
npm run db:push      # prisma db push (SQLite)
npm run db:seed      # tsx prisma/seed.ts  (NON-destructive — see §8)
# Vercel build:
#   prisma generate --schema=schema.postgres.prisma
#   && prisma db push --schema=schema.postgres.prisma --accept-data-loss --skip-generate
#   && tsx prisma/seed.ts && next build
```
Local first run: `npm run db:push && npm run db:seed` (SQLite `prisma/dev.db`).
`.env` holds `DATABASE_URL` (local = `file:...dev.db`; prod = Neon URL).
**DB backups** live in `backups/dev-<timestamp>.db` (git‑ignored copies of
`dev.db`); take one before risky data work.

### Deploy
- Git remote: **GitLab** `https://gitlab.com/hla2.sh93/socialmediateam.git` (NOT GitHub).
- Hosting: **Vercel**, project `socialmediateam`, tracks branch **`main`** (auto‑deploy on push). Live: `https://socialmediateam.vercel.app`.
- DB: **Neon Postgres** via Vercel Storage; env var **must be named `DATABASE_URL`**.
- The seed is **non‑destructive** (§8): a deploy seeds only an EMPTY month and
  never overwrites edits. After a fresh deploy, click **إعادة الجدولة** once per
  month to expand the full pipeline.

---

## 2. Data model (Prisma)

### Employee
`id, name, role (free‑text Arabic), hoursPerDay (legacy; only Hla≠6, she=3),
workDays (JSON int[] of getDay()), isScheduled, isPhotographer, color,
rates (JSON items/day, nullable), tasks[]`
+ per‑type ownership relations (postOwner/storyOwner/aiReelOwner/defaultOwner).

### Company
`id, name (unique), managed, posts, reels, stories, aiReels (monthly plan),
color, priority, status, postOwnerId, storyOwnerId, aiReelOwnerId,
defaultOwnerId, tasks[], photoSessions[]`

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
- **pipelineKey**: groups the stages of one content item (`companyId|type|publishDate`)
- **quantity**: batch size · **workDate** = START day · **readyDate** = END/deadline
- **hours**: internal effort store. For **ad‑hoc** tasks, `hours = work‑days × 6`
  (the UI edits **work‑days**, §4). Content cards keep `hours = 0` (rate‑based).
- **isPinned**: a manual edit / lock — preserved verbatim across regenerate (§7).

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
  (scope DESIGN), one gating reels (scope SHOOT). 🆕 Write cards now carry a
  **start (workDate)** and **end (readyDate)** — end = the earliest design/shoot
  card they gate, start = 2 working days before — so the writer shows in daily/
  calendar views with a real timeline.
- **DESIGN**: posts/stories/ai‑reels → the company's owner (Ayman/Sabin/…).
- **SHOOT**: real reels → photographer.
- **PUBLISH**: Omar — one publish card per content item.
- Cards are **all created upfront** in `TODO`; downstream cards are
  **soft‑locked** (show "بانتظار: …") until `blockedById` is `DONE`.

### Kanban display rules (`KanbanBoard.tsx` + `lib/cards.ts` 🆕)
Labeling/grouping/reel‑numbering is now a **shared module `lib/cards.ts`** so every
view (board, today panel, …) shows identical labels:
- `buildReelNumbers(allTasks)` — numbers **every** reel by id (publish cards
  included) per `(company,type)` in publish order; shoot/design + publish share a
  number via `pipelineKey`. Robust: a reel **never shows "?"** even if its
  counterpart card is missing/done/filtered. 🆕
- `cardLabelFor(t,count,reelNum,coName)` — a **custom `title` overrides** the auto
  label (so renaming works on any card); else: posts/stories batched
  (`بوستات · BW (4)`, Omar side `جدولة بوستات · BW (4)`); reels individual &
  numbered (`ريل‑1`, `ريل AI‑2`, `نشر ريل‑1`).
- `groupTasksIntoCards(tasks)` — batches posts/stories per
  `(assignee,company,type,stage)`; everything else stays individual.
- Moving a batched card moves all its tasks together. Board view is the default
  tab on `/tasks`.

The pipeline is produced by **`lib/pipeline.ts → expandPipeline()`** (used by the
regen script, the June seed, and the live `generateSchedule`).

---

## 4. Capacity / productivity model  (`lib/capacity.ts`)

Capacity = **items per working day** per person+type.

`DEFAULT_RATES` (items/day) 🆕: `POST 6, STORY 6 (was 8), AI_REEL 1, REEL 2/3
(2 reels per 3 days), PLAN 0.5 (=2 days per plan)`. Per‑person overrides in
`Employee.rates`:
- Ayman / Sabin: `{POST:6, STORY:6, AI_REEL:1}`
- Hla: `{POST:6, STORY:6}` (no AI reels)
- Nawal: `{PLAN:0.5}` · Photographer: `{REEL:2/3}` · Omar: default (publisher, §6)

**Ad‑hoc effort in WORK DAYS 🆕.** Ad‑hoc tasks are entered in **أيام العمل**
(working days), stored as `hours = days × WORK_DAY_HOURS (6)`. `adhocDays()`
normalizes back by the **fixed** `WORK_DAY_HOURS` (NOT the person's `hoursPerDay`)
so "a work‑day" means one calendar working day for everyone — critical because
Hla is a half‑designer (`hoursPerDay=3`). Hours never appear in the UI; everything
shows in days (`daysLabel`).

Helpers: `ratePerDay`, `taskDays(emp,type,qty)` (= qty/rate = duration in working
days), `adhocDays(emp,hours)` (= hours/6), `cardDurationDays`, `daysLabel`,
`WORK_DAY_HOURS`.

---

## 5. Scheduling engine  (`lib/scheduler.ts`, `lib/photographer.ts`)

`buildSchedule(state)` is **pure & deterministic** (no DB, no `Date.now()`):
generates content tasks (publishDate/readyDate/workDate/week/overflow) +
photographer sessions for a month.

- **Publishing distribution**: each company's items spread **evenly across the
  whole month** (all 7 days usable). Feed items (POST/REEL/AI_REEL) interleaved
  and placed **≥1 day apart** (no same/consecutive day for a company); stories
  spread and may share a feed day. Companies staggered by an offset. Helpers:
  `interleaveTypes`, `placeAvoidingAdjacent`, `placeUnique`. `week` = quarter.
- **Photographer** (`buildPhotoSessions`): photoshoot (session 1, late prior
  month) + reel batches of 2–3; `shoot = backWorkday(earliestPublish−3)`,
  `deliver ≤ shoot+3` and `< publish`; no Thu/Fri shooting; no week‑4 shooting.

Wrapped by **`generateSchedule`** (server action, §7) which expands it into the
pipeline and persists.

---

## 6. Workload model — PLAN‑DRIVEN BURNDOWN 🆕  (`lib/workload.ts`)

The biggest change of the cycle. Workload is **not** "remaining pending tasks"; it
is the month's **committed load** derived from **company plans + ownership**, shown
as a capacity‑planning **burndown** so a manager can both plan and reallocate.

`computeWorkload(employees, tasks, year, month, sessions, companies)` returns, per
person:
- **committedDays** — total committed work (plan + all this month's ad‑hoc), stable.
- **doneDays** — completed work (from task statuses board=DONE / READY|PUBLISHED).
- **remainingDays** = committed − done (shrinks as work finishes).
- **freeDays** = capacity − remaining (GROWS as work finishes → who to assign next).
- **pct** = committed ÷ capacity ("محجوز"), **donePct** = done ÷ committed (progress).

Rules:
- **Completion never lowers committed** (it moves from remaining into done). Ad‑hoc
  ADDS to the current month only (done or not); next month resets to plan + new ad‑hoc.
- **Writer (نوال)**: managed companies with a plan × 2 working days (7 → 14 days).
- **Designer**: Σ owned `posts/6 + stories/6 + aiReels/1` over managed companies
  (ownership = postOwner/storyOwner/aiReelOwner → defaultOwner).
- **Photographer**: Σ managed reels ÷ rate.
- **Publisher (عمر) — matches the daily publishing schedule**: on duty **every day
  that has publishing (7 days/week incl. Thu/Fri)**, so his **capacity = all days
  in the period**; load = one duty‑day per publishing day, costing
  `max(1, companiesThatDay / 5)` (he covers **4–5 companies/day**,
  `PUBLISH_COMPANIES_PER_DAY=5`) — only exceeds 1 when a day has >5 companies.
- Because it reads plans directly, the workload is correct **even before a
  regenerate**. UI shows a segmented done/remaining bar + free days
  (`/workload` and the home "أحمال الفريق" panel). `tracksDays` is true for all.

---

## 7. Server actions  (`src/server/actions/**`)

- **schedule.ts** — `generateSchedule(year,month)`: builds the full pipeline from
  company plans, applies reported achievements (`JUNE_2026_DONE` for 2026‑06),
  **preserves manual edits**. 🆕 Preservation now keeps, for **pinned** cards (a
  manual edit), their `title / workDate / readyDate / assigneeId / priority`
  (was board/status only) — matched by `pipelineKey|stage` — so **إعادة الجدولة
  never throws away an edit**. Keeps ad‑hoc; `clearMonthSchedule`.
- **tasks.ts** —
  - `createTask` (ad‑hoc, work‑days), `updateTaskStatus`, `moveCard(id,board)`
    (stamps start/finish, board↔status), `reassignTask` (pins), `togglePin`,
    `updatePhotoSessionStatus`.
  - **`updateTaskDetails(ids, fields)` 🆕** — the card **تعديل**: edits
    name / start (workDate) / end (readyDate) / owner / priority / status (+work‑days
    for ad‑hoc). Shared fields (owner/priority/status) apply to **all ids** of a
    batched card; name/dates to the primary. **ALWAYS pins** the edit so it
    survives regenerate. Stamps status times. Reschedules (generateSchedule) when
    priority/dates/duration changed → workloads + placement update.
  - **`deleteTasks(ids)` 🆕** — the card **حذف**: deletes a whole card immediately,
    **no** regenerate (predictable; content would otherwise be recreated from plan).
  - `deleteTask`, `updateTask` (legacy) still exist.
- **employees.ts** — `createEmployee/updateEmployee/deleteEmployee` (rates JSON via
  `buildRates`, `planDays → PLAN=1/planDays`).
- **companies.ts** — company CRUD.

`lib/schemas.ts` = Zod (employee, task with `days`+`workDate`, company).

---

## 8. Seed & scripts — NON‑DESTRUCTIVE 🆕  (`prisma/seed.ts`)

**A deploy must never wipe live data.** By default the seed:
- **Seeds a month only when it is EMPTY** (fresh DB); never deletes existing tasks.
- **Creates** missing employees/companies but does **not** overwrite existing ones
  (`update: force ? payload : {}`).
- Skips the old "delete anything not in seed‑data" cleanup.
- A full destructive rebuild requires **`SEED_FORCE=1`**.

So redeploys preserve all in‑app edits + the regenerated pipeline. To push
corrected data to a populated DB, do it **in the app** (edit / **إعادة الجدولة**)
or a deliberate migration — not the auto‑seed.

- `prisma/seed-data.json` — July 2026 dataset (pipeline cards + sessions). Carries
  per‑company **colors**. `meta.month` is 1‑based (7) → stored 0‑based (6).
- `prisma/actuals-june.json` — June actuals. Ad‑hoc items support `days`,
  `workDate`, `isPinned` (so Hla's distributed June plan reproduces on a fresh
  seed). seed.ts converts `hours = (days ?? 1) × 6` and honors `workDate`/`isPinned`.
- Scripts: `regen-july.ts` (regen July dataset), `fix-shoot-days.mjs`,
  `fix-noor-tuesday.mjs`, `distribute-hla-june.mjs` (Hla's pinned June layout).

### Team (current)
| id | name | role | hoursPerDay | workDays | scheduled |
|---|---|---|---|---|---|
| e_ayman | أيمن | designer | 6 | Sun→Thu `[0,1,2,3,4]` (off Sat) | yes |
| e_sabin | سابين | designer | 6 | Sat→Wed `[6,0,1,2,3]` | yes |
| e_hla | حلا | lead + half‑designer | **3** | Sat→Wed | yes |
| e_nawal | نوال | writer | 6 | Sat→Wed | no |
| e_omar | عمر | publisher | 6 | Sat→Wed | no |
| e_photo | المصور | photographer | 6 | Sat→Wed (no Thu) | no, isPhotographer |

### Companies (managed plan post/reel/story/aiReel · owners · color 🆕)
BW 4/4/8/0 (Ayman · blue) · Phoenitech 4/4/8/0 (Sabin · violet) ·
مخبر د.نور 6/6/8/0 (Sabin · pink) · برو 6/8/12/0 (post Sabin, story Ayman · orange) ·
المول الصيني 10/3/15/0 (Ayman · gold) · جدارات 6/0/12/6 (post/story Sabin,
ai‑reel Ayman · emerald) · التدريب 7/0/0/0 (Ayman · red).
**Design‑only / unmanaged** (no plan, no publishing — design on demand,
`defaultOwner` Hla): المدارس (teal), كابرياني (indigo). كابرياني ≈ 6 posts/week;
المدارس as tasks arrive — both entered as ad‑hoc work‑days for Hla.

---

## 9. Screens (routes)  — `src/app/**`

| Route | Shows |
|---|---|
| `/` | KPIs, **team workload burndown** (مطلوب/منجز/متبقّي/متاح), **مهام اليوم** 🆕 (grouped by person, excludes done, board‑matched labels, falls back to nearest day with work), urgent table in **work‑days**, **إعادة الجدولة** |
| `/tasks` | **Kanban board** (default) + calendar (day/week/month). **Every card has تعديل ✏️ + حذف 🗑️** 🆕. Status/board move + reassign + start/finish + late badge. Filters person/company. **مهمة مستعجلة** create |
| `/publishing` | Publishing **calendar** by `publishDate`, filters company/type, numbered (`بوست‑1…`), no‑interruption banner |
| `/workload` | Whole‑team **burndown** cards (محجوز %, منجز %, مطلوب/منجز/متبقّي/متاح, type breakdown) |
| `/reports` | **إنجاز خطة الشركات** (PUBLISHED‑only %), per‑person done lists, CSV/print |
| `/companies` | CRUD companies + plan + per‑type owners + color |
| `/team` | CRUD employees + rates (items/day) + workdays |
| `/priorities` | company priority ordering |

Reusable UI: `components/calendar/{Calendar,SideDrawer}`, `KanbanBoard`,
`MonthBar` (month switcher + regenerate), `ReportActions`, `Sidebar`,
`components/ui/*`, `components/forms/{Task,Member,Company}Form`.
`components/forms/TaskForm.tsx` 🆕 is now a generalized **edit‑any‑task** dialog
(controlled state, not react‑hook‑form): name, start/end date, owner, priority,
status; work‑days only for ad‑hoc; routes edits through `updateTaskDetails`.

Month resolution (`lib/month.ts`): `resolveActiveMonth` → a month with data;
`resolvePublishMonth` → a month with scheduled publishes.

---

## 10. Design system 🆕  (`globals.css`, `tailwind.config.ts`, `lib/utils.ts`)

- **Light theme** (Vuexy‑style). Tokens live in BOTH `tailwind.config.ts` (utility
  classes) and `globals.css` (:root CSS vars) — **keep in sync**.
- Palette: bg `#f5f7fa` (page) / `#ffffff` (cards,inputs) / `#eceff3` (elev2);
  border `#d8dde4`/`#e7ebf0`; text `#1b2733`/`#586475`/`#929cab`;
  **accent (aqua) `#0a8fa3`**, dim `#07778a`, soft `#e3f4f7`; success `#1e9e68`,
  warning `#c77e1b`, danger `#d6453b`, info `#2d72c8`.
- **Radius** tightened: DEFAULT 6 / sm 4 / lg 8 / xl 10; cards `rounded-lg`.
- **Distinct per‑company colors** (was all gold) + readable content‑type colors
  (STORY darkened to `#b07a0e`).
- **Contrast helpers** in `lib/utils.ts`: `readableOn(bg)` picks white/dark text by
  luminance (used by Avatar so initials read on any color); `withAlpha(hex,a)` for
  soft chip tints (CompanyChip). `text-bg` on accent fills resolves to near‑white.

---

## 11. Business rules (authoritative, user‑confirmed)

- **Work days**: everyone off **Thu+Fri** (Sat→Wed) EXCEPT Ayman off **Sat**
  (Sun→Thu). Photographer Sat→Wed (no Thursday shooting except special cases).
  مخبر د.نور reels shoot **Tuesday** (client availability).
- **Publishing**: all 7 days allowed (Thu/Fri OK); spread across the whole month;
  no same/consecutive‑day feed per company; posts/stories may share a day. **Omar
  publishes every publishing day** including weekends.
- **Rates** (items/day): 6 post · **6 story** · 1 ai‑reel; photographer 2 reels/3
  days; Nawal plan = 2 days/company; Omar 4–5 companies/day.
- **Workload = committed monthly load** (plan‑driven burndown, §6). Completion
  doesn't lower it; ad‑hoc adds to its month only.
- **Ad‑hoc effort is in work‑days** (§4).
- **A manual card edit is always pinned** and survives **إعادة الجدولة** (§7).
- **Achievement = PUBLISHED only** in `/reports` (a plan item counts when its
  PUBLISH stage is DONE).
- **Regenerate** (إعادة الجدولة) rebuilds the month's pipeline from plans, applies
  achievements, **preserves pinned manual edits + manual board moves**, keeps
  ad‑hoc. Run after editing plans/companies, or once after a fresh deploy.

---

## 12. Known limitations / TODO

- Auto‑generate on month‑open is intentionally NOT done (would mutate on GET).
  Regeneration is the **إعادة الجدولة** button. A fresh DB / fresh deploy seeds an
  initial state; click it per month for the full pipeline + achievements.
- Reported achievements are hard‑coded for June 2026 in `schedule.ts`
  (`JUNE_2026_DONE`); other months start empty.
- Editing the **name** of a *batched* card sets the title on its primary task only;
  shared owner/priority/status apply to the whole batch. Per‑item edits via the
  calendar (day/week) views, where items are individual.
- Designer per‑person rates live in DB `Employee.rates`; the non‑destructive seed
  won't overwrite an existing employee — change rates in **/team** (or `SEED_FORCE=1`).
- Two Prisma schema files kept in sync manually.
- Drag‑and‑drop between kanban columns not done (per‑card dropdown + edit dialog).
- Clear stale `.next/types` tsc errors with `rm -rf .next` (do it while the dev
  server is **stopped** — wiping `.next` under a running dev server corrupts it).

---

## 13. Conventions for the next session

- Work on `feature/social-publishing-schedule`; `main` is fast‑forwarded to it and
  pushed to GitLab (Vercel auto‑deploys `main`).
- After data/engine changes: `npm run typecheck && npm test && npx next build`
  (stop the dev server before `next build`), verify in preview, then commit + push.
- Don't commit `.claude/worktrees/`. Commit messages end with the Co‑Authored‑By
  trailer.
- Dates are LOCAL midnight (`toISODate` reads local Y/M/D); months are **0‑based**.
- **Never reintroduce destructive seed behavior** (unconditional `deleteMany`/
  overwrite) — see §8. **Never gate edit‑persistence on a checkbox** — manual edits
  must always pin (§7).
