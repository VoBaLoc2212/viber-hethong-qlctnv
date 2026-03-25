export type TransactionType = "EXPENSE" | "INCOME";
export type TransactionStatus = "DRAFT" | "PENDING" | "APPROVED" | "EXECUTED" | "REJECTED" | "REVERSED";

export type Transaction = {
  id: string;
  transactionCode: string;
  type: TransactionType;
  amount: string;
  currency: string;
  departmentId?: string | null;
  budgetId?: string | null;
  recurringSourceId?: string | null;
  fxCurrency?: string | null;
  fxAmount?: string | null;
  fxRate?: string | null;
  baseCurrency?: string | null;
  baseAmount?: string | null;
  fxRateProvider?: string | null;
  fxRateFetchedAt?: string | null;
  date: string;
  description?: string | null;
  status: TransactionStatus;
  createdAt: string;
};

export type SplitLine = {
  categoryId: string;
  amount: string;
  note?: string;
};
