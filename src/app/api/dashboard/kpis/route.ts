import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";
import { handleApiError, requireAuth, requireRole } from "@/modules/shared";
import { ok } from "@/modules/shared/http/response";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

    const txWhere: Prisma.TransactionWhereInput = {
      status: {
        notIn: ["REJECTED", "REVERSED"],
      },
      ...(auth.role === "EMPLOYEE" ? { createdById: auth.userId } : {}),
    };

    const [departmentAgg, txAgg, pendingCount, transactionCount] = await Promise.all([
      prisma.department.aggregate({
        _sum: { budgetAllocated: true },
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
      },
      { currency: "VND" },
    );
  } catch (error) {
    return handleApiError(request, error);
  }
}
