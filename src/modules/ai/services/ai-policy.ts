import type { UserRole } from "@/modules/shared";

import type { AiIntent, AiRouteUsed } from "../types";

export type AiDataDomain = "DATA_RUNTIME" | "PROCESS_POLICY" | "GENERAL";

export type AiPolicyKey =
  | "overview"
  | "transactions"
  | "cashbook"
  | "budget-orchestration"
  | "budgets"
  | "approvals"
  | "reimbursements"
  | "reports"
  | "security-logs"
  | "user-management"
  | "fx-management"
  | "guidance"
  | "generic";

type AiPolicyRule = {
  key: AiPolicyKey;
  dataDomain: AiDataDomain;
  keywords: RegExp;
  intents: AiIntent[];
  allowedRoutesByRole: Partial<Record<UserRole, AiRouteUsed[]>>;
  defaultRoutes: AiRouteUsed[];
  scopeByRole: Partial<Record<UserRole, string>>;
  defaultScope: string;
};

export const AI_POLICY_MATRIX: readonly AiPolicyRule[] = [
  {
    key: "guidance",
    dataDomain: "PROCESS_POLICY",
    keywords: /quy\s*trinh|huong\s*dan|help|chinh\s*sach|policy|how\s*to|lam\s*sao/i,
    intents: ["GUIDANCE"],
    allowedRoutesByRole: {
      EMPLOYEE: ["RAG"],
      MANAGER: ["RAG"],
      ACCOUNTANT: ["RAG"],
      FINANCE_ADMIN: ["RAG"],
      AUDITOR: ["RAG"],
    },
    defaultRoutes: ["RAG"],
    scopeByRole: {},
    defaultScope: "process-policy-docs",
  },
  {
    key: "security-logs",
    dataDomain: "DATA_RUNTIME",
    keywords: /nhat\s*ky|audit|log|bao\s*mat|security/i,
    intents: ["QUERY", "ALERT", "ANALYSIS"],
    allowedRoutesByRole: {
      ACCOUNTANT: ["SERVICE"],
      FINANCE_ADMIN: ["SERVICE", "TEXT2SQL"],
      AUDITOR: ["SERVICE", "TEXT2SQL"],
    },
    defaultRoutes: [],
    scopeByRole: {
      ACCOUNTANT: "security-log-read-accounting",
      FINANCE_ADMIN: "security-log-read-admin",
      AUDITOR: "security-log-read-auditor",
    },
    defaultScope: "security-log-role-gated",
  },
  {
    key: "approvals",
    dataDomain: "DATA_RUNTIME",
    keywords: /phe\s*duyet|approval/i,
    intents: ["QUERY", "ALERT", "ANALYSIS"],
    allowedRoutesByRole: {
      MANAGER: ["SERVICE"],
      ACCOUNTANT: ["SERVICE"],
    },
    defaultRoutes: [],
    scopeByRole: {
      MANAGER: "approval-queue-manager",
      ACCOUNTANT: "approval-queue-accountant",
    },
    defaultScope: "approval-role-queue",
  },
  {
    key: "reimbursements",
    dataDomain: "DATA_RUNTIME",
    keywords: /hoan\s*ung|reimbursement|tam\s*ung|quyet\s*toan/i,
    intents: ["QUERY", "ALERT", "ANALYSIS"],
    allowedRoutesByRole: {
      EMPLOYEE: ["SERVICE"],
      MANAGER: ["SERVICE"],
      ACCOUNTANT: ["SERVICE"],
      FINANCE_ADMIN: ["SERVICE"],
      AUDITOR: ["SERVICE"],
    },
    defaultRoutes: [],
    scopeByRole: {
      EMPLOYEE: "reimbursement-own-records",
      MANAGER: "reimbursement-manager-review",
      ACCOUNTANT: "reimbursement-accounting-review",
      FINANCE_ADMIN: "reimbursement-finance-global",
      AUDITOR: "reimbursement-audit-read",
    },
    defaultScope: "reimbursement-role-scope",
  },
  {
    key: "cashbook",
    dataDomain: "DATA_RUNTIME",
    keywords: /quy\s*tien\s*mat|cashbook|so\s*du\s*quy|dong\s*tien|thu\s*chi/i,
    intents: ["QUERY", "ANALYSIS", "FORECAST"],
    allowedRoutesByRole: {
      ACCOUNTANT: ["SERVICE"],
      FINANCE_ADMIN: ["SERVICE", "TEXT2SQL"],
      AUDITOR: ["SERVICE", "TEXT2SQL"],
    },
    defaultRoutes: [],
    scopeByRole: {
      ACCOUNTANT: "cashbook-read-accounting",
      FINANCE_ADMIN: "cashbook-read-admin",
      AUDITOR: "cashbook-read-auditor",
    },
    defaultScope: "cashbook-role-gated",
  },
  {
    key: "reports",
    dataDomain: "DATA_RUNTIME",
    keywords: /bao\s*cao|kpi|tong\s*chi|tong\s*thu|so\s*du|du\s*bao|forecast|dashboard/i,
    intents: ["QUERY", "ANALYSIS", "FORECAST"],
    allowedRoutesByRole: {
      MANAGER: ["SERVICE", "TEXT2SQL"],
      ACCOUNTANT: ["SERVICE", "TEXT2SQL"],
      FINANCE_ADMIN: ["SERVICE", "TEXT2SQL"],
      AUDITOR: ["SERVICE", "TEXT2SQL"],
    },
    defaultRoutes: [],
    scopeByRole: {
      MANAGER: "reports-manager-scope",
      ACCOUNTANT: "reports-accounting-scope",
      FINANCE_ADMIN: "reports-admin-scope",
      AUDITOR: "reports-audit-scope",
    },
    defaultScope: "reports-role-gated",
  },
  {
    key: "budgets",
    dataDomain: "DATA_RUNTIME",
    keywords: /ngan?\s*sach|budget|phong\s*ban|department|dieu\s*phoi\s*ngan\s*sach|giu\s*cho|kha\s*dung/i,
    intents: ["QUERY", "ANALYSIS", "ALERT"],
    allowedRoutesByRole: {
      MANAGER: ["SERVICE"],
      ACCOUNTANT: ["SERVICE"],
      FINANCE_ADMIN: ["SERVICE", "TEXT2SQL"],
      AUDITOR: ["SERVICE", "TEXT2SQL"],
    },
    defaultRoutes: [],
    scopeByRole: {
      MANAGER: "budget-manager-department-scope",
      ACCOUNTANT: "budget-accounting-scope",
      FINANCE_ADMIN: "budget-admin-global",
      AUDITOR: "budget-audit-read",
    },
    defaultScope: "budget-role-gated",
  },
  {
    key: "transactions",
    dataDomain: "DATA_RUNTIME",
    keywords: /giao\s*dich|expense|income|ma\s*phieu|transaction/i,
    intents: ["QUERY", "ANALYSIS", "ALERT"],
    allowedRoutesByRole: {
      EMPLOYEE: ["SERVICE"],
      MANAGER: ["SERVICE"],
      ACCOUNTANT: ["SERVICE"],
      FINANCE_ADMIN: ["SERVICE", "TEXT2SQL"],
      AUDITOR: ["SERVICE", "TEXT2SQL"],
    },
    defaultRoutes: [],
    scopeByRole: {
      EMPLOYEE: "transaction-own-or-permitted-scope",
      MANAGER: "transaction-manager-department-scope",
      ACCOUNTANT: "transaction-accounting-scope",
      FINANCE_ADMIN: "transaction-admin-global",
      AUDITOR: "transaction-audit-read",
    },
    defaultScope: "transaction-role-scope",
  },
  {
    key: "fx-management",
    dataDomain: "DATA_RUNTIME",
    keywords: /ty\s*gia|fx|usd|vnd|exchange\s*rate/i,
    intents: ["QUERY", "ANALYSIS"],
    allowedRoutesByRole: {
      FINANCE_ADMIN: ["SERVICE", "TEXT2SQL"],
      AUDITOR: ["RAG"],
    },
    defaultRoutes: ["RAG"],
    scopeByRole: {
      FINANCE_ADMIN: "fx-admin-scope",
      AUDITOR: "fx-policy-read-only",
    },
    defaultScope: "fx-role-gated",
  },
  {
    key: "user-management",
    dataDomain: "PROCESS_POLICY",
    keywords: /nguoi\s*dung|user\s*management|quan\s*ly\s*nguoi\s*dung/i,
    intents: ["QUERY", "GUIDANCE"],
    allowedRoutesByRole: {
      FINANCE_ADMIN: ["RAG"],
    },
    defaultRoutes: ["RAG"],
    scopeByRole: {
      FINANCE_ADMIN: "user-management-policy",
    },
    defaultScope: "user-management-policy",
  },
] as const;

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function resolveAiPolicy(message: string, intent: AiIntent, role: UserRole): {
  policyKey: AiPolicyKey;
  dataDomain: AiDataDomain;
  allowedRoutes: AiRouteUsed[];
  scopeApplied: string;
} {
  const normalized = normalizeSearchText(message);
  const matched = AI_POLICY_MATRIX.find((rule) => rule.intents.includes(intent) && rule.keywords.test(normalized));

  if (!matched) {
    return {
      policyKey: intent === "GUIDANCE" ? "guidance" : "generic",
      dataDomain: intent === "GUIDANCE" ? "PROCESS_POLICY" : "GENERAL",
      allowedRoutes: intent === "GUIDANCE" ? ["RAG"] : ["SERVICE", "RAG", "TEXT2SQL"],
      scopeApplied: "generic-assistant-scope",
    };
  }

  return {
    policyKey: matched.key,
    dataDomain: matched.dataDomain,
    allowedRoutes: matched.allowedRoutesByRole[role] ?? matched.defaultRoutes,
    scopeApplied: matched.scopeByRole[role] ?? matched.defaultScope,
  };
}

export function isRouteAllowed(route: AiRouteUsed, allowedRoutes: AiRouteUsed[]) {
  return allowedRoutes.includes(route);
}

export function isRuntimeDataPolicy(dataDomain: AiDataDomain) {
  return dataDomain === "DATA_RUNTIME";
}
