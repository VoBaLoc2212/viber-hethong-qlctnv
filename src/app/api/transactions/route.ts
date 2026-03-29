import type { NextRequest } from "next/server";
import type { TransactionStatus, TransactionType } from "@prisma/client";

import { createTransaction, listTransactions } from "@/modules/transaction";
import { created, handleApiError, ok, readJsonBody, requireAuth, requireRole } from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";
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

function normalizeCurrency(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length ? normalized : null;
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
      q: searchParams.get("q") ?? undefined,
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

    const fxCurrency = normalizeCurrency(body.fxCurrency);

    if (fxCurrency === "USD") {
      if (body.type !== "EXPENSE") {
        throw new AppError("USD is currently supported for EXPENSE only", "UNPROCESSABLE_ENTITY");
      }

      if (body.fxAmount == null) {
        throw new AppError("fxAmount is required when fxCurrency is USD", "INVALID_INPUT");
      }

      if (!body.date) {
        throw new AppError("date is required when fxCurrency is USD", "INVALID_INPUT");
      }
    }

    const isUsdExpense = fxCurrency === "USD" && body.type === "EXPENSE";

    const transaction = await createTransaction(
      auth,
      {
        type: body.type,
        amount: isUsdExpense ? undefined : normalizeAmount(body.amount),
        budgetId: body.budgetId ?? null,
        departmentId: body.departmentId ?? null,
        date: body.date,
        description: body.description ?? null,
        status: body.status,
        recurringSourceId: body.recurringSourceId ?? null,
        fxCurrency,
        fxAmount: normalizeAmount(body.fxAmount ?? undefined) ?? null,
        fxRate:
          isUsdExpense
            ? null
            : typeof body.fxRate === "number"
              ? body.fxRate.toFixed(6)
              : typeof body.fxRate === "string"
                ? body.fxRate.trim()
                : null,
        baseCurrency: isUsdExpense ? null : normalizeCurrency(body.baseCurrency),
        baseAmount: isUsdExpense ? null : (normalizeAmount(body.baseAmount ?? undefined) ?? null),
        fxRateProvider: isUsdExpense ? null : (body.fxRateProvider ?? null),
        fxRateFetchedAt: isUsdExpense ? null : (body.fxRateFetchedAt ?? null),
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
