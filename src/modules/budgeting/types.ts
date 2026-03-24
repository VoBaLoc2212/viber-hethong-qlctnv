export type BudgetPeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  createdBy: string;
};

export type Budget = {
  id: string;
  ownerType: "DEPARTMENT" | "PROJECT";
  ownerId: string;
  periodId: string;
  amount: string;
  reserved: string;
  used: string;
  currency: "VND";
};

export type BudgetAvailability = {
  budgetId: string;
  amount: string;
  reserved: string;
  used: string;
  available: string;
};
