/**
 * يخلّي ملف Word عربياً **بالافتراض**، لا بكل فقرة على حدة.
 *
 * القائدة (١٨/٩): «القوالب كلها لازم تكون يمين يسار… محاذاة واتجاه النص. عم
 * نكتب عربي نحنا».
 *
 * الفحص على الملف المولَّد طلّع إنّ كل فقرة فيه أصلاً `<w:bidi/>` و`jc=right`
 * وكل رَنّة `<w:rtl/>` — يعني المكتوب عربي صحيح. المشكلة بـ**الفاضي**:
 * `docDefaults` بتطلع `<w:pPrDefault/>` فاضية، فأي فقرة أو صف بتضيفه نوال
 * بإيدها بيرث اتجاهاً من اليسار لليمين، والقالب هو بالضبط ملف بينتعبّى بالإيد.
 *
 * ومكتبة `docx` ما بتقبل `bidirectional` بالأنماط الافتراضية (بتقبل المحاذاة
 * والرَنّة وبس)، فالحلّ بعد التوليد: نفتح الحزمة ونحطّ الافتراض بـ`styles.xml`.
 */
import JSZip from "jszip";

const P_DEFAULT = "<w:pPr><w:bidi/><w:jc w:val=\"right\"/></w:pPr>";

/** يحقن اتجاه اليمين لليسار بالأنماط الافتراضية وبنمط Normal. */
export function patchStylesForRtl(stylesXml: string): string {
  let xml = stylesXml;

  // 1) الافتراض العام: كل فقرة جديدة بالملف عربية.
  if (/<w:pPrDefault\s*\/>/.test(xml)) {
    xml = xml.replace(/<w:pPrDefault\s*\/>/, `<w:pPrDefault>${P_DEFAULT}</w:pPrDefault>`);
  } else if (/<w:pPrDefault>\s*<\/w:pPrDefault>/.test(xml)) {
    xml = xml.replace(/<w:pPrDefault>\s*<\/w:pPrDefault>/, `<w:pPrDefault>${P_DEFAULT}</w:pPrDefault>`);
  } else if (/<w:pPrDefault>/.test(xml) && !/<w:pPrDefault>[\s\S]*?<w:bidi\s*\/>/.test(xml)) {
    xml = xml.replace(/<w:pPrDefault>\s*<w:pPr>/, "<w:pPrDefault><w:pPr><w:bidi/>");
  } else if (!/<w:pPrDefault/.test(xml) && /<w:docDefaults>/.test(xml)) {
    xml = xml.replace("</w:docDefaults>", `<w:pPrDefault>${P_DEFAULT}</w:pPrDefault></w:docDefaults>`);
  }

  // 2) نمط Normal: Word بيبني عليه كل فقرة بلا نمط، وبيقرا منه اتجاه الجداول
  //    الجديدة يلي بتنضاف بالإيد.
  const normal = /<w:style\b[^>]*w:styleId="Normal"[^>]*>([\s\S]*?)<\/w:style>/;
  const match = xml.match(normal);
  if (match && !/<w:bidi\s*\/>/.test(match[1])) {
    const inner = /<w:pPr>/.test(match[1])
      ? match[1].replace("<w:pPr>", "<w:pPr><w:bidi/><w:jc w:val=\"right\"/>")
      : `${match[1]}${P_DEFAULT}`;
    xml = xml.replace(normal, `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>${inner}</w:style>`);
  } else if (!match && /<w:styles\b[^>]*>/.test(xml)) {
    xml = xml.replace(
      /(<w:styles\b[^>]*>)/,
      `$1<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>${P_DEFAULT}</w:style>`,
    );
  }
  return xml;
}

/**
 * يرجّع نفس ملف Word بعد ما يصير اتجاهه الافتراضي عربياً.
 *
 * بيشتغل على الحزمة نفسها (docx = zip)، فما بيمسّ المحتوى ولا التنسيق — بس
 * `styles.xml`.
 */
export async function withArabicDefaults(buffer: Buffer | Uint8Array): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const styles = zip.file("word/styles.xml");
  if (!styles) return Buffer.from(buffer);
  zip.file("word/styles.xml", patchStylesForRtl(await styles.async("string")));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
