"use client";

import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

export type TransactionType = "INCOME" | "EXPENSE";
export type TransactionStatus = "PENDING" | "APPROVED" | "REJECTED";

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
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = (await res.json()) as any;
      message = body?.error ?? message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

export function useGetDepartments(
  options?: UseQueryOptions<Department[]>,
) {
  return useQuery({
    queryKey: ["/api/departments"],
    queryFn: () => fetchJson<Department[]>("/api/departments"),
    ...options,
  });
}

export function useCreateDepartment(opts?: {
  mutation?: UseMutationOptions<Department, Error, { data: Omit<Department, "id"> }>;
}) {
  return useMutation({
    mutationFn: ({ data }) =>
      fetchJson<Department>("/api/departments", {
        method: "POST",
        body: JSON.stringify(data),
      }),
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
    queryFn: () => fetchJson<ExpensesByMonthRow[]>("/api/dashboard/expenses-by-month"),
    ...options,
  });
}
