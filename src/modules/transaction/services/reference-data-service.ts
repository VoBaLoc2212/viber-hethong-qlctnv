import { prisma } from "@/lib/db/prisma/client";
import { type AuthContext, calculateAvailable, requireRole } from "@/modules/shared";

export async function listTransactionReferenceData(auth: AuthContext) {
  requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

  const [departments, budgets] = await Promise.all([
    prisma.department.findMany({
      orderBy: [{ name: "asc" }],
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
      take: 500,
    }),
  ]);

  return {
    departments: departments.map((department) => ({
      id: department.id,
      code: department.code,
      name: department.name,
    })),
    budgets: budgets.map((budget) => {
      const amount = budget.amount.toFixed(2);
      const reserved = budget.reserved.toFixed(2);
      const used = budget.used.toFixed(2);
      const available = calculateAvailable(amount, reserved, used);

      return {
        id: budget.id,
        departmentId: budget.departmentId,
        departmentCode: budget.department.code,
        departmentName: budget.department.name,
        period: budget.period,
        amount,
        available,
      };
    }),
  };
}
