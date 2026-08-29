# Stabilization Plan: Deep QA Baseline Audit

## Overview

Audit the current Next.js/Prisma social-media operations system as a complete workflow, preserve the pre-existing dirty worktree, isolate every destructive test from valuable data, add meaningful regression coverage, fix only proven defects, and issue an evidence-backed baseline recommendation.

## Safety Baseline

- Starting commit: `5c3e9e15a520adc33dada10c4b53d0f3e3a9f5ac`
- Starting branch: `feat/stage-model`
- Audit branch: `codex/qa-deep-stabilization`
- Pre-existing modified files: `scripts/deep-audit.ts`, `src/lib/pipeline-preservation.ts`, `src/server/actions/schedule.ts`
- Pre-existing untracked files: `scripts/.diag-count.ts`, `scripts/.diag-inspect.ts`, `scripts/.diag-jadarat.ts`, `scripts/.diag-regen-diff.ts`, `src/lib/schedule-retime.ts`, `tests/regen-reality.test.ts`
- At audit start the repository `build` script was unsafe because it included `db push --accept-data-loss` and many mutating repair scripts. It was not run until replaced by a read-only build.

## Architecture Decisions

- Use the existing Vitest stack and SQLite-copy action-test pattern rather than replacing it.
- Introduce an explicit database safety guard before any new DB-backed tests.
- Keep the package build read-only and verify it with the Next.js production compiler.
- Mock Telegram and other external delivery boundaries; no real message or publication is permitted.
- Prioritize access control, destructive action boundaries, schedule regeneration, state preservation, date behavior, and duplicate/retry safety.

## Task List

### Phase 1: Discovery and documentation

- [x] Trace routes, server actions, schema, services, integrations, and existing tests into `docs/qa/FEATURE_INVENTORY.md`.
- [x] Map ownership, dependencies, lifecycle, and side effects in `docs/qa/DOMAIN_FLOW_MAP.md`.
- [x] Extract and compare UI/server/database rules in `docs/qa/BUSINESS_RULES.md`.
- [x] Build a risk-based scenario catalogue in `docs/qa/TEST_MATRIX.md`.

### Checkpoint: Discovery

- [x] Every meaningful current feature is represented.
- [x] Unknown or partially implemented behavior is called out explicitly.

### Phase 2: Test safety and baseline

- [x] Prove the active database target is not a dedicated test database.
- [x] Add a hard test-database guard and isolated fixture strategy.
- [x] Run the existing suite safely and record exact baseline failures.
- [x] Run typecheck and lint without invoking mutating database scripts.

### Checkpoint: Safe baseline

- [x] No valuable database row has been written or deleted.
- [x] All DB-writing tests use an isolated disposable database.

### Phase 3: High-risk stabilization slices

- [x] Audit and test authentication plus privileged server actions and route handlers.
- [x] Audit and test schema guarantees, relation behavior, destructive operations, transactions, and regeneration behavior; document remaining injection gaps.
- [x] Audit and test task/pipeline state transitions, duplicate actions, preservation, and conflicting updates.
- [x] Audit and test contract cycles, scheduling, date boundaries, and timezone-sensitive behavior.
- [x] Audit and test Telegram/webhook/cron authentication, idempotency, retries, and failure handling with fakes; document send-ledger gap.
- [x] Add controlled concurrency tests for duplicate creation, schedule regeneration, and publication updates.

### Checkpoint: Critical workflows

- [x] Confirmed defects have failing regression tests before fixes.
- [x] Focused and related suites pass after each fix.

### Phase 4: UI, load, and final gates

- [x] Exercise critical employee/admin workflows in a local browser using isolated data and disabled external delivery.
- [x] Measure representative scheduler load and investigate only evidence-backed regressions.
- [x] Run safe full regression, typecheck, lint, schema validation, and Next production build.
- [x] Review the final diff for correctness, secrets, scope, and pre-existing-work preservation.
- [x] Write `docs/qa/CHANGELOG_QA.md` and `docs/qa/FINAL_QA_REPORT.md`.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Existing `.env` targets valuable data | Critical | Refuse all writes unless a hard test identifier and isolated path/DB are present |
| `npm run build` mutated data at audit start | Critical | Replaced with a read-only build and guarded by a repository safety test |
| Pre-existing dirty files overlap schedule work | High | Record them, inspect before edits, and avoid overwriting their intent |
| External Telegram calls send real messages | High | Clear delivery credentials in tests and mock the HTTP/client boundary |
| SQLite and PostgreSQL schema drift | High | Compare model semantics and validate both schemas without pushing to the active DB |
| Very broad feature surface | Medium | Risk-first slices; document every untested permutation rather than implying coverage |

## Open Questions Resolved by Repository Evidence

- Access model is a single shared employee surface plus one password-protected admin role, not per-company user tenancy.
- PostgreSQL is the deployment store; SQLite is the local/test-compatible schema.
- Telegram is the only discovered outbound integration; social publishing is tracked operationally but no provider publishing adapter is present.
