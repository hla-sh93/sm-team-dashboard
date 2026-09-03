# Social Media Team Dashboard — Shared Agent Handoff

> **Canonical continuity file.** Any Codex or Claude agent continuing this project must read this file completely before inspecting, changing, deploying, or reconciling data. Update the current-state sections and append a session entry before ending meaningful work.

Last updated: **2026-09-02**

Workspace: `C:\Users\hla2-\Videos\Social\sm-team-dashboard`

Production alias: <https://socialmediateam.vercel.app>

Current phase: **Wasl only. Production now directly verifies contract cycle 2 as `1 أيلول → 1 تشرين الأول`, containing exactly 15 posts, 8 reels, and 20 stories. All 43 live publication dates fall between 2026-09-01 and 2026-09-30; the final post, reel, and story are each scheduled on 2026-09-30, so 2026-10-01 is the exclusive closing boundary and nothing in this cycle publishes after it. Post 1–3 DESIGN are genuinely `DONE`, assigned to Ayman, with work date 2026-08-30. The live Wasl board is 93 TODO, 0 DOING, 0 REVIEW, 3 DONE; the dashboard reports 0/43 published, 3 ready, and 40 remaining. Post 1 is scheduled for publication on 2026-09-01 but actual publication is not proven. Reel 1 SHOOT is assigned to Majed but still reloads with start 2026-09-06 and end 2026-09-07; the required dates are both 2026-09-01. In-app automation could not persist native date-input changes, so no production value was changed. Local HEAD is `c658acf`; production is last verified at `302ba9b`, and the push/deploy of `c658acf` is not verified. The local Wasl payload now preserves the explicit 2026-09-01 cutoff but no longer requests restoring Post 1–2 to `NOT_STARTED`.**

## ٣/٩/٢٠٢٦ — تطبيق ثلاث حمولات على الإنتاج (Claude)

**حالة: منفَّذ ومتحقَّق منه على الإنتاج الحيّ** (لقطة `prod-20260903-1924.json`).

| الحمولة | النتيجة |
| --- | --- |
| `tawzeef-reel1-2026-09.json` | ✅ مونتاج ريل المسابقة (REEL #1 EDIT) صار READY/DONE بتاريخ ٣/٩ — أليسار |
| `nour-adhoc-2026-09.json` | ✅ كرتا «بديل القيم الطبيعية»: SHOOT (ماجد) وEDIT (أليسار) صاروا READY/DONE بتاريخ ٣/٩ |
| `agalya-close-2026-09.json` | ⏭️ **ما انطبّقت — ما إلها داعي**: أغاليا ٦٧ كرت وكلهن مقفولين أصلاً (٠ مفتوح) |

**أول استعمال لـ`adhocStates` على الإنتاج** — الحقل الجديد اشتغل، فالشغل خارج
الخطة صار ينسكّر بدليل بدل نقرة يدوية.

### غلطتان لازم ينذكروا

1. **الدليل انكتب مرتين على كرت مونتاج التوظيف.** طبّقت الحمولة مرتين لأني
   تحقّقت من جدول المهام — وجدول المهام **بيعرض الكروت المنجزة كمان**، فقراءة
   «لسا موجود» كانت غلط. التحقّق الصحيح من لقطة الإنتاج لا من الشاشة.
   الملاحظة مكرّرة والحالة صحيحة؛ ونافذة «تعديل مهمة» ما فيها حقل ملاحظات
   فما بينتصلّح من الواجهة.
2. **كرت تصوير ريل التوظيف لسا مسجَّل باسم أليسار بدل ماجد** — أثر المطابقة
   القديمة قبل الإصلاح. بينتصلّح من «تعديل» على الكرت (فيها حقل المسؤول)،
   وينتظر قرار القائدة لأنه بيمسّ إنجاز شخصين.

### توست الاستيراد بيضلّل

بيقول «تم تطبيق **٠ وصفاً**» حتى لما الحمولة تنجح بالكامل — لأنه بيعدّ `items`
وحدها، وما بيذكر `updatedStates` ولا `updatedAdhoc` ولا `closedPreviousTasks`.

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

### Delivery lead time and cycle containment (stated 2026-09-01)

- **[USER-CONFIRMED]** A publishing cycle starts at the **first actual publication** and runs 30 days. It is
  not the contract signature date. **[VERIFIED]** Encoded: `publishStartDate` anchors the cycle in
  `src/lib/contract.ts`.
- **[USER-CONFIRMED]** Every publication of a plan must fall **inside** that 30-day window.
  **[VERIFIED]** True for Wasl cycle 2 on production, but nothing in the engine *enforces* it — a piece
  scheduled outside the window is not currently flagged.
- **[USER-CONFIRMED]** Every task is delivered **at least two days** before its publication date; one day is
  permitted only when necessary, and such work should carry an `urgent` marker.
  **[VERIFIED] ⚠️ Partially violated today** — `src/lib/constants.ts:226` sets the default lead to
  `POST: 2`, `AI_REEL: 2`, **`STORY: 1`**, **`REEL: 1`** (the shoot itself is 3 days via
  `PHOTO_SHOOT_LEAD`). So stories and reel montage are scheduled on the exception lead, not the rule.
  Raising them to 2 compresses every design date by a day — **[PENDING]** the user's decision, not an
  agent's.
  **[VERIFIED 2026-09-01 — isolated simulation]** Flipping those constants does **not** enforce the rule.
  On isolated copies of `prisma/dev.db` (hash `563799…8744e`, byte-identical before and after; no repo
  file left modified), every open bucket (Aug/Sep/Oct) was regenerated with `STORY: 2`, `REEL: 2`,
  `PHOTO_SHOOT_LEAD: 4`:
  - 26 STORY design cards move 1–4 days **earlier** (مانغو 7 · مركز البلسم 12 · عبادة 7). **No publication
    date changes at all** — the client-facing calendar is untouched.
  - Of the 78 upcoming publications, **14** break the two-day rule today (7 same-day, 6 one-day, 1
    negative). The change fixes exactly **2** of them (عبادة STORY 8 and STORY 10) and creates **1** new
    overdue card (عبادة STORY 8 design lands on 2026-08-31, one day before today).
  - The other **12 are all reel montage**, and `LEAD.REEL` does not schedule montage: `pipeline.ts` dates
    the EDIT card from the shoot delivery, not from `publishDate − LEAD.REEL`. `PHOTO_SHOOT_LEAD` is read
    only by the first-cycle publish floor (`scheduler.ts:297`), never by shoot planning. Both constants
    are inert for existing work.
  - **[INFERENCE]** Enforcing the rule for reels is engine work inside the reel pipeline (montage ≥2 days
    before publish, shoot ≥2–3 days before montage) with its own tests — not a constant flip.
  - **[PENDING]** The simulation ran on the 2026-08-26 local snapshot, which does **not** contain Wasl's
    live September cycle (43 pieces, 20 stories). Wasl's stories are exactly what this change moves, so
    the live number of moved cards will be higher than 26.
  **[USER-CONFIRMED 2026-09-01 — DECIDED AND IMPLEMENTED]** The lead answered all three open points and
  told the agent to apply them:
  1. **Shoot time is dynamic** — it depends on the client's availability more than the team's, so the
     engine must plan a **window (from date → to date)**, and when the shoot moves the plan must be
     preserved as far as possible; where it cannot, the **cause of the shift must be visible in each
     company's final report**.
  2. **One source of truth** for every fixed number — "الرقم مو كل ما بدي غيره لازم يتغير بعدّة أماكن".
  3. **The photographer's limit is the count only** (reels per day), not company grouping — "لما ما بيكون
     عنا شي رح يتأخر، عادي يكونوا لشركة وحدة".
  **[VERIFIED — LOCAL]** Implemented in `a5c2b6c`, `ae064fa`, `5898891`: `LEAD` is the single lead source
  (STORY/REEL raised 1 → 2); `shootWindow`/`footageDeadline`/`montageDay` derive the whole reel chain from
  it in **working days**; montage is dated from the publish date (not from the shoot) so a shoot moving
  inside its window changes nothing downstream; per-item hours now derive from each person's stored
  `rates`, so the daily count exists only in the employee record (default 6/day per the lead's rule);
  the one-shoot-batch-per-day rule was replaced by a per-day reel **count** cap read from the
  photographer's own rate; and `scheduleShiftNotes` explains every remaining shift in the company report.
  `PHOTO_SHOOT_LEAD`, `PHOTO_DELIVER_LEAD`, and `TYPE_HOURS` were deleted — two were dead, one was a
  second copy of a number that already lived in the employee record.
  **[VERIFIED — ISOLATED SIMULATION]** On a copy of the local database: pieces breaking the two-day rule
  went **14 → 0** of 78 upcoming publications (52 now sit at exactly two days); 100 open cards were
  re-dated; **0 publication dates changed, 0 completed/closed cards changed, 0 cards lost** (1098 before
  and after).
  **[PENDING]** Two things are NOT done: (a) the stored per-person rates on production still say 8/day for
  أيمن and سابين and 4/day for حلا, which override the new 6/day default — each is one field in شاشة
  الفريق; (b) production keeps the old dates until someone presses «إعادة الجدولة» for a month bucket.
- **[USER-CONFIRMED]** When two companies need the same person (designer/photographer), the limit may be
  exceeded so both are delivered; the piece delivered on one day's notice is marked `urgent`.
  **[VERIFIED]** `Priority.URGENT` exists and the scheduler gives URGENT/ADHOC an ASAP slot
  (`scheduler.ts` §5.4), but there is no separate delivery marker and no explicit capacity override.
  **[PENDING]** Decide whether `urgent` is display-only or real scheduling behaviour before building on it.

## 4. Source registry

### Local project and evidence

- Repository: `C:\Users\hla2-\Videos\Social\sm-team-dashboard`
- Content library: `D:\smart touch\social media plans`
- Latest known Telegram export: `C:\Users\hla2-\Videos\Social\sm-team-dashboard\tmp\telegram-export-2026-08-27\result.json`
- Program status import/reference: `C:\Users\hla2-\Downloads\program-status-updates_corrected (1).json`
- Schools brief PDF: `C:\Users\hla2-\Downloads\September Awareness Campaign2026 (2).pdf`
- Original QA request: `C:\Users\hla2-\.codex\attachments\a7cc5a45-92e4-4851-a075-a7a782812f42\pasted-text.txt`
- Contract-cycle clarification: `C:\Users\hla2-\.codex\attachments\b52edb9d-c3d6-4b1f-aa8f-4113c1a02067\pasted-text.txt`
- Claude's detailed handoff artifact supplied by the user: <https://claude.ai/code/artifact/a3225a7c-deec-49f4-8207-3be5892fef2f>

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
| Wasl FX | <https://www.instagram.com/wasl.fx/> | Previous cycle closed; new cycle must start with first publication on 2026-09-01; see company notes below |
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

- **[USER-CONFIRMED 2026-08-30]** Treat every task in the previous cycle as finished.
- **[USER-CONFIRMED 2026-08-30]** The renewal/next publishing cycle starts on **2026-09-01**, which is also the required first-publication date. Do not anchor this cycle on the signature date or on 2026-08-21.
- **[USER-CONFIRMED 2026-08-30]** Ayman's work for today, 2026-08-30, is design for the first **3 posts + 3 stories** of the new cycle.
- **[USER-CONFIRMED 2026-08-30]** The team will try to shoot one reel. No shooting date is confirmed, so do not invent one.
- **[LIVE/VERIFIED]** The July-cycle view contains 103 Wasl cards: 100 previous-cycle cards are already `منجز`; the only three open cards belong to the incorrectly generated `21/8 → 20/9` cycle, not to the finished `13/7 → 12/8` cycle.
- **[LIVE/VERIFIED]** The August view currently reports 105 pending and 33 done Wasl cards because Vercel generated a cycle labelled `21/8 → 20/9`. This conflicts with the user's 2026-09-01 renewal decision and must be corrected at the company-cycle source before task regeneration.
- **[VERIFIED — FILES]** `D:\smart touch\social media plans\وصل للتداول\Wasl_Content_Plan NO.2- AUG.pdf` is the newest plan file (modified 2026-08-29). It was text-extracted and all 23 pages were visually inspected. It defines **8 reels + 15 posts + 20 stories**, matching the live company quantities, and supplies item-level content for all pieces. The first three posts and first three stories therefore must use those descriptions; do not leave them as `بلا وصف`.
- **[VERIFIED — FILES]** `Wasl_Content_Plan NO.1- AUG.docx` is an older publication calendar (modified 2026-08-26) covering 2026-07-21 through 2026-08-22. Its structural text was read; LibreOffice was unavailable for DOCX rendering, so it is not the source for the new cycle's item briefs.
- **[LIVE/VERIFIED 2026-08-31]** The user authenticated the controlled in-app admin session. The live Wasl edit dialog showed two stored cycles: `21/7 → 21/8` and the wrong `21/8 → 21/9`. The normal form cannot safely correct the second one because its editable start field is the original publication anchor.
- **[LIVE/VERIFIED]** The dedicated `correctLatestRenewal` action and `صحّح آخر تجديد` admin control replace only the latest renewal, calculate the full shared schedule but persist only the selected company's rows, build the new bucket first, and remove the obsolete bucket second. Tests prove that the prior-cycle rows remain byte-identical.
- **[LIVE/VERIFIED]** `scripts/data/wasl-plan-2026-09.json` supplied 8 reel, 15 post, and 20 story briefs from the verified PDF, with no blank or duplicate pieces. Unsupported numbers are explicitly marked `تحتاج تحقق ومصدر قبل النشر`. The imported payload pins Post 1–3 and Story 1–3 design cards to 2026-08-30, pins Post 1 publication to 2026-09-01, and does not assign a reel shoot date.
- **[LIVE/VERIFIED 2026-08-31]** Commit `da39956` was pushed to both branches and reached production. The dedicated control corrected the live renewal from `2026-08-21` to `2026-09-01`. The live card now says `الدورة تبدأ 1 أيلول`; the edit dialog shows exactly `21 تموز → 21 آب` and `1 أيلول → 1 تشرين الأول`. The original anchor and previous cycle remain present.
- **[LIVE/VERIFIED 2026-08-31]** Commit `e36245e` deployed the generic visible `استيراد خطة JSON` control. The plan was applied through the authenticated UI. Live task cards then showed all new-cycle briefs, Post 1 publication on 2026-09-01, and Post 1–3 plus Story 1–3 design cards assigned to Ayman on 2026-08-30.
- **[LIVE/VERIFIED 2026-08-31]** The post-import Wasl view contained **11** older open cards outside the September cycle: three additional Story cards from `1/8 → 31/8` and eight `نشرات الصرف والمفكرة الاقتصادية` cards. They had blank descriptions and conflicted with the user's decision that every previous-cycle task is finished.
- **[LIVE/VERIFIED 2026-08-31]** Commit `302ba9b` deployed the explicit manager-decision closure and the payload was re-applied. The 11 real older cards closed, but the live verification gate caught a scope defect before reporting completion: Post 1 and Post 2 September design cards also moved to `READY/DONE` because their 2026-08-30 preparation date placed them in an earlier month bucket. Post 3 is `IN_PROGRESS` and was not changed by the closure. The live Wasl board currently shows 93 TODO, 1 DOING, and 2 DONE cards for the new cycle.
- **[USER-CONFIRMED/LIVE-VERIFIED 2026-09-01 — SUPERSEDES THE RECOVERY TARGET ABOVE]** Post 1–3 DESIGN are genuine completed work, all assigned to Ayman with work date 2026-08-30. A fresh Wasl-only reload shows 93 TODO, 0 DOING, 0 REVIEW, and 3 DONE. Do not restore Post 1 or Post 2 to `NOT_STARTED`.
- **[LIVE/VERIFIED 2026-09-01]** The Wasl dashboard reports 0/43 published, 3 ready, and 40 remaining. Post 1 PUBLISH remains TODO with publication scheduled for 2026-09-01; this is a schedule value, not evidence that Instagram publication occurred.
- **[LIVE/VERIFIED 2026-09-01]** The company edit dialog shows exactly two cycles: `21 تموز → 21 آب` and `1 أيلول → 1 تشرين الأول`. Cycle 2 has exactly 15 posts, 8 reels, and 20 stories. The live publishing list contains all 43 pieces, starting with Post 1 on 2026-09-01 and ending with Post 15, Reel 8, and Story 20 on 2026-09-30. No cycle-2 publication date exceeds the 2026-10-01 boundary.
- **[LIVE/VERIFIED 2026-09-01]** Reel 1 SHOOT is assigned to Majed and remains TODO. After reload its stored dates are still start 2026-09-06 and end 2026-09-07, with publication 2026-09-08. The required correction is start 2026-09-01 and end 2026-09-01. The controlled in-app browser produced an update toast, but a fresh reload proved the date values had not changed; native date-input automation updated the DOM property without updating React state. No production data mutation resulted from the attempts.
- **[LOCAL-ONLY 2026-09-01]** Commit `c658acf` contains the safer explicit-cutoff classification using the latest of `workDate`, `readyDate`, and `publishDate`. Its push/deployment is not verified despite local remote-tracking refs. The uncommitted Wasl payload now retains `beforeDate: 2026-09-01` and removes `restoreMistakenClosures`, preventing any future import of this payload from reverting Post 1–2 DESIGN. Fresh verification passes 460/460 tests and `npm run typecheck`.
- **[PENDING]** Correct Reel 1 SHOOT start/end to 2026-09-01 through a date-input path that actually reaches React state, reload, and verify both stored values. Later remove only the stale mistaken-closure evidence line from Post 1–2 notes without changing their `DONE` status. Do not re-import the payload merely to attempt the obsolete recovery.

### التوظيف (PhoeniJobs) and أغاليا — cycle boundary decided 2026-09-02

- **[USER-CONFIRMED 2026-09-02]** For وصل, التوظيف, and أغاليا: every task of the **previous** cycle is
  finished — strictly anything dated **before 2026-09-01**. The new cycle for **وصل and التوظيف** runs
  **1/9 → 30/9**. Cycle-2 content lives in the Telegram channel or in `D:\smart touch\social media plans`.
- **[VERIFIED — FILES]** `التوظيف - Jobs\Phoeni Jobs - Sept-Plan NO.2.docx` is the September content plan.
  Its table was parsed row by row: **8 reels (1–8) and 8 posts (1–8)**, each with a script and a caption.
  `PhoeniTech - JobsPlan 3 months .pdf` is the launch/ops plan already represented as ad-hoc cards, not a
  content plan; its Arabic text does not extract (glyph encoding), so it was not used as a brief source.
- **[VERIFIED — FILES]** أغاليا's folder holds only `Agalya - July.docx`. There is no new plan, which
  matches "finished and not renewed". Closure is all that is required.
- **⚠️ [PENDING — DISCREPANCY SHOWN, NOT RESOLVED]** The plan file has **8 posts**; the company record says
  **10**. Nothing was reconciled: `tawzeef-plan-2026-09.json` carries no `requireComplete`, so it describes
  the 8 real pieces and leaves any 9th/10th without a description rather than inventing content. The lead
  decides: drop the company to 8 posts, or supply the two missing briefs.
- **[LOCAL-ONLY — needs live confirmation]** In the 2026-08-26 local snapshot التوظيف already carries
  renewals `["2026-09-01","2026-10-01"]` with `publishStartDate` 2026-08-01, so the 1/9 → 1/10 bucket
  exists. Confirm in the live company dialog before importing.
- **[LOCAL-ONLY]** Open pre-1/9 cards in that same snapshot: التوظيف **40**, أغاليا **9**, وصل **62**
  (وصل's number is stale — production already closed its 11 real carryovers under `302ba9b`).
- **[VERIFIED — LOCAL]** `applyCompanyPlanUpdate` now accepts a **closure-only** payload (`items` optional,
  and an empty payload is refused). Three payloads are committed for the authenticated
  `استيراد خطة JSON` control: `tawzeef-plan-2026-09.json`, `agalya-close-2026-09.json`,
  `wasl-close-2026-09.json`.
- **[PENDING]** None of the three has been applied. No agent can reach the production database
  (`.env.production.local` holds redacted 11-character placeholders), so the lead applies them through the
  admin UI.

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

**[VERIFIED]** Before commit `136754f`, the application stored the planned publishing date when a user confirmed publication:

- `src/app/publishing/publishing-client.tsx`: `markPiecesPublished` does not collect an actual date in the UI.
- `src/server/actions/tasks.ts`: `markPiecesPublished(ids, date?)` falls back to the task's planned `publishDate` when no explicit date is supplied.

Therefore “published” could be correct while the displayed date remained the old schedule date. The editing defect is fixed and deployed; the seven existing BRU records still need one-time data correction.

## 8. Publication-date correction feature — committed and live

The following four changes are committed in `136754f`, pushed, deployed, and **[LIVE/VERIFIED]**:

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
- Commit `e7cc220` permanently excludes ignored `tmp/` and `.generated/` copies from TypeScript, repairing the local build gate.
- Current clean-tree verification: **453/453 tests**, **57/57 deep checks**, and the Next.js production build pass.
- **[LIVE/VERIFIED]** The production task-edit dialog now exposes `تاريخ النشر`.

## 9. Earlier deep QA stabilization work

The earlier QA stabilization set, regeneration-reality fix, publication-date feature, build-gate fix, and handoff documentation are now separated into seven scoped commits, pushed, and deployed. The worktree is clean; the former 57-file loss risk is resolved.

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
- Current recorded baseline: **453/453 tests passing in 40 files**, **57/57 deep checks**, typecheck/lint/schema validation/build passing, and the valuable local DB hash unchanged.

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

## 10. Repository, deployment, and verification state

**[VERIFIED]** The former dirty worktree is resolved. Eleven scoped code/release commits are pushed on `codex/qa-deep-stabilization` and `origin/main`, and each scope can be reverted independently:

| Commit | Scope | Author of the work |
| --- | --- | --- |
| `28b7ec9` | QA stabilization (read-only build, fail-closed secrets, Next 15, Zod, CSV, headers, guards) | Codex |
| `5042963` | Regeneration-reality guard (completed cards keep their real dates) | Claude |
| `136754f` | Actual publication-date correction (schema, action, form, test) | Codex |
| `b53cb24` | This shared handoff record + agent pointers | Codex, extended by Claude |
| `e7cc220` | `tsconfig` excludes `tmp/` so the local build gate works at all | Claude |
| `c919060` | Release-readiness handoff and the original `CRON_SECRET` blocker | Claude |
| `bb09751` | Live-release verification and resolved-blocker handoff | Claude |
| `22cffc5` | Show `تاريخ النشر` for real `kind=PUBLISH` cards, plus a real-form regression test | Codex |
| `da39956` | Safe Wasl renewal correction plus validated all-or-nothing plan import | Codex |
| `e36245e` | Visible authenticated JSON-plan import control | Codex |
| `302ba9b` | Evidence-backed prior-cycle closure; live verification exposed a month-bucket scope defect now under repair | Codex |

Current Git state checked on 2026-09-01:

- `HEAD` = `c658acf` (`fix: preserve Wasl September preparation tasks`).
- Local remote-tracking refs currently also display `c658acf`, but the user's latest continuity record says its push failed authentication and production is still expected at `302ba9b`; do not treat those refs as deployment evidence.
- Production is last browser-verified at `302ba9b`. No current Vercel proof was obtained for `c658acf`.
- `git status --short` contains the Wasl payload safeguard, its focused regression expectation, and this handoff update. These changes are **local-only and uncommitted**.

**[LIVE/VERIFIED]** Production release state:

- The user added `CRON_SECRET` to Vercel production. No agent saw, generated, copied, or stored its value.
- The branch was pushed to `main` and deployed without disturbing the shared working directory.
- `/icon.svg` returned `200`, confirming the new build is live.
- An unauthenticated `GET /api/cron/done-report` returned `401`, proving both that the fail-closed code is live and that the runtime can read `CRON_SECRET`. A missing runtime secret would produce `503` instead.
- `/today` rendered real production data.
- The production edit dialog now exposes `تاريخ النشر` on real `kind=PUBLISH` cards. The first release used the impossible `kind=CONTENT && stage=PUBLISH` condition; `22cffc5` repaired it and the live BRU Reel 1 dialog showed the field with three date inputs.
- The release wrote no production application data: the build is compile-only and `git diff 5c3e9e1..bb09751 -- prisma/` is empty, so no schema push was required.
- A fingerprinted backup of the local database was taken before deep verification, and every test/deep-audit run left the original database byte-identical.
- The 460/460 test, typecheck, and build result belongs to the earlier `c658acf` state. Fresh verification for the uncommitted payload safeguard is recorded in the latest session log below; do not carry old gate counts forward as fresh evidence.

**[RESOLVED]** The previous hard release blocker is closed. Never remove `CRON_SECRET`: without it, all three protected Telegram report routes fail closed with `503`, and scheduled reports stop silently.

Remaining non-blockers:

- **[PENDING]** Cards closed directly from the UI do not receive a durable evidence line in `notes`, which conflicts with the user's “closure requires evidence” operating rule. This needs a separate design/fix; do not mix it with BRU date correction.
- **[PENDING]** `/today` logged a React hydration mismatch (minified error `#418`) during Claude's production inspection. The page rendered and data was unaffected. Investigate separately.
- Telegram-bot token access was discussed, but agents must not expose or copy token values into logs or this file.

## 11. Exact next actions

1. Read this file and run `git status --short`; preserve all existing user work.
2. Do not restore Post 1–2 DESIGN and do not re-import the payload for the obsolete recovery; their current `DONE` state is user-confirmed and live-verified.
3. Correct only Reel 1 SHOOT, assigned to Majed: start 2026-09-01 and end 2026-09-01. The current live values are still 2026-09-06 and 2026-09-07. Reload and re-filter to Wasl after saving, because the previous in-app automation attempt did not reach React state.
4. After explaining the discrepancy, remove only the stale mistaken-closure evidence line from Post 1–2 DESIGN notes. Preserve their `DONE` status, owner Ayman, and 2026-08-30 work date.
5. Verify live that Wasl still reads 93 TODO, 0 DOING, 0 REVIEW, 3 DONE; all 43 pieces retain descriptions; the 11 older carryovers remain done; the cycles remain `21/7 → 21/8` and `1/9 → 1/10`; and Post 1 publication remains scheduled for 2026-09-01. Keep actual published count at zero until external or application evidence proves publication.
6. Before any release claim, prove whether `c658acf` is actually on Vercel. Do not infer deployment from local `origin/*` refs and do not use an alternative deployment path silently.
7. Keep the seven authorized BRU actual-date corrections from §6 pending; none were changed in this session. Wasl remains the only company in scope until accepted.
8. After Wasl acceptance, follow the user's requested order: Agalya (all closed/no renewal), BRU (two reels filmed awaiting edit + one ready at Omar, plus pending date correction), Dr Nour Lab, Siizen, Albalsam, then Mango.
9. Handle the missing evidence-line behavior and `/today` hydration warning as separate backlog items.

## 12. Safety constraints for the next agent

- Never publish, send Telegram messages, post to Instagram, or mutate external data merely to inspect it.
- Browser access to social pages is read-only unless the user separately authorizes an action.
- Do not expose Telegram tokens, database URLs, cookies, or Vercel secrets in logs or this file.
- The code worktree was clean at `22cffc5`; `CLAUDE_HANDOFF.md` is intentionally modified for the active Wasl investigation. Inspect ownership and preserve unrelated work; never use broad reset/checkout commands.
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

### 2026-09-03 — Claude — First production backup pulled and synced; the mess is now measurable

- **[LIVE/VERIFIED]** The daily backup works end to end. `npm run backup:pull` fetched
  `backups/prod-20260903-1015.json` — **11 employees · 16 companies · 1220 tasks · 91 photo sessions ·
  7 settings** — and `npm run backup:sync` replaced the local database with it after fingerprinting the old
  one to `backups/dev.db.before-sync-20260903-1016`. Local now mirrors production; the stale 2026-08-26
  snapshot is gone.
- **[VERIFIED]** Two failures on the way, both fixed: the secret line had been written by PowerShell in
  UTF-16 (every character followed by a NUL) so the reader never saw the key, and a value carrying control
  characters made `fetch` fail with an opaque `UND_ERR_INVALID_ARG`. The loader now strips NULs/BOM, the
  script validates that the secret is printable ASCII, and failures exit through `exitCode` instead of
  crashing libuv.
- **🔴 [SECURITY — needs the lead's action]** The `CRON_SECRET` now in use is the literal example string
  the agent published in chat (verified by hash). It protects the full-database export route and the three
  Telegram cron routes. It must be rotated to a private value in Vercel (Production) + redeploy + mirror
  locally.
- **[VERIFIED — PRODUCTION DATA]** With the real data local, the data-rule tests turn red and that redness
  **is the audit's raw material**, not a code regression: **56 publish closures since July carry no
  evidence line** (وصل 14 · التوظيف 10 · أغاليا 5 · برو 5 · البلسم 5 · Siizen 4 · عبادة 4 · فونيتيك 4 ·
  مانغو 3 · نور 2); مخبر د.نور has a publication (11/6) outside its 15/6→15/7 cycle; Siizen has five
  generated items in the 2026-7 bucket with no cycle at all; Wasl REEL 5 finished before it started; and
  REEL#6 is published while its production cards are open.
- **[LIVE/VERIFIED]** Wasl's real September state: plan 15/8/20, cycle `1/9 → 1/10`, 96 cards — 11 done
  (POST DESIGN 1–5 · STORY DESIGN 1–5 · REEL 1 SHOOT), 85 open, **nothing published in the app** even
  though post 2 went out on 1/9. Post 1 is still pinned to 1/9.
- **[PENDING]** Telegram evidence covers only POST 1–3 and STORY 1–3; the board claims POST 4–5 and
  STORY 4–5 are done as well. Ask the lead before treating those four as delivered.

### 2026-09-02 — Claude — Wasl matched across all three sources; piece-state tool built

- **[USER-CONFIRMED 2026-09-02]** **وصل has no daily/routine work any more** — no exchange-rate bulletins,
  no economic calendar, no daily analysis. Only the monthly plan counts this cycle. The
  «نشرات الصرف والمفكرة الاقتصادية» cards closed by the 1/9 cutoff stay closed, and nothing new is
  generated for them. (Instagram still shows those daily items published through 1/9, which is what raised
  the question.)
- **[USER-CONFIRMED 2026-09-02]** The post published on 2026-09-01 is **plan post #2**, not post 1 — the
  imported payload had pinned post 1 to that date. The **reel's publication was postponed to Thursday**;
  which Thursday is not yet confirmed.
- **[VERIFIED — TELEGRAM export 2026-09-02]** Wasl deliveries since 27/8: the plan PDF (حلا, 30/8);
  `POST1.jpg`, `POST2.jpg`, `POST3.jpg` (أيمن, 31/8 13:33); `STORY1-1.jpg`, `STORY1-2.jpg`, `STORY2.jpg`,
  `STORY3.jpg` (أيمن, 31/8 22:02–22:17); `wasl 1 -9.mp4` (**أليسار**, 1/9 21:12 — the reel montage).
- **[VERIFIED — INSTAGRAM @wasl.fx, read-only]** 1/9: «احمي رأس مالك» (`/p/DcwFtAVs8nU/`) plus three daily
  items and a reel; 31/8 and 28/8 are daily items only. So exactly **one plan piece** has been published
  this cycle.
- **[VERIFIED]** New capability `pieceStates` in `applyCompanyPlanUpdate`: per (piece, stage) a status, an
  actual date, an optional postponed publish date, and a **mandatory evidence line** appended to the card's
  notes. Validated all-or-nothing; a completed card's date is written as a record, not a plan. Tests cover
  the happy path, note preservation, postponement without closing, and refusal on a missing piece.
  `scripts/data/wasl-states-2026-09.json` holds Wasl's first correction set. 513/513 tests, typecheck.
- **[PENDING — questions to the lead]** (a) when was reel 1 actually shot (the montage exists, so the shoot
  happened, but no date is known and none will be invented); (b) which Thursday the reel publishes — 3/9 or
  10/9; (c) post 1 is still pinned to 1/9 and unpublished, so it needs a new slot.
- **[PENDING]** Nothing applied to production. The payload waits for the lead's go-ahead, and the local
  database is still the stale 2026-08-26 snapshot until the first successful backup sync.

### 2026-09-02 — Claude — Daily backup built and live; Jobs plan settled at 10 posts

- **[USER-CONFIRMED]** Go-ahead to build the backup first. Also: التوظيف is **10 posts** — the plan file's
  8 plus two Sabin delivered on Telegram on 2026-09-01 (a competition post and a statistics post). She
  also mentioned a **competition story**, while التوظيف's plan carries zero stories — flagged, not acted on.
- **[VERIFIED/LIVE]** `GET /api/backup/export` is deployed and answers **401** without credentials. That is
  the decisive result: 401 rather than 503 proves both that the route is live and that `CRON_SECRET` is
  readable by the runtime. The route is read-only and GET-only.
- **[VERIFIED]** Local side: `npm run backup:pull` (fetch → verify → write → rotate) and
  `npm run backup:sync` (safety copy of `prisma/dev.db` → single-transaction import → count check), with
  `npm run backup:daily` chaining both. Guards: a truncated snapshot (header counts ≠ actual), an empty
  core table, or a >20% shrink against the last good snapshot is refused **before** anything is written or
  deleted; rotation keeps the newest three and deletes only after the new file's on-disk hash verifies;
  `dev.db` safety copies are deliberately outside that rotation; auth keys are never exported.
- **[VERIFIED]** Gates: 508/508 tests in 47 files, typecheck, and production build. Pushed as `e5dfd36`.
- **[VERIFIED]** Instagram handles for all 14 managed companies now live in
  `scripts/data/instagram-handles.json` — in the repo, not the database, because the daily sync overwrites
  local rows and the field has no admin UI. المدارس and كابرياني have none by design.
- **[PENDING]** Two steps only the lead can take: put the same `CRON_SECRET` value into local `.env.local`
  (no agent handles it), and create the 12:00 daily Windows scheduled task that runs `npm run backup:daily`.
- **[USER-CONFIRMED 2026-09-02]** The competition story for التوظيف is **extra work outside the plan**.
  التوظيف's story quantity stays **0**; the story is recorded as an `ADHOC` card under سابين dated
  2026-09-01 and done. Same rule already applied to event-driven work: raising the contract quantity would
  double-count the piece in every cycle report.
- **[PENDING]** A fresh Telegram export was being produced by the lead; matching starts once it lands.

### 2026-09-02 — Claude — Audit/cleanup plan written; work-week and load items parked by the lead

- **[USER-CONFIRMED]** The lead parked two items that were on the pending list: the six people's work-week
  switch ("طالما موجود بالواجهة خيار تبديل الأيام تركه" — she will do it in شاشة الفريق), and both نوال's
  week and the capacity/rate change ("نوال لسا ما قررت، هو والحمل كمان"). Neither is an agent task now.
- **[USER-CONFIRMED]** New request: a company-by-company audit and cleanup — contract/cycle dates, work
  completed, what was actually published and when, what remains with its required publish dates, then a
  reschedule that finishes production before those dates, ending in a cycle-status report per company.
  Matching sources: the plan files, the Telegram export, and each client's Instagram page (read-only
  browsing). Before any of it: a **daily 12:00 backup of the Vercel data pulled down to the local copy,
  keeping only the last 3 snapshots**, losing nothing.
- **[VERIFIED]** Plan written and pushed: `tasks/plan-audit-cleanup-2026-09.md` (commit `60d7543`). It
  fixes the evidence hierarchy (Instagram decides "published", Telegram decides "delivered", the plan
  decides "owed", the card follows), the seven-step per-company path, the reschedule rules already in the
  engine, the report shape, and the company order.
- **[VERIFIED]** The backup design had to route around a real obstacle: no agent can reach the production
  database. It is a fail-closed `GET /api/backup/export` (503 without `CRON_SECRET`, 401 on a wrong one,
  read-only), a local puller with a shrink guard that refuses to overwrite on a suspiciously small
  snapshot, rotation that keeps the newest three and deletes only after the new one verifies, and a local
  import that fingerprints `prisma/dev.db` first. Vercel cron cannot do this — free-plan delay plus a
  read-only filesystem.
- **[PENDING]** Nothing has been built for the backup yet — the plan is awaiting the lead's go-ahead, and
  the export secret must be placed in a local environment variable by her (no agent handles it).
- **[PENDING]** Still needed from the lead: a Telegram export newer than 2026-08-27, the missing Instagram
  handles, and the التوظيف 8-vs-10 posts decision.

### 2026-09-02 — Claude — Cycle-boundary payloads for وصل/التوظيف/أغاليا; closure without a plan

- **[USER-CONFIRMED]** The lead set the boundary: previous cycles of وصل, التوظيف, and أغاليا count as
  finished (strictly before 2026-09-01); the new cycle for وصل and التوظيف is 1/9 → 30/9; cycle-2 content
  is in Telegram or the content library.
- **[VERIFIED]** Parsed `Phoeni Jobs - Sept-Plan NO.2.docx` as a table (17 rows): 8 reels + 8 posts, each
  with script and caption. Briefs were written as faithful one-line summaries in the same style as the
  Wasl payload — no invented content, and the two source files that are not content plans were excluded.
- **[VERIFIED]** `items` became optional in `applyCompanyPlanUpdate` so a company with no new plan
  (أغاليا) can be closed through the same audited path; a payload with neither plan nor closure is now
  refused. New tests prove a closure-only payload closes only open pre-cutoff work and leaves completed,
  cancelled, and new-cycle cards untouched.
- **[VERIFIED]** Gates: 494/494 tests in 46 files and `npx tsc --noEmit`. Pushed to `origin/main` as
  `0129159`.
- **⚠️ [PENDING]** التوظيف plan/company mismatch: 8 posts in the file, 10 on the company record. Shown to
  the lead, deliberately not reconciled.
- **[PENDING]** The three payloads still need to be applied through the authenticated admin UI, and the
  live التوظيف cycle dialog should be confirmed as 1/9 → 1/10 first. No production data was changed.

### 2026-09-01 — Claude — Team roster narrowed, work week moved to Sun→Thu, publish-day rule named

- **[USER-CONFIRMED]** Sales (سارة، مايكل) and the on-demand freelance photographers (غسان+مايك، ألبير)
  are **not** members of the social-media team: they must not appear in task, achievement, or workload
  lists. Sales remain only as the company's account owner. "بدي التيم الأساسي فقط يلي عم يتولّدله مهام".
- **[USER-CONFIRMED]** The whole core team (حلا، أيمن، عمر، سابين، ماجد، أليسار) is now off **Friday and
  Saturday** and works **Sunday → Thursday**.
- **[USER-CONFIRMED]** Asked what to do about the 16 upcoming publications that fall on a Saturday, the
  lead chose: **Saturday is allowed for publishing only, never for production work.** The client calendar
  therefore does not move.
- **[VERIFIED]** Implemented in `0a7b556` and `1dff554`:
  - `src/lib/team.ts` decides membership **by role and state, not by name** — sales are out, an
    unscheduled photographer is out until activated — with one deliberate exception: anyone still holding
    **open work** stays visible, so no open card is ever hidden by removing its owner from a list. Applied
    to the reports, workload, today/overview, and tasks surfaces; the team-admin screen, the company
    account-owner field, and the finance report intentionally keep everyone.
  - The work week is now one value (`WORK_WEEK` in `dates.ts`). It replaced three separate constants
    (default / Ayman exception / photographer) and seven literal `[6,0,1,2,3]` copies across the code.
    Publishing weeks, packing windows, and every fallback derive from it.
  - `PUBLISH_WEEK_DAYS` = working days **+ Saturday**, with `isPublishableDay` replacing the bare
    `d.getDay() !== 5` inside the engine.
- **[VERIFIED] 🔴 Bug found by the week change and fixed:** the post-transaction ad-hoc write-back in
  `schedule.ts` re-dated **completed** ad-hoc cards onto working days. Six cards that were genuinely done
  on a Saturday would have been rewritten to the previous Thursday, falsifying the record. The guard now
  skips completed rows; the regression test is red without it and green with it, on a copy of the real
  database.
- **[VERIFIED]** Final measurement on an isolated copy (the original `prisma/dev.db` hash unchanged):
  **0 publication dates changed, 0 completed cards changed, 0 cards lost** (1098 → 1098); 192 open cards
  re-dated by the day's rule changes together. 488/488 tests, typecheck, and build pass.
- **[PENDING]** Production data the agent cannot reach (no usable production `DATABASE_URL`: the pulled
  `.env.production.local` holds redacted 11-character placeholders). Each is one field in شاشة الفريق:
  1. Set workDays to الأحد→الخميس for حلا، أيمن، عمر، سابين، ماجد، أليسار — their stored records still say
     السبت→الأربعاء, and the stored value wins over the new default.
  2. Set أيمن/سابين posts-per-day and stories-per-day to 6, and حلا to 3 — their stored 8/8/4 override the
     new 6-per-day rule.
  3. سارة's one open ad-hoc card («استلام حسابات التواصل والصلاحيات — مانغو», 2026-08-01) keeps her visible
     by design. Closing it or moving it to حلا removes her from every list.
- **[PENDING]** نوال was not named in the work-week change and still stores السبت→الأربعاء; four of her
  writing cards therefore still sit on a Saturday. Ask before changing her week.
- **[PENDING]** Production keeps its current dates until «إعادة الجدولة» is pressed per month bucket.

### 2026-09-01 — Claude — Lead's three decisions implemented, pushed to main

- **[USER-CONFIRMED]** The lead decided: shoot time is a **window**, not a fixed day (client-driven, may
  change at the last minute — preserve the plan, or make the cause of the shift explicit in the company
  report); **one source of truth** for every fixed number; and the photographer's limit is the **count**
  of reels per day, not how many companies share the day. She then said: push, and fix all the problems
  without losing data.
- **[VERIFIED]** Pushed to `origin/main` and the branch, in scoped commits: `487a4b2` (Wasl payload no
  longer asks to reopen Post 1–2), `3c30566` (simulation evidence in the docs), `a5c2b6c` (single source
  for leads/capacities + shoot window + montage dated from publish + count-only photographer cap),
  `ae064fa` (shift reasons in the per-company report), `5898891` (the whole chain in working days).
  `main` is at `5898891`; GitLab confirms it (`git ls-remote`).
- **[VERIFIED]** Gates on every step: 479/479 tests in 44 files, `npx tsc --noEmit`, and `npm run build`
  all pass; the SQLite client was regenerated after the Postgres build so the suite stays valid. The new
  rule tests were confirmed RED against the previous engine before they went green.
- **[VERIFIED]** Effect measured on an isolated copy (the original `prisma/dev.db` hash is unchanged):
  rule violations **14 → 0** of 78 upcoming publications; 100 open cards re-dated; **0 publication dates,
  0 completed cards, 0 lost cards**. Nothing was written to production, and no data script was run.
- **[VERIFIED]** `c658acf` is on GitLab `main` — the earlier "push not verified" note is resolved. The
  site answers 200 on `/icon.svg` and `/reports`, but that proves the app is up, not that the newest
  build finished; the new behaviour is only observable after a regeneration.
- **[PENDING]** Production data step the agent cannot reach: أيمن/سابين still carry a stored rate of
  8/day and حلا 4/day, which override the new 6/day rule. One field each in شاشة الفريق.
- **[PENDING]** Production keeps its current dates until «إعادة الجدولة» is pressed per month bucket. The
  measurement above is what that press will do.

### 2026-09-01 — Claude — Lead-time and capacity change simulated on isolated copies; nothing applied

Lane: local engine analysis only. **No production access, no deployment, no Telegram/Instagram action, no
push.** The two ready commits (`ab86171` stagnant-company regeneration guard, `c658acf` Wasl preparation
preservation) remain unpushed and still await the user's explicit word.

- **[VERIFIED]** Data safety: four isolated copies of `prisma/dev.db` were driven; the original's sha256
  stayed `563799682c02bcbd62d3c413754293e32d5f5c214c47c74f080e212c48a8744e` before and after every run.
  `src/lib/constants.ts` was temporarily patched per scenario and restored from a pristine copy;
  `git status --short` is unchanged (the same three pre-existing modified files). The scratch harness was
  removed from `scripts/` and kept in the session scratchpad.
- **[VERIFIED]** Method: `generateSchedule` was run twice over each open bucket (2026 months 7·8·9 =
  Aug/Sep/Oct) per scenario, so both sides are compared after the engine has settled. A control run with
  unchanged constants reproduced the stored state **byte-identically** (0 of 1098 cards changed), which is
  what makes every delta below attributable to the constants and not to regeneration noise.
- **[VERIFIED]** Lead-time scenario (`STORY 1→2`, `REEL 1→2`, `PHOTO_SHOOT_LEAD 3→4`): 26 STORY design
  cards move 1–4 days earlier, 0 publication dates change, 1 new overdue card appears. Only 2 of the 14
  live rule violations are fixed; the other 12 are reel montage, which `LEAD.REEL` does not schedule. See
  §3 for the full evidence, including the two effectively inert constants.
- **[VERIFIED]** Capacity scenario (designer 6/day via `TYPE_HOURS 0.8→1.333`, حلا 3/day via
  `hoursPerDay 4`, rates 8→6): only 4 cards move (1–3 days earlier), no new overdue cards, no publication
  date changes. Reason: the binding constraint is not capacity — measured peak designer load is **3 cards
  per day** (Ayman 19 cards over 14 days, Sabin 30 over 24). The engine's real designer ceiling today is
  **10/day** (`hoursPerDay 8 ÷ TYPE_HOURS 0.8`), while the workload screen uses the per-employee rate of
  **8/day**, and the user's rule is **6/day** — three different numbers in three places. Lowering it is
  therefore mostly a truth-in-reporting change, not a scheduling change: September commitment moves from
  2.5→2.8 days for Ayman and 3.7→4.1 for Sabin, out of 22 working days.
- **[VERIFIED]** Photographer constraint: Majed never exceeds the user's 3-companies-per-day limit in the
  current plan (every shoot day is a single company), but **4 days carry 3 reels for the same company**
  (التوظيف on 2026-09-02, 09-16, 09-30, 10-14), which breaks the user's "2 reels per company per day"
  rule. That limit is a grouping constraint the flat daily-hours model cannot express; it is engine work
  in `scheduler.ts` with its own tests, not a constant.
- **[PENDING]** Scope limit stated to the user: the local snapshot is dated 2026-08-26 and does **not**
  contain Wasl's live September cycle (43 pieces, 20 stories), so the live count of moved cards will be
  higher than 26 and the workload figures are lower than production's.
- No constant, capacity, rate, task date, or business rule was changed. The decision remains the user's.

### 2026-09-01 — Codex — Wasl cycle-2 boundary and full publication distribution verified live

- **[LIVE/VERIFIED]** The Wasl company dialog shows cycle 2 exactly as `1 أيلول → 1 تشرين الأول`, after the earlier `21 تموز → 21 آب` cycle. The live contract quantities are 15 posts, 8 reels, and 20 stories.
- **[LIVE/VERIFIED]** Filtered the production publishing page to Wasl and counted all 43 pieces. Posts are scheduled on Sep 1, 8, 9, 13–16, 20–22, and 26–30; reels on Sep 8, 10, 12, 17, 19, 23, 24, and 30; stories on Sep 8–10, 12–17, 19–24, and 26–30.
- **[LIVE/VERIFIED]** The first publication is Post 1 on 2026-09-01. The final Post 15, Reel 8, and Story 20 are all on 2026-09-30. Thus 2026-10-01 is the closing boundary, with no publication from this cycle scheduled after it.
- No production or local plan value was changed during this verification; the existing distribution already satisfies the requested cycle boundary.

### 2026-09-01 — Codex — Wasl live state re-verified; obsolete recovery removed locally

- **[LIVE/VERIFIED]** Re-filtered production to Wasl after reload. The board shows 93 TODO, 0 DOING, 0 REVIEW, and 3 DONE. The completed cards are Post 1–3 DESIGN, assigned to Ayman with work date 2026-08-30, matching the latest user-confirmed truth.
- **[LIVE/VERIFIED]** The dashboard shows 0/43 published, 3 ready, and 40 remaining. Post 1 publication is scheduled for 2026-09-01 but remains TODO, so actual publication is not proven.
- **[LIVE/VERIFIED]** Reel 1 SHOOT is assigned to Majed and still reloads with start 2026-09-06 and end 2026-09-07. The required dates are both 2026-09-01. Multiple controlled in-app interactions did not persist the native date input: a React-triggering rerender restored the original value before submission, and a full reload confirmed no production mutation.
- **[LOCAL-ONLY]** Removed `closePreviousOpenTasks.restoreMistakenClosures` from `scripts/data/wasl-plan-2026-09.json` while preserving the explicit 2026-09-01 cutoff. Updated the focused payload test to require the safe shape. The test was observed failing before the JSON change and passing afterward.
- **[VERIFIED]** After regenerating the local SQLite Prisma client, the complete suite passed 460/460 tests in 42 files; `npm run typecheck` also passed. The first full-suite attempt failed only because the installed Prisma client had been generated from the PostgreSQL production schema, and no application assertion failed after restoring the test client.
- **[LOCAL/LIVE SPLIT]** Local HEAD is `c658acf`, but production remains last verified at `302ba9b`; local remote-tracking labels are not accepted as Vercel evidence. No commit, push, deployment, payload import, note cleanup, or successful production data edit occurred in this continuation.
- **[PENDING]** Persist and reload-verify Reel 1 SHOOT at 2026-09-01/2026-09-01, then clean only the stale closure evidence line from Post 1–2 notes without changing `DONE`.

### 2026-08-31 — Codex — Live Wasl closure verified; scope defect caught and recovery prepared

- **[LIVE/VERIFIED]** Commit `302ba9b` reached Vercel and the manager-decision payload was re-applied. Global TODO decreased by 11 and the Wasl board lost the three old additional Stories plus eight exchange/economic-calendar cards as intended.
- **[LIVE/VERIFIED]** The post-mutation verification gate caught an additional effect before any completion report: September Post 1 and Post 2 DESIGN were `READY/DONE`, while Post 3 remained independently `IN_PROGRESS`. The cause is structural: those September preparation cards start on 2026-08-30, so a month-bucket cutoff misclassified them as previous work.
- **[LOCAL-ONLY]** Replaced bucket classification with an explicit 2026-09-01 date cutoff over the task's latest scheduled date. Added an exact evidence-gated recovery for Post 1–2 DESIGN only; it restores `NOT_STARTED/TODO`, clears the mistaken completion timestamps/evidence, and leaves Post 3 plus the 11 real older completions unchanged.
- **[VERIFIED]** Tests reproduce a current-cycle task stored/prepared in an earlier month, prove it is never closed, prove the exact mistaken closure is restored, and retain all prior guards. Full gates pass: 460/460 tests, typecheck, production build.
- **[PENDING]** Deploy, apply the recovery payload, verify the expected 95 TODO + 1 DOING + 0 DONE new-cycle state, then finish the Wasl report.

### 2026-08-31 — Codex — Wasl plan applied live; older-open discrepancy isolated

- **[LIVE/VERIFIED]** Commit `e36245e` reached Vercel and exposed the authenticated `استيراد خطة JSON` control. The verified 43-piece Wasl payload was accepted through the UI. Live cards showed the expected descriptions, Ayman's six design assignments on 2026-08-30, and Post 1 publication on 2026-09-01.
- **[LIVE/VERIFIED]** A live Wasl-only task filter exposed 10 still-open cards from pre-September buckets, including three additional Story cards and `نشرات الصرف والمفكرة الاقتصادية` carryovers. They were not September plan pieces and had blank briefs, so the first import preserved them and the discrepancy was reported rather than silently altered.
- **[LOCAL-ONLY]** Added an explicit manager-decision closure option to the validated plan action and payload. It closes only open pre-target-month rows, excludes completed/cancelled rows, maps publish-stage tasks to `PUBLISHED` and other stages to `READY`, preserves existing descriptions, fills blank descriptions with `تحتاج محتوى`, and appends the durable 2026-08-30 decision evidence. The UI toast reports the closure count.
- **[VERIFIED]** Permanent tests cover prior manual cards, publish-stage mapping, a later scheduled date, existing-description preservation, cancelled-row preservation, and current-cycle manual-row preservation. Full gates pass: 460/460 tests in 42 files, typecheck, and production build. Expected local Prisma datasource warnings were caught during static-page collection; the build completed successfully.
- **[PENDING]** Commit/push/deploy this follow-up, re-import the Wasl payload, and verify the exact live closure count and unchanged September schedule before reporting Wasl.

### 2026-08-31 — Codex — Safe Wasl correction and complete plan payload prepared locally

- **[LIVE/VERIFIED]** The user signed into the controlled in-app admin session. Wasl's live company card still has 15 posts, 8 reels, and 20 stories, and its edit dialog shows cycle 1 `21/7 → 21/8` plus the incorrect renewal cycle `21/8 → 21/9`. The existing edit form cannot safely repair the second cycle because its date field edits the original publication anchor.
- **[LOCAL-ONLY]** Added a dedicated, admin-protected latest-renewal correction. It replaces only the latest renewal, calculates the complete shared schedule so capacity stays consistent, but persists only the selected company's generated rows. The replacement cycle is built before the obsolete bucket is removed. A permanent integration test proves the previous-cycle rows remain byte-identical and other buckets are scoped correctly.
- **[LOCAL-ONLY]** Added an admin-protected, all-or-nothing plan-update path. It validates every `(type, pieceNo)` mapping before writing, copies each description to every pipeline stage, refuses incomplete maps, and can pin explicitly supplied design/publication dates without changing owners or status.
- **[VERIFIED — FILES/LOCAL]** Converted the visually checked Wasl Plan 2 into `scripts/data/wasl-plan-2026-09.json`: exactly 8 reels, 15 posts, and 20 stories, no blanks or duplicate identities. The four items with source-sensitive facts are labelled for verification instead of being presented as established facts. Post 1–3 and Story 1–3 design are pinned to 2026-08-30; Post 1 publication is pinned to 2026-09-01; no reel shoot date is assigned.
- **[VERIFIED]** `npm run typecheck`, 460/460 tests in 42 files, and `npm run build` pass. The integration suite exercises correction, prior-history preservation, complete brief propagation, explicit-date pins, and no-partial-write failure.
- **[LIVE/VERIFIED]** Commit `da39956` was pushed to `origin/main` and `origin/codex/qa-deep-stabilization`; Vercel served the new correction control. Using the authenticated UI, Wasl's latest renewal was changed from 2026-08-21 to 2026-09-01. A fresh reload and edit-dialog inspection show only `21/7 → 21/8` and `1/9 → 1/10`; the original publication anchor and previous cycle remain intact.
- **[LOCAL-ONLY]** Added a generic `استيراد خطة JSON` UI control so the validated server action can be invoked through supported, auditable admin UI. The selected company id is forced by the card, preventing a pasted payload from targeting another client. The follow-up still passes 460/460 and the production build.
- **[PENDING]** Deploy the small import-control follow-up, apply the Wasl payload, and verify old/new task buckets plus all 43 descriptions, six Ayman dates, and first publication live before reporting Wasl.

### 2026-08-30 — Codex — Publish-date UI hotfix and Wasl audit started

- **[VERIFIED/LIVE]** The release claim that `تاريخ النشر` was available was false for real publish cards: production cards use `kind=PUBLISH`, while the form checked the impossible `kind=CONTENT && stage=PUBLISH` combination. No business data was changed while diagnosing this.
- **[VERIFIED]** Added a real `TaskForm` regression test, fixed the condition, generated the correct Prisma client for the suite, and passed 454/454 tests plus `npm run build`. Commit `22cffc5` was pushed to both the branch and `main`; Vercel deployment `dpl_HRNSt5kPmv5Zmo882uc6pFCZV4ub` reached `Ready`. The public BRU Reel 1 dialog then showed `تاريخ النشر` with its existing 2026-07-23 value.
- **[USER-CONFIRMED]** The user changed the immediate company order and supplied new facts: Wasl previous cycle fully done; renewal/first publication on 2026-09-01; Ayman designs 3 posts + 3 stories on 2026-08-30; try to shoot one reel without a confirmed date. Agalya is fully closed/no renewal; BRU has two filmed reels awaiting edit plus one ready with Omar; Dr Nour, Siizen, Albalsam, and Mango require later matching.
- **[LIVE/VERIFIED]** Wasl's live July-cycle view has 100 completed previous-cycle cards plus three open cards explicitly labelled as carryover from the wrong `21/8 → 20/9` cycle. The August view reports 105 pending and 33 done because that wrong cycle was already generated.
- **[VERIFIED — FILES]** Read `Wasl_Content_Plan NO.1- AUG.docx` structurally and extracted/visually inspected all 23 pages of the newer `Wasl_Content_Plan NO.2- AUG.pdf`. Plan 2 contains complete briefs for 8 reels, 15 posts, and 20 stories and is the source for the new cycle.
- **[BLOCKED]** The source renewal record can only be changed through the authenticated admin area. The in-app browser reached the admin login; Chrome extension control is unavailable because its native-host registration is missing. No password, cookie, Vercel secret, Telegram token, or database URL was exposed or copied. The attempted full production-environment pull was rejected and not performed.
- **[PENDING]** User should sign into the admin page in the controlled browser and reply `تم`. Then perform the exact Wasl actions in §11, verify live, and report Wasl before touching the next company.
- No Wasl task value, contract record, Instagram item, Telegram message, or BRU date was changed in this audit step.

### 2026-08-30 — Codex — Claude release report reconciled into canonical state

- **[USER-CONFIRMED]** Received Claude's detailed report and summary: the former 57-file loss risk is resolved through seven scoped commits; three core defects are fixed; the production cron secret was added and verified; the release is live; no production application data was written.
- **[VERIFIED]** Local Git agrees: clean `codex/qa-deep-stabilization` worktree at `bb09751`; both `origin/main` and `origin/codex/qa-deep-stabilization` point to the same commit; exactly seven commits follow `5c3e9e1`.
- **[VERIFIED]** Updated the stale current-state sections that still described the publication-date feature as local-only and deployment as blocked. Historical session-log entries remain unchanged.
- Added the user-supplied Claude artifact URL to the source registry. The artifact was not publicly readable from the available browser session, so no extra facts were inferred from it; the user's summary, Claude's committed handoff, and Git were used instead.
- **[PENDING]** Next action is the already-authorized one-time correction of the seven BRU publication dates, followed by live Vercel verification and the BRU ready/published/remaining report.
- No Vercel data, Telegram message, Instagram content, code behavior, or deployment was changed in this reconciliation step.

### 2026-08-29 — Claude — Released to production and verified live

- **[USER-CONFIRMED]** The user added `CRON_SECRET` to the Vercel production environment (type `Secret`).
  The value was generated and entered by the user; no agent saw or handled it.
- **[LIVE]** `main` fast-forwarded `5c3e9e1` → `c919060` and deployed. The push was made as
  `git push origin codex/qa-deep-stabilization:main`, which never checks out a branch, so the shared
  working directory was not disturbed while the other agent was active in it.
- **[LIVE/VERIFIED]** Production checks after the deployment:
  - `/icon.svg` → `200`. That file exists only in `28b7ec9`, so the new build is confirmed live.
  - `GET /api/cron/done-report` without credentials → **`401 {"ok":false,"error":"unauthorized"}`**.
    `401` rather than `503` is the decisive result: it proves both that the fail-closed code is live and
    that `CRON_SECRET` is readable by the runtime. Vercel supplies the bearer token to its own cron
    invocations, so the scheduled reports authenticate normally.
  - `/today` renders with real production data.
- **[VERIFIED]** No production data was written by this release. The build is compile-only since `28b7ec9`,
  and the Prisma schema is unchanged across all six commits (`git diff 5c3e9e1..HEAD -- prisma/` is empty),
  so no schema push was required.
- **[PENDING]** Minor: the browser console reports a React hydration mismatch (minified error #418) on
  `/today`. The page renders correctly and this is not known to be a regression from this release — it was
  not measured before it. Worth a look, not a blocker.
- **[PENDING]** Next action is unchanged and belongs to the matching lane: apply the seven BRU actual dates
  from §6 using the `تاريخ النشر` field now live in the edit dialog, then verify each card.

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
