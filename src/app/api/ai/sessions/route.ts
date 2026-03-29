import type { NextRequest } from "next/server";

import { archiveChatSession, createChatSession, listChatMessages, listChatSessions } from "@/modules/ai";
import { AppError, created, handleApiError, ok, readJsonBody, requireAuth, requireRole } from "@/modules/shared";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();

    if (id) {
      const messages = await listChatMessages(auth.userId, id);
      return ok({ messages }, {});
    }

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

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();

    if (!id) {
      throw new AppError("session id is required", "INVALID_INPUT");
    }

    const result = await archiveChatSession(auth.userId, id);
    return ok(result, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
