export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ApprovalRequest = {
  id: string;
  requestCode: string;
  transactionId: string;
  requesterId: string;
  approverId: string;
  amount: string;
  status: ApprovalStatus;
  approvedAt?: string;
  rejectedAt?: string;
  reason?: string;
};

export type EncumbranceSnapshot = {
  budgetId: string;
  reservedBefore: string;
  reservedAfter: string;
  amount: string;
};
