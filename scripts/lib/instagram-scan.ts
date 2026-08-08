/**
 * قراءة شبكة منشورات انستغرام **من صفحة مفتوحة أصلاً** — بلا API وبلا سحب.
 *
 * القائدة (8/8): «أنا اتصفح وانت تراقب المنشورات والتواريخ؟» — وهاد بالضبط
 * الفرق يلي بيهم: **هي** بتفتح وبتسكرول (نشاط بشري طبيعي على جهازها وجلستها)،
 * وأنا بس بقرا الـDOM يلي انعرض. ولا طلب شبكة زيادة، ولا تنقّل آلي، ولا بصمة
 * متصفح مؤتمت — يعني ولا واحد من أسباب الحظر يلي رفضناها.
 *
 * المفتاح إنّ انستغرام بيحط تاريخ المنشور بالنص البديل للصورة:
 *   alt="Photo by wasl.fx on August 05, 2026. May be an image of text."
 * فمنقدر نقرا تاريخ كل منشور ونوعه ورابطه من الشبكة نفسها، بلا ما نفتح ولا
 * منشور — وهاد بيخلّي «السكرول» يكفي.
 *
 * هالملف بيصدّر السكربت يلي بينحقن بالصفحة + مفسّر نتيجته. القراءة بتصير
 * بأدوات المتصفح، والمطابقة بتصير بالسيرفر.
 */

/** منشور واحد كما انقرا من الشبكة. */
export type ScannedPost = {
  /** الرمز القصير برابط المنشور — معرّفه الثابت عند انستغرام. */
  shortcode: string;
  /** تاريخ النشر (ISO) — من النص البديل. null إذا ما انقرا. */
  date: string | null;
  /** ريل ولا منشور عادي — من شكل الرابط. */
  kind: "REEL" | "POST";
  /** أول سطر من النص البديل — بيساعد بالمطابقة لما التاريخ ملتبس. */
  alt: string | null;
};

/**
 * السكربت يلي بينقرا بالصفحة. نصّ صرف حتى ينحقن كما هو بـ`javascript_tool`.
 *
 * ما بيعمل شي غير القراءة: `document.querySelectorAll` وبس — ولا نقرة، ولا
 * سكرول، ولا `fetch`.
 */
export const INSTAGRAM_SCAN_SCRIPT = `(() => {
  // رمز المنشور نفسه بيحمل وقت نشره: base64 مخصّص → معرّف الوسائط، وأعلى
  // بتاته طابع زمني. هالطريقة أوثق من النص البديل — الأخير بيتغيّر شكله
  // (أحياناً «on August 05, 2026» وأحياناً «in اللاذقية» بلا تاريخ أصلاً)،
  // والرمز ثابت. انتحقّق منه على حساب المخبر: Da7h_w7t-oo → 2026-07-18،
  // وهو نفس التاريخ المكتوب تحت المنشور.
  const AB = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const toDate = (sc) => {
    let id = 0n;
    for (const ch of sc.slice(0, 11)) {
      const i = AB.indexOf(ch);
      if (i < 0) return null;
      id = id * 64n + BigInt(i);
    }
    const d = new Date(Number(id >> 23n) + 1314220021721);
    return d.getFullYear() > 2010 && d.getFullYear() < 2100 ? d.toISOString().slice(0, 10) : null;
  };
  const seen = new Set();
  const posts = [];
  for (const a of document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')) {
    const m = (a.getAttribute('href') || '').match(/\/(p|reel)\/([^/?]+)/);
    if (!m || seen.has(m[2])) continue;
    seen.add(m[2]);
    const img = a.querySelector('img[alt]');
    posts.push({
      shortcode: m[2],
      date: toDate(m[2]),
      kind: m[1] === 'reel' ? 'REEL' : 'POST',
      alt: img ? (img.getAttribute('alt') || '').slice(0, 120) : null,
    });
  }
  posts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return JSON.stringify({
    handle: (location.pathname.split('/')[1] || '').replace(/[^\w.]/g, ''),
    count: posts.length,
    withDate: posts.filter((p) => p.date).length,
    posts,
  });
})()`;

export type ScanResult = {
  handle: string;
  count: number;
  withDate: number;
  posts: ScannedPost[];
};

/** المنشورات مرتّبة بالأحدث، ومحصورة بمدى تاريخي (اختياري). */
export function postsInRange(scan: ScanResult, fromISO?: string, toISO?: string): ScannedPost[] {
  return scan.posts
    .filter((p) => p.date && (!fromISO || p.date >= fromISO) && (!toISO || p.date <= toISO))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}
