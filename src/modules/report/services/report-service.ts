import type { Prisma, TransactionStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";
import { type AuthContext, requireRole } from "@/modules/shared";

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

function formatMonthKey(date: Date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function formatLabel(date: Date) {
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

export async function getReportsOverview(auth: AuthContext, filter: ReportFilter) {
  requireRole(auth, ["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

  const fromDate = parseDate(filter.fromDate);
  const toDate = parseDate(filter.toDate);

  const txWhere: Prisma.TransactionWhereInput = {
    status: {
      notIn: ["REJECTED", "REVERSED"] as TransactionStatus[],
    },
    departmentId: filter.departmentId,
    date:
      fromDate || toDate
        ? {
            gte: fromDate,
            lte: toDate,
          }
        : undefined,
  };

  const [departmentAgg, txAgg, pendingCount, transactionCount, transactions] = await Promise.all([
    prisma.department.aggregate({
      _sum: { budgetAllocated: true },
      where: filter.departmentId ? { id: filter.departmentId } : undefined,
    }),
    prisma.transaction.groupBy({
      by: ["type"],
      where: txWhere,
      _sum: {
        amount: true,
      },
    }),
    prisma.transaction.count({
      where: {
        ...txWhere,
        status: "PENDING",
      },
    }),
    prisma.transaction.count({
      where: txWhere,
    }),
    prisma.transaction.findMany({
      where: txWhere,
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
  ]);

  const totalBudget = Number((departmentAgg._sum.budgetAllocated ?? 0).toString());
  const totalSpentRaw = txAgg.find((row) => row.type === "EXPENSE")?._sum?.amount;
  const totalIncomeRaw = txAgg.find((row) => row.type === "INCOME")?._sum?.amount;
  const totalSpent = Number((totalSpentRaw ?? 0).toString());
  const totalIncome = Number((totalIncomeRaw ?? 0).toString());

  const byMonth = new Map<string, { month: string; income: number; expenses: number }>();
  for (const tx of [...transactions].reverse()) {
    const d = new Date(tx.date);
    const key = formatMonthKey(d);
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
  };
}
