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

    return ok(
      { data: result.data, total: result.meta.total, page: result.meta.page, limit: result.meta.limit },
      {
        appliedFilters: {
          type: searchParams.get("type") ?? null,
          status: searchParams.get("status") ?? null,
          departmentId: searchParams.get("departmentId") ?? null,
          budgetId: searchParams.get("budgetId") ?? null,
          role: auth.role,
          createdById: auth.role === "EMPLOYEE" ? auth.userId : null,
          scope: "LIST_QUERY",
        },
      },
    );
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
      recurringSourceId?: string | null;
      fxCurrency?: string | null;
      fxAmount?: string | number | null;
      fxRate?: string | number | null;
      baseCurrency?: string | null;
      baseAmount?: string | number | null;
      fxRateProvider?: string | null;
      fxRateFetchedAt?: string | null;
      splits?: Array<{
        amount: string | number;
        categoryCode?: string | null;
        note?: string | null;
      }>;
      attachments?: Array<{
        fileName: string;
        fileUrl: string;
        fileSize?: number | null;
        mimeType?: string | null;
      }>;
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
        recurringSourceId: body.recurringSourceId ?? null,
        fxCurrency: body.fxCurrency ?? null,
        fxAmount: normalizeAmount(body.fxAmount ?? undefined) ?? null,
        fxRate:
          typeof body.fxRate === "number"
            ? body.fxRate.toFixed(6)
            : typeof body.fxRate === "string"
              ? body.fxRate.trim()
              : null,
        baseCurrency: body.baseCurrency ?? null,
        baseAmount: normalizeAmount(body.baseAmount ?? undefined) ?? null,
        fxRateProvider: body.fxRateProvider ?? null,
        fxRateFetchedAt: body.fxRateFetchedAt ?? null,
        splits: body.splits?.map((split) => ({
          amount: normalizeAmount(split.amount) ?? "0.00",
          categoryCode: split.categoryCode ?? null,
          note: split.note ?? null,
        })),
        attachments: body.attachments?.map((attachment) => ({
          fileName: attachment.fileName,
          fileUrl: attachment.fileUrl,
          fileSize: attachment.fileSize ?? null,
          mimeType: attachment.mimeType ?? null,
        })),
      },
      correlationId,
    );

    return created(transaction, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
