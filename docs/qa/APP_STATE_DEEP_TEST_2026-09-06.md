# App state and deep test report

**Verdict: operational, but not clean.** Core automated checks pass and the live app is usable. Six confirmed findings remain, including one high-priority authorization gap. Operational data and dependency warnings need attention before treating every dashboard number as authoritative.

Audit performed September 5–6, 2026, Baghdad time. Current local commit: `556c9db`. Production: https://socialmediateam.vercel.app. This was an audit: **no application fix, deployment, production mutation, Telegram send, or local database sync was performed.**

## Evidence and freshness

| Evidence | What it proves | Limit |
|---|---|---|
| Current local source and 555-test rerun | Current code behavior under the tested scenarios | SQLite-backed integration, not production PostgreSQL |
| Build, typecheck, lint at `04f41d0` | App compiles and static checks pass | Subsequent commit changes backup tooling, not app rendering/scheduling code; current suite was rerun |
| Production browser inspection on September 6 | Pages, displayed values, UI defects, and navigation actually observed live | Existing authenticated browser session; production commit identity not independently proven |
| Anonymous HTTP requests on September 6 | Public availability and protected route responses | No authenticated write request sent |
| `backups/prod-20260905-1026.json` | Latest available saved production data: 1,129 tasks, 16 companies, 11 employees | Exported September 5 at 10:26 Baghdad; **not a fresh September 6 export** |
| Original `prisma/dev.db` | Older local baseline for existing integrity tests | Does not match the latest saved production snapshot |

The snapshot available at the start contained 1,214 tasks and six September 9 shoots. A newer saved snapshot contains 1,129 tasks and four open shoots. The newer figures supersede the initial findings. Live task states have changed further; do not combine these snapshots into one current count.

## Clean — verified passes

| Check | Result |
|---|---|
| Full current automated suite | **555/555 passed, 51 files**, no reported skips |
| Date, cycle, delivery, daily-work tests in UTC | **55/55 passed** |
| Same tests in Asia/Baghdad | **55/55 passed** |
| Same tests in America/New_York | **55/55 passed** |
| TypeScript | Passed |
| ESLint | No lint warnings/errors; command deprecation notice remains |
| Production build | Completed successfully; local datasource warnings noted below |
| SQLite and PostgreSQL schema validation | Both passed; PostgreSQL validation did not connect to a database |
| Snapshot integrity rules | **19/23 clean**, four failing categories listed below |
| Regeneration on an isolated copy of the latest snapshot | September and October succeeded; **zero deleted rows and zero changed completed records** under the compared fields |
| Missing October montage recovery | Regeneration added exactly **8 EDIT cards**, increasing rows 1,129 → 1,137; zero October open shoots left without EDIT |
| Valuable local database protection | SHA-256 unchanged before/after all tests: `61576424DC9A975EEECAA8CFF79F001F2EE4804410D2FFF60311046D26EF3140` |

The full suite includes scheduling, contract cycles/renewals, capacities, task lifecycle and publication actions, validation, finance, backup guards, Telegram matching and mocked HTTP routes, concurrent operations, regeneration preservation, and a synthetic load test. The three timezone runs are focused reruns, not 165 additional unique tests.

The latest snapshot has no missing company/employee references, impossible start/finish ordering, DONE/status disagreement, unpinned generated cancellations, published pipelines with open production stages, or blank evidence notes on July-and-later closed publication cards. These are structural checks: a nonblank note does not independently prove that a publication happened.

### Live functional checks

- Today, tasks, publishing, reports, companies, team, finance, priorities, workload, and Telegram pages rendered.
- Task company filter successfully narrowed to Wasl. Board, monthly, weekly, and daily modes switched successfully.
- Task edit dialog loaded the existing owner, status, and dates; cancel closed it without saving.
- Compact navigation menu opened and navigation worked; wide sidebar navigation also worked.
- Anonymous `/` and `/today` returned **200**.
- Anonymous `/admin/finance` returned **307** to login.
- Anonymous backup export, plan document export, and all four cron endpoints returned **401**.
- All nine checked HTTP responses carried `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff`.

Live Today displayed 3 publications due, 4 deliveries due, 5 at risk, and 52 late. Publishing displayed 42 overdue publications. These count different things and are **not evidence of a count bug by themselves**. Workload displayed Omar at 106% monthly capacity. They are timestamped observations, not independently reconciled business totals.

## Bugs — confirmed findings

### B01 · High · Full regeneration lacks server-side admin authorization

**Evidence:** `src/server/actions/schedule.ts:573` exports `generateSchedule` from a `"use server"` module and directly invokes the internal writer. Unlike `generateCompanySchedule`, it does not call `assertAdmin`. Its UI caller is the protected priorities page. `tests/server-action-exposure.test.ts` explicitly allowlists this export, so the security test remains green.

**Expected:** Full-dataset scheduling should enforce its administrative boundary inside the server action. Protecting the page containing the button does not protect the exported action itself.

**Impact:** A caller able to invoke the action can initiate regeneration without an admin session. This is a code-confirmed authorization gap; **no live exploit or production regeneration was attempted**. Intentionally public employee actions are a separate accepted design decision.

**Fix direction:** Guard the exported entry point, retain internal scheduling logic in a non-action module, remove the public allowlist entry, and test that an unauthenticated call cannot reach persistence.

### B02 · Medium · Overdue reporting includes blocked or paused work

**Live reproduction:** Open publishing. Its overdue list includes Jadarat AI Reel 1/2 and Post 1; the live priorities page labels Jadarat paused. On the task board, Balsam Story 7 publication displays both a waiting-for-design dependency and an employee lateness badge.

**Code:** `src/app/publishing/publishing-client.tsx:77` computes overdue from all publication tasks without applying the active-company list. `src/lib/constants.ts:160` checks only completion, future pins, and deadline; it has no company/dependency context. Reports and done-report use this helper. The daily work selector separately understands dependency blocking.

**Snapshot measurement:** At a fixed September 6 evaluation date, 18 of 74 rows flagged late by the generic helper had an unfinished immediate predecessor. This is a whole-snapshot diagnostic, **not a claim that 18 of the live Today page's 52 are wrong**.

**Impact:** Client delay, blocked work, and actionable employee delay are conflated. This can misdirect follow-up and unfairly attribute delay.

**Fix direction:** Share a lateness policy that distinguishes blocked/client-exempt work from actionable delay; apply company status consistently to the publishing overdue list.

### B03 · Medium · Today has a live hydration/timezone defect

**Live reproduction:** Open Today in the Baghdad browser. A Telegram message initially rendered at 05:51 and then at 08:51 after hydration. Console records **React error #418**. The page recovers and remains usable.

**Code:** `src/app/today/today-client.tsx:366` formats the same timestamp with `toLocaleTimeString` without an explicit timezone. The server and browser can therefore generate different text. `TodayView.tsx` also derives the day boundary from server-local time.

**Impact:** Visible time changes and hydration failure are confirmed. Around midnight, an incorrect business-day boundary is an additional risk, not reproduced in this audit.

**Fix direction:** Use a shared explicit business timezone for message times and daily query boundaries, and add a server/client timezone mismatch test.

### B04 · Medium · Matched Telegram deliveries can say “nothing matched”

**Live reproduction:** Today shows Balsam files `al balsam-story-8-4.jpg`, `-5.jpg`, `-6.jpg`, and `-8.jpg` with “ما طابق شي” and an undo-match button simultaneously.

**Code:** `today-client.tsx:352` resolves `taskId` only against the displayed live task set. `TodayView.tsx` loads that set through `loadLiveTasks`, which omits completed work in finished cycles. The undo button separately tests whether `d.taskId` exists.

**Impact:** A successful match to an archived task is presented as unmatched, encouraging duplicate handling or unnecessary undo.

**Fix direction:** Load referenced delivery tasks independently of the live schedule, or distinguish “matched to archived task” from genuinely unmatched media.

### B05 · Medium · Latest saved snapshot contains eight dangling dependencies

**Reproduction:** Run `npx tsx scripts/deep-audit-snapshot.ts backups/prod-20260905-1026.json`. Eight PhoeniTech DESIGN cards have `blockedById` values whose tasks are absent from the snapshot. The earlier 10:16 snapshot had zero such references.

**Impact:** The dependency graph is inconsistent. `daily-work.ts` treats a missing blocker as no gate; in this snapshot the company is paused and the dangling cards are historical, so immediate active-work impact is limited.

**Likely cause:** Pause/cleanup deletes open generated tasks while preserving completed dependants. The pause path in `companies.ts` does not repair surviving dependency references. This causal attribution is an inference from the code and snapshot change; the failing references themselves are directly verified.

**Fix direction:** Preserve historical dependency evidence or explicitly detach surviving references in the same transaction as cleanup. Do not reopen or delete completed work to make the check green.

### B06 · Low · Snapshot audit reports failure but exits successfully

**Reproduction:** The snapshot audit prints four failed categories but the script itself returns exit code **0**. Its final statement logs the failure count without setting `process.exitCode`.

**Impact:** A scheduler or CI job relying on exit status can report a clean audit while the text contains failures.

**Fix direction:** Set a nonzero exit code when `failed > 0`, and keep the detailed findings in the output.

## Warnings — operational and coverage risks

| Warning | Evidence / significance | Next action |
|---|---|---|
| Stale October schedule | Latest snapshot has **1** production task on Saturday, **5** publisher work dates on days off, and **8** open Jobs shoots without montage cards | Review an October regeneration preview. Isolated regeneration restored all 8 montage stages; no production regeneration was performed |
| September 9 overbooking | Latest snapshot: Majed has **4** open CONTENT/SHOOT cards, **1.33 days** at 3/day; this checker excludes ad-hoc load | Resolve actual shoot commitments with the lead; do not silently move pinned appointments |
| Missing briefs | Latest snapshot: **30 open CONTENT rows** have blank briefs; live Jobs also shows missing-plan placeholders | Reconcile against the approved plan; count is stage rows, not unique pieces |
| Dependency advisories | Full `npm audit`: **7 affected packages — 4 high, 1 moderate, 2 low**, no critical | Update individually and rerun relevant tests. These are package counts, not proven application exploits |
| Production-only advisory result | `npm audit --omit=dev`: **2 low**, zero moderate/high/critical | Findings are esbuild and postcss-selector-parser; exploitability depends on their use. Four high results are absent from the production-only result |
| Historic exposed backup/cron secret warning | September 3 handoff says the credential was a published example; rotation has not been independently verified here | Owner should verify rotation privately; successful 401 checks do not prove secret strength |
| Intentional public employee writes | Employee task mutations remain public by documented design | Treat public URL exposure as an accepted operational risk; do not silently change the access model |
| Audit script drift | Legacy deep audit returns **46 pass / 9 fail** on an isolated local copy | Do not call these nine new bugs: some assert superseded rules, e.g. Majed 6/day, an editor `isScheduled` flag, and mandatory Training cycle cards |
| Build/runtime mismatch | Build generates PostgreSQL client while local `.env` identifies SQLite; prerender attempts emit datasource warnings although build succeeds | Separate generated clients or use a coherent build environment. SQLite client was restored after the build |
| Local/live drift | Local DB is byte-unchanged but older than latest saved production; live UI changed further | Keep evidence dates explicit; never apply local statuses to production blindly |
| Incomplete production proof | No disposable PostgreSQL concurrency test, cross-browser matrix, exhaustive accessibility audit, real Telegram send, or live mutation suite | Remaining coverage is explicit; automated server-action tests cover mutations on disposable SQLite copies |

Full dependency findings: brace-expansion, browserslist, js-yaml, vite (high); fflate (moderate); esbuild, postcss-selector-parser (low). Advisory identifiers, ranges, and available fixes are saved in `2026-09-05/npm-audit-current.json`; production-only results are in `npm-audit-production.json`.

## Recommended order

1. Fix B01 and verify private credential rotation.
2. Fix lateness classification, Telegram match display, and timezone rendering (B02–B04).
3. Repair dangling references with history preservation; make the audit exit code trustworthy (B05–B06).
4. Review October regeneration and September 9 capacity against current live data, then apply only approved operational corrections.
5. Update affected dependencies in small changes and repeat the full test/build gates.

## Audit limitations and artifacts

A fresh authenticated production export was blocked by automatic approval review because it uses a local credential to download the complete sensitive database. No fresh export was obtained, and that restriction was not bypassed. Browser inspection and anonymous route checks were completed instead. A fresh full-data rerun requires explicit approval for that export.

Supporting files are under `docs/qa/2026-09-05/`: `tests-current.log`, `build.log`, `lint.log`, `typecheck.log`, three `timezone-*.log` files, `public-http.json`, `snapshot-latest.log`, `data-detail.json`, `regen-snapshot.json`, `deep-audit.log`, and both current dependency audit JSON files. Log files are git-ignored but remain available locally.

The report and continuity update are **local-only**. All live findings above are read-only observations; no claim is made that fixes were deployed.
