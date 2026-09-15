/**
 * الشركة الموقوفة ما بيطلع من كروتها شي — قرار القائدة ١٥/٩/٢٠٢٦.
 *
 * جدارات موقوفة النشر وكانت ١٢ كرت نشر إلها بتطلع بقائمة «متأخر النشر»، لأنّ
 * القاعدة كانت مطبّقة بالبريف والنظرة العامة بس. صارت بمكان واحد وبتنطبّق على
 * كل مجموعة حيّة.
 */
import { describe, expect, it } from "vitest";
import {
  dormantCompanyIds,
  hideDormantCompanyWork,
  isDormantCompany,
} from "@/lib/company-visibility";

const companies = [
  { id: "c_wasl", status: "active" },
  { id: "c_jadarat", status: "paused" },
  { id: "c_mall", status: "archived" },
];

describe("الشركة الموقوفة/المؤرشفة", () => {
  it("موقوفة أو مؤرشفة = مركونة؛ النشطة لأ", () => {
    expect(isDormantCompany({ status: "paused" })).toBe(true);
    expect(isDormantCompany({ status: "archived" })).toBe(true);
    expect(isDormantCompany({ status: "active" })).toBe(false);
    expect([...dormantCompanyIds(companies)].sort()).toEqual(["c_jadarat", "c_mall"]);
  });

  it("بتشيل كل كروت الشركة المركونة وبتترك الباقي وكروت بلا شركة", () => {
    const tasks = [
      { id: "t1", companyId: "c_wasl" },
      { id: "t2", companyId: "c_jadarat" },
      { id: "t3", companyId: "c_mall" },
      { id: "t4", companyId: null },
    ];
    expect(hideDormantCompanyWork(tasks, companies).map((t) => t.id)).toEqual(["t1", "t4"]);
  });

  it("ما بتلمس المجموعة لما ولا شركة مركونة", () => {
    const tasks = [{ id: "t1", companyId: "c_wasl" }];
    expect(hideDormantCompanyWork(tasks, [{ id: "c_wasl", status: "active" }])).toBe(tasks);
  });
});
