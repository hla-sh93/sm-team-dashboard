# فحص عميق — security-api (الصلاحيات · الأفعال · الـAPI · التحقّق · التزامن · الأداء · أمان البناء)

> جلسة ١٢/١٠/٢٠٢٦ · worktree `claude/interesting-feistel-0eec40` (`main@c66fa7f`) · الداتا: نسخ معزولة من
> `prisma/dev.db` (= لقطة الإنتاج `prod-20261011-1249`، ١٤٠٣ كرت) باسم `prisma/test-deep-security-*-<pid>.db`
> بتنحذف بآخر كل فحص. **ولا طلب على الإنتاج ولا تلغرام ولا إنستغرام، ولا سيرفر dev، ولا `prisma generate`،
> ولا تعديل على `src/`.** ولا قيمة سرّ انقرت أو انطبعت: الفحوص بتقرأ **أسماء** المفاتيح وبتقارن القيم
> بـ`true/false` بس. كل شي هون **محلي**؛ ما في شي متحقَّق على Vercel.

---

## ١. نطاق الفحص

- **الأفعال:** كل تصدير من ملفات `"use server"` (٤٥ فعل بـ`src/server/actions/*.ts`)، ومين بيستعملها من
  مكوّنات `"use client"`، ومين محروس بـ`assertAdmin`/`guard()`.
- **المسارات:** `src/app/api/**` (٨ ملفات: backup/export · ٤ كرونات · telegram/webhook GET+POST · plan-doc ·
  plan-template) و`src/app/admin/api/plan-update`، والميدلوير، وترويسات `next.config.js`.
- **الدخول:** `src/lib/auth.ts` و`src/server/actions/auth.ts` (scrypt، الكوكي، الصلاحية، القفل، أول تشغيل،
  أسبقية البيئة، تدوير السرّ).
- **ما يوصل للمتصفّح:** props المكوّنات العميلة بصفحات الموظفين (حمولة RSC).
- **المدخلات:** `src/lib/schemas.ts`، CSV، ملف Word (`plan-docx-import.ts`)، معرّفات المسارات.
- **التزامن والأداء:** تعديلات متوازية، إعادة توليد مع تحريك كرت، نقر مزدوج، قياس p50/p95 وعدد الاستعلامات.
- **البناء والأدوات:** `tsc`، `eslint`، `npm audit --omit=dev`، نظافة git من الأسرار، `.gitignore`، خطر عميل
  Prisma المشترك بين النسخ.
- **ارتداد:** QA-001…QA-009 (`docs/qa/FINAL_QA_REPORT.md` §6/§13) وB01 (`APP_STATE_DEEP_TEST_2026-09-06.md`).

## ٢. الاختبارات المضافة

`npx vitest run tests/deep/security` → **٨ ملفات · ٧٠ اختبار: ٣٩ ناجح + ٣١ `it.fails`** (كل `it.fails` عنوانه
`[SA-nn]` = باغ مثبت؛ تأكّدت إنّ كل واحد بيفشل **لسببه** بتشغيل نسخة بلا `.fails`). `tsc --noEmit` نظيف على
المشروع كله، و`eslint` نظيف على ملفاتي. الفحوص يلي بدها قاعدة بتتخطّى بلا `prisma/dev.db`.

| الملف | شو بيفحص | الحالات |
|---|---|---|
| `security-auth-internals.test.ts` | صيغة الكوكي وأعلامها، scrypt، الصلاحية، تبديل `AUTH_SECRET`، أسبقية `ADMIN_PASSWORD`، الخروج، تغيير كلمة المرور (نسخة/نسختين)، القفل تسلسلي/متوازي، قناة التوقيت، أول تشغيل. قاعدة `Setting` بـDDL خام — بلا `dev.db` | ١٧ (٨ fails: SA-04×3، SA-05، SA-06، SA-07×3) |
| `security-authz-matrix.test.ts` | ٢٧ فعل إداري × ٥ كوكيز مزوّرة = ١٣٥ نداء → مرفوض بصفر استعلامات وبصمة ٧ جداول ثابتة؛ وبكوكي صحيحة الـ٢٥ (غير التوليدين، مغطّيين بـ`schedule-authorization`) بتوصل للمنطق؛ أفعال الموظف مفتوحة (توصيف)؛ خريطة المحروس ثابتة | ٥ (١ fails: SA-08) |
| `security-rsc-exposure.test.ts` | props المكوّن العميل لـ`/` `/tasks` `/today` `/publishing` على اللقطة + فحص ثابت للـ`select` | ٧ (٥ fails: SA-01) |
| `security-routes.test.ts` | كرون جرد التصوير (كان ناقص)، backup/export، الويبهوك (الجسم ما بينقرا بلا سرّ، `hours`)، plan-update، الميدلوير، الترويسات على كل المسارات | ١٦ (٤ fails: SA-12×2، SA-13×2) |
| `security-input.test.ts` | مفاتيح غريبة/تعدادات/حدود، ملاحظات بلا حدّ، تواريخ مستحيلة، عنوان فاضي، CSV، ملف Word ضخم | ١١ (٦ fails: SA-10×4، SA-11، SA-09) |
| `security-concurrency.test.ts` | نافذة تعديل قديمة، تعديلان متوازيان، إعادة توليد × تحريك كرت؛ ونظيف: توليدان، createTask مزدوج، updateDailyTasks مزدوج، «جدّد» مزدوج | ٧ (٣ fails: SA-03) |
| `security-repo-hygiene.test.ts` | ملفات بيئة/قواعد SQLite متتبَّعة، مفاتيح الدخول باللقطة، `.gitignore` | ٥ (٣ fails: SA-02) |
| `security-regen-reach.test.ts` | B01 عند الباب + إعادة توليد دلو مسكّر عبر `createTask` بلا جلسة | ٢ (١ fails: SA-15) |

ملف مساعد: `tests/deep/security-fixture.ts`. سكربتات التجارب (`tmp/deep/security-api/`، مو متتبَّعة):
`perf.exp.ts` · `concurrency.exp.ts` · `race-regen2.exp.ts` · `b01-residual.exp.ts` · `b01-aug.exp.ts` ·
`zipbomb.ts` · `plan-doc.exp.ts` · `snapshot-history-auth.ts` · `compare-auth-keys.ts` · `inspect-bak.ts` ·
`db-resolution.ts`. التشغيل: `npx vitest run --config tmp/deep/security-api/vitest.config.ts <file>` أو
`npx tsx <script>`.

الطواقم الموجودة يلي انعادت: `auth` · `access-control` · `schedule-authorization` · `server-action-exposure` ·
`http-boundaries` · `tooling-safety` · `test-database-guard` · `backup` · `schemas` → **٩ ملفات · ٧١ ناجح**.

## ٣. النتائج

> الترتيب بالخطورة. `[VERIFIED]` = مثبت بتجربة؛ `[INFERENCE]` = قراءة كود/حساب بلا تشغيل.

### SA-01 · P0 · bug · صفحات الموظفين (بلا دخول) بتبعت رواتب الفريق وقيم العقود لمتصفّح أي زائر

- **القاعدة:** `PROJECT.md` §2: «Admin‑only routes physically live only under /admin → … (salaries/contracts are
  unreachable)»؛ ومنطقة الموظفين مفتوحة بلا دخول (قرار القائدة).
- **الطريقة:** تعرّض داتا — قراءة كود + استدعاء مكوّنات الخادم بالذاكرة على نسخة اللقطة.
- **الأمر:** `npx vitest run tests/deep/security-rsc-exposure.test.ts`
- **الدليل:** `src/app/OverviewView.tsx:21-22` · `src/app/tasks/TasksView.tsx:18-19` · `src/app/TodayView.tsx:15-16`
  · `src/app/publishing/page.tsx:14-15` كلّهن `prisma.employee.findMany()` و`prisma.company.findMany()` **بلا
  `select`**، والنتيجة بتنعطى كما هي لـ`employees`/`companies` بمكوّنات `"use client"` (`overview-client` ·
  `tasks-client` · `today-client` · `publishing-client`). على اللقطة: props `/publishing` فيها `salary` و`costPerReel`
  (٦ موظفين راتبهم > ٠) و`contractValue` (١١ شركة > ٠)، ومعها `telegramUserId` و`renewals` و`lateExemptReason`
  و`offPlanKeywords`. بالـApp Router كل prop لمكوّن عميل بيتسلسل بحمولة الصفحة ويوصل للمتصفّح (عقد React/Next)،
  حتى لو الشاشة ما بتعرضه. للمقارنة `/companies` (`src/app/companies/page.tsx`) بتبني صفّاً مختصراً — نظيفة.
- **الأثر:** أي حدا معه رابط الموقع بيقرأ رواتب الفريق وقيم عقود الزبائن من مصدر الصفحة — بالضبط الشي يلي نقل
  المالية لـ`/admin` كان لازم يخبّيه.
- **الإصلاح المقترح:** `select` صريح بالمحمّلات الأربعة (DTO مشترك للموظف والشركة بلا `salary`/`costPerReel`/
  `contractValue`؛ يلي بدّه `renewals` لحساب الدورات يحسبه على الخادم أو ياخده بلا حقول مالية)، مع ملف
  `server-only`؛ بعدها بتنقلب الـ`it.fails` الخمسة. `[VERIFIED: محتوى الـprops]` · النقل للمتصفّح = عقد الإطار.

### SA-02 · P0 (مشروط) · bug · سرّ توقيع جلسات الأدمن وبصمة كلمة مرورها بتاريخ git — ووصلوا للإنتاج

- **القاعدة:** `PROJECT.md` §2 («never hardcoded, never sent to the client»)؛ تعليقات `.gitignore`؛ علَم
  CLAUDE_HANDOFF ١٥/٩ على `.env.bak-20260911` («must be rotated and removed from tracking»).
- **الطريقة:** مراجعة تاريخ git — أسماء مفاتيح ومقارنة تساوي بس.
- **الأمر:** `npx tsx tmp/deep/security-api/snapshot-history-auth.ts <نسخة dev.db>` ·
  `npx vitest run tests/deep/security-repo-hygiene.test.ts`
- **الدليل:**
  - `backups/local-db-snapshot.json` بالكوميتات `2509c5a` (٤/٧ ١٩:٥٤) و`4f073f5` و`c6ef42d` (٥/٧) كان حامل بـ`settings`
    المفاتيح `authSecret` و`adminPasswordHash` و`adminEmail` — **قيمها = قيم `prisma/dev.db` المحلي اليوم**. من
    `e374cde` (٨/٧) وطالع انشالوا (`AUTH_KEYS` بـ`src/lib/backup.ts`).
  - وقتها `build` كان `… IMPORT_LOCAL_SNAPSHOT=1 tsx scripts/seed-or-import.ts …`، و`import-snapshot-to-postgres.ts`
    (السطور ١٦٤–٢٠٥ بـ`2509c5a`) بيمحي كل `Setting` وبيحطّ يلي باللقطة، وبيرجّع مفاتيح الإنتاج **بس إذا اللقطة ما
    حملتها**. يعني نشرات ٤–٥/٧ كتبت القيم المحلية على الإنتاج، والاستيرادات بعدها حافظت عليها.
  - `backups/dev.db.pre-fixes-2026-07-08.bak` (SQLite **متتبَّع بـHEAD**) فيه نفس المفاتيح التلاتة بنفس القيم.
  - `.env.bak-20260911` لسا متتبَّع (٨٤ بايت، ما انفتح)، و`.gitignore` ما بيطابق `.env.bak-*`.
  - `backups/local-db-snapshot.json` (متتبَّع عن قصد) فيه ٦ رواتب و١١ قيمة عقد.
- **الأثر:** إذا الإنتاج لسا عم يستعمل سرّ القاعدة هاد (ما في `AUTH_SECRET` على Vercel، وما تغيّرت كلمة المرور من
  `/admin` من ٥/٧ — التغيير بيدوّر السرّ)، أي حدا بيوصل للمستودع على GitLab أو لأي نسخة منه بيقدر يوقّع
  `sm_admin=<exp>.<HMAC>` ويدخل أدمن كامل؛ والبصمة (scrypt N=16384، ~٢٠ms للتخمين) قابلة للكسر offline لكلمة ضعيفة.
- **الإصلاح المقترح (إجراء القائدة):** (١) `AUTH_SECRET` عشوائي طويل على Vercel Production + إعادة نشر، **و**تغيير
  كلمة مرور الأدمن من اللوحة؛ (٢) `git rm --cached .env.bak-20260911 backups/dev.db.pre-fixes-2026-07-08.bak`
  و`.env*` + `!.env.example` بـ`.gitignore`، والنظر بتنظيف التاريخ؛ (٣) تأكيد إنّ مستودع GitLab خاص.
  `[VERIFIED: محتوى git والتساوي محلياً]` · `[INFERENCE: الإنتاج لسا عليه — ما جرّبت توقيع كوكي على الإنتاج]`.

### SA-15 · P1 · warning (قرار قائدة) · B01 انسكّرت عند الباب — بس إعادة توليد **أي** دلو، حتى دورة مسكّرة، لسا بنداء مجهول

- **القاعدة:** B01 (`APP_STATE_DEEP_TEST_2026-09-06.md`: «Full-dataset scheduling should enforce its administrative
  boundary»)؛ وقرار CLAUDE_HANDOFF ٦/٩ إنّ كروت الموظف بتضل تعيد الجدولة.
- **الطريقة:** صلاحيات + فرق صفّ-صفّ على نسخة، بـ`TZ=UTC` (متل Vercel).
- **الأمر:** `npx vitest run tests/deep/security-regen-reach.test.ts` · `TZ=UTC … b01-aug.exp.ts` · `b01-residual.exp.ts`
- **الدليل:** `generateSchedule(2026,7)` بلا كوكي → «غير مصرّح» (B01 نظيفة عند الباب). بس
  `createTask({year:2026, month:7, …})` بلا كوكي → `ok:true` وإعادة توليد كاملة لدلو آب (دورة مسكّرة):
  **٤١ كرت منجز انمحوا وانخلقوا بمعرّفات جديدة**، والكروت المربوطة برسائل تلغرام **٣٧ → ٣١** (٦ أدلّة تسليم صارت
  يتيمة — آلية RG-04). دلو حزيران: ٢٤ منجز بمعرّفات جديدة + **٦ كروت مونتاج «جاهز» جديدة** بدورة مسكّرة
  (١٩٩ → ٢٠٦) وعنوانا كرتَي كتابة تغيّروا. تموز: ٣٠ بمعرّفات جديدة. `year/month` جايين من المتّصل
  (`taskSchema`: ٢٠٢٠–٢١٠٠)، والواجهة نفسها (`TaskForm.tsx:127-141`) بتبعت شهر اللوح المعروض — فموظف بيضيف مهمة
  وهو فاتح شهر قديم بيعمل نفس الشي. وكمان زرّ «إعادة الجدولة» بالرئيسية عند الموظفين (`MonthBar showGenerate`)
  صار دايماً «غير مصرّح»، عكس `PROJECT.md` §2 («regenerate» من صلاحيات الموظف).
- **الأثر:** أي زائر بيعيد كتابة تاريخ دورات مسكّرة (معرّفات، كروت زيادة بالإنجاز، أدلّة تلغرام مقطوعة) — يلي حارس
  B01 انعمل ليمنعه. وكل نداء ~١٠٠ms CPU.
- **الإصلاح المقترح:** بأفعال الكروت أعِد التوليد بس إذا الدلو شغّال (دلو دورة حالية لشركة) أو محصوراً بشركة الكرت
  (`onlyCompanyId`)؛ ارفض `year/month` خارج [الحالي−١، الحالي+١] لأفعال الموظف؛ وخبّي الزرّ الميت عن الموظفين أو
  حدّث `PROJECT.md`. `[VERIFIED]`

### SA-03 · P1 · bug · تحديثات ضايعة على الكروت: لا قفل تفاؤلي ولا معاملة (نفس صنف PU-20 بس أوسع)

- **القاعدة:** WORK_RULES §٢–§٣ (المنجز ما بينمحى، والإعادة بتحفظ اللوح/الحالة)؛ تعليق `schedule-engine.ts`
  («Board/status are always kept»).
- **الطريقة:** تزامن — تداخلات محدّدة على SQLite.
- **الأمر:** `npx vitest run tests/deep/security-concurrency.test.ts`
- **الدليل:**
  - **(أ) نافذة تعديل قديمة:** `TaskForm` بيبعت **كل** الحقول دايماً (`TaskForm.tsx:106-118`). موظف فتح «تعديل»
    (الحالة NOT_STARTED)، زميله سكّر الكرت من اللوح، الأول حفظ تعديل عنوان → الكرت **رجع TODO** وانمسحت طوابعه،
    والحفظ `ok:true`. حتمي، مو سباق.
  - **(ب) تعديلان جزئيان متوازيان:** `updateTaskDetails` بيقرأ `before` وبيكتب كل الحقول منه
    (`tasks.ts:183-243`) → عنوان أ + مسؤول ب بنفس اللحظة: واحد منهن ضاع (التنين `ok:true`).
  - **(ج) إعادة التوليد:** قراءة «الحفظ» (`existing`، `schedule-engine.ts:353`) **برّا** معاملة الاستبدال (`:476`)؛
    `moveCard(DONE)` بيلتزم بهالنافذة → بعد الإعادة الكرت **TODO/NOT_STARTED** بلا طوابع. النافذة ضيّقة (استعلام
    واحد + معالجة)، بس كل إنشاء/تعديل/حذف كرت بيفتحها.
  - (للسجلّ، إداري) «جدّد» بتاريخين مختلفين بنفس اللحظة: التنين `ok:true` وواحد بس انحفظ.
- **الأثر:** «خلّصت» بتختفي بلا أي إشارة، وتقارير الإنجاز بتنقص.
- **الإصلاح المقترح:** قفل تفاؤلي بـ`updatedAt` (`updateMany({ where: { id, updatedAt: before.updatedAt } })` → صفر
  صفوف = «الكرت تغيّر، حدّثي الصفحة»)؛ `TaskForm` يبعت المتغيّر بس؛ قراءة `existing` جوّا المعاملة التفاعلية (أو
  إعادة قراءة board/status قبل `createMany`)؛ على Postgres `SERIALIZABLE` أو قفل صفوف. `[VERIFIED على SQLite]` ·
  Postgres نفس النمط `[INFERENCE]`.

### SA-04 · P2 · bug · الجلسة ما بتنلغى: الخروج، وتغيير كلمة المرور مع `AUTH_SECRET`، والنُّسخ الدافية

- **القاعدة:** `src/lib/auth.ts:64-67` و`actions/auth.ts:114-116` («so EVERY existing session (including any stolen
  cookie…) is invalidated at once»).
- **الطريقة:** صلاحيات — كوكي «مسروقة» بعد كل حدث.
- **الأمر:** `npx vitest run tests/deep/security-auth-internals.test.ts -t SA-04`
- **الدليل:** الكوكي = `exp.HMAC(exp)` بلا معرّف جلسة؛ `logoutAction` بيمسح الكوكي من المتصفّح بس → النسخة المسروقة
  بتضل صالحة ٧ أيام. `rotateAuthSecret` no-op مع `AUTH_SECRET` → تغيير كلمة المرور ما بيلغي شي. وبلا `AUTH_SECRET`:
  `cachedSecret` لكل نسخة خادم وما بيتحدّث → نسخة B دافية بتضل تقبل المسروقة بعد ما A دوّرت السرّ (موثّق بموديولين).
  تغيير `AUTH_SECRET` نفسه بيلغي الكل (نظيف).
- **الأثر:** كوكي مسروقة (HttpOnly+Secure بيصعّبوا سرقتها) ما في طريقة مضمونة لإلغائها غير تبديل `AUTH_SECRET` يدوياً.
- **الإصلاح المقترح:** إصدار/«جيل» جلسة بالقاعدة (`sessionEpoch`) جوّا الـHMAC يتزيد بالخروج وتغيير كلمة المرور،
  وقراءته بلا كاش أبدي (TTL ثواني). `[VERIFIED]`

### SA-05 · P2 · bug · قفل المحاولات: بالتوازي بيتقيّم كلّه، ومين بيعرف الإيميل بيقفل القائدة برّا

- **القاعدة:** `actions/auth.ts:19-44` (بعد ٥ غلطات قفل متصاعد).
- **الطريقة:** تزامن + سلبي.
- **الأمر:** `… security-auth-internals.test.ts -t SA-05`
- **الدليل:** ٢٠ محاولة غلط بـ`Promise.all` → **٢٠ تقيّمت، صفر مقفولة** (فحص القفل قبل `await`s والتسجيل بعدها).
  تسلسلياً القفل شغّال. ٥ محاولات من حدا بيعرف الإيميل → كلمة القائدة الصحيحة «محاولات كثيرة» (لحدّ ١٥ دقيقة،
  ومحاولة وحدة بكل نافذة بتجدّده). العدّاد بالذاكرة لكل نسخة سيرفرلس `[INFERENCE: الحدّ الفعلي = ٥ × عدد النسخ،
  وبيتصفّر بالبرد]`. ما في اعتماد على IP، فتزوير `x-forwarded-for` مو حالة.
- **الإصلاح المقترح:** حجز المحاولة قبل التحقّق (زيادة العدّاد أولاً)، عدّاد مخزّن (جدول/Setting) بمفتاح
  إيميل+IP، وقفل لـ(إيميل+IP) بدل الإيميل لحاله. `[VERIFIED]`

### SA-07 · P2 · warning · مسارات «أول تشغيل» بتسمح بالاستيلاء

- **القاعدة:** `PROJECT.md` §2 «First run has no default credential»؛ ومخاطرة مسجّلة بـCLAUDE_HANDOFF §9
  («First-run admin ownership can be claimed»).
- **الطريقة:** تزامن + جدول قرار على حالة الإعدادات.
- **الأمر:** `… security-auth-internals.test.ts -t SA-07`
- **الدليل:** (١) طلبا إنشاء متزامنان → **التنين** `ok:true` وجلستين أدمن. (٢) كلمة مرور موجودة **بلا** `adminEmail`
  (تثبيت قبل ٤/٧ أو صفّ إيميل انمحى) → شاشة «إنشاء» بتكتب فوق كلمة المرور بلا ما تطلب القديمة. (٣)
  `ADMIN_PASSWORD` بالبيئة بلا إيميل → أول زائر بيسجّل إيميله (وبعدين بيرمي) — القائدة لازم تعرف إيميله لتدخل.
- **الأثر:** اليوم الإنتاج مضبوط (إيميل+كلمة)، فالخطر بس لما الإعدادات تنفرّغ أو تنقص (استيراد، تنظيف).
- **الإصلاح المقترح:** الإنشاء بمعاملة «create-if-absent» (`create` على مفتاح فريد ورفض P2002)، و`isAdminConfigured`
  تعتبر «كلمة موجودة» كافية لمنع الإنشاء. `[VERIFIED]`

### SA-08 · P2 · warning · سبع أفعال مفتوحة مصدَّرة بلا ولا شاشة — اتنين منها بيكتبوا «باسم القائدة»

- **القاعدة:** رأس `tests/server-action-exposure.test.ts` («كل دالة مصدَّرة من ملف "use server" هي نقطة نهاية»).
- **الطريقة:** خريطة الصلاحيات (ثابت) + مانيفست dev.
- **الأمر:** `… security-authz-matrix.test.ts -t SA-08`
- **الدليل:** `completeProductionForPublishedTask` · `deleteTask` · `markPiecesPublished` · `reassignTask` ·
  `setPieceReviewed` · `setStageDone` · `togglePin` — مفتوحة، ولا مكوّن عميل بيستوردها، وكلها بقائمة
  `INTENTIONALLY_PUBLIC` فالحارس الموجود ما بيمسكها. `markPiecesPublished` بيكتب «تأكيد نشر يدوي من القائدة»،
  `setPieceReviewed` بيختم مراجعة القائدة بـ`reviewerId` من المتّصل، و`completeProductionForPublishedTask` بيسكّر **أي**
  كرت بمعرّفه (`blockedById`) أو كل مراحل `pipelineKey` بتاريخ من المتّصل بلا سطر دليل. بمانيفست dev
  (`.next/server/server-reference-manifest.json`) الـ١٤ فعل مسجّلين لصفحات الموظفين `app/page` و`app/tasks/page`.
- **الأثر:** بالإنتاج على الأغلب مش قابلين للنداء (Next 15 بيشيل غير المستعمل وبيعمل معرّفات غير قابلة للتخمين)
  `[INFERENCE — ما انبنى build]`، بس الأمان معلّق على تحسين بالإطار؛ ولو انستعمل أي واحد منهم بشاشة بكرا بيصير
  شهادة «من القائدة» بإيد أي زائر.
- **الإصلاح المقترح:** انقل الأربعة الداخلية لملف عادي (`src/server/task-ops.ts`)، وشيل غير المستعمل، واحرس
  `markPiecesPublished`/`setPieceReviewed` بـ`assertAdmin` إذا رجعوا لشاشة. `[VERIFIED: الخريطة والمانيفست]`

### SA-09 · P2 · bug · ملف Word صغير بيفكّ لمئات الميغا — بلا دخول

- **القاعدة:** PU-18 (رفع Word بلا بوابة، قرار قائدة)؛ `bodySizeLimit: 2mb` بـ`next.config.js`.
- **الطريقة:** مدخل عدائي (zip bomb) + قياس.
- **الأمر:** `npx tsx tmp/deep/security-api/zipbomb.ts 16,64` · `node --max-old-space-size=4096 … zipbomb.ts 256` ·
  `… security-input.test.ts -t SA-09`
- **الدليل:** `readDocx` (`plan-docx-import.ts:65-73`) بيفكّ `word/document.xml` كامل لنصّ بلا حدّ، وبعدين regex على
  كل الفقرات:

  | XML | الحمولة base64 | فكّ + استخراج | ذاكرة |
  |---|---|---|---|
  | ١٦MB | ٧٥KB | ٥٤ + ١٢٣ms | +٨٦MB |
  | ٦٤MB | ٢٩٧KB | ١٣٢ + ٤٧٢ms | +١٥٨MB |
  | ٢٥٦MB | ١١٨٧KB (< ٢MB) | ٦١٨ + ١٨٣٤ms | **+١٠١٢MB** |

  `previewCompanyPlanDocx` بدّه بس `companyId` لشركة نشطة بدورة (المعرّفات بحمولة صفحات الموظفين)، و`applyPlanDocx`
  بيقرأ الملف **مرّتين**. وكمان `fileName` من المتّصل بينكتب بلا حدّ بسطر الدليل.
- **الأثر:** طلب واحد ~١GB ذاكرة و~٢.٥ ثانية CPU؛ كم طلب متوازي بيوقّعوا النسخة.
- **الإصلاح المقترح:** ارفض قبل الفكّ إذا `entry._data.uncompressedSize` (أو حجم مجموع المدخلات) > ~٥MB، وحدّ طول
  `fileName` (١٢٠)، واقرأ الملف مرّة وحدة. `[VERIFIED]`

### SA-11 · P2 · bug · CSV: «;» بيفتح باب الصيغ بإكسل بلغة فاصلها «;»

- **القاعدة:** QA-006 وتعليق `src/lib/csv.ts:9-11` («Exported names/titles are untrusted text»).
- **الطريقة:** مدخل عدائي.
- **الأمر:** `… security-input.test.ts -t SA-11`
- **الدليل:** `toCSV(["h"], [["x;=1+1"]])` → السطر `x;=1+1` **بلا تنصيص** (التنصيص بس لـ`,` `"` `\n`). إكسل بإعدادات
  فاصلها «;» (شائعة بالعربي والأوروبي) بيقسم الخانة وبيقيّم `=1+1`. العناوين بيكتبها أي زائر (`createTask`).
- **الإصلاح المقترح:** نصّص أي خانة فيها `;` أو `\t` أو `\r`، وحيّد بادئة الصيغة بعد أي فاصل. `[VERIFIED: الناتج]` ·
  سلوك إكسل `[INFERENCE]`.

### SA-14 · P2 · warning · تبعيات الإنتاج: `next@15.5.21` تحت تحذيرات أمنية جديدة (بعد QA-007)

- **القاعدة:** QA-007 («no known critical/high runtime advisory»).
- **الطريقة:** `npm audit --omit=dev --json` (١٢/١٠).
- **الدليل:** ١٠ حزم (١ critical · ٧ high · ١ moderate · ١ low). `next` < 15.5.24: «Unauthenticated RCE in Image
  Optimization API when AVIF files are used» + «RCE on windows-hosted servers»؛ < 15.5.27: تسميم كاش SSG/ISR
  (self-hosted). `sharp` < 0.35.4/0.35.5 (libheif/librsvg، high). الباقي أدوات بناء (tailwind/braces/micromatch).
  الإصلاح `next@15.5.27` (مو major).
- **الأثر:** على Vercel/Linux بلا `next/image` ولا `remotePatterns` وبلا صور AVIF الاستغلال بعيد `[INFERENCE]`، بس
  الإطار متأخّر عن ترقيعات أمنية.
- **الإصلاح المقترح:** `next@15.5.27` + `overrides.sharp` ≥ 0.35.5، وإعادة البوابات. `[VERIFIED: ناتج الفحص]`

### SA-06 · P3 · bug · قناة توقيت بتكشف إيميل الأدمن (+ scrypt بمعاملات Node الافتراضية)

- **الدليل:** إيميل غلط → `verifyAdminEmail` بيرجع قبل scrypt (صفر حسابات)؛ إيميل صح → حساب scrypt واحد ≈ **٢٠ms**
  (p50 على هالجهاز). الرسالة نفسها (نظيف) بس الزمن بيفرق. `scryptSync(…, 64)` بـN=16384 (أقل من توصية OWASP
  N=2^17). وكلمة المرور بتنقصّ أطرافها (`trim`). **الأمر:** `… -t SA-06`.
- **الإصلاح المقترح:** حساب scrypt وهمي لما الإيميل غلط، ورفع N. `[VERIFIED]`

### SA-10 · P3 · bug · ثغرات تحقّق صغيرة بمدخلات أفعال الموظف

- **الدليل:** `taskSchema.notes` بلا حدّ (مليون حرف مقبولة)؛ regex التاريخ بيقبل `2026-02-30` (→ ٢ آذار بالصمت) و
  `0026-01-01` (→ **1926** بـ`fromISODate`) و`9999-99-99` (`updateDailyTasks` كمان)؛ `taskDetailsSchema.title` بيقبل `""`.
  المفاتيح الغريبة بتنشال (`taskSchema`) أو بتنرفض (`taskDetailsSchema` strict) — نظيف. **الأمر:** `… -t SA-10`.
- **الإصلاح المقترح:** `.max()` للملاحظات، تحقّق تقويمي للتاريخ (مدى سنين معقول)، `title.min(1)`. `[VERIFIED]`

### SA-12 · P3 · bug · أكواد ورسائل: `export_failed` بيرجّع نصّ الخطأ الداخلي، والرفض ٤٠٠

- **الدليل:** `backup/export/route.ts:36-38` بيرجّع `export_failed: ${e.message}` (رسالة Prisma فيها اسم المضيف/المستخدم)
  — بعد التحقّق من السرّ بس. `/admin/api/plan-update` بيرجّع **400** لـ«غير مصرّح» بدل 401/403. **الأمر:** `… -t SA-12`.
- **الإصلاح المقترح:** رسالة عامّة + `console.error`؛ 401 لـ«غير مصرّح». `[VERIFIED]`

### SA-13 · P3 · warning · تقوية: لا Content-Security-Policy، ومقارنة الأسرار مو ثابتة الزمن

- **الدليل:** الترويسات الخمس موجودة وبتنطبق على كل المسارات (نظيف) بس ما في CSP. مقارنة `CRON_SECRET` وسرّ
  الويبهوك بـ`!==` بستة ملفات. **الأمر:** `… -t SA-13`.
- **الإصلاح المقترح:** CSP أقلّها `frame-ancestors 'none'; object-src 'none'; base-uri 'self'`، و`timingSafeEqual` بعد
  مساواة الأطوال. `[VERIFIED: ثابت]`

### SA-16 · P3 · warning · خطر الجلسات المتعدّدة: عميل Prisma المولَّد مشترك بين النسخة الرئيسية والـworktree

- **القاعدة:** طلب المحور §8 (توثيق بلا إصلاح)؛ ذاكرة «ولّد عميل Prisma بعد وجود .env».
- **الطريقة:** قراءة إعدادات العميل المولَّد + `PRAGMA database_list` (قراءة بس). **الأمر:** `npx tsx tmp/deep/security-api/db-resolution.ts`
- **الدليل:** `node_modules` = junction؛ العميل فعلياً بـ`E:\Hla\Social\sm-team-dashboard\node_modules\.prisma\client`
  (`activeProvider: "sqlite"`، مولَّد ١١/١٠ ١٢:٠٠) و`relativePath: "../../../prisma"` → أي `DATABASE_URL` نسبي
  (`file:./dev.db`) من الـworktree **بيفتح قاعدة النسخة الرئيسية**. اليوم `.env`/`.env.local` بالـworktree بمسار مطلق،
  فالقاعدة المفتوحة `prisma/.deep-ui-test.db` جوّا الـworktree (متحقَّق). وأي `prisma generate --schema=prisma/schema.postgres.prisma`
  (`npm run build`، `db:*:prod`، و`backup:daily` بيخلص بـ`prisma generate`) بيقلب المزوّد للنسختين سوا.
- **الفكرة (ما انطبقت):** بـ`src/lib/db.ts` بالتطوير بس: بعد أول اتصال `PRAGMA database_list` ورفض إذا مسار الملف
  الحقيقي برّا `process.cwd()` إلا بـ`ALLOW_FOREIGN_DB=1`، ومقارنة `activeProvider` مع مخطّط `DATABASE_URL`؛ وفحص
  vitest بيتأكّد إنّ `DATABASE_URL` مطلق لما العميل برّا المستودع؛ وسكربت `scripts/doctor-db.ts` بيطبع الملف والمزوّد.

### SA-17 · P3 · warning · الأداء ممتاز اليوم؛ فهارس ناقصة وحلقة UPDATE

- **الدليل (SQLite محلي، ٧ جولات):**

  | العملية | p50 ms | p95 ms | استعلامات |
  |---|---|---|---|
  | `loadLiveTasks(2026,9)` | ٨ | ١٥ | ٥ |
  | محمّل `/` (OverviewView) | ١٤ | ١٦ | ٨ |
  | محمّل `/tasks` | ٨ | ١٣ | ٩ |
  | محمّل `/today` | ٨ | ٩ | ٩ |
  | محمّل `/publishing` | ٥ | ٥ | ٦ |
  | `loadPeriodReport` (شهر) | ٣٠ | ٣١ | ٤ |
  | `buildTodayBrief` (بلا إرسال) | ١٠ | ٢٢ | ٩ |
  | `generateScheduleInternal` أيلول | ٩١ | ١١٣ | ٢٠ |
  | `generateScheduleInternal` تشرين الأول | ١٤٢ | ١٥٥ | ٣٦ |

  ما في N+1 بالمحمّلات. بالتوليد في حلقة `prisma.task.update` لكل كرت يدوي مفتوح بالدلو (`schedule-engine.ts:558-569`) — ٢٢ من الـ٣٦ استعلام بتوليد تشرين الأول مو SELECT (هالـUPDATEs + المعاملة).
  `Task` عليه فهارس `[year,month]` `[assigneeId]` `[companyId]` `[status]` `[detKey]` — **ما في** على `pipelineKey`
  (مستعمل بالإقفال التتابعي وتأكيد النشر وملف الخطة) ولا على أعمدة التواريخ يلي `monthContinuationWhere` بيعمل عليها
  `OR` → مسح كامل (١٤٠٣ صف اليوم). على Postgres كل استعلام ≈ RTT، فالأرقام بتضل منيحة `[INFERENCE]`.
- **الإصلاح المقترح:** `@@index([pipelineKey, stage])` و`@@index([publishDate])`؛ `updateMany` مجمّعة للكروت اليدوية.

## ٤. ما كان نظيفاً

**مصفوفة الصلاحيات — الأفعال (٤٥):**

| الملف | الأفعال | بيكتب | البوابة | النتيجة |
|---|---|---|---|---|
| `companies.ts` | ١٣ (إنشاء/تعديل/حذف/أرشفة/تجديد/تصحيح/شيل تجديد/إنهاء/ترتيب/إيقاف/رجوع/إعادة دورة/تنظيف أيتام) | ✓ | `assertAdmin` | ✓ ٥ كوكيز مزوّرة → رفض، ٠ استعلام، ولا صف تغيّر؛ الصحيحة بتمرق |
| `employees.ts` | ٣ | ✓ | `assertAdmin` | ✓ |
| `telegram.ts` | ٧ (ربط/فريق/مستلم البريف/إرسال الآن/تراجع/ويبهوك/حالة) | ✓ (+ شبكة) | `guard()` | ✓ (تلغرام مزيّف، fetch محجوب) |
| `schedule.ts` | `generateSchedule` · `generateCompanySchedule` | ✓ | `assertAdmin` | ✓ B01 عند الباب — بس شوف SA-15 |
| `plans.ts` | `applyCompanyPlanUpdate` | ✓ | `assertAdmin` | ✓ |
| `plans.ts` | `previewCompanyPlanDocx` · `applyCompanyPlanDocx` | قراءة / ✓ | مفتوح بقرار | PU-18 + SA-09 |
| `auth.ts` | `loginAction` · `logoutAction` · `changePasswordAction` | ✓ | عامّ بطبيعته / `assertAdmin` | SA-04…07 |
| `tasks.ts` | `createTask` `updateTaskDetails` `deleteTasks` `updateTaskStatus` `moveCard` `updateDailyTasks` `updatePhotoSessionStatus` | ✓ | مفتوح بقرار (شاشات الموظف) | مقصود؛ SA-03، SA-15 |
| `tasks.ts` | السبعة بـSA-08 | ✓ | مفتوح بلا شاشة | SA-08 |

**المسارات:**

| المسار | الحماية | النتيجة |
|---|---|---|
| `GET /api/backup/export` | `CRON_SECRET` bearer | ✓ 503/401/200، `no-store`، GET بس، مفاتيح الدخول مستثناة من اللقطة (`AUTH_KEYS`) |
| `GET /api/cron/{daily-brief,done-report,weekly-digest}` | `CRON_SECRET` | ✓ (`http-boundaries.test.ts`) |
| `GET /api/cron/shoot-appointments` | `CRON_SECRET` | ✓ 503/401/200 — كان بلا تغطية، انضاف |
| `POST /api/telegram/webhook` | `x-telegram-bot-api-secret-token` | ✓ 503/401؛ الجسم ما بينقرا بلا سرّ (٥MB → 401)؛ إعادة نفس التحديث → **TR-08** (محور telegram-reports) |
| `GET /api/telegram/webhook` (تشخيص) | نفس السرّ | ✓ 401؛ `hours` مقصوصة ≤ ١٦٨ لكل القيم الغريبة |
| `GET /api/plan-doc` · `/api/plan-template` | مفتوح بقرار (تعليق المسار) | ✓ قراءة بس؛ `../../etc/passwd` و`' OR 1=1 --` و`%00` وCRLF → 404؛ `Content-Disposition` مرمّز |
| `POST /admin/api/plan-update` | الميدلوير (وجود الكوكي) + `assertAdmin` | ✓ (SA-12 للكود) |
| `middleware.ts` | `/admin` و`/admin/:path*` | ✓ بلا كوكي → `307 /login?from=…`؛ `/api/*` برّا وبتحمي حالها |
| `/login?from=` | لازم يبلّش بـ`/admin` | ✓ ما في open redirect |

- **الكوكي:** `exp.HMAC` بس (لا بصمة ولا سرّ)، HttpOnly، SameSite=Lax، Path=/، ٧ أيام، Secure بالإنتاج. الصلاحية والتوقيع
  الغلط والسرّ الغلط والقمامة → رفض. تبديل `AUTH_SECRET` بيلغي الكل. `ADMIN_PASSWORD` بيغلب القاعدة. نفس رسالة الخطأ
  للإيميل والكلمة. scrypt بملح ١٦ بايت عشوائي.
- **CSRF:** أفعال الإدارة محمية بفحص Origin تبع Next + SameSite=Lax؛ مسار plan-update ما بيوصله كوكي من موقع تاني.
- **XSS:** ولا `dangerouslySetInnerHTML` على داتا (الوحيد CSS ثابت بـ`PeriodReportView.tsx:219`)، ولا `href` من داتا.
- **ارتداد QA-001…009:** QA-001 البناء compile-only ✓ (`tooling-safety` ناجح) · QA-002/003 فشل مغلق ✓ (+كرون التصوير) ·
  QA-005 strict ✓ · QA-006 البادئات ✓ (بس SA-11) · QA-007 → SA-14 (تحذيرات جديدة) · QA-008 `tsc` نظيف ✓ ·
  QA-004 وQA-009 خارج المحور (regen-engine / ui-e2e).
- **أدوات:** `npx tsc --noEmit` نظيف (exit 0). `npx eslint src tests scripts --ext .ts,.tsx`: بـ`src` تحذير واحد
  (`publishing-client.tsx:102` اعتمادية `useMemo`)؛ ٣ أخطاء «rule not found» بملفات محاور تانية
  (`tests/deep/operations-card-actions.test.ts:40` · `operations-live-set.test.ts:38` · `telegram-ingest-webhook.test.ts:31`
  — تعليق `eslint-disable` لقاعدة `@typescript-eslint` مش مفعّلة بالإعداد).
- **git:** ولا توكن تلغرام/مفتاح سحابة/مفتاح خاص/`npg_` بالملفات المتتبَّعة؛ روابط Postgres بـ`.env.example` والفحوص
  placeholders. `.env` `.env.local` `*.env` `*.env.local` ولقطات `prod-*` وقواعد الفحص كلها متجاهلة (غير SA-02).
- **التزامن النظيف:** توليدان لنفس الدلو بنفس اللحظة → لا تكرار (١٩٦ صف، صفر `pipelineKey+stage` مكرّر)؛ `createTask`
  مزدوج → +٢؛ `updateDailyTasks` مزدوج → نفس النتيجة (معاملة)؛ «جدّد» مزدوج بنفس التاريخ → تجديد واحد؛
  `markPiecesPublished` مزدوج → سطر دليل واحد.
- **الكاش:** كل فعل بيكتب بينده `revalidateAll`/`revalidateSafely` أو بيمرق بالمحرّك يلي بينده (الاستثناءات: الدخول
  وتغيير كلمة المرور — ما بيغيّروا صفحات داتا).
- **تلغرام:** ما في مفتاح «تشغيل تجريبي»؛ الحماية الوحيدة من إرسال حقيقي محلياً هي غياب `TELEGRAM_BOT_TOKEN` — وهو غايب
  بـ`.env`/`.env.local` بهالـworktree (فحص وجود بس).

## ٥. حدود الفحص

- ما انعمل `next build` (ممنوع)، فشيل الأفعال غير المستعملة من الإنتاج (SA-08) استنتاج. وسيرفر dev ما كان شغّال،
  فحمولة RSC لـSA-01 مثبتة على مستوى الـprops وعقد الإطار، مو بالتقاط HTTP.
- ما في أي طلب على الإنتاج: بقاء سرّ git على الإنتاج (SA-02) لازم تتأكّد منه القائدة (وجود `AUTH_SECRET` على Vercel،
  وآخر تغيير لكلمة المرور). `.env.bak-20260911` ما انفتح (مصنّف الصلاحيات رفض قراءته، وهاد صحّ).
- Postgres: التداخلات (SA-03) والتوليد المتوازي مقيسة على SQLite؛ سلوك Postgres تحت `READ COMMITTED` استنتاج
  (المتوقّع: التوليد التاني بيفشل بـP2002 بدل التكرار).
- الفرق صفّ-صفّ بالتوليد على هالجهاز (UTC+3) بيطلّع إزاحة يوم على كروت منجزة — هاد أثر منتصف الليل المحلي مقابل UTC
  (UI-09/PU-22/SC-08)، واختفى بـ`TZ=UTC`؛ أرقام SA-15 مأخوذة بـ`TZ=UTC`.
- `npm audit` بتاريخ ١٢/١٠؛ تقييم قابلية الاستغلال على Vercel استنتاج.
- التوقيت (SA-06) مقاس بعدد حسابات scrypt وزمن scrypt محلياً، مو عبر الشبكة.
- **مراجع متقاطعة:** PU-18 (رفع Word مفتوح) · PU-20 (نفس صنف SA-03) · PU-27 (حدّ ٢MB) · TR-08 (إعادة «تم النشر») ·
  RG-04 (المعرّفات الموضعية — آلية الروابط اليتيمة بـSA-15) · UI-09/OP-13 (منتصف الليل).
