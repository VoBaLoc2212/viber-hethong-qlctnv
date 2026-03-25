import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db/prisma/client";
import { handleApiError, requireAuth, requireRole } from "@/modules/shared";
import { ok } from "@/modules/shared/http/response";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

    const [departmentAgg, txAgg, pendingCount, transactionCount] = await Promise.all([
      prisma.department.aggregate({
        _sum: { budgetAllocated: true },
      }),
      prisma.transaction.groupBy({
        by: ["type"],
        where: {
          status: {
            notIn: ["REJECTED", "REVERSED"],
          },
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.transaction.count({
        where: { status: "PENDING" },
      }),
      prisma.transaction.count(),
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
      },
      {},
    );
  } catch (error) {
    return handleApiError(request, error);
  }
}
