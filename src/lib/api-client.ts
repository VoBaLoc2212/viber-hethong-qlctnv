"use client";

import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth/rbac";

type QueryHookOptions<TData> = Omit<UseQueryOptions<TData, Error, TData, readonly unknown[]>, "queryKey" | "queryFn">;

export type TransactionType = "INCOME" | "EXPENSE";
export type TransactionStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ApprovalRequestStatus = "NOT_YET" | "PENDING" | "APPROVED" | "NOT_APPROVED" | "EXECUTE" | "NOT_EXECUTE";
export type UserRole = "EMPLOYEE" | "MANAGER" | "ACCOUNTANT" | "FINANCE_ADMIN" | "AUDITOR";

export type Department = {
  id: number;
  name: string;
  code: string;
  budgetAllocated: number;
};

export type Transaction = {
  id: number;
  transactionCode: string;
  type: TransactionType;
  amount: number;
  categoryId: number | null;
  departmentId: number | null;
  departmentName: string | null;
  date: string;
  description: string | null;
  status: TransactionStatus;
  createdAt: string;
};

export type AppUser = {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
};

export type ApprovalRequest = {
  id: number;
  requestCode: string;
  title: string;
  description: string | null;
  amount: number;
  departmentId: number | null;
  departmentName: string | null;
  requesterId: number;
  requesterName: string;
  approverId: number | null;
  approverName: string | null;
  accountantId: number | null;
  accountantName: string | null;
  status: ApprovalRequestStatus;
  rejectionReason: string | null;
  notExecuteReason: string | null;
  executedAmount: number | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  executedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationItem = {
  id: number;
  recipientId: number;
  type: string;
  title: string;
  message: string;
  referenceType: string | null;
  referenceId: number | null;
  isRead: boolean;
  createdAt: string;
};

export type NotificationsResponse = {
  data: NotificationItem[];
  unreadCount: number;
};

export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
};

export type DashboardKpis = {
  totalBudget: number;
  totalSpent: number;
  remainingBalance: number;
  totalIncome: number;
  transactionCount: number;
  pendingCount: number;
  currency?: "VND" | "USD";
};

export type FxRate = {
  id: string;
  fromCurrency: "USD" | "VND";
  toCurrency: "USD" | "VND";
  rate: string;
  rateDate: string;
  source: string;
  fetchedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type GetFxRatesParams = {
  page?: number;
  limit?: number;
  fromCurrency?: string;
  toCurrency?: string;
  source?: string;
  rateDateFrom?: string;
  rateDateTo?: string;
  q?: string;
};

export type ExpensesByMonthRow = {
  month: string;
  income: number;
  expenses: number;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) : null;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = (await res.json()) as any;
      message = body?.message ?? body?.error ?? message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const payload = (await res.json()) as { data?: T; meta?: unknown } | T;
  if (payload && typeof payload === "object" && "data" in (payload as any) && "meta" in (payload as any)) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

export function useGetDepartments(options?: QueryHookOptions<Department[]>) {
  return useQuery({
    queryKey: ["/api/departments"],
    queryFn: async () => {
      const result = await fetchJson<{ departments: Department[] }>("/api/departments");
      return result.departments;
    },
    ...options,
  });
}

export function useCreateDepartment(opts?: {
  mutation?: UseMutationOptions<Department, Error, { data: Omit<Department, "id"> }>;
}) {
  return useMutation({
    mutationFn: ({ data }) => fetchJson<Department>("/api/departments", { method: "POST", body: JSON.stringify(data) }),
    ...(opts?.mutation ?? {}),
  });
}

export type GetTransactionsParams = {
  page?: number;
  limit?: number;
  type?: TransactionType;
  status?: TransactionStatus;
  departmentId?: number;
  q?: string;
};

export function useGetTransactions(params: GetTransactionsParams = {}, options?: QueryHookOptions<Paginated<Transaction>>) {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.type) search.set("type", params.type);
  if (params.status) search.set("status", params.status);
  if (params.departmentId != null) search.set("departmentId", String(params.departmentId));
  if (params.q?.trim()) search.set("q", params.q.trim());
  const url = `/api/transactions${search.toString() ? `?${search.toString()}` : ""}`;

  return useQuery({
    queryKey: ["/api/transactions", params],
    queryFn: () => fetchJson<Paginated<Transaction>>(url),
    ...options,
  });
}

export type CreateTransactionInput = {
  type: TransactionType;
  amount: number;
  description?: string;
  departmentId?: number;
  categoryId?: number;
  date: string;
  status?: TransactionStatus;
};

export function useCreateTransaction(opts?: {
  mutation?: UseMutationOptions<Transaction, Error, { data: CreateTransactionInput }>;
}) {
  return useMutation({
    mutationFn: ({ data }) =>
      fetchJson<Transaction>("/api/transactions", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ...(opts?.mutation ?? {}),
  });
}

export function useUpdateTransactionStatus(opts?: {
  mutation?: UseMutationOptions<Transaction, Error, { id: number; data: { status: TransactionStatus } }>;
}) {
  return useMutation({
    mutationFn: ({ id, data }) =>
      fetchJson<Transaction>(`/api/transactions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    ...(opts?.mutation ?? {}),
  });
}

export function useGetDashboardKpis(options?: QueryHookOptions<DashboardKpis>) {
  return useQuery({
    queryKey: ["/api/dashboard/kpis"],
    queryFn: () => fetchJson<DashboardKpis>("/api/dashboard/kpis"),
    ...options,
  });
}

export function useGetExpensesByMonth(options?: QueryHookOptions<ExpensesByMonthRow[]>) {
  return useQuery({
    queryKey: ["/api/dashboard/expenses-by-month"],
    queryFn: async () => {
      const result = await fetchJson<{ rows: ExpensesByMonthRow[]; currency?: "VND" | "USD" }>("/api/dashboard/expenses-by-month");
      return result.rows;
    },
    ...options,
  });
}

// ─── Auth / User ───

export function useGetCurrentUser(options?: QueryHookOptions<AppUser>) {
  return useQuery({
    queryKey: ["/api/auth"],
    queryFn: () => fetchJson<AppUser>("/api/auth"),
    ...options,
  });
}

export function useSwitchUser(opts?: {
  mutation?: UseMutationOptions<AppUser, Error, { userId: number }>;
}) {
  return useMutation({
    mutationFn: ({ userId }) =>
      fetchJson<AppUser>("/api/auth", {
        method: "PUT",
        body: JSON.stringify({ userId }),
      }),
    ...(opts?.mutation ?? {}),
  });
}

export function useLogout(opts?: {
  mutation?: UseMutationOptions<{ success: boolean }, Error, void>;
}) {
  return useMutation({
    mutationFn: () =>
      fetchJson<{ success: boolean }>("/api/auth/logout", {
        method: "POST",
      }),
    ...(opts?.mutation ?? {}),
  });
}

export function useGetUsers(role?: UserRole, options?: QueryHookOptions<AppUser[]>) {
  const url = role ? `/api/auth/users?role=${role}` : "/api/auth/users";
  return useQuery({
    queryKey: ["/api/auth/users", role],
    queryFn: () => fetchJson<AppUser[]>(url),
    ...options,
  });
}

// ─── Approvals ───

export function useGetApprovals(
  params: { tab?: string; status?: ApprovalRequestStatus } = {},
  options?: QueryHookOptions<ApprovalRequest[]>,
) {
  const search = new URLSearchParams();
  if (params.tab) search.set("tab", params.tab);
  if (params.status) search.set("status", params.status);
  const url = `/api/approvals${search.toString() ? `?${search.toString()}` : ""}`;

  return useQuery({
    queryKey: ["/api/approvals", params],
    queryFn: async () => {
      const result = await fetchJson<ApprovalRequest[] | { approvals: ApprovalRequest[] }>(url);
      return Array.isArray(result) ? result : result.approvals;
    },
    ...options,
  });
}

export function useCreateApproval(opts?: {
  mutation?: UseMutationOptions<
    ApprovalRequest,
    Error,
    { data: { title: string; description?: string; amount: number; departmentId?: number } }
  >;
}) {
  return useMutation({
    mutationFn: ({ data }) =>
      fetchJson<ApprovalRequest>("/api/approvals", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ...(opts?.mutation ?? {}),
  });
}

export function useUpdateApproval(opts?: {
  mutation?: UseMutationOptions<
    ApprovalRequest,
    Error,
    { id: number; data: { title?: string; description?: string; amount?: number; departmentId?: number } }
  >;
}) {
  return useMutation({
    mutationFn: ({ id, data }) =>
      fetchJson<ApprovalRequest>(`/api/approvals/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    ...(opts?.mutation ?? {}),
  });
}

export function useDeleteApproval(opts?: {
  mutation?: UseMutationOptions<{ success: boolean }, Error, { id: number }>;
}) {
  return useMutation({
    mutationFn: ({ id }) =>
      fetchJson<{ success: boolean }>(`/api/approvals/${id}`, {
        method: "DELETE",
      }),
    ...(opts?.mutation ?? {}),
  });
}

export function useApprovalAction(opts?: {
  mutation?: UseMutationOptions<
    ApprovalRequest,
    Error,
    {
      id: number;
      data: {
        action: "submit" | "approve" | "reject" | "execute" | "not-execute";
        accountantId?: number;
        rejectionReason?: string;
        notExecuteReason?: string;
        executedAmount?: number;
      };
    }
  >;
}) {
  return useMutation({
    mutationFn: ({ id, data }) =>
      fetchJson<ApprovalRequest>(`/api/approvals/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    ...(opts?.mutation ?? {}),
  });
}

// ─── Notifications ───

export function useGetNotifications(options?: QueryHookOptions<NotificationsResponse>) {
  return useQuery({
    queryKey: ["/api/notifications"],
    queryFn: () => fetchJson<NotificationsResponse>("/api/notifications"),
    refetchInterval: 10000,
    ...options,
  });
}

export function useMarkNotificationRead(opts?: {
  mutation?: UseMutationOptions<NotificationItem, Error, { id: number }>;
}) {
  return useMutation({
    mutationFn: ({ id }) =>
      fetchJson<NotificationItem>(`/api/notifications/${id}`, {
        method: "PATCH",
      }),
    ...(opts?.mutation ?? {}),
  });
}

export function useMarkAllNotificationsRead(opts?: {
  mutation?: UseMutationOptions<{ success: boolean }, Error, void>;
}) {
  return useMutation({
    mutationFn: () =>
      fetchJson<{ success: boolean }>("/api/notifications/read-all", {
        method: "PATCH",
      }),
    ...(opts?.mutation ?? {}),
  });
}

// ─── Budgets ───

export type BudgetAvailable = {
  departmentId: number;
  period: string;
  amount: number;
  reserved: number;
  used: number;
  available: number;
};

export function useBudgetAvailable(
  params: { departmentId?: number; period?: string },
  options?: QueryHookOptions<BudgetAvailable>,
) {
  const search = new URLSearchParams();
  if (params.departmentId != null) search.set("departmentId", String(params.departmentId));
  if (params.period) search.set("period", params.period);
  const url = `/api/budgets/available?${search.toString()}`;

  return useQuery({
    queryKey: ["/api/budgets/available", params],
    queryFn: () => fetchJson<BudgetAvailable>(url),
    enabled: !!params.departmentId,
    ...options,
  });
}

export function useGetFxRates(params: GetFxRatesParams = {}, options?: QueryHookOptions<Paginated<FxRate>>) {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.fromCurrency?.trim()) search.set("fromCurrency", params.fromCurrency.trim().toUpperCase());
  if (params.toCurrency?.trim()) search.set("toCurrency", params.toCurrency.trim().toUpperCase());
  if (params.source?.trim()) search.set("source", params.source.trim());
  if (params.rateDateFrom?.trim()) search.set("rateDateFrom", params.rateDateFrom.trim());
  if (params.rateDateTo?.trim()) search.set("rateDateTo", params.rateDateTo.trim());
  if (params.q?.trim()) search.set("q", params.q.trim());

  const url = `/api/fx-rates${search.toString() ? `?${search.toString()}` : ""}`;

  return useQuery({
    queryKey: ["/api/fx-rates", params],
    queryFn: () => fetchJson<Paginated<FxRate>>(url),
    ...options,
  });
}

export function useCreateFxRate(opts?: {
  mutation?: UseMutationOptions<
    FxRate,
    Error,
    {
      data: {
        fromCurrency: string;
        toCurrency: string;
        rateDate: string;
        rate: string;
        source?: string;
      };
    }
  >;
}) {
  return useMutation({
    mutationFn: ({ data }) =>
      fetchJson<FxRate>("/api/fx-rates", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ...(opts?.mutation ?? {}),
  });
}

export function useUpdateFxRate(opts?: {
  mutation?: UseMutationOptions<
    FxRate,
    Error,
    {
      id: string;
      data: {
        rate?: string;
        source?: string;
        rateDate?: string;
      };
    }
  >;
}) {
  return useMutation({
    mutationFn: ({ id, data }) =>
      fetchJson<FxRate>(`/api/fx-rates/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    ...(opts?.mutation ?? {}),
  });
}
