export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

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
