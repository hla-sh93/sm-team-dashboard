# QA Stabilization Changelog

Audit branch: `codex/qa-deep-stabilization`  
Starting commit: `5c3e9e15a520adc33dada10c4b53d0f3e3a9f5ac`  
Audit date: 2026-08-26

This file lists changes made by the QA stabilization work. It deliberately does
not claim ownership of changes already present in the dirty worktree when the
audit began (`scripts/deep-audit.ts`, most of
`src/server/actions/schedule.ts`, `src/lib/schedule-retime.ts`, the diagnostic
scripts, and the original `tests/regen-reality.test.ts`).

| File(s) | Problem | Change and reason | Verification |
| --- | --- | --- | --- |
| `package.json`, `package-lock.json` | The build pushed the production schema with `--accept-data-loss`, imported a snapshot, and ran many data-repair scripts before compiling. Dependencies also contained critical/high advisories. | Made `build` read-only, added explicit `db:deploy:schema`, upgraded Next/eslint config to 15.5.21, pinned PostCSS 8.5.23, reused it for Next, and overrode optional Sharp to 0.35.0. | `tests/tooling-safety.test.ts`; `npm ls`; production build; production audit reduced to one low development-only advisory. |
| `.eslintrc.json` | The repository had no usable Next lint configuration. | Added `next/core-web-vitals` so lint is a real release gate. | `npm run lint` passes with no warnings/errors. |
| `src/app/page.tsx`, `tasks/page.tsx`, `reports/page.tsx`, `publishing/page.tsx`, `login/page.tsx`, `admin/page.tsx`, `admin/tasks/page.tsx`, `admin/workload/page.tsx`, `admin/finance/page.tsx` | Next 15 treats page `searchParams` as a promise; the production build failed type validation. | Awaited typed `searchParams` in all affected pages. | `npm run typecheck`; `npm run build`; browser navigation. |
| `src/lib/auth.ts`, `src/server/actions/auth.ts` | Next 15 makes `cookies()` asynchronous. | Awaited cookie access and async logout cleanup; updated framework comment. | Auth tests, typecheck, browser login/logout and cookie inspection. |
| `src/app/api/cron/*/route.ts` | All three cron routes failed open when `CRON_SECRET` was absent and could invoke real senders without authentication. | Missing configuration now returns 503; wrong bearer returns 401; only the exact configured secret invokes a sender. | `tests/http-boundaries.test.ts` (nine cron cases). |
| `src/app/api/telegram/webhook/route.ts` | The Telegram webhook failed open when no webhook secret was configured. | Missing secret now returns 503; wrong secret returns 401; authenticated malformed JSON remains acknowledged without ingest. | `tests/http-boundaries.test.ts`. |
| `src/lib/pipeline-preservation.ts` | Regeneration could replace dates on completed cards and could replace a pinned/completed publish date with the newly generated plan date. | Preserve work, ready, and publish dates for completed work; preserve publish date for pinned work. This edit was made carefully inside a file already modified before the audit. | `tests/regen-reality.test.ts`; full isolated regeneration twice; 452-test suite. |
| `src/lib/schemas.ts`, `src/server/actions/tasks.ts` | A direct server-action call could persist arbitrary priority/status strings because the TypeScript-only shape was trusted at runtime. | Added a strict Zod boundary for task detail edits, including enums, dates, ranges, quantities, and unexpected-field rejection. | New invalid-enum action regression in `tests/operations-e2e.test.ts`; schema tests. |
| `src/lib/csv.ts` | Spreadsheet applications could execute exported user-controlled cells beginning with formula characters. | Prefix formula-like string cells with a spreadsheet literal apostrophe while leaving numeric negatives numeric. | `tests/csv.test.ts`. |
| `next.config.js` | Baseline browser hardening headers were absent. | Added nosniff, frame denial, referrer policy, restricted browser capabilities, and one-year HSTS without subdomain/preload scope. | Tooling regression plus live HTTP header verification. |
| `src/components/MonthBar.tsx` | Icon-only month controls had no accessible names. | Added `type=button`, Arabic `aria-label`s, and decorative-icon hiding. | Real-browser accessibility snapshot exposes both control names. |
| `src/app/icon.svg` | Browsers requested a missing `/favicon.ico`, causing a console error. | Added a local app icon. | Browser console returned zero errors and `/icon.svg` returned 200. |
| `src/app/admin/priorities/priorities-client.tsx` | JSX text contained an unescaped quote and blocked the lint gate. | Used Arabic quotation marks without changing product behavior. | `npm run lint`. |
| `tests/_helpers/test-database.ts`, `tests/test-database-guard.test.ts` | A mutating test could accidentally create a client for the valuable dev/production database. | Added a fail-closed URL guard requiring an explicit test/e2e marker and never echoing credentials. | Guard unit tests cover SQLite, PostgreSQL database/schema, missing, malformed, and production-looking URLs. |
| `tests/operations-e2e.test.ts`, `tests/telegram-e2e.test.ts`, `tests/regen-reality.test.ts` | DB-writing suites relied on convention alone. Critical duplicate/concurrent behavior lacked coverage. | Enforced the DB guard; added concurrent duplicate-company creation, simultaneous regeneration, duplicate publication, and invalid direct-detail tests. Corrected one malformed historical test fixture. | Focused suites and full suite; valuable DB hash unchanged. |
| `tests/http-boundaries.test.ts` | Cron/webhook authentication was not exercised at the real route-handler boundary. | Added fully mocked HTTP tests; no Telegram sender or ingest function can call an external service. | 12 passing route-handler tests. |
| `tests/performance-smoke.test.ts` | Scheduler load behavior was unmeasured. | Added a generous catastrophe guard using 120 companies and more than 8,000 generated tasks. | 84 ms observed locally; 10-second portable ceiling. |
| `tests/tooling-safety.test.ts` | The dangerous build behavior could regress unnoticed. | Added static release-safety and security-header gates. | Passing in focused and full suites. |
| `README.md`, `PROJECT.md`, `DEPLOY.md` | Framework version, test count, build behavior, and deployment instructions were stale or unsafe. | Documented Next 15, 452 tests, explicit schema rollout, required security secrets, safe imports, and lack of migration history. | Manual documentation reconciliation and final review. |
| `docs/qa/*`, `tasks/*` | No durable QA map or audit trail existed. | Added the feature inventory, domain map, business rules, matrix, plan, this changelog, and the final report. | Cross-checked against routes, actions, schemas, tests, browser evidence, and final commands. |

## Test-only cleanup

The Playwright session directory and `prisma/test-browser-e2e.db` were deleted
after the browser run. They were disposable generated artifacts and are not
recoverable; no application data was removed. Pre-existing diagnostic scripts
were preserved exactly because they existed before the audit.
