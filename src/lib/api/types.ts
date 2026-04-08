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

export type TransactionReferenceDepartment = {
  id: string;
  code: string;
  name: string;
};

export type TransactionReferenceBudget = {
  id: string;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  period: string;
  amount: string;
  available: string;
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

export type TransactionItem = {
  id: string;
  transactionCode: string;
  type: "INCOME" | "EXPENSE";
  status: "DRAFT" | "PENDING" | "APPROVED" | "EXECUTED" | "REJECTED" | "REVERSED";
  amount: string;
  currency: string;
  date: string;
  description?: string | null;
  budgetId?: string | null;
  departmentId?: string | null;
  recurringSourceId?: string | null;
  createdAt: string;
};

export type UploadedTransactionAttachment = {
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string | null;
};

export type RecurringTemplateItem = {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  amount: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUALLY";
  nextRunAt: string;
  lastRunAt: string | null;
  active: boolean;
  budgetId?: string | null;
  departmentId?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type CashbookAccountItem = {
  id: string;
  name: string;
  type: string;
  balance: string;
  updatedAt: string;
};

export type CashbookPostingItem = {
  id: string;
  accountId: string;
  transactionId: string;
  direction: "IN" | "OUT";
  amount: string;
  postedAt: string;
  transaction: {
    id: string;
    code: string;
    type: "INCOME" | "EXPENSE";
    status: "DRAFT" | "PENDING" | "APPROVED" | "EXECUTED" | "REJECTED" | "REVERSED";
    description?: string | null;
    date: string;
  };
};

export type DashboardKpisItem = {
  totalBudget: number;
  totalSpent: number;
  remainingBalance: number;
  totalIncome: number;
  transactionCount: number;
  pendingCount: number;
  currency?: "VND" | "USD";
};
