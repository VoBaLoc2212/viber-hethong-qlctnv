import type { NextRequest } from "next/server";

import { archiveKnowledgeDocumentForAdmin } from "@/modules/ai";
import { handleApiError, ok, requireAuth } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    const { id } = await params;

    const result = await archiveKnowledgeDocumentForAdmin(auth, id, correlationId);
    return ok(result, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
