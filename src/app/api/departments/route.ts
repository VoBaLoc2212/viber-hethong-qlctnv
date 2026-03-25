import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db/prisma/client";
import { AppError } from "@/modules/shared/errors/app-error";
import { handleApiError, readJsonBody, requireAuth, requireRole } from "@/modules/shared";
import { created, ok } from "@/modules/shared/http/response";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        budgetAllocated: true,
      },
    });

    return ok(
      {
        departments: departments.map((department) => ({
          id: department.id,
          name: department.name,
          code: department.code,
          budgetAllocated: Number(department.budgetAllocated.toFixed(2)),
        })),
      },
      {},
    );
  } catch (error) {
    return handleApiError(request, error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["FINANCE_ADMIN"]);

    const body = await readJsonBody<{ name?: string; code?: string; budgetAllocated?: number | string }>(request);

    if (!body.name || !body.code || Number(body.budgetAllocated ?? 0) <= 0) {
      throw new AppError("name, code và budgetAllocated hợp lệ là bắt buộc", "INVALID_INPUT");
    }

    const createdDepartment = await prisma.department.create({
      data: {
        name: String(body.name ?? "").trim(),
        code: String(body.code ?? "").toUpperCase().trim(),
        budgetAllocated: Number(body.budgetAllocated ?? 0).toFixed(2),
      },
      select: {
        id: true,
        name: true,
        code: true,
        budgetAllocated: true,
      },
    });

    return created(
      {
        id: createdDepartment.id,
        name: createdDepartment.name,
        code: createdDepartment.code,
        budgetAllocated: Number(createdDepartment.budgetAllocated.toFixed(2)),
      },
      {},
    );
  } catch (error) {
    return handleApiError(request, error);
  }
}
