/**
 * الشغل **خارج الخطة**: العنوان هو بريفه، والحرّاس على مطابقته.
 *
 * الكرت خارج الخطة ما إله بريف — إله عنوان («صور معرض LTCPC»). ومطابقة
 * المحتوى كانت تتجاهل العنوان تماماً، فالكرت بيوقع من الحساب كلّه مهما كان
 * اسم الملف واضحاً، وبيضل مفتوحاً.
 *
 * ⚠️ وهون حدّ مقصود: هالكروت بتدخل السلّة لما ما يكون في كرت قطعة مفتوح من
 * نوع الملف — **ما بتنافس** كروت الخطة. جرّبت أخلّيها تنافس وقستها على ٧٨٦
 * ملف مخزَّن: عشر مطابقات كلهن غلط («مسابقة.jpg» سكّرت كرت خطة تشرين،
 * و«انضمام شركة الزين.jpg» سكّرت كرت كتابة). وبعد حارسين نزلت لأربعة — وكمان
 * كلهن غلط: «٣٠ يوم من الانطلاق.jpg» راحت لكرت تقرير «٩٠ يوم». خطة التوظيف
 * مكتوبة بمفردات متشابهة بين الأسابيع فالكلمة المشتركة ما بتميّز. الطريق
 * الموثوق للشغل خارج الخطة هو الاسم أو الإقفال من اللوحة.
 */
import { describe, expect, it } from "vitest";
import { matchDelivery, type Delivery, type MatchCandidate } from "@/lib/telegram/match";

const delivery = (fileName: string, kind: "VIDEO" | "PHOTO" = "PHOTO", day = 3): Delivery => ({
  id: "x",
  chatId: "c",
  messageId: 1,
  sentAt: new Date(2026, 8, day), // أيلول
  senderId: null,
  senderName: null,
  kind,
  fileName,
  caption: null,
  fileId: null,
  mediaGroupId: null,
});

const piece = (o: Partial<MatchCandidate> & { id: string }): MatchCandidate =>
  ({
    type: "POST",
    stage: "DESIGN",
    month: 8,
    year: 2026,
    pieceNo: 1,
    readyDate: new Date(2026, 8, 6),
    publishDate: new Date(2026, 8, 8),
    brief: "بوست عن خدمات الاستضافة والدومينات",
    ...o,
  }) as MatchCandidate;

/** كرت خارج الخطة: بلا نوع وبلا رقم قطعة — عنوانه هو هويته. */
const adhoc = (o: Partial<MatchCandidate> & { id: string }): MatchCandidate =>
  ({
    type: null,
    pieceNo: null,
    stage: "DESIGN",
    month: 8,
    year: 2026,
    readyDate: new Date(2026, 8, 6),
    publishDate: null,
    brief: null,
    ...o,
  }) as MatchCandidate;

const BUCKET = { year: 2026, month: 8 };

describe("الكرت خارج الخطة بينقرا بعنوانه", () => {
  it("«معرض1.png» بتسكّر كرت «صور معرض LTCPC» لما ما يكون في كرت قطعة مفتوح", () => {
    // فونيتيك: ملفات `معرض1-7.png` ما إلها رقم قطعة ولا نوع، فالاسم والنوع
    // الاتنين ما بيوصلوها — والعنوان هو الطريق الوحيد.
    const hit = matchDelivery(
      delivery("معرض1.png"),
      "Phoenitech",
      [adhoc({ id: "adhoc_maarad", title: "صور معرض LTCPC" })],
      [],
      [],
      BUCKET,
    );
    expect(hit?.taskId).toBe("adhoc_maarad");
    expect(hit?.by).toBe("BRIEF");
  });

  it("وكروت الخطة بتضل هي السلّة لما تكون مفتوحة — ما في منافسة", () => {
    // الحدّ المقصود: وجود كرت بوست مفتوح بيعني إنّ الصورة إلها، والكرت خارج
    // الخطة ما بيزاحمه على كلمة مشتركة.
    const hit = matchDelivery(
      delivery("معرض1.png"),
      "Phoenitech",
      [piece({ id: "post1" }), adhoc({ id: "adhoc_maarad", title: "صور معرض LTCPC" })],
      [],
      [],
      BUCKET,
    );
    expect(hit?.taskId).not.toBe("adhoc_maarad");
  });

  it("والبريف بيغلب العنوان لما الاتنين موجودين", () => {
    const hit = matchDelivery(
      delivery("خدمات الاستضافة.png"),
      "Phoenitech",
      [piece({ id: "post1" })],
      [],
      [],
      BUCKET,
    );
    expect(hit?.taskId).toBe("post1");
  });
});

describe("وحرّاس المطابقة خارج الخطة", () => {
  it("صورة ما بتسكّر كرت كتابة — تسليم الكتابة ملف مو صورة", () => {
    // «انضمام شركة الزين.jpg» كانت تسكّر كرت لينكد إن (WRITE) وقت ما جرّبت
    // فتح المنافسة. الحارس بيضل لازم بمسار الاحتياطي كمان.
    const hit = matchDelivery(
      delivery("انضمام شركة الزين.jpg"),
      "Tawzeef",
      [adhoc({ id: "w_linkedin", stage: "WRITE", title: "لينكد إن — انضمام شركات جديدة" })],
      [],
      [],
      BUCKET,
    );
    expect(hit).toBeNull();
  });

  it("والمسلَّم ما بينسلّم مرتين — كرت مسكَّر بنفس الوصف بيوقف المطابقة", () => {
    // الكرت خارج الخطة ما إله رقم قطعة، فقاعدة إعادة الإرسال يلي بفرع الاسم ما
    // بتطاله. بلا هالحارس، إعادة إرسال شغل خلص بتسكّر الكرت الجاي يلي بيشارك
    // نفس الكلمة.
    // بلا رقم بآخر الاسم: الرقم بيخلّي فرع الاسم يقرا «قطعة ٢» ويوقف قبل
    // مطابقة المحتوى — سلوك قديم مقصود، مو موضوع هالفحص.
    const open = adhoc({ id: "next_maarad", title: "صور معرض الرياض" });
    const done = adhoc({ id: "done_maarad", title: "صور معرض الرياض" });
    expect(matchDelivery(delivery("معرض الرياض.png"), "Phoenitech", [open], [], [], BUCKET)?.taskId).toBe(
      "next_maarad",
    );
    expect(matchDelivery(delivery("معرض الرياض.png"), "Phoenitech", [open], [], [done], BUCKET)).toBeNull();
  });
});
