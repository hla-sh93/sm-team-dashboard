# Social Media Team Dashboard — Shared Agent Handoff

> **Canonical continuity file.** Any Codex or Claude agent continuing this project must read this file completely before inspecting, changing, deploying, or reconciling data. Update the current-state sections and append a session entry before ending meaningful work.

Last updated: **2026-08-29**

Workspace: `C:\Users\hla2-\Videos\Social\sm-team-dashboard`

Production alias: <https://socialmediateam.vercel.app>

Current phase: **Worktree committed in five scoped commits and verified green (453 tests, build passes). Release blocked on adding `CRON_SECRET` to Vercel production — see §10. BRU date correction still unapplied.**

## 1. How to read this handoff

Use these evidence labels throughout the file:

- **[USER-CONFIRMED]**: explicitly stated or decided by the user. This has priority over agent interpretation.
- **[VERIFIED]**: directly checked in code, Telegram export, Instagram, local files, or the live Vercel application.
- **[LOCAL-ONLY]**: exists in the local worktree but is not proven to be deployed.
- **[LIVE]**: directly verified in the production Vercel application/database-facing UI.
- **[PENDING]**: not executed, not decided, or not verified yet.
- **[INFERENCE]**: a reasoned mapping that still needs user confirmation if it would change data.

Priority when sources conflict:

1. The user's latest explicit decision.
2. Existing live application data and implemented business rules.
3. Direct evidence from Instagram, Telegram export, and the company's content files.
4. Plans/prompts only as context. Numbers and examples in prompts are not instructions to replace live values.

Never invent a business rule. If a required value is missing, ambiguous, inconsistent, or conflicts with a requested behavior, stop and show the discrepancy to the user before changing data.

## 2. User's operating goal

The user wants one operational truth across:

1. The content/plan files under `D:\smart touch\social media plans`.
2. The latest Telegram history export.
3. The real posts on each client's Instagram page.
4. Task states and dates in the live Vercel application.

The audit must answer, company by company:

- What is ready?
- What is actually published?
- What remains?
- When must the remaining work happen?
- Does Vercel reflect the same reality and the correct responsible person?

The user does not want superficial count matching. When a discrepancy appears, open the plan and the live program, explain the exact mismatch, and let the user decide before modifying status, count, description, or business rules.

**[USER-CONFIRMED]** Vercel is the final operational target. Working locally first is acceptable, but a task is not complete until the authorized result is deployed and local/Vercel behavior and data are verified to match.

## 3. Business rules and terminology

### Contract and publishing cycle

- **[USER-CONFIRMED]** Contract/signature date is not the publishing-cycle start.
- **[USER-CONFIRMED]** The publishing cycle starts on the date of the first actual publication.
- **[USER-CONFIRMED]** The client must not be affected by the agency's internal delays.
- **[USER-CONFIRMED]** Ask the client about renewal around one week before the current publishing cycle ends.
- **[USER-CONFIRMED]** Renewal may be approved and the next cycle may enter preparation before the current cycle ends, so publication does not stop.
- **[USER-CONFIRMED]** If Telegram does not yield the first-publication date, a manager sets it manually.
- **[USER-CONFIRMED]** The user must be informed at least two days before that manually fixed first-publication date.
- **[USER-CONFIRMED]** Renewal reminders should be sent personally to the user through their Telegram bot.

### Ready versus published

- **[USER-CONFIRMED]** “جاهزة / ready” means Ayman has completed the design, or a finished reel was sent on Telegram.
- **[USER-CONFIRMED]** “منشورة / published” means the item was actually posted to the client's page.
- **[USER-CONFIRMED]** Raw photographs do not count as finished work; they are input data for design.
- **[USER-CONFIRMED]** Majed is a photographer. If a reel's Omar/publishing stage is published, previous Majed shooting and Elissar editing stages are considered completed.
- **[USER-CONFIRMED]** For a designed post, publication implies the upstream Ayman/Sabin design stage is completed according to the company assignment.

### Task/data hygiene

- **[USER-CONFIRMED]** No task should exist without a company or without corresponding content.
- **[USER-CONFIRMED]** If a planned post has no content/brief, label it `تحتاج محتوى`; do not fabricate a description.
- **[USER-CONFIRMED]** If one request contains multiple posts/designs, create each item separately with its own description.
- Existing application quantities, capacities, dates, durations, and workflows are primary; prompt examples must not overwrite them.

## 4. Source registry

### Local project and evidence

- Repository: `C:\Users\hla2-\Videos\Social\sm-team-dashboard`
- Content library: `D:\smart touch\social media plans`
- Latest known Telegram export: `C:\Users\hla2-\Videos\Social\sm-team-dashboard\tmp\telegram-export-2026-08-27\result.json`
- Program status import/reference: `C:\Users\hla2-\Downloads\program-status-updates_corrected (1).json`
- Schools brief PDF: `C:\Users\hla2-\Downloads\September Awareness Campaign2026 (2).pdf`
- Original QA request: `C:\Users\hla2-\.codex\attachments\a7cc5a45-92e4-4851-a075-a7a782812f42\pasted-text.txt`
- Contract-cycle clarification: `C:\Users\hla2-\.codex\attachments\b52edb9d-c3d6-4b1f-aa8f-4113c1a02067\pasted-text.txt`

### Instagram pages supplied by the user

| Handle | URL | Audit note |
| --- | --- | --- |
| BRU Cafe | <https://www.instagram.com/bru_cafe1/> | Managed; current company under reconciliation |
| Obada Dental | <https://www.instagram.com/obadadental/> | `مركز عبادة` and `عبادة لتجهيزات الأسنان` refer to the same client |
| Albalsam Center | <https://www.instagram.com/albalsam_center.bc/> | Managed |
| PhoeniTech | <https://www.instagram.com/phoenitech.sy/> | Managed |
| PhoeniJobs | <https://www.instagram.com/phoenijobs.sy/> | Managed |
| Mango | <https://www.instagram.com/mango.mangoo2026/> | Managed |
| BW Marketing Services | <https://www.instagram.com/bw.marketingservices/> | Managed |
| Wasl FX | <https://www.instagram.com/wasl.fx/> | Second cycle started; see company notes below |
| Agalya | <https://www.instagram.com/agalya.beauty.clinic/> | Plan finished and not renewed; no publication reconciliation needed |
| Chinese Center Mall | <https://www.instagram.com/chinese_center_mall_latakia/> | Plan finished and not renewed; no publication reconciliation needed |
| Dr Nour Lab | <https://www.instagram.com/dr.nourlab/> | Managed |
| Jadarat | <https://www.instagram.com/jadaratnet> | Managed |
| Siizen Clothing | <https://www.instagram.com/siizen.clothing/> | Managed |
| PhoeniTech Training | <https://www.instagram.com/phoenitech.training/> | Managed |

Other scope notes:

- **[USER-CONFIRMED]** Capriani and the schools are not managed publishing plans. Follow their tasks and designs only; Instagram publication matching is not required.
- **[USER-CONFIRMED]** Agalya and the Chinese mall have finished plans and did not renew. Treat their work as closed/published and do not spend audit time on them unless the user reopens them.

## 5. Company-specific facts already clarified

### Obada

- **[USER-CONFIRMED]** `مركز عبادة` means the dental-equipment company; it is the same as `عبادة لتجهيزات الأسنان`.
- **[USER-CONFIRMED]** The current content referred to in the discussion is one reel only.
- The accidental duplicate was named `عبادة للأسنان`.
- **[USER-AUTHORIZED]** The user explicitly requested permanent deletion of the duplicate.
- **[LIVE/VERIFIED]** The latest company-page inspection showed the original `عبادة لتجهيزات الأسنان` and no longer showed the duplicate `عبادة للأسنان`. Treat deletion as resolved, but re-check before any future create/delete operation.

### Wasl

- **[USER-CONFIRMED]** The second cycle has started.
- **[USER-CONFIRMED]** Nothing has been published in that second cycle yet.
- Required work is communication and preparation, followed by setting shooting and publishing dates. Do not invent those dates.

### Schools additional design requests

Treat the following as additional tasks, not as a managed social-publishing plan:

1. Back-to-school campaign: registration open; emphasize independence, hands-on learning, and classroom readiness. Original deadline: Monday, August 24, 2026.
2. KG3 admissions campaign: position KG3 admission for parents and state that it prepares the child for the Grade 1 entrance exam. Original deadline: Wednesday, August 26, 2026.
3. Mini coloring book: A5, two to three black-and-white coloring pages, colored SKM logo on the cover; possible subjects include a bus, SKM letters, a school, and children in a playground. Original deadline: Thursday, August 27, 2026.
4. Website banner: theme `Back to School` and `Admissions Open`. **[USER-CONFIRMED]** Deadline: Sunday, August 30, 2026.

- **[USER-CONFIRMED]** The discussion also confirmed six designs. Exact task-to-brief mapping must be taken from Telegram/live tasks; do not invent missing Capriani or school descriptions.

## 6. BRU audit — current reconciliation

### Confirmed package and live company configuration

- **[USER-CONFIRMED]** BRU's plan is exactly **3 posts + 8 reels + 6 stories**.
- **[LIVE/VERIFIED]** Vercel showed the same quantities: 3 posts, 8 reels, 0 AI reels, and 6 stories.
- **[LIVE/VERIFIED]** Post/story owner: Sabin. Contract owner: Michael.
- **[LIVE/VERIFIED]** The company was shown as awaiting renewal since August 18, with a displayed contract cycle of July 18 through August 17.
- Telegram topic root/thread: `2088`, title `Bru Cafe`.
- The BRU content folder was not found under `D:\smart touch\social media plans`. `social_content_inventory_seed_v2.json` contained package quantities only, not item briefs.

### Tri-source count

| Content type | Telegram evidence | Instagram reality | Vercel state last checked | Decision/state |
| --- | ---: | ---: | --- | --- |
| Reels | **6 ready reels**, after deduplicating revisions/resends | **5 published** by BRU | Reel 1-5 published; Reel 6 ready/unpublished; Reel 7-8 shooting done with edit/publish open | Accepted by user |
| Posts | **2 delivered carousels** | **2 published carousels** | Post 1-3 marked done | **Keep the extra completed post done** per user's latest instruction |
| Stories | No complete verified content set | Historical publication not fully proven | Story 1 done; Story 2-6 pending and lacking descriptions | Keep current state; missing briefs require `تحتاج محتوى` or user evidence |

Important exclusions and interpretation:

- Raw images in Telegram are excluded from “ready.”
- Re-sent/revised reel files are not counted as separate reels.
- The collaboration reel owned by `yazan_mahgazi` is not counted as BRU's own published work.
- **[USER-CONFIRMED]** Do not change BRU's counts. Keep the completed post status. The remaining authorized correction is publication dates only.

### Verified Instagram publications

The following seven items are BRU-owned publications in the audited cycle:

| Chronology | Type | Actual Instagram date/time | URL | Caption cue |
| ---: | --- | --- | --- | --- |
| 1 | Reel | 2026-07-23 23:05 Baghdad | <https://www.instagram.com/bru_cafe1/reel/DbJexZixJ6-/> | نهائي كأس العالم / أجواء BRU |
| 2 | Reel | 2026-08-02 20:04 Baghdad | <https://www.instagram.com/bru_cafe1/reel/Dbi6DIYqDud/> | ولا مشروب وولا طعمة |
| 3 | Reel | 2026-08-05 19:16 Baghdad | <https://www.instagram.com/bru_cafe1/reel/Dbqin4YKndB/> | المبدأ مبدأ |
| 4 | Post/carousel | 2026-08-11 17:34 Baghdad | <https://www.instagram.com/bru_cafe1/p/Db50I5AEb1d/> | جرعة السعادة والانتعاش |
| 5 | Reel | 2026-08-16 17:32 Baghdad | <https://www.instagram.com/bru_cafe1/reel/DcGrw79qkfl/> | برو شريككم بكل قعداتكم |
| 6 | Post/carousel | 2026-08-24 20:43 Baghdad | <https://www.instagram.com/bru_cafe1/p/DcboFEvChNM/> | المعنى الحرفي للقلب الطيب |
| 7 | Reel | 2026-08-28 18:20 Baghdad | <https://www.instagram.com/bru_cafe1/reel/DcjdEDhxd2Q/> | الزبون دايماً على حق |

Excluded collaboration/influencer item: <https://www.instagram.com/yazan_mahgazi/reel/Db8wr-fM-rG/>.

### Telegram delivery evidence used for BRU

Reel/version messages inspected:

- `3695` — 2026-07-22 — Majed — `BRU WORLD CUP_1.mp4`
- `3832` — 2026-07-23 — Majed — `bru cafe world cup reel-.mp4` (likely revision)
- `4280` — 2026-07-31 — Majed — `Bru1-7.mp4`
- `4412` — 2026-08-01 — Elissar — `bru 1-8.mp4`
- `4693` — 2026-08-05 — Majed — `bru 8-2 edited.mp4`
- `4695` — 2026-08-05 — Majed — `bru 3-8.mp4`
- `5210` — 2026-08-12 — Majed — `bru 4-8.mp4`
- `5438` — 2026-08-16 — Majed — `bru 8-2 edited.mp4` (resend/version)
- `6227` — 2026-08-22 — Elissar — `bru 3-8.mp4` (resend/final)
- `6253` — 2026-08-23 — Hla — `bru-fondant-spooncut-5s-1080p.mp4`
- `6254` — 2026-08-23 — Hla — `bru-brownie-spooncut-5s-1080p.mp4`

Design evidence:

- `4646`–`4648` — Sabin — Passion Fruit Mojito, Iced Latte, and Pro Magic. Message `4662` confirms these three slides form one post/carousel; published August 11.
- `5464`–`5467` — Sabin — two brownie and two fondant slides; one chocolate carousel; published August 24.
- Raw image ranges `4447`–`4449` and `5422`–`5427` were intentionally excluded.

### Plan documents inspected

`BRU_Shooting_Plan.pdf` contained six concepts:

1. قهوتك مو طلب... هية مود
2. ASMR القهوة
3. من الحبة للكوب — ريل سينمائي
4. تحدي الدقيقة الواحدة
5. جولة الزبون — one shot
6. الخدعة اللي توقف السكرول

`BRU - Shooting Links.pdf` contained four reel inspiration links and one post inspiration link. Inspiration links are not publication proof.

### Live Vercel task findings

- August 2026 filter: 17 open BRU tasks, all TODO, with no done cards in that month view because completed July-bucket tasks are excluded by carryover behavior.
- July 2026 filter (`?y=2026&m=6`, zero-based month): 17 open and 28 done.
- Done publication cards: Reel 1-5, Post 1-3, and Story 1.
- Reel 6: shoot/edit done; publish TODO. This is the logical ready-but-unpublished sixth Telegram reel.
- Reel 7-8: shooting done; editing and publishing TODO.
- Story 2-6: design/publish TODO and no descriptions.
- July report task remains TODO.
- Existing Vercel dates were scheduled dates rather than actual Instagram dates.
- Existing reel descriptions contain duplicates: Reel 1/Reel 3 share the “قهوتك مود” idea; Reel 2/Reel 4 share ASMR; Reel 5-8 map to the remaining shooting-plan concepts. Do not rewrite them without a user decision.

### Date corrections authorized but not applied

**[USER-CONFIRMED]** Keep the completed post status and correct the dates only. The currently proposed chronological mapping is:

| Vercel card | Correct actual date |
| --- | --- |
| Reel 1 | 2026-07-23 |
| Reel 2 | 2026-08-02 |
| Reel 3 | 2026-08-05 |
| Reel 4 | 2026-08-16 |
| Reel 5 | 2026-08-28 |
| Post 1 | 2026-08-11 |
| Post 2 | 2026-08-24 |
| Post 3 | Leave completed and leave its current date unchanged; no third BRU-owned Instagram post was verified |

**[PENDING]** None of these seven production dates has been changed yet.

## 7. Why the dates were wrong

**[VERIFIED]** The application historically stores the planned publishing date when a user confirms publication:

- `src/app/publishing/publishing-client.tsx`: `markPiecesPublished` does not collect an actual date in the UI.
- `src/server/actions/tasks.ts`: `markPiecesPublished(ids, date?)` falls back to the task's planned `publishDate` when no explicit date is supplied.

Therefore “published” could be correct while the displayed date remained the old schedule date.

## 8. Local code work prepared for publication-date correction

The following four changes are **[LOCAL-ONLY]**, unstaged on top of the broader staged QA work, and not deployed:

1. `src/lib/schemas.ts`
   - Added optional validated `publishDate` to `taskDetailsSchema`.
2. `src/server/actions/tasks.ts`
   - Added `publishDate` to `TaskDetailsInput` and update handling.
   - When an explicitly supplied actual publication date belongs to an already-done card, the same date updates `finishedAt` and `completedAt` without changing status, board, title, or task identity.
   - Date edits trigger schedule regeneration so preservation rules are exercised.
3. `src/components/forms/TaskForm.tsx`
   - Added an Arabic `تاريخ النشر` date input only when editing a CONTENT/PUBLISH card.
4. `tests/operations-e2e.test.ts`
   - Added regression coverage proving the actual date can change while PUBLISHED/DONE state and content remain unchanged.

Test evidence:

- RED: the focused test initially failed because `publishDate` was rejected as an unknown field.
- GREEN: `npx vitest run tests/operations-e2e.test.ts` passed **25/25** after implementation.
- A targeted TypeScript run excluding the unrelated duplicate `tmp/worktrees` tree passed.
- Standard `npm run typecheck` still encountered unrelated duplicate-worktree/baseline errors under `tmp/worktrees/task-descriptions`; do not misreport this as a defect in the four-file date patch.

## 9. Earlier deep QA stabilization work

A major QA stabilization set already exists in the worktree as **53 staged files** (approximately 2,888 insertions and 874 deletions). It must not be silently mixed with a small production data/date change.

Main outcomes documented in `docs/qa/FINAL_QA_REPORT.md` and `docs/qa/CHANGELOG_QA.md`:

- Removed a P0 deployment hazard: `npm run build` had previously allowed schema/data mutation and repair/import operations. Build is now compile-only; schema rollout is explicit.
- Made Telegram webhook and three cron boundaries fail closed when secrets are missing or wrong.
- Preserved completed/pinned work and publication dates across regeneration.
- Added strict runtime validation for task detail edits.
- Neutralized CSV formula injection.
- Upgraded/fixed Next.js 15 compatibility and dependency advisories.
- Added security headers, accessible month controls, and an app icon.
- Added a fail-closed test-database guard.
- Added concurrency, HTTP boundary, timezone, load, regeneration, and tooling-safety coverage.
- Final recorded QA baseline: **452/452 tests passing in 40 files**, typecheck/lint/schema validation/build passing at the end of that audit, valuable local DB hash unchanged.

Known risks from the QA report remain important:

- The employee mutation surface is intentionally open; public exposure is sensitive.
- First-run admin ownership can be claimed if credentials are not configured.
- Telegram/cron sends have no durable idempotency ledger.
- PostgreSQL-specific concurrency/failure behavior is not fully proven.
- Workflow enums and some logical identities rely on application rules rather than DB constraints.
- There is no Prisma migration history; production uses explicit guarded `db push`.

Read these before making architectural or deployment changes:

- `docs/qa/FINAL_QA_REPORT.md`
- `docs/qa/CHANGELOG_QA.md`
- `docs/qa/BUSINESS_RULES.md`
- `docs/qa/FEATURE_INVENTORY.md`
- `docs/qa/DOMAIN_FLOW_MAP.md`
- `docs/qa/TEST_MATRIX.md`
- `DEPLOY.md`
- `tasks/plan.md`

## 10. Deployment state and blocker

- **[VERIFIED]** Latest production deployment inspected:
  - ID: `dpl_FCubNnaU4H8U9r7zo1MzCJQpoZTb`
  - Deployment URL: <https://socialmediateam-33y74g7lg-sebaalsaeed03-7448s-projects.vercel.app>
  - Production alias: <https://socialmediateam.vercel.app>
  - Status: Ready
  - Created: 2026-08-29 08:41 Baghdad
- **[VERIFIED]** The production edit dialog still did not contain `تاريخ النشر`, proving the four-file date UI patch was not live at the time of inspection.
- Two ordinary deploy attempts failed during upload with `fetch failed`.
- A full-workspace archive deploy hung and was terminated.
- A clean temporary deployment copy was created at `tmp\vercel-date-deploy-20260829-2024` with 309 files and current tracked contents.
- Deployment of that copy was not allowed because it would publish the full repository, including 53 broader staged changes, while the user had only authorized BRU date correction. Do not bypass that safety boundary.
- `vercel env run` did not expose the required production database secrets locally, so direct production DB mutation was not available.
- Telegram-bot token access was discussed but no token availability or value was verified in the retained evidence. Do not assume access, and never copy a token into this file.

**[PENDING USER DECISION]** Before deployment, the user must explicitly choose whether to deploy the complete current local worktree (the 53 QA files plus the four date files), or authorize a safely isolated release plan. Do not assume that approval from the request to correct dates.

### 2026-08-29 update — worktree committed, and a hard release blocker found

**[VERIFIED]** The dirty worktree no longer exists. All work is committed in five scoped commits on
`codex/qa-deep-stabilization`, so nothing can be lost between agents and any scope can be reverted alone:

| Commit | Scope | Author of the work |
| --- | --- | --- |
| `28b7ec9` | QA stabilization (read-only build, fail-closed secrets, Next 15, Zod, CSV, headers, guards) | Codex |
| `5042963` | Regeneration-reality guard (completed cards keep their real dates) | Claude |
| `136754f` | Actual publication-date correction (schema, action, form, test) | Codex |
| `b53cb24` | This shared handoff record + agent pointers | Codex, extended by Claude |
| `e7cc220` | `tsconfig` excludes `tmp/` so the local build gate works at all | Claude |

**[VERIFIED]** Clean-tree verification after committing: `npx vitest run` → **453/453 in 40 files**;
`npm run build` → **succeeds** (Next 15.5.21, all routes compiled). The local DB hash is unchanged.

**[VERIFIED] 🔴 RELEASE BLOCKER — deploying as-is silently kills all three Telegram reports.**

- `vercel.json` schedules four crons: daily brief (two waves), weekly digest, and the 17:00 done report.
- Commit `28b7ec9` correctly made every cron route **fail closed**: when `CRON_SECRET` is absent the route
  now returns `503` before doing any work.
- **`CRON_SECRET` does not exist in the Vercel production environment.** A production env listing shows only
  `TELEGRAM_WEBHOOK_SECRET` and `TELEGRAM_BOT_TOKEN` alongside the Postgres/Neon variables.
- The code currently live in production (`5c3e9e1`) fails **open** — it skips the check when the secret is
  missing — which is the only reason the reports run today.

Therefore: **deploy this branch without adding `CRON_SECRET` first and the morning brief, the weekly digest,
and the 17:00 done report all stop.** They would fail as `503` inside Vercel's cron log, with no message in
Telegram — the failure mode is silence, which is the hardest kind to notice.

Required release order (do not reorder):

1. Add `CRON_SECRET` to the Vercel **production** environment. Vercel automatically sends
   `Authorization: Bearer $CRON_SECRET` on cron invocations once that variable exists, so no code change is
   needed. The value must be generated and entered by the user — an agent must not create or handle it.
2. Merge/deploy the branch.
3. Verify each cron route answers `401` to an unauthenticated request (proving fail-closed is live) and that
   the next scheduled report actually arrives in Telegram.
4. Verify the production edit dialog now exposes `تاريخ النشر`, then apply the seven BRU dates from §6.

**[VERIFIED]** Deploying is otherwise *safer* than the current production state: the old build ran
`prisma db push --accept-data-loss`, imported a local snapshot, and executed roughly thirty data-repair
scripts on every deploy. After `28b7ec9` the build only compiles, so a deployment can no longer overwrite
production data — which is also what protects any live reconciliation work from being erased by the next push.

## 11. Exact next actions

1. Read this file and run `git status --short`; preserve all existing user work.
2. Ask/confirm the deployment scope if it has not been explicitly answered after this handoff.
3. Once deployment scope is authorized, deploy safely and verify the production edit dialog exposes `تاريخ النشر`.
4. Apply only the seven BRU actual dates listed above. Do not change counts, descriptions, assignees, or statuses; keep Post 3 done and unchanged.
5. Re-open Vercel and verify every corrected card, plus BRU aggregate counts and states.
6. Send the user the completed BRU report: ready, published, remaining, and due/overdue items.
7. Continue to the next company only after the user accepts BRU, because the user requested company-by-company reconciliation.

## 12. Safety constraints for the next agent

- Never publish, send Telegram messages, post to Instagram, or mutate external data merely to inspect it.
- Browser access to social pages is read-only unless the user separately authorizes an action.
- Do not expose Telegram tokens, database URLs, cookies, or Vercel secrets in logs or this file.
- Do not delete, reset, or overwrite the dirty worktree. The 53 staged files and four unstaged date files are intentional and have different scopes.
- Do not use a prompt example to replace real plan quantities or dates.
- Do not treat an influencer/collaboration post as the agency's work without ownership/content evidence.
- Do not use raw photos as completion evidence.
- When evidence conflicts, present the plan, Telegram item, Instagram publication, and Vercel card side by side before changing anything.

## 13. Continuity protocol for Codex and Claude

This file is the single shared state record. `AGENTS.md` and `CLAUDE.md` both point agents here.

At the start of every agent session:

1. Read `CLAUDE_HANDOFF.md` completely.
2. Inspect `git status --short` and the “Exact next actions” section.
3. Verify any external state that may have changed since `Last updated`.

Before ending meaningful work:

1. Update the header's `Last updated` and `Current phase`.
2. Update only affected current-state sections; preserve explicit user decisions.
3. Append a dated entry to the session log below with agent, evidence checked, files/data changed, tests, deployment, blockers, and next action.
4. Clearly distinguish local-only work from live Vercel changes.

If Claude works in another clone or a cloud-only chat, this file will not synchronize automatically. Commit/push it with the project or give Claude this file directly. When both agents use this same local folder, changes are shared immediately.

## 14. Session continuation log (append-only)

### 2026-08-29 — Claude — Worktree committed, build gate repaired, release blocker found

- **[VERIFIED]** Committed the entire dirty worktree as five scoped commits (table in §10) so no work can be
  lost between agents and each scope is independently revertible. Working tree is now clean.
- **[VERIFIED]** Repaired the local build gate: `tmp/worktrees/task-descriptions/` is a second full copy of
  the repository, and TypeScript was compiling both, so `npm run build` failed on duplicate declarations.
  `tmp/` is git-ignored, so Vercel never saw it — the *local* gate was broken while the real one was fine,
  which is the worst arrangement: verification fails for a fake reason and gets ignored. `tsconfig.json` now
  excludes `tmp` and `.generated`; the build passes.
- **[VERIFIED] 🔴 Found the release blocker documented in §10:** `CRON_SECRET` is absent from Vercel
  production while the new cron routes fail closed on a missing secret. Deploying without adding it first
  stops all three Telegram reports silently. Not deployed; awaiting the user.
- Removed the four `scripts/.diag-*.ts` scratch files (session diagnostics for the date defect, now closed)
  and the `prisma/.audit-copy.db` working copy.

### 2026-08-29 — Claude — Deep test pass and regeneration-reality guard

Lane: local code/scheduling correctness. **No production access, no Telegram send, no Instagram action, no deployment.** Did not touch `src/lib/telegram/*` — matching remains Codex's lane.

- **[VERIFIED]** Data safety first: fingerprinted copy of `prisma/dev.db` taken before any work —
  `backups/dev.db.FULL-TEST-20260829-195829` (sha256 `563799…8744e`). The earlier
  `backups/dev.db.FULL-TEST-20260811-200211` (`231382…0ce1be`) is also retained. The local DB hash is
  unchanged by every run below; all mutating work used isolated copies.
- **[VERIFIED]** Defect found and fixed — regeneration was falsifying the record of completed work. Two
  causes, both in the post-preservation re-timing step:
  1. Work dates of **completed** cards were snapped onto the assignee's working days, so reels Majed
     actually shot on Friday 2026-07-31 were rewritten to 2026-07-29.
  2. Completed montage cards were re-dated to "the day after the shoot", so BW Reel 68's montage,
     finished 2026-08-10, was rewritten to 2026-08-04.
  Rule applied: **a completed card's date is a record, not a plan.** Only impossible states are still
  corrected (montage dated before its footage exists; montage of a published piece dated after its
  publication).
- Files changed (all inside the 53 staged): `src/lib/schedule-retime.ts` (new — the two re-timing
  functions moved out of the `"use server"` file so they are directly unit-testable),
  `src/server/actions/schedule.ts`, `src/lib/pipeline-preservation.ts` (completed cards now keep
  work/ready dates, not only pinned ones), `scripts/deep-audit.ts`, `tests/regen-reality.test.ts` (new).
- **[VERIFIED]** `scripts/deep-audit.ts` fingerprint was itself wrong and hid this: it compared exact
  timestamps for every card, so legitimate re-planning of open cards produced noise. It now compares the
  *settled* reality only (status, stage, owner, brief, notes, piece number for all cards; dates for
  completed/pinned cards) by local calendar day.
- **[VERIFIED]** Results: `npx vitest run` → **453/453 in 40 files**; `scripts/deep-audit.ts` on an
  isolated copy → **57/57, zero failures** (the previously failing "regeneration did not alter the
  recorded reality" check now passes). Original DB hash re-verified unchanged after both.
- **[VERIFIED]** The new `tests/regen-reality.test.ts` is a permanent guard, not a one-off repair: four
  synthetic unit cases plus a full two-pass regeneration against an isolated copy of the real database,
  asserting no completed or pinned card changes date, status, owner, or brief.
- **[INFERENCE]** This interacts positively with the matching lane: cards Codex marks done in production
  will keep their real dates if anyone presses إعادة الجدولة there. Before this fix they would have moved.
- **[PENDING]** Commit scope. 53 staged QA files + 4 unstaged date-patch files + 3 new handoff files are
  all uncommitted on `codex/qa-deep-stabilization` while two agents share the worktree. Recommended:
  separate commits per scope (QA stabilization / regeneration-reality guard / publish-date patch /
  handoff docs) so a later regression is attributable. Awaiting the user's decision.
- **[PENDING]** Evidence trail for live status edits. Section 5 records an authorized production company
  deletion, and an earlier Codex session transcript shows task statuses being set through the production
  admin UI. Such UI-driven closures leave no `notes` evidence string, which is the project's existing
  rule for why a card is closed, and they are not reflected in the local database. Flagged for the user;
  not acted on.

### 2026-08-29 — Codex — Shared handoff created

- Consolidated the conversation's business rules, company URLs, task definitions, source paths, BRU evidence, exact Instagram dates, Telegram messages, Vercel state, code changes, QA baseline, deployment blocker, and next actions.
- Added `AGENTS.md` and `CLAUDE.md` as minimal automatic pointers to this canonical file.
- No production deployment, Vercel task mutation, Telegram action, Instagram action, company deletion, or BRU date change was performed in this documentation step.
