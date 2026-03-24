export type UserRole = "EMPLOYEE" | "MANAGER" | "ACCOUNTANT" | "FINANCE_ADMIN" | "AUDITOR";

export type Money = {
  amount: string;
  currency: string;
};

export type ApiErrorShape = {
  code: string;
  message: string;
  details?: unknown;
  correlationId?: string;
};
