# مستند تحليل النظام — إدارة فريق السوشال ميديا

> **ملاحظة تحديث — 27 حزيران 2026:** هذا مستند تحليل تاريخي وليس المرجع
> التشغيلي الحاسم. عند أي تعارض، اعتمد `PROJECT.md` لقواعد النظام الحالية
> و`TESTING.md`/`TEST_REPORT.md` لقواعد الفحص. النظام الحالي يستخدم لوحة
> `/tasks` كبورد رئيسي، وعرض `يومي` هو نفس البورد مفلتر لمهام اليوم فقط، وليس
> تقويماً يومياً مستقلاً.

> **النسخة 2.0** — تحليل قديم لتطبيق Next.js مع قاعدة بيانات حقيقية

---

## 1. نظرة عامة

نظام إدارة وجدولة مهام لفريق سوشال ميديا (5 موظفين، 6+ شركات) مع:

- جدولة تلقائية ذكية تحترم قدرات كل موظف
- لوحة مهام Kanban وتقويم إنتاج أسبوعي/شهري؛ العرض اليومي الحالي هو نفس البورد
  مفلتر لمهام اليوم فقط
- إدارة الأولويات بالسحب والإفلات
- أحمال عمل مرئية
- RTL عربي بالكامل

---

## 2. التقنيات (Tech Stack)

| الطبقة | التقنية | السبب |
|---------|---------|-------|
| **Framework** | Next.js 14 (App Router) | SSR + Server Actions في حزمة واحدة |
| **Language** | TypeScript (strict) | Type safety، تقليل الأخطاء |
| **Styling** | Tailwind CSS | Utility-first، RTL ممتاز |
| **Database** | SQLite + Prisma ORM | محلي، بدون سيرفر، Type-safe queries |
| **Validation** | Zod | Schema validation للنماذج وServer Actions |
| **Forms** | React Hook Form | إدارة نماذج بدون re-renders |
| **UI Primitives** | Radix UI | Dialog, Toast, Dropdown مع a11y |
| **Icons** | Lucide React | أيقونات نظيفة وخفيفة |
| **Date Logic** | date-fns + custom helpers | حساب أيام العمل وعطلة الجمعة-الخميس |

---

## 3. نموذج قاعدة البيانات

### 3.1 الجداول الرئيسية

#### `TeamMember` — أعضاء الفريق
```prisma
model TeamMember {
  id              String   @id @default(cuid())
  name            String
  role            String   // lead | writer | designer | photographer | publisher
  capPost         Float    @default(0)  // قدرة بوستات/يوم
  capReelAi       Float    @default(0)  // قدرة ريل AI/يوم
  capReelVideo    Float    @default(0)  // قدرة ريل تصوير/يوم
  capPlan         Float    @default(0)  // قدرة خطط/يوم
  active          Boolean  @default(true)
  // ...علاقات
}
```

**القدرات الكسرية**: قيمة 0.5 تعني "قطعة كل يومين". مثلاً نوال = 0.5 خطة/يوم → خطة شهرية كل يومين.

#### `Company` — الشركات (العملاء)
```prisma
model Company {
  id              String   @id @default(cuid())
  name            String
  color           String   // لون مميز للتقويم
  priority        Int      // 1 = أعلى أولوية
  posts           Int      // عدد البوستات الشهري
  reelAi          Int      // عدد ريلز AI الشهري
  reelVideo       Int      // عدد ريلز التصوير الشهري
  needsApproval   Boolean  // هل تحتاج موافقة عميل قبل الإنتاج؟
  status          String   // active | paused | archived
  designerId      String?  // المصمم المسؤول
  photographerId  String?  // المصور المسؤول
}
```

#### `Task` — المهام
```prisma
model Task {
  id          String   @id @default(cuid())
  title       String
  type        String   // plan | post | reel_ai | reel_video | custom
  status      String   // in_progress | review | ready | published
  priority    String   // urgent | normal | low
  startDate   DateTime
  endDate     DateTime
  duration    Float    // أيام عمل
  isAuto      Boolean  // مولّدة تلقائياً أم يدوية؟
  targetMonth String?  // YYYY-MM للمهام المُجدولة تلقائياً
  assigneeId  String   // المسؤول
  companyId   String?  // الشركة (null = داخلي)
}
```

#### `Setting` — مفتاح/قيمة لإعدادات التطبيق
```prisma
model Setting {
  key   String @id
  value String
}
```

### 3.2 العلاقات

```
TeamMember ──┬── tasks (1:N as assignee)
             ├── asDesigner (1:N Company)
             └── asPhotographer (1:N Company)

Company ──── tasks (1:N)
        ├── designer → TeamMember
        └── photographer → TeamMember

Task ────── assignee → TeamMember (required)
       └── company  → Company (optional)
```

### 3.3 Indexes للأداء
```prisma
@@index([startDate])
@@index([assigneeId])
@@index([companyId])
@@index([status])
@@index([targetMonth])
```

---

## 4. قواعد العمل (Business Rules)

### 4.1 أيام العمل
- **أيام عمل**: السبت → الأربعاء (5 أيام)
- **عطلة**: الخميس + الجمعة (لكل الفريق)
- المهام لا تُجدول في أيام العطلة أبداً

### 4.2 سير العمل (Workflow)
```
1. نوال (الكاتبة) تكتب الخطة الشهرية للعميل
   ↓
2. (اختياري) العميل يوافق — حسب علم Company.needsApproval
   ↓
3. الإنتاج: المصمم (أيمن) أو المصور (ماجد) أو القائد (هلا كـ backup)
   ↓
4. هلا تراجع كل المحتوى قبل النشر (إلزامي)
   ↓
5. عمر ينشر فور الجاهزية
```

### 4.3 قاعدة Mutual Exclusion للمصمم
المصمم **لا يستطيع** إنتاج بوست وريل AI في **اليوم نفسه**:
- يوم بوستات: 6 بوستات حتى الحد الأقصى
- يوم ريل AI: ريل AI واحد

### 4.4 خوارزمية حساب الحمل
لكل موظف، الحمل الشهري يُحسب كالتالي:
```
consumed_days = Σ (1 / capacity[task.type])  لكل مهمة موكَلة
pct = consumed_days / working_days_in_month × 100

المستويات:
  pct ≤ 85%  → normal (أخضر)
  pct ≤ 100% → warn (أصفر)
  pct > 100% → over (أحمر)
```

### 4.5 أولويات الشركات
- ترتيب رقمي 1-N (الأقل = الأعلى أولوية)
- عند توليد جدول الشهر، الشركة #1 تحجز أيام العمل أولاً
- إذا فاضت الطاقة، الشركات الأقل أولوية تتأخر للشهر التالي

---

## 5. خوارزمية الجدولة التلقائية (Scheduler)

`src/lib/scheduler.ts` → `generateMonthSchedule(year, month, team, companies, existingTasks)`

### المرحلة 1: توليد الخطط
```
ابدأ من اليوم 15 من الشهر السابق
لكل شركة (مرتّبة بالأولوية):
  أنشئ مهمة "خطة الشهر — {اسم الشركة}"
  المسؤول: نوال (أو من له capPlan > 0)
  المدة: ceil(1 / capPlan) أيام عمل
  حدّث cursor الكاتبة لليوم اللي بعد نهاية المهمة
```

### المرحلة 2: توليد الإنتاج
```
لكل شركة (مرتّبة بالأولوية):
  earliest_start = نهاية الخطة + (يومين لو needsApproval، يوم وإلا)
  
  لكل بوست (1..posts):
    سلوت = ابحث عن أول يوم متاح للمصمم بعد earliest_start
       حيث (cap[post] - load[post]) > 0
       و (إذا مصمم: load[reel_ai] == 0)
    إذا ما لقيت → جرّب القائد كـ fallback
    إذا ما لقيت → سجّل warning واستمر
  
  نفس الخطوات لـ reel_ai (مع تطبيق mutual exclusion)
  نفس الخطوات لـ reel_video مع المصور
```

### حماية البيانات الموجودة
- المهام **اليدوية** (isAuto=false) تُحفظ ولا تُحذف
- توليد جديد يحذف فقط المهام التلقائية للـ targetMonth المحدد
- يأخذ بعين الاعتبار الأحمال الموجودة (يدوية + من شهور أخرى)

---

## 6. Server Actions (الـ API)

بدلاً من REST API، نستخدم **Next.js Server Actions** — دوال async تُستدعى من الـ client مباشرة.

### `members.ts`
- `createMember(input)` → إنشاء موظف
- `updateMember(id, input)` → تحديث موظف
- `deleteMember(id)` → حذف موظف

### `companies.ts`
- `createCompany(input)` → إنشاء شركة
- `updateCompany(id, input)` → تحديث شركة
- `deleteCompany(id)` → حذف شركة + إعادة ترقيم الأولويات
- `reorderCompanies(orderedIds[])` → إعادة ترتيب الأولويات

### `tasks.ts`
- `createTask(input)` → إنشاء مهمة يدوية
- `updateTask(id, input)` → تحديث مهمة
- `deleteTask(id)` → حذف مهمة
- `updateTaskStatus(id, status)` → تغيير حالة (تحديث سريع)
- `autoScheduleMonth(year, month)` → توليد جدول شهر كامل
- `clearMonthAutoTasks(year, month)` → حذف كل المهام التلقائية لشهر

كل دالة:
- تُتحقق من المدخلات بـ Zod
- تُرجع `{ ok: true, data }` أو `{ ok: false, error }`
- تستدعي `revalidatePath()` لتحديث الصفحات تلقائياً

---

## 7. الواجهات (Pages)

| المسار | الوصف |
|--------|--------|
| `/` | نظرة عامة — KPIs + أحمال + مهام الأسبوع |
| `/tasks` | بورد المهام + عرض يومي بنفس البورد لمهام اليوم فقط + تقويم أسبوعي/شهري |
| `/workload` | تحليل تفصيلي للأحمال |
| `/priorities` | ترتيب الشركات بالسحب والإفلات |
| `/companies` | إدارة الشركات (CRUD) |
| `/team` | إدارة الفريق (CRUD) |

### 7.1 صفحة المهام الحالية

`/tasks` تستخدم:

- `KanbanBoard` كبورد رئيسي بأعمدة الحالات والتجميع.
- عرض `يومي` يستخدم نفس `KanbanBoard` تماماً، لكن يفلتر المهام على تاريخ اليوم.
- `Calendar` يبقى للعروض الأسبوعية والشهرية الإنتاجية فقط.
- القواعد الحاسمة الحالية موثقة في `PROJECT.md` و`TESTING.md`.

---

## 8. حسابات التواريخ (`src/lib/dates.ts`)

دوال أساسية:
- `isWeekend(date)` → الخميس (4) والجمعة (5)
- `addWorkingDays(start, n)` → إضافة n يوم عمل (يتخطى العطل)
- `addWorkingDaysInclusive(start, n)` → نفس الفكرة بس أول يوم محسوب
- `nextWorkday(date)` → التقدم لأقرب يوم عمل
- `getMonthDays(yr, mo)` → كل أيام الشهر
- `getWorkingDaysInMonth(yr, mo)` → فقط أيام العمل
- `getWeekDays(anchor)` → 7 أيام بترتيب عربي (السبت أولاً)
- `formatDateLong(d)` → "السبت 12 أيار 2026"
- `formatMonthLabel(d)` → "أيار 2026"
- `formatWeekLabel(d)` → "12 - 18 أيار"

---

## 9. Validation (`src/lib/schemas.ts`)

كل مدخلات الفورم والـ Server Actions تمرّ بـ Zod:

```typescript
export const taskSchema = z.object({
  title: z.string().min(1, 'عنوان المهمة مطلوب').max(200),
  type: z.enum(['plan', 'post', 'reel_ai', 'reel_video', 'custom']),
  status: z.enum(['in_progress', 'review', 'ready', 'published']),
  priority: z.enum(['urgent', 'normal', 'low']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration: z.coerce.number().min(0.5).max(60),
  notes: z.string().nullable().optional(),
  assigneeId: z.string().min(1, 'المسؤول مطلوب'),
  companyId: z.string().nullable().optional(),
});
```

الفائدة: لو المستخدم بعت طلب فاسد، يُرفض قبل الوصول للـ DB.

---

## 10. التيمة البصرية (Design Tokens)

### الألوان
```css
--bg:        #0a0a0f   /* خلفية رئيسية */
--bg-elev:   #13131c   /* خلفية مرفوعة */
--bg-card:   #111118   /* خلفية الكروت */
--border:    #2a2a3a   /* حدود */
--fg:        #f4f4f8   /* نص رئيسي */
--fg-dim:    #9090a8   /* نص ثانوي */
--accent:    #d4af37   /* ذهبي - تأكيد */
--success:   #3fb27f   /* أخضر */
--warning:   #e5a04a   /* أصفر */
--danger:    #e0584a   /* أحمر */
--info:      #5a8fd4   /* أزرق */
```

### الخطوط
- **Tajawal** (300, 400, 500, 700, 900) — للنصوص
- **Reem Kufi** (400, 500, 600, 700) — للعناوين

### مبادئ
- زوايا 14px للكروت، 8-10px للعناصر الصغيرة
- borders soft (#1f1f2e) داخلية، borders قوية للتمييز
- لمسات ذهبية على المهم فقط (not everywhere)
- gradient خفيف في الخلفية لإضفاء عمق

---

## 11. الأمان والصلاحيات

**النسخة الحالية (1.0)**: لا يوجد نظام تسجيل دخول. التطبيق مخصص للاستخدام المحلي على جهاز شخص واحد.

**للنسخ القادمة**:
- إضافة Auth.js / Clerk
- صلاحيات حسب الدور (lead يرى/يعدل كل شي، باقي الفريق يرى مهامه فقط)
- Audit log للتعديلات

---

## 12. الأداء

- **Server Components** افتراضياً → أسرع تحميل أولي
- **Client Components** فقط للتفاعلات (forms, drag-drop, filters)
- **Indexes** على الحقول الأكثر استخداماً في الاستعلامات
- **Optimistic Updates** في درج وإفلات الأولويات

---

## 13. Deployment

التطبيق مُهيأ للتشغيل **محلياً** بـ:
```bash
npm run dev   # http://localhost:3000
```

للـ production:
```bash
npm run build && npm run start
```

لو حابة تنشري على Vercel لاحقاً، رح تحتاجي:
- تبديل `sqlite` بـ `postgresql` في `schema.prisma`
- إعداد قاعدة بيانات PostgreSQL (مثل Neon أو Supabase)
- إضافة `DATABASE_URL` في Vercel env vars

---

## 14. ملاحظات للتوسعة

### إضافات مقترحة
1. **Notifications**: إيميل/تنبيه للمهام المتأخرة
2. **Approval Workflow**: نظام موافقات للعملاء عبر رابط
3. **Mobile App**: عبر React Native أو PWA
4. **Reports**: تقارير شهرية تلقائية (PDF/Excel)
5. **Sync**: ربط مع Google Calendar / Notion / ClickUp

### نقاط للمراقبة
- لو فريق أكبر (10+ موظفين)، فكّري في الانتقال لـ PostgreSQL
- لو المهام تتجاوز 1000/شهر، أضيفي pagination
- لو الفريق موزّع جغرافياً، أضيفي time zones

---

**هذا المستند يصف النسخة 2.0 — Next.js + TypeScript + Prisma + SQLite**
**النسخة السابقة (1.0) كانت ملف HTML واحد مع localStorage**
