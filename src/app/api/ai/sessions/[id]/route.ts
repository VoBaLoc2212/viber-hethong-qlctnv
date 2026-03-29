import type { NextRequest } from "next/server";

import { archiveChatSession, listChatMessages } from "@/modules/ai";
import { handleApiError, ok, requireAuth, requireRole } from "@/modules/shared";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

    const { id } = await params;
    const messages = await listChatMessages(auth.userId, id);
    return ok({ messages }, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

    const { id } = await params;
    const result = await archiveChatSession(auth.userId, id);

    return ok(result, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
