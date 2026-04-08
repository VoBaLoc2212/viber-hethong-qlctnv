export type ReportType = "TOTAL_INCOME" | "TOTAL_EXPENSE" | "BUDGET_VS_ACTUAL" | "CASHFLOW_FORECAST";

export type ReportFilter = {
  fromDate?: string;
  toDate?: string;
  departmentId?: string;
  projectId?: string;
};

export type PieSeriesPoint = {
  label: string;
  value: number;
};

export type BudgetVsActualPoint = {
  label: string;
  budget: number;
  actual: number;
};

export type ForecastPoint = {
  period: string;
  projectedOutflow: number;
  projectedInflow: number;
};

export type ReportsOverview = {
  kpis: {
    totalBudget: number;
    totalSpent: number;
    totalIncome: number;
    remainingBalance: number;
    transactionCount: number;
    pendingCount: number;
  };
  monthlySeries: Array<{ month: string; income: number; expenses: number }>;
  recentTransactions: Array<{
    id: string;
    code: string;
    type: "INCOME" | "EXPENSE";
    amount: string;
    date: string;
    status: string;
    description?: string | null;
  }>;
  expenseComposition: PieSeriesPoint[];
  budgetVsActual: BudgetVsActualPoint[];
  cashflowForecastNextMonth: ForecastPoint[];
  appliedFilters: {
    statusExcludedForFinancialAmounts: string[];
    transactionCountIncludesAllStatuses: boolean;
    ruleDescription: string;
    fromDate: string | null;
    toDate: string | null;
    departmentId: string | null;
    departmentFilterMode: "GUID_IGNORED" | "DEPARTMENT_APPLIED" | "NONE";
  };
};
