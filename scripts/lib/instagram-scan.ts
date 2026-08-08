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
  const MONTHS = {january:0,february:1,march:2,april:3,may:4,june:5,july:6,
                  august:7,september:8,october:9,november:10,december:11};
  const out = [];
  const seen = new Set();
  for (const a of document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')) {
    const href = a.getAttribute('href') || '';
    const m = href.match(/\\/(p|reel)\\/([^/?]+)/);
    if (!m) continue;
    const shortcode = m[2];
    if (seen.has(shortcode)) continue;
    seen.add(shortcode);
    const img = a.querySelector('img[alt]');
    const alt = img ? img.getAttribute('alt') : null;
    let date = null;
    if (alt) {
      const d = alt.match(/on\\s+([A-Za-z]+)\\s+(\\d{1,2}),\\s*(\\d{4})/);
      if (d && MONTHS[d[1].toLowerCase()] !== undefined) {
        const dt = new Date(Date.UTC(+d[3], MONTHS[d[1].toLowerCase()], +d[2]));
        date = dt.toISOString().slice(0, 10);
      }
    }
    out.push({
      shortcode,
      date,
      kind: m[1] === 'reel' ? 'REEL' : 'POST',
      alt: alt ? alt.slice(0, 120) : null,
    });
  }
  return JSON.stringify({
    handle: (location.pathname.split('/')[1] || '').replace(/[^\\w.]/g, ''),
    count: out.length,
    withDate: out.filter((p) => p.date).length,
    posts: out,
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
