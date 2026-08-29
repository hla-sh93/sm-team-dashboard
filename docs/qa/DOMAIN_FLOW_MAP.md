# Domain Flow Map

## Core ownership and workflow

```text
Admin credential (Setting)
        │ protects configuration/finance/team/company/Telegram administration
        ▼
Employee ── owns by content type ──► Company ── has plan + contract cycles
   │                                  │
   │ assigned                         ├──► PhotoSession
   ▼                                  │
Task ◄──────── generated from ────────┘
   │
   ├── one content piece = Company + type + cycle + pieceNo
   ├── WRITE → DESIGN ───────────────► PUBLISH
   └── WRITE → SHOOT → EDIT ─────────► PUBLISH   (real reels)
                    │
TelegramMessage ── match/close ──────┘
                    │
                    └──► reports / daily brief / done report / workload
```

## Persistence relationships

| Parent | Child/reference | Cardinality | DB behavior | Application behavior |
| --- | --- | --- | --- | --- |
| Employee | Task.assignee | 1:N optional | FK, `onDelete: SetNull` | Deleted employee leaves tasks unassigned |
| Employee | Six Company owner roles | 1:N optional per relation | FK, `onDelete: SetNull` | Role text determines which generated cards they receive |
| Company | Task | 1:N optional | FK, `onDelete: Cascade` | Company action refuses hard-delete when tasks/sessions exist |
| Company | PhotoSession | 1:N required | FK, `onDelete: Cascade` | Regeneration replaces active auto sessions |
| Company | TelegramChat | Logical optional reference | `companyId` string without Prisma relation | Linking is admin-controlled; orphan risk is application-managed |
| Company | TelegramMessage | Logical optional reference | `companyId` string without Prisma relation | Ingest derives company from chat/topic |
| TelegramChat | TelegramMessage | Logical N:1 | `chatId` string without FK | Ingest creates/updates chat before message |
| Task | TelegramMessage | Logical 1:N | `taskId` string without FK | Undo/matching must maintain both message and task state manually |
| Task | Task.blockedById | Logical predecessor | String, no self-FK | Pipeline uses it as a soft gate; integrity tests detect dangling/self links |
| Setting | Auth/achievements/Telegram config | Key/value | Key is PK | JSON/string formats are enforced only in code |

## Major state flows

### Contract and plan

```text
signed, publishStartDate=null
  → signed_not_publishing (no active cycle, no generated plan, no lateness)
publishStartDate set
  → first explicit cycle
cycle ends
  → no next cycle until renewContract(start)
renewContract
  → new explicit cycle (late renewal creates a real gap)
endContract
  → hard stop at contractEndedAt
archive/pause
  → excluded from new scheduling; existing parked cards preserved
```

### Task/card

```text
NOT_STARTED/TODO
  → IN_PROGRESS/DOING
  → AWAITING_APPROVAL/REVIEW
  → READY/DONE
  → PUBLISHED/DONE for PUBLISH stage

CANCELED/TODO + isPinned=true is the soft-delete marker for generated pieces.
Manual tasks are physically deleted by deleteTasks.
```

Board/status are duplicated representations. Server actions normalize common transitions, but the database permits contradictory strings.

### Regeneration

1. Read companies, employees, current/carryover work, and achievement settings.
2. Build deterministic plan and photo sessions in memory.
3. Expand content into pipeline stages and overlay reported achievements.
4. Match saved rows by stable piece identity before schedule-derived keys.
5. Restore board/status, evidence, brief, timestamps, and completed/pinned dates.
6. In one DB transaction, delete and recreate active generated tasks and sessions.
7. Outside that transaction, update manual/ad-hoc placement one row at a time.
8. Revalidate the Next.js tree.

Changing a company plan, owner, contract cycle, employee workdays/rates, manual pin, achievement setting, or schedule month can affect every downstream card, workload figure, report, notification, and Telegram match candidate.

### Telegram delivery

```text
Telegram HTTP update
  → secret validation
  → normalize chat/topic + message identity
  → upsert chat/message (message id is idempotency identity)
  → resolve company
  → parse canonical asset name / brief / media type
  → choose open piece and production stage
  → close matched Task with notes/evidence
  → reports and daily views read the new state
```

### Notification delivery

```text
Vercel cron request
  → cron-secret validation
  → read live tasks/company/employee/message state
  → build brief/digest/report
  → split to Telegram's text limit
  → send sequential parts; continue after a failed part
```

There is no sent-message ledger or idempotency key. A Vercel/HTTP retry after an ambiguous successful Telegram response can duplicate a notification.

## Cross-feature change vectors

| Change | Direct effect | Downstream risk |
| --- | --- | --- |
| Company plan count | Number of generated pieces | Piece numbering, publish dates, workload, reports, Telegram matching |
| Publish-start/renewal date | Cycle membership and dates | Current-month queries, lateness, canonical names, carryover |
| Company status | Scheduling inclusion | Accidental delete/recreate of parked work if scope is wrong |
| Owner/employee workdays | Card assignment and packing | All work dates, overload indicators, daily briefs |
| Task completion | Timestamps and blockers | Produced/published progress, notification text, predecessor closure |
| Task cancellation | Whole piece suppression | Regeneration must not resurrect it under a new schedule key |
| Telegram chat link | Company attribution | Wrong-company task closure and incorrect report credit |
| Telegram sender identity | Employee credit | Done report and financial/productivity attribution |
| Auth secret/password | All admin sessions | Password change must invalidate existing sessions |
| Build/deploy command | Generated Prisma client and application bundle | Build is read-only; schema push, imports, seeds, and repairs are explicit operator actions |
