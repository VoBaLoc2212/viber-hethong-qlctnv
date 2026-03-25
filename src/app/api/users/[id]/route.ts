import type { NextRequest } from "next/server";

import { deleteUserById, getUserById, updateUserById } from "@/modules/security";
import { handleApiError, noContent, ok, readJsonBody, requireAuth } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireAuth(request);
    const { id } = await params;
    const user = await getUserById(auth, id);
    return ok(user, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    const { id } = await params;
    const body = await readJsonBody<{
      username?: string;
      email?: string;
      fullName?: string;
      password?: string;
      role?: "EMPLOYEE" | "MANAGER" | "ACCOUNTANT" | "FINANCE_ADMIN" | "AUDITOR";
      isActive?: boolean;
    }>(request);

    const user = await updateUserById(auth, id, body, correlationId);
    return ok(user, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    const { id } = await params;
    await deleteUserById(auth, id, correlationId);
    return noContent();
  } catch (error) {
    return handleApiError(request, error);
  }
}
