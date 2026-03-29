import { apiRequest } from "./client";
import type {
  AuditLogItem,
  AuthUser,
  BudgetItem,
  BudgetStatus,
  BudgetTransferResult,
  CashbookAccountItem,
  CashbookPostingItem,
  LedgerEntryItem,
  LoginResponse,
  RecurringTemplateItem,
  TransactionReferenceBudget,
  TransactionReferenceDepartment,
  TransactionItem,
  UploadedTransactionAttachment,
} from "./types";

export async function apiLogin(payload: { username: string; password: string }) {
  return apiRequest<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: payload,
  });
}

export async function apiLogout() {
  return apiRequest<{ success: boolean }>("/api/auth/logout", {
    method: "POST",
  });
}

export async function apiMe(token: string) {
  return apiRequest<AuthUser>("/api/auth/me", {
    token,
  });
}

export async function apiListUsers(token: string, search?: string) {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiRequest<{ users: AuthUser[] }>(`/api/users${query}`, { token });
}

export async function apiRegisterUser(
  token: string,
  payload: {
    username: string;
    password: string;
    role: "EMPLOYEE" | "MANAGER" | "ACCOUNTANT" | "FINANCE_ADMIN" | "AUDITOR";
    email: string;
    fullName?: string;
  },
) {
  return apiRequest<AuthUser>("/api/auth/register", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function apiUpdateUser(
  token: string,
  id: string,
  payload: {
    username?: string;
    password?: string;
    role?: "EMPLOYEE" | "MANAGER" | "ACCOUNTANT" | "FINANCE_ADMIN" | "AUDITOR";
    email?: string;
    fullName?: string;
    isActive?: boolean;
  },
) {
  return apiRequest<AuthUser>(`/api/users/${id}`, {
    method: "PUT",
    token,
    body: payload,
  });
}

export async function apiDeleteUser(token: string, id: string) {
  return apiRequest<void>(`/api/users/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function apiListBudgets(token: string, params?: { departmentId?: string; period?: string }) {
  const query = new URLSearchParams();
  if (params?.departmentId) query.set("departmentId", params.departmentId);
  if (params?.period) query.set("period", params.period);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<{ budgets: BudgetItem[] }>(`/api/budgets${suffix}`, { token });
}

export async function apiCreateBudget(
  token: string,
  payload: { departmentId: string; period: string; amount: string; parentBudgetId?: string | null },
) {
  return apiRequest<BudgetItem>("/api/budgets", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function apiUpdateBudget(
  token: string,
  id: string,
  payload: { amount: string; parentBudgetId?: string | null },
) {
  return apiRequest<BudgetItem>(`/api/budgets/${id}`, {
    method: "PUT",
    token,
    body: payload,
  });
}

export async function apiBudgetStatus(token: string, id: string) {
  return apiRequest<BudgetStatus>(`/api/budgets/${id}/status`, {
    token,
  });
}

export async function apiTransferBudget(
  token: string,
  id: string,
  payload: { toBudgetId: string; amount: string; reason?: string },
  idempotencyKey: string,
) {
  return apiRequest<BudgetTransferResult>(`/api/budgets/${id}/transfer`, {
    method: "POST",
    token,
    headers: { "idempotency-key": idempotencyKey },
    body: payload,
  });
}

export async function apiConfigureHardStop(
  token: string,
  payload: { budgetId?: string | null; enabled: boolean; warningThresholdPct?: number },
) {
  return apiRequest<{
    id: string;
    budgetId?: string | null;
    hardStopEnabled: boolean;
    warningThresholdPct: number;
    updatedAt: string;
  }>("/api/controls/hard-stop", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function apiListLogs(
  token: string,
  params?: { entityType?: string; entityId?: string; fromDate?: string; toDate?: string; userId?: string },
) {
  const query = new URLSearchParams();
  if (params?.entityType) query.set("entityType", params.entityType);
  if (params?.entityId) query.set("entityId", params.entityId);
  if (params?.fromDate) query.set("fromDate", params.fromDate);
  if (params?.toDate) query.set("toDate", params.toDate);
  if (params?.userId) query.set("userId", params.userId);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<{ logs: AuditLogItem[] }>(`/api/logs${suffix}`, { token });
}

export async function apiListLedger(
  token: string,
  params?: { referenceType?: string; referenceId?: string },
) {
  const query = new URLSearchParams();
  if (params?.referenceType) query.set("referenceType", params.referenceType);
  if (params?.referenceId) query.set("referenceId", params.referenceId);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<{ entries: LedgerEntryItem[] }>(`/api/ledger${suffix}`, { token });
}

export async function apiCreateReversal(
  token: string,
  ledgerEntryId: string,
  reason: string,
  idempotencyKey: string,
) {
  return apiRequest<{
    reversalEntryId: string;
    targetEntryId: string;
    replayed: boolean;
    idempotencyKey: string;
    createdAt: string;
  }>(`/api/ledger/${ledgerEntryId}/reversal`, {
    method: "POST",
    token,
    headers: { "idempotency-key": idempotencyKey },
    body: { reason },
  });
}

export async function apiListTransactions(
  token: string,
  params?: {
    page?: number;
    limit?: number;
    type?: "INCOME" | "EXPENSE";
    status?: "DRAFT" | "PENDING" | "APPROVED" | "EXECUTED" | "REJECTED" | "REVERSED";
    departmentId?: string;
    budgetId?: string;
  },
) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.type) query.set("type", params.type);
  if (params?.status) query.set("status", params.status);
  if (params?.departmentId) query.set("departmentId", params.departmentId);
  if (params?.budgetId) query.set("budgetId", params.budgetId);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<{ data: TransactionItem[]; total: number; page: number; limit: number }>(`/api/transactions${suffix}`, { token });
}

export async function apiListTransactionReferenceData(token: string) {
  return apiRequest<{
    departments: TransactionReferenceDepartment[];
    budgets: TransactionReferenceBudget[];
  }>("/api/transactions/reference-data", { token });
}

export async function apiCreateTransaction(
  token: string,
  payload: {
    type: "INCOME" | "EXPENSE";
    amount?: string;
    fxCurrency?: "USD" | null;
    fxAmount?: string | null;
    budgetId?: string | null;
    departmentId?: string | null;
    date?: string;
    description?: string | null;
    status?: "DRAFT" | "PENDING" | "APPROVED" | "EXECUTED" | "REJECTED" | "REVERSED";
    splits?: Array<{ amount: string; categoryCode?: string | null; note?: string | null }>;
    attachments?: Array<{ fileName: string; fileUrl: string; fileSize?: number | null; mimeType?: string | null }>;
  },
) {
  return apiRequest<TransactionItem>("/api/transactions", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function apiUploadTransactionAttachment(token: string, file: File) {
  const body = new FormData();
  body.append("file", file);

  return apiRequest<UploadedTransactionAttachment>("/api/transactions/attachments", {
    method: "POST",
    token,
    body,
  });
}

export async function apiListRecurringTemplates(
  token: string,
  params?: { page?: number; limit?: number; active?: boolean },
) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.active !== undefined) query.set("active", String(params.active));
  const suffix = query.toString() ? `?${query.toString()}` : "";

  return apiRequest<{ templates: RecurringTemplateItem[] }>(`/api/transactions/recurring${suffix}`, { token });
}

export async function apiCreateRecurringTemplate(
  token: string,
  payload: {
    name: string;
    type: "INCOME" | "EXPENSE";
    amount: string;
    frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUALLY";
    nextRunAt: string;
    budgetId?: string | null;
    departmentId?: string | null;
    active?: boolean;
  },
) {
  return apiRequest<RecurringTemplateItem>("/api/transactions/recurring", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function apiRunRecurringTemplates(token: string) {
  return apiRequest<{
    scanned: number;
    created: number;
    createdTransactionIds: string[];
    failures: Array<{ recurringId: string; reason: string }>;
  }>("/api/transactions/recurring/run", {
    method: "POST",
    token,
  });
}

export async function apiListCashbook(token: string, params?: { accountId?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.accountId) query.set("accountId", params.accountId);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";

  return apiRequest<{ accounts: CashbookAccountItem[]; postings: CashbookPostingItem[] }>(`/api/cashbook${suffix}`, { token });
}

export async function apiReconcileCashbook(
  token: string,
  payload: { accountId: string; actualBalance: string; reason: string },
  idempotencyKey: string,
) {
  return apiRequest<{
    replayed: boolean;
    adjusted?: boolean;
    idempotencyKey: string;
    accountId?: string;
    systemBalance?: string;
    actualBalance?: string;
    delta?: string;
    adjustmentTransactionId?: string;
    cashbookPostingId?: string;
    ledgerEntryId?: string;
    message?: string;
  }>("/api/cashbook/reconcile", {
    method: "POST",
    token,
    headers: { "idempotency-key": idempotencyKey },
    body: payload,
  });
}
