import type { UserRole } from "@/modules/shared/contracts/domain";

const ROLE_LABELS: Record<UserRole, string> = {
  EMPLOYEE: "Nhân viên",
  MANAGER: "Quản lý",
  ACCOUNTANT: "Kế toán",
  FINANCE_ADMIN: "Quản trị tài chính",
  AUDITOR: "Kiểm toán",
};

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  INCOME: "Thu",
  EXPENSE: "Chi",
};

const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Nháp",
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  EXECUTED: "Đã thực hiện",
  REJECTED: "Từ chối",
  REVERSED: "Đảo bút toán",
};

const LEDGER_ENTRY_TYPE_LABELS: Record<string, string> = {
  EXPENSE: "Chi",
  INCOME: "Thu",
  TRANSFER: "Chuyển khoản",
  ADJUSTMENT: "Điều chỉnh",
  REVERSAL: "Bút toán đảo",
};

const TRANSACTION_STATUS_BADGE_CLASS: Record<string, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-700",
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  APPROVED: "border-blue-200 bg-blue-50 text-blue-700",
  EXECUTED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
  REVERSED: "border-purple-200 bg-purple-50 text-purple-700",
};

export function getRoleLabel(role?: UserRole | null): string {
  if (!role) return "Chưa có";
  return ROLE_LABELS[role] ?? role;
}

export function getTransactionTypeLabel(type?: string | null): string {
  if (!type) return "-";
  return TRANSACTION_TYPE_LABELS[type] ?? type;
}

export function getTransactionStatusLabel(status?: string | null): string {
  if (!status) return "-";
  return TRANSACTION_STATUS_LABELS[status] ?? status;
}

export function getLedgerEntryTypeLabel(type?: string | null): string {
  if (!type) return "-";
  return LEDGER_ENTRY_TYPE_LABELS[type] ?? type;
}

export function getTransactionStatusBadgeClass(status?: string | null): string {
  if (!status) return TRANSACTION_STATUS_BADGE_CLASS.DRAFT;
  return TRANSACTION_STATUS_BADGE_CLASS[status] ?? TRANSACTION_STATUS_BADGE_CLASS.DRAFT;
}

export function formatVnd(value: string | number): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric)) {
    return typeof value === "string" ? value : "0 đ";
  }

  return `${new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(Math.round(numeric))} đ`;
}
