import type { NextRequest } from "next/server";

import { saveTransactionAttachment } from "@/lib/storage/transaction-attachment";
import { created, handleApiError, requireAuth, requireRole } from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN"]);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new AppError("file must be provided as multipart/form-data", "INVALID_INPUT");
    }

    const uploaded = await saveTransactionAttachment(file);
    return created(uploaded, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
