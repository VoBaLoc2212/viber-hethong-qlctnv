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

const ALL_ROLES: UserRole[] = ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"];
const ANALYST_ROLES: UserRole[] = ["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"];
const SECURITY_ROLES: UserRole[] = ["ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"];
const FINANCE_ADMIN_ONLY: UserRole[] = ["FINANCE_ADMIN"];

export const ROUTE_ROLE_RULES: Array<{ matcher: RegExp; roles: UserRole[] }> = [
  { matcher: /^\/reports(?:\/.*)?$/, roles: ANALYST_ROLES },
  { matcher: /^\/security(?:\/.*)?$/, roles: SECURITY_ROLES },
  { matcher: /^\/users(?:\/.*)?$/, roles: FINANCE_ADMIN_ONLY },
  { matcher: /^\/fx-rates(?:\/.*)?$/, roles: FINANCE_ADMIN_ONLY },
  { matcher: /^\/budgeting(?:\/.*)?$/, roles: ANALYST_ROLES },
  { matcher: /^\/budgets(?:\/.*)?$/, roles: ANALYST_ROLES },
  { matcher: /^\/approvals(?:\/.*)?$/, roles: ANALYST_ROLES },
  {
    matcher: /^\/(?:dashboard|transactions|ai-assistant)(?:\/.*)?$/,
    roles: ALL_ROLES,
  },
];

export const API_ROLE_RULES: Array<{ matcher: RegExp; roles: UserRole[] }> = [
  {
    matcher: /^\/api\/departments(?:\/.*)?$/,
    roles: ANALYST_ROLES,
  },
  {
    matcher: /^\/api\/transactions(?:\/.*)?$/,
    roles: ALL_ROLES,
  },
  {
    matcher: /^\/api\/dashboard\/(?:kpis|expenses-by-month)(?:\/.*)?$/,
    roles: ALL_ROLES,
  },
  {
    matcher: /^\/api\/approvals(?:\/.*)?$/,
    roles: ANALYST_ROLES,
  },
  {
    matcher: /^\/api\/budgets(?:\/.*)?$/,
    roles: ANALYST_ROLES,
  },
  {
    matcher: /^\/api\/logs\/immutable(?:\/.*)?$/,
    roles: ["FINANCE_ADMIN", "ACCOUNTANT"],
  },
  {
    matcher: /^\/api\/logs(?:\/.*)?$/,
    roles: ["FINANCE_ADMIN", "AUDITOR"],
  },
  {
    matcher: /^\/api\/ledger\/[^/]+\/reversal(?:\/.*)?$/,
    roles: ["FINANCE_ADMIN", "ACCOUNTANT"],
  },
  {
    matcher: /^\/api\/ledger(?:\/.*)?$/,
    roles: ["FINANCE_ADMIN", "ACCOUNTANT", "AUDITOR"],
  },
  {
    matcher: /^\/api\/fx-rates(?:\/.*)?$/,
    roles: FINANCE_ADMIN_ONLY,
  },
  {
    matcher: /^\/api\/controls\/hard-stop(?:\/.*)?$/,
    roles: FINANCE_ADMIN_ONLY,
  },
  {
    matcher: /^\/api\/users(?:\/.*)?$/,
    roles: FINANCE_ADMIN_ONLY,
  },
  {
    matcher: /^\/api\/reports(?:\/.*)?$/,
    roles: ANALYST_ROLES,
  },
  {
    matcher: /^\/api\/ai\/knowledge(?:\/.*)?$/,
    roles: FINANCE_ADMIN_ONLY,
  },
];

export const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: "dashboard" | "transactions" | "budgeting" | "budgets" | "reports" | "security" | "users" | "assistant" | "fxRates";
  roles: UserRole[];
}> = [
  {
    href: "/dashboard",
    label: "Tổng quan",
    icon: "dashboard",
    roles: ALL_ROLES,
  },
  {
    href: "/transactions",
    label: "Giao dịch",
    icon: "transactions",
    roles: ALL_ROLES,
  },
  {
    href: "/budgeting",
    label: "Điều phối ngân sách",
    icon: "budgeting",
    roles: ANALYST_ROLES,
  },
  {
    href: "/budgets",
    label: "Ngân sách",
    icon: "budgets",
    roles: ANALYST_ROLES,
  },
  {
    href: "/reports",
    label: "Báo cáo",
    icon: "reports",
    roles: ANALYST_ROLES,
  },
  {
    href: "/security",
    label: "Bảo mật & Nhật ký",
    icon: "security",
    roles: SECURITY_ROLES,
  },
  {
    href: "/users",
    label: "Quản lý người dùng",
    icon: "users",
    roles: FINANCE_ADMIN_ONLY,
  },
  {
    href: "/fx-rates",
    label: "Quản lý tỷ giá",
    icon: "fxRates",
    roles: FINANCE_ADMIN_ONLY,
  },
  {
    href: "/ai-assistant",
    label: "Trợ lý AI",
    icon: "assistant",
    roles: ALL_ROLES,
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
