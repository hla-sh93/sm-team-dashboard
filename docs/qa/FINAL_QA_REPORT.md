# 1. Executive Summary

The application is internally coherent enough to freeze as a development
baseline, subject to the explicit operational and coverage limitations in this
report. The audit removed one P0 data-loss hazard from the build, fixed several
P1 data-integrity/security defects, expanded critical concurrency and HTTP
boundary coverage, and completed real-browser login/navigation/logout checks on
an isolated database.

Final automated result: **452/452 tests passed in 40 files**, with zero failures,
reported skips, or known flaky tests. Typecheck, lint, both Prisma schema
validations, dependency-tree validation, and the Next.js production build pass.
The valuable local database SHA-256 remained
`2313820786325CF9EE30C8E65D24240EE8A51769B2009C75F2BA23E2AE0CE1BE`
before and after the audit suites.

This is not a claim of exhaustive production proof. PostgreSQL concurrency was
not exercised against a live disposable PostgreSQL instance, full employee UI
mutations were verified at the server-action layer rather than as a persisted
Playwright suite, and several retry/partial-failure gaps remain documented.

# 2. Repository/Stack Discovered

- Next.js **15.5.21**, App Router, React **18.2**, TypeScript **5.3**.
- Prisma / Prisma Client **5.22.0**.
- SQLite schema for local development and isolated DB-backed tests;
  PostgreSQL schema for hosted production.
- Vitest **4.1.5**; Playwright CLI used for the browser audit.
- Tailwind CSS **3.4.19**, PostCSS **8.5.23**, Zod **3.22.4**.
- Node.js **24.11.1**, npm **11.6.2**, Windows x64 audit host.
- Seven models: Employee, Company, Task, PhotoSession, Setting, TelegramChat,
  and TelegramMessage.
- No Prisma migration history; production schema rollout uses explicit guarded
  `db push`.
- No real social-provider publishing adapter, file-upload subsystem,
  subscription/entitlement system, queue/worker, or audit-log model was found.
  “Publishing” is an internal workflow/state confirmation.
- One shared workspace: Company records are clients, not security tenants. The
  root employee area is intentionally open; one password-protected admin area
  owns finance/company/team settings.

# 3. Test Environment

- Audit branch: `codex/qa-deep-stabilization`.
- Starting branch/commit: `feat/stage-model` at
  `5c3e9e15a520adc33dada10c4b53d0f3e3a9f5ac`.
- Pre-existing dirty files were recorded in `tasks/plan.md` and preserved.
- The active `.env` points to valuable `prisma/dev.db`; it was never used for
  destructive tests.
- DB-backed tests copy the SQLite database into process-specific files and
  inject those files into Prisma. A new fail-closed guard requires `test` or
  `e2e` in the SQLite filename or PostgreSQL database/schema before a mutating
  test may create a client.
- Full-suite runs fingerprinted `prisma/dev.db` before and after. The hash was
  identical.
- Browser tests used `prisma/test-browser-e2e.db`, test-only admin credentials,
  an isolated auth secret, and empty Telegram delivery credentials. The server,
  browser session, copied DB, and generated Playwright artifacts were removed
  afterward.
- Telegram senders and ingest functions were mocked for route tests. No real
  message, publication, email, SMS, push, or billable action was sent.
- PostgreSQL schema validation used a syntactically valid test-marked dummy URL;
  it did not connect to a database. Lack of disposable PostgreSQL credentials is
  a stated limitation.

# 4. Feature Coverage

Examined domains include:

- employee and admin navigation, login, cookie sessions, middleware, page and
  server-action authorization;
- company and employee CRUD, ownership relations, archive/end/renew behavior;
- task creation/edit/delete, board/status transitions, quantities, pinning,
  completion timestamps, predecessor completion, and carryover;
- contract cycles, renewals, plan changes, deterministic scheduling, writer /
  design / shoot / edit / publish pipelines, photographer batching, capacity,
  workload, off-days, and regeneration preservation;
- publishing calendar and duplicate publication confirmation;
- finance calculations/snapshots and admin-only exposure;
- reports, CSV export, search/filter helpers, progress, and daily-work views;
- Telegram matching, ingest, idempotency, reports, webhook boundary, and three
  cron notification routes;
- SQLite/PostgreSQL schema parity, referential/data integrity, build/deploy
  scripts, dependency advisories, browser headers, responsive navigation, and
  basic accessibility.

The detailed route/action/entity mapping is in `FEATURE_INVENTORY.md`,
`DOMAIN_FLOW_MAP.md`, and `BUSINESS_RULES.md`.

# 5. Automated Coverage

- **Unit:** scheduler, contracts, dates, capacity, pipeline, progress, finance,
  cards, matching, validation, CSV, auth primitives, and utilities.
- **Integration:** server actions against a disposable SQLite copy, schema/seed
  checks, task lifecycles, Telegram ingest, and regeneration against a copy of
  the current real-world data shape.
- **HTTP boundary:** 12 cron/webhook authentication and malformed-payload tests
  with all external side effects mocked.
- **Database/integrity:** schema parity, orphans, duplicate deterministic keys,
  enum/state drift, cycle membership, piece numbering, impossible timestamps,
  and valuable-database fingerprint checks.
- **Concurrency:** simultaneous duplicate company creation, simultaneous month
  generation, and duplicate publication confirmation.
- **Timezone:** 53 date/scheduler tests executed independently under UTC,
  Europe/Amsterdam, and Asia/Riyadh.
- **Load:** 120 synthetic companies producing more than 8,000 scheduled tasks.
- **Browser:** anonymous admin redirect, login, protected finance/team routes,
  employee task route, session-cookie flags, mobile drawer, Escape close,
  logout/cookie deletion, accessibility names, favicon, and zero console errors.
- **Tooling:** build mutation guard, headers guard, lint, typecheck, both schema
  validations, npm dependency-tree checks, audit, and production compilation.

See `TEST_MATRIX.md` for covered, partial, N/A, and remaining gap scenarios.

# 6. Bugs Found

## QA-001 — P0 — Build could mutate or destroy production data

- **Feature/scenario:** normal `npm run build` during deployment.
- **Expected:** compile only.
- **Actual:** schema push used `--accept-data-loss`, then snapshot import and
  dozens of repair/reconciliation scripts ran before compilation.
- **Root cause:** operational migrations were appended to the build command.
- **Fix:** build now only generates the PostgreSQL Prisma client and runs
  `next build`; schema rollout is an explicit non-data-loss operator command.
- **Regression:** `tests/tooling-safety.test.ts` rejects mutation/import/repair
  tokens in the build script.

## QA-002 — P1 — Telegram webhook authentication failed open

- **Feature/scenario:** POST while the webhook secret was missing.
- **Expected:** refuse all updates.
- **Actual:** request bypassed authentication and reached ingest.
- **Root cause:** secret comparison was conditional on the secret existing.
- **Fix:** missing configuration returns 503; wrong secret returns 401.
- **Regression:** `tests/http-boundaries.test.ts` covers missing, wrong, correct,
  and malformed authenticated requests.

## QA-003 — P1 — Cron authentication failed open

- **Feature/scenario:** invoke daily brief, done report, or weekly digest with no
  `CRON_SECRET` configured.
- **Expected:** no sender invocation.
- **Actual:** every route called its sender.
- **Root cause:** bearer authentication was only applied when a secret existed.
- **Fix:** all routes fail closed with 503 when unconfigured and 401 when wrong.
- **Regression:** nine parameterized HTTP cases verify sender call counts.

## QA-004 — P1 — Regeneration could rewrite recorded work/publication dates

- **Feature/scenario:** regenerate after completed or pinned pipeline work.
- **Expected:** recorded reality and manual authority remain unchanged.
- **Actual:** generated dates could replace completed work/ready dates and a
  completed or pinned publish date.
- **Root cause:** preservation restored dates only for selected pinned fields;
  completed dates and publishDate were incomplete.
- **Fix:** completed work/ready/publish dates and pinned publish dates are
  restored from persisted rows.
- **Regression:** focused preservation cases plus two full regenerations on an
  isolated copy of `dev.db`.

## QA-005 — P1 — Direct task detail action accepted invalid enums

- **Feature/scenario:** call `updateTaskDetails` directly with arbitrary
  priority/status strings, bypassing the form.
- **Expected:** reject before mutation.
- **Actual:** arbitrary strings could reach string-backed database columns.
- **Root cause:** TypeScript shape was trusted at a server-action boundary.
- **Fix:** strict Zod validation now covers enums, ISO-shaped dates, IDs, ranges,
  quantities, booleans, and unexpected keys.
- **Regression:** invalid direct-action values return failure and leave the row
  byte-for-field unchanged.

## QA-006 — P1 — CSV formula injection

- **Feature/scenario:** export a user-controlled title beginning with `=`, `+`,
  `-`, or `@`.
- **Expected:** spreadsheet opens the text literally.
- **Actual:** spreadsheet software could evaluate the cell as a formula.
- **Root cause:** CSV escaping handled structure but not spreadsheet evaluation.
- **Fix:** formula-like string cells receive a literal apostrophe; numeric
  negatives stay numeric.
- **Regression:** malicious formula prefixes and numeric negative coverage in
  `tests/csv.test.ts`.

## QA-007 — P1 — Installed dependency advisories

- **Feature/scenario:** production dependency audit.
- **Expected:** no known critical/high runtime advisory in the selected stack.
- **Actual:** the starting Next/PostCSS/nanoid tree contained critical/high
  advisories.
- **Root cause:** stale framework/transitive versions.
- **Fix:** Next/eslint config upgraded to 15.5.21, PostCSS pinned/overridden to
  8.5.23, and optional Sharp overridden to 0.35.0.
- **Regression:** production audit now reports only one low esbuild development
  server advisory; dependency tree and build pass.

## QA-008 — P1 — Next 15 production build incompatibilities

- **Feature/scenario:** compile after the security framework upgrade.
- **Expected:** route types and cookie APIs compile.
- **Actual:** page `searchParams` types and synchronous cookie access failed the
  Next 15 build.
- **Root cause:** framework APIs became asynchronous.
- **Fix:** all nine affected pages await search params; auth awaits cookie access
  and logout cleanup.
- **Regression:** typecheck and the production build pass; affected routes were
  navigated in a real browser.

## QA-009 — P3 — Browser polish/accessibility defects

- **Feature/scenario:** load the dashboard and use month controls with assistive
  technology.
- **Expected:** clean console and named icon controls.
- **Actual:** `/favicon.ico` returned 404 and month arrow buttons were unnamed.
- **Root cause:** missing app icon and absent `aria-label`s.
- **Fix:** local app icon and Arabic button names.
- **Regression:** browser console has zero errors and the accessibility snapshot
  exposes both month control names.

# 7. Bugs Fixed

All bugs above were fixed on the stabilization branch. Additional hardening
added browser response headers, a hard test-DB guard, a real lint configuration,
explicit deployment-secret guidance, and independent concurrency tests. No
product specification was redesigned; the intentionally open employee area and
single-workspace model were retained.

Exact file-by-file changes and verifying tests are in `CHANGELOG_QA.md`.

# 8. Remaining Known Issues

1. **Public employee mutation surface (high deployment sensitivity):** root
   routes intentionally permit full task/schedule mutation without login. This
   is consistent with `PROJECT.md`, but must be restricted by network/access
   policy before public internet exposure if that trust model changes.
2. **First-run admin claim and race:** when admin credentials are not configured,
   the first visitor can create the owner identity; two first-run callers have
   no database-backed claim lock. Configure `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and
   `AUTH_SECRET` before deployment.
3. **Notification retry idempotency:** cron/Telegram sends have no durable send
   ledger. A platform retry can duplicate an already-successful message or part.
4. **PostgreSQL-specific concurrency not proven:** concurrency tests use the
   disposable SQLite path. Run the same suite against a dedicated PostgreSQL
   test schema before relying on database-specific locking semantics.
5. **Failure injection gaps:** no complete DB failure-injection proof exists for
   schedule replacement/post-update boundaries or Telegram ingest after a
   partial multi-record failure.
6. **Persistence constraints:** workflow enums are strings without DB checks;
   task/session logical identities lack comprehensive unique constraints. The
   application and audits enforce/detect them, but out-of-band writes can drift.
7. **No migration history:** production schema changes use explicit `db push`.
   Populated migrations, rollback, and recovery are not automated.
8. **Login throttle scope:** the existing throttle is in memory per process. It
   resets on cold start and is not shared across serverless instances; direct
   lockout behavior also lacks a dedicated automated test.
9. **Large-list UX:** task/report queries are unpaginated. Scheduler CPU is fast,
   but browser/database behavior at very large production row counts is not
   fully load-tested.
10. **Low dependency advisory:** esbuild 0.27.7, pulled by development tooling,
    has a low-severity Windows local-development-server advisory. It is not part
    of the production Next runtime path.
11. **Browser coverage is partly procedural:** critical auth/responsive journeys
    were automated with Playwright CLI, but no committed Playwright test project
    currently reruns them in CI.

# 9. Concurrency Findings

- Two simultaneous creates for the same company name produce exactly one
  success and one persisted row because the database uniqueness guarantee wins.
- Two simultaneous generators on an isolated real-schema copy leave one coherent
  final set with exact stage counts and no duplicate logical identities.
- Two publication confirmations for the same task both return safely, keep one
  row, leave the publish task done/published, and close predecessors once
  logically.
- Tests were made independent; the publication case creates its own fixture.
- Contract renew/end races, first-owner setup races, task lost-update/versioning,
  and multi-worker notification retries remain unproven or undefined.
- SQLite results do not substitute for PostgreSQL transaction/locking proof.

# 10. Data Integrity Findings

- Both Prisma schemas validate and model-parity tests pass.
- Read-only audits found no orphan foreign keys, self/cyclic blockers, malformed
  workday/rate JSON, unexplained enum/state combinations, duplicate live
  deterministic stage keys, invalid cycle membership, Friday auto-publishes,
  broken piece numbering, or missing scheduled owners in the current data.
- Regeneration twice on a disposable copy is stable and preserves completed /
  pinned reality.
- Company name and Telegram message identities are DB-unique. Most Task logical
  identity guarantees remain application-level.
- Company deletion is guarded in the server action even though schema relations
  include cascading behavior; out-of-band destructive SQL is not protected by
  that action.
- The valuable DB hash was identical before/after every final full-suite pass.

# 11. Scheduling/Timezone Findings

- Determinism, plan counts, no-Friday publishing, contract boundaries, explicit
  renewals, carryover, off-days, leap-year/month-end behavior, photographer
  batching, prep-week floors, canceled-piece stability, and completed/pinned
  preservation pass.
- The same 53 date/scheduling tests pass under UTC, Europe/Amsterdam, and
  Asia/Riyadh.
- Dates are primarily day-granularity local-calendar values, not arbitrary
  user/company timezone instants. The browser has no company timezone setting.
- A browser/server timezone-divergence mutation journey and explicit DST-hour
  scheduling are not fully covered; there is no time-of-day post executor in the
  discovered product.

# 12. Performance Findings

- Controlled scheduler case: 120 managed companies, 82 planned items each, more
  than 8,000 generated tasks, **84 ms observed** on this audit host.
- The regression ceiling is intentionally generous at 10 seconds to detect
  catastrophic algorithmic regression without turning CI variance into flakes.
- No evidence justified scheduler optimization.
- Reports contain a per-company query path when the viewed bucket differs from a
  company’s current cycle, and list routes have no pagination. These are
  scalability observations, not measured production regressions.

# 13. Security / Tenant Isolation Findings

- The system is single-workspace, not multi-tenant. Company records do not define
  security boundaries, so cross-tenant IDOR scenarios are not applicable as
  originally framed.
- Admin pages have middleware presence checks plus cryptographic server-side
  cookie verification; sensitive company/employee/password actions assert admin.
- Browser proof covers anonymous redirect, valid login, HttpOnly/SameSite=Lax
  cookie, protected page access, logout, and cookie removal. `Secure` is disabled
  only in local HTTP development and enabled in production.
- Cron and webhook boundaries now fail closed on missing configuration.
- Task detail mass assignment is constrained by a strict schema.
- CSV formula execution is neutralized.
- Response headers provide MIME sniffing protection, frame denial, referrer
  control, restricted camera/mic/geolocation, and HSTS.
- No secret was written to source or emitted in reports. Test credentials are
  obvious non-production values and the test DB guard never includes raw URLs in
  errors.
- The open employee mutation model and first-run claim behavior remain deployment
  risks, as documented above.

# 14. Test Results

| Gate | Total | Passed | Failed | Skipped | Flaky |
| --- | ---: | ---: | ---: | ---: | ---: |
| Final Vitest suite | 452 | 452 | 0 | 0 | 0 |
| Test files | 40 | 40 | 0 | 0 | 0 |
| Multi-timezone executions | 159 | 159 | 0 | 0 | 0 |
| Focused operations/tooling review | 26 | 26 | 0 | 0 | 0 |

Initial safe baseline execution had 428 tests with two failures in the
pre-existing untracked regeneration-reality suite: one malformed fixture and one
real preservation defect. The fixture was corrected, the product defect fixed,
and the suite expanded to 452 passing tests.

# 15. Build Status

| Check | Status | Evidence |
| --- | --- | --- |
| TypeScript | PASS | `tsc --noEmit` |
| Lint | PASS | No warnings/errors; Next notes that `next lint` must be migrated before Next 16 |
| Full regression | PASS | 40 files, 452 tests |
| SQLite schema | PASS | `prisma validate` |
| PostgreSQL schema | PASS | `prisma validate` with test-marked dummy URL; no connection |
| Schema parity/data audits | PASS | Automated schema-sync and read-only integrity tests |
| Dependency tree | PASS | Next uses PostCSS 8.5.23; Sharp 0.35.0 override resolves cleanly |
| Production audit | PASS with known low | 0 critical, 0 high, 0 moderate, 1 low development-tool advisory |
| Production build | PASS | Next 15.5.21 compiled, checked types, and generated all 18 static entries |
| Valuable DB fingerprint | PASS | SHA-256 unchanged |

The local build intentionally generated a PostgreSQL client while the protected
local `.env` remained a SQLite URL. Four caught build-time data probes logged
provider-validation errors, but compilation completed successfully and no
database was contacted or changed. A real deployment must supply a PostgreSQL
`DATABASE_URL`, as documented in `DEPLOY.md`.

# 16. Risk Assessment

**MODERATE.** No known P0/P1 defect remains unexplained in the exercised paths,
and all release gates are green. Remaining risk is concentrated in deployment
trust assumptions (open employee area and first-run claim), lack of durable
notification idempotency, absence of PostgreSQL-specific concurrency/failure
injection, string-backed workflow constraints, and migration maturity. These do
not prevent freezing the current code as a baseline, but they are not compatible
with an unreviewed public deployment or schema-heavy expansion.

# 17. Baseline Recommendation

Freeze this branch as the baseline only with the deployment prerequisites in
`DEPLOY.md`, retain the known-issues list as backlog, and require a disposable
PostgreSQL CI database before changes that depend on locking, migrations, or
multi-worker idempotency.

### READY WITH KNOWN NON-BLOCKING ISSUES
