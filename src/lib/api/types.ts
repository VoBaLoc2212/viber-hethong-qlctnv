import type { UserRole } from "@/modules/shared/contracts/domain";

export type AuthUser = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

export type BudgetItem = {
  id: string;
  departmentId: string;
  period: string;
  amount: string;
  reserved: string;
  used: string;
  available: string;
  parentBudgetId?: string | null;
};

export type BudgetStatus = {
  budgetId: string;
  amount: string;
  reserved: string;
  used: string;
  available: string;
  percentageUsed: number;
  warning: boolean;
  hardStopEnabled: boolean;
  warningThresholdPct: number;
};

export type BudgetTransferResult = {
  transferId: string;
  fromBudgetId: string;
  toBudgetId: string;
  amount: string;
  reason?: string | null;
  createdAt: string;
  idempotencyKey: string;
  ledgerEntryId?: string;
  replayed: boolean;
};

export type AuditLogItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  result: string;
  correlationId?: string | null;
  payload?: unknown;
  createdAt: string;
  actor: {
    id: string;
    username: string;
    fullName: string;
    email: string;
    role: UserRole;
  };
};

export type LedgerEntryItem = {
  id: string;
  entryCode: string;
  type: "EXPENSE" | "INCOME" | "TRANSFER" | "ADJUSTMENT" | "REVERSAL";
  amount: string;
  currency: string;
  referenceType: string;
  referenceId: string;
  reversalOfId?: string | null;
  reversalOfEntryCode?: string | null;
  fxCurrency?: string | null;
  fxAmount?: string | null;
  fxRate?: string | null;
  baseCurrency?: string | null;
  baseAmount?: string | null;
  fxRateProvider?: string | null;
  fxRateFetchedAt?: string | null;
  reconciliationStatus?: "UNRECONCILED" | "RECONCILED" | "EXCEPTION";
  reconciledAt?: string | null;
  reconciledById?: string | null;
  reconciliationRef?: string | null;
  metadata?: unknown;
  createdAt: string;
  createdBy: {
    id: string;
    username: string;
    fullName: string;
    email: string;
    role: UserRole;
  };
  reconciledBy?: {
    id: string;
    username: string;
    fullName: string;
    email: string;
    role: UserRole;
  } | null;
};
