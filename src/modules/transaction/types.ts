export type TransactionType = "EXPENSE" | "INCOME";
export type TransactionStatus = "DRAFT" | "PENDING" | "APPROVED" | "EXECUTED" | "REJECTED" | "REVERSED";

export type Transaction = {
  id: string;
  transactionCode: string;
  type: TransactionType;
  amount: string;
  departmentId?: string;
  categoryId?: string;
  date: string;
  description?: string;
  status: TransactionStatus;
  createdBy: string;
  createdAt: string;
};

export type SplitLine = {
  categoryId: string;
  amount: string;
  note?: string;
};
