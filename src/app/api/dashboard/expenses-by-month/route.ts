import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";
import { handleApiError, requireAuth, requireRole } from "@/modules/shared";
import { ok } from "@/modules/shared/http/response";

function formatMonthKey(date: Date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function formatLabel(date: Date) {
  return date.toLocaleString("vi-VN", { month: "short", year: "numeric" });
}

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

    const transactions = await prisma.transaction.findMany({
      where: txWhere,
      select: {
        type: true,
        amount: true,
        date: true,
      },
      orderBy: {
        date: "asc",
      },
    });

    const byMonth = new Map<string, { month: string; income: number; expenses: number }>();
    for (const tx of transactions) {
      const d = new Date(tx.date);
      const key = formatMonthKey(d);
      if (!byMonth.has(key)) {
        byMonth.set(key, { month: formatLabel(d), income: 0, expenses: 0 });
      }
      const row = byMonth.get(key);
      if (!row) continue;
      if (tx.type === "INCOME") row.income += Number(tx.amount.toFixed(2));
      if (tx.type === "EXPENSE") row.expenses += Number(tx.amount.toFixed(2));
    }

    const sorted = Array.from(byMonth.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([, v]) => v);

    return ok({ rows: sorted.slice(-6), currency: "VND" as const }, { currency: "VND" });
  } catch (error) {
    return handleApiError(request, error);
  }
}
