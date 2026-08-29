# Test Matrix

Result legend: **PASS** verified during this audit; **EXISTING PASS** covered by the pre-existing suite; **PARTIAL** some meaningful paths covered; **GAP** no adequate automation; **N/A** feature not present.

| ID | Domain | Scenario | Test Type | Priority | Expected Result | Result |
| --- | --- | --- | --- | --- | --- | --- |
| SAFE-01 | Data safety | Full existing suite cannot alter `prisma/dev.db` | Integrity wrapper | P0 | SHA-256 unchanged | PASS |
| SAFE-02 | Data safety | Mutating test points to normal dev/prod URL | Unit/guard | P0 | Test refuses before client creation | PASS |
| SAFE-03 | Build | Production compile command has no DB mutation | Static/tooling | P0 | No push/seed/repair in build | PASS |
| AUTH-01 | Auth | Hash/verify correct and wrong password | Unit | P1 | Correct true; wrong false | EXISTING PASS |
| AUTH-02 | Auth | Missing/forged/expired cookie | Unit/integration | P1 | Admin page/action rejected | EXISTING PASS |
| AUTH-03 | Auth | Direct sensitive server action without session | Unit/static | P1 | Rejected before DB mutation | EXISTING PASS |
| AUTH-04 | Auth | Password change rotates signing secret | Integration | P1 | Old sessions invalid | EXISTING PASS |
| AUTH-05 | Auth | Repeated login attempts | Security/load | P1 | Bounded/rate-limited | GAP |
| AUTH-06 | Auth | Two callers race first-run setup | Concurrency | P1 | One deterministic owner | GAP |
| ACCESS-01 | Access | Employee navigation exposes no finance/team/company links | Static | P1 | Sensitive routes absent | EXISTING PASS |
| ACCESS-02 | Access | Direct `/admin/*` navigation without valid session | Browser/E2E | P1 | Redirect before markup/data | PASS |
| ACCESS-03 | Access | Shared reports contain no finance values | Component/browser | P1 | No salary/contract/P&L | EXISTING PASS |
| COMPANY-01 | Company | Minimum/full valid create with Arabic/Unicode | DB integration | P1 | Row created with normalized defaults | EXISTING PASS |
| COMPANY-02 | Company | Blank name, bad color/date, negative plan | Unit/integration | P1 | Validation error; no row | EXISTING PASS |
| COMPANY-03 | Company | Duplicate name under two concurrent creates | Concurrency DB | P1 | Unique constraint permits one | PASS |
| COMPANY-04 | Company | Update plan/owner/date, including no-op | DB integration | P1 | Intended fields only; regen consistent | EXISTING PASS |
| COMPANY-05 | Company | Delete empty vs dependent company; repeat delete | DB integration | P0 | Empty deleted; dependent refused; repeat safe | EXISTING PASS |
| COMPANY-06 | Company | Archive/pause then regenerate | DB integration | P1 | Existing parked work preserved | EXISTING PASS |
| CONTRACT-01 | Contract | Month-end/leap-day cycle boundaries | Unit | P1 | Contiguous non-overlapping cycles | EXISTING PASS |
| CONTRACT-02 | Contract | No renewal after cycle end | Unit/integration | P1 | No new generated work | EXISTING PASS |
| CONTRACT-03 | Contract | Upgrade/downgrade plan counts mid-cycle | System | P1 | Stable identity and intended count delta | EXISTING PASS |
| CONTRACT-04 | Contract | Concurrent renew/end requests | Concurrency DB | P1 | No malformed/contradictory history | GAP |
| EMP-01 | Employee | Valid/invalid CRUD and Unicode | Integration | P1 | Valid persists; invalid rejected | EXISTING PASS |
| EMP-02 | Employee | Delete assignee/owner with dependencies | DB integration | P1 | References become null; no orphan | GAP |
| EMP-03 | Employee | Malformed workdays/rates JSON | Unit/integration | P2 | Safe fallback or validation error | EXISTING PASS/PARTIAL |
| TASK-01 | Task | Create minimum/full ad-hoc task | Integration | P1 | Persisted; effort floor and schedule applied | EXISTING PASS |
| TASK-02 | Task | Null/empty/whitespace/invalid enum/date/ID | Unit/integration | P1 | Rejected without partial write | EXISTING PASS/PARTIAL |
| TASK-03 | Task | Arabic/English/emoji/HTML-like title | Unit/browser | P2 | Stored/rendered as text | GAP |
| TASK-04 | Task | Update one/many/no-op/stale IDs | Integration | P1 | Existing updated; missing IDs predictable | EXISTING PASS/PARTIAL |
| TASK-05 | Task | Delete manual vs generated piece; duplicate delete | Integration | P1 | Manual removed; generated canceled; no resurrection | EXISTING PASS |
| TASK-06 | Task | Simultaneous conflicting updates | Concurrency DB | P1 | Defined last-write/version behavior | GAP |
| STATE-01 | State | Every supported status/board transition | Unit/integration | P1 | Normalized timestamps and board | EXISTING PASS |
| STATE-02 | State | Invalid board/status/photo status direct action | Unit/integration | P1 | Rejected | EXISTING PASS/PARTIAL |
| STATE-03 | State | Complete twice/reopen/recomplete | Integration | P1 | Idempotent timestamps/no corruption | EXISTING PASS/PARTIAL |
| STATE-04 | State | Publish closes predecessors | Integration | P1 | Piece chronology and all predecessor state valid | EXISTING PASS |
| STATE-05 | State | Impossible DB combinations | Data integrity | P1 | Detected and reported | EXISTING PASS |
| SCHED-01 | Scheduler | Same input twice | Unit/system | P0 | Byte-stable deterministic keys/dates | EXISTING PASS |
| SCHED-02 | Scheduler | Generate on isolated real-data copy twice | DB integration | P0 | Stable and no historical-field loss | PASS |
| SCHED-03 | Scheduler | Failure during replace transaction | Failure injection DB | P0 | Full rollback | GAP |
| SCHED-04 | Scheduler | Failure during post-transaction ad-hoc update | Failure injection | P1 | Explicit partial-failure signal; generated state valid | GAP |
| SCHED-05 | Scheduler | Two concurrent generators same month | Concurrency DB | P0 | One coherent schedule, no missing/duplicate rows | PASS (SQLite copy) |
| SCHED-06 | Scheduler | Dormant company during unrelated regen | Integration | P0 | Dormant cards untouched | EXISTING PASS |
| SCHED-07 | Scheduler | Canceled piece after schedule date shifts | Unit/integration | P0 | Same piece remains canceled | EXISTING PASS |
| SCHED-08 | Scheduler | Completed/pinned card after plan retime | Regression | P0 | Work/publish dates and evidence preserved | PASS |
| DATE-01 | Date | Midnight/end-of-day local comparisons | Unit | P1 | Day semantics consistent | EXISTING PASS |
| DATE-02 | Date | Month/year boundaries and Feb 29 | Unit | P1 | Correct cycle/working day | EXISTING PASS |
| DATE-03 | Date | UTC, Europe/Amsterdam, Asia/Riyadh | Multi-TZ unit/process | P1 | Same intended business date | PASS |
| DATE-04 | Date | Browser timezone differs from server | Browser/E2E | P1 | Submitted/displayed ISO day unchanged | GAP |
| PHOTO-01 | Photographer | 0/1/2/3/many reels and preferred weekday | Unit | P1 | Valid batching/dates/warnings | EXISTING PASS |
| PHOTO-02 | Photographer | Deleted/unavailable photographer | System | P1 | Safe fallback/unassigned warning | EXISTING PASS/PARTIAL |
| PHOTO-03 | PhotoSession | Invalid/repeated status change | Integration | P2 | Rejected/idempotent | GAP |
| PUB-01 | Publishing | Mark one/many pieces published | Integration | P0 | Exactly intended pieces and predecessors complete | EXISTING PASS |
| PUB-02 | Publishing | Duplicate/rapid publish confirmation | Integration/concurrency | P0 | No duplicate logical publication | PASS |
| PUB-03 | Publishing | Past carryover and continuation appear once | Unit/page | P1 | No hidden or duplicate cards | EXISTING PASS |
| PUB-04 | External provider | Timeout/4xx/5xx/rate limit/retry | N/A | P1 | No provider adapter exists | N/A |
| TG-01 | Telegram webhook | Correct/wrong/missing secret | HTTP unit | P0 | Correct accepted; wrong 401; missing config fail-closed | PASS |
| TG-02 | Telegram webhook | Malformed JSON | HTTP unit | P1 | 200 and no write | PASS |
| TG-03 | Telegram webhook | Duplicate update | DB E2E | P0 | One message and one logical close | EXISTING PASS |
| TG-04 | Telegram webhook | Unknown chat/topic | DB E2E | P1 | Stored unlinked and visible | EXISTING PASS |
| TG-05 | Telegram matching | Ambiguous/closed/wrong company/type/name | Adversarial unit | P0 | Refuses unsafe guess | EXISTING PASS |
| TG-06 | Telegram ingest | DB failure after partial ingest | Failure injection DB | P0 | No half-linked/half-closed state | GAP |
| CRON-01 | Cron | Correct/wrong/missing bearer secret | HTTP unit | P0 | Only correct secret invokes sender | PASS |
| CRON-02 | Cron | Provider partial failure | Unit | P1 | Later parts attempted; failures returned | EXISTING PASS/PARTIAL |
| CRON-03 | Cron | Same invocation retried | Idempotency integration | P1 | No unintended duplicate notification | GAP |
| CRON-04 | Cron | Missing token/recipient | Unit | P1 | Safe error and zero sends | EXISTING PASS |
| FILTER-01 | Filtering | Search + status + date + company + empty results | Unit/browser | P2 | Correct intersection and counts | PARTIAL |
| FILTER-02 | Pagination | Boundary/beyond final page | N/A | P2 | No pagination exists | N/A |
| CSV-01 | Export | Arabic, commas, quotes, newline, BOM | Unit | P2 | Valid spreadsheet-compatible CSV | EXISTING PASS |
| CSV-02 | Export | Formula-prefixed untrusted field | Security unit | P1 | Neutralized or explicitly documented | PASS |
| PERF-01 | Scheduler | Large synthetic plan | Controlled benchmark | P2 | Bounded local runtime/memory | PASS (8,000+ tasks/120 companies, 84 ms observed) |
| PERF-02 | Lists | Large task/report payload | Browser/load | P2 | Usable; no obvious repeated requests | GAP |
| DB-01 | Schema | SQLite/Postgres models match | Static | P0 | Identical models/fields/attributes | EXISTING PASS |
| DB-02 | Integrity | Orphans, duplicate keys, enum/state drift | Read-only DB audit | P0 | No unexplained violations | PASS |
| DB-03 | Constraints | Expected uniqueness guaranteed | Schema/concurrency | P0 | Company/message identity safe; task/session gaps documented | PASS/PARTIAL |
| DB-04 | Migration | Apply migrations to populated test DB | N/A | P0 | No migration history exists | GAP |
| UI-01 | Browser | Employee critical workflow | E2E | P1 | Core routes and task board render on isolated DB; mutations covered at action layer | PARTIAL |
| UI-02 | Browser | Admin login/logout/direct URL | E2E | P1 | Cookie and redirects correct | PASS |
| UI-03 | Browser | Mobile 390px and desktop RTL layout | E2E visual | P2 | Drawer and controls usable; no browser-console errors | PASS/PARTIAL |
| UI-04 | Browser | Double clicks/loading/error states | E2E | P1 | No duplicate actions; errors visible | GAP |
