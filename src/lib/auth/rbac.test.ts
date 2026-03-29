import { describe, expect, it } from "vitest";

import type { UserRole } from "@/modules/shared/contracts/domain";

import {
  API_ROLE_RULES,
  NAV_ITEMS,
  ROUTE_ROLE_RULES,
  getAllowedRolesForApi,
  getAllowedRolesForRoute,
  isApiAllowed,
  isRouteAllowed,
} from "./rbac";

const ANALYST_ROLES: UserRole[] = ["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"];

describe("rbac route and nav consistency", () => {
  it("keeps budgets and budgeting routes aligned to analyst roles", () => {
    expect(getAllowedRolesForRoute("/budgets")).toEqual(ANALYST_ROLES);
    expect(getAllowedRolesForRoute("/budgeting")).toEqual(ANALYST_ROLES);
  });

  it("keeps approvals route accessible to analyst roles including accountant and auditor", () => {
    expect(getAllowedRolesForRoute("/approvals")).toEqual(ANALYST_ROLES);
  });

  it("keeps route roles equal to navigation roles for shared href items", () => {
    for (const item of NAV_ITEMS) {
      const routeRoles = getAllowedRolesForRoute(item.href);
      if (!routeRoles) {
        continue;
      }
      expect(item.roles).toEqual(routeRoles);
    }
  });

  it("matches special routes with expected roles", () => {
    expect(getAllowedRolesForRoute("/security")).toEqual(["ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);
    expect(getAllowedRolesForRoute("/users")).toEqual(["FINANCE_ADMIN"]);
    expect(getAllowedRolesForRoute("/fx-rates")).toEqual(["FINANCE_ADMIN"]);
  });
});

describe("rbac api consistency", () => {
  it("keeps logs immutable and ledger reversal rules more specific than base routes", () => {
    expect(getAllowedRolesForApi("/api/logs/immutable")).toEqual(["FINANCE_ADMIN", "ACCOUNTANT"]);
    expect(getAllowedRolesForApi("/api/logs")).toEqual(["FINANCE_ADMIN", "AUDITOR"]);

    expect(getAllowedRolesForApi("/api/ledger/entry-id/reversal")).toEqual(["FINANCE_ADMIN", "ACCOUNTANT"]);
    expect(getAllowedRolesForApi("/api/ledger")).toEqual(["FINANCE_ADMIN", "ACCOUNTANT", "AUDITOR"]);
  });

  it("enforces finance-admin-only api groups", () => {
    expect(getAllowedRolesForApi("/api/controls/hard-stop")).toEqual(["FINANCE_ADMIN"]);
    expect(getAllowedRolesForApi("/api/users")).toEqual(["FINANCE_ADMIN"]);
    expect(getAllowedRolesForApi("/api/fx-rates")).toEqual(["FINANCE_ADMIN"]);
  });

  it("keeps reports and approvals api groups in analyst scope", () => {
    expect(getAllowedRolesForApi("/api/reports")).toEqual(ANALYST_ROLES);
    expect(getAllowedRolesForApi("/api/approvals")).toEqual(ANALYST_ROLES);
  });

  it("covers each nav route by at least one route rule", () => {
    const unmatched = NAV_ITEMS.filter((item) => !ROUTE_ROLE_RULES.some((rule) => rule.matcher.test(item.href)));
    expect(unmatched).toEqual([]);
  });

  it("covers critical API endpoints by at least one API rule", () => {
    const criticalEndpoints = [
      "/api/approvals",
      "/api/reimbursements",
      "/api/budgets",
      "/api/controls/hard-stop",
      "/api/fx-rates",
      "/api/ledger",
      "/api/ledger/entry-id/reversal",
      "/api/logs",
      "/api/logs/immutable",
      "/api/reports",
      "/api/users",
    ];

    for (const endpoint of criticalEndpoints) {
      expect(API_ROLE_RULES.some((rule) => rule.matcher.test(endpoint))).toBe(true);
    }
  });
});

describe("rbac decision helpers", () => {
  it("returns true for allowed route and false for denied route", () => {
    expect(isRouteAllowed("/security", "AUDITOR")).toBe(true);
    expect(isRouteAllowed("/users", "AUDITOR")).toBe(false);
  });

  it("returns true for allowed api and false for denied api", () => {
    expect(isApiAllowed("/api/logs", "AUDITOR")).toBe(true);
    expect(isApiAllowed("/api/controls/hard-stop", "AUDITOR")).toBe(false);
  });
});
