import type { NextRequest } from "next/server";

import { approvalAction } from "@/modules/approval";
import { handleApiError, ok, readJsonBody, requireAuth, requireRole } from "@/modules/shared";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/approvals/[id] — Manager: approve/reject, Accountant: execute/not-execute
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["MANAGER", "ACCOUNTANT"]);

    const { id } = await params;
    const body = await readJsonBody<{
      action: "approve" | "reject" | "execute" | "not-execute";
      note?: string;
    }>(request);

    if (!body.action) {
      return new Response(JSON.stringify({ error: "action is required" }), { status: 400 });
    }

    const result = await approvalAction(auth, id, body.action, body.note);
    return ok(result, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
