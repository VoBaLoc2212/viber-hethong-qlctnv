import type { NextRequest } from "next/server";

import { createChatSession, listChatSessions } from "@/modules/ai";
import { created, handleApiError, ok, readJsonBody, requireAuth, requireRole } from "@/modules/shared";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

    const sessions = await listChatSessions(auth.userId);
    return ok({ sessions }, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

    const body = await readJsonBody<{ titleHint?: string }>(request);
    const session = await createChatSession(auth.userId, body.titleHint);

    return created({ session }, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
