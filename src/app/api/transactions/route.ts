import type { NextRequest } from "next/server";
import type { TransactionStatus, TransactionType } from "@prisma/client";

import { createTransaction, listTransactions } from "@/modules/transaction";
import { created, handleApiError, ok, readJsonBody, requireAuth, requireRole } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

function normalizeAmount(amount: string | number | undefined): string | undefined {
  if (typeof amount === "number") {
    if (!Number.isFinite(amount)) return undefined;
    return amount.toFixed(2);
  }

  if (typeof amount === "string") {
    return amount.trim();
  }

  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

    const { searchParams } = new URL(request.url);

    const result = await listTransactions(auth, {
      page: Number(searchParams.get("page") ?? 1),
      limit: Number(searchParams.get("limit") ?? 20),
      type: (searchParams.get("type") as TransactionType | null) ?? undefined,
      status: (searchParams.get("status") as TransactionStatus | null) ?? undefined,
      departmentId: searchParams.get("departmentId") ?? undefined,
      budgetId: searchParams.get("budgetId") ?? undefined,
    });

    return ok({ data: result.data, total: result.meta.total, page: result.meta.page, limit: result.meta.limit }, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN"]);

    const body = await readJsonBody<{
      type?: TransactionType;
      amount?: string | number;
      budgetId?: string | null;
      departmentId?: string | null;
      date?: string;
      description?: string | null;
      status?: TransactionStatus;
    }>(request);

    const transaction = await createTransaction(
      auth,
      {
        type: body.type,
        amount: normalizeAmount(body.amount),
        budgetId: body.budgetId ?? null,
        departmentId: body.departmentId ?? null,
        date: body.date,
        description: body.description ?? null,
        status: body.status,
      },
      correlationId,
    );

    return created(transaction, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
