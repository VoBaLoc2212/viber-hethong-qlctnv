"use client";

import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth/rbac";

export type TransactionType = "INCOME" | "EXPENSE";
export type TransactionStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
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

export type ApprovalItem = {
  id: string;
  transactionId: string;
  transactionCode: string;
  transactionType: string;
  transactionStatus: string;
  transactionAmount: string;
  transactionDescription: string | null;
  requesterId: string;
  status: ApprovalStatus;
  note: string | null;
  approvedAt: string | null;
  createdAt: string;
  approver: { id: string; fullName: string; role: string } | null;
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

  const payload = (await res.json()) as { data?: T } | T;
  if (payload && typeof payload === "object" && "data" in (payload as any)) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

export function useGetDepartments(options?: UseQueryOptions<Department[]>) {
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
};

export function useGetTransactions(params: GetTransactionsParams = {}, options?: UseQueryOptions<Paginated<Transaction>>) {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.type) search.set("type", params.type);
  if (params.status) search.set("status", params.status);
  if (params.departmentId != null) search.set("departmentId", String(params.departmentId));
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

export function useGetDashboardKpis(options?: UseQueryOptions<DashboardKpis>) {
  return useQuery({
    queryKey: ["/api/dashboard/kpis"],
    queryFn: () => fetchJson<DashboardKpis>("/api/dashboard/kpis"),
    ...options,
  });
}

export function useGetExpensesByMonth(options?: UseQueryOptions<ExpensesByMonthRow[]>) {
  return useQuery({
    queryKey: ["/api/dashboard/expenses-by-month"],
    queryFn: async () => {
      const result = await fetchJson<{ rows: ExpensesByMonthRow[] }>("/api/dashboard/expenses-by-month");
      return result.rows;
    },
    ...options,
  });
}

// ─── Auth / User ───

export function useGetCurrentUser(options?: UseQueryOptions<AppUser>) {
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

export function useGetUsers(role?: UserRole, options?: UseQueryOptions<AppUser[]>) {
  const url = role ? `/api/auth/users?role=${role}` : "/api/auth/users";
  return useQuery({
    queryKey: ["/api/auth/users", role],
    queryFn: () => fetchJson<AppUser[]>(url),
    ...options,
  });
}

// ─── Approvals ───

export function useGetApprovals(
  params: { status?: ApprovalStatus } = {},
  options?: Omit<UseQueryOptions<ApprovalItem[]>, 'queryKey' | 'queryFn'>,
) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  const url = `/api/approvals${search.toString() ? `?${search.toString()}` : ""}`;

  return useQuery({
    queryKey: ["/api/approvals", params],
    queryFn: () => fetchJson<ApprovalItem[]>(url),
    ...options,
  });
}

export function useApprovalAction(opts?: {
  mutation?: UseMutationOptions<
    ApprovalItem,
    Error,
    {
      id: string;
      data: {
        action: "approve" | "reject" | "execute" | "not-execute";
        note?: string;
      };
    }
  >;
}) {
  return useMutation({
    mutationFn: ({ id, data }) =>
      fetchJson<ApprovalItem>(`/api/approvals/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    ...(opts?.mutation ?? {}),
  });
}

// ─── Notifications ───

export function useGetNotifications(options?: Omit<UseQueryOptions<NotificationsResponse>, 'queryKey' | 'queryFn'>) {
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
  options?: UseQueryOptions<BudgetAvailable>,
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
