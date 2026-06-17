/**
 * In-memory §8 seed state for the pure scheduler — mirrors prisma/seed.ts.
 * Used by the acceptance suite (§9) so tests run with no DB.
 */
import type {
  AdhocInput,
  CompanyInput,
  EmployeeInput,
  SchedulerState,
} from "@/lib/scheduler";

export const EMP = {
  ayman: "e_ayman",
  sabin: "e_sabin",
  hla: "e_hla",
  nawal: "e_nawal",
  omar: "e_omar",
  photo: "e_photo",
};

export function specEmployees(): EmployeeInput[] {
  return [
    {
      id: EMP.ayman,
      name: "أيمن",
      role: "designer",
      hoursPerDay: 6,
      workDays: [0, 1, 2, 3, 4], // Sun→Thu
      isScheduled: true,
      isPhotographer: false,
    },
    {
      id: EMP.sabin,
      name: "سابين",
      role: "designer",
      hoursPerDay: 6,
      workDays: [6, 0, 1, 2, 3], // Sat→Wed
      isScheduled: true,
      isPhotographer: false,
    },
    {
      id: EMP.hla,
      name: "حلا",
      role: "lead",
      hoursPerDay: 3,
      workDays: [6, 0, 1, 2, 3],
      isScheduled: true,
      isPhotographer: false,
    },
    {
      id: EMP.nawal,
      name: "نوال",
      role: "writer",
      hoursPerDay: 6,
      workDays: [6, 0, 1, 2, 3],
      isScheduled: false,
      isPhotographer: false,
    },
    {
      id: EMP.omar,
      name: "عمر",
      role: "publisher",
      hoursPerDay: 6,
      workDays: [6, 0, 1, 2, 3],
      isScheduled: false,
      isPhotographer: false,
    },
    {
      id: EMP.photo,
      name: "المصور",
      role: "photographer",
      hoursPerDay: 6,
      workDays: [6, 0, 1, 2, 3, 4], // Sat→Thu
      isScheduled: false,
      isPhotographer: true,
    },
  ];
}

export function specCompanies(): CompanyInput[] {
  const mk = (
    id: string,
    name: string,
    priority: number,
    posts: number,
    reels: number,
    aiReels: number,
    stories: number,
    postOwnerId: string | null,
    storyOwnerId: string | null,
    aiReelOwnerId: string | null,
  ): CompanyInput => ({
    id,
    name,
    managed: true,
    priority,
    status: "active",
    posts,
    reels,
    aiReels,
    stories,
    postOwnerId,
    storyOwnerId,
    aiReelOwnerId,
    defaultOwnerId: null,
  });
  return [
    mk("c_bw", "BW", 1, 4, 4, 0, 8, EMP.ayman, EMP.ayman, null),
    mk("c_phx", "Phoenitech", 2, 4, 4, 0, 8, EMP.sabin, EMP.sabin, null),
    mk("c_nour", "مخبر د.نور", 3, 6, 6, 0, 8, EMP.sabin, EMP.sabin, null),
    mk("c_pro", "برو", 4, 6, 8, 0, 12, EMP.sabin, EMP.ayman, null),
    mk("c_mall", "المول الصيني", 5, 10, 3, 0, 15, EMP.ayman, EMP.ayman, null),
    mk("c_jadarat", "جدارات", 6, 6, 0, 6, 12, EMP.sabin, EMP.sabin, EMP.ayman),
    mk("c_tadreeb", "التدريب", 7, 7, 0, 0, 0, EMP.ayman, EMP.ayman, null),
    // Design-only (managed=false): excluded from content generation (§4.9).
    {
      id: "c_schools",
      name: "المدارس",
      managed: false,
      priority: 90,
      status: "active",
      posts: 0,
      reels: 0,
      aiReels: 0,
      stories: 0,
      postOwnerId: null,
      storyOwnerId: null,
      aiReelOwnerId: null,
      defaultOwnerId: EMP.hla,
    },
    {
      id: "c_cabriani",
      name: "كابرياني",
      managed: false,
      priority: 91,
      status: "active",
      posts: 0,
      reels: 0,
      aiReels: 0,
      stories: 0,
      postOwnerId: null,
      storyOwnerId: null,
      aiReelOwnerId: null,
      defaultOwnerId: EMP.hla,
    },
  ];
}

export function specAdhoc(): AdhocInput[] {
  return [
    {
      id: "a_profile",
      title: "تصميم بروفايل كابرياني",
      companyId: "c_cabriani",
      assigneeId: EMP.sabin,
      hours: 8,
      priority: "URGENT",
      status: "NOT_STARTED",
      readyDate: null,
    },
    {
      id: "a_website",
      title: "تصميم موقع كابرياني",
      companyId: "c_cabriani",
      assigneeId: EMP.hla,
      hours: 24,
      priority: "URGENT",
      status: "IN_PROGRESS",
      readyDate: null,
    },
  ];
}

export function specState(
  year = 2026,
  month = 6, // July 2026 (clean 4-week window inside the month)
  withAdhoc = true,
): SchedulerState {
  return {
    year,
    month,
    employees: specEmployees(),
    companies: specCompanies(),
    adhoc: withAdhoc ? specAdhoc() : [],
  };
}
