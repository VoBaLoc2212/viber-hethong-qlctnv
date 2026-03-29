import type { UserRole } from "@/modules/shared/contracts/domain";

export const AUTH_TOKEN_STORAGE_KEY = "budget-app-token";
export const AUTH_TOKEN_COOKIE_KEY = "budget-app-token";

export const ROLE_LANDING_PATH: Record<UserRole, string> = {
  EMPLOYEE: "/transactions",
  MANAGER: "/budgeting",
  ACCOUNTANT: "/budgeting",
  FINANCE_ADMIN: "/security",
  AUDITOR: "/security",
};

export const ROUTE_ROLE_RULES: Array<{ matcher: RegExp; roles: UserRole[] }> = [
  { matcher: /^\/reports(?:\/.*)?$/, roles: ["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"] },
  { matcher: /^\/security(?:\/.*)?$/, roles: ["FINANCE_ADMIN", "ACCOUNTANT", "AUDITOR"] },
  { matcher: /^\/budgeting(?:\/.*)?$/, roles: ["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"] },
  { matcher: /^\/budgets(?:\/.*)?$/, roles: ["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"] },
  { matcher: /^\/approvals(?:\/.*)?$/, roles: ["MANAGER", "ACCOUNTANT"] },
  {
    matcher: /^\/(?:dashboard|transactions|ai-assistant)(?:\/.*)?$/,
    roles: ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"],
  },
];

export const API_ROLE_RULES: Array<{ matcher: RegExp; roles: UserRole[] }> = [
  {
    matcher: /^\/api\/departments(?:\/.*)?$/,
    roles: ["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"],
  },
  {
    matcher: /^\/api\/transactions(?:\/.*)?$/,
    roles: ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"],
  },
  {
    matcher: /^\/api\/dashboard\/(?:kpis|expenses-by-month)(?:\/.*)?$/,
    roles: ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"],
  },
  {
    matcher: /^\/api\/approvals(?:\/.*)?$/,
    roles: ["MANAGER", "ACCOUNTANT"],
  },
  {
    matcher: /^\/api\/logs(?:\/.*)?$/,
    roles: ["FINANCE_ADMIN", "AUDITOR"],
  },
  {
    matcher: /^\/api\/ledger(?:\/.*)?$/,
    roles: ["FINANCE_ADMIN", "ACCOUNTANT", "AUDITOR"],
  },
];

export const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: "dashboard" | "transactions" | "budgets" | "reports" | "security" | "assistant";
  roles: UserRole[];
}> = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "dashboard",
    roles: ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"],
  },
  {
    href: "/transactions",
    label: "Transactions",
    icon: "transactions",
    roles: ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"],
  },
  {
    href: "/budgeting",
    label: "Budgeting",
    icon: "budgets",
    roles: ["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"],
  },
  {
    href: "/budgets",
    label: "Budgets",
    icon: "budgets",
    roles: ["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"],
  },
  {
    href: "/reports",
    label: "Reports",
    icon: "reports",
    roles: ["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"],
  },
  {
    href: "/security",
    label: "Security",
    icon: "security",
    roles: ["ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"],
  },
  {
    href: "/ai-assistant",
    label: "AI Assistant",
    icon: "assistant",
    roles: ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"],
  },
];

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/auth") return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname === "/api" || pathname.startsWith("/api/openapi")) return true;
  return false;
}

export function normalizeNextPath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

export function getAllowedRolesForRoute(pathname: string): UserRole[] | null {
  for (const rule of ROUTE_ROLE_RULES) {
    if (rule.matcher.test(pathname)) {
      return rule.roles;
    }
  }

  return null;
}

export function getAllowedRolesForApi(pathname: string): UserRole[] | null {
  for (const rule of API_ROLE_RULES) {
    if (rule.matcher.test(pathname)) {
      return rule.roles;
    }
  }

  return null;
}

export function isRouteAllowed(pathname: string, role: UserRole): boolean {
  const allowed = getAllowedRolesForRoute(pathname);
  return !allowed || allowed.includes(role);
}

export function isApiAllowed(pathname: string, role: UserRole): boolean {
  const allowed = getAllowedRolesForApi(pathname);
  return !allowed || allowed.includes(role);
}

export function getLandingPath(role: UserRole): string {
  return ROLE_LANDING_PATH[role] ?? "/dashboard";
}

export function getFirstAccessiblePath(role: UserRole): string {
  const nav = NAV_ITEMS.find((item) => item.roles.includes(role));
  return nav?.href ?? "/dashboard";
}
