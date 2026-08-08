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

/**
 * **الجامع المستمر** — بيضلّ شغّال والقائدة بتسكرول، وبيراكم يلي مرق.
 *
 * ليش منحتاجه غير `INSTAGRAM_SCAN_SCRIPT`؟ لأن انستغرام بيفضّي المنشورات
 * البعيدة عن الشاشة من الـDOM (تدوير افتراضي). فقراءة وحدة بآخر السكرول
 * بترجّع آخر شاشة وبس؛ لازم نلقط أول بأول.
 *
 * والقائدة سألت سؤالاً محقّاً: «كيف بعرف إنك عم تقرا؟» — فالجامع بيعرض
 * **شارة على الصفحة** فيها العدّاد والمدى التاريخي، بتتحدّث قدامها. بلا هالشارة
 * السكرول عمل على أعمى: مرّة راحت تعبها كلها لأن الصفحة انعمل لها تحديث
 * وأنا ما كنت لاقط ولا منشور، وما حدا انتبه.
 *
 * ⚠️ **القراءة بالتوقيت لا بالمراقبة.** أول نسخة استعملت `MutationObserver`
 * على `document.body` بـ`subtree:true`؛ وشبكة انستغرام بتتغيّر آلاف المرات
 * بالثانية وقت السكرول، فكل تغيير كان بيشغّل مسحاً كاملاً — وتجمّد المتصفح
 * فعلياً وضاعت الجلسة. الفحص كل ثانية ونصّ بيلقط نفس الشي (السكرول أبطأ من
 * هيك بكتير) وبيترك الصفحة سليمة. لا ترجع للمراقبة.
 *
 * ⚠️ **والحفظ على القرص لا بالذاكرة.** ضاع تعب السكرول مرتين: مرة بتحديث
 * الصفحة ومرة بإغلاق التبويب — و٨٢ منشوراً راحوا وقت ما كانوا جاهزين للمطابقة.
 * صار كل تغيير بينكتب على `localStorage` بمفتاح فيه اسم الحساب، فالتسليح من
 * جديد بيرجّع يلي انجمع بدل ما يبلّش من الصفر، وما بتختلط شركة بشركة.
 */
export const INSTAGRAM_COLLECTOR_SCRIPT = `(() => {
  const KEY = "__igStore_v1";
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
  if (window.__igStop) window.__igStop();
  const key = KEY + ":" + (location.pathname.split("/")[1] || "");
  const store = new Map();
  try {
    for (const p of JSON.parse(localStorage.getItem(key) || "[]")) store.set(p.shortcode, p);
  } catch (e) {}
  window.__igStore = store;

  const box = document.createElement("div");
  box.id = "__igBadge";
  box.style.cssText =
    "position:fixed;bottom:16px;left:16px;z-index:2147483647;background:#0a8fa3;color:#fff;" +
    "font:600 13px/1.7 system-ui,sans-serif;padding:10px 14px;border-radius:10px;direction:rtl;" +
    "box-shadow:0 4px 16px rgba(0,0,0,.35);pointer-events:none;min-width:200px";
  document.body.appendChild(box);

  let last = -1;
  const tick = () => {
    for (const a of document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')) {
      const m = (a.getAttribute("href") || "").match(/\\/(p|reel)\\/([^/?]+)/);
      if (!m) continue;
      const img = a.querySelector("img[alt]");
      const alt = img ? (img.getAttribute("alt") || "").trim().slice(0, 200) : "";
      const prev = store.get(m[2]);
      // النص البديل بيوصل متأخّر أحياناً (الصورة لسا ما حمّلت) — فمنكمّل الناقص
      // على مرّات لاحقة بدل ما نتجاهل المنشور أو نكرّره.
      if (prev) {
        if (!prev.alt && alt) { prev.alt = alt; last = -1; }
        continue;
      }
      store.set(m[2], {
        shortcode: m[2],
        date: toDate(m[2]),
        kind: m[1] === "reel" ? "REEL" : "POST",
        alt: alt || null,
      });
    }
    if (store.size === last) return;
    last = store.size;
    try { localStorage.setItem(key, JSON.stringify([...store.values()])); } catch (e) {}
    const all = [...store.values()];
    const dated = all.filter((p) => p.date).sort((a, b) => a.date.localeCompare(b.date));
    box.innerHTML =
      "📖 عم أقرا صفحة " + (location.pathname.split("/")[1] || "") + " 💾<br>" +
      "محفوظ: <b>" + all.length + "</b> · بالنص: <b>" + all.filter((p) => p.alt).length + "</b><br>" +
      "من <b>" + (dated[0] ? dated[0].date : "—") + "</b> لـ <b>" +
      (dated.length ? dated[dated.length - 1].date : "—") + "</b>";
  };
  tick();
  const id = setInterval(tick, 1500);
  window.__igStop = () => { clearInterval(id); box.remove(); delete window.__igStop; };
  return JSON.stringify({ armed: true, collected: store.size });
})()`;

/**
 * قراءة يلي انجمع — بترجّع نفس شكل `ScanResult`.
 *
 * بتقرا من `localStorage` مباشرة مو من الذاكرة، فبتشتغل حتى لو التبويب انسكّر
 * وانفتح من جديد بلا تسليح.
 */
export const INSTAGRAM_COLLECTOR_READ = `(() => {
  const key = "__igStore_v1:" + (location.pathname.split("/")[1] || "");
  let store = window.__igStore;
  if (!store) {
    try {
      store = new Map();
      for (const p of JSON.parse(localStorage.getItem(key) || "[]")) store.set(p.shortcode, p);
    } catch (e) { store = null; }
  }
  if (!store || !store.size) return JSON.stringify({ error: "المجمّع مو مسلّح" });
  const posts = [...store.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return JSON.stringify({
    handle: (location.pathname.split("/")[1] || "").replace(/[^\\w.]/g, ""),
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
