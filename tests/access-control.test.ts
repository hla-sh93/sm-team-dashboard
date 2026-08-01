import { describe, it, expect } from "vitest";
import {
  ADMIN_BASE,
  adminNav,
  areaSwitchHref,
  employeeNav,
  sidebarHrefs,
} from "../src/lib/nav";

/**
 * The app has NO login: separation between the employee area and the admin
 * dashboard is enforced purely by NOT exposing admin routes in the employee UI.
 * These tests lock that rule in so a future change can't silently re-expose the
 * admin dashboard (finance / team / companies / workload / priorities) to
 * employees — the exact regression that happened once already.
 */

// Sensitive admin-only segments that must NEVER appear in the employee area.
const ADMIN_ONLY_SEGMENTS = ["finance", "team", "companies", "workload", "priorities"];

const flat = (nav: typeof employeeNav) => nav.flatMap((s) => s.items.map((i) => i.href));

describe("access control — employee area must not expose the admin dashboard", () => {
  const employeeHrefs = flat(employeeNav);

  it("employee nav contains ONLY the daily-work root routes", () => {
    expect(employeeHrefs).toEqual(["/", "/today", "/tasks", "/publishing", "/reports"]);
  });

  it("no employee href points at the admin base or any /admin route", () => {
    for (const href of employeeHrefs) {
      expect(href === ADMIN_BASE).toBe(false);
      expect(href.startsWith(`${ADMIN_BASE}/`)).toBe(false);
      expect(href.startsWith("/admin")).toBe(false);
    }
  });

  it("no employee href exposes a sensitive admin-only section", () => {
    for (const href of employeeHrefs) {
      for (const seg of ADMIN_ONLY_SEGMENTS) {
        expect(href.includes(seg)).toBe(false);
      }
    }
  });

  it("the area-switch link is hidden for employees and present for admins", () => {
    expect(areaSwitchHref(false)).toBeNull(); // employees: no link to /admin
    expect(areaSwitchHref(true)).toBe("/"); // admins: link back to team view
  });

  it("the FULL employee sidebar (nav + area switch) has zero /admin hrefs", () => {
    const all = sidebarHrefs(false);
    expect(all.some((h) => h.startsWith("/admin"))).toBe(false);
    expect(all).toEqual(["/", "/today", "/tasks", "/publishing", "/reports"]);
  });
});

describe("access control — admin area still exposes its routes (sanity)", () => {
  const adminHrefs = flat(adminNav);

  it("admin nav includes every sensitive section under /admin", () => {
    for (const seg of ADMIN_ONLY_SEGMENTS) {
      expect(adminHrefs.some((h) => h === `${ADMIN_BASE}/${seg}`)).toBe(true);
    }
  });

  it("every admin href is the admin base or under it", () => {
    for (const href of adminHrefs) {
      expect(href === ADMIN_BASE || href.startsWith(`${ADMIN_BASE}/`)).toBe(true);
    }
  });
});
