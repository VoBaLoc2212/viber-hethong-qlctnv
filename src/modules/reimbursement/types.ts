export type AdvanceRequest = {
  id: string;
  employeeId: string;
  amount: string;
  purpose: string;
  status: "PENDING" | "APPROVED" | "PAID" | "SETTLED";
  createdAt: string;
};

export type ReimbursementSettlement = {
  id: string;
  advanceId: string;
  actualAmount: string;
  netAmount: string;
  direction: "RETURN_TO_COMPANY" | "PAY_TO_EMPLOYEE" | "NO_CHANGE";
  settledAt: string;
};
