import type { Prisma, RecurringFrequency, TransactionStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";
import { EXCLUDED_FROM_GLOBAL_METRICS, globalMetricsScopeDescription } from "@/modules/shared/finance/metrics-scope";
import { type AuthContext, requireRole } from "@/modules/shared";

import type { ReportsOverview } from "../types";

type ReportFilter = {
  fromDate?: string;
  toDate?: string;
  departmentId?: string;
};

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isGuid(value?: string) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

function toMonthKey(date: Date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function formatLabel(date: Date) {
  return date.toLocaleString("vi-VN", { month: "short", year: "numeric" });
}

function parseBudgetPeriod(period: string): Date | null {
  const match = period.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null;
  }

  return new Date(Date.UTC(year, monthIndex, 1));
}

function addByFrequency(date: Date, frequency: RecurringFrequency): Date {
  const next = new Date(date);

  switch (frequency) {
    case "DAILY":
      next.setUTCDate(next.getUTCDate() + 1);
      return next;
    case "WEEKLY":
      next.setUTCDate(next.getUTCDate() + 7);
      return next;
    case "MONTHLY":
      next.setUTCMonth(next.getUTCMonth() + 1);
      return next;
    case "QUARTERLY":
      next.setUTCMonth(next.getUTCMonth() + 3);
      return next;
    case "ANNUALLY":
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      return next;
    default:
      return next;
  }
}

function weekLabel(dayOfMonth: number): string {
  const weekIndex = Math.min(5, Math.floor((dayOfMonth - 1) / 7) + 1);
  return `Tuần ${weekIndex}`;
}

export async function getReportsOverview(auth: AuthContext, filter: ReportFilter): Promise<ReportsOverview> {
  requireRole(auth, ["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

  const fromDate = parseDate(filter.fromDate);
  const toDate = parseDate(filter.toDate);

  const rawDepartmentInput = filter.departmentId?.trim() || undefined;
  const isDepartmentGuid = isGuid(rawDepartmentInput);

  let departmentId: string | undefined;
  if (isDepartmentGuid) {
    departmentId = rawDepartmentInput;
  } else if (rawDepartmentInput) {
    const matchedDepartment = await prisma.department.findFirst({
      where: {
        code: {
          equals: rawDepartmentInput,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    });
    departmentId = matchedDepartment?.id;
  }

  const transactionCountWhere: Prisma.TransactionWhereInput = {
    departmentId,
    date:
      fromDate || toDate
        ? {
            gte: fromDate,
            lte: toDate,
          }
        : undefined,
  };

  const financialAmountWhere: Prisma.TransactionWhereInput = {
    ...transactionCountWhere,
    status: {
      notIn: [...EXCLUDED_FROM_GLOBAL_METRICS] as TransactionStatus[],
    },
  };

  const [departmentAgg, txAgg, pendingCount, transactionCount, transactions, splitAgg, unsplitExpenses, budgets, recurringRows] =
    await Promise.all([
      prisma.department.aggregate({
        _sum: { budgetAllocated: true },
        where: departmentId ? { id: departmentId } : undefined,
      }),
      prisma.transaction.groupBy({
        by: ["type"],
        where: financialAmountWhere,
        _sum: {
          amount: true,
        },
      }),
      prisma.transaction.count({
        where: {
          ...transactionCountWhere,
          status: "PENDING",
        },
      }),
      prisma.transaction.count({
        where: transactionCountWhere,
      }),
      prisma.transaction.findMany({
        where: financialAmountWhere,
        select: {
          id: true,
          code: true,
          type: true,
          amount: true,
          date: true,
          status: true,
          description: true,
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 200,
      }),
      prisma.transactionSplit.groupBy({
        by: ["categoryCode"],
        where: {
          transaction: {
            ...financialAmountWhere,
            type: "EXPENSE",
          },
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.transaction.findMany({
        where: {
          ...financialAmountWhere,
          type: "EXPENSE",
          splits: {
            none: {},
          },
        },
        select: {
          amount: true,
        },
      }),
      prisma.budget.findMany({
        where: departmentId ? { departmentId: departmentId } : undefined,
        select: {
          period: true,
          amount: true,
          used: true,
        },
      }),
      prisma.recurringTransaction.findMany({
        where: {
          active: true,
          ...(departmentId ? { departmentId: departmentId } : {}),
        },
        select: {
          amount: true,
          type: true,
          frequency: true,
          nextRunAt: true,
        },
      }),
    ]);

  const totalBudget = Number((departmentAgg._sum.budgetAllocated ?? 0).toString());
  const totalSpentRaw = txAgg.find((row) => row.type === "EXPENSE")?._sum?.amount;
  const totalIncomeRaw = txAgg.find((row) => row.type === "INCOME")?._sum?.amount;
  const totalSpent = Number((totalSpentRaw ?? 0).toString());
  const totalIncome = Number((totalIncomeRaw ?? 0).toString());

  const byMonth = new Map<string, { month: string; income: number; expenses: number }>();
  for (const tx of [...transactions].reverse()) {
    const d = new Date(tx.date);
    const key = toMonthKey(d);
    if (!byMonth.has(key)) {
      byMonth.set(key, { month: formatLabel(d), income: 0, expenses: 0 });
    }

    const row = byMonth.get(key);
    if (!row) continue;

    const amount = Number(tx.amount.toFixed(2));
    if (tx.type === "INCOME") row.income += amount;
    if (tx.type === "EXPENSE") row.expenses += amount;
  }

  const monthlySeries = Array.from(byMonth.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, v]) => v)
    .slice(-6);

  const recentTransactions = transactions.slice(0, 10).map((tx) => ({
    id: tx.id,
    code: tx.code,
    type: tx.type,
    amount: tx.amount.toFixed(2),
    date: tx.date.toISOString(),
    status: tx.status,
    description: tx.description,
  }));

  const compositionMap = new Map<string, number>();
  for (const row of splitAgg) {
    const label = row.categoryCode?.trim() || "Khác";
    const value = Number((row._sum.amount ?? 0).toString());
    if (value <= 0) continue;
    compositionMap.set(label, (compositionMap.get(label) ?? 0) + value);
  }

  const uncategorizedTotal = unsplitExpenses.reduce((sum, row) => sum + Number(row.amount.toString()), 0);
  if (uncategorizedTotal > 0) {
    compositionMap.set("Chưa phân loại", (compositionMap.get("Chưa phân loại") ?? 0) + uncategorizedTotal);
  }

  const expenseComposition = Array.from(compositionMap.entries())
    .map(([label, value]) => ({ label, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value);

  const fromMonthKey = fromDate ? toMonthKey(fromDate) : null;
  const toMonthKeyValue = toDate ? toMonthKey(toDate) : null;

  const budgetVsActual = budgets
    .filter((budget) => {
      const parsed = parseBudgetPeriod(budget.period);
      if (!parsed || (!fromMonthKey && !toMonthKeyValue)) return true;
      const periodKey = toMonthKey(parsed);
      if (fromMonthKey && periodKey < fromMonthKey) return false;
      if (toMonthKeyValue && periodKey > toMonthKeyValue) return false;
      return true;
    })
    .map((budget) => ({
      label: budget.period,
      budget: Number(budget.amount.toString()),
      actual: Number(budget.used.toString()),
    }))
    .sort((a, b) => (a.label < b.label ? -1 : 1));

  const now = new Date();
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const nextMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1));

  const forecastMap = new Map<string, { period: string; projectedOutflow: number; projectedInflow: number }>([
    ["Tuần 1", { period: "Tuần 1", projectedOutflow: 0, projectedInflow: 0 }],
    ["Tuần 2", { period: "Tuần 2", projectedOutflow: 0, projectedInflow: 0 }],
    ["Tuần 3", { period: "Tuần 3", projectedOutflow: 0, projectedInflow: 0 }],
    ["Tuần 4", { period: "Tuần 4", projectedOutflow: 0, projectedInflow: 0 }],
    ["Tuần 5", { period: "Tuần 5", projectedOutflow: 0, projectedInflow: 0 }],
  ]);

  for (const recurring of recurringRows) {
    let cursor = new Date(recurring.nextRunAt);
    let guard = 0;

    while (cursor < nextMonthStart && guard < 500) {
      cursor = addByFrequency(cursor, recurring.frequency);
      guard += 1;
    }

    while (cursor < nextMonthEnd && guard < 1000) {
      if (cursor >= nextMonthStart) {
        const period = weekLabel(cursor.getUTCDate());
        const row = forecastMap.get(period);
        if (row) {
          const amount = Number(recurring.amount.toString());
          if (recurring.type === "EXPENSE") row.projectedOutflow += amount;
          if (recurring.type === "INCOME") row.projectedInflow += amount;
        }
      }

      cursor = addByFrequency(cursor, recurring.frequency);
      guard += 1;
    }
  }

  const cashflowForecastNextMonth = Array.from(forecastMap.values()).map((row) => ({
    period: row.period,
    projectedOutflow: Number(row.projectedOutflow.toFixed(2)),
    projectedInflow: Number(row.projectedInflow.toFixed(2)),
  }));

  return {
    kpis: {
      totalBudget,
      totalSpent,
      totalIncome,
      remainingBalance: totalBudget - totalSpent,
      transactionCount,
      pendingCount,
    },
    monthlySeries,
    recentTransactions,
    expenseComposition,
    budgetVsActual,
    cashflowForecastNextMonth,
    appliedFilters: {
      statusExcludedForFinancialAmounts: [...EXCLUDED_FROM_GLOBAL_METRICS],
      transactionCountIncludesAllStatuses: true,
      ruleDescription: globalMetricsScopeDescription(),
      fromDate: fromDate ? fromDate.toISOString() : null,
      toDate: toDate ? toDate.toISOString() : null,
      departmentId: departmentId ?? null,
      departmentFilterMode: !rawDepartmentInput
        ? "NONE"
        : departmentId
          ? "DEPARTMENT_APPLIED"
          : "GUID_IGNORED",
    },
  };
}
