/**
 * Finance — per-contract profit/loss, team capacity, and break-even.
 *
 * Model (monthly, plan-driven — independent of task completion):
 *   Revenue  = Σ company.contractValue.
 *   Cost     = fixed salaries (Σ employee.salary) + variable per-reel costs
 *              (freelance photographers paid by the job: costPerReel × reels).
 *
 * Each salaried employee's salary is spread across the companies they work for,
 * proportional to the WORK-DAYS each company consumes from them (activity-based
 * costing) — so per-contract profits roll up to the overall profit (minus any
 * idle/overhead salary that no contract consumes, e.g. a team lead).
 */
import type { Employee, Company } from "@/types";
import { dormantDuring } from "@/lib/company-visibility";
import { displayedCyclePlan, type PlanCounts } from "@/lib/cycle-plan";
import { dayKeyOf } from "@/lib/team-day";
import { taskDays } from "./capacity";
import { parseWorkDays, periodDays } from "./dates";
import { isWriterRole, isPublisherRole } from "./workload";
import { isTrainerSuppliedContentCompany } from "./content-source";

/**
 * Direct/marginal production cost per item (contribution-margin view) — mirrors
 * the manual profitability sheet: a post's direct cost is a fraction of a
 * designer day, a story is a $1 template, a reel is the freelance job rate.
 * This is a SIMPLE per-piece proxy independent of full salary absorption, so
 * every contract that covers its own direct production shows a positive
 * contribution even if its absorbed share of total salaries exceeds its price.
 */
export const MARGINAL_COST_PER_ITEM: Record<"POST" | "STORY" | "REEL" | "AI_REEL", number> = {
  POST: 1.5,
  STORY: 1,
  REEL: 10,
  AI_REEL: 10,
};

export type ContractPnL = {
  company: Company;
  revenue: number;
  laborCost: number; // allocated fixed + variable
  variableCost: number; // per-reel photographer cost (charged directly)
  profit: number;
  margin: number; // profit ÷ revenue (%)
  marginalCost: number; // direct per-piece cost (contribution view)
  contribution: number; // revenue − marginalCost
  contributionMargin: number; // contribution ÷ revenue (%)
};

export type CapacityRow = {
  empId: string;
  name: string;
  role: string;
  capacityDays: number;
  usedDays: number;
  pct: number;
  maxContracts: number; // how many contracts this person could carry
};

export type FinanceResult = {
  perContract: ContractPnL[];
  totalRevenue: number;
  totalSalaries: number; // fixed
  totalVariable: number;
  totalCost: number;
  netProfit: number;
  marginPct: number;
  overhead: number; // salaries not consumed by any contract (idle/management)
  numContracts: number;
  capacity: CapacityRow[];
  teamMaxContracts: number; // bottleneck role caps this
  extraContracts: number; // how many more the current team could carry
  avgContractValue: number;
  avgContribution: number; // revenue − variable, averaged
  breakEvenContracts: number | null; // min contracts to cover fixed salaries
  aboveBreakEven: boolean;
  hasData: boolean; // any contract value or salary entered yet
};

export type FinanceOptions = {
  /**
   * خطة كل شركة **لهالشهر** (`frozenPlanCounts` على دلو الشهر): دورة انسجّلت بعدها دورة
   * خطتها عدد قطعها هي، مو سجلّ الشركة اليوم (§٩). أيلول فونيتيك كان ٤/٤/٠ وسجلّها
   * اليوم ١٠/٤/١٤ لدورة تشرين — كلفة أيلول المباشرة طلعت ٦٩ بدل ٤٦ (TR-20).
   */
  plans?: Map<string, PlanCounts>;
  /** «اليوم» — حالة الشركة لشهر ماضي بآخر يوم فيه، وللشهر الشغّال لليوم. */
  today?: Date;
};

export function computeFinance(
  employees: Employee[],
  companies: Company[],
  year: number,
  month: number,
  options: FinanceOptions = {},
): FinanceResult {
  // حالة الشركة **وقت الشهر** لا اليوم (§١٠، TR-20): وصل ما جدّدت من ١/١٠ كانت عقداً
  // شغّالاً بأيلول، وكانت تختفي من إيراد أيلول لأنها مؤرشفة اليوم.
  const monthEndKey = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  const todayKey = dayKeyOf(options.today ?? new Date());
  const asOfKey = monthEndKey < todayKey ? monthEndKey : todayKey;
  const plans = options.plans ?? new Map<string, PlanCounts>();
  const managed = companies
    .filter((c) => c.managed && !dormantDuring(c, asOfKey))
    .map((c) => ({ ...c, ...displayedCyclePlan(plans, c) }));
  const period = periodDays(year, month);
  const empById = new Map(employees.map((e) => [e.id, e]));
  const firstPhotographerId = employees.find((e) => e.isPhotographer)?.id ?? null;
  const photographerOf = (c: Company) => c.photographerId ?? firstPhotographerId;
  const writerId = employees.find((e) => isWriterRole(e.role))?.id ?? null;
  const publisherId = employees.find((e) => isPublisherRole(e.role))?.id ?? null;

  const ownerOf = (c: Company, type: "POST" | "STORY" | "AI_REEL") => {
    if (type === "POST") return c.postOwnerId ?? c.defaultOwnerId;
    if (type === "STORY") return c.storyOwnerId ?? c.defaultOwnerId;
    return c.aiReelOwnerId ?? c.defaultOwnerId;
  };

  // Work-days per (employee, company) — designers / photographer / writer.
  const effort = new Map<string, Map<string, number>>();
  const addEffort = (empId: string | null, coId: string, days: number) => {
    if (!empId || days <= 0) return;
    const m = effort.get(empId) ?? new Map<string, number>();
    m.set(coId, (m.get(coId) ?? 0) + days);
    effort.set(empId, m);
  };
  const pubItems = new Map<string, number>(); // publisher: allocate by item share

  for (const c of managed) {
    const items = c.posts + c.reels + c.stories + c.aiReels;
    const po = ownerOf(c, "POST");
    if (c.posts > 0 && po && empById.get(po)) addEffort(po, c.id, taskDays(empById.get(po)!, "POST", c.posts));
    const so = ownerOf(c, "STORY");
    if (c.stories > 0 && so && empById.get(so)) addEffort(so, c.id, taskDays(empById.get(so)!, "STORY", c.stories));
    const ao = ownerOf(c, "AI_REEL");
    if (c.aiReels > 0 && ao && empById.get(ao)) addEffort(ao, c.id, taskDays(empById.get(ao)!, "AI_REEL", c.aiReels));
    const pid = photographerOf(c);
    if (c.reels > 0 && pid && empById.get(pid)) addEffort(pid, c.id, taskDays(empById.get(pid)!, "SHOOT", c.reels));
    if (items > 0 && writerId && empById.get(writerId) && !isTrainerSuppliedContentCompany(c))
      addEffort(writerId, c.id, taskDays(empById.get(writerId)!, "PLAN", 1));
    if (items > 0 && publisherId) pubItems.set(c.id, (pubItems.get(c.id) ?? 0) + items);
  }

  // Allocate salaries → per-contract labor cost.
  const laborCost = new Map<string, number>(managed.map((c) => [c.id, 0]));
  const variableCost = new Map<string, number>(managed.map((c) => [c.id, 0]));
  let overhead = 0;
  let totalSalaries = 0;
  for (const e of employees) {
    const sal = e.salary ?? 0;
    totalSalaries += sal;
    if (sal <= 0) continue;
    if (e.id === publisherId) {
      const total = [...pubItems.values()].reduce((a, b) => a + b, 0);
      if (total > 0) for (const [co, it] of pubItems) laborCost.set(co, laborCost.get(co)! + (sal * it) / total);
      else overhead += sal;
    } else {
      const eff = effort.get(e.id);
      const total = eff ? [...eff.values()].reduce((a, b) => a + b, 0) : 0;
      if (total > 0 && eff) for (const [co, d] of eff) laborCost.set(co, laborCost.get(co)! + (sal * d) / total);
      else overhead += sal;
    }
  }

  // Variable per-reel cost (freelance photographers paid by the job).
  let totalVariable = 0;
  for (const e of employees) {
    const cpr = e.costPerReel ?? 0;
    if (cpr <= 0 || !e.isPhotographer) continue;
    for (const c of managed) {
      if (photographerOf(c) === e.id && c.reels > 0) {
        const v = cpr * c.reels;
        variableCost.set(c.id, variableCost.get(c.id)! + v);
        laborCost.set(c.id, laborCost.get(c.id)! + v);
        totalVariable += v;
      }
    }
  }

  const perContract: ContractPnL[] = managed
    .map((c) => {
      const revenue = c.contractValue ?? 0;
      const cost = laborCost.get(c.id)!;
      const variable = variableCost.get(c.id)!;
      const profit = revenue - cost;
      const marginalCost =
        c.posts * MARGINAL_COST_PER_ITEM.POST +
        c.stories * MARGINAL_COST_PER_ITEM.STORY +
        c.reels * MARGINAL_COST_PER_ITEM.REEL +
        c.aiReels * MARGINAL_COST_PER_ITEM.AI_REEL;
      const contribution = revenue - marginalCost;
      return {
        company: c,
        revenue,
        laborCost: cost,
        variableCost: variable,
        profit,
        margin: revenue > 0 ? (profit / revenue) * 100 : 0,
        marginalCost,
        contribution,
        contributionMargin: revenue > 0 ? (contribution / revenue) * 100 : 0,
      };
    })
    .sort((a, b) => a.profit - b.profit); // losses first

  const totalRevenue = perContract.reduce((a, x) => a + x.revenue, 0);
  const totalCost = totalSalaries + totalVariable;
  const netProfit = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Capacity (production roles): who could carry how many contracts.
  const numContracts = managed.length;
  const capacity: CapacityRow[] = [];
  for (const e of employees) {
    const eff = effort.get(e.id);
    if (!eff) continue;
    const wd = parseWorkDays(e.workDays);
    const capacityDays = period.filter((d) => wd.includes(d.getDay())).length;
    const usedDays = [...eff.values()].reduce((a, b) => a + b, 0);
    const pct = capacityDays > 0 ? Math.round((usedDays / capacityDays) * 100) : 0;
    const maxContracts = usedDays > 0 ? (numContracts * capacityDays) / usedDays : Infinity;
    capacity.push({ empId: e.id, name: e.name, role: e.role, capacityDays, usedDays, pct, maxContracts });
  }
  const teamMaxContracts = capacity.length
    ? Math.floor(Math.min(...capacity.map((c) => c.maxContracts)))
    : 0;
  const extraContracts = Math.max(0, teamMaxContracts - numContracts);

  // Break-even: min contracts (at avg contribution) to cover fixed salaries.
  const avgContractValue = numContracts > 0 ? totalRevenue / numContracts : 0;
  const avgContribution =
    numContracts > 0
      ? perContract.reduce((a, x) => a + (x.revenue - x.variableCost), 0) / numContracts
      : 0;
  const breakEvenContracts = avgContribution > 0 ? Math.ceil(totalSalaries / avgContribution) : null;
  const aboveBreakEven = breakEvenContracts != null && numContracts >= breakEvenContracts;

  return {
    perContract,
    totalRevenue,
    totalSalaries,
    totalVariable,
    totalCost,
    netProfit,
    marginPct,
    overhead,
    numContracts,
    capacity,
    teamMaxContracts,
    extraContracts,
    avgContractValue,
    avgContribution,
    breakEvenContracts,
    aboveBreakEven,
    hasData: totalRevenue > 0 || totalSalaries > 0 || totalVariable > 0,
  };
}
