export type LedgerEntryType = "EXPENSE" | "INCOME" | "TRANSFER" | "ADJUSTMENT" | "REVERSAL";

export type LedgerEntry = {
  id: string;
  entryCode: string;
  type: LedgerEntryType;
  amount: string;
  currency: "VND";
  referenceType: "TRANSACTION" | "BUDGET_TRANSFER" | "REIMBURSEMENT" | "RECONCILIATION";
  referenceId: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
};

export type ReversalPayload = {
  targetEntryId: string;
  reason: string;
  createdBy: string;
};
