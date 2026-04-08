"use client";

import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";


export type TransactionType = "INCOME" | "EXPENSE";
export type TransactionStatus = "DRAFT" | "PENDING" | "APPROVED" | "EXECUTED" | "REJECTED" | "REVERSED";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ReimbursementStatus =
  | "PENDING_APPROVAL"
  | "ADVANCE_APPROVED"
  | "ADVANCE_PAID"
  | "SETTLEMENT_SUBMITTED"
  | "SETTLEMENT_REVIEWED"
  | "COMPLETED"
  | "REJECTED";
export type SettlementDirection = "RETURN_TO_COMPANY" | "PAY_TO_EMPLOYEE" | "NO_CHANGE";
export type UserRole = "EMPLOYEE" | "MANAGER" | "ACCOUNTANT" | "FINANCE_ADMIN" | "AUDITOR";

export type Department = {
  id: string;
  name: string;
  code: string;
  budgetAllocated: number;
};

export type Transaction = {
  id: string;
  transactionCode: string;
  type: TransactionType;
  amount: number;
  categoryId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  date: string;
  description: string | null;
  status: TransactionStatus;
  createdAt: string;
};

export type AppUser = {
  id: string;
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

export type ReimbursementItem = {
  id: string;
  employeeId: string;
  approvedById: string | null;
  paidById: string | null;
  reviewedById: string | null;
  purpose: string;
  advanceAmount: string;
  actualAmount: string | null;
  netAmount: string | null;
  settlementDirection: SettlementDirection | null;
  settlementNote: string | null;
  attachments: Array<{ fileName: string; fileUrl: string; fileSize?: number | null; mimeType?: string | null }>;
  status: ReimbursementStatus;
  advanceRequestedAt: string;
  advanceApprovedAt: string | null;
  advancePaidAt: string | null;
  settlementSubmittedAt: string | null;
  settlementReviewedAt: string | null;
  completedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: { id: string; fullName: string; email: string };
  approvedBy?: { id: string; fullName: string } | null;
  paidBy?: { id: string; fullName: string } | null;
  reviewedBy?: { id: string; fullName: string } | null;
};

export type NotificationItem = {
  id: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  referenceType: string | null;
  referenceId: string | null;
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

export type ExpensesByMonthRow = {
  month: string;
  income: number;
  expenses: number;
};

export type ExpensesByMonthPayload = {
  rows: ExpensesByMonthRow[];
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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
    credentials: "include",
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

export function useGetDepartments(
  options?: Omit<UseQueryOptions<Department[]>, "queryKey" | "queryFn">,
) {
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
  departmentId?: string;
  q?: string;
};

export function useGetTransactions(
  params: GetTransactionsParams = {},
  options?: Omit<UseQueryOptions<Paginated<Transaction>>, "queryKey" | "queryFn">,
) {
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
  departmentId?: string;
  categoryId?: string;
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
  mutation?: UseMutationOptions<Transaction, Error, { id: string; data: { status: TransactionStatus } }>;
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

export function useGetDashboardKpis(
  options?: Omit<UseQueryOptions<DashboardKpis>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: ["/api/dashboard/kpis"],
    queryFn: () => fetchJson<DashboardKpis>("/api/dashboard/kpis"),
    ...options,
  });
}

export function useGetExpensesByMonth(
  options?: Omit<UseQueryOptions<ExpensesByMonthRow[]>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: ["/api/dashboard/expenses-by-month"],
    queryFn: async () => {
      const result = await fetchJson<ExpensesByMonthPayload>("/api/dashboard/expenses-by-month");
      return result.rows;
    },
    ...options,
  });
}

export function useGetFxRates(
  params: GetFxRatesParams = {},
  options?: Omit<UseQueryOptions<Paginated<FxRate>>, "queryKey" | "queryFn">,
) {
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

// ─── Approvals ───

type QueryHookOptions<T> = Omit<UseQueryOptions<T>, "queryKey" | "queryFn">;

export function useGetApprovals(
  params: { status?: ApprovalStatus } = {},
  options?: QueryHookOptions<ApprovalItem[]>,
) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  const url = `/api/approvals${search.toString() ? `?${search.toString()}` : ""}`;

  return useQuery({
    queryKey: ["/api/approvals", params],
    queryFn: async () => {
      const result = await fetchJson<{ approvals: ApprovalItem[] }>(url);
      return result.approvals;
    },
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
        reason?: string;
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

export function useGetReimbursements(
  params: { page?: number; limit?: number; status?: ReimbursementStatus; mine?: boolean } = {},
  options?: QueryHookOptions<{ reimbursements: ReimbursementItem[]; total: number; page: number; limit: number }>,
) {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.status) search.set("status", params.status);
  if (params.mine) search.set("mine", "true");

  const url = `/api/reimbursements${search.toString() ? `?${search.toString()}` : ""}`;

  return useQuery({
    queryKey: ["/api/reimbursements", params],
    queryFn: async () => {
      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        credentials: "include",
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

      const payload = (await res.json()) as {
        data: { reimbursements: ReimbursementItem[] };
        meta?: { total?: number; page?: number; limit?: number };
      };

      return {
        reimbursements: payload.data.reimbursements,
        total: payload.meta?.total ?? payload.data.reimbursements.length,
        page: payload.meta?.page ?? params.page ?? 1,
        limit: payload.meta?.limit ?? params.limit ?? payload.data.reimbursements.length,
      };
    },
    ...options,
  });
}

export function useCreateReimbursement(opts?: {
  mutation?: UseMutationOptions<
    ReimbursementItem,
    Error,
    {
      data: {
        purpose: string;
        advanceAmount: string;
      };
    }
  >;
}) {
  return useMutation({
    mutationFn: ({ data }) =>
      fetchJson<ReimbursementItem>("/api/reimbursements", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ...(opts?.mutation ?? {}),
  });
}

export function useGetReimbursementById(id: string | null, options?: QueryHookOptions<ReimbursementItem>) {
  return useQuery({
    queryKey: ["/api/reimbursements", id],
    queryFn: () => fetchJson<ReimbursementItem>(`/api/reimbursements/${id}`),
    enabled: Boolean(id),
    ...options,
  });
}

type ReimbursementAction =
  | "approve"
  | "reject"
  | "pay-advance"
  | "submit-settlement"
  | "review-settlement"
  | "complete";

function createIdempotencyKey(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useReimbursementAction(opts?: {
  mutation?: UseMutationOptions<
    ReimbursementItem,
    Error,
    {
      id: string;
      action: ReimbursementAction;
      data?: Record<string, unknown>;
    }
  >;
}) {
  return useMutation({
    mutationFn: ({ id, action, data }) => {
      const headers: Record<string, string> = {};
      if (action === "pay-advance" || action === "complete") {
        headers["idempotency-key"] = createIdempotencyKey(`reimbursement-${action}`);
      }

      return fetchJson<ReimbursementItem>(`/api/reimbursements/${id}/${action}`, {
        method: "POST",
        headers,
        body: JSON.stringify(data ?? {}),
      });
    },
    ...(opts?.mutation ?? {}),
  });
}
