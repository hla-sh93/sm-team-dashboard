# Social Media Team Dashboard — Shared Agent Handoff

> **Canonical continuity file.** Any Codex or Claude agent continuing this project must read this file completely before inspecting, changing, deploying, or reconciling data. Update the current-state sections and append a session entry before ending meaningful work.

Last updated: **2026-09-15**

Workspace: `C:\Users\hla2-\Videos\Social\socialmediateam-live` (fresh clone of `origin/main` at `ffcd0bc`, 2026-09-15). **⚠️ The former workspace `C:\Users\hla2-\Videos\Social\sm-team-dashboard` no longer holds this repository**: on 2026-09-14 its contents were replaced by the May-2026 zip extraction (`sm-team-dashboard.zip`, Apr-30 code, no `.git`, no handoff). A full day of test/report work was done there on 2026-09-15 against that stale copy before the mismatch was noticed; nothing from it applies to production. The lead's own working folder appears to be `E:\Hla\Social\sm-team-dashboard` (drive not mounted here). Uncommitted local work that may exist there is not in this clone.

Production alias: <https://socialmediateam.vercel.app>

Current phase: **2026-09-16 (19:35) — التوظيف on its September plan only (October renewal removed, August closed, document briefs on the cards); ماجد Wed = التوظيف + فونيتيك, Thu = وصل, rate 6/day; achievement per latest cycle with the span beside each company; task filter active-only. See the 19:35 log entry. Previous: 2026-09-15 (15:20) — company lifecycle rule live: «لم تجدّد» = archive section with auto-closed cards, pause only for active companies on client request (`05a872f`, verified with snapshot 15:15; WORK_RULES §٨). Previous: 2026-09-15 (14:45) — التدريب October course cards live for سابين (Wed 16/9 · Thu 17/9) via the new `courses` payload block (`prod-22`); September training closed on Instagram evidence; see the 14:40 log entry. Earlier text follows.** Previous phase: **2026-09-15 — two live issues from the lead (designer day shows one card; shoot-week re-dating for ماجد/أليسار). Diagnosis and three draft payloads are in the 2026-09-15 log entry; nothing applied, preflight blocked on a production snapshot. Earlier phase text follows.** Full application audit requested by the user; report completed locally at `docs/qa/APP_STATE_DEEP_TEST_2026-09-06.md`. Current local HEAD `556c9db`; 555/555 tests pass. Six confirmed audit findings remain, including unguarded full regeneration, inconsistent overdue reporting, live Today hydration/timezone and Telegram-match display defects, eight dangling dependencies in the latest saved snapshot, and an audit exit-code defect. Latest saved snapshot is 2026-09-05 10:26 Baghdad (1,129 tasks); live browser inspected 2026-09-06. No audit fix, production mutation, deployment, or local database sync performed. Earlier company states and next actions below are historical and must be reconciled with newer dated entries before use.**

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
