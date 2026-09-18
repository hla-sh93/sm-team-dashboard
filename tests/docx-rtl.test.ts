/**
 * الاتجاه العربي **الافتراضي** بملف Word.
 *
 * القائدة (١٨/٩): «القوالب كلها لازم تكون يمين يسار… عم نكتب عربي نحنا».
 * الفحص على الملف المولَّد طلّع إنّ كل فقرة مكتوبة فيه عربية أصلاً؛ الناقص هو
 * الفاضي: `docDefaults` كانت `<w:pPrDefault/>` فاضية، فأي صف أو سطر بتضيفه
 * نوال بإيدها بيرث اتجاهاً من اليسار لليمين — والقالب ملف بينتعبّى بالإيد.
 */
import { describe, expect, it } from "vitest";
import { patchStylesForRtl } from "@/lib/docx-rtl";

const wrap = (inner: string) => `<?xml version="1.0"?><w:styles xmlns:w="x">${inner}</w:styles>`;
const EMPTY_DEFAULTS = wrap(
  '<w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="18"/></w:rPr></w:rPrDefault><w:pPrDefault/></w:docDefaults>',
);

describe("الاتجاه الافتراضي بـstyles.xml", () => {
  it("بتعبّي `pPrDefault` الفاضية بالاتجاه والمحاذاة", () => {
    const out = patchStylesForRtl(EMPTY_DEFAULTS);
    expect(out).toContain("<w:pPrDefault><w:pPr><w:bidi/><w:jc w:val=\"right\"/></w:pPr></w:pPrDefault>");
  });

  it("بتضيف نمط Normal لما ما يكون موجود", () => {
    const out = patchStylesForRtl(EMPTY_DEFAULTS);
    expect(out).toMatch(/w:styleId="Normal"[\s\S]*?<w:bidi\/>/);
  });

  it("بتحقن الاتجاه بنمط Normal الموجود بلا ما تمحي خصائصه", () => {
    const out = patchStylesForRtl(
      wrap(
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="60"/></w:pPr></w:style>',
      ),
    );
    expect(out).toContain("<w:bidi/>");
    expect(out).toContain('<w:spacing w:after="60"/>');
  });

  it("بتحقن الاتجاه بـ`pPrDefault` يلي فيها خصائص أصلاً", () => {
    const out = patchStylesForRtl(
      wrap('<w:docDefaults><w:pPrDefault><w:pPr><w:spacing w:after="40"/></w:pPr></w:pPrDefault></w:docDefaults>'),
    );
    expect(out).toContain("<w:pPr><w:bidi/><w:spacing");
  });

  it("إعادة التطبيق ما بتكرّر الاتجاه", () => {
    const once = patchStylesForRtl(EMPTY_DEFAULTS);
    const twice = patchStylesForRtl(once);
    expect(twice).toBe(once);
    expect((twice.match(/<w:bidi\/>/g) ?? []).length).toBe(2); // الافتراض + Normal
  });

  it("ملف بلا `docDefaults` ما بيتكسّر", () => {
    const out = patchStylesForRtl(wrap(""));
    expect(out).toContain("w:styleId=\"Normal\"");
    expect(out).toContain("<w:bidi/>");
  });
});
