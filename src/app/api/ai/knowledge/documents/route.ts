import type { NextRequest } from "next/server";

import { ingestKnowledgeDocument, listKnowledgeDocumentsForAdmin } from "@/modules/ai";
import { created, handleApiError, ok, requireAuth, requireRole } from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";
import { getCorrelationId } from "@/modules/shared/http/request";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["FINANCE_ADMIN"]);
    const documents = await listKnowledgeDocumentsForAdmin(auth);
    return ok({ documents }, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["FINANCE_ADMIN"]);

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return handleApiError(request, new Error("INVALID_CONTENT_TYPE"));
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new AppError("file là bắt buộc", "INVALID_INPUT");
    }

    const document = await ingestKnowledgeDocument(auth, file, correlationId);
    return created({ document }, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
