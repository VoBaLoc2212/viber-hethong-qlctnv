import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db/prisma/client";
import { handleApiError, ok, requireAuth, requireRole } from "@/modules/shared";
import { calculateAvailable } from "@/modules/shared/finance/decimal";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

    const [departments, budgets] = await Promise.all([
      prisma.department.findMany({
        orderBy: [{ code: "asc" }],
        select: {
          id: true,
          code: true,
          name: true,
        },
      }),
      prisma.budget.findMany({
        orderBy: [{ period: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          departmentId: true,
          period: true,
          amount: true,
          reserved: true,
          used: true,
          department: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      }),
    ]);

    return ok(
      {
        departments,
        budgets: budgets.map((budget) => ({
          id: budget.id,
          departmentId: budget.departmentId,
          departmentCode: budget.department.code,
          departmentName: budget.department.name,
          period: budget.period,
          amount: budget.amount.toFixed(2),
          available: calculateAvailable(budget.amount.toFixed(2), budget.reserved.toFixed(2), budget.used.toFixed(2)),
        })),
      },
      {},
    );
  } catch (error) {
    return handleApiError(request, error);
  }
}
