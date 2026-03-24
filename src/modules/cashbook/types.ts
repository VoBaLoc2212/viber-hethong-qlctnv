export type CashbookAccountType = "CASH" | "BANK";

export type CashbookAccount = {
  id: string;
  name: string;
  type: CashbookAccountType;
  balance: string;
  currency: "VND";
  updatedAt: string;
};

export type CashbookPosting = {
  id: string;
  accountId: string;
  transactionId: string;
  direction: "IN" | "OUT";
  amount: string;
  postedAt: string;
};
