import type { NextRequest } from "next/server";
import type { RecurringFrequency, TransactionType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";
import { created, handleApiError, ok, readJsonBody, requireAuth, requireRole } from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";

function toTemplateView(row: {
  id: string;
  name: string;
  type: TransactionType;
  amount: { toFixed: (scale: number) => string };
  frequency: RecurringFrequency;
  nextRunAt: Date;
  lastRunAt: Date | null;
  active: boolean;
  budgetId: string | null;
  departmentId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    amount: row.amount.toFixed(2),
    frequency: row.frequency,
    nextRunAt: row.nextRunAt.toISOString(),
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    active: row.active,
    budgetId: row.budgetId,
    departmentId: row.departmentId,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? "1");
    const limit = Number(searchParams.get("limit") ?? "20");
    const activeParam = searchParams.get("active");

    const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
    const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;

    const where = activeParam === null ? {} : { active: activeParam === "true" };

    const rows = await prisma.recurringTransaction.findMany({
      where,
      orderBy: [{ nextRunAt: "asc" }, { createdAt: "desc" }],
      skip: (normalizedPage - 1) * normalizedLimit,
      take: normalizedLimit,
    });

    return ok({ templates: rows.map((row) => toTemplateView(row)) }, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["ACCOUNTANT", "FINANCE_ADMIN"]);

    const body = await readJsonBody<{
      name?: string;
      type?: TransactionType;
      amount?: string;
      frequency?: RecurringFrequency;
      nextRunAt?: string;
      budgetId?: string | null;
      departmentId?: string | null;
      active?: boolean;
    }>(request);

    const name = body.name?.trim();
    if (!name) throw new AppError("name is required", "INVALID_INPUT");

    if (!body.type || !["INCOME", "EXPENSE"].includes(body.type)) {
      throw new AppError("type is invalid", "INVALID_INPUT");
    }

    const amount = body.amount?.trim();
    if (!amount) throw new AppError("amount is required", "INVALID_INPUT");

    if (!body.frequency || !["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "ANNUALLY"].includes(body.frequency)) {
      throw new AppError("frequency is invalid", "INVALID_INPUT");
    }

    const nextRunAt = body.nextRunAt ? new Date(body.nextRunAt) : null;
    if (!nextRunAt || Number.isNaN(nextRunAt.getTime())) {
      throw new AppError("nextRunAt is invalid", "INVALID_INPUT");
    }

    if (body.type === "EXPENSE") {
      if (!body.budgetId) throw new AppError("budgetId is required for EXPENSE", "INVALID_INPUT");
      if (!body.departmentId) throw new AppError("departmentId is required for EXPENSE", "INVALID_INPUT");
    }

    const createdRow = await prisma.recurringTransaction.create({
      data: {
        name,
        type: body.type,
        amount,
        frequency: body.frequency,
        nextRunAt,
        active: body.active ?? true,
        budgetId: body.budgetId ?? null,
        departmentId: body.departmentId ?? null,
        createdById: auth.userId,
      },
    });

    return created(toTemplateView(createdRow), {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
