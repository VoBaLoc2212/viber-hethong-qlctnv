export type LedgerEntryType = "EXPENSE" | "INCOME" | "TRANSFER" | "ADJUSTMENT" | "REVERSAL";

export type LedgerEntry = {
  id: string;
  entryCode: string;
  type: LedgerEntryType;
  amount: string;
  currency: string;
  referenceType: "TRANSACTION" | "BUDGET_TRANSFER" | "REIMBURSEMENT" | "RECONCILIATION";
  referenceId: string;
  reversalOfId?: string | null;
  fxCurrency?: string | null;
  fxAmount?: string | null;
  fxRate?: string | null;
  baseCurrency?: string | null;
  baseAmount?: string | null;
  fxRateProvider?: string | null;
  fxRateFetchedAt?: string | null;
  reconciliationStatus?: "UNRECONCILED" | "RECONCILED" | "EXCEPTION";
  reconciledAt?: string | null;
  reconciledById?: string | null;
  reconciliationRef?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type ReversalPayload = {
  targetEntryId: string;
  reason: string;
  createdBy: string;
};
