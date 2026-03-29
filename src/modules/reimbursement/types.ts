export type ReimbursementStatus =
  | "PENDING_APPROVAL"
  | "ADVANCE_APPROVED"
  | "ADVANCE_PAID"
  | "SETTLEMENT_SUBMITTED"
  | "SETTLEMENT_REVIEWED"
  | "COMPLETED"
  | "REJECTED";

export type SettlementDirection = "RETURN_TO_COMPANY" | "PAY_TO_EMPLOYEE" | "NO_CHANGE";

export type ReimbursementAttachment = {
  fileName: string;
  fileUrl: string;
  fileSize?: number | null;
  mimeType?: string | null;
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
  attachments: ReimbursementAttachment[];
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
