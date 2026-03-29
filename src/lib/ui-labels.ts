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
