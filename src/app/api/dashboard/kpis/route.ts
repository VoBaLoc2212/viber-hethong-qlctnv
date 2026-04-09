import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";
import { EXCLUDED_FROM_GLOBAL_METRICS, globalMetricsScopeDescription } from "@/modules/shared/finance/metrics-scope";
import { handleApiError, requireAuth, requireRole } from "@/modules/shared";
import { ok } from "@/modules/shared/http/response";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

    const transactionCountWhere: Prisma.TransactionWhereInput = {
      ...(auth.role === "EMPLOYEE" ? { createdById: auth.userId } : {}),
    };

    const financialAmountWhere: Prisma.TransactionWhereInput = {
      ...transactionCountWhere,
      OR: [
        {
          type: "INCOME",
          status: {
            notIn: [...EXCLUDED_FROM_GLOBAL_METRICS],
          },
        },
        {
          type: "EXPENSE",
          status: "EXECUTED",
        },
      ],
    };

    const [departmentAgg, txAgg, pendingCount, transactionCount] = await Promise.all([
      prisma.department.aggregate({
        _sum: { budgetAllocated: true },
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
    ]);

    const totalBudget = Number((departmentAgg._sum.budgetAllocated ?? 0).toString());
    const totalSpent = Number((txAgg.find((row) => row.type === "EXPENSE")?._sum.amount ?? 0).toString());
    const totalIncome = Number((txAgg.find((row) => row.type === "INCOME")?._sum.amount ?? 0).toString());

    return ok(
      {
        totalBudget,
        totalSpent,
        remainingBalance: totalBudget - totalSpent,
        totalIncome,
        transactionCount,
        pendingCount,
        currency: "VND" as const,
        appliedFilters: {
          role: auth.role,
          createdById: auth.role === "EMPLOYEE" ? auth.userId : null,
          incomeStatusExcluded: [...EXCLUDED_FROM_GLOBAL_METRICS],
          expenseStatusIncluded: ["EXECUTED"],
          transactionCountIncludesAllStatuses: true,
          scope: "GLOBAL_KPI",
          ruleDescription: globalMetricsScopeDescription(),
        },
      },
      { currency: "VND", scope: "GLOBAL_KPI" },
    );
  } catch (error) {
    return handleApiError(request, error);
  }
}
