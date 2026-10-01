# Business Rules

## Enforcement comparison

| ID | Rule currently enforced | UI | Server / service | Database | Agreement / assessment |
| --- | --- | --- | --- | --- | --- |
| BR-001 | Employee operational pages are open; sensitive configuration/finance pages require one admin session | Navigation splits shared/admin routes | Admin layout verifies HMAC; sensitive actions call `assertAdmin` | No user/role model | Intentional, documented, but internet exposure gives every visitor task-write authority |
| BR-002 | Admin password minimum is six characters and email is normalized | Login form | Auth action and hashing logic | Setting is arbitrary text | UI/server aligned; DB cannot express it |
| BR-003 | Session expires after seven days and is HttpOnly/SameSite=Lax; Secure in production | Cookie invisible to UI JS | HMAC token and expiry checked per admin render/action | Secret stored in Setting or env | Consistent; no revocation list; password change rotates DB-backed secret |
| BR-004 | A deployment with no admin config enters first-run creation | Login renders setup mode | First caller can set credentials | No installation/setup lock | Intentional but security-sensitive race |
| BR-005 | Company name is required and unique | Form validation | Zod and Prisma create/update | Unique constraint | Consistent; duplicate error is generic |
| BR-006 | Company plan counts and money are non-negative | Numeric form constraints | Zod | Int/Float with no check constraint | Server is authoritative; direct DB writes can violate |
| BR-006a | The record's plan counts are the plan of the LAST registered cycle; a cycle that has a later cycle registered after it keeps the piece counts of its existing cards on every regeneration. A cycle's count changes only through the standalone `planCounts` payload (last cycle only; reductions refused when the dropped pieces carry work or a brief) | Company form edits the record | `lib/cycle-plan.ts` + `server/cycle-plan.ts`, applied in `generateScheduleInternal`, the achievement panel and the Word-plan count check; `planCounts` block in `plan-update.ts` | No per-cycle column | Since 2026-10-01 (BW October plan: 8 posts while the September cycle was still running); integration-covered in `tests/cycle-plan.test.ts` |
| BR-007 | Company lifecycle is active / paused-by-client / archived-not-renewed; `contractEndedAt` alone makes a company archived, and only an active company can be paused or resumed; «جدّد» and «لم يُجدد» are available on any non-archived company at any time (since 2026-10-01), and «جدّد» on a paused company without a cycle resumes it with a new cycle | Select + companies page sections | `company-visibility.ts` lifecycle helper used by every filter; pause/resume actions refuse archived companies | String default only | Single helper since 2026-09-15; DB weaker than UI/server |
| BR-008 | Plan content types are POST, REEL, AI_REEL, STORY | Select/generated logic | Constants/Zod/pipeline | Nullable String | DB weaker |
| BR-009 | Contract cycles do not auto-renew; each later cycle requires an explicit renewal | Company actions | `contract.ts`, scheduler | Renewals stored as JSON string | Code-only; malformed JSON degrades to fallback/empty behavior |
| BR-010 | `publishStartDate`, not signature date, anchors publishing cycles | Company form/docs | Contract/scheduler helpers | DateTime nullable | Consistent; null intentionally means signed but not publishing |
| BR-011 | `contractEndedAt` prevents cycles at/after the end decision | Admin action | Contract logic | DateTime nullable | Code-only relationship to renewal JSON |
| BR-012 | Paused/archived companies are not regenerated; a paused company's cards are parked and hidden, an archived company's open cards are closed (CANCELED with evidence) automatically by «لم يُجدد», the archive button, the form status, or the companies-page reconciliation | UI status / archive section | Regeneration excludes dormant IDs; `company-lifecycle.ts` closes open work | No constraint | Critical preservation rule; integration-covered |
| BR-013 | Deleting a company with work is refused; empty company can be deleted | Confirmation UI | Action checks dependent counts | FK cascade would delete dependents | Application is safer than DB cascade; direct DB delete is destructive |
| BR-014 | Workdays are JS `getDay()` integers and default to Sat-Wed | Team form | Date parsing/scheduler | JSON string | Invalid JSON/value sets fall back in code; DB cannot validate |
| BR-015 | Rates are per-day JSON and default by role/type | Team/workload | Capacity parser | JSON string | Code-only; free-text role inference can misclassify |
| BR-016 | Ad-hoc work costs at least half a day (4 hours) | Form exposes days | Create/update clamps | Float default 0 | DB allows zero; server action consistent |
| BR-017 | A content piece is identified by company + type + piece number + cycle, not calendar month or current date | Labels | Pipeline preservation and Telegram matching | No composite unique constraint | Critical code invariant only |
| BR-018 | Generated piece deletion is represented by CANCELED across all production/publish stages and must survive regeneration | Delete confirmation | `deleteTasks` and preservation | String state, no constraint | Code-only; matching fallback is complex but tested |
| BR-019 | Manual task delete is physical; generated content delete is soft/preserved | UI does not expose storage detail | `deleteTasks` branches by `isAuto` | No soft-delete column | Intentional but easy to misunderstand |
| BR-020 | Status and board mirror each other for normal transitions | Kanban/status controls | `statusToBoard`, action logic | Two independent strings | DB can store impossible combinations; read helpers deliberately tolerate legacy drift |
| BR-021 | READY and PUBLISHED count as done; completion timestamps also make legacy rows done | Reports/cards | `isTaskDoneState` | Nullable timestamps | Intentionally tolerant; contradictory rows remain possible |
| BR-022 | A PUBLISH-stage READY transition normalizes to PUBLISHED | Publishing UI | `normalizeStatusForStage` | No rule | Consistent through normal action only |
| BR-023 | Publishing a piece closes open DESIGN/SHOOT/EDIT predecessors | Publishing UI | `completeProductionForPublishedTask` | Soft `blockedById`, no FK | Multi-step update is transactional for predecessors but publication update and predecessor completion are not one encompassing transaction in every action |
| BR-024 | A completed card's historical work/publication dates, evidence, brief, and timestamps survive regeneration | No explicit UI indicator | Preservation overlay | Replacement destroys rows unless code restores fields | Critical; regression defect fixed during this audit |
| BR-025 | A manual edit always pins the task so regeneration keeps it | Edit form | `updateTaskDetails` forces pin | Boolean | Server stronger than UI checkbox semantics |
| BR-026 | `manualDay == today` promotes; future manual day hides; past manual day expires logically | Overview editor | `daily-work` selection | DateTime nullable | Consistent in code; no automatic clearing |
| BR-027 | Reels follow WRITE → SHOOT → EDIT → PUBLISH; non-reels omit EDIT | Card UI | Pipeline expansion | Stage String | Code-only state machine |
| BR-028 | Open work dates must fall on assignee workdays; completed work dates record reality even on off-days | Calendar | Retime/snap helpers | DateTime | Intentional distinction; regression-covered |
| BR-029 | Publish dates are anchors; prior production may move earlier but publication does not move later to hide impossible history | Reports/calendar | Pipeline/retime/preservation | DateTime | Critical chronology rule |
| BR-030 | Publishing week is Sat-Wed and Friday is excluded | Publishing view | Constants/scheduler/weekly digest | No rule | Strong unit coverage |
| BR-031 | Photographer batches contain 2-3 reels where feasible and delivery follows shoot within configured lead | Calendar | Photographer engine | No check constraint | Engine warns on unsatisfiable live inputs rather than fabricating dates |
| BR-032 | A Telegram update is idempotent by message identity | Not visible | Ingest upsert/duplicate detection | TelegramMessage ID is PK | Strong E2E coverage |
| BR-033 | Telegram matching prefers explicit canonical name/brief and must not guess across a closed or ambiguous piece | Admin diagnostics | Asset/match logic | No constraint | Strong adversarial unit coverage |
| BR-034 | Matched Telegram delivery closes the correct production stage and writes evidence in notes | Today/admin view | Ingest | Task/TelegramMessage linked only by string | Atomicity between message and task requires DB-flow verification |
| BR-035 | Telegram POST must be authenticated; malformed payload returns 200 to suppress provider retries | No UI | Route fails closed with 503 when the secret is absent and 401 when wrong | No DB rule | UI/backend are aligned after QA fix; malformed authenticated JSON is acknowledged without ingest |
| BR-036 | Cron notification endpoints must accept only the configured bearer secret | No UI | Route fails closed with 503 when `CRON_SECRET` is absent and 401 when wrong | Env only | HTTP boundary tests cover all three routes |
| BR-037 | Telegram messages longer than 4096 chars are split; one failed part does not block later parts | No UI | Client/service | No send ledger | Delivery retry may duplicate successful parts |
| BR-038 | Employee reports contain no finance; finance route is admin-only | Separate navigation | Separate route components | Same underlying tables | Access-control tests cover route/nav structure |
| BR-039 | CSV escapes separators/quotes, neutralizes formula-prefixed untrusted strings, and emits UTF-8 BOM | Download button | CSV utility | N/A | Numeric negative values remain numeric; security regression covered |
| BR-040 | Local and production Prisma models must stay identical except datasource/generator | N/A | Schema-sync test | Two schema files | Passing; no migrations or DB-level enum/check constraints |
| BR-041 | Build verification compiles code without changing schema or application data | N/A | Package `build` now only generates the production Prisma client and runs `next build` | No DB write | Schema rollout/import/repair are explicit operator commands and a tooling test guards this boundary |

## Ambiguities and inconsistencies

- `Task.kind`, `type`, `priority`, `status`, `board`, and `stage` are strings in both databases. UI and server validation are stronger than persistence and cannot prevent out-of-band invalid values.
- Company deletion is protected in the action but configured as cascading in the schema.
- The product intentionally gives unauthenticated visitors full shared task/schedule mutation. This is a specification, not silently reclassified as a bug, but it is a high deployment risk if the app is public.
- First-run admin setup is unauthenticated by design. A public deployment can be claimed by the first visitor.
- No idempotency record exists for scheduled Telegram sends.
- There is no Prisma migration history; deployment uses an explicit guarded `db push`, so populated-schema evolution still requires operator review and backup.
