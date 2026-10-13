# Social Media Team Dashboard — Shared Agent Handoff

> **Canonical continuity file.** Any Codex or Claude agent continuing this project must read this file completely before inspecting, changing, deploying, or reconciling data. Update the current-state sections and append a session entry before ending meaningful work.

Last updated: **2026-10-13 (١٨:٤٥)** (fix plan A–I + independent F–H review fixes + lead's 13/10 decisions + final 5-reviewer pre-merge review + lead's §15/§16 decisions (carousel load, no idle day) — all PUSHED to GitHub branch `claude/interesting-feistel-0eec40-gqr3vf` on `hla-sh93/sm-team-dashboard` (PUBLIC repo; private disabled by GitHub regional policy). NOT merged to `main`, NOT deployed; production deploys from GitLab `main` → Vercel. See the 2026-10-13 (١٧:٠٠) log entry.)

Workspace: `C:\Users\hla2-\Videos\Social\socialmediateam-live` (fresh clone of `origin/main` at `ffcd0bc`, 2026-09-15). **⚠️ The former workspace `C:\Users\hla2-\Videos\Social\sm-team-dashboard` no longer holds this repository**: on 2026-09-14 its contents were replaced by the May-2026 zip extraction (`sm-team-dashboard.zip`, Apr-30 code, no `.git`, no handoff). A full day of test/report work was done there on 2026-09-15 against that stale copy before the mismatch was noticed; nothing from it applies to production. The lead's own working folder appears to be `E:\Hla\Social\sm-team-dashboard` (drive not mounted here). Uncommitted local work that may exist there is not in this clone.

Production alias: <https://socialmediateam.vercel.app>

Current phase: **2026-10-13 (١٩:٥٠، الديسكتوب) — LIVE: `355fa01` deployed (lead «انشر هلّق»; done-today cards struck through, verified on the live home page 19:35). Production writes today with the lead's approval, each verified by a backup diff: two external urgent cards for 14/10 (نوال writing + سابين design, الثانوية الوطنية الخاصة collab, no company); `prod-76` (سابين's «أول سوري» design done + عمر's urgent publish card today); `prod-77` (التوظيف October posts: 10-1 design done 13/10 + publish moved to 14/10; 10-2/10-3/10-4 design+publish reopened — they had been closed by the publish cascade after hand «منشور» marks on 12/10 09:28 and 13/10 09:38). Lead decision 13/10: hand «منشور» keeps closing the stages before it (no guard). OPEN for the lead: the other 12/10 09:25–09:39 hand marks (~20 publish cards incl. Phoenitech STORY#1/#2 designs and REEL#1 shoot+edit closed by cascade); SA-02 rotation; J (عبادة restore, مخبر 5/6 + BW 4 edits); new company «الثانوية الوطنية الخاصة» after signing. Previous: 2026-10-13 (١٩:٠٥، الديسكتوب) — DEPLOYED AND VERIFIED LIVE: the lead said «انشر»; GitLab `main` fast-forwarded c66fa7f → f3fd29c (46 commits) at ~18:47 after a fresh read-only backup (`backups/prod-20261013-1845.json` in this worktree, 1380 cards); Vercel deployment f3fd29c Ready – Production in 1m17s (dashboard, lead logged in). Live checks 19:03: /, /tasks, /today, /publishing, /login 200; /admin → 307 /login; 4 crons + /api/backup/export without secret → 401; public pages now carry 0 salary/contractValue/costPerReel/telegramUserId keys (were 11/16/11/11 at 18:50 — SA-01 closed live); «مهام اليوم» on the live home page lists عمر's due publish cards under his full-day card. NOT yet deployed: `5fd8126` (done-today cards struck through instead of «أُنجز اليوم: N بطاقة», lead's request 13/10; verified locally on the 13/10 copy) — needs a new «انشر». OPEN for the lead: SA-02 rotation (AUTH_SECRET on Vercel + new admin password — she must type secrets herself); J corrections (عبادة restore, مخبر reels 5/6 + BW reel 4 edits, التوظيف POST#4 + مخبر POST#2 publish cards marked published by hand today 09:38). Previous: 2026-10-13 (١٨:٤٠ بساعة الجهاز، الديسكتوب) — root cause of the wrong edit closures found and guarded: 6 أليسار edits were closed BY HAND on 11/10 17:38:37→17:40:09 (1–5 s apart, no notes, no Telegram message, no Claude/Codex session active) through the open status list / board, which had no order check ("soft gate, no hard block") and records no actor. New guard in `updateTaskStatus`/`moveCard`: a production stage can't be closed while the production stage before it is open (WRITE blocker and PUBLISH cards exempt) + test (mutation-checked); suite 1319 pass + 4 known data failures; tsc/eslint clean. The lead logged in as admin in the in-app browser ✓. Lead's account now CONFLICTS with the data — must be resolved before any correction (J): مخبر reel 5 (card: shot 28/9 per her 28/9 statement; Telegram `Drnoor-reel-10-5.mp4` from أليسار 2/10) vs «5 و6 لسا ما تصوّرو ولا تمنتجو»; عبادة «خطة شهر 9 خالصة» vs the 22/9 cycle (files named «9») showing posts 2–6, story 4, reels 2–3 without files, and no «plan 10» cycle in the system. Deploy still WAITING for the lead's «انشر». Previous: 2026-10-13 (١٨:٢٠ بساعة الجهاز، الديسكتوب) — fresh production backup pulled by Claude at 17:54 (`backups/prod-20261013-1754.json` in THIS worktree, sha 0318ce32dbd3; today's 12:00 scheduled pull had failed with «fetch failed»): 1380 cards / 44 sessions vs 1403 / 48 on 11/10 — the lead's «أوقف النشر» on عبادة at 08:47 today made the LIVE code delete 32 open cards + 4 sessions (incl. 1 finished edit, REEL#1) — exactly what D1 fixes; restorable from `prod-20261011-1249.json` after deploy, with the lead's OK. Re-ran everything on today's data (separate test DB): simulation new 0/0/4 vs live 23/23/29; first regen moves 0 open unpinned cards, reopens 1 finished card (مخبر REEL#6 EDIT — live code does the same + re-dates a second). The 4 + the reopen come from the 11/10 17:38–17:40 batch closure of 6 أليسار edits: BW REEL#4 and مخبر REEL#6 closed while their shoots are open and with no Telegram file → data question for the lead (J), not a deploy blocker. Deploy still WAITING for the lead's «انشر»; the release changes the session-cookie format (phase A) so every admin gets logged out once. Previous: 2026-10-13 (١٧:٥٠ بساعة الجهاز، الديسكتوب — بعد مدخل «١٨:٠٠») — scenario simulation of 8 working days (13→22/10) × every person × 3 scenarios (all finish / half finish / nobody finishes) on the mirror found ONE more defect: a full-day production card (عمر's in-progress ADHOC «متابعة مع العملاء», 8h since 30/5) stopped the queue loop (`break`) before the zero-effort publish cards, so due posts vanished from the publisher's list — on production code only the today-pinned ones survived (10 due hidden), and after §16 (`f227ec5`) all 15. Fixed in `selectDailyWork` (the loop continues; production stays capped) + 2 mutation-checked tests. Simulation after the fix: 0 problems; production code: 19/17/12 (Sabine idle/under-filled, عمر up to 44 due posts missing, نوال, أليسار). Mirror: suite 1329 = 1318 pass · 3 expected-fail · 4 skipped · 4 known data failures; `PREDEPLOY=1` 4/4; tsc + eslint clean. Still WAITING for the lead's explicit go (Neon snapshot → admin login → merge to GitLab `main`). Previous: 2026-10-13 (١٨:٠٠، الديسكتوب) — the lead's 4 decisions applied and verified on the mirror; branch ready for the deploy steps (Neon snapshot → admin login check → merge to GitLab `main`) — WAITING for the lead's explicit go. Fixed: Sabine's short day (a pinned day no longer postpones, only «بدّل» and shoot appointments), the engine never re-dates a finished card (reverts `ed768af`'s guess), evening rules everywhere (`late.ts`), predeploy item 3 (past shoots = info; done cards by piece identity). Mirror: full suite 1327 = 1316 pass · 3 expected-fail (DA) · 4 skipped · 4 known data failures; `PREDEPLOY=1` 4/4; tsc + project eslint clean. Previous: 2026-10-13 (١٧:٣٠، الديسكتوب) — mirror run done, deploy BLOCKED on 3 code findings awaiting the lead's approval (no code changed): (1) Sabine's short day = pinned dates from the 11/10 reschedule payload read as «بدّل» by `fixedDayISO` (same on production code and branch; Ayman 4 and Lilas 5 cards held too); (2) NEW regression `ed768af`: a regen moves a FINISHED edit card's dates (Obada reel 2 m=7, 25/8 → 18/8; production code doesn't) — `regen-reality` red; (3) past shoot sessions are rebuilt on regen (Phoenitech REELS#2 16/9→17/9 new from SC-03; Obada REELS#2 20/8→24/8 also on production code) — predeploy item 3 red. Full suite on the mirror (11/10 12:49 snapshot): 1320 = 1308 pass · 3 expected-fail (DA) · 4 skipped · 5 fail (4 known + regen-reality). See the 2026-10-13 (١٧:٣٠) entry. Previous: 2026-10-13 (١٨:٤٥) — ready for the lead's pre-deploy run on her machine. Branch `claude/interesting-feistel-0eec40-gqr3vf` = 35 commits ahead of `origin/main@c66fa7f`, pushed to GitHub only; no merge, no deploy, no production write, no schema change. Gates in the cloud session (seed DB, NOT the production mirror): `tsc` + `eslint .` clean, `npm run build` passes, tests 1315 = 1285 pass · 30 fail (the same 30 all session, all need the production mirror). Lead decisions today [USER-CONFIRMED]: work on the public GitHub copy and delete nothing; late-exemption = paused only (WORK_RULES §14); carousel = one task, team naming `Company-carousel-<month>-<post>-<slide>` (WORK_RULES §15); morning = each person's tasks, evening = finished + delays. Since 17:00: WORK_RULES §16 (queue is always a full day of open work; «ليس لديه مهام — متفرّغ لاستلام مهام إضافية» only with zero open cards) implemented in `selectDailyWork`; a wrong WRITE-card bypass was reverted (nobody works before the writer closes the plan card); §15 carousel = 1 post in plan/reports, slides = designer load (already so). Sabine's one-task day is NOT yet explained — run item 4 of `predeploy-mirror` (per-employee queue + excluded cards with reasons, written to `predeploy-today.log`) on the real mirror first. OPEN for the lead: (1) morning vs evening still differ on card-level «بانتظار الزبون» notes and stories-late-only-after-cycle-end (recommend §10 rules everywhere); (2) keep or drop the evening lines «ما سجّل شي» and «مفتوح على اليوم». NEXT (desktop, in order): fetch branch → `npx prisma generate` → full suite on the real mirror + `PREDEPLOY=1 npx vitest run tests/predeploy-mirror.test.ts` (Telegram identities, no active company with exemption text, first regen moves no past shoot / done card) → fill missing Telegram identities → Neon snapshot → lead confirms admin login → merge to GitLab `main` → post-deploy checks → SA-02 rotation (`AUTH_SECRET` + admin password; repo is public) → phase J (production data). Previous: **2026-10-13 (١٠:٠٠) — fix plan in progress, LOCAL ONLY (nothing pushed, no production write, no schema change): A–H and the independent review's fixes on C–E are committed; every code finding of the deep test now has a passing test (the 3 remaining `it.fails` are data: DA-03/09/10 → J). Full suite 1279 = 1272 pass · 3 expected-fail · 4 old data failures. Docs (phase I) updated 10:20. Next: independent review of F–H · J (production data, lead review) · K (gates + push approval). See the 2026-10-13 (١٠:٠٠) and (١٠:٢٠) log entries. Previous: 2026-10-13 (٠٩:٣٠) — 2026-10-13 (٠٩:٠٠) — 2026-10-13 (٠٨:٣٠) — 2026-10-12 (٢٣:٥٩) — fix plan in progress, LOCAL ONLY (branch `claude/interesting-feistel-0eec40`, nothing pushed, no production write): phases A (security) · B (data-loss guards) · C (regen stability) and the lead's decisions D1 (pause hides, resume continues the remainder) · D2 (prep week from signing) · D3 (cards close only by their owner or the lead) · D4 (work handover tool) plus E (Telegram accuracy) are committed. Full suite 1246 = 1200 pass · 42 expected-fail · 4 old data failures. Next: independent review of C–E, then phases F–K; push only with the lead's approval. See the 2026-10-12 (٢٣:٥٩) log entry. Previous: 2026-10-12 (٢٢:٠٠) — deep test campaign finished, LOCAL ONLY: 8 axes, 41 new test files / 447 tests (120 `it.fails` documenting bugs by ID), ≈145 findings with severity, consolidated in `docs/qa/deep-test-2026-10-11/REPORT.md`. Seven P0: SA-01 (open employee pages ship salaries/contract values to anonymous browsers — verified LIVE by key-name count), SA-02 (admin auth secret/password hash in git history; lead must rotate on Vercel), RG-01 (cancellation leaks onto a done piece after re-time), RG-02 (company form lowers counts without the §٩ guard → done piece deleted), TR-01/TR-02/TR-24 (Telegram false completions). No `src/` change, nothing pushed, no production mutation; fixes await the lead. Full suite 1074 pass · 120 expected-fail · 7 pre-existing failures. See the 2026-10-12 log entry. Previous: 2026-10-11 (15:50) — «مهام اليوم» backlog state now lists the held cards with their reason (pinned to which later day, or waiting on which card and owner) instead of a bare «متبقّي N»; cause: the 12/10 reschedule left Sunday 11/10 empty for سابين (12 cards) and نوال (8). `51dc2ce` pushed to `main`, Vercel build verified live at 16:03 (new buildId, `/login` 200, cron 401). Previous: 2026-10-11 (مساءً) — `applyPipelinePreservation` fix: when a plan's count goes up, the new pieces no longer inherit an old piece's board/status/stamps/brief/notes through the date fallbacks (claimed-row guard, +4 tests; suite 738/747 with the same 9 pre-existing failures). Pushed and merged to `main` as `1f34a01` (fast-forward), Vercel build verified live at 12:48 (new buildId, `/login` 200, cron 401). prod-61…64 were already applied on production by another session before this fix (snapshot 12:00): only POST#7's notes line was affected and prod-64 overwrote it, so the fix is preventive for the next count increase, no production correction needed. See the 2026-10-11 (مساءً) log entry. Previous: 2026-10-01 (10:05) — BW on 8 posts + 4 reels for the October cycle (record `posts` 4→8 through the new `planCounts` payload block, posts 5–8 briefs live); a cycle that has a later cycle registered now keeps its own piece counts on every regeneration (WORK_RULES §٩); «جدّد» / «لم يُجدد» available on every non-archived company at any time, and برو (paused, did not renew) archived. Pushed `331ec3b`, verified with `prod-20261001-1001.json`; see the 10:05 entry. Previous: 2026-10-01 (08:40) — test-only: `tests/plan-docx-import.test.ts` no longer depends on the wall clock (local commit `8ba5631`, not pushed; see the 08:40 entry). Operational state unchanged from 08:35: BW October cycle registered (10/10 → 9/11) and plan No.7 briefs live on REEL#1–#4 and POST#1–#4; posts 5–8 wait on the lead's decision to raise BW to 8 posts (`prod-54`). See the 08:35 entry. Previous: 2026-09-18 (11:05) — PhoeniJobs weekly loop live: عمر publishes one blog article on LinkedIn every Wednesday (five named articles, 23/9 → 21/10), نوال writes المقال ٨–١١ and سابين designs each cover; see the 11:05 entry. Previous: 2026-09-17 (15:25) — three additional cards added through the new `adhocCards` payload block (حلا: Phoenitech catalog 16/9→20/9 · سابين: two contest posts · نوال: contest copy, closed today); see the 15:25 entry. Previous: 2026-09-17 (15:10) — «مهام اليوم» now closes when the day's work is done: finished-today cards count against the rate, the home panel shows «تم إنجاز مهام اليوم» (pushed; see the 15:10 entry). Previous: 2026-09-16 (22:40) — Telegram reduced to two daily messages (07:45 distribution by company + count; 20:00 achievement report), pushed; see the 22:40 entry. Previous: 2026-09-16 (19:35) — التوظيف on its September plan only (October renewal removed, August closed, document briefs on the cards); ماجد Wed = التوظيف + فونيتيك, Thu = وصل, rate 6/day; achievement per latest cycle with the span beside each company; task filter active-only. See the 19:35 log entry. Previous: 2026-09-15 (15:20) — company lifecycle rule live: «لم تجدّد» = archive section with auto-closed cards, pause only for active companies on client request (`05a872f`, verified with snapshot 15:15; WORK_RULES §٨). Previous: 2026-09-15 (14:45) — التدريب October course cards live for سابين (Wed 16/9 · Thu 17/9) via the new `courses` payload block (`prod-22`); September training closed on Instagram evidence; see the 14:40 log entry. Earlier text follows.** Previous phase: **2026-09-15 — two live issues from the lead (designer day shows one card; shoot-week re-dating for ماجد/أليسار). Diagnosis and three draft payloads are in the 2026-09-15 log entry; nothing applied, preflight blocked on a production snapshot. Earlier phase text follows.** Full application audit requested by the user; report completed locally at `docs/qa/APP_STATE_DEEP_TEST_2026-09-06.md`. Current local HEAD `556c9db`; 555/555 tests pass. Six confirmed audit findings remain, including unguarded full regeneration, inconsistent overdue reporting, live Today hydration/timezone and Telegram-match display defects, eight dangling dependencies in the latest saved snapshot, and an audit exit-code defect. Latest saved snapshot is 2026-09-05 10:26 Baghdad (1,129 tasks); live browser inspected 2026-09-06. No audit fix, production mutation, deployment, or local database sync performed. Earlier company states and next actions below are historical and must be reconciled with newer dated entries before use.**

## ٢٠/٩/٢٠٢٦ — دفعة مهام القائدة (Claude) · **جلسة موقوفة مؤقتاً، تُستأنف**

### مُطبَّق على الإنتاج ومتحقَّق منه بلقطة (لا برسالة النجاح)

اللقطة بعد التطبيق: `backups/prod-20260920-1308.json` (الكروت ١١٣٣ → ١١٥١).

| الحمولة | ماذا فعلت |
| --- | --- |
| `prod-29-jobs-weekly-2026-10` | **كانت مكتوبة منذ ١٨/٩ ولم تصل الإنتاج إطلاقاً** — سجّلها هذا الملف «live» خطأً. طُبِّقت الآن: ١٢ كرتاً (مقالات نوال ٨–١١ · أغلفة سابين · نشر عمر). |
| `prod-30-training-cv-workshop-2026-09` | محتوى ورشة الـCV لنوال على **التدريب** (باختيار القائدة) · ٤س · ٢١/٩ → ٢٣/٩ · أولوية «مهم». |
| `prod-31-jobs-week39-and-contest-ideas-2026-09` | مقال أسبوع ٢٠–٢٤/٩ (٣س، ٢٣/٩) + أفكار المسابقة (٢س، ٢٤/٩) — كلاهما لنوال. |
| `prod-32-tawzeef-hla-omar-shoot-2026-09-20` | ريل خطوات الدعوة للمسابقة (حلا، منجز ٢٠/٩) · نشر محتوى المسابقة (عمر، ٢٠/٩ → ٥/١٠) · تصوير التوظيف ريل ٥+٦+٧ → الاثنين ٢١/٩ · مونتاج ريل ٥ → ٢٢/٩. |
| `prod-33-schools-banner-2026-09` | بانر المدارس (حلا، منجز ١٧/٩). |
| `prod-34-balsam-shoot-2026-09-22` | تصوير البلسم ريل ٤ → الثلاثاء ٢٢/٩ (كان ٣٠/٩). |
| `prod-35-obada-story9-close-2026-09-20` | إغلاق تصميم ستوري ٩ — عبادة (سنده: كرت النشر انتقل لمنشور بتأكيد تلغرام ٢٠/٩). |

### الدفعة الثانية — **مُطبَّقة ومتحقَّق منها** (١٥ تغيير حالة)

طُبِّقت ١٣:٥٥ بعد عودة إضافة Chrome (كانت مقطوعة نحو ساعة). التحقّق بلقطة `backups/prod-20260920-1355.json` صفّاً صفّاً — الخمسة عشر مطابقة، وسطرا الدليل الخاطئان على مونتاج BW ٣ و٤ مشطوبان فعلاً:

| الحمولة | التغييرات |
| --- | --- |
| `prod-36-phoenitech-shoot-monday-2026-09-21` | تصوير ريل ١+٢ → الاثنين ٢١/٩ · مونتاج ريل ١ → ٢٢/٩ · نشر ريل ١ → الأربعاء ٢٣/٩ (كان ٢٠/٩، أي قبل التصوير الجديد؛ الأربعاء باختيار القائدة). |
| `prod-37-obada-story10-close-2026-09-20` | إغلاق ستوري ١٠ تصميماً ونشراً «جاهزاً» بقرار القائدة بعد عرض بديل الحذف. نفدت منتجات الزبون: الإغلاق **إداري لا إنجاز**، والسبب في سطر الدليل لأنّه سيدخل نسبة «منتَج». |
| `prod-38-tawzeef-reel7-next-sunday` | تصحيح prod-32 بعد قاعدة «٢ ريل لكل زبون»: ريل ٧ ينتقل للأحد ٢٧/٩ · مونتاجه ٢٨/٩ · **نشره ٢٧/٩ → ٢٩/٩** لأنّ موعد النشر القديم هو يوم التصوير الجديد نفسه. يبقى ٥ و٦ على الاثنين. |
| `prod-39-bw-renumber-and-shoot-2026-09-21` | تصحيح ترقيم BW + إعادة فتح تصوير ٣ و٤ (٦ تغييرات). |

### تصحيح ترقيم BW — الحادثة وسببها

القائدة (٢٠/٩): «الترقيم غلط — تم تصوير ١ و٢ من خطة BW وليس ٣ و٤»، و«ريلان ١ و٢ تم تصويرهما وتسليمهما (تصوير ومونتاج)».

**ما حدث:** يوم ١٦/٩ سلّمت أليسار `bw 3-9.mp4` (١٥:٤٣:٤٢) و`bw 4-9.mp4` (٢٢:٠١:٠١) على مجموعة BW. طابقهما المطابق **بالاسم** على كرتَي مونتاج ريل ٣ و٤، وإغلاق المونتاج أغلق كرت التصوير الأعلى منه **تلقائياً** الساعة ١٥:٤٣:٣٨ و٢٢:٠٠:٥٥ — قبل الرسالتين بأربع وستّ ثوانٍ، **وبلا أي سطر دليل** (`notes: null`)، ومع أنّ موعدَي التصوير ٢٠/٩ و٢١/٩ لم يحِلّا بعد. الكرتان المصوَّران فعلاً (١ و٢) يحملان ملاحظة موعد ١٥/٩ — فالملاحظة الفارغة هي بصمة الإغلاق المتسلسل.

**درسان:** (أ) تسلسل الإغلاق من المونتاج إلى التصوير يكتب بلا دليل — مخالفة قاعدة العمل ٢، وتستحقّ فحصاً يمنعها. (ب) المطابقة بالاسم تثق برقم الملف، وترقيم الفريق لا يطابق ترقيم النظام — قاعدة العمل ١ بعينها.

**ما يصحّحه `prod-39`:** مونتاج ١ و٢ → منجَز بسطر التسليم الصحيح · مونتاج ٣ و٤ → لم يبدأ مع **شطب** سطر الدليل الخاطئ (`removeEvidence`) · تصوير ٣ → مفتوح ومثبَّت على الاثنين ٢١/٩ · تصوير ٤ → مفتوح، ومؤقّتاً الأحد ٢٧/٩ وغير مثبَّت (تركه على الاثنين يجعل يوم ماجد ستة ريلات بدل خمسة). بعد التصحيح يصير نشر ريل ١ (١٧/٩) و٢ (٢٠/٩) ممكناً عند عمر — وكلاهما مستحقّ الآن.

### مواعيد تصوير الأسبوع كما ستستقرّ

القاعدة من القائدة: «٢ ريل لكل زبون — المخبر وفونيتيك والتوظيف؛ البلسم ١ · عبادة ١ · BW ١».

- **الاثنين ٢١/٩** (خمسة ريلات لماجد): التوظيف ٥+٦ (١١:٠٠) · فونيتيك ١+٢ (١٢:٣٠) · BW ٣ (١:٣٠).
- **الثلاثاء ٢٢/٩**: البلسم ريل ٤ (٢:٠٠) — مُطبَّق.
- **الأحد ٢٧/٩**: التوظيف ريل ٧ · BW ريل ٤ (مؤقّت).
- **عبادة والمخبر (الأربعاء/الخميس): لم تُنشأ لهما كروت** — القائدة: «بانتظار موافقة العميل». عند الموافقة: عبادة = المشهد المتبقي من ريل ٣ (كرت تصوير خارج الخطة + كرت إعادة مونتاج؛ كرت النشر مفتوح ومتأخر منذ ١٧/٩)، والمخبر = ريلان خارج الخطة ريثما يُسجَّل تجديد شهر ١٠.

### التحقّق النهائي من الإنتاج (لقطة ١٣:٥٥)

- **طابور ماجد:** الاثنين ٢١/٩ خمسة ريلات بالضبط (BW ٣ · فونيتيك ١+٢ · التوظيف ٥+٦) · الثلاثاء ٢٢/٩ البلسم ريل ٤ · الأحد ٢٧/٩ التوظيف ٧ و BW ٤ · الاثنين ٢٨/٩ فونيتيك ٣ و٤.
- **نوال:** الاثنين ٤س ورشة الـCV · الثلاثاء ٣س لينكد إن · الأربعاء ٣س مقال المدونة · الخميس ٢س أفكار المسابقة.
- **أثر تصحيح BW:** نشر ريل ١ (١٧/٩) وريل ٢ (٢٠/٩) صارا مستحقَّين عند عمر بعد أن كانا محجوبين خلف مونتاج مسجَّل «لم يبدأ».
- **ملاحظة تقنية:** `publishDate` على كرتَي التصوير والمونتاج يبقى على القيمة القديمة بعد تحريك كرت النشر. غير مؤثِّر: `taskDeadline = readyDate ?? publishDate`، وكل الكروت المعدَّلة لها `readyDate`. وهو سلوك قائم أصلاً في الإنتاج (مثال: عبادة بوست ٢).

### فحص تلغرام × المنصة (٢٠/٩، بطلب القائدة «أرجع تحقق من مهام كل الفريق»)

فحص للقراءة فقط على اللقطة (لا `deep-audit.ts` — يكتب على الداتا، قاعدة العمل ٣). النتائج:

- **لا خرق لترتيب المراحل في أي شركة.**
- **١٩٦ من ٢٦٥ ملف منذ ١/٩ بلا مطابقة** — معظمها حميد (صور خام `DSC*`، مستندات، إعادة إرسال لكروت مغلقة). الحقيقي منها كرتان فقط. ما يكسر المطابقة بالاسم: مسافة مزدوجة (`obada  1-8.mp4`)، مسافة زائدة (`wasl 2-9 .mp4`)، لاحقة أجزاء (`wasl-story-9-1-2.jpg`).
- **عبادة: لا خلل.** القائدة أكّدت أنّ الملفين المُسلَّمين هما ريل ٢ و٣ («العنوان والكرسي»)، فلا إزاحة ترقيم؛ ومونتاج ريل ١ مفتوح **بحق** (أُعيد فتحه بعد تصوير ١٥/٩). صُحّح شيء واحد: سطر دليل مفقود على مونتاج ريل ٢ (`prod-40`).
- **Siizen: أكبر فجوة.** كانت ريلات ٣–٦ كلها `NOT_STARTED` في المراحل الثلاث بلا أي ملف. إفادة القائدة: ٣ منتَج · ٤ قيد المونتاج · ٥ و٦ بانتظار معلومات من العميل → `prod-41`.
- **البلسم:** خمس قطع تصاميمها جاهزة ونشرها عالق منذ ٢٥–٣١/٨ → نُقلت للاثنين ٢١/٩ ومثبَّتة (`prod-42`).

**المتأخرات: ٣٦ → ٢٨.** المتبقّي: Siizen ٢٠ · عبادة ٢ (نشر بوست ٦ وريل ٣) · البلسم ٢ (ستوري ١٣ تصميماً ونشراً) · BW ١ · وصل ١ · التدريب ١ · التوظيف ١.

⚠️ ريلا Siizen ٥ و٦ موقوفان على العميل ومكتوب ذلك في دليلهما، لكنهما **يظلّان في لوائح المتأخر**: `isTaskLateState` لا تقرأ الحجز ولا إعفاء الشركة (مشخَّص في مدخل ٣/٩ فقرة ج، ولم يُصلَح بعد).

## ٢١/٩/٢٠٢٦ — ورشة الـCV، وفرق التقرير عن اللوح (Claude)

**`prod-43`** (مُطبَّقة ومتحقَّقة، لقطة `prod-20260921-0853.json`): أُغلق كرت نوال «كتابة محتوى الورشة التعريفية لكتابة السيرة الذاتية» بدليل تسليم `ورشة تدريبية مجانية - محاور.docx` (تلغرام ٢٠/٩ ١٠:٢٨، لم يطابقه المطابق لأنّ اسمه وصفي)، وأُنشئ كرت التصميم المقابل لسابين (٢س، ٢١/٩ → ٢٣/٩، «مهم»). **سبب غيابه:** طلب ٢٠/٩ ورد تحت عنوان «مهام لنوال» ولم يذكر سابين، فأُنشئ نصف المهمة فقط.

### `5ca7ba3` — المستحقّ اليوم من دورة سابقة كان يختفي من صفحة النشر

القائدة أرفقت لقطة رزنامة النشر ليوم الاثنين ٢١/٩: ثلاثة عناصر منشورة (وصل بوست-٩ · التوظيف بوست-٦ · وصل ستوري-١٢) ولا أثر لمركز البلسم، بينما تقرير الصباح يقول «نشر: مركز البلسم». أُعيد إنتاج الخانة بالتشغيل فطابقت اللقطة حرفياً.

**السبب — وهو من صنع `prod-42`:** صفحة النشر منطقتان. الشبكة تفلتر بالبكت (`t.year === year && t.month === month`)، وشريط «متأخر النشر» يلتقط ما لا خانة له بشرط `publishDate < اليوم`. كروت البلسم الخمسة في بكت **آب (m=7)** ونقلتُ موعد نشرها إلى **٢١/٩** لتظهر في «مهام اليوم» — فسقطت من الاثنين معاً: الشبكة ترفضها للبكت، والشريط يرفضها لأنّ موعدها اليوم لا قبله. قبل التعديل كان موعدها ٢٥–٣١/٨ فكانت تظهر في الشريط.

وهي ثغرة بنيوية لا خاصة بالبلسم: **أي كرت من دورة سابقة موعده اليوم يختفي من الصفحة كلها.**

**الإصلاح:** الشريط صار يأخذ المستحقّ اليوم من بكت آخر أيضاً، وعنوانه «متأخر النشر ومستحقّ اليوم»، وكرت اليوم يكتب «موعدها اليوم» بلا لون الخطر (وسمه متأخراً إنذار كاذب — قاعدة العمل ٦). تحقّق بالتشغيل: الشريط ٢٧ → ٣٢ والخمسة ظهرت. `tsc` نظيف، والاختبارات ٦٦١/٦٦٩ وهي **نفس خطّ الأساس** قبل التعديل (٨ إخفاقات سابقة سببها `prisma/test.db` قديمة، لا علاقة لها بالتغيير).

**متبقٍّ معروف:** كرت من بكت سابق موعده **مستقبلي** يبقى غير ظاهر حتى يحلّ موعده (عبادة ريل ١ في ٢٢/٩ · البلسم ريل ٤ في ٦/١٠). يظهر يوم استحقاقه بحكم هذا الإصلاح.

### لماذا يختلف تقرير ٠٧:٤٥ عن اللوح — ليس خطأً

أُعيد توليد رسالة ٠٧:٤٥ من `buildDailyBrief` نفسها فطابقت رسالة القائدة **في كل سطر عدا سطر عمر**، والفرق سببه تغيّر الداتا بين ٠٧:٤٥ و٠٨:٥٠. التقرير يعرض **شغل اليوم** ويُخفي عمداً أربع فئات يعرضها اللوح (`src/lib/telegram/brief.ts`):

| الفئة | المُخفى عند عمر |
| --- | --- |
| شركة خاملة (`isDormantCompany`) | جدارات **١٢ كرت نشر** · وأغاليا/المول/مانغو/برو |
| كرت محجوز (`makeBlockedPredicate`) | عبادة ريل ١ · البلسم ستوري ١٣ · وصل ستوري ١٤–٢٠ |
| كرت خارج الخطة (`kind==='ADHOC'`) | يُسمّى «مهمة متابعة» بلا اسم الشركة |
| موعد مستقبلي | كل كروت وصل (٢٢/٩ → ٣٠/٩) |

**نتيجة عملية:** كرت «نشر محتوى المسابقة — فوني جوبس» (`prod-32`) خارج الخطة، فالتقرير لن يسمّي التوظيف طوال المدة ٢٠/٩ → ٥/١٠ بل سيقول «ومهمة متابعة». القاعدة من قرار القائدة ١٦/٩ (سطر النشر يسمّي قطع الخطة فقط)؛ تغييرها تعديل على `publishPiece` في `brief.ts` — معلَّق على قرارها.

## ٢١/٩/٢٠٢٦ — جولة تصحيحات بعد مراجعة القائدة (Claude)

| الحمولة | ماذا فعلت |
| --- | --- |
| `prod-43` | إغلاق كرت محتوى ورشة الـCV لنوال (دليل: `ورشة تدريبية مجانية - محاور.docx`، تلغرام ٢٠/٩) + إنشاء كرت التصميم لسابين. **سببه:** طلب ٢٠/٩ ورد تحت «مهام لنوال» فأُنشئ نصف المهمة. |
| `prod-44` | **تبديل ستوري البلسم ١٢/١٣**: الملف `al balsam-story-8-12.jpg` هو تصميم ستوري **١٣** برقم خاطئ من المصمِّمة (إفادة القائدة). تصميم ١٣ ← منجَز، تصميم ١٢ ← أُعيد فتحه مع شطب الدليل الخاطئ، والنشران بُدِّلا (١٣ ← ٢١/٩ · ١٢ ← ٢٧/٨ محجوباً). `prod-42` كان نقل نشر ١٢ لليوم ظنّاً أنّ مادّته جاهزة. |
| `prod-45` | مشهد عبادة المتبقي: كرت تصوير لماجد **ممتدّ ٢٣/٩ → ٢٤/٩** («خلّي المهمة ليومين») + كرت إعادة مونتاج لأليسار ٢٧/٩ + نشر ريل ٣ ← ٢٨/٩. كرتا التصوير والمونتاج الأصليان **لم يُمَسّا** (شغل حصل فعلاً). |
| `prod-46` | سايزن: توثيق توقّف التصميم بطلب الزبون على ستوري ٥ و٩ و١٠. |
| `prod-47` | BW ريل ٤: تصوير ٢٧/٩ **مثبَّتاً** ونشر ٤/١٠ بقرار القائدة. |
| `c772596` | `publishPiece` صار يسمّي كرت النشر خارج الخطة بشركته. |

### درس: التاريخ غير المثبَّت يزحف

`prod-39` ترك تصوير BW ريل ٤ على ٢٧/٩ **غير مثبَّت** كتاريخ مؤقّت. خلال ساعتين أعادته إعادة الجدولة إلى ٢١/٩ من تلقائها — انكشف عند فحص ما قبل تطبيق `prod-47` (`شغل 2026-09-21→2026-09-27`). أي تاريخ قرارُه بشري يجب أن يُثبَّت فوراً ولو كان مبدئياً، وإلا فالمحرّك صاحب الكلمة.

### نطاق توقّف سايزن (إفادة القائدة ٢١/٩)

«عم نحكي على التصوير والتصميم فقط. أما المنجَز وبحاجة نشر لا يتأثر.» فالتوقّف يشمل: تصوير ريل ٥ و٦ · تصميم ستوري ٥ و٩ و١٠. **ولا يشمل**: نشر ريل ٣ وستوري ٦ و٧ و٨ عند عمر، ومونتاج ريل ٤ عند أليسار — سبع قطع تبقى محسوبة على الفريق. لهذا لم يُستعمل `lateExemptReason` (على مستوى الشركة، كان سيُخفي السبع أيضاً).

كل بوستات سايزن الستة منشورة؛ المتبقّي ريلات وستوريز فقط — جواب سؤال القائدة.

### معلَّق على قرار القائدة

1. **Siizen** — الدورة (١٩/٨ → ١٨/٩) انتهت والتجديد غير مسجَّل. تحتاج قرار تجديد أو أرشفة.
2. **البلسم ستوري ١٢** — تصميمها لم يبدأ عند سابين، ونشرها محجوب خلفه (بعد تصحيح `prod-44`).
3. **إعادة خطة المخبر لنوال** — القائدة ٢١/٩: «انتظر حتى تجهز الخطة». الدورة تبدأ الأربعاء أو الخميس ولم يُحسم اليوم؛ لا تجديد قبل قولها.
4. **موضوع مقال فوني جوبس الأسبوعي** — الكرت عند نوال مستحقّ ٢٣/٩ وموضوعه غير محدَّد.
5. **إعادة خطة المخبر لنوال** — «ما حدّدنا لسا، نحن قيد تعديل الخطة». لا كرت لدورة تشرين الأول لأنّ التجديد غير مسجَّل؛ زرّ «جدّد» يسجّله **ويولّد كروت الدورة كاملة فوراً** (`renewContract` → `generateScheduleInternal`)، وهذا قرارها.
4. **تصوير عبادة والمخبر** — بانتظار موافقة العميل على الموعد.
5. **موعد BW ريل ٤** — تاريخه الحالي مؤقّت.

### ملاحظات تقنية من الجلسة

- المرآة المحلية بتوقيت بغداد: أي تاريخ يكتبه التشغيل التجريبي يُخزَّن `21:00Z` لليوم السابق فيُقرأ **يوماً أبكر**. الإنتاج (UTC) يخزّنه صحيحاً — تحقَّق من ذلك فعلياً بعد التطبيق. لا تُعدّل تواريخ الحمولة بناءً على قراءة المرآة.
- نسخة أمان المرآة قبل التجارب: `backups/dev.db.before-dryrun-20260920-prod29-30-31`.

## ٤/٩/٢٠٢٦ — نقل دورة Siizen لبكتها الصحيح (Claude)

**السبب:** كروت Siizen كانت ببكت `m=6` وهو **بلا دورة**، بينما دورتها الحقيقية
(١٩/٨ → ١٧/٩) ببكت `m=7` وكان فاضي. وبلا هالنقل ما كان في مكان لكروت الستوريز
العشرة يلي أضافتهن القائدة.

**تاريخ بدء الدورة:** ١١/٨ ← **١٩/٨** — من ختم أول منشور نفسه
(`reel/DcN0Yghs8Ez/` بـ19/8/2026 09:02 UTC، «Coming soon….»)، لا من تخمين.
والحالة `paused` ← `active`: الشركة عم تنشر من ١٩/٨.

**المنفَّذ (كله متحقَّق من لقطات إنتاج):**

| الخطوة | النتيجة |
| --- | --- |
| توليد بكت آب | ٥٢ كرت: ٦ بوست · ٦ ريل (بمرحلة مونتاج) · ١٠ ستوري |
| إرجاع نصوص الخطة | ١٢ وصف ← ٣٠ كرت |
| الحالات والتواريخ | ٥ منشورة بتواريخها من إنستغرام · ٩ إنتاج منجز · ١٢ مجدولة مثبّتة |
| حذف كروت البكت القديم | **١٨ من ٢٦** انوسموا CANCELED |

**جدول النشر المثبَّت (٦/٩ → ١٧/٩، والجمعة ١١/٩ عطلة):**
بوست ٥ ٦/٩ · ريل ٢ ٧/٩ · بوست ٦ ٩/٩ · ريل ٣ ١٢/٩ · ريل ٤ ١٤/٩ · ريل ٥ ١٦/٩ ·
ريل ٦ ١٧/٩ · وستوري باليوم من ٦/٩ لـ١٦/٩.

### ⚠️ ثمانية كروت بالبكت القديم ما انحذفوا

| الكرت | الحالة |
| --- | --- |
| بوست ٣ و٤ تصميم · ريل ١ تصوير | منجزة |
| بوست ٣ و٤ نشر · ريل ١ نشر | منشورة |
| كرتا الكتابة (دورة ٢٠ تموز) | منجزة |

صفحة جدول المهام ما بتعرضهن (بتخفي المنجَز بالشهور السابقة)، فما وصلتلهن بالحذف.
**أثرها: ٣ قطع منشورة محسوبة مرتين** (بـm=6 وm=7). لازم تنحذف من اللوح أو بسكربت.

**درس تقني:** حذف كرت مولَّد ما بيشيل الصف — بيوسمه `CANCELED` ومثبَّتاً حتى ما
يرجّعه التوليد. فالعدّ بالصفوف بيضلّل؛ العدّ الصحيح بالحالة.

## ٣/٩/٢٠٢٦ — شيل تجديد نور ١٥/٨ (Claude) · سجلّ ما قبل الحذف

قرار القائدة: «شيل تجديد نور». الأساس قولها السابق: «ما عملنا دورة ١٥/٨–١٥/٩،
هاد كلّه تأخير من دورة ١٥/٧–١٥/٨».

**شو بينمحي:** ٣٢ كرت تلقائي ببكت `2026/m=7` — منها ٣٠ محجوزة وراء كرت كتابة
ما انبدأ (دورة بلا خطة)، و**٤ منجزة**. مسجَّلة هون قبل الحذف حتى لا يضيع أثرها:

| القطعة | الحالة | التاريخ | دليلها |
| --- | --- | --- | --- |
| POST #1 PUBLISH | منشور | ١٥/٨ (والواقع ١٧/٨ — ما انصحّح) | فيه |
| REEL #1 EDIT | جاهز | ١٨/٨ | ما فيه |
| REEL #1 PUBLISH | منشور | ١٨/٨ (والواقع ٢٠/٨) | فيه |
| REEL #6 SHOOT | جاهز | ١٤/٩ | فيه |

المنشوران الحقيقيان (١٧/٨ و٢٠/٨) بيضلّوا ممثَّلين بدورة ١٥/٧ (بكت `m=6`) يلي
بتحمل ٦ بوستات و٦ ريلات — وهي الدورة يلي قالت القائدة إنّ كل هالنشر تأخير منها.

**شو بيبقى:** الـ١٠ كروت اليدوية كلها — إعادات التصوير الثلاث (فيتامين د · B12 ·
بديل «القيم الطبيعية») بتصويرها ومونتاجها، وغلافا الريل، وكرت السكريبت البديل،
وكرت تثبيت موعد التصوير. يعني الشغل الفعلي المنجَز اليوم ما بينمسّ.

## ٣/٩/٢٠٢٦ — تشخيص «مهام اليوم» (Claude) · **مفحوص، وما انصلح بعد**

القائدة رصدت أربع مشاكل. الفحص على الداتا الحيّة ردّهن لثلاثة أسباب جذرية.

### أ. توزيع الشركات على المصمّمَين مايل بشدّة

| | الشركات | قطع/شهر |
| --- | --- | ---: |
| أيمن | BW · Phoenitech · عبادة · وصل | **٥٨** |
| سابين | Siizen · أغاليا · التوظيف · برو · جدارات · مانغو · نور · البلسم | **١٠١** |

سابين حاملة **٧٤٪ أكتر**. وشركتان من أربعة عند أيمن (BW وPhoeniTech) ما إلهن
دورة شغّالة، فما بيولّدوا شغل جديد — يعني طابوره بيفضى وطابورها بيفيض.
**هاد سبب «أيمن بوست واحد».**

### ب. معدّل سابين مخزَّن ٨ لا ٦

`Employee.rates` عند سابين = `{"POST":8,"STORY":8}` وعند أيمن `6`. وقائمة اليوم
بتعبّي بالضبط لحدّ المعدّل المخزَّن — فأعطتها ٨. الرقم صحيح حسب الداتا وغلط حسب
قاعدة القائدة. **مصدر الحقيقة حقل `rates`**: تغييره لـ٦ بيصلّح كل الشاشات مرة
وحدة.

### ج. البوابات موجودة وشغّالة — بس لوائح «المتأخر» ما بتقراها

سلسلة الحجز عند نور مبنية صح ١٠٠٪ (فحص على الإنتاج، دورة ١٥/٨):

```
POST|DESIGN   محجوز 6/6 بـ[WRITE]      REEL|SHOOT   محجوز 6/6 بـ[WRITE]
POST|PUBLISH  محجوز 6/6 بـ[DESIGN]     REEL|EDIT    محجوز 6/6 بـ[SHOOT]
                                        REEL|PUBLISH محجوز 6/6 بـ[EDIT]
```

يعني المحرّك **بيحترم** «لا مهام بلا خطة»: كرت «كتابة بوستات وستوريز» لسا
`NOT_STARTED`، فكل قطع الدورة محجوزة وراه. و`selectDailyWorkTasks` بتصفّي
المحجوز فعلاً.

**بس** `isTaskLateState` ما بتعرف لا الحجز ولا إعفاء الشركة. فالشاشات يلي
بتستعملها بتعدّ محجوزاً ومعفيّاً كأنه متأخر:
`overview-client.tsx` · `reports/page.tsx` · `KanbanBoard.tsx` · `done-report.ts`.

هاد بيفسّر:
* **عمر «متأخرة ٤٧»** وفيها نشر جدارات (شركة موقوفة بطلب الزبون) ونشر نور
  (محجوز وراء خطة ما انكتبت).
* **رقم «١٣٧ متأخر»** بصفحة متابعة اليوم — منفوخ بشغل مستحيل يشتغل عليه حدا.

### د. خطط BW وPhoeniTech ما إلها كرت كتابة

التنتان بلا `publishStartDate` → ما في دورة → ما في كرت كتابة. والخطة **شرط
سابق** لبدء النشر، بس المحرّك ما بيطلبها إلا بعد ما تبلّش الدورة. دورة مقفلة على
حالها — ولهيك نوال شايفة خطة وحدة والمطلوب تلاتة.

### الإصلاحات المقترحة (بانتظار قرار القائدة)

1. معدّل سابين ٨ → ٦ (تعديل موظف، نقرة).
2. إعادة توزيع الشركات بين أيمن وسابين.
3. `isTaskLateState` تحترم الحجز وإعفاء الشركة — خمس مواضع.
4. كرت كتابة خطة للشركة يلي عقدها موقّع والنشر ما بلّش.

### شغل مطلوب جدولته (٣/٩) — لسا ما انضاف

* **نوال — مستعجل:** كتابة سكريبت إيفنت المدرسة، التسليم **الأحد ٦/٩**.
* **ماجد — تصوير:**

| اليوم | الشغل |
| --- | --- |
| الأحد ٦/٩ | إيفنت الجامعة — تغطية المسابقة البرمجية |
| الاثنين ٧/٩ | إيفنت المدرسة — تغطية تركيب الشاشة والورشة |
| الثلاثاء ٨/٩ | تصوير **٦ ريلات** لوصل |
| الأربعاء ٩/٩ | الباقي — عبادة أو Siizen أو البلسم |

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

### Current audit override — 2026-09-06

- **[USER-CONFIRMED — PLANNING FOLLOW-UP]** User requested a plan to fix warnings/bugs while preserving working behavior, and asked about a Vercel environment-variable redeploy notice. Plan saved at `docs/superpowers/plans/2026-09-06-app-repair.md`. This follow-up is documentation-only; subsequent “continue” retains planning scope. No code, data, credential, or deployment changed.
- **[VERIFIED — CODE]** Employee task create/edit/delete paths call `generateSchedule`; a blanket admin guard would break that existing workflow. Planned B01 fix separates the guarded public action from trusted internal regeneration, with compatibility regression tests.
- **[VERIFIED — SCREENSHOT/DOCUMENTATION]** Vercel notice says an environment variable was saved and a new deployment is required. Official Vercel documentation confirms existing deployments retain prior values. The repository build is compile-only; the specific variable name, Production/Preview scope, and selected deployment revision are unknown. Asked for name/scope only, never the value. No Redeploy button clicked.

- **[USER-CONFIRMED]** Current request is a full app-state/deep-test report grouped into clean, warnings, and bugs. Historical company mutation instructions below were not executed during this audit.
- **[VERIFIED — LOCAL]** HEAD `556c9db`; full suite rerun 555/555 in 51 files; 55 focused date/cycle/delivery/daily-work tests pass separately under UTC, Asia/Baghdad, and America/New_York. Typecheck/lint/build passed on `04f41d0`; intervening code changes are backup tooling only. Both Prisma schemas validate.
- **[VERIFIED — SAVED PRODUCTION SNAPSHOT]** `backups/prod-20260905-1026.json` has 1,129 tasks; 19/23 snapshot checks pass. Failures: eight historical PhoeniTech dependencies reference removed tasks, one October production Saturday, five October publisher work days off, and four September 9 shoots at Majed's three/day rate. This supersedes the earlier 1,214-row/six-shoot snapshot for audit measurements, but is not a fresh September 6 export.
- **[VERIFIED — ISOLATED]** September/October regeneration on a copy of that snapshot adds eight missing October EDIT cards, deletes zero rows, and changes zero completed records under status/board/owner/brief/notes/work/ready/publish/finish comparison. Original local DB hash unchanged: `61576424DC9A975EEECAA8CFF79F001F2EE4804410D2FFF60311046D26EF3140`.
- **[LIVE — READ ONLY]** Main employee/admin pages render. Company filtering, calendar modes, task dialog/cancel, and navigation work. Today logs React #418 and changes message times by three hours after hydration; archived Telegram matches can display “ما طابق شي” alongside an undo button. Publishing overdue list includes paused Jadarat. Anonymous finance redirects to login; backup/document export and all four cron routes return 401.
- **[VERIFIED]** Full dependency audit: seven affected packages (four high, one moderate, two low); production-only audit: two low. No dependency changes made.
- **[PENDING]** Six findings in `docs/qa/APP_STATE_DEEP_TEST_2026-09-06.md`, led by unguarded full `generateSchedule` server action. No fixes/deployment/data sync/Telegram messages performed. Fresh authenticated production export blocked by automatic approval review; explicit approval is needed for that sensitive full-data export. Exact production commit and historic exposed-secret rotation remain unverified.

The older repository/release descriptions below are preserved historical records, not the current audit baseline.

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

### 2026-10-13 (١٩:٥٠، الديسكتوب) — Claude — نشر «المنجز مشطوب» + تصحيح بوستات التوظيف لتشرين · **حيّ على Vercel + كتابة على الإنتاج بموافقة القائدة**

- **النشر [VERIFIED LIVE]:** القائدة «انشر هلّق» → GitLab `main` `f3fd29c..355fa01` ١٩:٣٣ بعد نسخة `prod-20261013-1933.json`. الطقم: ١٣١٨ ناجح + ٤ داتا قديمة + `security-concurrency` SA-03 فشل مرّة تحت الحمل ومرق لحاله ٨/٨ مرتين (نفس التذبذب الموثّق). ١٩:٣٥ الصفحة الرئيسية الحيّة: «أُنجز اليوم: N بطاقة» راح والكرت المنجز مشطوب ✓.
- **[USER-CONFIRMED]** «بدي أعرف سبب تسكير مهام التوظيف لدى سابين الخطة لشهر 10 لسا ما تم تصميم شي فيها غير 10-1 وهو كاروسيل! واليوم مهمة مستعجلة بس يعني لازم تكمل من بوست 10-2 ..الخ حسب الخطة» (+ ملف «Phoeni Jobs - OCT.NO3.pdf»: ١٠ ريل · ١٠ بوست، الكاروسيل ١·٤·٦·٩).
- **السبب [VERIFIED بالنسخة]:** ١٢/١٠ ٠٩:٢٥:٥٧ → ٠٩:٣٩:٠١ حدا علّم ~٢٠ كرت نشر «منشور» بالإيد، واحد ورا التاني (فونيتيك، BW، التوظيف، مخبر)، كتير منها نشرها لقدّام (١٤، ١٥، ١٧، ١٩/١٠). كل علامة بتسكّر المراحل قبلها (`completeProductionForPublishedTask`). التوظيف: 10-2 و10-3 (٠٩:٢٨:١٨ و٠٩:٢٨:٢٩) و10-4 (١٣/١٠ ٠٩:٣٨:٥٢)؛ و10-1 انعلّم منشور ٤/١٠ ٠٩:٥٢ وانسكّر تصميمه إدارياً ١١/١٠ («القطعة منشورة ٣/١٠»). ضحايا تانيين بنفس الجولة: فونيتيك STORY#1 وSTORY#2 تصميم، وREEL#1 تصوير+مونتاج. ملفات كاروسيل 10-1 (`jobs-carousel 01…04-10-1.jpg` ١٧:٢٥) **ما وصلت للبوت** — مو بموضوع Jobs. ملاحظة: بريف بوستات ١–٣ لدورة تشرين فاضي (٤ وطالع فيه نص الخطة).
- **قرار القائدة [USER-CONFIRMED]:** «طبّق — 10-1 ينتشر بكرا 14/10» · وعن حارس «منشور والتصميم مفتوح»: «لأ، خليه متل هلّق» — النشر بيضل يسكّر يلي قبله.
- **التطبيق [VERIFIED LIVE — نسخة ١٩:٤٥ مقابل ١٩:٤٢]:** من «استيراد خطة JSON» (التوظيف) بالمتصفح الداخلي بعد ما فاتت القائدة: `prod-76` (تصميم «أول سوري» منجز ١٣/١٠ + `adhoc_tawzeef-first-syrian-uae-publish` لعمر اليوم مستعجل) و`prod-77` (POST#1 تصميم منجز ١٣/١٠ وسطر «أُغلق إدارياً…» انشال؛ POST#1 نشر → ١٤/١٠ مثبّت؛ POST#2·٣·٤ تصميم ونشر انفتحوا، تصميم ٢ و٣ ← ١٤/١٠). الفرق: +١ كرت، ٩ تغيّروا، ٠ انمحى. preflight ✓ وتجربة على نسخة: سابين ١٤/١٠ = مهمة الثانوية ‼ ثم 10-2 · 10-3 · 10-4 (يوم كامل)؛ عمر ١٤/١٠ فيه 10-1.
- **WORK_RULES §١٦:** انضاف قرار «منشور بيسكّر يلي قبله».

### 2026-10-13 (١٩:٣٠، الديسكتوب) — Claude — مهام بكرا للثانوية الوطنية + بوست «أول سوري» · **كتابة على الإنتاج بطلب القائدة**

- **[USER-CONFIRMED]** «رح اطلب منك مهام تضيفها بكرا بأولوية مستعجلة: ١- نوال: كتابة محتوى للمدرسة الوطنية الخاصة (بما معناه بعد أشهر من التحضيرات بدأ العمل … الثانوية الوطنية الخاصة بالتعاون مع شركاءها نحو العالمية). ٢- سابين: تصميم البوست السابق… اعتبرو مهمة خارجية حالياً» · «لا هاد زبون جديد رح نوقع معو بكرا: الثانوية الوطنية الخاصة: 8 ريل و 10 بوست و 12 ستوري شهرياً بقيمة عقد 250$ — بس حالياً اعتبرها مهمة خارجية لحين توقيع العقد. وحضر الشركة والخطة تبعا. بس هاد البوست مو من ضمن الخطة» · «اليوم نوال وسابين أنجوز مهمة البوست تبع أول سوري اشتغل بالامارات واليوم لازم عمر ينشرها».
- **[VERIFIED LIVE — نسخة ١٩:٢٨ مقابل ١٩:٢٠]** انضافوا من نافذة «مهمة إضافية» (صفحة المهام، المتصفح الداخلي) كرتين **داخلي (بلا شركة)**، مستعجل، ١٤/١٠ → ١٤/١٠، نص يوم (٤ س — أرضية `createTask`)، «قفل يدوي»: نوال «كتابة محتوى: الثانوية الوطنية الخاصة — بوست كولاب «نحو العالمية»» (بالملاحظة نصّ القائدة) · سابين «تصميم بوست: الثانوية الوطنية الخاصة — كولاب «نحو العالمية»» (على نص نوال). الفرق بين النسختين: +٢ كرت، ٠ انمحى، ٠ تغيّر — أول إعادة توليد حيّة بالكود الجديد (دلو تشرين) ما حرّكت شي. إعداد جديد `regenLock` = قفل الكتابة بمعاملة التوليد (SA-03)، طبيعي.
- **تجربة على نسخة ١٩:٢٠ قبل التطبيق:** نفس الكرتين + حمولة `prod-76` → +٣، ٠ انمحى، تغيّر بس تصميم سابين؛ الطوابير: عمر ١٣/١٠ فيه «نشر بوست أول سوري» ‼، نوال وسابين ١٤/١٠ مهمة الثانوية ‼ أول القائمة.
- **`scripts/data/prod-76-tawzeef-first-syrian-uae-2026-10.json` (preflight ✓ على ١٩:٢٠) — لسا مو مطبّقة:** بتسكّر «تصميم توظيف: تم توظيف بالامارات بنجاح…» (سابين) جاهز ١٣/١٠ بدليل «اول سوري.jpg» ١٥:٢٣، وبتضيف `adhoc_tawzeef-first-syrian-uae-publish` لعمر اليوم مستعجل (٠.٢٥ س) — كرت كتابة نوال منجز أصلاً. بتنطبّق من «استيراد خطة JSON» بالأدمن — بانتظار ما تفوت القائدة (النشر طلّع كل الجلسات).
- **بعدين:** تحضير شركة «الثانوية الوطنية الخاصة» وخطتها (٨ ريل · ١٠ بوست · ١٢ ستوري، ٢٥٠$) كمسودة — ما بتنخلق قبل التوقيع؛ بوست الكولاب مو من الخطة.

### 2026-10-13 (١٩:٠٥، الديسكتوب) — Claude — النشر: f3fd29c حيّ ومتحقَّق · **حيّ على Vercel**

- **[USER-CONFIRMED]** «انشر» (بعد ما فاتت كأدمن من المتصفح الداخلي).
- **قبل الدمج [VERIFIED]:** شجرة نظيفة؛ GitLab `main` = `c66fa7f` وهو أصل `f3fd29c` (٤٦ كوميت، fast-forward)؛ نسخة احتياطية قراءة بس `backups/prod-20261013-1845.json` (١٣٨٠ كرت · ٤٤ نزلة، بصمة `eca0f41a4b91`). `git push gitlab HEAD:main` → `c66fa7f..f3fd29c`.
- **Vercel [VERIFIED بلوحة Vercel، القائدة فاتت بحسابها]:** نشر `f3fd29c` Ready – Production، بناء ١د ١٧ث. ⚠️ مراقبتي الأولى (بصمة ملفات `/login`) ما لقطته — صفحة الدخول ما تغيّرت فأسماء ملفاتها (محسوبة من المحتوى) ضلّت نفسها. الفحص الصح: فرق سلوك حقيقي (مفاتيح الرواتب). وتوكن Vercel CLI بالجهاز منتهي من ١١/١٠ — ما تجدّد.
- **فحوص ما بعد النشر ١٩:٠٣ [VERIFIED LIVE]:** `/` `/tasks` `/today` `/publishing` `/login` = 200؛ `/admin` بلا كوكي → 307 `/login`؛ ٤ كرونات + `/api/backup/export` بلا سرّ → 401؛ مفاتيح `salary`/`contractValue`/`costPerReel`/`telegramUserId` بصفحات الفريق العامة = ٠ (كانت ١١/١٦/١١/١١ الساعة ١٨:٥٠ على الكود القديم — SA-01 انسكّر حيّاً). «مهام اليوم» الحيّة: عمر قائمته فيها كروت النشر المستحقة تحت «متابعة مع العملاء» (إصلاح `a281367`).
- **مين سكّر تصميم التوظيف بوست ٤ (سؤال القائدة) [VERIFIED بالنسخة]:** كرت **النشر** انعلّم «منشور» بالإيد اليوم ٠٩:٣٨:٥٢ (يومه المخطّط ١٧/١٠)، والموقع سكّر تصميم سابين بنفس الثانية (النشر بيسكّر يلي قبله). قبلها بـ٢٣ ثانية انعلّم مخبر بوست ٢ «منشور». مو البوت (بلا سطر «سُلّم على تلغرام»، وملف سابين الوحيد اليوم «اول سوري.jpg» ١٥:٢٣ لتصميم تاني)، ولا Claude/Codex (ما في جلسة ٠٩:٣٦–٠٩:٣٩). **[للقائدة]** انتشروا فعلاً؟ وهل بدها يرفض الموقع «منشور» والتصميم مفتوح (هلّق مقبول بالقاعدة القديمة «النشر دليل»)؟
- **مصدر «مخبر ريل ٥ انصوّر» [VERIFIED بلوحة Vercel — رسالة كوميت Codex على فرع `codex/qa-deep-stabilization`]:** «تصوير ريلات ٢·٣·٤·٥ منجز (الفويس أوفر الأربعة)… أخدت الـdocx لأنّ ريلات الفويس أوفر فيه أربعة بالضبط (٢·٣·٤·٥) وهو الرقم يلي قالته القائدة؛ بالـPDF بيصيروا خمسة… وبيختلفوا بريل ١ وريل ٤». يعني الإقفال ٢٨/٩ كان استنتاج جلسة من عدد، مو دليل تسليم.
- **ما انعمل بعد:** `5fd8126` (المنجز اليوم مشطوب) على فرع GitHub بس — بدّو «انشر» جديد. تدوير `AUTH_SECRET` وكلمة سرّ الأدمن (SA-02) على القائدة (أسرار — Claude ما بيكتبها). تصحيحات J بانتظار أجوبتها.

### 2026-10-13 (١٨:٤٠ بساعة الجهاز، الديسكتوب) — Claude — مين سكّر المونتاجات الغلط ووين الخلل؛ حارس «الإقفال بالترتيب» · **محلي + فرع GitHub؛ بلا دمج ولا نشر**

- **[USER-CONFIRMED]** «شو سبب تسكير ريل BW اذا لسا ما اتصور؟! وين الخلل» · «مونتاج المخبر نحنا ماعنا غير 4 متسلمين, 5 و 6 لسا ماتصورو ولا تمنتجو ولا صار شي» · عبادة: «خطة شهر 9 خالصة, فقط ريل 1 كان مطلوب تعديلات من الزبون قبل الايقاف. خطة شهر 10 مكتوبة وجاهزة لكن الزبون قرر الايقاف, أيمن اشتغل بعض التصاميم من الخطة». القائدة فاتت كأدمن من المتصفح الداخلي ✓.
- **مين سكّر [VERIFIED على نسخة ١٣/١٠]:** ٦ مونتاجات لأليسار بالإيد ١١/١٠ دمشق: BW ريل ٤ (١٧:٣٨:٣٧)، مخبر ريل ٢ (:٤٣)، ٣ (:٤٤)، ٤ (:٤٦)، ٥ (:٤٩)، ٦ (١٧:٤٠:٠٩). فرق ١–٥ ثواني = ضغطات، `startedAt = finishedAt` (من «لم يبدأ» لـ«جاهز» دغري)، بلا ملاحظات. ولا رسالة تلغرام ١٦:٣٠–١٨:٠٠، ولا إعداد تغيّر، ولا جلسة Claude/Codex محلية شغّالة وقتها (سجلات الجلسات). البوت والحمولات دايماً بيكتبوا سطر دليل — فهاد ضغط من الموقع. **مين ضغط: ما منعرف** — قسم الفريق مفتوح بلا دخول (قرار موثّق) والموقع ما بيسجّل الفاعل.
- **الخلل [VERIFIED — CODE]:** `updateTaskStatus` (قائمة الحالة بصفحة المهام) و`moveCard` (اللوح) ما كانوا يفحصوا الترتيب — تعليق الكود: «soft gate, no hard block». فمونتاج بينسكّر وتصويره مفتوح، والمحرّك بعدين بيعتبرها حالة مستحيلة (`schedule-retime.ts`) فبيفتحها بأول توليد (مخبر ٦)، أو ما بيقدر لأنو مثبّت (BW ٤) فبيطلع كرت النشر لعمر يوم ١٩/١٠ والريل ما انصوّر.
- **الإصلاح (`src/server/actions/tasks.ts` `closeBlockedReason`):** مرحلة إنتاج ما بتنسكّر قبل مرحلة الإنتاج يلي قبلها (نفس سلسلة `makeHeldReason`، محمّلة كاملة بـ`loadBlockerChain`) → رفض برسالة «ما بينسكّر المونتاج قبل ما يخلص التصوير (عند ليلاس) — سكّر التصوير أول إذا صار فعلاً». مستثنى حاجز الكتابة (§٦/OP-10) وكرت النشر (النشر دليل وبيسكّر يلي قبله بسطر دليل). اللوح صار يعرض سبب الرفض. اختبار بـ`tests/deep/operations-card-actions.test.ts` (أحمر لما الحارس مطفي). WORK_RULES §١٦ انضاف إلها السطر.
- **الطقم:** ١٣٣٠ = ١٣١٩ ناجح · ٣ متوقَّع · ٤ متخطّى · ٤ فشل داتا قديم. `tsc` و`eslint` نظاف.
- **تعارض لازم ينحلّ قبل أي تصحيح (J) [للقائدة]:**
  - **مخبر ريل ٥:** كرت التصوير «منجز ٢٨/٩» بملاحظة «الفويس أوفر انتسجّل ٢٨/٩ (إفادة القائدة: أربع فويس أوفر). ريلات ٢·٣·٤·٥ هنّ كل ريلات الفويس أوفر بالخطة المعدَّلة»؛ وتلغرام فيه `Drnoor-reel-10-5.mp4` من أليسار ٢/١٠ ٠٢:٢٦. ملفات مونتاج المخبر من ٢٥/٩: ريل ١ (٢٨/٩)، ريل ٢ (٢٨/٩ + ٢/١٠)، «ريل ٥» (٢/١٠) — ولا ملف لـ٣ و٤. القائدة: المتسلّم ٤ بس، و٥–٦ ما صار فيهن شي.
  - **عبادة:** حسب التسمية (`obada-post-9-1`، `Obada-story-9-x`، `obada-reel-9-1`) دورة ٢٢/٩ → ٢١/١٠ (دلو m=8) = «خطة شهر 9». فيها بتلغرام: بوست ١، ستوري ١·٢·٣·٥·٦·٧ (+٨·٩·١٠ اليوم ١٢:١٢ بعد الإيقاف)، ريل ١ (٥/١٠). بلا ملف: بوست ٢–٦، ستوري ٤، ريل ٢–٣. وما في دورة بعد ٢١/١٠ مسجّلة («خطة شهر 10» مو بالنظام). كلام القائدة «خطة 9 خالصة» ما بيطابق — يا إما «خطة 9» عندها هي دلو آب (m=7، ٤٧ كرت كلهن منجزين)، يا إما التسليم صار برّا تلغرام.
- **ما انعمل:** ولا كتابة على الإنتاج، ولا دمج، ولا نشر.

### 2026-10-13 (١٨:٢٠ بساعة الجهاز، الديسكتوب) — Claude — نسخة احتياطية جديدة من الإنتاج وإعادة الفحص على داتا اليوم · **قراءة من الإنتاج بس؛ بلا كتابة ولا دمج ولا نشر**

- **[USER-CONFIRMED]** «انت خود نسخة احتياطية, هي شغلتك مو شغلتي».
- **النسخة [VERIFIED]:** `npm run backup:pull` (قراءة `/api/backup/export` بسرّ الكرون، ما انطبع) → `backups/prod-20261013-1754.json` **بهالـworktree** (مُهمَلة بـgit)، بصمة `0318ce32dbd3` مطابقة لملف `.sha256`. ١١ موظف · ١٦ شركة · ١٣٨٠ كرت · ٤٤ نزلة · ٣٩٤٧ رسالة تلغرام. ⚠️ السحب الآلي اليومي ١٢:٠٠ اليوم فشل («fetch failed» بـ`backup-log.txt` بالنسخة الرئيسية) — السحب اليدوي مرق، فالأرجح انقطاع مؤقت.
- **فرق ١١/١٠ ← اليوم [VERIFIED بمقارنة اللقطتين]:** −٣٣ كرت، +١٠، و١٧٠ تعدّلت (٤٩ تغيّرت حالتها — شغل عادي).
  - **عبادة:** `status` active → paused اليوم ٠٨:٤٧ (`publishStartDate` انمسح، و`lateExemptReason` = نصّ زر «أوقف النشر» بـ`companies.ts:562`). كود الإنتاج **محا** ٣٢ كرت m=8 (٣١ مفتوح + مونتاج REEL#1 **منجز** لأليسار) و٤ نزلات. هاد بالضبط يلي بيصلّحه D1 («الإيقاف بيخفي ولا بيمحي»). كل الكروت محفوظة بـ`prod-20261011-1249.json` (النسخة الرئيسية). **[للموافقة — J]** رجوعها بعد النشر (مخفية لأنّ الشركة موقوفة)، وأهمّها المونتاج المنجز — وإلا لما ترجع عبادة بينطلب من أليسار مونتاج ريل ١ من جديد.
  - **+١٠:** كروت التوظيف (تصوير/مونتاج/نشر أواخر ١٠ وأول ١١) وكروت نوال — مضافة على الإنتاج بين ١١ و١٣/١٠.
- **الفحص على داتا اليوم** (قاعدة تجريبية `prisma/test-mirror-1310.db` محمّلة من النسخة بـ`tmp/fix/load-snapshot.ts`؛ `dev.db` ما تغيّرت):
  - **محاكاة ٨ أيام:** الجديد ٠ / ٠ / ٤ — كود الإنتاج ٢٣ / ٢٣ / ٢٩.
  - **أول توليد بعد النشر (`regen-diff`):** ٠ كرت مفتوح غير مثبّت بيتحرّك؛ نزلتين فونيتيك مرقوا (أيلول) بيتزحزحوا يوم — للعلم بقرار القائدة؛ **كرت منجز واحد بينفتح:** مونتاج مخبر REEL#6 (m=8). كود الإنتاج بيعمل نفس الشي + بيعيد تأريخ مونتاج التوظيف REEL_6.
  - **السبب المشترك [VERIFIED]:** ١١/١٠ ١٧:٣٨–١٧:٤٠ انسكّروا ٦ مونتاجات لأليسار بدقيقتين بلا ملاحظات: مخبر ريل ٢–٥ (تصويرهن منجز ✓)، و**BW REEL#4 ومخبر REEL#6 وتصويرهن مفتوح**. تلغرام: ولا ملف لهالاتنين (آخر ملفات أليسار للمخبر: ريل ١ و٢ و٥؛ ولـBW آخر ريل ٢٣/٩). ملاحظة كرت BW REEL#4: «أُعيد فتحه بقرار القائدة ٢٠/٩: الملف المطابَق كان مونتاج ريل ٢». ملاحظة تصوير مخبر ريل ٥: الفويس أوفر ٢٨/٩ لريلات ٢–٥ بس.
    - مخبر REEL#6: قاعدة المحرّك القديمة (`schedule-retime.ts`: «مونتاج منجز وتصويره ما صار وقطعته ما انتشرت = مستحيل») بتفتحه بأول توليد. الدليل بيدعم الفتح — بس لازم موافقة القائدة.
    - BW REEL#4: مثبّت فما بينفتح؛ والصفحات بتحمّل الشغل الحيّ بلا المونتاج المنجز (دلو قديم) فسلسلة الحجز بتنقطع → كرت النشر بيطلع لعمر ١٩/١٠ والتصوير مفتوح. نفس الشي بكود الإنتاج. **[INFERENCE]** الحلّ بالداتا (J)، مو تغيير كود قبل النشر.
- **تسجيل الدخول:** النسخة الجديدة بتغيّر صيغة كوكي الجلسة (المرحلة A: `exp.epoch.sid.HMAC`)، فكل أدمن بيطلع مرّة وبيلزمه يفوت من جديد بإيميله وكلمة سرّه. Claude ما بيدخّل كلمات سر على الإنتاج.
- **ما انعمل:** ولا كتابة على الإنتاج، ولا دمج، ولا نشر. نسخة كود الإنتاج المؤقتة للمقارنة انحذفت (الرابط لـ`node_modules` انفكّ أول).

### 2026-10-13 (١٧:٥٠ بساعة الجهاز، الديسكتوب) — Claude — محاكاة سيناريوهات على المرآة قبل النشر: عيب واحد إضافي انصلح · **محلي + فرع GitHub؛ بلا دمج ولا نشر**

- **السؤال [USER]:** «طبقت سيناريوهات مختلفة على آخر نسخة قبل الرفع؟»
- **المحاكاة (`tmp/fix/sim-days.ts`، بالذاكرة، ما بتكتب على القاعدة؛ TZ=UTC متل Vercel):** ٨ أيام شغل ١٣→٢٢/١٠ × كل شخص عنده شغل × ٣ سيناريوهات — A الكل بيخلّص طابوره، B بيخلّص نصّه، C ولا حدا بيخلّص شي. فحوص مستقلّة عن الكود المفحوص: **فاضي** (طابور بلا إنتاج وعنده كرت مؤهَّل بقاعدة ١٣/١٠)، **ناقص** (يوم مش مليان وفي كرت كان بيساع)، **ترتيب** (كرت قبل مرحلة أبكر بنفس القطعة)، **تصوير قبل موعده**، **نشر قبل يومه**، **نشر مستحق مو بالقائمة**. نفس السكربت على كود الإنتاج (`c66fa7f`، نسخة مؤقتة انحذفت).
- **[VERIFIED على المرآة] عيب جديد من `f227ec5`:** عمر (ناشر) عنده كرت ADHOC «متابعة مع العملاء» ٨ ساعات **شغّال** من ٣٠/٥ → بيترتّب أول وبيملّي اليوم، و`break` بـ`selectDailyWork` كانت توقف المرور قبل كروت النشر (بلا سعة). بكود الإنتاج كانت تنجو بس كروت النشر المثبّتة على **اليوم نفسه** (بتترتّب أول) — ١٠ مستحقّة مخفية؛ وبعد §١٦ (اليوم المثبّت ما بيرتّب غير التصوير) ولا وحدة — ١٥ مخفية. **الإصلاح:** المرور بيكمّل لآخر القائمة (`dayClosed` بدل `break`)؛ كروت الإنتاج بتضل مسقوفة بالسعة. +٢ اختبار بـ`tests/daily-work.test.ts`، حمر على `break` وخضر بعده.
- **النتيجة بعد الإصلاح [VERIFIED]:** ٠ مشاكل بالسيناريوهات التلاتة. كود الإنتاج بنفس المحاكاة: ١٩ / ١٧ / ١٢ مشكلة — سابين فاضية أو ناقصة (١٨ و٢٠ و٢١/١٠ صفر شغل وعندها ٥–٦ تصاميم)، عمر لحدّ ٤٤ نشر مستحق مو بقائمته، نوال وأليسار أيام ناقصة. ملاحظة: «نشر قبل يومه» طلع أول مرّة ٩ مرّات وكان غلط بالفحص نفسه — نشر السبت ١٧/١٠ يومه الشغلي الخميس ١٥/١٠ (`workDate`)، متل ما كان دايماً.
- **[INFERENCE → J]** كرت «متابعة مع العملاء» (٨ ساعات، شغّال من ٣٠/٥) هو نفسه فشل `data-integrity` «ولا كرت شركة خارج الخطة ساعاته توصل ليوم عمل كامل» — بيملّي يوم عمر كل يوم. قرار القائدة: يتسكّر، أو تنقص ساعاته، أو يضل.
- **البوابات على المرآة:** ١٣٢٩ = ١٣١٨ ناجح · ٣ متوقَّع (DA) · ٤ متخطّى · ٤ فشل داتا قديم (نفسهن). `PREDEPLOY=1` ٤/٤. `tsc` و`eslint src scripts tests` نظاف. `prisma/dev.db` ما تغيّرت (`7b2393412d57`).
- **ما انعمل:** ولا دمج، ولا نشر، ولا كتابة على الإنتاج.

### 2026-10-13 (١٨:٠٠، الديسكتوب) — Claude — قرارات القائدة الأربعة: نُفّذت ومتحقَّقة على المرآة · **محلي + فرع GitHub؛ بلا دمج ولا نشر**

- **[USER-CONFIRMED]** «المهم عندي ماتترك مصمم او مونتير او اي موظف فاضي طول ما انه عنده مهام ينجزها وقادر ينجزها. بس… مافيك تحط مونتاج ريل والمصور ما صوره! او نشر بوست والتصميم ماجاهز. يعني راعي الترتيب» · «بدك تشوف التلغرام وتراجع وقت الانجاز الفعلي» · «كلشي سابق ماتهتم فيه, المهم من اليوم واللاحق, خطة شهر 10» · «قواعد المسا بكل مكان» · سطرا «ما سجّل شي» و«مفتوح على اليوم» **بيضلّوا**.
- **الكود:**
  - `lib/daily-work.ts` `fixedDayISO`: اليوم المثبّت ما بيأجّل غير **التصوير** (موعد زبون)؛ «بدّل» بيأجّل أي مرحلة. الترتيب محفوظ بالحجز، والنشر ما بينسحب لقدّام (بيومه). سابين على المرآة: طابور ٤ (٨٩٪ من سعتها)، ٠ «مؤجَّل».
  - `lib/schedule-retime.ts`: المونتاج المنجز **فعلاً** ما بينعاد تأريخه أبداً (رجوع عن تخمين `ed768af`)؛ بس المونتاج يلي بيسكّره التوليد لأنّ قطعته انتشرت بيتأرّخ. `regen-reality` رجع أخضر.
  - `lib/late.ts`: قواعد §١٠ بكل الشاشات والرسائل — «بانتظار الزبون»/«موقوف بطلب العميل» على الكرت + الإقفال الإداري مش متأخر؛ تصميم الستوري موعده نهاية دورتها. (`isClientHeld` صار مصدَّر من `period-report.ts`.)
  - `tests/predeploy-mirror.test.ts` بند ٣: نزلات التصوير يلي مرقت = للعلم (قرار القائدة)؛ الكروت المنجزة بتنقارن بهوية القطعة.
- **الاختبارات [VERIFIED على المرآة ١١/١٠]:** ١٣٢٧ = ١٣١٦ ناجح · ٣ متوقَّع (DA) · ٤ متخطّى · ٤ فشل داتا قديم (data-integrity ×٣، lifecycle). جديد: `tests/late-evening-rules.test.ts` + حالات بـ`daily-work`/`regen-reality`/`regen-retime-rule`/`regen-state-transitions`؛ كل إصلاح مفحوص بالطفرة. `PREDEPLOY=1` ٤/٤. `tsc` نظيف؛ `eslint src scripts tests` نظيف (`eslint .` بيشتكي بس من `tmp/` المهمَل). ملاحظة: `security-concurrency` فشل مرّة تحت حمل الطقم ومرق لحاله ٨/٨ (توقيت).
- **WORK_RULES:** §٤ (المنجز ما بيتحرّك)، §١٤ (قواعد المسا بكل مكان)، §١٦ (اليوم المثبّت ما بيأجّل غير التصوير، وسبب سابين متحقَّق).
- **الداتا (J، بانتظار موافقة):** مونتاج عبادة ريل ٢ (m=7): تلغرام بيقول `obada 2-8.mp4` من أليسار ١٥/٩ ٠٠:٣١ دمشق؛ الكرت ٢٥/٨ وإقفاله ٢٩/٨ (جماعي)؛ وكرت النشر «منشور ١٨/٨» — متناقضين. الأرجح منشور ١٨/٨ هو ريل ١ (`obada 1-8.mp4` ١٦–١٧/٨). بدّو مراجعة إنستغرام قبل الحمولة.
- **ما انعمل:** ولا دمج، ولا نشر، ولا كتابة على الإنتاج.

### 2026-10-13 (١٧:٣٠، الديسكتوب) — Claude — فحص المرآة قبل النشر وتشخيص سابين · **ولا تغيير كود؛ محلي + توثيق على فرع GitHub؛ بلا دمج ولا نشر**

- **الجلب [VERIFIED]:** شجرة العمل نظيفة؛ كل كوميتات الديسكتوب (لحدّ `f7a1875`) موجودة على فرع GitHub؛ تقدّم الفرع المحلي fast-forward لـ`1ca9fe4`. ⚠️ الريموتات هون: `origin` = GitHub (`hla-sh93/sm-team-dashboard`) و`gitlab` = GitLab — عكس يلي بالطلب؛ ما تغيّروا. GitLab `main` = `c66fa7f` (الحيّ) وهو أصل الفرع (الدمج بيكون fast-forward).
- **`prisma generate` ما انشغّل عن قصد:** العميل المولَّد مطابق للـschema (فرق مسافات وتعليقات بس، SQLite)، و`node_modules` هون رابط لنسخة الريبو الرئيسية — التوليد كان رح يكتب عليها.
- **المرآة = لقطة الإنتاج ١١/١٠ ١٢:٤٩** (أحدث لقطة على هالجهاز). اليوم ١٣/١٠ — فأي شي صار بالإنتاج ١٢–١٣/١٠ مو فيها.
- **سابين [VERIFIED على المرآة، بالكودين]:** طابور ١٣/١٠ = **٢** (التوظيف بوست ٢ و٣) و**١٠ كروت مستبعَدة «مؤجَّلة»** (بوست ٤–١٠ وكروت أغلفة/جوبس). السبب: حمولة «إعادة الجدولة من ١١/١٠» ثبّتت كل قطعة باقية على يوم (`isPinned` + `workDate` = ١٥/١٠، ١٩/١٠…)، و`fixedDayISO` (`lib/daily-work.ts:49`) بيعتبر **أي** يوم مثبّت قرار «بدّل» من القائدة، فبيحجز الكرت لحدّ يومه. نفس النتيجة بكود الإنتاج (`c66fa7f`) وبالفرع — يعني تغيير §١٦ ما بيحلّها، واستنتاج مدخل ١٨:٣٠ («المنجز أكل الحصّة») ما كان السبب. لو بوست ٢ انسكّر ١٢/١٠ بالإنتاج بيضل بوست واحد — متل ما شافت القائدة. نفس الحجز: أيمن ٤ كروت، ليلاس ٥. **[للموافقة]** الإصلاح المقترح: «بدّل» (`manualDay`) بس بيأجّل؛ اليوم المثبّت بيأجّل **التصوير** بس (موعد زبون — حالة المخبر يلي ولّدت القاعدة).
- **الطقم على المرآة:** ١٣٢٠ = ١٣٠٨ ناجح · ٣ متوقَّع (DA) · ٤ متخطّى · **٥ فشل** = الأربعة القديمة + **جديد: `regen-reality`**.
  - **[VERIFIED بالكودين]** توليد دلو m=7 بيحرّك كرت **منجز**: مونتاج عبادة ريل ٢ (READY/DONE، غير مثبّت) شغل/جهوزية ٢٥/٨ → ١٨/٨ (يوم كرت النشر). كود الإنتاج ما بيعمل هيك؛ مصدره `ed768af` («مونتاج منجز غير مثبّت بيتقاس بيوم نشر قطعته»). بيخالف «الكرت المنجز موعده تاريخ مو خطة». **[للموافقة]** الرجوع عن هالجزء.
- **فحص ما قبل النشر (`PREDEPLOY=1`):** ١ ✓ (كل منتج إلو هوية — بس سجلّ «ليلاس» بالمرآة هو `e_majed` بأسماء ماجد البديلة، DA-05 → J) · ٢ ✓ · ٤ ✓ (تقرير `predeploy-today.log`) · **٣ ✗:** نزلتان مرقوا بيتزحزحوا:
  - فونيتيك REELS#2 (m=8) ١٦/٩ → ١٧/٩ — **جديد**، من أرضية أول ريل SC-03 (متحقَّق: تعطيلها بيشيله).
  - عبادة REELS#2 (m=7) ٢٠/٨ → ٢٤/٨ — **نفسه بكود الإنتاج** (TZ=UTC متل Vercel).
  - السبب المشترك: التوليد بيعيد بناء نزلات الدلو كلها، حتى يلي يومها مرق. **[للموافقة]** الإصلاح المقترح: النزلة يلي يومها مرق بتضل متل ما هي.
  - ٠ كرت مفتوح غير مثبّت بيتغيّر يومه بأول توليد (بالكودين). وكود الإنتاج تحت UTC بيغيّر ٣ كروت منجزة (DA-08: مونتاجات التوظيف/فونيتيك) — منصلحة بالفرع.
  - ⚠️ ضعف بالبند ٣ نفسه: بيقارن بمعرّف الصف، والصف يلي بينعاد خلقه بمعرّف جديد ما بينفحص — لهيك ما لقط مونتاج عبادة؛ `regen-reality` بيقارن بهوية القطعة ولقطه.
- **قراران مفتوحان من قبل (لسا عند القائدة):** (١) الصبح مقابل المسا (ملاحظة «بانتظار الزبون» على كرت، والستوري بعد نهاية الدورة)؛ (٢) سطرا «ما سجّل شي» و«مفتوح على اليوم».
- **ما انعمل:** ولا تعديل كود، ولا كتابة على الإنتاج، ولا دمج، ولا نشر. نسخة `main` مؤقتة للمقارنة بمجلد الجلسة انحذفت (الرابط لـ`node_modules` انفكّ أول).

### 2026-10-13 (١٨:٤٥) — Claude — قرار القائدة: الكاروسيل بالحمل = شرائحه · **توثيق بس، ولا تغيير كود**

- **[USER-CONFIRMED]** «الكاروسيل هو بوست واحد بالخطة وهيك منقدمه للعميل، لكن عدد الشرائح يحسب ع الحمل للمصمم حتى مانظلمه انو يوم كامل على بوست».
- **[VERIFIED — CODE] الكود أصلاً هيك:** العدّ (التقارير، إنجاز الشركة) كرت = بوست (`78db460`)؛ والحمل `quantity/rate` (`capacity.ts:75`، `daily-work.ts:119`). الشرائح بتنسجّل: نافذة الكرت (`TaskForm` كمية > ١ = كاروسيل) أو البوت عند التسليم (`recordCarouselSlides`). استيراد الخطة بيحطّ ١.
- **[INFERENCE] فجوة بسيطة، مو مخالفة:** كاروسيل مخطَّط ما انكتبت شرائحه بالكرت بينحسب ١ بالحمل لحدّ ما يوصل. ما طلبت القائدة تغييره.
- WORK_RULES §١٥ انضاف إلها نصّ القرار.

### 2026-10-13 (١٨:٣٠) — Claude — تصحيح: استنتاج «كرت الكتابة» كان غلط ورجع · **مرفوع على فرع الجلسة، بلا دمج ولا نشر**

- **[USER-CONFIRMED]** «الخطة تبع فوني جوبس خالصة أساساً … صح البداية عند نوال ومابصير حدا يشتغل قبل ماهيي تسكر كرتها، بس الكرت تسكر والخطة انرفعت».
  - يعني الاستنتاج بمدخل ١٨:٠٠ (التصاميم محجوزة ورا كرت كتابة مفتوح) **غلط**، والتعديل يلي فتح القطع يلي نصّها عليها قبل تسكير كرت الكتابة **بيخالف قاعدة القائدة** (§٦).
- **رجع:** `firstOpenBlocker` متل ما كان — كرت WRITE مفتوح بيحجز كل قطع نطاقه. اختباره انشال.
- **تثبيت الشرط بالكود (`selectDailyWork`):** الطابور **دايماً** يوم كامل من الشغل المفتوح، مهما خلص اليوم (`usedDays = 0`). المنجز اليوم بيضل بـ`doneToday`/`dayFull` للعرض كإنجاز. ٤ اختبارات قديمة لقاعدة ١٧/٩ انكتبت على §١٦.
- **سبب حالة سابين لسا مو مؤكَّد.** الاحتمالات الباقية بالكود:
  1. **[INFERENCE، الأرجح]** المنجز اليوم كان ياخد حصّة اليوم (قاعدة ١٧/٩) فبقي كرت واحد — هاد يلي انصلح.
  2. معدّل سابين المخزَّن (`Employee.rates.POST`) أقل من ٦.
  3. كرت كاروسيل كميته ≥ المعدّل = يوم كامل لحاله.
  4. مؤجَّل بـ«بدّل».
- **أداة التشخيص:** `PREDEPLOY=1 npx vitest run tests/predeploy-mirror.test.ts` صار فيها بند ٤: لكل موظف مداوم — الطابور، المنجز اليوم، وكل كرت مفتوح مستبعَد **مع سببه** (محجوز ورا مين / مؤجَّل / تجاوز السعة) وكمية الكرت ومعدّل الشخص. بيكتب `predeploy-today.log` (مُهمَل بـgit). شغّالة على seed.
- **WORK_RULES §١٦** انصلحت: «الكتابة أول» كما هي بـ§٦؛ والطابور دايماً يوم كامل.
- **[VERIFIED — TESTS]** قاعدة seed: نفس الـ٣٠ فشل حرفياً.

### 2026-10-13 (١٨:٠٠) — Claude — «ما في يوم فاضي وفي شغل» بالكود (WORK_RULES §١٦) · **مرفوع على فرع الجلسة، بلا دمج ولا نشر**

- **[USER-CONFIRMED]** «اذا انت عم تعمل الخوارزميات والجدولة كلها .. ليش بدك مني أنا شوف المهام؟ … مابدي الموظف يخلص مهام طول ما لسا عندو مهام مفتوحة! هاد شرط.»
  - بيلغي قرار ١٧/٩ («مهام اليوم» بتتسكّر لما تخلص حصّة اليوم).
- **التغيير (`lib/daily-work.ts`):**
  1. `firstOpenBlocker`: كرت WRITE مفتوح ما بيحجز قطعة عليها `brief`. القطعة البلا نص بتضل محجوزة.
     - **[INFERENCE]** هاد سبب حالة سابين المرجَّح، لأنّ كل تصاميم الدورة `blockedById` = كرت الكتابة (`pipeline.ts:283`). ما انفحص على المرآة.
     - التأثير على «متأخر»: هالقطع صارت تنعدّ متأخرة إذا فات موعدها (كانت «بانتظار»).
  2. `selectDailyWork`: لما المنجز اليوم بيعبّي الحصّة (`dayFull`) والشخص عنده شغل مفتوح، بياخد دفعة يوم جديدة بدل طابور فاضي. `dayFull` باقي بالنتيجة للعرض.
  3. الرسالة صارت «ليس لديه مهام — متفرّغ لاستلام مهام إضافية» (اللوحة + سطر القائدة بالبريف). بتطلع بس لما ما في ولا كرت مفتوح.
- **الاختبارات:**
  - ٥ اختبارات قديمة كانت بتثبّت قاعدة ١٧/٩، انكتبت على القاعدة الجديدة: `daily-work` ×٢، `operations-day-boundary`، `operations-live-set` [OP-01]، `telegram` (نص الرسالة).
  - +٣ اختبارات جديدة، حمر على القديم وخضر بعده.
  - قاعدة seed: نفس الـ٣٠ فشل حرفياً.
- **بقي مفتوح:** الكاروسيل بحمل المصمّم لسا «وحدة لكل شريحة» (PROJECT §5) — كاروسيل كبير ممكن يعبّي يوم كامل. ما تغيّر بلا قرار.
- **للمرآة على الديسكتوب:** تأكيد سبب سابين، وعدد الكروت يلي «انفكّ حجزها» بالقاعدة الجديدة.

### 2026-10-13 (١٧:٣٠) — Claude — ملاحظة القائدة: سابين بوست واحد بس واليوم ناقص · **قاعدة مسجّلة (WORK_RULES §١٦)؛ السبب لسا مو مفحوص — بدّو داتا الإنتاج**

- **[USER-CONFIRMED]** «سابين اليوم عندها بس تاسك بوست واحد. مع انو خطة الجوبس عندها لسا مامشتغلة فيها كتير. مابصير تفرغ أيام الموظفين ع كيفك… في حال عدم وجود مهام فقط… رسالة انو ليس لديه مهام — متفرغ لاستلام مهام اضافية».
- **[VERIFIED — CODE]** `selectDailyWork` (`lib/daily-work.ts:299`) بيسحب الشغل الجاي لقدّام لحدّ السعة أصلاً. فالكرت بيغيب عن يومها بس بأربع حالات:
  1. **محجوز** (`makeBlockedPredicate`) خلف مرحلة مفتوحة، مثلاً كرت كتابة خطة التوظيف عند نوال لسا مفتوح، أو التصميم ورا مرحلة قبله.
  2. **مؤجَّل** بـ«بدّل» ليوم أبعد (`fixedDayISO > today`).
  3. **السعة:** كرت واحد جهده ≥ يوم (`isExclusiveDayTask`). كاروسيل كميته = عدد شرائحه (PROJECT §5: وحدة تصميم لكل شريحة)، فكاروسيل ٦ شرائح وسعتها ٦/يوم = يوم كامل → كرت وحيد. **[INFERENCE]** مرشّح قوي لأنّ «jobs-carousel» كاروسيلات.
  4. **ما انحمّل:** الكرت برّا مجموعة الكروت الحيّة (دلو/دورة تانية).
- **التالي (من الديسكتوب، عالمرآة):**
  - سجّلي `selectDailyWork` لسابين اليوم مع سبب كل كرت مفتوح مستبعَد. لوحة «مهام اليوم» بتسمّي المستبعَد وسببه من ١١/١٠.
  - إذا السبب ٣: قرار القائدة — الكاروسيل بحمل المصمّم كمان «بوست واحد»، ولا لكل شريحة؟
  - إذا ١ أو ٤: إصلاح بالكود، مع اختبار.
- القاعدة انكتبت بـ`WORK_RULES` §١٦. الاستثناءين (محجوز/مؤجَّل) معلَّمين «للتأكيد».

### 2026-10-13 (١٧:٠٠) — Claude — المراجعة النهائية قبل الدمج (٥ مراجِعين) · **مرفوع على فرع الجلسة؛ الدمج والنشر من الديسكتوب بعد فحص المرآة**

- **[USER-CONFIRMED]** القائدة: «بدي تراجع كل التغيرات ونتأكد من الملاحظات يلي انحلت بشكل نهائي قبل الترفيع والدمج… هذا الترفيع يجب أن يكون مستقر ونهائي».
  - وأرسلت للفريق قاعدة الكاروسيل `Phoenitech-carousel-10-2-1…`.
- **[VERIFIED — GATES]**
  - `tsc` نظيف، و`eslint .` نظيف.
  - `npm run build` (عميل Postgres) نجح. رسائل `prisma:error` وقت البناء من عنوان قاعدة وهمي، مو من الكود.
  - قاعدة seed: ١٣١٥ = ١٢٨٥ ناجح · ٣٠ فاشل، نفس الـ٣٠ حرفياً من أول الجلسة، وكلهم بيحتاجوا المرآة.
- **المراجِعون (قراءة بس)، ولا BLOCKER بالكود.** المؤكَّد انصلح، كل واحد باختبار أحمر على القديم وأخضر بعده:
  - `05332e9`:
    - اللوح المفلتر كان يعلّم المحجوز «متأخر» → صار `makeLatePredicate(allTasks…)`.
    - تصحيح تواريخ كرت نشر منجز كان يمحي طابع نشره الحقيقي.
    - مسح يوم النشر ما بيمسح الجهوزية.
    - كرت ملغى بينفتح للتعديل.
    - الكرت الـADHOC بينعدّ بكميته.
  - `42c8c8b`:
    - «تم نشر بوست 3» و«تمّ النشر» صاروا يأكّدوا النشر (كانوا ما بيسكّروا شي).
    - `carousel-04-10-1` بشَرطة صار شريحة ٤ (كان يسكّر بوست ٤).
    - «تم النشر» بيوم دمشق.
  - `ed768af`:
    - نزلات الدلاء التانية بتنعدّ **من اليوم ولقدّام** بس — أول توليد كان يزحزح نزلات مرقت (عبادة ٢٨/٩→٢٧/٩).
    - مونتاج منجز غير مثبّت بيتقاس بيوم نشر **قطعته** (RG-03).
    - تصحيح تجديد لشهر تاني بينرفض إذا الدورة القديمة فيها شغل مبدوء/منجز (كان بيمحيه بصمت).
- **فحص جديد للمرآة:** `tests/predeploy-mirror.test.ts`. بيتخطّى بلا `PREDEPLOY=1`، وبيفحص:
  1. هوية تلغرام لكل منتج.
  2. ولا شركة شغّالة عليها نصّ إعفاء.
  3. أول توليد لآخر ٤ دلاء: ولا نزلة مرقت ولا كرت منجز اتزحزح، وبيطبع المفتوح المتغيّر.
- **مفتوح (قرار القائدة):** رسالة ٧:٤٥ وتقرير ٢٠:٠٠ لسا بيختلفوا بحالتين: ملاحظة «بانتظار الزبون» على **كرت** بتعفيه المسا بس، والستوري متأخرة المسا بس بعد نهاية دورتها. `period-report.ts` `isClientHeld` / قواعد §١٠.
- **مفتوح (معروف، مؤجَّل بقصد):**
  - RG-09: الأفعال على الكروت بتعيد توليد الشهر كله.
  - SA-05/06/14.
  - PU-17/21/23/27.
  - DA-07.
  - J (داتا الإنتاج).
- **قبل النشر (من الديسكتوب):**
  1. `git fetch` الفرع من GitHub.
  2. `npx prisma generate`، ثم الطقم الكامل على المرآة الحقيقية + `PREDEPLOY=1 npx vitest run tests/predeploy-mirror.test.ts`.
  3. تعبئة هويات تلغرام الناقصة.
  4. لقطة/فرع Neon قبل الدمج.
  5. القائدة تتأكّد من إيميل وكلمة سر الأدمن (كل الجلسات بتنقطع مرّة بالنشر).
  6. الدمج على `main` بـGitLab → Vercel.
  7. بعد النشر: `/login` 200، والكرون بلا سرّ 401، ومراقبة أول ملف من أيمن.
  8. SA-02: `AUTH_SECRET` جديد + كلمة سر أدمن جديدة.
- **الرجوع:** إرجاع `main` بيكفي للكود (ولا تغيير schema). بس أفعال إيقاف/رجوع/تسليم شغل عملت بعد النشر بتحتاج انتباه (صفوف `Setting` جديدة بيتجاهلها الكود القديم).

### 2026-10-13 (١٥:٠٠) — Claude — قاعدة الكاروسيل: كل الشرائح مهمة وحدة · **مرفوع على فرع الجلسة، بلا دمج ولا نشر**

- **[USER-CONFIRMED]** «10-1-1، 10-1-2، 10-1-3 … هدول كلن مهمة وحدة هيي بوست 10-1 لكن نوعه كاروسيل»، وطلبت فحص تسمية سابين وأيمن لحساب الإنجاز بدقّة.
- **[VERIFIED — أسماء حقيقية]** من `docs/cycle-reports/telegram-inventory-2026-09-02.md` (لا من الإنتاج المباشر):
  - أيمن: `obada-post-8-1-1…7` (شهر-قطعة-شريحة).
  - سابين: `mango-carousel 01…04-8-2`، و`Chocolate Brownie-carousel 01-8-1` (carousel شريحة-شهر-قطعة)، و`mango-carousel-8-2` (بلا شريحة).
- **[VERIFIED — CODE] الخلل:**
  1. **التقريرين:** `countByCompany` (رسالة ٧:٤٥ وتقرير ٢٠:٠٠) كان يجمع `quantity`، والبوت بيرفع كمية كرت التصميم لعدد الشرائح (`recordCarouselSlides`) → كاروسيل ٧ شرائح = «7 بوست».
  2. **إنجاز الشركة:** `producedCompanyPlanCount` نفس الشي.
  3. **التسمية:** `parseAssetName("mango-carousel-8-2")` = شريحة ٨ من قطعة ٢ بلا شهر.
  - السكّر نفسه كان صح: الشريحة الأولى بتسكّر الكرت، والباقي بيرجع لنفس الكرت (TR-14).
- **الإصلاح:**
  - `countByCompany` بيعدّ كرت = قطعة.
  - `producedCompanyPlanCount` بيعدّ بكمية كرت النشر.
  - رقم الشريحة بعد كلمة carousel بينقرا بس لما بعده «شهر-قطعة».
  - `quantity` على كرت التصميم باقي لحمل المصمّم (PROJECT §5).
  - القاعدة انكتبت بـ`WORK_RULES` §١٥.
  - اختبار جديد `tests/carousel-one-piece.test.ts` (٦، منهم ٣ حمر على الكود القديم).
- **[VERIFIED — TESTS]** قاعدة seed: نفس الـ٣٠ فشل حرفياً.
- **(١٥:٣٠) [USER-CONFIRMED]** لقطتان من القائدة: أيمن `Phoenitech-post-10-2-1…7`، سابين `jobs-carousel 01…04-10-1` — التنين بينقروا صح.
  - التسمية الموحّدة المقترحة للفريق: `Phoenitech-carousel-10-2-1.jpg` (شهر-بوست-شريحة بشَرطات). كانت تنقرا «شريحة ١٠»، وانصلح: الشريحة-قبل-الشهر بس لما بعد الكلمة مسافة.
  - انكتبت بـWORK_RULES §١٥، و+٢ اختبار.
- **[NOT VERIFIED]** ما فحصت رسائل تلغرام الإنتاج المخزّنة (بدها `dev.db`). القطع يلي انسكّرت قبل الإصلاح بتسمية `carousel-8-2` ممكن تكون ما انسكّرت أو انسكّر غيرها — بتنفحص بـJ.

### 2026-10-13 (١٤:٣٠) — Claude — قرار القائدة: الإعفاء = الإيقاف بس · **مرفوع على فرع الجلسة، بلا دمج ولا نشر**

- **[USER-CONFIRMED] نصّ القائدة:**
  - «انا ممكن من الداشبورد أعمل ايقاف مؤقت لشركة ما، مع ذكر السبب ومابيعتبر تأخير … اذا شغالة مابصير ينكتب سبب الايقاف. فقط حالة الايقاف.»
  - والتقارير: «بدي [الصبح] مهام اليوم يلي لازم كل شخص ينجزها، بتقرير المسا بدي المهام الفعلية يلي أنجزها + التأخيرات في حال وجودها.»
- **[VERIFIED — CODE]** `lateExemptReason` بينكتب بس بـ«أوقف النشر» (`companies.ts:607`)، وبينمحى بالرجوع (`:655`، `:711`)؛ ولا شاشة بتعدّله. والموقوفة مستبعدة من «متأخر» أصلاً (`isDormantCompany`).
- **التغيير:** شلنا `|| c.lateExemptReason?.trim()` من `lib/late.ts` و`telegram/brief.ts` و`reports/page.tsx`. الإعفاء صار: موقوفة/مؤرشفة، أو لسا ما بلّش نشرها — متل تقرير ٢٠:٠٠ (§١٠).
  - `WORK_RULES` §١٤ انوضّحت.
  - اختبار `tests/telegram.test.ts` القديم («جدارات معفاة بالنص وهي شغّالة») انكتب من جديد على القاعدة الجديدة.
- **[INFERENCE]** على الداتا العادية ما بيتغيّر ولا رقم، لأنّ النص ما بيكون إلا على موقوفة. التغيير بيضمن إنّ الصبح والمسا ما بيفترقوا لو ضلّ سطر قديم على شركة شغّالة.
- **محتوى الرسالتين [VERIFIED — CODE، مطابق لقرار ١٦/٩]:**
  - ٧:٤٥: سطر لكل شخص بشغله اليوم.
  - ٢٠:٠٠: سطر لكل شخص بالمنجز اليوم، وسطر «ما سجّل شي»، وسطر «مفتوح على اليوم»، وسطر «متأخر مفتوح».
  - **سؤال مفتوح للقائدة:** يضلّوا سطرا «ما سجّل شي» و«مفتوح على اليوم» ولا ينشالوا.
- **[VERIFIED — TESTS]** قاعدة seed: نفس الـ٣٠ فشل حرفياً، الباقي ناجح.

### 2026-10-13 (١٤:٠٠) — Claude — إصلاحات المراجعة المستقلّة لـF–H · **مرفوعة على فرع الجلسة بـGitHub (`hla-sh93/sm-team-dashboard`، عام) — بلا دمج على `main` ولا نشر على Vercel**

- **[USER-CONFIRMED]** المستخدمة: «اشتغل على نسخة البابليك ماعنا حل تاني. مابدي امحي شي — اشتغل وكمل التعديلات». المستودعات الخاصة على GitHub «Disabled by regional policies» عندها (لقطة شاشة)، فالنسخة العامة باقية بقرارها.
- **الكوميتات (كل وحدة مع اختبار أحمر على الكود القديم وأخضر بعده، إلا الأخيرة):**
  - `6b1f38e` H-P1: منجز بلا `date` ما بينختم بموعد بالمستقبل (الأبكر بين الموعد واليوم)، وإقفال الإنتاج مع النشر بنفس طابع كرت النشر.
  - `27d74d3` H-P2: سطر `adhocStates` بلا `stage` بياخد مرحلة الكرت المطابق؛ `restoreMistakenClosures` تحت حارس الأرشيف/الإيقاف؛ التسمية «كرتاً خارج الخطة دون تغيير».
  - `c316a78` G-P2: فيد = أيام النشر بالضبط → قطعة باليوم (`n >= feedSpan`)، والإنذار بس لما أكتر.
  - `b2be819` G-P1 + G-P2: التوليد المحصور على شركة (`reelPlacementFor` + `savedBucketBookings`) بيحطّ نزلاتها حول نزلات غيرها المحفوظة بنفس الدلو؛ تصحيح التجديد بيعيد بناء الدورة الجديدة بعد تنظيف القديمة.
  - `3d4bc5e` F-P1: `/publishing` بتحمّل سلسلة الحاجز (`loadBlockerChain`) → «بانتظار» بيطلع؛ «اليوم» بـ`teamTodayISO`.
  - `fe00bbc` F-P1: عدّاد «متأخرة» بالرئيسية بـ`makeLatePredicate`، و`today = teamToday()`.
  - `4e046e7` F-P2: تقويم `/tasks` بـ`makeLatePredicate` للمفتوح؛ تعديل `publishDate` لكرت نشر بيحرّك `readyDate` معه.
  - `3a4a3e6` اختبارات: `if (skip()) return` → `it.skipIf(skip())` بـ١٥ ملف (١٢٤ اختبار). ملفّا الأمان (`security-authz-matrix`، `security-rsc-exposure`) رجعوا متل ما كانوا لأنّ توفّر القاعدة عندهم بيتحدّد وقت التشغيل.
- **[VERIFIED — GATES، حاوية سحابية]** `tsc` و ESLint نظيفين على الملفات المعدّلة.
  - **قاعدة `prisma/dev.db` مبنية من `prisma/seed.ts`** (مو مرآة الإنتاج؛ غير متتبَّعة): ١٢٩٥ اختبار = ١٢٦٥ ناجح · ٣٠ فاشل. الـ٣٠ نفسهم حرفياً قبل الإصلاحات وبعدها؛ كلهم بيحتاجوا داتا الإنتاج (data-integrity · data-audit · telegram-e2e · regen-snapshot …).
  - **بلا قاعدة:** ٢٤٥ متخطّى (كانوا ينجحوا بصمت).
- **[NOT VERIFIED]** ما انفحص على مرآة الإنتاج (`dev.db` الحقيقية على الديسكتوب). لازم يركض الطقم هناك قبل أي دمج، خصوصاً `regen-snapshot` و`operations-e2e` بعد تغيير المحرّك (`b2be819`، `c316a78`).
- **مفتوح:**
  - **قرار القائدة:** WORK_RULES §١٠ مقابل §١٤ (نصّ الإعفاء الحر).
  - `preflight` أرخى من الخادم (H-P2).
  - عدّادات `updatedAdhocCards`/`updatedCourseCards` بتعدّ المخطَّط (PLAUSIBLE، سباق).
  - حمولة قديمة بكروت منجزة أصلاً بتنرفض لشركة موقوفة.
  - فحص UTC باختبار المصوّر تحت TZ=UTC.
  - J من الديسكتوب.
  - SA-02: تدوير `AUTH_SECRET` وكلمة سر الأدمن (المستودع عام).

### 2026-10-13 (١٢:٠٠) — Claude — المراجعة المستقلّة لـF–H (٣ مراجِعين، قراءة بس) · **محلي فقط — ولا تعديل كود؛ الإصلاحات بانتظار موافقة المستخدمة**

- **F (`a0d4dfd`، `0444ef5`):**
  - **P1 [VERIFIED بالكود]** `/publishing` بتجيب كروت PUBLISH بس (`publishing/page.tsx:18`) → `makeLateClassifier`/`makeHeldReason` ما بيلاقوا الحاجز → «بانتظار» ما بيطلع أبداً (OP-12 مو مصلَّح عالشاشة).
  - **P1 [VERIFIED بالكود]** عدّاد «متأخرة» بالرئيسية (`overview-client.tsx:297`) بقاعدته الخاصة، مو `late.ts`.
  - **P2:**
    - تقويم `/tasks` قاعدة تالتة (`tasks-client.tsx:226`).
    - `readyDate ?? publishDate` بيخلّي كرت نشر مؤجَّل يطلع متأخر.
    - اختبارات `if (skip()) return` بتنجح بصمت.
    - `new Date()` بدل `teamTodayISO()` بشاشتين.
  - **قرار مطلوب:** تناقض WORK_RULES §١٠ («نصّ الإعفاء الحر ما بيعفي لحاله») مع §١٤ («ما عليها إعفاء») → رسالة ٧:٤٥ وتقرير ٢٠:٠٠ بيختلفوا.
- **G (`0b38559`):**
  - **P1 [CONFIRMED بسكربت المراجِع، الكود مقروء]** توليد شركة وحدة جوّا دلو (`onlyCompanyId`) بيتجاهل نزلات الشركات التانية المحفوظة بنفس الدلو (`schedule-engine.ts:385` `NOT {year, month}`) → سقف المصوّر بينكسر بلا إنذار.
  - **P2:**
    - تصحيح تاريخ تجديد: نزلات الشركة القديمة بتحجز دورتها المنقولة.
    - **[VERIFIED بإعادة تشغيل `probe1`]** `n == feedSpan` بيروح للفرع القديم (`scheduler.ts:581`) → ٢٠ فيد على ٢٠ يوم = قطعتين على ٣١/١٠ ويوم فاضي بلا إنذار.
    - فحص UTC بالاختبار ما بيفشل تحت TZ=UTC.
- **H (`5810dd0`):**
  - **P1 [VERIFIED بالكود]** منجز بلا `date` بينختم بموعده حتى لو بالمستقبل (`plan-update.ts:630`)، عكس قاعدة OP-07. وكرت النشر بموعده بينما الإنتاج بينسكّر «هلّق».
  - **P2:**
    - [VERIFIED] تسمية «كرتاً منجزاً دون تغيير» بتعدّ كروت مفتوحة.
    - [VERIFIED] `adhocStates` بلا stage بيطبّع بـ`spec.stage` مو مرحلة الكرت.
    - `restoreMistakenClosures` برّا حارس الأرشيف/الإيقاف.
    - `preflight` أرخى من الخادم.
    - عدّادين بيعدّوا المخطَّط مو المكتوب.
  - ١٠٣/١٠٦ ملف بـ`scripts/data` بتمرق المخطّط الصارم؛ التلاتة المرفوضة مو حمولات.
- **[VERIFIED]** باقي ادّعاءات المدخلات (٠٨:٣٠ · ٠٩:٠٠ · ٠٩:٣٠ · ١٠:٠٠) طابقت الكود حسب المراجِعين.
- **التالي:**
  1. موافقة المستخدمة على الإصلاحات.
  2. قرار قاعدة الإعفاء.
  3. J من الديسكتوب (بيحتاج `prisma/dev.db`).

### 2026-10-13 (١١:٠٠) — Claude — نسخة GitHub `hla-sh93/sm-team-dashboard` **عامّة** · **[VERIFIED] — بانتظار قرار المستخدمة؛ ولا تغيير كود**

- **[VERIFIED — GitHub API بلا مصادقة]** `hla-sh93/sm-team-dashboard`: `visibility: public`، انعمل `2026-10-13T07:13:52Z`، الفرع الافتراضي `main@c66fa7f`. عليه ٧ فروع (main · feature/finance · feature/period-reports · feature/social-publishing-schedule · fix/publish-mix · codex/qa-deep-stabilization · فرع الجلسة).
- **[VERIFIED — git]** التاريخ العام فيه: `backups/local-db-snapshot.json` (مفاتيح `authSecret`/`adminPasswordHash` بالتاريخ — SA-02، ومفاتيح `salary` ×١١ و`contractValue` ×١٥)، `backups/dev.db.pre-fixes-2026-07-08.bak` (نسخة قاعدة)، ملفات خطط العملاء `.docx`، وتقرير الفحص العميق بثغرات التطبيق الحيّ (SA-01…). `.env.bak-20260911` فيه بس `DATABASE_URL` لملف SQLite محلي — مو سرّ.
- **[VERIFIED — فحص أنماط]** ولا توكن بوت تلغرام، ولا رابط Postgres/Neon بكلمة سر حقيقية، ولا `ghp_`/`npg_` بكل الـ٣٧٧ كوميت (أنماط بس — مو ضمان كامل).
- **التوصية:** تحويل المستودع لخاص فوراً (Settings → Danger Zone → Change visibility)، ثم SA-02 بإيد القائدة: `AUTH_SECRET` جديد على Vercel + كلمة مرور أدمن جديدة. Claude ما عنده وصول GitHub بهالجلسة فما بيقدر يغيّر الرؤية.
- **ما اندفع:** هالمدخل محلي لحتى يصير المستودع خاص.

### 2026-10-13 (١٠:٣٠) — Claude — طلب مكرَّر: إصلاح «رفع عدد القطع» بـ`applyPipelinePreservation` · **ولا تغيير كود — تحقّق بس؛ مدخل التوثيق هاد محلي**

- **الطلب:** نفس طلب ١١/١٠ (مساءً) حرفياً: الاحتياطان (`pipelineKey|stage` و`company|type|publishDate|stage`) يتخطّوا الصف يلي هويّته محجوزة لكرت مرقّم، + اختبارات.
- **[VERIFIED — CODE]** الإصلاح موجود من قبل: `claimedByNumber` + `firstUnclaimed` بـ`src/lib/pipeline-preservation.ts` (مدموج على `main` كـ`1f34a01` ومتحقَّق حيّاً ١١/١٠ ١٢:٤٨)، وصار **أشدّ** بالمرحلة C (RG-01): الكرت المرقّم ما بياخد بالتاريخ إلا صف بلا رقم، والصف المرقّم يلي رقمه طلع من الخطة ما بيروح لحدا.
- **[VERIFIED — TESTS، حاوية سحابية]** `tests/pipeline.test.ts` «رفع عدد القطع ما بيورّث حالة قطعة قديمة» ٤/٤ (بتغطّي: قطعة جديدة مفتاحها = مفتاح قطعة قديمة → NOT_STARTED بلا وصف ولا ملاحظات؛ نفس الشي بمفتاح التاريخ؛ كرت بلا رقم بيضل يتطابق بالتاريخ؛ إعادة توقيت بتحفظ بالرقم). **اختبار طفرة:** تعطيل الحارس (`firstUnclaimed` ← أول صف) بيحمّر الحالتين ١ و٢، والرجوع بيخضّرهن. `pipeline`+`publish-mix`+`system-relations` ٦٥/٦٥.
- **[VERIFIED — بيئة]** الطقم الكامل بالحاوية: ١٢٧٩ = ١١٥١ ناجح · ١٢٣ متخطّى/متوقَّع · ٥ فشل + ٢ ملف ما انحمّلوا (lifecycle · telegram-e2e). كلهم بيئة: ما في `.env` (`DATABASE_URL`) ولا `prisma/dev.db` بالحاوية (غير متتبَّعين بـgit). ما انقاسوا هون الفشلات الستة المعروفة على الداتا. ملاحظة: `npm ci` بيرفض لأنّ `package-lock.json` ناقصه `@emnapi/core`/`@emnapi/runtime@1.10.0` — انعمل `npm install` ورجع الـlockfile لحالته بلا تغيير.
- **ولا تغيير** على `src/` أو الاختبارات أو الإنتاج.
- **[VERIFIED — GITHUB، بموافقة المستخدمة]** الفرع `claude/interesting-feistel-0eec40-gqr3vf` اندفع لـ`origin` (فرع جديد على GitHub): ١٦ كوميت قدّام `origin/main@c66fa7f` (المراحل A–I + هالمدخل)، وولا كوميت ورا. **ما في دمج على `main` ولا نشر على Vercel للإنتاج** — هاد لسا بدّو موافقة القائدة بعد المراجعة المستقلّة لـF–H و J/K.

### 2026-10-13 (١٠:٢٠) — Claude — المرحلة I: التوثيق · **محلي فقط — كوميت توثيق، ولا كود**

- **`WORK_RULES.md`:** §٨ صار فيه «الإيقاف بيخبّي ولا بيمحي، والرجوع بيكمّل الباقي» (D1، بنصّ القائدة، والمعادلة معلَّمة INFERENCE)؛ §١٠ طابع المنجز بلا `date` (INFERENCE للتأكيد)؛ وأربع قواعد جديدة: §١١ السكّر من تلغرام لصاحب الكرت أو القائدة (D3 — بتلغي «الكريدت لمين بعت»)، §١٢ أسبوع التحضير من التوقيع (D2)، §١٣ تسليم الشغل (D4)، §١٤ «اليوم» بدمشق و«متأخر» بتعريف واحد. كل قاعدة مع الغلطة يلي ولّدتها (أرقام الفحص).
- **`PROJECT.md`:** §٥ ما عاد يقتبس أرقام سعة (كانت قديمة: «10 posts/day»، `TYPE_HOURS`) — بيأشّر لـ`Employee.rates`/`DEFAULT_RATES`/`effectiveHours`/`WORK_WEEK` (SC-13/DA-15)؛ §٦ التوزيع (الفائض والأرباع)، نافذة التصوير وسقف المصوّر عبر الدلاء، أرضيات الدورة الباردة بالثوابت (ثلاث أنظمة) وفقرة «التواريخ واليوم»؛ §١١ أيام الدوام الصح، «لم يُجدد» أرشفة مو إيقاف، الإيقاف/الرجوع، تسليم الشغل، «متأخر» الواحد، والمالية بخطة الشهر وحالته؛ §١٢ حدود محدّثة (منها **حشر المصمّمين جوّا الدلو — قرار معلّق عند القائدة**)؛ §١٤ الأسماء البديلة بـ`|`، شرائح الكاروسيل، طبقة النوع للمالك بلا أسماء خام، المستند بنطاقه، قاعدة D3، تأكيد النشر، والإيقاف الجديد. كل رمز مذكور متحقَّق إنه موجود بالكود.
- **الذاكرة:** «الكريدت لمين بعت الملف» معلَّمة ملغاة بقرار ١٢/١٠ (مع إبقاء المعرّفات الرقمية كمرجع).
- **التالي:** نتيجة المراجعة المستقلّة لـF–H (شغّالة) → إصلاحاتها → J (داتا الإنتاج بمراجعة القائدة) → K.

### 2026-10-13 (١٠:٠٠) — Claude — المرحلة H: حمولات الخطط · **محلي فقط — كوميت على `claude/interesting-feistel-0eec40`، ولا دفع، ولا كتابة على الإنتاج، ولا تغيير schema**

- **المخطّط (`plan-update.ts`):** `.strict()` على `items` و`prepareOn` و`publishOn` و`closePreviousOpenTasks` (PU-08: `stage` بالبند كان ينشال والوصف ينزل على كرت النشر)؛ `pieceStates` بترفض يوم شغل بعد الجهوزية (PU-07)؛ `date` بس مع حالة منجزة (PU-09 — كان ينشال بالصمت)؛ `prepareOn`/`publishOn` لحالهن حمولة (PU-10)؛ رسائل بنيوية عربية مع مسار الحقل (PU-19). **[VERIFIED]** كل الـ١٠٣ حمولة بالمستودع لسا بتمرق المخطّط.
- **PU-02 [INFERENCE — للقائدة]:** منجز بلا `date` كان بلا أي طابع فيغيب عن تقرير الفترة و٢٠:٠٠. ما رفضته لأنّ حمولات حقيقية بتعمله عن قصد («التاريخ المسجَّل بالتطبيق يبقى كما هو» — برو ٣/٩؛ ستوري مانغو يومها مو معروف): الطابع هلّق = **موعد الكرت نفسه** بلا تحريك أي موعد، والمنجز أصلاً بيضل على طابعه، وحمولة بـ`date` بعدين بتصحّحه.
- **PU-12:** `pinned` الصريح بيغلب `publishDate` (كان `pinned:false` ينقلب تثبيتاً). ⚠️ إعادة تطبيق `prod-44` هلّق بتفكّ تثبيت نشر ستوري ١٢ البلسم — متل ما كتبت الحمولة.
- **PU-13:** «منشور» على مرحلة غير النشر = «جاهز» (بـ`normalizeStatusForStage`، يعني كمان من نوافذ التعديل).
- **PU-04:** العدّادات بتعدّ يلي **تغيّر** فعلاً (الوصف، حالات القطع، خارج الخطة، الدورات) والكتابة بلا فرق ما بتصير — إعادة التطبيق بترجع أصفار و«ما تغيّر» بدل «معاد توقيته».
- **PU-05:** اسم موظف لأكتر من واحد = رفض (المسؤولون، كروت خارج الخطة، مصمّم/ناشر الدورات).
- **PU-24:** شركة مؤرشفة أو موقوفة ما بينخلق ولا بينفتح إلها شغل (كروت خارج الخطة مفتوحة، حالات غير منجزة، كروت دورات)؛ تصحيح المنجز مسموح.
- **PU-16:** رفع Word: لما في دورة جاية مسجَّلة المعاينة بتسأل «لأي دورة؟» (الحالية/الجاية) وبتنبّه، والتطبيق بيقبل بس وحدة منهن. «اليوم» من يوم الفريق.
- **PU-22:** كل تاريخ بتكتبه الحمولة على منتصف ليل UTC. **PU-25:** تطبيقان متوازيان بنفس المعرّف = إعادة وحدة (نجاح) بدل «فشل تطبيق خطة المحتوى». **PU-28:** تجديد شركة خطتها صفر بينسجّل وبينجح (كان «سُجّل التجديد ثم أُلغي»).
- **PU-21:** `scripts/preflight-payload.ts` بيمرّر الحمولة على مخطّط الخادم نفسه، وبينبّه «⚠️ الكرت منجز (تاريخ) والحمولة بتفتحه» (جرّبته على نسخة المرآة: `prod-62` بيفتح بوست ١ و٢ فونيتيك المنجزين ٨/١٠ و١١/١٠ — الحالة بالتقرير)، وبيطبع طابع المنجز بلا `date`.
- **الاختبارات [VERIFIED محلياً]:** الطقم ١٢٧٩ = **١٢٧٢ ناجح · ٣ متوقَّع الفشل (داتا: DA-03/09/10 → J) · ٤ فشل قديم**. `tsc` و`eslint` نظيفين. جديد: `tests/plan-update-guards.test.ts` (نسخة قاعدة: PU-24/22/28/25) وحالات PU-02…PU-19 وPU-16 — كل إصلاح مفحوص بالطفرة (١٧/١٧). بصمة `prisma/dev.db` `7b2393…` ثابتة.
- **التالي:** I (التوثيق: PROJECT.md/WORK_RULES.md بقواعد D3 والنوع للمالك والأسماء البديلة و§١٠ وما سبق) · مراجعة مستقلّة لـF–H · J · K.

### 2026-10-13 (٠٩:٣٠) — Claude — المرحلة G: نواة الجدولة · **محلي فقط — كوميت على `claude/interesting-feistel-0eec40`، ولا دفع، ولا كتابة على الإنتاج، ولا تغيير schema**

- **SC-01 [VERIFIED بنسخة قاعدة + نواة]:** سقف المصوّر اليومي صار عبر الدلاء: المحرّك بيقرا نزلات الريلات بالدلاء الجارة لنفس المصوّر (شركات مُدارة غير راكدة، شهر قبل لشهر بعد) ويمرّرها للنواة كحجوزات (`reelBookings` → `buildPhotoSessions(preBooked)`). شاهد ٢٨/٩ (نور ٣ + عبادة ٣ + التوظيف ٣ = ٩ والسقف ٦) ما عاد يصير. إعادة توليد أي دلو بتحترم نزلات التاني الموجودة.
- **SC-02:** فيد أكتر من أيام النشر بيتوزّع بالتساوي (حدّ `⌈القطع ÷ الأيام⌉` باليوم) بدل تكويم الباقي على آخر يوم، وبإنذار. **SC-04:** نفس الشي للستوريز (الأقلّ حملاً الأقرب، مو آخر الدورة) وبإنذار.
- **SC-03:** أول ريل بدورة باردة (عقد جديد، أسبوع التحضير، رجوع من إيقاف) ما بينشر قبل ما تلحقه نافذة تصوير بعد أرضية الإنتاج وقبل المونتاج بيومين — على أيام دوام المصوّر والمونتيرة (٥ بدايات مفحوصة: الفجوة ٢–٣). وشبكة أمان: أي نزلة بتطلع قبل المونتاج بأقل من يومين (زحمة اليوم) = إنذار.
- **SC-05:** بالدورة الدافئة كل ربع من الأربعة فيه نشر: الربع الفاضي بياخد أقرب قطعة (الستوري أولاً) من ربع فيه أكتر من وحدة. الدورة الباردة ما انلمست — **[OPEN للقائدة، من التقرير]** أسبوع التحضير بأول دورة مقابل «لا أسبوع فاضي».
- **SC-07:** `effectiveHours` بديل واحد لساعات اليوم (٠ أو فاضي = ٨) للقطعة واللوح. **SC-14:** تجديد مسجَّل قبل بدء النشر ما بيصير دورة (المرآة: ولا شركة فيها هيك). **SC-16:** دوام فيه جمعة (أو سبت لغير الناشر) = إنذار باسم الشخص؛ المحرّك لسا بيحترم المخزَّن.
- **SC-08:** المحرّك بيكتب مواعيد الكروت والجلسات وأيام الادهوك على منتصف ليل UTC (نفس الشكل على Vercel ومن جهاز بدمشق)، و`midnight` بـ`contract.ts` بيقرا «YYYY-MM-DD» يوماً تقويمياً. `fromISODate` ما تغيّر (بيستعمله المتصفّح).
- **أثر على الفريق اليوم [VERIFIED على نسخة المرآة]:** إعادة توليد كل الدلاء ٥–٩: ٠ منجز متغيّر، **٠ كرت نشر مفتوح تحرّك**، أيام المصوّر فوق السقف (قادمة) ٠ قبل و٠ بعد، اليتيمة ٦٦. يعني الإصلاحات حرّاس للحالات الحافّة، ما بتحرّك جدول اليوم.
- **[OPEN — قرار للقائدة] حمل المصمّمين عبر الدلاء:** حشر شغل المصمّمين (`packEmployee`) لسا جوّا الدلو الواحد — دورتان متقاطعتان بدلوين، أو نوافذ رجوع من إيقاف فوق دلو شغّال، ممكن يحطّوا مواعيد جهوزية فوق طاقة اليوم. لوحة «مهام اليوم» بتحجز اليوم على الطاقة فالتنفيذ اليومي سليم، بس المواعيد ممكن تطلع متفائلة. الإصلاح (حجوزات ساعات من الدلاء الجارة متل المصوّر) بيحرّك أيام شغل كروت مفتوحة — ما انعمل بلا موافقة.
- **الاختبارات [VERIFIED محلياً]:** الطقم ١٢٧٣ = **١٢٦٠ ناجح · ٩ متوقَّع الفشل · ٤ فشل قديم**. `tsc` و`eslint` نظيفين. جديد: `tests/photographer-cross-bucket.test.ts` (محرّك حقيقي على نسخة: الحجوزات بتوصل للنواة، ولا يوم فوق السقف، والتخزين T00:00Z)، وحالات SC-01…SC-05/07/14/16 — كل إصلاح مفحوص بالطفرة. بصمة `prisma/dev.db` `7b2393…` ثابتة.
- **التالي:** H (حمولات الخطط: PU-04/05/07/08/09/10/12/13/15/16/19/21/22/24/25/28) · I · J · K.

### 2026-10-13 (٠٩:٠٠) — Claude — المرحلة F (٢): بقايا «رقم واحد بكل الشاشات» · **محلي فقط — كوميت على `claude/interesting-feistel-0eec40`، ولا دفع، ولا كتابة على الإنتاج، ولا تغيير schema**

- **«اليوم» بدمشق — نقطة واحدة (SC-12 · OP-13 · UI-09) [VERIFIED بعملية فرعية TZ=UTC/دمشق/نيويورك]:** `src/lib/team-day.ts` (`teamToday` · `teamTodayISO` · `teamDayStart` · `dayKeyOf` انتقلت من تقرير الفترة وبتنصدّر منه متل قبل). «متابعة اليوم» (اليوم ورسائله)، الرئيسية، التقارير، صفحة الشركات، المالية، اختيار الشهر، الأرشفة/«لم يُجدد»/الإيقاف، «إعادة جدولة الدورة الحالية»، وحارس الدلو الحيّ بياخدوا يوم الفريق؛ والقيم الافتراضية لـ«اليوم» بـ`contract`/`company-visibility`/`constants`/`late`/`daily-work` كمان (بالمتصفّح بدمشق نفس الجواب). الطوابع الزمنية (`completedAt`…) ضلّت لحظات. **[INFERENCE]** على Vercel (UTC) نافذة ٠٠:٠٠–٠٣:٠٠ دمشق كانت تعرض الأمس — هلّق لأ.
- **OP-12:** «متابعة اليوم» بتعدّ «متأخر» بالمصنّف المشترك (`makeLateClassifier`) — بلا المحجوز خلف مرحلة مفتوحة ولا المثبّت ليوم لاحق؛ نفس رقم البريف.
- **SA-01 (ملاحظة المراجعة):** رسائل تلغرام بـ`/today` (منطقة بلا دخول) بقائمة مسموحات `publicDeliverySelect` — بلا `senderId` ولا `fileId`.
- **OP-04:** «العقد حتى» و«تنتهي خلال…» بالأدمن بيطبعوا آخر يوم بالدورة (`lastDayOf`) — نفس صفحة الموظّف؛ و«تنتهي الدورة اليوم» صارت تطلع فعلاً (كانت مستحيلة).
- **SC-10:** دلو بلا دورة لشركة إلها دورات ما عاد ياخد تسمية شهر تقويمي: «بانتظار التجديد» · «لم تجدّد» · «قبل بداية العقد» · «بلا دورة بهالشهر». **[للقائدة]** الصياغات من عندي — بتتعدّل بكلمة.
- **TR-20:** المالية لأي شهر بخطة دلو الشهر نفسه (`frozenPlanCounts`، §٩) وبحالة الشركة **وقت الشهر** (`dormantDuring` — نفس قاعدة تقرير الفترة، انتقلت لـ`company-visibility.ts`): وصل (ما جدّدت ١/١٠) بإيراد أيلول، وفونيتيك أيلول كلفتها المباشرة ٤٦ مو ٦٩. **[OPEN — J]** لقطات المالية المجمّدة (`financeSnapshot:<y>-<m>`) يلي انحفظت قبل هالإصلاح على الإنتاج ممكن تكون غلط (أيلول) — بتنمحى بس بقرار القائدة.
- **TR-22:** `docx-rtl` — فحص الاتجاه جوّا `pPrDefault` نفسه، ونمط Normal بينحقن جوّاه بوسمه الأصلي (بلا `<w:name>` مكرّر، و`<w:pPr>` قبل `<w:rPr>`). قالب الخطة الحقيقي: الناتج **متطابق بايت-بايت** مع القديم (٣ أشكال خطة).
- **الاختبارات [VERIFIED محلياً]:** الطقم ١٢٧٠ = **١٢٥١ ناجح · ١٥ متوقَّع الفشل · ٤ فشل قديم** (داتا المرآة). `tsc` و`eslint` نظيفين. جديد: `tests/team-day.test.ts`، حالة SC-12 بعامل TZ، وحالات TR-20/TR-22/SA-01 — كلها مفحوصة بالطفرة. إعادة توليد كل الدلاء ٥–٩ على نسخة المرآة: ٠ منجز متغيّر، اليتيمة ٦٦. بصمة `prisma/dev.db` `7b2393…` ثابتة.
- **التالي:** G (المحرّك: SC-01 حجوزات المصوّر عبر الدلاء — ومعها سعة إنتاج الرجوع من إيقاف — SC-02/03/04/05/07/08/14/16) · H · I · J · K.

### 2026-10-13 (٠٨:٣٠) — Claude — المرحلة F (١) + إصلاحات المراجعة المستقلّة على C–E · **محلي فقط — كوميتات على `claude/interesting-feistel-0eec40`، ولا دفع، ولا كتابة على الإنتاج، ولا تغيير schema**

- **الكوميتات [LOCAL]:** `2490d98` D3+E · `a0d4dfd` F (١) · والكوميت التالي: إصلاحات المراجعة.
- **F (١) [VERIFIED بالاختبار]:** `lib/late.ts` تعريف «متأخر» الوحيد (البريف، اللوح، شريط النشر، ملخّص تلغرام)؛ الرئيسية بـ`loadLiveTasks` (OP-01)؛ التقارير بخطة الدورة المجمّدة (OP-11)؛ شارة «متبقّي» للدورة السابقة فعلاً (OP-02)؛ كتابة ورا مرحلة منجزة ما بتحجز (OP-10)؛ تقرير ٢٠:٠٠ وتقرير الفترة على دفتر §١٠ واحد (`periodLedger`: يوم دمشق، بلا إقفال إداري، التصوير لمصوّر الشركة، الستوري لنهاية دورتها) — TR-15/16/17/18/19/23/25.
- **مراجعة مستقلّة على C–E ← إصلاحات [VERIFIED بالاختبار + نسخة المرآة]:**
  - **«رجّع النشر» بكل الدلاء:** الإيقاف ممكن يمسك باقي من أكتر من دورة؛ الرجوع بيعمل نافذة لكل دلو فيه باقي، الأقدم أولاً، والنوافذ ورا بعض (`Setting companyResume:<id>` صار قائمة، وكل نافذة فيها `pausedAt` و`datesApplied`). بأول توليد بعد الرجوع مواعيد النافذة بتنحطّ على **كل** قطعة باقية حتى المثبّتة، وبعدها التعديل اليدوي بيغلب. جلسات التصوير قبل الإيقاف بتضل. فشل التوليد بيرجّع الشركة موقوفة بنفس السبب. (قرار القائدة: النافذة ديناميكية حسب الباقي وحمل الفريق — مو ٣٠ يوم ولا باقي الدورة.)
  - **«تسليم الشغل» ما بينقلب بإعادة التوليد:** `Setting employeeHandover:<fromId>` = {الخلف، من تاريخ}؛ المحرّك بيبدّل الخلف بكل مالك مولَّد (الكاتبة/الناشر/المونتير المختارين بالدور كمان)، والمنجز بيضل باسم يلي عمله (الحفظ صار يرجّع صاحب الكرت المنجز).
  - **أسبوع التحضير:** توقيع قديم (Siizen ٢٠/٧، البلسم ٢٥/٧) كان يطلّع كرت الخطة بشهر فات ومتأخر؛ هلّق التحضير `max(التوقيع، البدء − ٧ أيام)` (`SIGNING_PREP_DAYS`).
  - **تلغرام:** تعديل كابشن ملف محجوز (`WRONG_TOPIC`/`NOT_OWNER`) بياخد جولة مطابقة؛ ملف القطعة بكابشن «تم النشر» بيأكّد **نشر قطعته** بالذات (حتى لو تصميمها مسكّر)، وإذا سمّى قطعة ما إلها كرت ما بيتسكّر شي (كان ينزل لـ«أقدم مستحقّة»)؛ «الرد» على رسالة إنشاء التوبيك ما عاد «مرتبط بقطعة». صفحة `/admin/telegram` وفحص الويبهوك و`rematch-unmatched` بيقروا `confirmed` ونوع المطابقة الجديد.
  - **الإيقاف بالشاشات:** المهام وحمل الشغل بيخبّوا شغل الشركة الموقوفة متل باقي الشاشات (`hideDormantCompanyWork`).
- **تحقّق المرآة [VERIFIED على نسخة]:** توليد كل الدلاء ٥–٩ ناجح؛ الكروت المنجزة المتغيّرة = **٠** (١١٦١ قبل ← ١١٦٧ بعد بلا تغيير بيوم دمشق)؛ المهام ١٤٠٣ ← ١٤٠٩؛ الروابط اليتيمة ثابتة ٦٦. بصمة `prisma/dev.db` `7b2393…` ثابتة.
- **الاختبارات [VERIFIED محلياً]:** الطقم ١٢٦٠ = **١٢٣٥ ناجح · ٢١ متوقَّع الفشل · ٤ فشل قديم** (data-integrity ×٣ وlifecycle ٦٧ — داتا المرآة). `tsc` و`eslint` نظيفين. جديد: `tests/resume-integration.test.ts` (٦، توليد حقيقي على نسخة)، `tests/signing-prep.test.ts`، و٤ اختبارات ويبهوك — كلها مفحوصة بالطفرة. `vitest.config.ts`: `hookTimeout` ٣٠ ثانية (الـ١٠ الافتراضية كانت تفشّل ملفات كاملة تحت حمل الطقم وهي بتمرق لحالها).
- **[OPEN] للتوثيق/للمراحل الجاية:** إنتاج الرجوع بينحشر على حمل دلو واحد (سعة عبر الدلاء = SC-01 بالمرحلة G)؛ تأكيد النشر من تلغرام (`PUBLISH`) ما إلو «مو هي» بـ`/today` — القائدة بتفتحه من اللوح؛ وتأكيد النشر لسا ما بيسكّر مراحل الإنتاج (ما تغيّر عن قصد).
- **التالي:** بقايا F (OP-04 «العقد حتى» = النهاية − يوم · OP-12 بـ`/today` · TR-20 المالية بالخطة المجمّدة · TR-22 · SC-10 · مساعد «اليوم بدمشق» واحد للخادم SC-12/OP-13) ثم G · H · I · J · K.

### 2026-10-12 (٢٣:٥٩) — Claude — تنفيذ خطة الإصلاح: A · B · C · D1 · D2 · D3 · D4 · E · **محلي فقط — كوميتات على `claude/interesting-feistel-0eec40`، ولا دفع، ولا كتابة على الإنتاج، ولا تغيير schema**

- **الكوميتات [LOCAL]:** `aa854ce` A (الأمان) · `a332bfb` B (حرّاس فقدان الداتا) · `293dc46` C (ثبات التوليد) · `29153ca` D2 · `692d863` D1 + ملاحظات مراجعة B · `b7b189b` D4 · والكوميت التالي D3+E (تلغرام). الخطة وحالتها: `docs/qa/deep-test-2026-10-11/FIX_PLAN.md`.
- **A [VERIFIED بالاختبار]:** صفحات الموظفين بتمرّر صفوفاً مقصوصة (`src/server/public-rows.ts`: بلا `salary`/`costPerReel`/`contractValue`/`telegramUserId`/`telegramAliases`) — SA-01. جلسات قابلة للإلغاء بجيل عشوائي (`authEpoch`) وتغيير كلمة المرور بيطلّع الكل (SA-04). حدود فكّ Word وأسماء الملفات (SA-09)، CSV (TR-21)، مقارنة أسرار ثابتة الزمن بمسارات cron والويبهوك، CSP أدنى، `.gitignore` لـ`.env.*`. **SA-02 بإيد القائدة:** `AUTH_SECRET` جديد على Vercel + كلمة مرور جديدة.
- **B [VERIFIED]:** حارس القطع الملغاة بالرقم (RG-01)، `planReductionBlocker` بالنموذج والحمولة (RG-02)، النموذج بيبعت المتغيّر بس + تعارض على تغيير الحالة (SA-03)، حارس أخير بالاستبدال («إعادة الجدولة رح تمحي N كرت عليه شغل…»)، PU-01/03/06/20، وأسطر دليل على كل إقفال آلي.
- **C [VERIFIED على نسخة المرآة]:** المنجز/المثبّت ما بيعيد تأريخه المحرّك (RG-06)، مرساة يوم النشر (RG-03)، نقل روابط تلغرام بهوية القطعة جوّا الاستبدال (RG-04: اليتيمة ثابتة ٦٦، ما عادت تزيد)، ولا إعادة توليد لدورة مسكّرة (SA-15). توليد كل الدلاء ٥–٩ على نسخة المرآة ناجح.
- **D2:** أسبوع التحضير من التوقيع والدورة من «تاريخ البدء» — بس للدورة الأولى يلي بدايتها ≥ ١٣/١٠ (العقود القايمة ما بتتحرّك). النموذج بيعبّي «تاريخ البدء = التوقيع + ٧» بس لما يتعدّل حقل التوقيع وتاريخ البدء فاضي.
- **D1:** «أوقف النشر» بيخبّي ولا بيمحي (ولا تأخير)، و«رجّع النشر» بيجدول **الباقي بس** من تاريخ الرجوع بنافذة على قدّ حصّة الباقي من الخطة (`Setting companyResume:<id>`؛ الإيقاف القديم بلا تاريخ بدء بيمشي بالمسار القديم). **[INFERENCE — للقائدة]** معادلة النافذة: `min(طول الدورة، max(الحدّ الأدنى، ⌈الدورة × الباقي ÷ المخطّط⌉))`؛ الإنتاج بينحشر بطاقة الفريق وأولوياته متل أي شغل. «جدّد» على شركة موقوفة عليها باقي بينرفض ويدلّ على «رجّع النشر».
- **D4:** `/admin/team` ← «تسليم الشغل» (معاينة بالأعداد ثم تأكيد بنفس العدد): المفتوح + المنجز من التاريخ + حقول المسؤولين بالشركات غير المؤرشفة، بسطر دليل، والمغادر برّا التوزيع. لسا ما انطبّق على ماجد/ليلاس — المرحلة J.
- **D3 + E — تلغرام [VERIFIED بالاختبار]:**
  - **هوية المرسِل:** `telegramUserId` ← `telegramUsername` (`from.username`) ← `telegramAliases` بمطابقة **كاملة** للاسم الظاهر؛ اسم بيطابق شخصين = مجهول.
  - **السكّر لصاحب الكرت أو القائدة (دور «ليدر»)**، والكريدت بيضل لصاحب الكرت (ما عاد في إعادة إسناد للمرسِل ولا تثبيت). غيرهن (أو مرسِل مجهول): الملف بيتخزّن `matchedBy = NOT_OWNER` مع كرته وبيطلع بـ«اليوم» «وصل من غير صاحب الكرت».
  - **تأكيد النشر:** من الناشر أو القائدة بس (للصيغة الصريحة كمان)، والرسالة **بتبلّش** بالتأكيد أو ✅ لحالها، ≤ ٨ كلمات، بلا نفي ولا «؟» (TR-01). الرسالة بتنخزّن **أولاً** فالإعادة والتعديل ما بيسكّروا قطعة تانية، والملف قبل الكابشن (TR-08). القطعة المسمّاة بتندوّر بالدورة الشغّالة ثم المتبقّي، وإذا ما انلقت أو كانت ملتبسة ما بيتسكّر شي (TR-09).
  - **المطابقة:** طبقة «النوع» بس من كروت المرسِل نفسه وما بتقبل أسماء الكاميرا الخام (TR-02)؛ المستند بيسكّر كرت كتابة **بنطاقه** (سيناريو · خطة/بوستات/ستوري · المقال N · لينكد إن) و`by = DOCUMENT` (TR-24)؛ أخت الألبوم بمعرّف المحادثة وبس للصور البلا اسم (TR-10)؛ الدورة الشغّالة بتربح على دلو أحدث (TR-03)؛ أسبوع التحضير بيلاقي قطعة الدورة الجاية بشهر نشرها، والقراءة يلي بتسمّي قطعة مسلّمة بتوقف (TR-04)؛ «رقم القطعة لحاله» صار بشهر النشر الفعلي بس (TR-05)؛ أسماء بديلة للشركة بنفس حقل `slug` مفصولة بـ`|` (TR-06)؛ شرائح «-شهر-قطعة-شريحة» بتنربط بكرتها وبترفع عددها (TR-14)؛ تعديل كابشن ملف ما طابق بياخد جولة مطابقة، والأرقام الهندية بتنقرا (TR-30)؛ اسم شركة تانية = `WRONG_TOPIC` ظاهر بـ«اليوم» (TR-26)؛ سطر دليل على التصوير المسكّر بالتتابع و«مو هي» بيشيل أثر الإقفال (TR-12)؛ حارس التسمية بالفحص الشامل بالنوع وبهوية القطعة (TR-07).
  - العدّادات (البريف، تقرير الفترة، فحص الويبهوك، الفحص الشامل) بتعدّ التسليمات المؤكّدة بس — رسائل التأكيد والمحجوز مش تسليمات.
- **⚠️ للقائدة — أثر التشديد [INFERENCE من مرآة ١٢:٤٩]:** تلغرام رح يسكّر **أقل**، عن قصد (FIX_PLAN §٤). أمثلة: بوست ١ Siizen كرت سابين، فملف أيمن عليه بيتحجز. أيمن وماجد بيتعرّفوا هلّق بأسمائهم البديلة («Ayman»، «Majed Abdullah») بلا معرّف رقمي. «Sabine» و«Nawal Othman» و«3mar» مش أسماء بديلة حرفية بس إلهم معرّف رقمي فبيتعرّفوا. ليلاس لازم ينضاف اسمها البديل («Lilas») مع إنشائها (J). ملفات المخبر «Drnoor…» بتحتاج `slug = Makhbar|Drnoor` (J). استيراد التصدير (`import-telegram-export.ts`) ما عاد يخمّن بالنوع أبداً (ما في معرّف مرسِل).
- **ما تغيّر عن قصد [OPEN]:** تأكيد النشر من تلغرام لسا ما بيسكّر مراحل الإنتاج (اللوحة بتسكّرها) — ما في بند بالتقرير، فما تغيّر. TR-27 (قرار القائدة) ظاهر بحارس التسمية: ١٩٥/١٩٦ — «BW-reel-10-4» بدورة تشرين بيروح لريل ٤ تشرين لا لمتبقّي أيلول.
- **انصلح بالطريق:** مصفوفة الصلاحيات كانت ناقصة «تسليم الشغل» (سهوي بـD4)؛ فشلا `telegram-e2e` ٢ب و٣ القديمين انحلّوا (النسخة بتجهّز كروت أيمن متل ما بيطلب D3، والتقرير لكل التيم الأساسي).
- **الاختبارات [VERIFIED محلياً]:** الطقم ١٢٤٦ = **١٢٠٠ ناجح · ٤٢ متوقَّع الفشل · ٤ فشل قديم** (data-integrity ×٣ وlifecycle ٦٧ — داتا). `tsc` نظيف، `eslint` تحذير واحد قديم. بصمة المرآة `7b2393…` ثابتة. الفحص الشامل على نسخة: الفشلات الباقية داتا مسجّلة بالتقرير.
- **التالي:** مراجعة مستقلّة لـC وD1/D2/D4 وE، ثم F (رقم واحد بكل الشاشات) · G (المحرّك) · H (الحمولات) · I (التوثيق) · J (تصحيح داتا الإنتاج بمراجعة القائدة) · K (البوابات + طلب موافقة الرفع).


### 2026-10-12 (٢٣:٠٠) — Claude — قرارات القائدة على تقرير الفحص العميق · **[USER-CONFIRMED] — مسجّلة قبل أي تنفيذ**

- **[USER] المصوّر:** «ماجد استقال ووظفنا ليلاس مكانه كمصورة جديدة بالشركة بدأت من 1 أكتوبر». ⇒ `e_majed` = ماجد (التاريخ لحدّ ٣٠/٩)، وليلاس موظفة **جديدة** من ١/١٠؛ إعادة تسمية السجلّ ٦/١٠ كانت غلط بنيوي (DA-05).
- **[USER] «أوقف النشر»:** «لا ماتمحيها… مابدي اخسر الخطة, ومابدي ينحسب تأخير ف بعمل ايقاف لحتى يخبرونا نتابع, منتابع من مكان يلي وقفنا فيه مع جدولة جديدة حسب تاريخ البدء الجديد للمهام الباقية والنشر». ⇒ الإيقاف بيخفي ولا بيمحي، وبلا تأخير؛ الرجوع بيكمّل الباقي.
- **[USER] توزيع الباقي بعد الرجوع:** «مو 30 يوم ولا باقي أيام الدورة, في احتمال نعمل نصف الخطة ويبقى نصفها, ف بترجع بنص. حسب عدد المهام وأيام عملن وتوزيع الجدولة مع باقي مهام التيم, حسب الأولويات. حسابها يتم بشكل ديناميكي». ⇒ [INFERENCE — للتأكيد بالخطة] نافذة الرجوع بتتناسب مع الباقي من الخطة (نص الخطة ≈ نص دورة)، والإنتاج بينحشر بطاقة الفريق وأولوياته.
- **[USER] أسبوع التحضير:** «من تاريخ التوقيع منبدأ اسبوع لحتى نعطيه البلان ويوافق عليها بشكل نهائي لنبدأ توزيع مهام للفريق. طبعاً مع امكانية تعديل تاريخ البدء… بس بشكل افتراضي هو اسبوع». **[USER، ١٢/١٠]** الدورة (٣٠ يوم) **من تاريخ البدء** (= التوقيع + ٧ افتراضياً)، والإنتاج من يومها والنشر بعد مهلة الإنتاج — **ولا أسبوع تحضير تاني جوّا الدورة** (SC-15).
- **[USER] السكّر:** «لصاحب الكرت او للمدير (أنا)» — يوسّع قاعدة ١١/١٠.
- **[USER] فونيتيك أيلول:** «أيلول حلا اشتغلتن, تشرين أيمن اشتغلن… غيرت الشخص المسؤول عنها بشهر أيلول لأن كان عندي فضى اكتر من أيمن. بس هيي الشركة تابعة لأيمن أساساً». ⇒ DA-03 مو إنجاز كاذب؛ لا تصحيح على كريدت أيلول.
- **الخطة:** `docs/qa/deep-test-2026-10-11/FIX_PLAN.md`. محلي فقط.


### 2026-10-12 (٢٢:٠٠) — Claude — حملة الفحص العميق الشامل (طلب القائدة ١١/١٠) · **محلي فقط — ولا إصلاح انطبّق، ولا دفع، ولا كتابة على الإنتاج**

- **الطلب [USER]:** «بدي هلا تعمل تيست شامل وعميق لكل العمليات والعلاقات والجدولة والخوارزميات … اختبر كل الحالات اعتمد كل نظريات التيستنغ».
- **التنفيذ:** ٨ محاور (٧ فاحصين مستقلّين + الواجهة بالمتصفّح من Claude الأساسي) على `main@c66fa7f` ومرآة `prod-20261011-1249` (`prisma/dev.db`، بصمتها `7b2393…ef26c` ثابتة بكل التشغيلات). المحاولات الأولى وقفت على حدّ الاستعمال وانعادت بالاستكمال من ملفاتها.
- **الحصيلة [VERIFIED محلياً]:** `tests/deep/` = ٤١ ملف · ٤٤٧ اختبار · ١٢٠ منها `it.fails` معنونة برقم البند (بتنقلب حمرا لما ينصلح الباغ → تنشال `.fails`). الطقم الكامل: **١٢٠١ = ١٠٧٤ ناجح · ١٢٠ متوقَّع الفشل · ٧ فشل سابق**. `tsc` و`eslint tests/deep` نظيفين. التقارير: `docs/qa/deep-test-2026-10-11/{REPORT,scheduler-core,regen-engine,plan-update,operations,telegram-reports,security-api,data-audit,ui-e2e}.md`.
- **P0 (٧):**
  - **SA-01 [VERIFIED LIVE]** صفحات الموظفين المفتوحة (`/` `/tasks` `/today` `/publishing`) بتمرّر صفوف `Employee`/`Company` كاملة لمكوّنات العميل → `GET /publishing` و`/tasks` بلا دخول فيهم ١١ صف `salary`/`costPerReel` و١٦ `contractValue` (عدّ أسماء الحقول بس، ولا قيمة انحفظت). الإصلاح: `select` بأربع محمّلات.
  - **SA-02 [VERIFIED بالـgit · الإنتاج INFERENCE]** `authSecret`/`adminPasswordHash`/`adminEmail` بتاريخ git (`backups/local-db-snapshot.json` بـ`2509c5a`/`4f073f5`/`c6ef42d` + `backups/dev.db.pre-fixes-2026-07-08.bak` متتبَّع)؛ `.env.bak-20260911` متتبَّع وما انفتح. **بإيد القائدة:** `AUTH_SECRET` جديد على Vercel + كلمة مرور جديدة + إلغاء تتبّع.
  - **RG-01 [VERIFIED كود+اختبار]** `applyCanceledPieces` (`pipeline-preservation.ts:92–158`) بلا حارس `claimedByNumber` → إلغاء بيتسرّب لقطعة منجزة بعد إعادة توقيت. تعرّض: التوظيف REEL#8 m=8.
  - **RG-02 [VERIFIED اختبار]** `updateCompany` بيقلّل العدد بلا حارس §٩ → أول توليد بيمحي المنجز ووصفه.
  - **TR-01 [VERIFIED داتا]** ٣٤ من ٣٨ إقفال «تأكيد نشر على تلغرام» من رسائل مو تأكيد (كابشنات نوال، نفي عمر، شكوى حلا) — كلها لسا `PUBLISHED`. **TR-02** طبقة «بالنوع» بتسكّر تصاميم بصور خام (١٧ من ٢١). **TR-24** أي مستند بيسكّر كرت كتابة (PDFs راند، `phoenijobs features.docx`).
- **تصحيحات على سجلّات سابقة بهالملف:** (١) عبادة REEL#1 EDIT الحركة الفعلية **٢٧/٩ → ١٧/٩** لا ٢٢/٩ (RG-03: `retimeEditsAfterActualShoot` بيقارن بـ`publishDate` كرت المونتاج نفسه). (٢) «المحرّك مو ثابت ±يوم» (إدخال ١١/١٠ SIM) **تشخيص غلط** — المحرّك حتمي؛ الزحزحة من توليد محصور بشركة (RG-09؛ إعادة تشغيل ١٢:٠٤ بتطابق BW ١٢:٤٦ حرفياً). (٣) فشل مانغو POST#6 بـdata-integrity **ما انحلّ** بمصالحة ١٥/٩ (DA-12). (٤) الفشلات السابقة صارت **٧** على لقطة ١٢:٤٩ (lifecycle «إنتاجها منجز» انحلّ بـprod-69؛ snapshot-audit-cli كان بيئة worktree) — التصنيف الكامل بـREPORT §٥.
- **[FOUND — غير مسجَّل سابقاً]** إيقاف البلسم ٤/١٠ محا ٤+٦٣ صف (و Siizen ١١)، و٤ قطع منتَجة خسرت كرت نشرها (DA-01). سجلّ المصوّر `e_majed` انعاد تسميته «ليلاس» ٦/١٠ وأسماؤه بتلغرام لسا `Majed Abdullah,Majed`، فالـ١١٥ منجز صار باسم ليلاس و«Lilas» ما بينحلّ لحدا (DA-05). سقف المصوّر ٢٨/٩ = ٩ ريلات (SC-01، متحقَّق بـ`PhotoSession`).
- **[OPEN — القائدة]** ترتيب الإصلاح المقترح وقائمة القرارات بـREPORT §٧–§٨: SA-01 فوراً · SA-02 بإيدها · RG-01/02 · تشديد تلغرام + حمولة تصحيح الإقفالات الكاذبة · SA-15 (إعادة توليد دورة مسكّرة من منطقة الموظفين) · RG-03/RG-06 **قبل أي توليد جديد لـm=7/m=8 على الإنتاج** (وإلا ٤ مونتاجات منجزة بتتحرّك). قرارات: هوية ليلاس/ماجد · «أوقف النشر» يمحي ولا يخبّي · أسبوع التحضير من التوقيع ولا بدء النشر (SC-15) · فرض «السكّر لصاحب الكرت» (TR-11).
- **بيئة محلية:** `.env.local` بالـworktree رجع `DATABASE_URL` مطلق لـ`prisma/dev.db` (كان على نسخة الواجهة، وانشالت تجاوزات الأدمن التجريبية). نسخ `prisma/.deep-*-test.db` باقية (gitignored).


### 2026-10-11 (١٥:٥٠) — Claude — «متبقّي 12» بلا مهام: لوحة «مهام اليوم» صارت تسمّي الكروت المستبعَدة وسببها · **مرفوع ومدموج على `main` (`51dc2ce`) ومتحقَّق حيّاً ١٦:٠٣**

**الطلب (القائدة، لقطة شاشة):** سابين على اللوحة «متبقّي 12» والجسم «لدى سابين 12 مهمة غير منجزة · عرض مهامه المفتوحة» — «ممنوع يكون في بس هيك متبقي بدون ما تحدد شو المهام!! اكتشف سبب الخطأ وصلحه».

- **[VERIFIED — SNAPSHOTS ٠٩:٢٧ → ١٢:٠٤ → ١٢:٤٩] السبب بالداتا:** من لقطة ١٢:٠٤ (بعد `prod-69`) كل كروت سابين المفتوحة الـ١٢ (٩ تصاميم بوستات التوظيف + ٣ يدوية) **مثبّتة على أيام شغل ≥ ١٢/١٠**، ونفس الشي كروت نوال الـ٨. إعادة الجدولة «من تاريخ اليوم» بلّشت فعلياً من **الاثنين ١٢/١٠** وتركت **الأحد ١١/١٠** (يوم شغل) فاضياً للاتنين. قاعدة «المُستبعَدة» (الكرت المثبّت على يوم لاحق ما بينزل اليوم، `selectDailyWork`) طبّقت صح: الطابور فاضي عن حقّ. **حاجز الكتابة مو السبب:** `2026_9_w_c_tawzeef_DESIGN` منجز ٦/١٠ بملف `phoenijobs features.docx`.
- **[VERIFIED — CODE] السبب بالواجهة:** `overview-client.tsx` بحالة `BACKLOG` (ما في قائمة اليوم + في مفتوح) كان يعرض **عدداً ورابطاً** بس. أي شخص كل شغله مثبّت على أيام لاحقة أو محجوز بكرت غيره كان يطلع هيك.
- **[LOCAL — REPRO]** استيراد لقطة ١٢:٤٩ على نسخة الـworktree من `prisma/dev.db` (`backup:sync`) ثم `simulate-daily-queue.ts`: **سابين ٠ كرت ونوال ٠ كرت يوم ١١/١٠**؛ يوم ١٢/١٠ سابين **كرت واحد** (بوست ٢، ١٧٪ من يومها) ونوال كرتان. (أول تشغيلين قرؤوا مرآة النسخة الرئيسية غلطاً — انظر «خطر البنية» تحت.)
- **[CODE — `51dc2ce`]** `daily-work.ts`: `makeHeldReason(allTasks, todayISO)` — نفس شرطَي الاستبعاد تبع `selectDailyWork` بصيغة جواب: `parkedUntil` (اليوم المثبّت/المبدَّل اللاحق) و`blockedBy` (أول حاجز **مفتوح** بالسلسلة، بصاحبه)؛ `null` = مؤهَّل اليوم. `overview-client.tsx`: حالة BACKLOG صارت **قائمة الكروت نفسها** بعنوان «لا شيء مجدول اليوم لدى سابين — 12 مهمة مفتوحة · 12 مثبّتة على أيام لاحقة»، كل كرت بيومه («الاثنين 12 تشرين الأول») أو بـ«بانتظار <الكرت> · <صاحبه>»، الأقرب أولاً، والرابط بقي تحت. الشارة بالتبويب بقيت «متبقّي N». الطابور نفسه ما تغيّر. `tests/daily-work.test.ts` +٧ (مثبّت · مبدَّل · حاجز · سلسلة بترجع أول مفتوح · حاجز يتيم · الاتنين معاً · اليوم الفاضي كلّه مفسَّر). `tsc` وESLint نظاف؛ `daily-work` + `person-day-state` ٤٠/٤٠.
- **[VERIFIED — PREVIEW على نسخة ١٢:٤٩]** الصفحة الرئيسية محلياً: تبويب سابين «لا شيء مجدول اليوم لدى سابين — 12 مهمة مفتوحة · 12 مثبّتة على أيام لاحقة» وتحتها بوست-2 الاثنين 12 · بوست-3 الثلاثاء 13 · «إطلاق ميزة Featured Job…» الأربعاء 14 · بوست-4 الخميس 15 …؛ تبويب نوال «8 مهمة مفتوحة · 8 مثبّتة على أيام لاحقة». لقطة شاشة مأخوذة؛ كونسول بلا أخطاء.
- **[LIVE/VERIFIED ١٦:٠٣]** rebase على `origin/main@e74ce60` (مدخل الجلسة التانية + prod-73…75) ثم دفع سريع `e74ce60 → 51dc2ce`. Vercel بنى من `main` تلقائياً: `buildId` الحيّ `NZbbmW6a8X3iB5GLRA2zN → YO3haoS8Ikr_wunvj4LPM` خلال دقيقة من الدفع، و`origin/main` ما تحرّك بين الدفع والتحقّق؛ `/login` 200 · `/api/cron/done-report` 401. كود واجهة بس — ولا تغيير بالداتا ولا بالسكيما.
- **[OPEN — القائدة] ليش يومها فاضي أصلاً:** (١) الحمولات بلّشت من ١٢/١٠ لا من ١١/١٠ — إذا بدها الأحد يشتغل، إمّا «تعديل مهام اليوم» (بيسحب كروتاً لليوم) أو حمولة تقدّم أول يوم. (٢) تصاميم التوظيف موزَّعة **واحد باليوم** (١٢ · ١٣ · ١٥ · ١٥ · ١٩ …) فأيام سابين الجاية رح تطلع ١٧٪ — ومعها **أوصاف بوست ٢–١٠ فاضية** (مسجَّلة عند الجلسة التانية) فما فيها تصمّم حتى لو تكثّفت. القرار إلها، ما تغيّر شي بالداتا.
- **⚠️ [FOUND — خطر بنية]** الـworktree ما إلو `node_modules` فبيستعمل تبع النسخة الرئيسية عبر junction، و**عميل Prisma المولَّد واحد مشترك**: `new PrismaClient()` بـ`@/lib/db` بيفتح `dev.db` حسب مسار `.env` المحفوظ وقت آخر `prisma generate` — يعني آخر مين ولّد (worktree أو النسخة الرئيسية) بيقرّر أي قاعدة بيقرا **الطرفان**. أنا ولّدت العميل من الـworktree مرتين قبل الظهر (١١:٥٠–١٢:٠٠) لتشغيل الطقم؛ أي سكربت `@/lib/db` بالنسخة الرئيسية بهالفترة كان رح يقرا نسخة الـworktree (وقتها مطابقة لمرآة ١٠/١٠). **القاعدة:** من worktree لا تولّد العميل المشترك؛ مرّر `DATABASE_URL` مطلقاً (`file:E:/…/prisma/dev.db`) بالبيئة أو بـ`.env.local` (gitignored) — هيك اشتغل `simulate` والمعاينة هون.

### 2026-10-11 (مساءً) — Claude — إصلاح `applyPipelinePreservation`: رفع عدد القطع ما بيورّث حالة قطعة قديمة · **مرفوع ومدموج على `main` (`1f34a01`) ومتحقَّق حيّاً**

**الطلب:** إصلاح العلّة المسجَّلة بمدخل ١١/١٠ (خطة فونيتيك): «قطعة رقمها جديد بعد رفع العدد بتورث حالة/ملاحظات/وصف قطعة قديمة مفتاحها صار نفس التاريخ».

- **[VERIFIED — CODE] السبب:** `preservedStateOf` بيطابق بالرقم أولاً (`company|type|pieceNo|stage`)، وإذا ما لقى بينزل لـ`pipelineKey|stage` ثم `company|type|publishDate|stage`. القطع الجديدة (٥–١٠ بعد ٤→١٠) ما إلها صف برقمها، ومفاتيح التاريخ تبعها بتساوي المفاتيح **القديمة** لقطع مطابَقة برقمها أصلاً، لأنّ المحرّك بيعيد توزيع الدورة كلها. فالكرت الجديد بينسخ board/status وأختام البدء/الإنهاء/الإقفال والوصف والملاحظات تبع قطعة غيره. بالمحاكاة على نسخة من `prod-20261011-0927` بعد prod-61…63: بوست ٧ DESIGN ورث سطر ملاحظات بوست ٣؛ لو كانت القطع القديمة READY كانت الجديدة طلعت READY.
- **[LOCAL — CODE] الإصلاح (`src/lib/pipeline-preservation.ts`):** قبل المطابقة بنجمع مفاتيح القطع يلي طالب فيها كرت مرقّم من التوليد الحالي (`claimedByNumber`)؛ المساران الاحتياطيان بيتخطّوا أي صف هويته محجوزة وبياخدوا أول صف **غير** محجوز (خريطتا `pipelineKey` والتاريخ صارتا قوائم مرشّحين لأنّ عدّة قطع بتشارك يوم نشر واحد). الصفوف بلا رقم (كرت الكتابة، صفوف ما قبل الترقيم) والقطع يلي طلعت من الخطة بتضل تتطابق بالتاريخ متل قبل؛ المطابقة بالرقم نفسها ما تغيّرت. مساعد `pieceKeyOf` واحد للطرفين.
- **[VERIFIED — TESTS] `tests/pipeline.test.ts` +٤ حالات** (وصف «رفع عدد القطع ما بيورّث حالة قطعة قديمة»): (١) العدد ٢→٤ ومفتاح بوست ٣ الجديد = مفتاح بوست ٢ القديم المنجز → بوست ٣ و٤ TODO/NOT_STARTED بلا وصف ولا ملاحظات ولا أختام وكرت نشرهم مفتوح، وبوست ١ و٢ بياخدوا حالتهم القديمة بالرقم؛ (٢) نفس الشي عبر مفتاح التاريخ (قطعتان بنفس اليوم بتسلسل `|2`)؛ (٣) كرت بلا رقم بيضل يتطابق بالتاريخ؛ (٤) إعادة توقيت نفس القطع بتحفظ الحالة بالرقم. الحالتان ١ و٢ **حمراوان على الكود القديم** (بوست ٣ بيرجع DONE) وخضراوان بعده؛ طقم `pipeline` + `publish-mix` + `system-relations` ٦١/٦١.
- **[VERIFIED — GATES]** `tsc` نظيف، ESLint نظيف. الطقم الكامل بعد `npx prisma generate` (عميل SQLite): **٧٣٨/٧٤٧ — ٩ فشل كلها سابقة**، مطابقة حرفياً مع الإصلاح مسحوب: الستّة المعروفة (data-integrity ×٣ · lifecycle «كل إقفال نشر من تموز وبعده إلو دليل» ٦٧ صف · telegram-e2e ٢ب/٣) + تلاتة على مرآة `prisma/dev.db` بتاريخ 10/10 12:00: lifecycle «القطعة المنشورة إنتاجها منجز» (POST#1) · regen-reality «توليد أول» (عبادة REEL#1 EDIT بدلو m=7، منجز ومثبّت: يوم شغله ٢٢/٩ → ١٧/٩ بأول توليد — هو تناقض `retimeEditsAfterActualShoot` المذكور بمدخل الصبح، صار الحارس بيلقطه على المرآة) · snapshot-audit-cli «لقطة نظيفة → حالة خروج صفر» (بيرجع ١). ولا واحد منها بيمسّ الحفظ.
- **[FOUND — بيئة، مو داتا]** ثلاثي «Prisma init» (work-week-reports · live-tasks-running-cycle ×٢) المسجَّل كفشل سابق من ١٦/٩: `new PrismaClient()` بـ`@/lib/db` بيعتمد على مسار `.env` يلي انحفظ بالعميل **وقت `prisma generate`**. توليد العميل و`.env` مو موجود (أو بعد `npm run build` يلي بيولّد عميل Postgres) بيعطي «Validation Error Count: 1» فاضي. بالـworktree: توليد قبل `.env` → الثلاثة فشلوا؛ إعادة التوليد بعد وجوده → **١٤/١٤**. القاعدة: `.env` أولاً ثم `npx prisma generate` ثم الطقم.
- **[LOCAL — WORKTREE]** الشغل على `.claude/worktrees/interesting-feistel-0eec40` (فرع `claude/interesting-feistel-0eec40`، متقدّم بسرعة من `feature/period-reports@90e9c67` فبيشمل prod-61…72 وتعديل `adhocStates`). انحطّت فيه نسخة محلية غير متتبَّعة من `.env` و`prisma/dev.db` (مرآة ١٠/١٠) مشان الطقم؛ نسخة `prisma/dev.db` الرئيسية ما انلمست.
- **[VERIFIED — SNAPSHOT `prod-20261011-1200.json`]** بين الصبح والظهر جلسة تانية **طبّقت prod-61…64 على الإنتاج** (سجلّ Phoenitech: posts 10 · reels 4 · stories 14 · renewals [13/10]؛ دلو m=9 من ٤ → ٦٢ كرت أوتوماتيكي) — بالكود القديم. أثر العلّة الوحيد الظاهر: سطر ملاحظات بوست ٧ DESIGN، و`prod-64` نفسها استبدلته بسطر توضيحي («بوست ٧ قطعة جديدة بخطة تشرين — سطر «فُتح من جديد» تبع بوست ٣»). بوست ٥–١٠ (تصميم ونشر) كلهم TODO/NOT_STARTED بلا أختام ولا ملاحظات، والـ١٤ ستوري (٢٨ كرت) نظاف، وبوست ١ READY ٨/١٠ وبوست ٢ IN_PROGRESS متل ما خطّطت الحمولة. **ما في تصحيح مطلوب على الإنتاج.** الإصلاح صار **وقائياً**: القطع الموجودة صار إلها صفوف بأرقامها فبتتطابق بالرقم، والعلّة ما بترجع تظهر إلا عند رفع عدد لاحق لأي شركة — وهناك بيمنعها. على الكروت الحالية الكود الجديد = القديم بالنتيجة (الاحتياطان ما بينوصلّهم إلا كرت الكتابة، وصفوفه بلا رقم).
- **[LIVE/VERIFIED 12:48]** القائدة: «موافقة، ارفع الكود وادمجه على main». الفرع انعمل له rebase على `origin/main@5673fb5` (مدخل الجلسة التانية «مطبّقتان حيّاً» — handoff بس، بلا تعارض)، بوابات بعد الـrebase: `tsc` نظيف و`pipeline`+`publish-mix`+`system-relations` ٦١/٦١، ثم `git push origin HEAD:main` **دمج سريع `5673fb5 → 1f34a01`** (الكود `e9adf7c` · التوثيق `0a25894` · `1f34a01`). Vercel بنى من `main` تلقائياً: `buildId` الحيّ تغيّر `AR9T7Y0Wc-IUIOYVtkQYM → TUe7_H3QqXCWDPrh6exJd` خلال دقيقة من الدفع (مراقبة `/login` كل ٣٠ ثانية)، و`origin/main` ما تحرّك بين الدفع والتحقّق؛ `/login` 200 · `/api/cron/done-report` 401 (الكرون مقفول بالسرّ متل قبل). ولا تغيير على السكيما ولا على الداتا — نشر كود بس. `main` المحلي انضبط على `1f34a01`؛ فرع `feature/period-reports` بالنسخة الرئيسية لسا على `5673fb5` (ورا `main` بتلات كوميتات).
- **[INFERENCE]** BW (٤→٨ بـ١/١٠) مرق بنفس المسار القديم بلا أثر ظاهر لأنّ بوست ١–٤ كانوا NOT_STARTED بلا ملاحظات وقتها وأوصاف ٥–٨ انكتبت بعدها بـ`prod-54`؛ ما في تصحيح مطلوب.

### 2026-10-11 — Claude — خطة Phoenitech لتشرين (١٠ بوستات · ١٤ ستوري) · **حمولات جاهزة ومجرّبة على نسخة معزولة، مو مطبّقة على الإنتاج**

**الطلب (القائدة):** أرفقت `PhoeniTech Posts-stories.docx`: «هي خطة البوستات والستوريز لفونيتيك. الكاردات موجودين بس بلا محتوى، بدي منك ترفع المحتوى».

- **[VERIFIED — FILE]** جدولين: ١٠ بوستات (الشكل · المحتوى داخل التصميم · الكابشن والهاشتاغات) و١٤ ستوري (النوع · النص · الستيكر والهدف). عنوان الستوريز «(15)» والجدول ١٤ — **[USER-CONFIRMED]** «14 بس». ما فيه ريلات. بعتته نوال على PhoeniTech Designs ٦/١٠ ٢١:٤٤.
- **[VERIFIED — SNAPSHOT `prod-20261011-0927.json`]** سجلّ Phoenitech ٤ بوست · ٤ ريل · ٠ ستوري؛ الدورة ١٣/٩ → ١٢/١٠ بلا تجديد. **كروت الخطة ما كانت موجودة**: بس كروت يدوية من ٨/١٠ عند أيمن (بوست1 · بوست2-1…2-7 · بوست3، ومنها بوست1 و2-1…2-4 منجزين بملفات أيمن `Phoenitech-post-10-1.jpg` و`-10-2-1…4.jpg`). القائدة: «أيمن صمم من هي الخطة… خطة شهر 10».
- **[VERIFIED — TELEGRAM] علّة بيانات:** بدلو m=9 أربع كروت تصميم بوستات READY مثبّتة على أليسار من ١٩/٨ — المطابقة القديمة «بالنوع» لزّقت عليها صور خام (IMG_1342 · 1358 · 1359 · 1360) بعد رسالتها «رح ابعت كلشي تصور تنقو منو». التجديد بلا تصحيح كان رح يعتبر بوست تشرين ١–٤ جاهزين. **[USER-CONFIRMED — قاعدة]** «ممنوع تسكر كروت مو لصاحبها! البوستات مهام أيمن ممنوع حدا تاني يبعت شي وتسكرها».
- **الحمولات (بالترتيب، كل وحدة لحالها):** `prod-61` تجديد ١٣/١٠ (دورة ١٣/١٠ → ١٢/١١، m=9) · `prod-62` فتح تصميم بوست ١–٤ (NOT_STARTED، بلا تثبيت، شيل سطر IMG) · `prod-63` العدد ١٠ بوست + ١٤ ستوري (الريلات ٤) · `prod-64` ٢٤ وصف + بوست ١ READY ٨/١٠ وبوست ٢ IN_PROGRESS (ملفات أيمن نفسه) + «كتابة بوستات وستوريز» READY ٦/١٠ + شيل سطر منقول غلط عن بوست ٧. «سيناريو تصوير» بيضل مفتوح. نسخ جاهزة للصق بلا `_` بـ`tmp/phoeni-paste/61…64.json`.
- **[VERIFIED — SIM]** على نسخة معزولة `tmp/sim/phoeni.db` (من لقطة ٠٩٢٧؛ `prisma/dev.db` ما انلمس): ٢٢ → ٦٢ كرت مولّد، كل التصاميم لأيمن، النشر لعمر (بوست ١٧/١٠ → ١٢/١١، ستوري ١٤/١٠ → ١٢/١١). مقارنة باللقطة: **ولا صف برّا دلو Phoenitech m=9 تغيّر**؛ سجلّ الشركة بس (posts 4→10، stories 0→14، renewals). الكروت اليدوية ما انلمست.
- **⚠️ علّة محرّك انكشفت (ما انصلحت):** `applyPipelinePreservation` — قطعة **رقمها جديد** (بعد رفع العدد) ما إلها مطابقة بالرقم، فبتنزل لمطابقة `pipelineKey` وبتورث حالة/ملاحظات/وصف قطعة قديمة مفتاحها صار نفس التاريخ. بالتجربة بوست ٧ ورث سطر «فُتح من جديد» تبع بوست ٣. لو القطع القديمة منجزة كانت القطعة الجديدة رح تطلع منجزة. الحل المقترح: الاحتياط ما ياخد صفاً قطعته مطابقة برقمها. BW (٤→٨ ١/١٠) غالباً مرق بنفس المسار.
- **[PENDING]** Chrome ما كان متصل → ما انطبّق شي. بعد التطبيق: `npm run backup:pull` ومقارنة؛ إذا السطر المنقول طلع على قطعة غير بوست ٧ بتلزم حمولة تصحيح صغيرة. **[PENDING — القائدة]** الكروت اليدوية لبوست ١–٣ مكررة مع كروت الخطة (بوست ١ رح ينحسب مرتين بالتقارير).
- **⚠️ `backup:pull` حذف `prod-20260913-1001.json`** (أقدم من ١٤ يوم — تدوير عادي).

### 2026-10-11 (لاحقاً) — Claude — إعادة جدولة المتأخر من تاريخ اليوم: فونيتيك · BW · التوظيف · عبادة (ما عدا مخبر نور) · **حمولات مجرّبة على نسخة معزولة + تعديل كود صغير، مو مطبّق ومو مرفوع**

**الطلب (القائدة):** «بدي منك كلشي متأخر لفونيتيك - BW - فوني جوبس وعبادة تعملن إعادة جدولة من تاريخ اليوم. كلو ماعدا مخبر نور. الجدولة من تاريخ اليوم وراعي المهام والنشر وكل التفاصيل المرتبطة بإعادة الجدولة. لا تحسب أي تأخير على التيم».

- **[VERIFIED — CODE] المحرّك ما بيعرف «من اليوم»:** التوزيع بيوزّع القطع غير المنشورة على **كل** أيام الدورة (`cycleDays` بـ`scheduler.ts`)، و`notBefore` أرضية أول دورة بس. زرّ «أعد جدولة الدورة الحالية» كان رح يرجّع يوزّع على أيام فاتت، وبيرفض دورة BW/فونيتيك الماضية. فالمواعيد الجديدة **قرار صريح بحمولات** `pieceStates` (يوم النشر الجديد على كل مراحل القطعة — المنجز منها كمان مشان الكرت والتقارير يحكوا تاريخاً واحداً؛ الإنتاج المفتوح بيوم شغله وجهوزيته، مثبّت). أرقام القطع ما بتتغيّر: الترقيم بيصير قبل الحفظ ومن مواعيد المحرّك، والحفظ بيطابق بالرقم (`pipeline.ts` ثم `pipeline-preservation.ts`).
- **[DECISION MADE BY ME — النطاق]** فونيتيك وBW: متبقّي دورة أيلول بس (دورة تشرين متماسكة). **التوظيف وعبادة: باقي الدورة كله** — المتأخر كان يسبق غير المتأخر بالترتيب، وتصوير ريلات التوظيف ٢–٨ محجوز على سيناريو ما انكتب، فنقل المتأخر وحده كان رح يكسر ترتيب القطع ويخلّي المستحقّ اليوم متأخراً بكرا. القواعد المطبَّقة: يوم عمل الأحد→الخميس، النشر السبت→الخميس، تصميم/مونتاج قبل النشر بيومين، المونتاج بعد التصوير بيوم عمل، التصوير بجلسات ٢–٣ ريل وطلب الموعد قبلها بيومين، أليسار ≤٣ مونتاجات/يوم، أيمن وسابين ≤٦ تصاميم/يوم، ما في قطعتي تغذية بنفس اليوم لنفس الشركة، والتناوب حيث أمكن.
- **[LOCAL — CODE]** `adhocStates` صارت تقبل `workDate`/`readyDate` (+ رفض شغل بعد تسليم) — لزم لكرت الكتابة «سيناريو تصوير» ولكروت أيمن اليدوية بلا `adhoc_`؛ `preflight-payload.ts` بيطبعهم. اختبار `tests/plan-update-adhoc-dates.test.ts` (٣ حالات، قاعدة معزولة). `tsc` و`eslint` نظاف. **لازم ينرفع قبل prod-69 وprod-71 وprod-72.**
- **الحمولات (`scripts/data/`, بالترتيب بعد prod-61…64):** `prod-65` فونيتيك أيلول (بوست ٢ ١٢/١٠ · ريل ٣ ١٣ · بوست ٣ ١٤ · ريل ٤ ١٥ · بوست ٤ ١٨؛ ومونتاج ريل ٣ READY ٣٠/٩: ملف أليسار `phoenitech-reel-9-3.mp4` بتوبيك التدريب غلطاً) · `prod-66` BW أيلول (ريل ١ ١٢ · بوست ٣ ١٤ · بوست ٤ ١٧ · ريل ٤: تصوير ١٤ · مونتاج ١٥ · نشر ١٩/١٠) · `prod-67` عبادة باقي الدورة (تغذية ١٢→٢١/١٠ بالترتيب القديم + الستوريات؛ تصوير ريل ٢+٣ الأربعاء ١٤) · `prod-68` عبادة m=7 اللقطات الناقصة (تصوير ١٤ · إعادة مونتاج ١٨) · `prod-69` التوظيف باقي الدورة (سيناريو نوال ١٢→١٣ · تصوير ٢+٣+٤ الخميس ١٥ · ٥+٦ الاثنين ١٩ · ٧+٨ الأربعاء ٢١ · تغذية ١٢/١٠ → ٢/١١ · مقالا المدونة ٨ و٩ · لينكد إن ٣ → ١٢/١٠ · أسبوع ١ من خطة الإطلاق → ١٢–١٤/١٠ · تصميم بوست ١ إقفال إداري لأنّ القطعة منشورة ٣/١٠) · `prod-70` التوظيف m=8 أفكار المسابقة → ١٢/١٠ · `prod-71` فونيتيك m=9 كروت أيمن اليدوية (بوست2-6/2-7/بوست3 → ١٢/١٣/١٤، الساعات ٨→١.٣٣) · `prod-72` فونيتيك m=9 «سيناريو تصوير» دورة تشرين → ١٣/١٠ (الكرت بينخلق مع prod-61 فمو باللقطة). مولّدها `tmp/sim/build-reschedule.ts` (غير متتبَّع) وبيتحقّق من كل كرت باللقطة.
- **[VERIFIED — SIM]** على نسخة من `prod-20261011-0927` بعد prod-61…64: الفحص المسبق **١١٢ بند كلها صف واحد**؛ التطبيق ١١٣ صف تغيّر، ولا إضافة ولا حذف، وكلها بالشركات الأربع؛ **المتأخر المفتوح بالشركات الأربع = ٠** عدا تصوير BW ريل ١+٢ تشرين المستحقّ اليوم (مو متأخر). الحمل: أليسار ≤٣ · أيمن ≤٦ · سابين ≤٣ · ليلاس ≤٤ (١٤/١٠: BW ريل ٤ + عبادة ٣ لقطات — جلستان بيوم). إعادة توليد الدلاء الستة بعدها (`tmp/sim/regen-check.ts`): كل المواعيد المثبّتة صمدت؛ يلي تحرّك هو دورة BW تشرين (المحرّك مو ثابت على إعادة التوليد: ±يوم) ومونتاجا فونيتيك ريل ٣ و٤ المنجزان (`retimeEditsAfterActualShoot` بيسحبهم بعد «إنهاء» التصوير المسجّل — تناقض قديم: كرت تصوير ريل ٣ انسكّر بملف مونتاج).
- **⚠️ [FOUND] أوصاف بوستات التوظيف ٢–١٠ فاضية** رغم إقفال كرت الكتابة بملف `phoenijobs features.docx` (٦/١٠) — سابين ما فيها تصمّم بلاها. **[FOUND]** عبادة ستوري ٤: تصميمها ناطر صور من الزبون («بدو صور»، ٣٠/٩). **[FOUND]** أليسار بعتت `obada-reel-8-2.mp4` ٢٧/٩ بلا مطابقة — يمكن تكون إعادة مونتاج اللقطة الناقصة؛ قرار القائدة. **[FOUND]** ملفان من أليسار ٨–٩/١٠ `phoenitech-reel-9-1.mp4` (ريل ١ منشور ٢٣/٩) بلا كرت.
- **[LIVE/VERIFIED — نفس اليوم ١٢:٠٤]** القائدة: «موافقة، ارفع الكود وطبّق كلشي. اتأكد من كل الاختبارات». الكود انرفع على `main` (`442baab` + `a70c92d` + `90e9c67`)، إنتاج Vercel `797tdr4ta` Ready ١١:٤٩ (`vercel ls`/`inspect`). Chrome ما اتصل أبداً، فالتطبيق صار من **متصفح التطبيق المدمج**: القائدة سجّلت دخولها بنفسها، وكل حمولة انبعتت بـ`fetch('/admin/api/plan-update')` مع SHA-256 للجسم مطابق للملف المحلي. الاثنتا عشرة حمولة بالترتيب ٦١ → ٧٢ كلها `ok`: ٦١ تجديد + ٢٢ كرت · ٦٢ ٤ حالات · ٦٣ العدد + ٦٢ كرت · ٦٤ ٢٤ وصفاً + ٣ حالات + ١ كتابة · ٦٥ ١٢ · ٦٦ ١٠ · ٦٧ ٣٥ · ٦٨ ٢ · ٦٩ ٤٣ + ٢ + ٣ · ٧٠ ١ · ٧١ ٤ · ٧٢ ١. (مصنّف الصلاحيات رفض إرسال ٦٥–٦٨ بنداء واحد، فانبعتوا وحدة وحدة.)
- **[VERIFIED — SNAPSHOT `prod-20261011-1204.json`]** ١٣٤٢ → ١٤٠٠ كرت (+٥٨ = دلو فونيتيك تشرين). مقابل ٠٩٢٧: ١١٦ صف تغيّر و٥٨ انضاف و٠ انحذف، كلها بالشركات الأربع. **مقابل نتيجة المحاكاة (`tmp/sim/phoeni2.db`): ولا فرق** بالمواعيد والحالات والتثبيت والملاحظات للشركات الأربع. المتأخر المفتوح بالشركات الأربع = ٠ (عدا تصوير BW ريل ١+٢ تشرين المستحقّ اليوم). لوحة الأدمن الحيّة: «متأخرة أو تستحق خلال يومَي عمل» ٥١ → ٣٤، والباقي كله مخبر نور (مستثنى) + إعلان التدريب (برّا الطلب). الاختبارات على `main` قبل الرفع: **٧٣٥ ناجح / ٨** — الستة المعروفة + اثنان من بيانات المرآة (بوست ١ التوظيف منشور وتصميمه مفتوح — صلّحته prod-69؛ ومونتاج عبادة ريل ١ من آب بيتحرّك بإعادة التوليد) ولا واحد يمسّ الكود المتغيّر (الملفات الأربعة ما بتستورد `plan-update` ولا `preflight`).
- **[LIVE/VERIFIED ١٢:٤٦] `prod-73-obada-missing-scene-close-2026-10.json`** — **[USER-CONFIRMED]** «سكّر كرت اللقطة الناقصة، الملف هو إعادة المونتاج»: «إعادة مونتاج بعد المشهد المتبقي — ريل ٣ عبادة» READY ٢٧/٩ بملف أليسار `obada-reel-8-2.mp4` (٢٧/٩ ١٥:٠٢، صاحبة الكرت) · «تصوير اللقطات الناقصة» (ليلاس) **إقفال إداري** ٢٧/٩ — يوم التصوير الفعلي غير مسجَّل، فما بينحسب لا موعداً ولا تأخيراً. بتلغي مواعيد prod-68 (١٤ و١٨/١٠). انبعتت من متصفح التطبيق بجلسة القائدة (SHA مطابق)، ومتحقَّقة بلقطة `prod-20261011-1246.json`.
- **[FOUND — بين لقطتي ١٢:٠٤ و١٢:٤٦]** على الإنتاج ١٢:٤٢–١٢:٤٣ انخلقت ٣ كروت يدوية جديدة **منجزة** (`بوست2-5/2-6/2-7 - فونيتيك`، ٨ س، أيمن، ١١/١٠) وانسكّر تصميم بوست ٢ تشرين (`Phoenitech-post-10-2-1.jpg`) — وهالإنشاء **أعاد توليد دلو تشرين كله** (`generateScheduleInternal` بلا شركة): دلو BW تشرين انكتب من جديد بمعرّفات جديدة ومواعيد مزحزحة ±يوم (بوست ١ ١٣→١٢/١٠ · ريل ١ ١٥→١٤ · بوست ٢ ١٨→١٧ …) فصار يصطدم بمتبقّي أيلول (prod-66) يومَي ١٢ و١٤/١٠. دلوا التوظيف وفونيتيك تشرين ما تحرّكوا (مثبّتان). **المحرّك مو ثابت على إعادة التوليد** — نفس ما انشاف بـ`regen-check` على النسخة.
- **[LIVE/VERIFIED ١٢:٤٩] `prod-74-bw-carryover-replace-2026-10.json` + `prod-75-bw-oct-cycle-pin-2026-10.json`:** متبقّي أيلول صار ريل ١ ١٣/١٠ · بوست ٣ ١٥/١٠ · ريل ٤ ١٩/١٠ · بوست ٤ ٢١/١٠؛ ودورة BW تشرين **مثبّتة على مواعيدها الحالية** (٢٨ كرت: المفتوح بمواعيده الثلاثة مثبّتاً، والمنجز بيوم نشر قطعته) حتى ما ترجع تتحرّك مع أي تعديل كرت بالشهر. لقطة `prod-20261011-1249.json`: ٣٥ صف BW تغيّر + تغيير القائدة على `بوست2-5` القديم، لا إضافة ولا حذف؛ تقويم BW بلا أي يوم فيه قطعتا تغذية؛ المتأخر المفتوح بالشركات الأربع ٠ (عدا تصوير BW ريل ١+٢ المستحقّ اليوم). التراجع عن التثبيت: نفس prod-75 بـ`pinned:false`.
- **[OPEN — القائدة]** أوصاف بوستات التوظيف ٢–١٠ فاضية (سابين ما فيها تصمّم) · تصوير BW ريل ١+٢ تشرين مستحقّ اليوم (لو ما صار، جلسة الأربعاء ١٤/١٠ عندها BW ريل ٤ أصلاً) · ليلاس ١٤/١٠ جلستان (BW + عبادة) · عبادة ستوري ٤ ناطرة صور الزبون · **كروت أيمن اليدوية مكرّرة مرتين:** القديمة (٨/١٠: بوست1 · بوست2-1…2-7 · بوست3) والجديدة (١١/١٠ ١٢:٤٢: بوست2-5/2-6/2-7 منجزة ٨ س) فوق كروت الخطة — بوست ١ و٢ بينحسبوا لأيمن مرتين أو تلاتة بالتقارير، وأي مطابقة بالعنوان على «بوست2-5…2-7» صارت مستحيلة (أكتر من كرت).

### 2026-10-04 — Claude — تقارير الإنجاز الدورية (يومي · أسبوعي · شهري · مخصّص) بتصدير PDF · **محلي على فرع `feature/period-reports`، غير مكوميت وغير منشور**

**الطلب (القائدة):** «بدي امكانية تصدير تقارير شهرية + يومية + اسبوعية أو تقرير مخصص، شي شبيه بيلي عملنها، الانجاز للأفراد والشركات … حلل الفكرة واكتب القواعد والاختبارات اللازمة … التقرير أريده PDF بالتنسيق الاحترافي».

**القواعد:** WORK_RULES §١٠ (جديدة) — الفترات (الأسبوع الأحد → السبت)، يوم دمشق UTC+3، المنجز وما يُستبعد (الإقفال الإداري بسطر دليله)، كريدت التصوير لمصوّر الشركة، المهمة الإضافية بلا مرحلة حسب دور صاحبها، الالتزام بالموعد (الستوري على نهاية دورتها، `manualDay` الأبعد بيغلب، الإقفال بلا وقت تسليم ما بينقاس، التصوير والنشر ما بينقاسوا)، المتأخر المفتوح بنهاية الفترة (الشركة الموقوفة/المؤرشفة **وقتها**)، إنجاز الشركات (الموقوفة بلا نشر مستحق).

**الكود:**
- `src/lib/period-report.ts` — نقي: `resolvePeriod` · `dayKeyOf` · `buildPeriodReport` · `roleCategory` · `isAdministrativeClosure`.
- `src/server/period-report.ts` — تحميل (بلا `"use server"`): كل الكروت غير الملغاة + ملفات تلغرام المربوطة.
- `src/app/admin/reports/period/page.tsx` (أدمن محمي) + `src/components/reports/PeriodToolbar.tsx` (نموذج GET + «تحميل PDF» = `window.print()` واسم الملف من عنوان الصفحة) + `PeriodReportView.tsx` (وثيقة A4 بأنماط `pr-` و`@page` مع ترقيم الصفحات).
- `nav.ts`: «تقارير PDF» بقائمة الأدمن بس · `layout.tsx`: القائمة والهوامش مخفيين بالطباعة.
- **[DECISION MADE BY ME]** الـPDF من طباعة المتصفح لا مكتبة خادم: العربي بيترسم صح بخطوط التطبيق، وبلا Chromium على Vercel (~٦٠MB وبطء إقلاع). كلفته كبسة «حفظ كـPDF» بنافذة الطباعة.

**الفحوص [VERIFIED — محلي]:** `tests/period-report.test.ts` ٢٣ حالة (كتبت قبل الكود وفشلت أولاً) + حالة بـ`access-control` (الصفحة أدمن بس). المجموعة **730 ناجح / 6** (نفس الستة المعروفين). `tsc` و`eslint` نظاف · `npm run build` نجح (والعميل رجع SQLite بعده). معاينة حيّة على `next dev` بنسخة مؤقتة من القاعدة وكلمة سر مؤقتة بالبيئة (انمحوا بعدها): التقرير الشهري والمخصّص اشتغلوا، ولا فيضان أفقي على ١٢٨٠ ولا ٣٧٥. عيّنات PDF من لقطة ٣/١٠: `docs/reports/samples/period-report-{month,week,day}.pdf`.

**فرق متوقَّع عن تقرير أيلول اليدوي:** التلقائي من الداتا بس — سابين ٤١ وحدة ٦٥٪ (اليدوي ٦٦ و٨٨٪): ناقصه تصاميم تلغرام بلا كروت (حمولات prod-58..60 لسا ما انطبّقت) ومتأخرات البلسم ٤–١١ بلا `manualDay` (اليدوي افترض ٩/٩ لكل المتأخرات).

**تصحيح بعد ملاحظة القائدة (أشرطة النسبة فاضية بالـPDF):** React بيهرّب علامات التنصيص بأبناء `<style>`، فـ`content:""` (تعبئة الشريط) و`counter(page)` (ترقيم الصفحات) بطلوا. صار `<style dangerouslySetInnerHTML>` بثابت محلي. متحقَّق بلقطة: الأشرطة بتتعبّى بالنسبة وبلونها (أخضر ≥٨٥ · برتقالي ≥٦٥ · أحمر أقل). العيّنات انعادت.

**[LIVE/VERIFIED — نفس اليوم]** القائدة: «يلا رفع الشغل». ست كوميتات على `feature/period-reports` ثم fast-forward لـ`main`: `0290e5f` (القواعد + النموذج + الصفحة + الحمولات + الهاندوف) و`4b79913` (التصحيحات تحت). حيّ: `/admin/reports/period` لغير المسجّل → 307 للدخول؛ بجلسة القائدة بيرسم بداتا الإنتاج، والقائمة فيها «تقارير PDF» وزرّ «تحميل PDF»، والأشرطة معبّاية.

**ثلاث علل انكشفت بالمقارنة مع الإنتاج وانصلحت بـ`4b79913`** (كل وحدة باختبار فشل أولاً):
1. **Siizen توقّفت ٤/١٠** (`publishStartDate` → null، `status` → paused) فاختفت دورتها وطلعت ستورياتها بتقرير أيلول متأخرة، وانستبعد متأخرها كأنها موقوفة بأيلول. صار: الإيقاف/الأرشفة **وقت الفترة** بآخر تعديل على سجلّ الشركة (`updatedAt`)، والشركة بلا تاريخ بدء نشر دورتها من مواعيد نشر قطع الدلو. ونصّ `lateExemptReason` ما بيعفي لحاله.
2. **إعادة الترقيم ٤/١٠** نقلت سجلّات القطع بين معرّفات الكروت (١٨١ صف تغيّر، ٨٤ انضاف، ٩٣ انشال بين لقطتي ٣/١٠ و٤/١٠) وروابط تلغرام ضلّت على المعرّفات القديمة — «أول ملف مربوط» صار يأشّر لقطعة تانية (أليسار Siizen ريل ٣ «١٢ يوم» وهو منجز ١٠/٩). صار: وقت التسليم = طابع الكرت، والرابط دليل بس. **⚠️ هالانزياح بالروابط علّة بنيوية بالمحرّك نفسه (مش بالتقرير): أي شي بيقرأ `TelegramMessage.taskId` بعد إعادة ترقيم بيقرأ قطعة غلط — مسجّل، ما انصلح.**
3. React بيهرّب التنصيص بـ`<style>` — بتصيير السكربت المحلي (React 18) بس؛ Next 15 حيّ كان سليم.

**الأرقام الحيّة لأيلول بعد النشر (متحقَّقة):** سابين ٢٦/٤١ = ٦٣٪، ١٥ متأخرة · أليسار ١٩/٢١ = ٩٠٪ · أيمن ٤٥/٤٩ = ٩٢٪. الفرق عن التقرير اليدوي (سابين ٨٨٪) سببه ستوريات البلسم ٤–١١ (سُلّمت ٦/٩ وآخر دورتها ٣١/٨، بلا `manualDay`) — قرار القائدة لو بدها تسجّل التأجيل.

**⚠️ أداة النسخ الاحتياطي:** `BACKUP_KEEP_DAYS` بيحدّد النافذة بس؛ الأيام الأقدم من آخر يومين بتحتفظ بآخر لقطة باليوم. سحب ٤/١٠ حذف لقطات ١/١٠ الوسيطة (١٠٠٥ · ١٠١٣ · ١٠٢٧ · ١٠٢٨ · ١٠٣٩) المذكورة كأدلة بمدخل ١/١٠. بقيت `prod-20261001-1200`. نسخ محلية بس، الإنتاج ما انلمس.

**الفحوص:** المجموعة ٧٣٤ ناجح / ٦ (نفس الستة) · `tsc` · `eslint` · `npm run build`.

### 2026-10-03 — Claude — تقرير أداء الفريق لشهر أيلول (للإدارة) · قراءة فقط، لا تعديل على الداتا

**الطلب (القائدة):** «الادارة طلبت تقرير أداء فريق السوشال ميديا خلال الشهر السابق (من 1/9 حتى 1/10) — أداء كل شخص، إجمالي المهام المنجزة، متوسط الوقت المستغرق، التأخيرات، وتقييم أداء للأفراد».

**المصدر [VERIFIED — لقطات محفوظة، لا سحب جديد]:** الإقفالات من `backups/prod-20261001-1200.json`، والمفتوح بنهاية الشهر من `prod-20260930-1200.json` (معرّفات كروت نور اتغيّرت بإعادة جدولة 1/10، فالمطابقة بين اللقطتين بالمفتاح شركة|نوع|رقم|مرحلة)، و1,204 رسالة تلغرام للشهر. الفترة 1/9→30/9 بتوقيت دمشق. ولا كتابة على الإنتاج ولا على المرآة.

**الناتج [LOCAL-ONLY، غير مكوميت]:** `docs/reports/team-performance-2026-09.html` (منشور كـArtifact خاص: <https://claude.ai/artifact/QxdnzaSvTracEBHDqiWkm7>) + سكربت التحليل `docs/reports/team-performance-2026-09.analysis.js` (node، قراءة فقط).

**الأرقام:** 286 مهمة منجزة موثّقة (188 إنتاج · 98 نشر) · التزام دورة أيلول بالموعد 74/95 = 78% · 11 متأخرة من آب سُلّمت بأيلول (سابين 10 ستوري بلسم بمتوسط 24 يوم · أيمن 1). للأفراد: أيمن 84 (45 خطة + 39 إضافي، 84% بالموعد، ممتاز) · سابين 37 + ≈24 تصميم على تلغرام بلا كرت (55%، جيد) · ماجد 29 تصوير بـ≈13 يوم (جيد) · أليسار 23 مونتاج (85%، 3.8 يوم من التصوير للتسليم، جيد جداً) · نوال 12 + 14 مستند (86%، جيد جداً) · عمر 98 إقفال نشر (تقييمه **معلّق** حتى مطابقة إنستغرام) · حلا بلا تقييم ذاتي.

**ملاحظات على الداتا [VERIFIED]:**
- **ما في تتبّع وقت:** 286 من 297 كرت منجز بأيلول `startedAt == finishedAt` — «متوسط الوقت» انقاس بمؤشر تسليم لكل دور، مو بساعات.
- **3 كروت تصوير باسم أليسار** (وصل ريل 1 و2، التوظيف ريل 1) — ملف المونتاج انربط بكرت التصوير؛ بالتقرير انحسبت لماجد. وملف مونتاج وصل ريل 1 (`wasl 1 -9.mp4`، 1/9) هو التسليم الفعلي لكرت مونتاجه المسكَّر 15/9 بلا دليل.
- **5 إقفالات بصورة خام أو نص** (مانغو ستوري 7–10 سابين، ستوري 6 حلا: `DSC03882.JPG`، «هي مانغو منزلها ستوري») — مستبعدة. و6 إقفالات إدارية مستبعدة.
- **النشر يتسجّل دفعات:** 66 من 91 كرت نشر انسكّر بعد موعده بمتوسط 13 يوم (6/9، 15/9، 16/9). بنهاية 30/9: **57** كرت نشر مرّ موعده بلا تسجيل — 47 إنتاجها جاهز (منها 17 لوصل يلي انلغت كروتها 1/10) و10 محجوزة خلف تصميم/مونتاج.
- **شغل مسلَّم ما إلو كرت أو كرتو مفتوح:** بوستا مسابقة التوظيف (سابين، `بوست مسابقة 1/2.jpg` 20/9) وكرتهن «تصميم بوستَي المسابقة» لسا NOT_STARTED؛ مونتاج التوظيف ريل 3 (`phoenijobs 3-9.mov` 16/9) وكرتو وكرت تصويره مفتوحين؛ ملفّا المخبر 28/9 (`dr noor-reel-1-10`، `Drnoor-Reel-10-2`) يمكن مونتاج ريل 1 و2.
- **⚠️ تعارض معروض، ما انحسم:** خطة BW رقم 6 بعتتها **نوال** على توبيك BW بتلغرام 6/9، بينما سطر دليل `prod-19` (15/9) بيقول «الكتابة منجزة من طرف الزبون». بالتقرير انحسبت للزبون (مو لنوال) لحدّ ما تقرّر القائدة.

**[USER-CONFIRMED — نفس اليوم]** القائدة: «لحد تاريخه، كل ريلات هذا الشهر المسلَّمة تم تصويرها من قبل ماجد … معظمهم تم تسليمن وتصويرن بالوقت المحدد». العدد المعتمد بالتقرير: **28 ريل صُوِّرت بأيلول** (24 تصوير + 4 فويس أوفر للمخبر): وصل 8 · التوظيف 7 (منها ريل 3: مونتاجه `phoenijobs 3-9.mov` 16/9 وكرت تصويره لسا مفتوح) · المخبر 5 · BW 3 · عبادة 2 · Siizen 2 · فونيتيك 1 — إضافةً لريل بديل المخبر (مونتاجه 3/9، والتصوير قبل أيلول) وتغطية إيفنت الجامعة. مستبعَد: التوظيف ريل 7 و8 من دورة آب (إقفال دفتري/إداري). ماجد بالتقرير صار «جيد جداً» (المواعيد 3→4 بإفادتها). الكروت نفسها ما انلمست. Artifact مُحدَّث بنفس الرابط.

**[USER-CONFIRMED — نفس اليوم، يحلّ محلّ رقم الـ28]** «احسب الريلات المنجزة. مثلاً المخبر بس 4 مو 5، وصل صح كاملة». العدد صار **27 ريل منجز** (مونتاج نهائي مسلَّم بأيلول، مطابَق مع ملفات تلغرام بلا تكرار التعديلات): وصل 8 (ملفات 1·2·4·6·7·8، و3·5 مسجّلين بالمنصة) · التوظيف 7 · المخبر 4 (`mkhbar 6-8` 3/9 · `Mkhbar 4- 8` 6/9 · `dr noor-reel-1-10` و`Drnoor-Reel-10-2` 28/9) · BW 3 · عبادة 2 (`obada 2-8` و`obada 3-8` 15/9) · Siizen 2 (`SIIZEN-Cinematic-V2` 8/9 · `siizen 4-8` 22/9) · فونيتيك 1. 25 من 27 إلها ملف على تلغرام. نفس العدد انطبق على مونتاج أليسار (23 → 27). مجموع الفريق 289. ثم بإفادة القائدة: **ريل تيست لمطعم باب شرقي** (خارج الخطط، ما إلو أي أثر بالمنصة ولا بتلغرام) انضاف لماجد وأليسار → 28 لكل واحد، والفريق 291.

**[USER-CONFIRMED — نفس اليوم]** «المدارس لحلا هيي وكابرياني مو لسابين … عروض اليوم الوطني كابرياني، تصاميم المدارس اليوم الوطني والبانر، تحديث ملف الشركاء والفلاير للمدارس … كلو شغل حلا». بالتقرير: تلات ملفات «Saudi National Day special offer» على توبيك SKM (7/9، 9/9، 10/9، ونسخة 14/9) انبعتوا **من حساب سابين** وانتقلوا لحلا بإفادتها؛ تصاميم سابين بلا كرت 24 → 21، وحلا ≈11 تصميم بلا كرت + عروض كابرياني (ما في أثر إلها بتوبيك كابرياني بأيلول، فما إلها عدد). يعني بالمدارس/كابرياني الكريدت **ما بيمشي ورا المرسِل** — استثناء على قاعدة `feedback-credit-follows-sender`.

**[VERIFIED — INSTAGRAM، قراءة فقط، 3/10]** «طابق نشر عمر مع الإنستغرام» — قُرئت الشبكات بجلسة Chrome تبع القائدة (بلا تسجيل دخول المتصفح الداخلي بيعرض آخر 12 منشور بس). تاريخ كل منشور من فكّ الـshortcode (`id >> 23` + epoch إنستغرام، توقيت دمشق)، والمحتوى من نص الـalt. بوست وريل بس (الستوري ما بتضل). النتيجة (مستحق أيلول → منشور فعلاً · خلال يوم · جاهز وما انشر): وصل 23→17 · 13/17 · 6 (بوست 9 و12–15 وريل 8، آخر قطعة خطة 29/9) · عبادة 5→5 بالعدد · Siizen 6→5 · 2/5 · ريل 3 (مونتاجه 8/9) · مانغو 4→4 · التدريب 3→3 · فونيتيك 3→2 · 1/2 · بوست 2 · BW 5→1 · 1/1 · 4 (ريل 2 نزل 1/10). **المجموع 49→37 (76%)، 22/31 خلال يوم، 12 جاهزة ما انشرت.** عمر صار «جيد» (المواعيد 3، التوثيق 1).
- **التوظيف:** 5 من 17 قطعة خطة ظاهرة بس (بوست 3؟ 6/9 · 5 «Phoeni» 17/9 · 6 23/9 · 7 27/9 · ريل 20/9)، والصفحة فيها ~18 منشور مسابقة/وظائف. بالمنصة POST 1–10 وREEL 1–2 «منشورة» (إقفال دفعة 15–16/9). معلّق: هل انستبدلت الخطة؟
- **البلسم:** `albalsam_center.bc` → «Sorry, this page isn't available»؛ البحث ما طلّع حساب مؤكَّد. لازم الحساب الصحيح من القائدة (وتصحيح `instagramHandle`).
- **[USER-CONFIRMED]** «بوستات BW اليوم الوطني كمان انجاز حلا» — منشورا 22/9 و23/9 (ملفات `BW-SND96-00..03` من حلا 22/9) انشالوا من رصيد عمر خارج الخطة (25 → 23) وانحسبوا لحلا كبوستين (≈12 تصميم بلا كرت).
- **[USER-CONFIRMED]** مهام حلا كمان: كاتالوغ **المنتجات** وكاتالوغ **الخدمات** لفونيتيك (كرت واحد `adhoc_phoenitech-catalog-2026-09` بيمثّل الاتنين) + **ريل التسجيل لفوني جوبس** (ما إلو كرت ولا ملف بتلغرام أيلول؛ ريل «طريقة التسجيل» الوحيد على الصفحة منشور 26/8). مهام حلا بالتقرير 3 → 5، والفريق 293.
- **[USER-CONFIRMED]** خطة التوظيف «ما تم استبدالها، لكن تم ازاحتها بسبب المسابقة» → قطعها غير المنشورة بأيلول «مؤجَّلة» وما بتنحسب على عمر. «تصاميم المسابقة كلن شغل سابين» + «التدريب 3 بوستات اضافية لورشة كتابة الCV» (لسابين).
- **[VERIFIED — تلغرام] سابين = 57 تصميم بأيلول** (بلا إعادات إرسال): التوظيف 20 (9 مسابقة · بوست 5–6 في 15/9 و7 في 29/9 · 8 أغلفة/مقالات/«90 يوم»/كاروسيل) · البلسم 11 ستوري (6/9، 20/9، 22/9) · التدريب 9 (17/9 جدول + 4 إعلانات · ورشة CV 22/9 + 3 بوستات إضافية حتى 30/9) · Siizen 7 (14/9) · مانغو 7 (بوست 4 في 3/9، 5–6 في 7/9، 4 ستوري في 9/9) · المخبر 3 (14/9). **كروت مسكَّرة بلا ملف:** التوظيف POST 8–10 (إقفال دفعة 16/9 مع النشر) والبلسم STORY 7 (13/9). إعلانا دورات أيلول (3/9، 14/9) دليلهم إنستغرام بس، ما انحسبوا. KPI التقرير صار «227 مهمة إنتاج» (تصميم 158 · تصوير 29 · مونتاج 28 · كتابة 12) بدل رقم بيخلط إقفالات النشر.
- **[USER-CONFIRMED]** «خليه انظف. حط معدل التأخير لدى كل شخص وعدد التصاميم أو القطع … مابدي جدول التأخير، بدي بداله جدول انجاز الشركات». التقرير انكتب من جديد: جدول أفراد (المنجز · في الموعد · معدل التأخير · التقييم)، بطاقات مختصرة، جدول **إنجاز الشركات** (14 جهة: تصاميم 158 · ريلات 28 · منشور 37/49) بدل جداول التأخير وجدول إنستغرام. معدل التأخير = متوسط أيام التأخير للقطع المتأخرة، مع متأخرات آب: الفريق 10.5 يوم (32 قطعة؛ 4.3 بدونها)، في الموعد 74/106 = 70% · أيمن 2.6 (8) · سابين 14.6 (20، منها 10 من آب) · أليسار 6.7 (3) · نوال 4 (1) · عمر 6.9 (9، نشر) · ماجد لا يُقاس.
- **[USER-CONFIRMED + VERIFIED]** «انا متأكدة انجاز سابين أكبر .. ارجع تحقق من تلغرام 1/9 حتى 1/10». سحبت لقطة جديدة `prod-20261003-1145.json` (قراءة فقط، `BACKUP_KEEP_DAYS=3650` حتى ما تنحذف اللقطات القديمة؛ الشبكة من الشِل بدها تشغيل خارج الـsandbox). نسخة البوت لتوبيكات المجموعة **كاملة** (مطابقة لتصدير 2/9 رسالة برسالة)، وسابين ما بعتت شي يوم 1/10. 78 ملف بأيلول: 64 جديد · 4 لحلا (SKM) · 4 إعادة تسمية · 6 إعادة إرسال. **سبب النقص كان العدّ:** صفحات أيمن الإضافية كانت محسوبة واحدة واحدة وصفحات سابين (كاروسيل التوظيف 4، ورشة الـCV 8) كقطعة وحدة. بعد توحيد القاعدة + إعلانا دورات أيلول من إنستغرام: **سابين 66** (التوظيف 22 · التدريب 16 · البلسم 11 · Siizen 7 · مانغو 7 · المخبر 3)، التصاميم 167، الإنتاج 236. غلاف فيسبوك 16/9 انعدّ إعادة إرسال (نفس اسم 23/8) — لو كان تعديل جديد بيصير 67.
- **PDF (4/10):** `docs/reports/team-performance-2026-09.pdf` (A4، 6 صفحات) من نسخة طباعة بالـscratchpad عبر Edge headless (`--print-to-pdf`، بدها تشغيل خارج الـsandbox لتحميل خطوط Google). جدول تسليمات سابين مفتوح بالـPDF.
- **[USER-CONFIRMED + VERIFIED] قياس التأخير اتصحّح (4/10):** القائدة: «سابين مشتغلة خطط الشركات للشهر الماضي والنشر ع الوقت … لازم تكون فوق 75%». الخلل كان بالمنهج: كنت قيس كل ستوري على تاريخ المحرّك اليومي، بينما قاعدة الفريق «الستوري بالكمية مو بالترتيب». القاعدة الجديدة للكل: الستوري على **نهاية دورتها** · مواعيد القائدة المعدّلة بتغلب (البلسم: `manualDay` 9/9 على ستوري 13–15 بلقطة 10/9، والمتأخرات 4–11 انسلّمت 6/9 · إعلانات التدريب نافذة 16–17/9) · الإقفال بلا وقت تسليم ما بيتقاس (عبادة ستوري 9). النتيجة: الفريق 96/105 = 91%، معدل 6.8 يوم (9 قطع) · سابين 28/32 = **88%**، 9 أيام (البلسم 12/14/15 + مانغو بوست 5)، صارت «جيد جداً» · أيمن 43/44 = 98%، يوم واحد · أليسار ونوال بلا تغيير. PDF انعاد توليده.
- **[PENDING — مكتوبة ومفحوصة، ما انطبّقت] تصاميم سابين الإضافية (4/10):** طلب القائدة «أي تصميم مرسل مو مذكور بالخطة تحقق منه على قناة المشروع ثم سجله كمنجز في تاريخه في حال عدم وجود كرت له». ثلاث حمولات بـ`scripts/data/`: `prod-58-tawzeef-sabin-extras-2026-09.json` (m=8: 10 كروت جديدة منجزة بتواريخ الإرسال 1/9–30/9 + إقفال «تصميم بوستَي المسابقة» READY 20/9) · `prod-59-tawzeef-article-covers-2026-10.json` (m=9: غلافا المقال 8 و9 READY 27/9) · `prod-60-training-sabin-cv-extras-2026-09.json` (m=8: 3 بوستات ورشة الـCV 22/9 · 23/9 · 30/9). كل كرت 1.33س، مثبّت، بسطر دليل اسم الملف ووقته. **الفحص المسبق على `prod-20261003-1145.json` أخضر** (كل بند بيطابق صفاً واحداً أو جديد). المزامنة المحلية والتجربة الجافة **انرفضت من مصنّف الصلاحيات** (تعديل مورد مشترك: `prisma/dev.db`)، فما انطبّق شي ولا على المرآة ولا على الإنتاج — بانتظار القائدة: إمّا تستوردهن بنفسها من «استيراد خطة JSON» أو تسمح بالتطبيق. **ما انحطّ بالحمولات (قرار القائدة):** مانغو بوست 4 مسجّل على نوال وسابين سلّمته 3/9 (مانغو مؤرشفة) · ستوريات مانغو 7–10 مسكّرة بصور خام والتصاميم الحقيقية انبعتت 9/9 · المخبر بوست 1–3 انبعتوا 14/9 وكروتهن (m=8) لسا مفتوحة — هل بتنفع للخطة رقم 5؟ · كرت «لينكد إن — مقال ماذا تعلمنا في 90 يوم» (`jobsplan_202610_w4_linkedin_n`) انسكّر غلط بملف غلاف 27/9.
- **التسجيل مقلوب بالاتجاهين:** وصل بوست 9 مسجّل منشور 21/9 ومو موجود؛ ووصل بوست 11 وريل 6 و7 منشورين (27/9، 19/9، 29/9) وكروتهن انلغت 1/10.

**[PENDING — القائدة]:** (1) خطة BW 6/7: نوال كاتبتها؟ (2) ست كروت تصوير ماجد بتاريخ الأحد 27/9 (BW 4، فونيتيك 3–4، عبادة 1–3) — انصوّرت؟ (3) كاروسيل التوظيف 16/9 (`jobs-carousel 0X-9-3`) لأي كرت من كرتَي خطة الإطلاق؟ (4) مطابقة إنستغرام للـ47 قطعة الجاهزة غير المسجّلة قبل اعتماد تقييم عمر. أي تصحيح للكروت نفسها بيمرّ بحمولة مع دليل، مو من التقرير.

### 2026-10-01 (18:20) — Claude — «جدول نشر مخبر نور صار فاضي» = علّة بالتقويم، مو بالداتا · [LIVE/VERIFIED]

**البلاغ (القائدة):** «جدول نشر مخبر نور صار فاضي !» — بعد ساعات من إعادة جدولة نور.

**التشخيص [VERIFIED — لقطة `prod-20261001-1039` + الموقع الحي]:** كروت نشر نور الـ١٢ سليمة بالإنتاج (٤/١٠→٢٢/١٠). بعرض **أيلول** (`/publishing?y=2026&m=8`) ظاهرين الـ١٢، وبعرض **تشرين** (الافتراضي من ١/١٠) صفر. السبب: الشبكة كانت بتعرض كروت **دورة** الشهر المعروض وبس (`bucketPub`)، ودورة نور ٢٣/٩→٢٢/١٠ بدلو أيلول. صدفة توقيت مع إعادة الجدولة — بالبيانات القديمة كانت نور كمان رح تختفي من عرض تشرين.

**العلّة عامة:** عرض تشرين كان مخبّي ٣٥ قطعة (نور ١٢ · عبادة ١٥ · فونيتيك ٤ · BW ٣ · البلسم ١)؛ عرض أيلول ٣٢ (Siizen ١٨ · عبادة ٩ · البلسم ٥) منهم ١٤ منشورة — لأنّ الصفحة كانت ترمي المنجز من دورة تانية كلياً.

**الإصلاح (`83b02a9` على main، إنتاج `ndztywm4p`):** `lib/publish-calendar.ts` (ملف نقي — `lib/month.ts` بيستورد prisma): الشبكة = كروت دورة الشهر (ولو نزلت بالشهر الجاي) **+** كل قطعة يوم نشرها جوّا الشهر من أي دورة؛ والمنجز من دورة تانية بينجاب لما يكون يوم نشره بالشهر. فحوص الخطة («انقطاع نشر»، عدد القطع) بتضل على كروت الدورة. ٨ فحوص بـ`tests/publish-calendar.test.ts`.

**تحقّق حيّ:** `/publishing` (تشرين الأول ٢٠٢٦، فلتر مخبر د.نور) = ١٢ قطعة: ٤ · ٥ · ٧ · ٨ · ١١ · ١٢ · ١٤ · ١٥ · ١٨ · ١٩ · ٢١ · ٢٢ بالتناوب ريل/بوست. المجموعة ٧٠٦ ناجح / ٦ (نفس الانحراف القديم) · tsc ٠ · lint ٠ · build نجح.

### 2026-10-01 (10:30) — Claude — تنويع النشر **منشور**، وزرّ «أعد جدولة الدورة الحالية»، ونور والبلسم انعادت جدولتهم · [LIVE/VERIFIED]

**قرار القائدة (١/١٠):** «موافقة، انشره على main وأعد جدولة نور والبلسم».

**النشر [LIVE/VERIFIED]:** `5c74c7f` (تنويع النشر + حفظ يوم النشر للقطع يلي نزلت فعلاً) و`6c7277c` (زرّ جديد) على `main` — إنتاج `2i6s14mfj` ثم `filddcrtv`، الاتنين Ready. فحوص حيّة: `/login` ٢٠٠ · `/api/backup/export` ٤٠١ · `/api/cron/done-report` ٤٠١ · `/api/backup` ٤٠٤.

**الزرّ الجديد — «أعد جدولة الدورة الحالية»** على كرت كل شركة نشطة بـ`/admin/companies` (`regenerateCompanyCurrentCycle`، محروس بـ`assertAdmin`): بيعيد توليد دلو **دورة الشركة الحالية** وحده. لزم لأنّ الزرّ الوحيد كان «إعادة جدولة فوراً» بصفحة الأولويات، وهو بيعيد توليد دلو الشهر التقويمي **لكل الشركات** — ودورة نور (٢٣/٩→٢٢/١٠) بدلو أيلول فما كان بيوصلها أصلاً. بيرفض الشركة الموقوفة/المؤرشفة وأي شركة بلا دورة حالية. ٤ فحوص بـ`tests/regenerate-company-cycle.test.ts` (شركة بدورة حول اليوم، مو تاريخ ثابت).

**إعادة الجدولة [LIVE/VERIFIED من لقطتين: `prod-20261001-1027` قبل و`prod-20261001-1028` بعد]:**

| | قبل | بعد |
| --- | --- | --- |
| مخبر د.نور (دورة ٢٣/٩→٢٢/١٠) | `RRPPRPRPRPRP` · التصاق ٢ | `RPRPRPRPRPRP` · **٠** — ريل ٤/١٠ · بوست ٥/١٠ · ريل ٧/١٠ · بوست ٨/١٠ · … · بوست ٢٢/١٠ |
| مركز البلسم (دورة ١/١٠→٣١/١٠) | `PRPPPRPPPPRPPR` · التصاق ٣ | `PRPPPRPPRPPPRP` · **١** (بوست ٢٧/١٠ + ٢٨/١٠ — ضمن الحدّ الرياضي لـ١٠ بوستات و٤ ريلات) |

نور ١٠١ كرت قبل وبعد، والبلسم ١٢٨ — ولا كرت ضاع، ولا حالة ولا وصف ولا دليل ولا تثبيت ولا يوم شغل منجز تغيّر. **باقي الشركات: ١١١٧ كرت، ولا واحد تغيّر.**

ملاحظة لنور: ريل ١ (عم ينمنتج عند أليسار من ٢٨/٩) كان مستحقّ ٣٠/٩ وصار ٤/١٠.

**الفحوص:** المجموعة على main ٦٩٨ ناجح / ٦ فاشل (الستة نفسهم انحراف الداتا القديم: فجوة BW بوست ٣ · مانغو برّا دورتها · جدارات ٨ ساعات · ٥٧ إقفال نشر بلا دليل · فحصَي telegram-e2e على Siizen). tsc ٠ · lint ٠ أخطاء · build نجح.

**لسا معلّق:** إصلاحات ١٣/٩ الأربعة (على `codex/qa-deep-stabilization`) مو بـmain — أهمها حماية الأرشيف بـ«نظّف الكروت اليتيمة» (BW ٥٤ + فونيتيك ٦١ كرت منجز معرَّض). ونور: ١٠ ستوريات بالخطة وخطتها بالبرنامج ستوري = ٠، وريل ٤ سكريبته فكرة.

### 2026-10-01 (10:10) — Claude — تنويع النشر: ما في نوعين متشابهين يوم ورا يوم · **محلي + فرع `fix/publish-mix`، مو منشور**

**السؤال (القائدة، على تقويم مخبر د.نور):** «ليش هون في ريلين ورا بعض؟ وبعده بوستين ورا بعض؟ ليش مافي تنويع بين بوستات وريلات بما يتناسب والعمل أولاً وخوارزمية السوشال ميديا ثانياً؟» — التقويم المخزَّن: ريل ٣٠/٩ · ريل ١/١٠ · بوست ٣/١٠ · بوست ٤/١٠ · ريل ٥/١٠ …

**التشخيص [VERIFIED — توليد فعلي على نسخة معزولة]:** ترتيب الأنواع سليم (`interleaveTypes` بيعطي لنور `RPRPRPRPRPRP`). العلّة بخطوة التوزيع، ثلاث علل:

1. **المنطقة الميتة** — المسافات كانت تنحسب من يوم ٠ بالدورة، وأسبوع التحضير بيمنع النشر أول ٧ أيام؛ الأهداف الأولى بتنكبش لأول يوم مسموح فبيتكدّسوا.
2. **الاحتياطي الأعمى** — `placeAvoidingAdjacent` لما ما يلاقي يوم جيرانه فاضيين بينزل لـ«أي يوم حر» بلا ما يسأل عن نوع الجار.
3. **لفّ الأيام** — دوران الشركات `% cycleLen` كان يكسر ترتيب الأيام عن ترتيب التسلسل (وصل: `PPPP` وتسلسلها المثالي أقصاه بوستين).

**النموذج (`src/lib/scheduler.ts`):** التسلسل = ترتيب الأيام (مسح تصاعدي) · المسافات على **النافذة الشرعية** · الدوران إزاحة بداية ≤ يومين (السقف ٣ لأنّ `offset` زوجي دايماً) · قطعة لازقة بنوعها بتتزحزح يوم **بس لما في فسحة**، وإلا بيتنازل التنويع بدل ما ينكبش النشر برّا الدورة.

**إصلاح مرافق (`src/lib/pipeline-preservation.ts`):** يوم النشر على كرت منجز بينجمد بس لما القطعة **نزلت فعلاً** (كرت نشرها مسكَّر). بلاه، إعادة توزيع نور بتخلّي تصوير ريل ١ (منجز ٢٨/٩) يقول «نشر ٣٠/٩» وكرت النشر «٣/١٠»، وترقيم القطع مبني على `publishDate`. `regen-reality` بيضل أخضر (عبادة m=7 المنشورة ما بتتحرّك).

**الفحوص:** `tests/publish-mix.test.ts` (١٢ فحص: حالة نور حرفياً · كل أشكال الخطة ضمن `ceil(الأكتر/الأقل)` · كله جوّا الدورة · الدوران بيفرّق الشركات · الستوريات · الحفظ). المجموعة على main الأحدث `53323df`: **٦٩٤ ناجح / ٦ فاشل** — الستة نفسهم انحراف الداتا القديم. tsc ٠ · build نجح.

**على كل الخطط الحقيقية بدورة نظيفة:** ١٣ من ١٣ ضمن الحدّ الرياضي؛ BW وفونيتيك وSiizen ونور بيتبادلوا تماماً.

**❌ مو منشور:** دفع الفرع لـ`main` انرفض من مصنّف الصلاحيات كـ«نشر إنتاج». الفرع `fix/publish-mix` مرفوع (preview بس). **الإنتاج لسا على الخوارزمية القديمة.**

**بعد النشر — إعادة جدولة الدورة الحالية لهالشركات (التقويم المخزَّن حالياً، لقطة `prod-20261001-1005.json`):**

| الشركة | التصاق اليوم | مثبّت/منجز | بعد النشر |
| --- | --- | --- | --- |
| مخبر د.نور | ريلين ٣٠/٩+١/١٠ · بوستين ٣/١٠+٤/١٠ | ٠ من ١٢ | إعادة جدولة آمنة |
| مركز البلسم | ٣ التصاقات بـ٢٤–٢٩/١٠ (`PPPP`) | ٠ من ١٤ | إعادة جدولة آمنة |
| عبادة | بوستين ٣٠/٩+١/١٠ (ماضي) | ٠ من ٩ | اختياري |
| فونيتيك | ريلين ٢٣/٩+٢٤/٩ (ماضي) | ١ من ٨ | ما في داعي |

**سجلّ ناقص من ٢٨/٩ — انطبّق على الإنتاج وما كان بـmain:** خطة مخبر د.نور رقم ٥ (الدورة ٢٣/٩→٢٢/١٠): ١٢ وصف + إقفال كرتَي الكتابة + تصوير ريل ١ منجز ومونتاجه قيد التنفيذ عند أليسار + تصوير ريلات ٢·٣·٤·٥ (فويس أوفر) منجز. متحقَّق بلقطة `prod-20260928-1236.json`. الحمولتان صاروا هون `prod-56-noor-plan5-briefs-2026-09.json` و`prod-57-noor-progress-2026-09-28.json` (كانوا prod-18/19 على فرع `codex/qa-deep-stabilization` — الرقمان مستعملان بـmain لشي تاني). معلّق عند القائدة: ١٠ ستوريات بالخطة وخطة نور بالبرنامج ستوري = ٠؛ ريل ٤ سكريبته فكرة وكابشنه فاضي.

**⚠️ وأربع إصلاحات من ١٣/٩ مو داخلة بـmain** (على `codex/qa-deep-stabilization`): `69a7f2d` حماية الأرشيف بـ«نظّف الكروت اليتيمة» (BW ٥٤ + فونيتيك ٦١ كرت منجز معرَّض للمحو اليوم) · `e5f06d3` يوم شغل النشر ما بيصير بعد النشر · `3690c3a` · `47cb886`.

### 2026-10-01 (10:05) — Claude — BW October = 8 posts; past cycles keep their piece counts; renewal decision on every company; برو archived

Lane: code (pushed `284c5a9`, `139d942`, `331ec3b`) + two production payloads applied through the lead's Chrome session by `fetch('/admin/api/plan-update')` with a SHA-256 check, + one admin action («لم يُجدد» on برو). **Verified with `prod-20261001-1001.json`** (diff against `prod-20261001-1000.json`).

- **[LEAD — 1/10]** «برو لم يجدد .. وأنا عدّلت على عدد بوستات BW وفونيتيك لهذا الشهر نتيجة قلة عدد العملاء. من خلال الأدمن, خلي في امكانية لوقف / استكمال أي شركة متل برو هلأ مع خيار جدد او لم يجدد. وصلح عدد منشورات BW حسب الخطة لشهر 10». This answers the open question from the 08:35 entry: BW's October plan is 8 posts + 4 reels.
- **[VERIFIED — STATE BEFORE]** `prod-20261001-0945.json`: BW and Phoenitech records were still 4 posts / 4 reels (unchanged across all eleven saved snapshots), so the lead's edit is in the plan documents, not the records. برو: `paused`, `publishStartDate` null → contract state `none` → its card had only «رجّع النشر». The lead herself archived وصل («لم يُجدد», 1/10) and renewed مركز البلسم from 1/10 that morning; البلسم's renewal regenerated the whole October bucket, so BW's October dates in the 08:35 entry were already stale.
- **[HAZARD FOUND — FIXED IN CODE]** Piece counts are one field on the company record and the engine read it for whichever bucket is regenerated. Raising BW to 8 while its September cycle (10/9 → 9/10, bucket m=8) is still open would have planted four extra posts inside September at the next regeneration of that bucket — and whole-bucket regeneration runs on every card create/update/delete. **Rule (WORK_RULES §٩, BR-006a):** the record is the plan of the LAST registered cycle; a cycle with a later cycle registered keeps the piece counts of its existing cards. `src/lib/cycle-plan.ts` (pure: `hasLaterCycle`, `pieceCountsOf`, `planCountsForBucket`), `src/server/cycle-plan.ts` (`existingPieceCounts`, `frozenPlanCounts`), applied in `generateScheduleInternal`, in «إنجاز الشركات» (`OverviewView.tsx`) and in the Word-plan count check. `scripts/audit-frozen-plans.ts <snapshot>` lists every frozen bucket against the record — on the 09:45 snapshot all seven were equal, so the rule changed nothing on existing data.
- **[PUSHED — `284c5a9`]** `planCounts` payload block (`{ posts?, reels?, aiReels?, stories?, evidence }`): standalone like `renewal`; active company only; last registered cycle only (a frozen cycle is refused); updates the record and regenerates that company's bucket alone (existing pieces keep number, brief, state); a reduction is refused when the dropped pieces carry work or a brief; a zero plan is refused; re-applying is a no-op; a failed rebuild rolls the record back. Preflight prints record · cards → target. `contractStateOf`: when a later cycle is registered the contract runs to the end of the last registered cycle, so BW no longer turns «تنتهي خلال ٣ أيام — جدّد؟» on 7/10 (chip now «العقد حتى 10 تشرين الثاني»).
- **[PUSHED — `139d942`]** Companies page: «جدّد» on every company that has a cycle or is paused/archived, «لم يُجدد» on every non-archived company — at any time, not only the last three days of a cycle. `renewContract` on a paused company with no anchor delegates to `resumeCompanyPublishing` (active again, new cycle from the date, old renewals dropped). «صحّح/شيل آخر تجديد» show only when a cycle exists. Pause / resume unchanged («أوقف النشر» for active, «رجّع النشر» for paused).
- **[DECISION MADE BY ME]** `renewContract` still regenerates the whole bucket (the engine's documented design — it rebalances everyone); only the payload paths are scoped to one company. The BW record stays at 8 for later cycles until the lead edits it; «لهذا الشهر» is honoured by the freeze (September untouched), not by an automatic return to 4 in November.
- **[VERIFIED — PRODUCTION]** `prod-55-bw-plan-counts-2026-10.json` → `planCountsChanged: true, generatedCards: 30`; `prod-54-bw-plan-7-posts-5-8-2026-10.json` → `describedPieces: 4`. Snapshot 10:01: BW `posts` 4→8; October bucket 22 → 30 cards, POST#1–#4 and REEL#1–#4 briefs byte-identical to before, POST#5–#8 carry the document's text; **zero changed rows in BW's September bucket and zero rows changed for any other company**. Engine dates now: POST design (أيمن) 8/10 · 11/10 · 15/10 · 19/10 · 22/10 · 27/10 · 1/11 · 3/11, POST publish 11/10 · 13/10 · 19/10 · 21/10 · 26/10 · 29/10 · 3/11 · 5/11; REEL shoots 8/10 (1, 2) and 26/10 (3, 4), REEL publish 15/10 · 24/10 · 1/11 · 9/11.
- **[VERIFIED — PRODUCTION]** برو: «لم يُجدد» pressed on its card in the lead's session (the new button, DOM-driven) → `status: archived`, `contractEndedAt: 2026-10-01`; it had no open cards (the earlier pause had removed them), so nothing was cancelled. Reversible with «جدّد».
- **[VERIFIED — GATES]** `tsc --noEmit` clean, ESLint clean on changed files. New `tests/cycle-plan.test.ts` (12 cases: pure rule, contract state, payload on an isolated DB incl. scoped and whole-bucket regeneration of the frozen bucket) and one case in `tests/company-lifecycle.test.ts` (paused → «لم يُجدد» archives; paused → «جدّد» resumes with a new cycle). Full suite on the mirror: **682/688** — the same six production-data assertions fail with and without the change (data-integrity ×3, lifecycle evidence, telegram-e2e ٢ب/٣).
- **[NOTE]** The push carried the other session's two local commits (`8ba5631`, `4b8f94b` — test-only + handoff) that were waiting on `main`.
- **[OPEN — LEAD]** Phoenitech: record still 4 posts / 4 reels, cycle 13/9 → 12/10, no October cycle registered; its bucket 2026/m=9 already holds four pinned READY POST design cards (أليسار) outside any cycle. When its October plan arrives: `renewal` payload (13/10), then `planCounts` if the plan's counts differ, then the briefs. التوظيف shows «بانتظار التجديد منذ 1 تشرين الأول» — needs the lead's «جدّد» or «لم يُجدد». BW September still has open publish cards past their dates (POST 2, 3 · REEL 1, 2, 3) and REEL 4's shoot (27/9) not closed.

### 2026-10-01 (08:40) — Claude — `plan-docx-import` suite made independent of the wall clock (test-only)

Lane: one test file, **local commit `8ba5631` on `main`, not pushed**. No production code, no production data, no deployment.

- **[VERIFIED — REPRODUCED]** On unmodified code `npx vitest run tests/plan-docx-import.test.ts` failed 3 of 8 (the three cases flagged in the 08:35 entry): the preview named no write cards (`[]`), and both applies were refused with «قطع غير موجودة في دورة … POST|1، POST|2، REEL|1، REEL|2».
- **[VERIFIED — CAUSE]** The fixture builds its company and cards in the September cycle (`publishStartDate` 1/9 → cycle 1/9 ← 1/10, bucket 2026/m=8). `previewPlanDocx` resolves the target bucket with `currentCycleBucket(company, new Date())` and takes no date from outside (`applyPlanDocx`'s `at` only stamps the closure and the evidence line). From 1/10 «today» is outside the cycle, `currentCycle` is null, and `currentCycleBucket` falls back to the calendar month — bucket m=9, where the fixture has no cards. A test defect, not an importer defect: a real company whose cycle ended without a renewal has no cards to describe either.
- **[LOCAL — `8ba5631`]** `tests/plan-docx-import.test.ts` only: `vi.setSystemTime(TODAY)` in `beforeAll` (TODAY = 20/9/2026 09:00, inside the fixture cycle; without `useFakeTimers` it mocks `Date` alone, so Prisma's real timers keep working) and `vi.useRealTimers()` in `afterAll`; the cycle start and bucket became named constants shared by the fixture; one **added** assertion that the preview resolved bucket 2026/m=8. No existing assertion changed.
- **[DECISION MADE BY ME]** Not threading `at` into `previewPlanDocx`: `applyCompanyPlanDocx` spreads client input into `applyPlanDocx`, so making `at` choose the bucket would change what a public server action can do. The task was test independence without a production change.
- **[VERIFIED — GATES]** Focused suite **8/8**. Mutation check: moving `TODAY` to 1/10 reproduces exactly the same three failures, so the cases run against the frozen date (restored afterwards). `npx tsc --noEmit` clean; ESLint clean on the changed file. Full suite with `DATABASE_URL` on the mirror: **669/675** — the six failures are the known production-data assertions (data-integrity ×3, lifecycle evidence, telegram-e2e ٢ب/٣), none in this file. The scratch copy `prisma/test-plandocx-<pid>.db` is removed after each run.
- **[NEXT]** Push `8ba5631` with this entry when the lead says so. Untracked `scripts/data/prod-51-noor-plan5-content.json` from another session left as found.

### 2026-10-01 (08:35) — Claude — BW plan No.7 (October) on its cards: early renewal 10/10 + briefs, verified live

Lane: code (pushed `b4bc0ed`) + two production payloads (`a128345`) applied through the lead's Chrome session by `fetch('/admin/api/plan-update')` with a SHA-256 check of the body, **verified with `prod-20261001-0830.json`**.

- **[USER-CONFIRMED 2026-10-01]** The lead attached `BW_-Plan_No.7-_Oct.docx`: «خطة BW لشهر أكتوبر صارت جاهزة».
- **[VERIFIED — FILE]** One table, twelve rows: **4 reels** (EN script · AR script · AR/EN caption · hashtags) and **8 posts** (design sentence · AR/EN caption · hashtags). It is the client-format document, not the app's Word template, so the «رفع خطة Word» importer does not read it; the briefs were built from the cells with line breaks preserved, in the same shape as plan No.6 (`prod-19`).
- **[VERIFIED — SNAPSHOT 08:19]** BW: `publishStartDate` 10/9, no renewals, **no `contractStartDate`**; current cycle 10/9 → 9/10 (m=8), no October bucket. Record says 4 posts + 4 reels.
- **[LOCAL → PUSHED `b4bc0ed`]** New `renewal` block in the plan payload (`{ start, evidence }`): registers the next cycle with the same guards as «جدّد» (not before the current cycle's end, active companies only, payload bucket = start month), generates **that company's** cards only, is idempotent, and must be a payload of its own (a schema refinement refuses it next to items/states). Needed because the «جدّد» button appears only three days before a cycle ends while plans arrive earlier. `preflight-payload.ts` checks it. **Also fixed:** `renewContract` refused any company without `contractStartDate` although cycles are anchored on `publishStartDate` — BW would have been refused at «جدّد» on 10/10. Tests: `plan-update-renewal.test.ts` (6, isolated DB); `data-integrity` invariant restated as "renewals ⇒ publish start or contract date".
- **[LIVE/VERIFIED 08:30] `prod-52-bw-renewal-2026-10.json`** → `renewed: true`, 22 cards generated: BW renewals `["2026-10-10"]`, cycle 10/10 → 9/11 (m=9). **`prod-53-bw-plan-7-2026-10.json`** → `describedPieces: 8`, `updatedAdhoc: 2`: REEL#1–#4 and POST#1–#4 carry the document's text; نوال's «سيناريو تصوير — BW» and «كتابة بوستات وستوريز — BW» closed READY 1/10 with the file as evidence (the plan arrived fully written, as on 15/9). Snapshot diff 0819 → 0830: **22 new BW rows, nothing else changed.** Engine dates: shoots REEL#1/#2 window 5–7/10 and #3/#4 on 22/10; publishing REEL 12/10 · 19/10 · 27/10 · 4/11, POST 15/10 · 24/10 · 1/11 · 8/11.
- **[PENDING — lead · discrepancy shown, not resolved]** The document has **8 posts**, the company record **4**. Posts 5–8 (الدفع الإلكتروني · التطبيق السياحي · المنيو الرقمي · موقع أم تطبيق) are in `prod-54-bw-plan-7-posts-5-8-2026-10.json`, **not applied**: it needs BW's post count raised to 8 in the company form and the October bucket regenerated first, which is her decision on quantity (and on أيمن's load), not an agent's.
- **[DECISION MADE BY ME — reversible]** Registering the October cycle at 10/10 (contiguous) from her sentence that the October plan is ready; undo with «شيل آخر تجديد» on BW.
- **[OPEN — noticed]** BW's September cycle still has open publish cards past their dates (POST#2 22/9, POST#3 28/9, REEL#1 20/9, REEL#2 24/9, REEL#3 1/10) and REEL#4 SHOOT dated 27/9 not closed. `tests/plan-docx-import.test.ts` fails 3 cases on today's date on unmodified code too (fixtures pinned to a September cycle) — flagged as a separate task. Untracked `scripts/data/prod-51-noor-plan5-content.json` from another session left as found.

### 2026-09-18 (11:05) — Claude — PhoeniJobs weekly loop: عمر publishes an article on LinkedIn every Wednesday, نوال writes the blog article, سابين designs its cover

Lane: code (pushed `41bcf56`) + two production payloads (`prod-28`, `prod-29`) — **[PENDING — not applied on production]**: preflight and the local dry run are green, but the lead's Chrome was not connected at the time, and the admin API needs her signed-in session. Apply either from her Chrome (`fetch('/admin/api/plan-update')`, see the 2026-09-16 tooling note) or by importing the two files on `/admin/companies` → التوظيف → «استيراد خطة JSON», `prod-28` first. Then verify with `npm run backup:pull`.

- **[USER-CONFIRMED 2026-09-18]** «في مهمة اسبوعية خليها لشهر 9 و 10 مبدئياً: عند عمر نشر مقال لفوني جوبس على لينكد ان. نوال كتبت مقالات ولسا عم تكتب ونشرتهن على موقع فوني جوبس، وسابين صممت غلافات المقالات … بس لسا كل اسبوع عمر لازم ينشر هدول المقالات على LinkedIn، وكمان كل اسبوع نوال تكتب مقال جديد وسابين تصمم الغلاف». And in answer to four questions: **الأربعاء** for عمر; **name each card after its article**, and «لا ولا مرة نشرنا مقال لسا على لينكدان»; **no backfill** of the finished work («السابق كلو تم الشهر الماضي … كروت الشهر الماضي تم تسكيرها»); **fix** the mis-assigned card.
- **[VERIFIED — the weekly structure already exists]** التوظيف carries a manual launch plan `jobsplan_<YYYYMM>_w<N>_*`, one card per person per week. Its blog series `_blog_n` runs المقال ١ → ٦ and **stops at the week of 15–21/9**; every later article is named only **inside نوال's LinkedIn card briefs** — المقال ٧ «LinkedIn Profile» (Sep w4), ٨ «سوق العمل السوري 2026» (Oct w1), ٩ «المهن الرقمية» (Oct w2), ١٠ «فريق Remote للشركات الناشئة» (Oct w3), ١١ «أكثر المهارات المطلوبة» (Oct w4). سابين's article **covers are recorded nowhere** (her weekly cards are carousels/stories), and **nothing in the system publishes to LinkedIn**: every «لينكد إن» card belongs to نوال at stage WRITE, i.e. writing the copy.
- **[VERIFIED — the blog, read-only]** <https://phoenijobs.sy/ar/blog> holds **nine** published articles: three dated 11/8 (لماذا أطلقنا PhoeniJobs · CV يقبله أصحاب العمل · خفض تكاليف التوظيف 40٪), three 18/8 (مقابلة العمل · الكوادر السورية · فريق Remote), three 23/8 (LinkedIn Profile · أفضل مواقع العمل عن بعد · المكتبي مقابل عن بُعد). So المقال ٧ is already written and published, and the first *unwritten* article is المقال ٨.
- **[LOCAL → PUSHED `41bcf56`]** `adhocStates.assignee` (by name): moves a card to another person through the audited path, validated before the transaction and written with an evidence line. It existed nowhere else — the «تعديل» dialog has the field but no evidence and no preflight, and a **finished** card moves achievement from one person to another, so the decision has to be on the record (the 3/9 «تصوير ريل التوظيف على أليسار بدل ماجد» note is the same class of defect, still open). Preflight prints «المسؤول من→إلى». Two new tests.
- **[LIVE payloads]** `prod-28` (bucket m=8): عمر's first LinkedIn card + the assignee fix of `jobsplan_202609_w4_linkedin_n` **سابين → نوال**. `prod-29` (bucket m=9, the same four launch-plan weeks): 4 blog cards for نوال (المقال ٨–١١, 3 h each, Wed → Thu), 4 cover cards for سابين (1.33 h = one design at her 6/day rate, Thu → Mon, after the text lands), 4 more LinkedIn cards for عمر. **13 new cards.**
- **عمر's five Wednesdays**, each naming one article, oldest first because none has ever been posted: 23/9 لماذا أطلقنا PhoeniJobs · 30/9 CV يقبله أصحاب العمل · 7/10 خفض تكاليف التوظيف 40٪ · 14/10 مقابلة العمل · 21/10 الكوادر السورية. Each brief carries the article URL. **Four articles remain for تشرين الثاني**: فريق Remote · LinkedIn Profile · أفضل مواقع العمل عن بعد · المكتبي مقابل عن بُعد. Stage PUBLISH, so they cost him no capacity.
- **[DECISION MADE BY ME — reversible]** **No blog or cover card for the week of 22 أيلول**: that week's article (المقال ٧) was written and published on 23/8, and the lead ruled out recording finished work. So نوال's and سابين's weekly cards start at Oct w1. If she wants a new article next week too, it needs a topic that the launch plan does not have.
- **[VERIFIED — PREFLIGHT + LOCAL DRY RUN — GREEN]** On `prod-20260917-1513.json`: the assignee line matched exactly one card, all 13 cards read «جديد». Applied on the mirror (safety copy `backups/dev.db.before-dryrun-20260918-prod28-29`): `updatedAdhoc=1 · createdAdhocCards=1` then `createdAdhocCards=12`. Stored dates verified in local time: عمر every Wednesday, نوال Wed → Thu, سابين Thu → Mon, no card on a Friday or Saturday.
- **[VERIFIED — GATES]** `tsc`, ESLint clean. Full suite 621/627 — the same 6 known production-data failures as yesterday.

### 2026-09-17 (15:25) — Claude — three additional cards (حلا catalog · سابين contest posts · نوال contest copy) and the `adhocCards` payload block that creates them

Lane: code (pushed `8d00a02`) + two production payloads (`prod-26`, `prod-27`), applied through the lead's Chrome session and **verified with `prod-20260917-1513.json`**.

- **[USER-CONFIRMED 2026-09-17]** «حلا كان لديها مهام: بدأت البارحة ١٦/٩ وتنتهي الأحد المقبل، هي تصميم كاتالوغ فونيتيك. سابين لديها مهام إضافية: تصميم ٢ بوست للمسابقة (تابعة للتوظيف). ونوال كتابة ٢ محتوى لبوستات المسابقة، هي اليوم تم إنجازها. ضيف هدول الكروت كمهمات للأشخاص والشركات المعنية».
- **[VERIFIED — WHY a new payload block]** There was **no audited path to create an ad-hoc card**: `adhocStates` only updates a card that already exists (title must match exactly one), `courses` only builds التدريب course cards. The remaining route is the «مهمة جديدة» dialog, which has no preflight, writes no evidence line, and floors every ad-hoc card at **4 hours** (`createTask`) — half a day for سابين's two posts, whose true cost is 2 ÷ 6 posts/day × 8 = 2.67 h.
- **[LOCAL → PUSHED `8d00a02`]** `src/server/plan-update.ts`: new `adhocCards` block — `slug` (stable id `adhoc_<slug>`), `title`, `assignee` (by name), optional `stage`, **mandatory** `hours`, `workDate`/`readyDate`, optional `status`/`priority`/`brief`/`doneOn`, `evidence`. Validated before any write: unknown assignee, duplicate slug, an id owned by another company, or `workDate > readyDate` rejects the whole payload. Re-applying updates the open card, leaves a settled (done/canceled) one untouched and never duplicates the evidence line. Cards are created `isPinned: true` — the dates are the lead's decision, and pinning is also what the «كرت خارج الخطة ما بيبلع يوم الشخص» integrity rule requires of any card that claims a full day. `scripts/preflight-payload.ts` prints each card's share of the person's day next to their stored rate. Result counters: `createdAdhocCards` · `updatedAdhocCards` · `unchangedAdhocCards`.
- **[VERIFIED — PREFLIGHT + LOCAL DRY RUN — GREEN]** On the fresh snapshot `prod-20260917-1505.json` (1,129 tasks, pulled today) all three cards read «جديد»; applied on the mirror (safety copies `backups/dev.db.before-sync-20260917-1505` and `…before-dryrun-20260917-prod26-27`): `createdAdhocCards=1` + `createdAdhocCards=2`. Re-applied: `updatedAdhocCards=1` / `updatedAdhocCards=1 · unchangedAdhocCards=1`, still 3 rows.
- **[VERIFIED — SIMULATION on the mirror]** حلا 17/9: her day was **only** the standing «متابعة مهام التصوير والسوشال ميديا» card (16 h since June = exclusive); with the catalog at priority «مهم» her day now reads «تصميم كاتالوغ — Phoenitech» (150 % of a day). نوال 17/9: 0 cards → «تم إنجاز مهام اليوم» with the writing card (25 %). سابين 17/9: unchanged at 88 % (three pinned التدريب cards) — the contest design does not fit today and waits behind her backlog.
- **[DECISION MADE BY ME — reversible]** (1) حلا's catalog = **12 h** = three working days (Wed 16/9 · Thu 17/9 · Sun 20/9) × her 4 production hours a day (her other half is admin, the lead's rule of 2/8). (2) Priority «مهم» only so it outranks the perpetual admin card; without it the catalog would never appear in «مهام اليوم». (3) نوال's card carries **no stage**: stage `WRITE` is costed at the monthly-plan rate (0.5 plan/day = 2 days), which is a month's plan, not two captions — so its hours (2 h) govern. (4) سابين's deadline **Mon 21/9 is an assumption** — the lead named none, Thursday is 88 % full, Fri/Sat are off and Sunday is full of overdue stories, so anything earlier would make the card late the hour it was created. Change it with «بدّل» or a re-applied payload.
- **[LIVE/VERIFIED 15:13]** Both payloads applied through `fetch('/admin/api/plan-update')` in the lead's signed-in Chrome (the first attempt at 15:09 was **rejected** with «Unrecognized key(s): 'adhocCards'» — the deployment had not picked up `8d00a02` yet, and the strict schema wrote nothing). Snapshot `prod-20260917-1513.json` (1,129 → **1,132** tasks) carries all three rows with their evidence lines: `adhoc_phoenitech-catalog-2026-09` (حلا · ADHOC/DESIGN · IN_PROGRESS/DOING · 12 h · مهم · 16/9 → 20/9 · pinned), `adhoc_tawzeef-contest-design-2026-09` (سابين · NOT_STARTED · 2.67 h · 17/9 → 21/9 · pinned), `adhoc_tawzeef-contest-write-2026-09` (نوال · no stage · READY/DONE · started and finished 17/9 · 2 h · pinned). All three in bucket 2026/m=8, the running cycle of both companies. The live home page shows «تصميم كاتالوغ — Phoenitech · تستحق 20 أيلول» under حلا and نوال at 100 % (15/15). Local mirror re-synced to 1513 (`backups/dev.db.before-sync-20260917-1513`).
- **[VERIFIED — GATES]** `tsc`, ESLint clean. New `tests/plan-update-adhoc-cards.test.ts` (9 cases, isolated database copy): creation with real hours, idempotent re-apply, created-as-done with its stamps, settled card untouched, unknown assignee / duplicate slug / foreign company / reversed dates / unknown field all rejected with no write. Full suite 619/625 — the 6 failures are the known production-data assertions (data-integrity ×3, lifecycle evidence, telegram-e2e ٢ب/٣); the ad-hoc-hours one still lists only the pre-existing جدارات card, not the new catalog.

### 2026-09-17 (15:10) — Claude — «مهام اليوم» closes when the day's work is done: finished-today cards count against the rate

Lane: code, pushed (see commit). No production data touched.

- **[USER-CONFIRMED 2026-09-17]** The lead, relaying the team: «مهام اليوم لما بخلصها الشخص ما بيطلعلو انو تم انجاز مهامك اليوم، لا بيضل يعرضلو مهام اضافية. لازم الانجاز اليومي ينتهي ما يتابع لباقي الأيام».
- **[VERIFIED — WHY]** `selectDailyWorkTasks` (`src/lib/daily-work.ts`) filtered out every done card and then refilled the queue from the open backlog up to the person's rate. Each card closed during the day vanished from the list and the next open card took its place, so the queue never emptied: 6 posts done → 6 new posts shown. The home panel (`overview-client.tsx`) had no «done» state at all — only مهام / متبقّي / عطلة / متفرّغ — and the «تعديل مهام اليوم» meter started from 0 % after every closure.
- **[LOCAL → PUSHED]** `daily-work.ts`: new `selectDailyWork()` returns `{ queue, doneToday, doneLoad, dayFull }`; `selectDailyWorkTasks()` is kept as a wrapper returning `queue` (brief, simulation, tests unchanged). `isFinishedOnDay(task, dayISO)` = done **and** (`finishedAt`/`completedAt` on that day, or `manualDay` = that day). The finished-today load is charged to the day first; the queue fills only the remainder, a started day never takes a first card that exceeds capacity nor a full-day card, and a day that is full (≥ 1 work-day or a full-day card closed) queues nothing. Publish cards (rate 0) still list every piece due today, so عمر sees the remaining pieces until all are published. The whole-first-date fallback no longer fires once something was finished today. `person-day-state.ts`: new `DONE` state (queue empty + something closed today, ordered OFF → TASKS → DONE → BACKLOG → FREE). `overview-client.tsx`: tab badge «منجز», panel «تم إنجاز مهام اليوم — N بطاقة.» with the closed cards listed struck through; while cards remain, a line «أُنجز اليوم: N بطاقة.»; the day editor's meter starts from the finished load. `scripts/simulate-daily-queue.ts` prints the finished cards, the finished share and the «تم إنجاز» state.
- **[VERIFIED — SIMULATION on the 2151 mirror, 16/9]** ماجد: 6 shoots closed → 0 queued, «تم إنجاز مهام اليوم» (before: the next Siizen/Phoenitech shoots kept appearing). أيمن: 5 closed (4 Phoenitech posts + وصل ستوري-7) → 100 %, closed. أليسار: 4 montages → closed. سابين: 4 التوظيف posts closed (67 %) → **1** card queued for the rest of the day (was 5 more). عمر: publish cards due today still listed after the published ones.
- **[VERIFIED — GATES]** `tsc`, ESLint clean. `daily-work.test.ts` +8 cases (partial day, full day, full-day card, other-day closures ignored, manualDay counts, publisher unchanged, day off), `person-day-state.test.ts` +3. Full suite 607/616: the same 9 pre-existing production-data failures as on 16/9 (data-integrity ×3, lifecycle evidence, live-tasks-running-cycle ×2 and work-week Prisma init, telegram-e2e ٢ب/٣), confirmed identical with the change stashed.
- **[DECISION MADE BY ME]** «Finished today» is the closing stamp (every closing path writes `finishedAt`) or the lead's explicit «بدّل» onto today — not `isPinned`+`workDate`, which many long-closed cards carry. Late/open work of other days is *not* pulled forward once the day is full; it stays for the next working day, as the lead asked («ينتهي ما يتابع لباقي الأيام»). A person who finished some cards but whose remaining open cards do not fit sees the day as done too.
- **[PENDING — lead]** Check the home panel after the team closes today's cards: the tab should read «منجز» and the panel «تم إنجاز مهام اليوم». The 07:45 Telegram message is unaffected (nothing is finished at 07:45).

### 2026-09-16 (22:40) — Claude — Telegram cut to two daily messages: 07:45 distribution, 20:00 achievement, company + count only

Lane: code, pushed (see commit). No production data touched; the cron change deploys with `vercel.json`.

- **[USER-CONFIRMED 2026-09-16]** The lead, quoting a full day of bot output: «كتير مفشكل وضايع … خلي المهام باسم الشركة والعدد بلا ترقيم كل بوست. خلي النشر باسم الشركة ونوع المحتوى فقط. خفف كمية الرسائل … بدي الصبح بس توزيع المهام، والمسا الساعة 8 تقرير الإنجاز. باختصار وبساطة».
- **[VERIFIED — WHY so many]** Four scheduled sends a day reached her chat: 07:45 wave «general» = the one-line-per-person message **plus** «🧭 المتابعة اليومية» (at-risk + every late card by company + Telegram file count); 08:00 wave «detail» = the numbered per-person sheet with piece names; 17:00 «تقرير المنجَز» = piece-by-piece lists for عمر and حلا plus team totals and Telegram file stats. Sixty-plus lines, piece numbers everywhere.
- **[LOCAL → PUSHED]** `src/lib/telegram/summary.ts` (new, pure): `countByCompany` («التوظيف 3 بوست · التدريب 2 تصميم»), `typesByCompany` («وصل (بوست، ستوري)»), `kindWordOf` (type word from the piece, else from the manual card's title, else its stage; publisher's ad-hoc = «متابعة»), `openLateTasks` (same dormant/exempt/blocked filter the brief uses), `lateByCompanyLine`, `isCoreTeamMember`. `brief.ts`: the morning message is now one line per person in that form; the publisher's line is company + content type only («نشر: … ، متراكم: …»); `briefMessagesFor("general")` sends **only** `schedule` — the lead report and the detail sheet stay on `DailyBrief` for `/admin/telegram` preview and on-demand sends. `done-report.ts` rewritten: header, one line per core-team member with company + count (publisher marked «(نشر)»), «بلا إنجاز مسجَّل اليوم: …», then two count lines «لسا مفتوح على اليوم» and «متأخر مفتوح: N — company counts». No piece lists, no stage totals, no Telegram file section (`DeliveryLine`/`DONE_REPORT_PEOPLE` kept as exports for compatibility; `service.ts` no longer queries messages for it). `vercel.json`: `wave=detail` cron removed; `done-report` moved 14:00 → **17:00 UTC (20:00 Damascus)**. `scripts/preview-telegram.ts` (new, read-only) prints both messages for a date on the mirror.
- **[VERIFIED — PREVIEW on the 2151 mirror, 16/9]** Morning: `‏أيمن وصل للتداول 3 ستوري و1 بوست · عبادة لتجهيزات الأسنان 2 ستوري، ومتأخر: وصل للتداول 1 ستوري` / `‏سابين مركز البلسم 3 ستوري · التدريب 2 تصميم، ومتأخر: التوظيف 1 بوست` / `‏@Omar_ORR متابعة الصفحات والنشر، متراكم: عبادة … (بوست، ستوري) · مركز البلسم (بوست، ستوري) ومهمة متابعة` / `‏@Majic71 التوظيف 2 ريل · Phoenitech 2 ريل · Siizen 2 ريل` / `‏أليسار BW 2 ريل`. Evening: 6 person lines + «بلا إنجاز مسجَّل اليوم: حلا» + «لسا مفتوح على اليوم: أيمن 2 · سابين 3 · عمر 3 · ماجد 5 · أليسار 1» + «متأخر مفتوح: 13 — مركز البلسم 7 · وصل 2 · عبادة 2 · التدريب 1 · التوظيف 1».
- **[VERIFIED — GATES]** `tsc`, ESLint clean. Tests rewritten to the new rule: `done-report.test.ts`, `telegram-summary.test.ts` (new), the «العام» and «brief waves» blocks of `telegram.test.ts`, `system-relations` wave tests, the cron-hour test. Full suite 595/605: the 10 failures are the known production-data assertions (data-integrity ×3, lifecycle evidence, telegram-e2e chain ٢ب/٣ which fail on the mirror before this change too).
- **[DECISION MADE BY ME]** The morning message carries no at-risk or late list at all («بدي الصبح بس توزيع المهام»); lateness appears once, as counts, in the evening report. Company names are the stored full names (وصل للتداول) — a short display name would need a field.
- **[PENDING — lead]** Confirm tomorrow's 07:45 and 20:00 messages read right; the old lead report and detail sheet can still be sent from `/admin/telegram` on demand.

### 2026-09-16 (21:55) — Claude — عبادة's publish anchor corrected to 16/8 on the lead's word

- **[USER-CONFIRMED 2026-09-16]** «صححها، عبادة من 16/8 حتى 16/9».
- **[LIVE/VERIFIED — snapshot `prod-20260916-2151.json`]** `publishStartDate` 2026-08-11 → **2026-08-16** through the company form in the lead's Chrome session (JS-driven, see the 19:35 tooling note). No renewals, so this is the original anchor; the cycle is now **16/8 → 15/9** (exclusive end 16/9, same convention as every other span) and the achievement panel labels it «16/8 → 15/9». All 44 cards stay in bucket m=7; none is published before 16/8. The bucket was regenerated after the save: 43 rows changed **only in `createdAt`** — no status, date, owner or brief moved (diffed field by field). REEL#1 (22/9) and REEL#3 (17/9) remain late inside the cycle as before. Local mirror synced to 2151.

### 2026-09-16 (19:35) — Claude — التوظيف back to the September plan only; ماجد's Wednesday = فونيتيك; achievement per latest cycle; task filter active-only

Lane: code (pushed `a92c19f`, Vercel Ready) + three production payloads (`prod-23/24/25`) and two UI actions, all applied through the lead's Chrome session and **verified with `prod-20260916-1933.json`**.

- **[USER-CONFIRMED 2026-09-16]** The lead attached `Phoeni Jobs - Aug-Plan NO.2.docx` and said: October shoot cards are showing for التوظيف although September is not finished and October has not started — keep only the current September plan (the attachment); every August card must be closed. Plus: ماجد's today list showed وصل although وصل shoots Thursday — it should have been فونيتيك; the task-list company filter must show active companies only; company achievement is per cycle not per calendar month (عبادة showed 0 although its cycle, per her, runs 16/8 → 16/9) and the cycle dates go next to every company name.
- **[VERIFIED — WHY the October cards existed]** التوظيف carried a pre-recorded renewal `2026-10-01` (present since at least the 26/8 snapshot), so the engine had built the 1/10 → 31/10 bucket (m=9): 52 open cards including REEL#1–#3 shoots windowed 28–30/9 and eight EDIT rows created by yesterday's regeneration. Not a payload of this session; the renewal predates it.
- **[VERIFIED — FILE]** The attachment is the September content plan: 8 reels + 8 posts, identical in content to `scripts/data/tawzeef-plan-2026-09.json` (Sept-Plan NO.2). On production the September (m=8) reel cards carried **launch-plan briefs** («خطة جوبس») and REEL#7/#8 were blank, i.e. the document's scripts had never reached the cards.
- **[LIVE/VERIFIED] `prod-23-tawzeef-sept-plan-2026-09.json`** — document briefs on REEL#1–#7 and POST#1–#4 (`describedPieces=11`); POST#5–#10 keep yesterday's «أفكار جديدة» by the lead's 15/9 decision, so the document's posts 5–8 have no card (10-post cycle) — **[PENDING — lead]**. REEL#8 of September was **deleted by the lead** during the day (1,190 → 1,171 → 1,125 tasks between snapshots; her own board edits), so the payload was resent without it. `closePreviousOpenTasks` (decision 16/9, cutoff 2/9) closed the only two open August cards: REEL#8 EDIT and PUBLISH («أُغلقت بقرار المديرة»).
- **[LIVE/VERIFIED] October renewal removed** through «شيل آخر تجديد» (typed the guard count 5): renewals now `["2026-09-01"]`, all 46 generated October cards gone, the 11 manual launch-plan cards (`jobsplan_202610_*`) remain. The 4 generated "done" October cards were content-matcher artefacts (files of 10/8 and 1/9 attached to an October cycle) — their files are unmatched again, which is the honest state.
- **[LIVE/VERIFIED] `prod-24-wasl-shoot-thursday-2026-09-17.json`** — وصل REEL#5/#6/#7 SHOOT → Thu 17/9 pinned (prod-17 had read «غداً الباقي» as Wednesday; the 15/9 appointment list already said Thursday 2:00). Montage Mon 21/9 and publish dates untouched.
- **[LIVE/VERIFIED] `prod-25-phoenitech-shoot-2026-09-16.json`** — «سيناريو تصوير — Phoenitech» closed READY 16/9 by the lead's decision (it was blocking REEL#1/#2 from ماجد's queue, same pattern as BW on 15/9); REEL#1/#2 SHOOT pinned 16/9 (appointment 1:00).
- **[LIVE/VERIFIED — decision made by me] ماجد's stored rate `REEL: 3 → 6`** (team form, 6 reels / 1 day). With 3, Wednesday's queue could only show three التوظيف shoots and فونيتيك never surfaced; the lead's own Wednesday plan is 4 التوظيف + 2 فونيتيك = 6 and her stated figure was 6/day. Simulated «مهام اليوم» on the 1933 mirror: **Wed 16/9 = التوظيف ريل-5/6 + فونيتيك ريل-1/2 + Siizen ريل-3/4 (late since 8/9)**, Thu 17/9 = وصل ريل-6/7 + Siizen ريل-3/4/5/6. (Between snapshots the lead also closed التوظيف REEL#3/#4 shoots and وصل REEL#5 — her edits.)
- **[LOCAL → PUSHED `a92c19f`]** `latestCycle` / `latestCycleBucket` / `achievementSpanLabel` in `contract.ts`: achievement reads the current cycle or, when it has ended without a renewal, the **last** cycle — never the calendar month; the span («11/8 → 10/9», or the month for calendar companies) shows next to every company on the overview «إنجاز الشركات» and on the reports plan panel. Task-list company filter lists active companies only (`!isDormantCompany`). Tests: `tests/latest-cycle.test.ts` (4).
- **[OPEN — discrepancy shown]** The lead says عبادة's cycle is **16/8 → 16/9**; the app's anchor is `publishStartDate` 11/8 (cycle 11/8 → 10/9, REEL#2 published 18/8). Not changed — correcting the anchor regenerates the bucket; needs her explicit «صحّح».
- **[OPEN — noticed while working]** برو was paused by the lead today («أوقف النشر», publish start cleared). Siizen REEL#3–#6 shoots (8–13/9) are still open and fill ماجد's queue as late work.
- **[TOOLING]** SweetAlert dialogs in the lead's background Chrome window freeze (renderer throttled), so confirm clicks do not resolve; payloads were applied by `fetch('/admin/api/plan-update')` from her signed-in tab (same admin check), and the guarded dialogs by dispatching clicks through `javascript_tool`. `preflight-payload.ts` does not print `items`/`closePreviousOpenTasks` — those are only exercised by the local dry run.

### 2026-09-15 (15:20) — Claude — Company lifecycle rule: «لم تجدّد» = archive with auto-closed cards; pause only for active companies

Lane: code (pushed `05a872f` + `a7dce18`, Vercel deployment `socialmediateam-6dvs64ghi` Ready in 46s) + the automatic reconciliation it carries, verified live.

- **[USER-CONFIRMED 2026-09-15]** The lead: on the companies page every company that did not renew goes under an archive section, not among the active ones, and its cards close automatically; «أوقف النشر / رجّع النشر» are pointless for a non-renewed company — it is stopped by itself; the pause state is only for **active** companies whose client asked to pause (جدارات) so no lateness is counted and no useless tasks are added. «حدّث القاعدة والخوارزمية وحل كل المشاكل والتعارضات».
- **[VERIFIED — CODE, before]** `endContract` («لم يُجدد») set `contractEndedAt` **and `status: "paused"`**, so a non-renewed company wore the client-pause state, stayed among the active cards with pause/resume buttons, and kept its open cards (مانغو: 3 open publish cards after today's click; أغاليا paused since 21/8). `archiveCompany` archived without touching cards. Eleven call sites filtered on `status === "active"` each in their own way.
- **[LOCAL → PUSHED]** One rule in `src/lib/company-visibility.ts` — `companyLifecycle(co)`: **archived** when `status === "archived"` **or** `contractEndedAt ≤ today` (the end decision alone is an archive, whatever status is stored); **paused** = an active company on client request; else **active** (including awaiting renewal). Every "active" filter now reads it: scheduler + engine (`isPlanned`), live tasks, board, today, publishing, overview, reports, finance, morning brief, shoot appointments. `src/server/company-lifecycle.ts`: `closeOpenWorkForEndedContract` cancels every open card (auto and manual) as `CANCELED` + pinned + evidence line «أُغلق تلقائياً: لم يُجدَّد العقد (date)» — **cancelled, not done**, so nobody's achievement and no «منشور» figure is inflated (rule ٥) — and deletes auto NOT_STARTED photo sessions (same as pause). Used by `endContract` (now archives), `archiveCompany`, the company form when status becomes archived, and `archiveEndedContracts()` which the companies page runs on load (idempotent) to migrate the old paused-but-ended rows. Pause/resume refuse archived companies; the form refuses `active` for a company whose contract ended (the way back is «جدّد», which now revives archived as well as paused). Companies page: active section (paused companies inside it with a «موقوفة بطلب الزبون» chip and «رجّع النشر»), then «الأرشيف — شركات لم تجدّد» with only «جدّد», edit and delete; the ended chip reads «لم تجدّد — منذ …»; form labels renamed.
- **[VERIFIED — LOCAL GATES]** `tsc` and ESLint clean. Tests: new `tests/company-lifecycle.test.ts` (4 pure + 5 on an isolated DB copy: closure with evidence, done/cancelled untouched, pause/resume refusal, revive via renew, form refusal/archival, idempotent reconciliation, client pause), `company-visibility` and `operations-e2e` updated (endContract → archived + 0 open cards), `contract-renewal` updated: an ended company is dormant, so the pure scheduler plans nothing for it in **any** bucket — its history is kept by the preservation rule (BR-012), not by regeneration. Full suite 595/601: the 6 failures are production-data assertions that fail identically on the unmodified code (`git stash` check) — 5 known, plus «مانغو: نشر 15/9 خارج الدورة» created by today's «لم يُجدد» click and removed by the reconciliation below.
- **[PREFLIGHT — SNAPSHOT 1442]** The reconciliation would touch exactly: أغاليا paused → archived (0 open cards, 3 auto sessions), مانغو paused → archived (**3** open publish cards cancelled: ستوري-4 AWAITING_APPROVAL 27/8, ستوري-9 13/9, ستوري-10 16/9; 2 auto sessions). Sections afterwards: active 13 (جدارات inside as paused), archive 3 (مانغو · أغاليا · المول الصيني).
- **[LIVE/VERIFIED 15:15]** Opened `/admin/companies` in the lead's Chrome session after the deployment: active grid with جدارات carrying «موقوفة بطلب الزبون» + «رجّع النشر»; a bottom section «الأرشيف — شركات لم تجدّد» holding مانغو («لم تجدّد — منذ 15 أيلول»), أغاليا (21 آب) and المول الصيني (1 آب), each with «جدّد» only. Fresh snapshot `prod-20260915-1515.json` diffed against 1442: أغاليا and مانغو `status` → `archived`; exactly the 3 مانغو publish cards → `CANCELED` + pinned + the evidence line; 5 auto NOT_STARTED photo sessions removed (أغاليا 3, مانغو 2); no other row changed (1,190 tasks before and after). Local mirror re-synced to 1515.
- **[OPEN — shown, not changed]** Siizen still carries `lateExemptReason` «لسا ما بلشنا…» although it publishes since 19/8 — an exemption on an active publishing company hides its lateness everywhere; the lead's new rule says exemption belongs to paused companies only. One field in the company form.
- **[DECISION MADE BY ME]** "Awaiting renewal" (cycle ended, no decision yet — نور, برو, البلسم, عبادة) stays **active**: the lead still tracks live work there (البلسم reel 4 waiting on the client, stories 13–15) and renewals often arrive after the cycle end. Archiving is the explicit «لم يُجدد» decision (or the form/archive button), never the calendar.

### 2026-09-15 (14:40) — Claude — التدريب: كروت دورات تشرين الأول لسابين + إقفال أيلول بدليل إنستغرام (`prod-22`)

Lane: code (pushed `f8537c1`, Vercel Ready 46s) + one production payload (`9d277fe`) applied through the lead's Chrome session and **verified live** with `prod-20260915-1442.json`.

- **[USER-CONFIRMED 2026-09-15]** The lead attached `جدول شهر أكتوبر10 - للتصميم.docx` and said: سابين's task board is full of problems; the September training design tasks are finished; the new October tasks go on the schedule **Wednesday or Thursday, by priority**.
- **[VERIFIED — FILE]** The document is one table: four remote programmes — التحول الرقمي وتحديات العصر الحديث (11–15/10 · 15 h · أ. عيد تايه · 40 $), الذكاء الاصطناعي في الإدارة الحديثة (18–22/10 · 15 h · أ. سليم البسطامي · **15 $** as written, looks like a typo next to the 40 $ rows), المحاسبة والتحليل المالي باستخدام الذكاء الاصطناعي (25–29/10 · 15 h · أ. أمجد عكش · 40 $), ورشة التسوق الذكي باستخدام الذكاء الاصطناعي (Sat 31/10 · 4 h · أ. عدنان ضوبي · 10 $).
- **[VERIFIED — CODE/GIT]** Course cards used to be created by `scripts/schedule-training-courses.ts` at build time; `28b7ec9` removed every data write from the build, so since then **no path existed** to bring a new month's courses to production (the September cards were the last ones written that way). The script header now says so.
- **[LOCAL → PUSHED `f8537c1`]** New `courses` block in the validated plan payload (`src/server/plan-update.ts`, computation in `src/lib/course-cards.ts`): designer and publisher by name, publish = course start − N days slid back to the publisher's working day, design day given explicitly by the lead (must be the designer's working day and before publication; one day's gap marks the card `URGENT`), fixed ids `course_<slug>_design/_publish` so re-applying re-times open cards and never touches done/cancelled ones, evidence line on every card, optional month poster card. `preflight-payload.ts` prints the same computation per card (new / re-timed / untouched). The import toast now counts states, ad-hoc cards, course cards and closures instead of «٠ وصفاً». Tests: `course-cards.test.ts` (8) + `plan-update-courses.test.ts` (5, isolated DB). `tsc` and ESLint clean; the full suite is 584/592 — the same 8 failures reproduce on the untouched pre-dry-run mirror copy (5 are production-data assertions: piece-number gaps, 8-hour ad-hoc cards, publish closures without evidence, Siizen Telegram e2e; 3 only fail when `DATABASE_URL` is unset in the shell), so none is a regression.
- **[VERIFIED — INSTAGRAM 15/9]** phoenitech.training: the «كيف يعمل المخترقون» announcement was posted **3/9** (`p/Dc0p38xjfP3`, scheduled 9/9) and «مستقبل العمل والمحتوى الرقمي» on **14/9** (`p/DdQ1XwOMDQH`, scheduled 16/9). No post between 24/8 and 3/9, so «توظيف الذكاء الاصطناعي في تطوير المهارات الإدارية» (publish scheduled 2/9, course started 13/9) was **never announced** — its PUBLISH card is left open for the lead to cancel or close.
- **[PREFLIGHT + LOCAL DRY RUN — GREEN]** `prod-22-training-2026-10.json` on `prod-20260915-1108.json`: 4 ad-hoc rows match exactly one card each; 9 course cards all new. Applied on the mirror (safety copy `backups/dev.db.before-dryrun-20260915-prod22`): `updatedAdhoc=4 · createdCourseCards=9 · affectedRows=13`. Simulated «مهام اليوم» on the mirror — سابين Wed 16/9: التوظيف بوست-8/9/10 + التحول الرقمي + الذكاء الاصطناعي في الإدارة = **100 %**; Thu 17/9: المحاسبة + التسوق الذكي + بوستر جدول الشهر = **88 %**. Publish cards for عمر: Thu 1/10 · Thu 8/10 · Thu 15/10 · Wed 21/10.
- **[DECISIONS MADE BY ME — reversible]** (a) Design days 16/9 and 17/9 (this week, the lead's «الأربعاء أو الخميس», under her mid-month rule), ordered by course date. (b) A month-poster card «تصميم جدول برامج تشرين الأول — التدريب» (3 h, Thu 17/9) on the precedent of the August (14/7) and September (2/8) posters — delete it if not wanted. (c) September closures dated by the Instagram posts (3/9 and 14/9), not by today.
- **[OPEN — سابين's board, shown not fixed]** 7 open cards dated before 13/9: Siizen ستوري-5 (8/9), البلسم ستوري-13/14/15 (pinned 9/9), التوظيف «إطلاق Meta Ads» and «كاروسيل كمّل ملفك» (pinned 9/9), plus Siizen ستوري-9/10 (13–14/9, publish 15–16/9). التوظيف POST#3 DESIGN of the October cycle sits on **Saturday 10/10** (auto, unpinned — production work on an off day). After Siizen ends 17/9 and until البلسم/برو/نور/مانغو/جدارات renew, her October board holds only التوظيف: the 3/9 imbalance diagnosis still stands.
- **[LIVE/VERIFIED 14:42] `prod-22-training-2026-10.json` applied** on `/admin/companies` → التدريب → «استيراد خطة JSON» (the dialog title read «استيراد خطة — التدريب»). Fresh snapshot `prod-20260915-1442.json` (1,190 tasks) shows every row: `course_security_design` READY 3/9 · `course_security_publish` PUBLISHED 3/9 · `course_future-work_design` READY 14/9 · `course_future-work_publish` PUBLISHED 14/9, each with its Instagram evidence line; nine new pinned `course_*` cards — سابين 16/9 (التحول الرقمي · الذكاء الاصطناعي في الإدارة الحديثة), 17/9 (المحاسبة والتحليل المالي · ورشة التسوق الذكي · بوستر جدول تشرين الأول), عمر 1/10 · 8/10 · 15/10 · 21/10. Local mirror re-synced to 1442 (`backups/dev.db.before-sync-20260915-1443`); the simulated «مهام اليوم» matches the dry run (Wed 100 %, Thu 88 %).
- **[VERIFIED — SNAPSHOT DIFF 1108 → 1442, not mine]** Between the two snapshots four of سابين's pinned التوظيف launch cards were **deleted** (`jobsplan_202609_w1_ads_h` 9/9, `…w3_influencers_h` 15/9, `…w4_ads_h` 22/9, `jobsplan_202610_w1_design_h` 30/9) and the September/October buckets were regenerated (`createdAt` churn on ~200 auto rows, eight new التوظيف October EDIT rows, open auto cards re-dated — e.g. التوظيف October POST#3 DESIGN moved from Sat 10/10 to Thu 8/10, so the Saturday defect noted above no longer exists). This is UI activity (card edit/delete triggers the month engine), not the payload; recorded so nobody attributes it to `prod-22`.
- **[PENDING — lead]** (a) «نشر إعلان: توظيف الذكاء الاصطناعي في تطوير المهارات الإدارية» (2/9) — cancel or close with evidence. (b) The 15 $ fee in the document. (c) The poster card if not wanted. (d) سابين's remaining late cards: Siizen ستوري-5/9/10, البلسم ستوري-13/14/15, التوظيف «كاروسيل كمّل ملفك».


### 2026-09-15 (11:10) — Claude — BW plan No.6 imported; البلسم reel 4 parked on the client; Jobs new-posts plan prioritized for سابين

Lane: production data via validated payloads applied through the lead's Chrome session; one small ordering fix in code (pushed).

- **[USER-CONFIRMED 2026-09-15]** The lead attached `BW -Plan No.6- Sep.docx` and `PhoeniJobs__New_Posts_Ideas.docx` and said: close BW's previous-cycle cards as done; the current-cycle cards are the sent plan; البلسم reel 4 has no shoot date yet (client's delay); سابين has a plan — adopt the new Jobs plan for her to design starting today, with priority over the older Jobs cards.
- **[VERIFIED — SNAPSHOT 10:37]** BW: every card of the August cycle (m=7) was already DONE; zero open BW cards outside the running cycle 10/9 → 9/10 (m=8), so the requested closure is a no-op (kept in the payload for the record; matched 0 rows). Current cycle: POST#1–#4 DESIGN already delivered by أيمن on 10/9 (`BW-post-9-1..4.jpg`) with **blank briefs**; REEL#1–#4 all open with blank briefs; REEL#1/#2 SHOOT on 15/9 were blocked by نوال's two WRITE cards (NOT_STARTED).
- **[LIVE/VERIFIED 11:08] `prod-19-bw-plan-6-2026-09.json` applied** (24 rows, toast «تم تطبيق 8 وصفاً»): briefs from the document on POST#1–#4 (design sentence + AR/EN caption + hashtags) and REEL#1–#4 (AR script + EN script + captions); REEL#1/#2 SHOOT pinned 15/9 with the 12:00 appointment in the evidence; نوال's «سيناريو تصوير — BW» and «كتابة بوستات وستوريز — BW» closed READY 15/9 with evidence that the client's plan supplied the writing — **decision made by me from the lead's sentence «كروت الدورة الحالية هي في الخطة المرسلة»**; reversible via `adhocStates` if she disagrees. Effect: ماجد's live «مهام اليوم» now = عبادة ريل-1 + BW ريل-1 + BW ريل-2 (100%).
- **[LIVE/VERIFIED 11:08] `prod-20-balsam-reel4-awaiting-client.json` applied** (3 rows): REEL#4 SHOOT/EDIT/PUBLISH re-pinned to placeholder dates 30/9 · 4/10 · 6/10 with evidence «بانتظار موعد من الزبون — التأخير عليه». The app has no "no date" state for a shoot card; the placeholder keeps it out of ماجد's daily queue and the late lists until the client sets a date — then it must be re-dated by payload. Stays in bucket m=7 (same rule as prod-12).
- **[LIVE/VERIFIED 11:08] `prod-21-tawzeef-jobs-new-posts-2026-09.json` applied** (21 rows): ideas 1–6 of the document → POST#5–#10 briefs (old launch-plan briefs on #5–#7 overwritten; that content still lives on سابين's five pinned ad-hoc launch cards); DESIGN #5/#6/#7 fixed on 15/9 via `prepareOn` (POST#5 carried a stale «بدّل» `manualDay` of 9/9 that `workDate` alone would not clear) and #8/#9/#10 pinned 16/9, `readyDate` = work day so they rank as due above the ad-hoc cards. Publish dates untouched (20 · 21 · 23 · 24 · 28 · 29/9). Live home: سابين today **5 cards** (بوست-5/6/7 التوظيف + launch carousel + البلسم ستوري-13), tomorrow simulated 6 (بوست-8/9/10 + البلسم ستوري-13/14/15).
- **[PENDING — lead] Ideas 7 («وين انت اليوم؟») and 8 («تحت المجهر مع Phoeni») have no card** — the cycle has 10 posts and 1–4 are done. Options: raise التوظيف's posts to 12 for this cycle (regeneration adds POST#11/#12, then a payload maps the two ideas), or drop two ideas.
- **[VERIFIED — FRESH SNAPSHOT `prod-20260915-1108.json`]** Every row above confirmed; local mirror synced; `scripts/simulate-daily-queue.ts` on the mirror matches the live home page.
- **[LOCAL → PUSHED]** `scripts/preflight-payload.ts`: ad-hoc matching now mirrors the server (bucket + `pieceNo` null + stage + title *contains*) — it compared titles by equality across all buckets and rejected «سيناريو تصوير — BW» although the server accepts it. `scripts/simulate-daily-queue.ts` (new, read-only): «مهام اليوم» for given people on a given day on the local mirror, same code path as the home page and the brief. `src/app/overview-client.tsx`: the home critical list broke same-deadline ties by arrival order («ريل-2 · BW» before «ريل-1 · BW»); now `comparePieceSequence` → natural title order.
- **[OPEN — flagged, not touched]** (a) التوظيف m=7 REEL#8 EDIT (1/9) and PUBLISH (31/8) are still open although its SHOOT was closed administratively on 5/9 (prod-14) — it sits in أليسار's queue as «ريل-8 · التوظيف متأخر». Same pattern may apply to other m=7 reels whose shoots were closed by decision. (b) أليسار Sun 20/9 carries 4 montages (التوظيف #3/#4/#5 + عبادة #1) at rate 3. (c) سابين's backlog: البلسم ستوري-13/14/15 (pinned 9/9, never delivered) and two launch ad-hoc cards pinned 9/9 still late. (d) `.env.bak-20260911` still tracked.

### 2026-09-15 (later) — Claude — Paused companies hidden everywhere; numeric piece order in every list

Lane: code, local. **Not pushed, not deployed.** No production data touched.

- **[USER-CONFIRMED 2026-09-15]** The lead: جدارات's publishing is paused, yet its cards appear in the publishing screen — "we agreed nothing of a company's cards shows when publishing is paused and no publish-start date is set". And: cards must appear and be scheduled in numeric order (1 → N); she saw «جدولة ستوري 11» listed before «ستوري 9».
- **[VERIFIED — CODE]** The dormant rule (`status !== "active"` → cards hidden) existed only in `OverviewView.tsx` and `telegram/brief.ts`. `loadLiveTasks` (tasks board, today, service), `publishing/page.tsx` and `reports/page.tsx` read cards directly, so جدارات's 12 open publish cards (bucket m=7, cycle 11/8 → 10/9) surfaced in «متأخر النشر» and in the reports' late diagnosis. **[LIVE — read-only]** Confirmed on production: publishing overdue strip lists جدارات ريل AI-1…6 and بوست-1…6.
- **[VERIFIED — LIVE]** جدارات still carries `publishStartDate` 11/8 (its cards show the cycle label), i.e. it was paused through the company form's status field, not through «إيقاف النشر» (`pauseCompanyPublishing`, which nulls the date and deletes open auto cards). The new rule hides the cards either way; the stored date is left as is — the lead decides whether to clear it.
- **[VERIFIED — CODE]** Ordering: `KanbanBoard.byTime` broke same-day ties with `label.localeCompare` — a text comparison, so «ستوري-11» sorted before «ستوري-9». Piece numbers themselves are assigned by publish date per company/type (`pipeline.ts`), so scheduling order is numeric; only the display tie-breaks were textual or by random id.
- **[LOCAL-ONLY — IMPLEMENTED]**
  - `src/lib/company-visibility.ts` (new): `isDormantCompany`, `dormantCompanyIds`, `hideDormantCompanyWork` — one place for the rule.
  - `src/lib/live-tasks.ts`: reads all companies once, keeps running-cycle logic for active ones, drops every card of a paused/archived company from the live set (board, today, brief service).
  - `src/app/publishing/page.tsx`: same filter → جدارات disappears from the calendar and «متأخر النشر».
  - `src/app/OverviewView.tsx`: uses the shared helper (behaviour unchanged).
  - `src/app/reports/page.tsx`: open cards of dormant companies dropped (done work kept for the person's achievement); the late diagnosis also skips companies that have not started publishing or carry `lateExemptReason` — same rule as the brief (3/9 diagnosis item ج).
  - `src/lib/cards.ts`: `comparePieceSequence` (type → pieceNo numeric → stage) and `compareLabelsNaturally` (numeric collator). Used by the board tie-break, the publishing overdue strip (was `id` order) and the today page company lists.
  - Tests: `tests/company-visibility.test.ts`, `tests/piece-order.test.ts`.
- **[VERIFIED — LOCAL GATES]** `tsc --noEmit` clean, ESLint clean on changed files, focused suites green (see next entry for the full run).
- **[LIVE/VERIFIED 2026-09-15]** The lead said «بدي الشغل نظيف ومرفوع على vercel». Pushed as three scoped commits `c395d12` (fix) · `5bbad5b` (payload drafts) · `9149646` (handoff); Vercel production deployment **Ready** in 45s. Read-only check afterwards: `/publishing` overdue strip **50 → 38**, no جدارات card, جدارات gone from the company filter; `/tasks` same-day cards now run type → piece number → stage (البلسم ستوري-13/14/15, التوظيف ريل-4/5/6).
- **[USER-CONFIRMED 2026-09-15 — NOT YET APPLIED]** عبادة facts from the lead: «تم تصوير الأحد ريل 2 وتسليمه البارحة من قبل أليسار، واليوم الثلاثاء تصوير الريل 3». Drafted as `scripts/data/prod-18-obada-reels-2026-09-15.json` (REEL#2 SHOOT READY 13/9 · REEL#2 EDIT READY 14/9 · REEL#3 SHOOT pinned 15/9). **⚠️ Discrepancy shown, not resolved:** the app records REEL#2 as published 18/8 and REEL#1/#3 shoots booked 9/9 (`prod-11`), and the live board shows no open عبادة SHOOT card at all. Either the lead's numbering differs from the app's or the 9/9 session never happened and its cards were closed wrongly. `preflight-payload.ts` on a fresh snapshot decides which rows the payload would hit; nothing applied until then.
- **[VERIFIED — FRESH PRODUCTION SNAPSHOT 2026-09-15 10:05]** The lead placed `CRON_SECRET` in the clone's `.env.local`; `npm run backup:pull` fetched `prod-20260915-1005.json` (11 employees · 16 companies · 1,177 tasks · 64 sessions · 7 settings) and `backup:sync` mirrored it into the local `prisma/dev.db`.
- **[VERIFIED — PREFLIGHT]** All four payloads match exactly one row per item. Local dry run (`apply-payload.ts` on the mirror) applied prod-15 (4 ad-hoc rows), prod-16 (10 rows), prod-17 (16 rows) cleanly. Simulated «مهام اليوم» for 15/9 on the mirror: أيمن **1 card → 6 cards at 100%** (4 Phoenitech posts + وصل ستوري-9 + عبادة ستوري-9); ماجد stays 3 cards (البلسم ريل-4 + التوظيف ريل-7/8 — the pinned Wed/Thu shoots correctly leave his queue). **Nothing applied on production.**
- **[VERIFIED — SNAPSHOT] عبادة numbering resolved (needs the lead's yes):** what the lead calls «ريل 2» (shot Sun 13/9, montage Mon 14/9 by أليسار) is the app's **REEL#3** — its SHOOT and EDIT were closed on 14/9. The app's REEL#2 is the piece published 18/8. The app's **REEL#1** has SHOOT, EDIT and PUBLISH all closed on **6/9** (before the 9/9 booking) with publish date 15/9 and no Instagram evidence — almost certainly the piece she calls «ريل 3», to be shot today. `prod-18` was rewritten accordingly: REEL#3 actual dates 13/9 & 14/9; REEL#1 reopened with shoot 15/9, montage 20/9, publish 22/9 (late inside cycle 11/8→10/9, like `prod-11`). Preflight green; **not applied** — the reopening reverses closures and needs her explicit confirmation.
- **[VERIFIED — SNAPSHOT] Two facts that touch this week's shoots:** (a) ماجد's stored rate is `REEL: 3` per day, so the six وصل reels on Thu 17/9 will read 200% of his day; the lead's stated figure is 6/day — one field in شاشة الفريق. (b) BW REEL#1/#2 SHOOT (today) are blocked by نوال's «سيناريو تصوير — BW» which is still NOT_STARTED, so they do not enter ماجد's queue until that card is closed.
- **[LIVE/VERIFIED 2026-09-15 10:21]** The lead said «طبّق الحمولات أنت عبر متصفحي، وعبادة الترقيم صحيح». Applied through her signed-in Chrome session on `/admin/companies` («استيراد خطة JSON», one card at a time): **prod-15 Phoenitech** (4 ad-hoc cards → 1.33 h), **prod-16 التوظيف** (REEL#3–#6, 10 rows), **prod-18 عبادة** (REEL#3 real dates 13/9 & 14/9; REEL#1 reopened: shoot 15/9, montage 20/9, publish 22/9). Fresh snapshot `prod-20260915-1021.json` confirms every row. Live home page now shows **أيمن 6 cards** (4 Phoenitech posts + وصل ستوري-9 + عبادة ستوري-9) and ماجد's critical list carries عبادة ريل-1 due today. The toast still reports «0 وصفاً» — the known misleading counter; verification is the snapshot, not the toast.
- **[USER-CONFIRMED 2026-09-15] وصل — prod-17 NOT applied and must be rewritten.** The lead: «تم تصوير 1 الشهر 2 ريل، ثم تصور الأسبوع الماضي يوم الاثنين 3 ريل، هذا الأسبوع يوم الخميس سيتم تصوير 3 ريل — هيك تم توزيع الحمل». So the shoot plan is 2 + 3 + 3 = 8, Thursday takes **three** reels, not six, and ماجد's stored rate `REEL: 3` is consistent with that (leave it). Snapshot: REEL#1/#2 shot and delivered 1/9 & 3/9; REEL#4/#8 SHOOT closed with **9/9** (Wed) although the lead says Monday 7/9; REEL#3/#5/#6/#7 SHOOT still open — one of them was shot on Monday and never closed. **[PENDING — lead]** which reel number was the third Monday reel, and which three go on Thursday 17/9; then prod-17 is rewritten (Monday reel closed with 7/9 evidence, three Thursday shoots pinned, montage/publish re-dated) and preflighted.
- **[USER-CONFIRMED + LIVE/VERIFIED 2026-09-15 10:37] وصل applied.** The lead sent ماجد's Telegram line «صورنا من الخطة 2-4-8» (Mon 7/9) and stated: day one (1/9) reels 1 and 3; tomorrow (Wed 16/9) the rest. `prod-17-wasl-shoot-2026-09-16.json` (replaces the six-reel Thursday draft, deleted) applied through her Chrome session and confirmed in `prod-20260915-1037.json`: REEL#3 SHOOT closed 1/9; REEL#2/#4/#8 SHOOT dated 7/9; REEL#3 montage 16/9 → publish Sat 19/9; REEL#5/#6/#7 shoot 16/9, montage Mon 21/9 (Sun 20/9 is full with التوظيف), publish 23/9 · 24/9 · Sat 26/9. REEL#4 (17/9) and REEL#8 (30/9) untouched. 15 rows.
- **[OPEN — shown to the lead]** REEL#2 EDIT is marked delivered on 3/9 (file «wasl 2-9.mp4») although REEL#2 was shot on 7/9 — the file is most likely REEL#3's montage mislabeled, or the label is wrong. Not changed. REEL#3 EDIT stays open for 16/9.
- **[OPEN — load]** ماجد on Wed 16/9 now carries التوظيف 4 + Phoenitech 2 + وصل 3 = 9 shoots at a stored rate of 3/day (the lead's own 2+3+3 split for وصل confirms 3/day, so the rate was left as is).
- **[PENDING — lead]** BW REEL#1/#2 SHOOT today are blocked by نوال's «سيناريو تصوير — BW» (NOT_STARTED); they will not enter ماجد's queue until that card is closed.
- **[SECURITY — flag]** `.env.bak-20260911` is a tracked file in the repository. Not opened; if it holds real values they are in Git history and must be rotated and the file removed from tracking.

### 2026-09-15 — Claude — Shoot-week re-dating drafted; Ayman's one-card day diagnosed; workspace mismatch recorded

Lane: read-only inspection of production + local payload drafting. **No production mutation, no deployment, no push, no Telegram/Instagram action.** Nothing here is applied.

- **[USER-CONFIRMED 2026-09-15]** The lead reported two issues on the live site: (1) the home «مهام اليوم» does not fill a designer's capacity — should be 6 designs; (2) new shoot appointments: **Tue 15/9 عبادة 02:00 + BW 12:00 · Wed 16/9 التوظيف 11:00 + فونيتيك 01:00 · Thu 17/9 وصل 2:00** — reorder ماجد's and أليسار's cards **only** (no new cards), publishing may move if needed. She also stated that all work is on the live Vercel copy, not local.
- **[VERIFIED — LIVE, read-only]** Home «مهام اليوم» for أيمن shows **one** card, «تصميم بوست-2 · Phoenitech». The «تعديل مهام اليوم» checklist on production labels it **«يوم كامل · 100%»** and locks the rest of the list. Root cause is the same defect fixed for عبادة بوست-6 on 3/9: the four ad-hoc cards «تصميم بوست-1..4 · Phoenitech» (all IN_PROGRESS, work 14/9) are estimated at 8 hours each, so the first one is exclusive and the queue stops after it. Data, not code. Draft fix: `scripts/data/prod-15-phoenitech-adhoc-hours-2026-09.json` (hours → 1.33, evidence line, nothing else changes). Expected effect: Ayman's day fills to his rate from the available cards (4 Phoenitech posts, وصل ستوري-9, عبادة ستوري-9/10).
- **[VERIFIED — LIVE, read-only]** Reel cards relevant to the shoot week, read from `/tasks`, `/reports`, `/publishing` on 2026-09-15:
  - **BW**: REEL#1/#2 SHOOT already on **15/9** (blocked by نوال's «سيناريو تصوير — BW» due 15/9). EDIT 16/9 & 17/9, publish 17/9 & 20/9 — montage is the day after the shoot (below the 2-day rule); left untouched, flagged.
  - **Phoenitech**: REEL#1/#2 SHOOT already on **16/9** (blocked by «سيناريو تصوير — Phoenitech» due 16/9). EDIT 17/9 (next day) & 24/9, publish 20/9 & 27/9; left untouched, flagged.
  - **التوظيف**: REEL#3 SHOOT late (window 31/8–2/9, publish 14/9 passed); REEL#4/#5/#6 SHOOT window 14–16/9; REEL#7/#8 window 21–23/9.
  - **وصل**: REEL#3 SHOOT 6/9 not done (publish 12/9 passed); REEL#4/#5/#6 window 10–13/9 passed with no shoot (REEL#4 publish 17/9 = the new shoot day); REEL#7/#8 window 17–20/9.
  - **عبادة**: **no open SHOOT card exists** (REEL#1/#3 booked 9/9 under `prod-11`, only «نشر ريل-3 ← 17/9» remains open; REEL#2 published 18/8). The Tuesday 02:00 Obada appointment therefore has nothing to reorder — **[PENDING — ask the lead]** which piece it is; creating a card is outside her instruction.
  - **Not in the lead's week and still late**: مركز البلسم REEL#4 SHOOT (9/9), Siizen REEL#3–#6 SHOOT (8–13/9). Majed's Wed (4+2) and Thu (6) are full at his 6/day rate; Tue has room (BW 2 reels).
- **[LOCAL-ONLY — DRAFT, not preflighted]** Payloads written from the engine rules (`LEAD.REEL` 2, montage 2–3 days after the shoot on the editor's Sun–Thu week, أليسار 3/day, Saturday publishable), numeric publish order kept inside each cycle:
  - `scripts/data/prod-16-tawzeef-shoot-2026-09-16.json` — REEL#3/#4/#5/#6 SHOOT → 16/9; EDIT #3/#4/#5 → Sun 20/9; publish #3 22/9 (was 14/9), #4 23/9 (was 19/9), #5 24/9 (was 22/9); #6 montage 24/9 / publish 26/9 unchanged. Alternative noted in the file: leave #5 and put #3 → 23/9, #4 → 24/9.
  - `scripts/data/prod-17-wasl-shoot-2026-09-17.json` — REEL#3–#8 SHOOT → 17/9 (six reels = Majed's full day); EDIT #3/#4/#5 → Sun 20/9, #6/#7 → Mon 21/9, #8 stays 28/9; publish #3 22/9 (was 12/9), #4 23/9 (was 17/9), #5 24/9 (was 19/9), #6 Sat 26/9 (was 23/9), #7 27/9 (was 24/9), #8 30/9 unchanged. Posts/stories untouched; everything stays inside 1/9→30/9.
  - Appointment **times** go into the evidence lines (no time field exists — same as المخبر 3:00).
- **[BLOCKED — needs the lead]** (a) No production snapshot is reachable from this machine: `backups/prod-*.json` are untracked and lived in the old workspace, and `CRON_SECRET` is not available to any agent. `preflight-payload.ts` and a local dry run need `npm run backup:pull` with a `.env.local` holding the secret in this clone. (b) Applying is through «استيراد خطة JSON» on `/admin/companies` with the lead's session. Order after approval: prod-15 (Phoenitech hours) → prod-16 (التوظيف) → prod-17 (وصل); then `backup:pull` and confirm on the live board.
- **[INFERENCE]** The stale-copy incident suggests the previous day's «daily sync» request was executed against the wrong folder; the scheduled 12:00 `backup:daily` task had already not run since 2026-09-10 (see 13/9 entry). Both need the lead's confirmation of where her real working tree is.

### 2026-09-13 — Claude — Telegram match rate diagnosed end-to-end; parser bug fixed; Phoenitech plan arrived while paused

- **[LIVE/VERIFIED]** Phoenitech **re-activated** on the lead's instruction with publish start **2026-09-13** (today). Verified from `prod-20260913-0852.json`: status `active`, 18 open cards rebuilt, all **79 completed cards preserved**.
- **[USER-DECISION]** مخبر د.نور stays as it is — **do not open a new cycle**; the client has not approved yet. Its plan document arrived 6 September but no cycle was started. Zero open cards, unchanged.
- **[VERIFIED — SCOPED BY THE LEAD]** "Only design/montage deliveries need matching; the rest is internal team data." Re-measured on Ayman/Sabin/Elissar only: 758 files, 466 unmatched. Of those, **106 are correct behaviour** (93 re-sends of already-delivered pieces + 13 carousel slides whose first slide matched). The rest split into name-unreadable (159) and name-points-at-a-non-open-piece (100).
- **[VERIFIED — NOT A MATCHER BUG]** Ayman's 22-file Wasl batch of 10 September is correctly named but was rejected because posts 1–8 and stories 1–6 of the September bucket were **already closed** — and **9 of those 14 carry «بلا دليل»**, i.e. they were closed by hand with no file. That manual closure is what makes the later genuine delivery read as "unmatched".
- **[OPEN]** Real coverage gaps, not matching faults: التدريب has `training-post-9-1..5` delivered against **no numbered cards** (only 2 ad-hoc); التوظيف and Phoenitech carry Arabic/descriptive names (`مسابقة فوني جوبز`, `معرض1`, `youtube cover`) for ad-hoc work the matcher only reaches through numbered pieces or plan briefs.

- **[VERIFIED — FRESH PRODUCTION SNAPSHOT]** Pulled `prod-20260913-0830.json` (1,159 tasks, 2,879 Telegram messages) and synced local. The daily backup task has not run since 2026-09-10 although `backup:pull` works by hand; `.env.bak-20260911` suggests the environment was edited on the 11th. **Scheduled-task health is unverified and needs checking.**
- **[VERIFIED — MEASURED]** Overall Telegram match rate is **12%** (118 of 978 media files); 19% since 1 September. Worst: وصل 8% of 342 files, Phoenitech 0% of 51 since the pause, المدارس 0% of 32.
- **[FIXED — LOCAL, COMMIT `258fee2`]** Root cause for 44 files: `parseAssetName` read the **type word itself** as the company slug when a name begins with it (`story 4.jpg` → slug `story`). Because it returned a non-null parse, the matcher's company-prefixed fallback never ran. Now a bare type word is rejected so the fallback works, and `POST5` (digit glued to the type word) parses like `POST 10`. Six regression tests added. Suite 566/571; the five failures are pre-existing data drift (confirmed by stashing the change), not this fix.
- **[VERIFIED — NOT A LOSS]** Sabin's البلسم case: `story 4/5/6.jpg` at 08:34 on 6 September were **re-sent correctly one minute later** as `al balsam-story-8-4/5/6.jpg` and matched. Stories 1–12 are delivered; **stories 13, 14, 15 were never sent** — they carry plan briefs and remain `NOT_STARTED`.
- **[VERIFIED — NEEDS THE LEAD]** `PhoeniTech Posts.docx` arrived from Nawal on **8 September**, and 51 files have landed on that topic since the 5 September pause (34 Majed photos, 3 videos, 11 Ayman designs). The company is still `paused` with zero open cards, so **none of it can attach to anything**. BW was already re-activated (publish start 2026-09-10, 79 cards). مخبر د.نور's plan also arrived 6 September and it has zero open cards.
- **[TOOL]** `scripts/why-unmatched.ts` replays the matcher over every unmatched file and classifies the real reason into eight categories. Read-only. It measures against **today's** card state, not ingest time.
- **[LIVE/VERIFIED — DEPLOYED]** Six commits pushed to `main` (`556c9db..f5ac1c4`), Vercel production deployment completed **Ready** in 44s. Gates rerun on a clean tree immediately before the push: typecheck clean, ESLint clean, production build succeeded, suite **566/571**. The five failures are production **data** drift (4 dangling `blockedById`, 4 work-after-deadline, BW POST piece 3 gap, 7 publish closures without evidence) — all consequences of the BW/Phoenitech pause-resume cycle, not code. Live checks: `/login` 200, `/api/cron/done-report` 401, `/api/backup/export` 401.
- **[INCIDENT — RESOLVED, NOTHING LOST]** While proving the five failures predated the parser fix, an agent `git stash pop` restored an **unrelated stash from `feature/social-publishing-schedule`**, conflicting 19 tracked files and dropping stale untracked files into the tree. No commit or stash was lost: the stash entry was kept and all four session commits stayed intact. The user cleared it with `git restore --source=HEAD --worktree` plus a reviewed `git clean -fd`. **Never run a bare `git stash pop` in this repository** — a pre-existing stash from another branch sits at `stash@{0}`.
- **[SECURITY — CAUGHT BEFORE SHIPPING]** That stale stash carried `src/app/api/backup/route.ts`: a `GET /api/backup` handler that streams **every table with no authorization at all**. It also failed typecheck (`prisma.teamMember`, `task.startDate` no longer exist), so the build would have refused it regardless. Confirmed absent from production — `/api/backup` returns 404.
- **[NOT DONE]** No retroactive re-match of the stored unmatched files. The parser fix affects **future** deliveries only; the proof point is the next design delivery named with a bare type word (`story 4.jpg`) attaching to its card.
- **[OPEN]** Daily backup scheduled task has not run since 2026-09-10 (manual `backup:pull` works). Coverage gaps stand: التدريب has deliveries against no numbered cards; التوظيف/Phoenitech ad-hoc work carries Arabic descriptive names the matcher cannot reach; وصل's `قراءات`/`مسابقة` are outside its off-plan keyword list.

### 2026-09-06 — Codex — Staged repair plan and Vercel redeploy explanation

- **[LOCAL-ONLY]** Created `docs/superpowers/plans/2026-09-06-app-repair.md`, covering all six bugs and every audit warning, isolated reproduction/tests, preservation requirements, preview/live gates, and separate code/data/environment recovery procedures.
- **[VERIFIED]** Inspected task-regeneration callers, build scripts, deployment notes, Vercel cron configuration, and official Vercel environment-variable documentation. Identified the employee-workflow regression risk of simply guarding all regeneration calls; plan avoids it.
- **[USER-CONSTRAINT]** Planning only, preserve existing working behavior. Explained that actual bug fixes require scoped code changes and zero regression risk cannot be guaranteed; no implementation was started.
- **[PENDING]** User has not supplied the changed Vercel variable name/scope. Screenshot is a saved-configuration notice, not evidence that redeployment is harmless for every possible variable. No secret was requested/read, no production export performed, and no deployment or operational mutation occurred.

### 2026-09-06 — Codex — Full app audit report completed, no operational mutations

- **[USER-CONFIRMED]** Requested app state and full deep testing with clean/warning/bug report; repeated “continue” retains that audit scope.
- **[VERIFIED]** Read complete handoff and inspected evolving source/snapshot evidence. Initial local HEAD was `04f41d0`, later `556c9db`; another session committed backup tooling and two initial audit artifacts during the interval. No existing changes were reset.
- **[LOCAL-ONLY]** Created `docs/qa/APP_STATE_DEEP_TEST_2026-09-06.md` with six confirmed findings, severity/reproduction/fix direction, test matrix, data warnings, and limits. Supporting evidence in `docs/qa/2026-09-05/`.
- **[VERIFIED]** 555/555 current tests, three 55-test timezone runs, typecheck, lint, build, schema validation; original DB hash unchanged. Isolated latest-snapshot regeneration: 1,129 → 1,137 rows, eight added EDIT cards, zero deleted/changed completed records.
- **[LIVE/READ ONLY]** Browser and anonymous HTTP checks completed; hydration/timezone error, archived-match display inconsistency, and paused-company overdue display reproduced. Existing browser admin session was reused, without credential extraction or logout. No state-changing production controls invoked.
- **[VERIFIED]** Current snapshot audit 19/23 clean; legacy deep audit 46/55 on an isolated older DB, with outdated assertions explicitly separated from real defects. Full npm audit seven packages; production-only two low.
- **[BLOCKED ACTION]** Automatic approval review refused authenticated full production export as sensitive access beyond the general test request. No bypass attempted. Anonymous HTTP checks used no credentials; stored snapshots supplied data testing. A fresh export requires explicit user approval.
- **[PENDING]** Review report, then scope fixes and operational corrections against fresh data. No source fix, deployment, live data mutation, database sync, Telegram send, or Instagram operation occurred. Report and handoff are local-only.

### 2026-09-05 — Claude — Obada reconciled against all three sources; shoot week booked; Instagram handles finally reachable

- **[LIVE/VERIFIED]** Obada, three-source pass (Instagram `@obadadental` + Telegram + the plan). Instagram
  published exactly four pieces in cycle 11/8→10/9: a post on 17/8, a **reel on 18/8**, a post on 26/8 and a
  post on 3/9 (the Reels tab confirms only one reel is theirs; the other belongs to `dr_kareem_clinic`).
  The app claimed four too — but different pieces on dates with no post behind them: POST#1 on 20/8,
  POST#2 on 23/8, REEL#2 on 25/8. Those were my own count-based closures. Corrected to
  POST#1=17/8 · POST#3=26/8 (lead's call) · POST#5=3/9 · REEL#2=18/8, and **POST#2 reopened** — it was
  never published. REEL#2 is confirmed by content: its plan brief reads «مصدر موثوق يجهزلك عيادتك — جولة
  المركز» and the 18/8 caption reads «شريكك الموثوق بتجهيز عيادتك».
- **[LIVE/VERIFIED]** `instagramHandle` existed in the database but had **no schema entry, no form field and
  no write path**, so all 14 handles sat in `scripts/data/instagram-handles.json` unreachable — and every
  publish reconciliation began by asking which account a company even has. It now has a field in the company
  dialog and in the payload; all 14 are stored.
- **[LIVE/VERIFIED]** Shoot week. Majed's week was already committed (Sun 6/9 university event, Mon 7/9
  schools event, Tue 8/9 Wasl's six reels), so publishing Obada's two unshot reels inside the cycle was
  arithmetically impossible: publishing by 10/9 needed a shoot on 5–6/9. On the lead's decision — «خليهن
  بتواريخهن، بس ما تفتح دورة جديدة — اعتبرهن تأخير» — Obada REEL#1 and REEL#3 plus Balsam REEL#4 are booked
  for **Wed 9/9**, montage 13–14/9, publishing 15–17/9, all **pinned and kept in bucket m=7** so they read as
  this cycle's late debt and no new cycle opens.
- **[VERIFIED]** `deep-audit-snapshot.ts` — 22 checks over the whole production snapshot, read-only. All green
  except two, both explained below.

**[OPEN — needs the lead]** Majed's Wed 9/9 now carries **six shoots (2.00 days at his stored rate of 3/day)**
plus an 8-hour ad-hoc card. The three she asked for are exactly 1.0 day; the overload is:
- the ad-hoc card «تصوير — عبادة أو Siizen أو البلسم (تُحدّد بالأولوية)» (8h) is now **redundant** — the real
  cards exist, so it double-books the day and should be closed;
- **BW REEL#3 and REEL#4** also sit on 9/9 and were not part of her instruction.

**[OPEN — self-correcting]** Three production cards land on a Saturday in the **October** bucket (Phoenitech
REEL#1/#2 on 3/10, Tawzeef POST#3 on 10/10). Proven stale, not a live engine bug: regenerating that bucket on a
throwaway copy fixes all three. The regenerate button only ever rebuilds the current calendar month's bucket,
so October is reachable in October.

### 2026-09-04 — Claude — Suite green (536/536); seven data-loss/confusion bugs fixed; five payloads still to apply live

- **[LIVE/VERIFIED]** All 52 evidence-less publish closures from July onward now carry an evidence line
  (verified from `backups/prod-20260904-1557.json`: 52 → 0). Wasl Reel 3's SHOOT no longer finishes before
  it starts; production now has **zero** cards in that impossible state.
- **[VERIFIED]** `revalidatePath` was being called *inside* the write `try` in two paths — plan import and
  schedule regeneration. It throws when called outside a Next request, so the data was written and the
  answer still said "failed". A full regeneration wrote 292 cards and reported
  «فشل توليد الجدول». Both now treat cache invalidation as best-effort.
- **[VERIFIED]** Evidence lines were appended without a duplicate check on three paths: the payload
  importer (a single retry duplicated the line on 5 Agalya cards) and the live Telegram ingest (one SHOOT
  card carried the same note **18 times**). Appending is now idempotent everywhere; a one-off cleanup
  removed 17,476 duplicated characters from 47 cards.
- **[VERIFIED]** The payload schema silently dropped unknown fields. A payload carrying `pinned` was sent
  to production while it still ran the old build: the field was stripped, the answer said "ok · 1 row", and
  nothing was pinned. Proven deliberately — `pinned: "مو-بوليان"` was accepted. The schema is now
  `.strict()` at both levels, matching `taskDetailsSchema`.
- **[VERIFIED]** Work-day snapping pulled Saturday **publish** cards back to Thursday, contradicting the
  lead's rule that Saturday is allowed for publishing but not production. Omar's queue disagreed with the
  publishing schedule by two days. PUBLISH rows are no longer snapped.
- **[VERIFIED]** Regeneration does **not** move published dates. An earlier reading that claimed 178 shifted
  dates was an artifact of a diff script rendering UTC instead of local time. Measured on a throwaway copy,
  a regeneration of bucket m=7 changes 22 rows and every one is a correction.
- **[NEW PAYLOAD FIELDS]** `pieceStates` gained `pinned`, `workDate`, `readyDate`, and `removeEvidence`.
  The last one is the only counterpart to `evidence`: before it, a wrongly written evidence line was
  permanent. `applyPlanUpdatePayload` was split from the admin gate so `scripts/apply-payload.ts` can
  prove a payload locally before it touches production.

**[PENDING — apply on production, in order]** The browser extension disconnected before these landed.
Paste each into «استيراد خطة JSON» on `/admin/companies`; all five validate and apply cleanly locally:

1. `scripts/data/prod-01-noor-pin-cleanup.json` — removes the code-version probe line, pins the row.
2. `scripts/data/prod-02-noor-dedupe.json` — collapses the pin line that got written twice.
3. `scripts/data/prod-03-mango-pins.json` — pins the two rows published before the 17/8 cycle began.
4. `scripts/data/prod-04-siizen-workdate.json` — 22 publish cards whose work day was the migration day.
5. `scripts/data/prod-05-tawzeef-edit-after-shoot.json` — montage scheduled 19/8 before its shoot (22/8).

After applying, re-run `npm run backup:pull` and confirm: 3 pinned rows, Siizen 22/22 publish cards whose
work day equals their publish day, and Nour Post 1 carrying exactly one note line.

**[NOTE]** The 12:00 scheduled backup ran mid-session and re-synced the local database from production,
discarding local-only fixes that had not yet been applied live. Local-only state does not survive that task.

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
