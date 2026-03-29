import type { NextRequest } from "next/server";

import { handleAiChat } from "@/modules/ai";
import { handleApiError, ok, readJsonBody, requireAuth, requireRole } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

    const body = await readJsonBody<{
      sessionId?: string;
      message?: string;
      clientMessageId?: string;
    }>(request);

    const message = body.message?.trim();
    if (!message) {
      return ok(
        {
          sessionId: body.sessionId ?? "",
          answer: "Vui lòng nhập câu hỏi.",
          intent: "GUIDANCE",
          routeUsed: "RAG",
          citations: [],
          suggestedActions: [],
        },
        {},
      );
    }

    const result = await handleAiChat({
      auth,
      correlationId,
      request: {
        sessionId: body.sessionId,
        message,
        clientMessageId: body.clientMessageId,
      },
    });

    return ok(result, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
