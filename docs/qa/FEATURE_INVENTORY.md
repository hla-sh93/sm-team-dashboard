# Feature Inventory

Audit baseline: commit `5c3e9e1`, branch `codex/qa-deep-stabilization`, inspected 2026-08-26.

## Product boundary discovered

This is a single-workspace Arabic/RTL operations dashboard for one social-media team. It is not a SaaS tenant platform: there is no `User`, membership, workspace, subscription, entitlement, or provider-publication entity. Employees share an intentionally open operational surface; one HMAC-cookie admin identity protects financial, company, employee, Telegram-configuration, workload, and priority screens. “Publishing” records and closes work in the database; it does not call Instagram or another social network.

## Routes

| Area | Route | Purpose | Access |
| --- | --- | --- | --- |
| Shared | `/` | Monthly overview, progress, task mix, schedule generation | Open employee surface |
| Shared | `/today` | Daily work queue and status updates | Open employee surface |
| Shared | `/tasks` | Calendar/Kanban task management | Open employee surface |
| Shared | `/publishing` | Publication queue and publication confirmation | Open employee surface |
| Shared | `/reports` | Operational achievement reports and CSV | Open employee surface |
| Auth | `/login` | First-run admin creation, login | Public |
| Admin | `/admin` | Admin copy of overview | Valid signed admin session |
| Admin | `/admin/today` | Admin copy of today | Valid signed admin session |
| Admin | `/admin/tasks` | Admin copy of tasks | Valid signed admin session |
| Admin | `/admin/publishing` | Admin copy of publishing | Valid signed admin session |
| Admin | `/admin/reports` | Admin copy of reports | Valid signed admin session |
| Admin | `/admin/companies` | Company, plan, owner, contract CRUD | Valid signed admin session |
| Admin | `/admin/team` | Employee/capacity CRUD | Valid signed admin session |
| Admin | `/admin/workload` | Capacity and allocation analysis | Valid signed admin session |
| Admin | `/admin/priorities` | Company priority ordering | Valid signed admin session |
| Admin | `/admin/finance` | Revenue, salary/cost, profit views | Valid signed admin session |
| Admin | `/admin/telegram` | Chat linking, recipient, webhook, manual brief | Valid signed admin session |
| HTTP | `/api/telegram/webhook` | Telegram update ingest and authenticated diagnostics | Telegram secret boundary |
| HTTP | `/api/cron/daily-brief` | Two-wave daily brief sender | Vercel cron secret boundary |
| HTTP | `/api/cron/done-report` | Daily completed-work sender | Vercel cron secret boundary |
| HTTP | `/api/cron/weekly-digest` | Weekly publish-plan sender | Vercel cron secret boundary |

## Feature catalogue

| Domain / feature | Screens and entry points | Server/API path | Services / logic | DB entities | Preconditions and inputs | Outputs / transitions | Permissions | Dependencies / failure points | Existing coverage at discovery |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Monthly overview | `/`, `/admin` | Server component reads Prisma; `updateDailyTasks`; `generateSchedule` | `schedule-data`, `scheduler`, `progress`, `daily-work`, `month` | Company, Employee, Task, PhotoSession | Valid year/month query; seeded data | Counts, progress, queues; optional schedule replacement | Shared mutation by product design; admin route additionally session-gated | Full-table reads, current/carryover selection, regeneration side effects | Acceptance, progress, daily-work, operations E2E |
| Today queue | `/today`, `/admin/today` | `updateTaskStatus`; Telegram `undoMatch` in admin/shared component | `live-tasks`, `daily-work`, task state helpers | Task, Employee, Company, TelegramMessage | Current day and workdays; task may be pinned/manual | Prioritized per-person queue; status timestamps; optional match rollback | Task updates intentionally open; Telegram action internally admin-gated | Browser/server timezone, stale card IDs, simultaneous updates | Daily-work, task-state, Telegram E2E; no browser automation |
| Task CRUD | `/tasks`, `/admin/tasks`, `TaskForm` | `createTask`, `updateTaskDetails`, `deleteTask(s)`, `reassignTask`, `togglePin` | Zod schemas, date conversion, schedule regeneration | Task and related Company/Employee | Manual task input, IDs, status, dates, effort | Create/update/soft-cancel/delete; timestamps and board normalized | Intentionally open shared functionality | Server actions accept direct calls; batch atomicity and stale updates | Schemas, operations E2E, lifecycle, task-state |
| Kanban and piece workflow | Task views, `KanbanBoard` | `moveCard`, `setStageDone`, `setPieceReviewed`, `updateTaskStatus` | `cards`, `pipeline`, `pipeline-preservation`, constants | Task | Board/status/stage identifiers | `TODO → DOING → REVIEW → DONE`; completion timestamps; predecessor completion for published work | Intentionally open shared functionality | DB stores strings, so invalid states depend on action validation; repeated/conflicting calls | Pipeline, piece-cards, lifecycle, task-state |
| Daily manual mix | Overview/day UI | `updateDailyTasks` | `daily-work` | Task | Promote/demote ID sets and ISO day | Sets/clears `manualDay`, pins promoted cards | Intentionally open | ID overlap, future/past semantics, capacity conflict | Daily-work and operations coverage |
| Automatic schedule generation | `MonthBar`, admin priority screen | `generateSchedule` | `scheduler`, `photographer`, `pipeline`, preservation, retime, contract, capacity | Company, Employee, Task, PhotoSession, Setting | Year/month, valid plans/owners/workdays | Atomic replacement of active auto tasks/sessions; ad-hoc re-dating afterward | Intentionally open shared functionality | Destructive replace; transaction timeout; post-transaction partial ad-hoc failure; concurrent regeneration | Extensive unit/system/operations/regeneration tests; concurrency gap |
| Content pipeline | Generated cards | Within `generateSchedule` | `expandPipeline`, `applyPipelinePreservation` | Task | Company plan and type ownership | WRITE → DESIGN or SHOOT → EDIT for reels → PUBLISH | Shared | `blockedById` is not an FK; identity relies on company/type/piece/stage; regenerated IDs | Pipeline, system-relations, regeneration tests |
| Photographer/session planning | Task calendar | Schedule generation; `updatePhotoSessionStatus` | `photographer`, dates/capacity | PhotoSession, Task, Company, Employee | Reels, photographer, workdays/preferred day | Batches reels, shoot/delivery dates, warnings, session status | Shared status change | No unique session key; DB strings permit invalid status outside actions | Photographer, dates, system-relations |
| Publishing tracking | `/publishing`, admin copy | `markPiecesPublished`, `updateTaskStatus` | `publishing`, `progress`, month carryover | Task | Publish-stage cards; optional explicit date | Marks publication and production predecessors done; no provider call | Intentionally open | Duplicate calls, partial batch update, user-provided date, no external truth source | Publishing/operations/Telegram tests; concurrency gap |
| Company/plan CRUD | `/admin/companies` | Company actions | schemas, contract, content-source | Company and dependent Task/PhotoSession | Admin session; plan counts, dates, owner IDs | Create/update/archive/delete; regeneration after relevant edits | Admin assertion on every action | Unique name; deletes cascade at DB but action refuses if work exists; owner IDs only FK-validated | Access-control, schemas, operations E2E |
| Contract lifecycle | Company screen | `renewContract`, `endContract`, `archiveCompany` | `contract`, scheduler | Company, Task | Publish start, renewal date, end decision | Explicit cycles; late renewals create real gaps; archive pauses generation | Admin | JSON renewal history lacks DB shape constraint; concurrent renew/end | Contract and operations tests |
| Employee/capacity CRUD | `/admin/team` | Employee actions | schemas, capacity, workload | Employee, Company owner links, Task | Admin; name, role, workdays, rates, salary | Create/update/delete; FKs set null on deletion | Admin | Free-text role drives assignment; JSON workdays/rates; deletion changes ownership | Access-control, schemas, workload, operations coverage |
| Company priorities | `/admin/priorities` | `reorderCompanies`, then generation | scheduler | Company, Task | Ordered ID list | Transactionally updates numeric priority; can regenerate | Admin for reorder; generation itself open | Missing/duplicate IDs; list races | Limited direct integration coverage |
| Workload/capacity | `/admin/workload` | Read-only server component | `workload`, `capacity`, live tasks | Employee, Task, Company | Month and existing dated tasks | Per-person load, availability, over-capacity | Admin page | Full in-memory calculation; role/rate parsing fallbacks | Strong unit coverage |
| Finance | `/admin/finance` | Read-only server component | `finance` | Company, Employee, Task | Contract values, salaries, reel costs | Revenue, fixed/variable costs, profit | Admin page only | Financial values are floats; no currency/period ledger; task evidence affects variable cost | Finance unit and access tests |
| Reports and CSV | `/reports`, `/admin/reports`, `ReportActions` | Read-only page/client download | progress, workload, CSV | Company, Employee, Task | Selected month | Published vs produced counts, ledger, downloadable CSV | Shared report intentionally excludes finance | Entire datasets loaded; CSV formula-injection risk requires verification | Progress, CSV, reports tests |
| Admin authentication | `/login`, `/admin/*`, middleware | Login/logout/change-password actions | `auth` HMAC session and scrypt hash | Setting | Email/password; env overrides | First-run setup; 7-day cookie; secret rotation on password change | One admin identity | First visitor can claim an unconfigured deployment; no rate limiter; DB writes for first secret | Auth and access-control unit coverage; no real-browser cookie test |
| Telegram webhook ingest | `/api/telegram/webhook` | POST and diagnostic GET | `telegram/client`, `ingest`, `match`, asset-name | TelegramChat, TelegramMessage, Task, Company, Employee | Secret header; Telegram update JSON | Idempotent message/chat upsert, match, task close, diagnostics | Intended Telegram-secret boundary | POST currently fails open if secret absent; catches ingest failure and returns 200 for retry suppression | Deep matching/unit and SQLite-copy E2E; route-boundary gap |
| Telegram administration | `/admin/telegram` | Telegram server actions | client/service | TelegramChat, TelegramMessage, Setting | Admin session; chat/company IDs, base URL | Link chat/company, mark team, choose recipient, undo match, webhook registration, manual send | Admin wrapper | External API errors, invalid chat/base URL, partial sends | Action access test; service unit coverage |
| Telegram scheduled notifications | Vercel cron routes | Three cron GET handlers | service, brief, weekly, done-report, client | Setting, Task, Company, Employee, TelegramChat/Message | `CRON_SECRET`, bot token, recipient/team chat | Sends split messages; continues after individual failures | Intended cron-secret boundary | Routes currently fail open when secret absent; retries can duplicate messages; no delivery ledger/idempotency key | Message builders well tested; HTTP auth and retry gaps |
| Telegram media metadata | Webhook only | Ingest | Telegram update parser/matcher | TelegramMessage | Telegram photo/video/document/audio metadata | Stores file IDs/names and match evidence | Telegram boundary | No binary upload/storage; MIME and size not validated because bytes are not received | Parser/matcher tests |
| Search/filter/calendar | Tasks, publishing, reports | Client-side filters | `task-filters`, cards/month helpers | Task | Search/status/company/date/view state | Filtered and grouped in-memory lists | Same as page | No server pagination; large datasets increase payload/render cost | Task-filter/cards/month tests; load/browser gap |
| Operational import/export/repair | CLI scripts and package scripts | 100+ `scripts/*.ts`, Prisma seed | snapshot import/export, audit/reconcile/fix scripts | All entities | Explicit environment/flags vary by script | Backup, import, targeted corrections, Telegram polling and audits | Local operator shell authority | Several scripts mutate live data; build script invokes many automatically; no migration history | Script-specific checks uneven; build safety finding |
| Persistence/schema | Prisma clients | `src/lib/db.ts`; two schemas | Prisma 5 | Seven models | `DATABASE_URL` | SQLite local, PostgreSQL deployment | Environment authority | No migrations; `db push` deployment; schemas rely on app validation for enums and JSON | Schema-sync, seed-data, read-only integrity tests |
| Responsive RTL shell | All screens | React components | Next App Router, Tailwind, Radix | None directly | Browser viewport/keyboard | RTL Arabic layout, desktop rail/mobile drawer/dialogs | Route access applies | No automated browser suite; Google font build dependency | Manual checklist only |

## Backend-only and absent functionality

- No actual Instagram/Facebook/TikTok publishing API exists; publication is a human-confirmed task transition.
- No upload endpoint or object storage exists. Telegram file identifiers and metadata are stored, not file bytes.
- No email, SMS, push, payments, billing, subscription plan, feature entitlement, audit-log, queue, or worker subsystem exists.
- No per-company user tenancy exists, so cross-company user IDOR is not an applicable product boundary. Company IDs still require validation to prevent relational corruption.
- No soft-delete column exists for Company/Employee. Task `CANCELED` is the only soft-delete convention.
- No server-side pagination exists on application screens.
- No Prisma migration directory exists; deployment currently depends on schema push.

