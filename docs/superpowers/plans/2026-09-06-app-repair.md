# App Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This document authorizes no implementation or deployment; the current user request is planning only.

**Goal:** Resolve the six audit findings and triage every warning while preserving existing workflows, recorded work, and approved business rules.

**Architecture:** Make small, independently reversible changes. Separate admin action authorization from internal regeneration used by employee task updates; keep reporting fixes read-only. Treat data repair and environment changes as separate operations from code deployment.

**Tech Stack:** Next.js 15, TypeScript, Prisma (SQLite locally / PostgreSQL in production), Vitest, Vercel.

**Spec:** `docs/qa/APP_STATE_DEEP_TEST_2026-09-06.md`, `CLAUDE_HANDOFF.md`, and the user's September 6 request to plan fixes without harming existing code or introducing regressions.

## Global constraints

- This turn changes documentation only. No application code, dependency, environment variable, database value, or deployment is changed.
- Fixing software bugs eventually requires code changes. Zero regression risk cannot be promised; explicit tests, small releases, and rollback reduce the risk.
- Keep employee access and currently authorized task operations working. No new login requirement for employee workflows.
- Preserve completed/published statuses, actual dates, owners, briefs, evidence, quantities, pinned appointments, contract cycles, salaries, capacities, and workdays unless an explicit item-level correction is approved.
- Never replace production with the older local database. The prior 555-test baseline includes a stale local data snapshot; do not treat it as fresh production proof.
- No schema changes, bulk dependency upgrade, full-database restore, global reschedule, or Telegram test send bundled into a bug-fix release.
- New authenticated production export remains subject to the earlier approval-review restriction. The present planning request is not approval for that export.
- Before implementation, record the current production deployment ID/commit, branch state, and approved data snapshot timestamp. Audit counts may have changed.
- A code rollback does not roll back data or environment configuration. Maintain separate recovery steps for each.

## Delivery sequence

| Stage | Deliverable | Intended production data effect |
|---|---|---|
| 0 | Baseline, isolated test environment, reversible release setup | None |
| 1 | Trusted audit exit codes and updated obsolete assertions | None |
| 2 | Protected direct regeneration with preserved employee workflow | None merely from deploying |
| 3 | Archived-match display and explicit timezone | Read/query/render behavior only |
| 4 | Accurate lateness classification | Display/report counts change; task values do not |
| 5 | Dependency-reference preservation during future cleanup | Only on an explicitly invoked cleanup operation |
| 6 | Dependency and build-tool maintenance | None |
| 7 | Reviewed, separate operational repair payload | Exactly the approved before/after row changes |
| 8 | Vercel release, read-only live checks, rollback readiness | None merely from deploying; normal live usage/cron can continue |

## Task 0: Establish a trustworthy baseline

**Files/evidence:** Existing audit report; `tests/_helpers/test-database.ts`; both Prisma schemas; current production deployment metadata. Use an isolated checkout at execution time and test-marked disposable databases.

- [ ] Record the starting source commit and production deployment ID. Preserve unrelated work and avoid sharing generated Prisma clients with another active worker.
- [ ] Obtain an approved fresh snapshot or clearly document that data repair cannot proceed on fresh evidence. Keep raw backups out of source control.
- [ ] Create a disposable SQLite copy and a disposable PostgreSQL database for parity/concurrency checks. Production credentials must never be used by mutation tests.
- [ ] Fingerprint the valuable local database and the copied baseline.
- [ ] Run the existing gates in order, recording exit codes:

```powershell
npm run db:generate
npm test
npm run typecheck
npm run lint
npm run build
npm run db:generate
```

- [ ] Save expected immutable fields per task ID: status/board, actual completion dates, owner, brief, evidence, piece identity, completed dates, and all pinned dates. For reporting/security-only fixes, require every business row to remain unchanged.

**Acceptance:** Reproducible baseline, verified isolated database target, no production writes. The historical 555 passing tests are a minimum reference, not a substitute for a current run.

## Task 1: Make audit failures dependable — B06 and obsolete checks

**Modify:** `scripts/deep-audit-snapshot.ts`, `scripts/deep-audit.ts`.
**Test:** Add `tests/snapshot-audit-cli.test.ts`; retain `tests/tooling-safety.test.ts`.
**Interface:** Snapshot CLI exits 0 for valid/clean input and nonzero for failed checks, invalid JSON, or unreadable input; detailed diagnostic text stays available.

- [ ] Write subprocess tests using sanitized clean/failing fixtures; assert the child exit status, not just printed text.
- [ ] Reproduce current failure: a snapshot with a dangling dependency prints an error and exits 0.
- [ ] Add the minimal failure status after logging:

```ts
if (failed > 0) process.exitCode = 1;
```

- [ ] Replace obsolete legacy assertions with current rules: photographer capacity from stored rates, editor availability based on the implemented role/assignment policy, and no mandatory publishing cycle for a zero-plan training company. Do not weaken structural checks to accommodate bad data.
- [ ] Run the CLI against the saved snapshot; it must still report unresolved operational findings and now return a failing status.
- [ ] Commit only audit tooling and its tests.

## Task 2: Protect direct regeneration without breaking task edits — B01

**Modify:** `src/server/actions/schedule.ts`, `src/server/actions/tasks.ts`, `src/server/actions/companies.ts`, `tests/server-action-exposure.test.ts`, `tests/access-control.test.ts`, `tests/operations-e2e.test.ts`.
**Create:** `src/server/schedule-engine.ts` (ordinary server-side module, no `"use server"` directive).
**Interface:** Browser-exported `generateSchedule(year, month)` requires admin. Internal `generateScheduleInternal(year, month, companyId, allowEmptyRebuild)` remains callable only by trusted server orchestration and retains its existing argument/return contract.

**Critical compatibility finding:** `tasks.ts` currently calls `generateSchedule` after create, edit, and delete; `companies.ts` also calls it. Simply adding `assertAdmin` to that function would break legitimate unauthenticated employee operations.

- [ ] Add a test that an unauthenticated direct regeneration returns unauthorized before any database access/write.
- [ ] Add tests that authorized admin regeneration works and employee create/edit/delete still complete their expected internal regeneration. Verify rejected task inputs cannot reach regeneration.
- [ ] Move existing engine implementation/helpers into the ordinary module without changing scheduling arithmetic or preservation logic.
- [ ] Route internal task/company callers through that module, after their existing validation and permission rules. Do not create a second public bypass export.
- [ ] Keep the public wrapper small:

```ts
export async function generateSchedule(year: number, month: number) {
  try { await assertAdmin(); }
  catch { return { ok: false as const, error: "غير مصرّح" }; }
  return generateScheduleInternal(year, month, null);
}
```

- [ ] Preserve `generateCompanySchedule`'s guard and scoped behavior. Remove `generateSchedule` from the intentionally-public action allowlist.
- [ ] Run access-control, server-action exposure, operations, concurrent generation, and regeneration-preservation tests. On an isolated baseline, old/new engine output must match for identical inputs.
- [ ] Commit the boundary fix separately. Deployment alone must not call regeneration.

## Task 3: Correct archived Telegram match display — B04

**Modify:** `src/app/TodayView.tsx`, `src/app/today/today-client.tsx`.
**Test:** Add `tests/today-delivery-display.test.ts`.
**Interface:** Continue passing the operational live task set for scheduling; additionally provide a minimal map of task labels referenced by displayed deliveries, including archived tasks.

- [ ] Add a failing render test with a delivery linked to a completed task from an ended cycle that is absent from the live task array.
- [ ] Query referenced task IDs in one batched lookup and pass only label fields required by the display. Do not add these historical tasks into the daily work queue.
- [ ] Render four distinct cases: matched active task; matched archived task; task reference no longer resolvable; no match. Show “ما طابق شي” only for the last case.
- [ ] Test no-match and text-message behavior, and verify the undo action remains tied to the actual persisted relationship. Do not invoke undo during live verification.
- [ ] Require no change to ingest matching, task states, evidence, or counts. Commit separately.

## Task 4: Align server/client times and daily boundaries — B03

**Modify:** `src/app/TodayView.tsx`, `src/app/today/today-client.tsx`; reuse existing date helpers where compatible.
**Create if needed:** `src/lib/business-time.ts` for business timezone conversion without changing date-only task semantics.
**Test:** Add `tests/today-timezone.test.ts`; extend current date tests.
**Interface:** One named business timezone, `Asia/Baghdad`, formats Telegram instants and computes UTC bounds for a Baghdad day. Existing date-only task fields are not globally reinterpreted.

- [ ] Add tests for the same instant rendered on a UTC server and Baghdad browser, with identical expected text.
- [ ] Add boundary cases: September 5 at 20:59:59Z belongs to September 5 Baghdad; 21:00:00Z belongs to September 6. Include both inclusive day start and exclusive next-day start in the query tests.
- [ ] Use explicit timezone formatting, for example:

```ts
new Intl.DateTimeFormat("ar", {
  timeZone: "Asia/Baghdad", hour: "2-digit", minute: "2-digit",
}).format(new Date(sentAt));
```

- [ ] Use the same business-day bounds for `todayISO` and the delivery query. Do not shift stored task timestamps or suppress hydration warnings to conceal the defect.
- [ ] Run UTC/Baghdad/New York focused tests and a real-browser load against isolated data containing Telegram deliveries.
- [ ] Accept only if message times do not change after load and the Today reproduction no longer logs React #418. Commit separately.

## Task 5: Separate actionable lateness from blocked/client delay — B02

**Modify:** `src/lib/constants.ts` call sites as needed; `src/app/overview-client.tsx`, `src/app/reports/page.tsx`, `src/app/publishing/publishing-client.tsx`, `src/lib/telegram/done-report.ts`, and the located `KanbanBoard.tsx` consumer. Inspect Today and brief consumers for consistent use.
**Create if needed:** `src/lib/task-lateness.ts` as the contextual policy owner.
**Tests:** Existing task-state/daily-work/report suites plus `tests/task-lateness.test.ts`.
**Interface:** Return a classification rather than erase all overdue signals: `done`, `notDue`, `blocked`, `clientExempt`, or `actionableLate`; include the overdue day count separately.

- [ ] Write a table of test cases: done, future-pinned, due today, genuinely late, direct/transitive unfinished predecessor, missing predecessor, dependency cycle, paused/archived company, client exemption, and ordinary active company.
- [ ] Preserve current legitimate due-date and pin rules. Reuse the dependency traversal policy; do not independently invent a different graph interpretation.
- [ ] Exclude paused/archived companies from actionable publishing overdue prompts. Retain contractual delay visibility where needed with explicit blocked/client-delay labels.
- [ ] Apply the classification consistently to employee accountability counters, while keeping production-ready and publication totals unchanged.
- [ ] Compare all affected screens and mocked Telegram reports against the same fixture; count differences must be explained by specific reclassified task IDs.
- [ ] Require zero database changes. Commit and review independently of schedule/data corrections.

## Task 6: Preserve dependency history during cleanup — B05

**Modify:** Relevant cleanup paths in `src/server/actions/companies.ts` and scheduling cleanup logic only where the reproduction proves the same issue.
**Tests:** `tests/operations-e2e.test.ts`, `tests/data-integrity.test.ts`, new focused cleanup regression cases if useful.
**Interface:** Cleanup either commits all intended changes with consistent surviving references, or rolls back all changes on failure.

- [ ] Reproduce a paused company with one open writer and a completed design referencing it; confirm cleanup leaves a dangling ID today.
- [ ] Within a transaction, enumerate intended removals and surviving dependants before deletion.
- [ ] Preserve a durable note containing the removed predecessor identity and cleanup reason; detach only the now-obsolete edge on surviving completed cards. Never mark the removed predecessor completed or imply the original dependency was fulfilled.
- [ ] Test completed card status/date/owner/brief preservation, idempotent repeated cleanup, manual-task preservation, and rollback on injected failure. If a surviving **open** card depends on a deleted row, refuse that cleanup until an explicit replacement dependency is defined.
- [ ] For the historical eight rows, prepare a separate dry-run payload with exact IDs and before/after changes. Apply only after checking current live state; do not assume eight rows still need repair.
- [ ] Commit prevention code separately from any one-time repair payload.

## Task 7: Address every remaining warning in separate work items

| Warning | Implementation/check | Acceptance |
|---|---|---|
| Stale October stages/dates | On fresh isolated data, regenerate only the target month; produce exact added/moved/deleted row diff | Expected missing EDIT stages restored; no off-day production; publication dates and completed/pinned records unchanged unless explicitly approved |
| September 9 overload | Include CONTENT and ADHOC commitments, stored rates, and client availability; present concrete alternatives | Lead chooses appointments; no automatic capacity increase, reassignment, or pinned-date movement |
| Blank briefs | Match each unique piece to approved plan/evidence; propagate confirmed text across stages via validated payload | No invented copy, duplicated pieces, or changed package quantities; unknown briefs remain explicitly unresolved |
| Seven dependency advisories | Inspect current audit and each upstream release note; update one dependency/transitive parent at a time, normally within compatible ranges | Advisory removed or accurately bounded; full tests/build pass; Word export and CSS tooling verified when affected |
| SQLite/PostgreSQL generated client mismatch | First make environment/generation commands coherent; prefer minimal script correction over broad client architecture rewrite | Local test client and deployed runtime provider are explicit; compile-only build retained; both schemas validate |
| PostgreSQL coverage | Use a disposable PostgreSQL database for concurrent generation, duplicate publish confirmation, and transactional rollback | No duplicate logical task identities or partial writes |
| Browser/accessibility coverage | Exercise main workflows in supported desktop/mobile layouts; check keyboard navigation and accessible names | No new blocking console errors, clipped controls, keyboard traps, or unlabeled critical actions |
| Public employee mutation surface | Preserve the documented access decision and inventory the allowed operations | No accidental new public admin capability; accepted risk documented |
| Exposed-secret warning | Owner privately verifies/rotates the affected secret and updates legitimate consumers | Old credential rejected, replacement works through approved existing flow, no secret in logs |
| Local/live drift | Record snapshot/deployment metadata and use isolated copies; keep automatic backup sync from overwriting the test baseline | No local-to-production overwrite and no reliance on a moving snapshot |
| Legacy audit drift | Task 1 corrects obsolete assertions; still surface true data exceptions | No hardcoded superseded capacity or missing-editor false alarm |

Dependency changes must include lockfile review and a scoped commit. Do not run `npm audit fix --force`. Do not send Telegram messages to test these changes without specific send authorization.

## Task 8: Release gates and rollback

- [ ] Per bug: demonstrate the reproduction fails before the fix and passes afterward. For read-only fixes, verify zero database writes.
- [ ] Run the entire suite, typecheck, lint, build, schema validation, targeted timezone tests, and relevant PostgreSQL integration checks on the actual release commit.
- [ ] Regenerate an isolated representative snapshot twice: verify idempotency, exact approved additions, no deleted history, no changed settled/pinned business fields, and preserved capacity/contract settings.
- [ ] Deploy a preview using an isolated database and no live outbound integrations. Verify employee create/edit/delete and admin regeneration there—not on production.
- [ ] Record the known-good production deployment. Review the exact source commit, environment-variable names/scopes, build command overrides, and schema diff before a production release.
- [ ] Deploy code without applying repair payloads or triggering scheduling. Run read-only live smoke checks and compare outcomes to the report.
- [ ] Apply separately approved data repairs in a controlled window with exact affected-row preconditions, before images, and an idempotent payload. Reload and verify; stop if current values differ from the approved before state.
- [ ] If rendering/authentication regresses, restore the known-good code deployment. If a data repair fails, use a scoped inverse repair after checking intervening edits; never restore the full database over new team work.
- [ ] Environment rollback must preserve valid credentials. Never reinstate an exposed secret merely because an older deployment used it.

**Completion means:** Each bug has a regression test and verified outcome; each warning is either resolved or explicitly accepted with evidence. No claimed universal “zero bugs,” no unexplained record changes, and no statement of live completion based solely on local tests.

## The Vercel message in the screenshot

The message confirms an environment variable was saved. Existing deployments keep their previous configuration; a new deployment is needed to use the changed variable. It is informational, not an application error. See [Vercel's environment-variable documentation](https://vercel.com/docs/environment-variables/managing-environment-variables).

The inspected repository build command is `prisma generate --schema=prisma/schema.postgres.prisma && next build`: it contains no database push, import, seed, or repair command. A redeploy of this reviewed code with the same database connection should not erase data or reschedule tasks. The screenshot does not identify the variable, deployment source, environment scope, or any Vercel build override, so unconditional safety cannot be inferred.

| Variable changed | Potential effect after redeploy |
|---|---|
| `CRON_SECRET` | Backup/cron authentication changes. The local backup client must use the matching value; old credentials should fail. Scheduled jobs may resume normal operation once configured |
| `DATABASE_URL` | App may connect to a different database or fail to connect. An apparently empty app can mean a different database, not deleted records |
| `AUTH_SECRET`, `ADMIN_PASSWORD`, related admin settings | Login/session behavior may change; existing sessions can become invalid |
| Telegram token/webhook secret | Ingest or delivery may fail until the matching provider/client configuration is updated |
| Other application setting | Effect depends on the code reading that setting |

Ask for **the variable name and Production/Preview scope only**, never its value. If the pending change is credential rotation, do not postpone activation merely to bundle it with unrelated bug fixes; verify the intended source revision and dependent clients, then handle it as a separate configuration release. No Redeploy button was clicked during planning.

## Plan review

- [x] All six findings map to Tasks 1–6.
- [x] Every warning from the audit has an explicit work item, acceptance criterion, or retained coverage limit.
- [x] Direct regeneration authorization preserves internal employee-triggered regeneration.
- [x] UI fixes do not silently rewrite historical data or approved business rules.
- [x] Data repair, environment activation, and code rollback are separate procedures.
- [x] Present turn is documentation-only; execution starts only when requested.
