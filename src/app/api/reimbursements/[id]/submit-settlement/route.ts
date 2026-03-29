import type { NextRequest } from "next/server";

import { submitSettlement } from "@/modules/reimbursement";
import { handleApiError, ok, readJsonBody, requireAuth, requireRole } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["EMPLOYEE"]);

    const { id } = await params;
    const body = await readJsonBody<{
      actualAmount?: string | number;
      settlementNote?: string;
      attachments?: Array<{
        fileName: string;
        fileUrl: string;
        fileSize?: number | null;
        mimeType?: string | null;
      }>;
    }>(request);

    const reimbursement = await submitSettlement(
      auth,
      id,
      {
        actualAmount: typeof body.actualAmount === "number" ? body.actualAmount.toFixed(2) : body.actualAmount,
        settlementNote: body.settlementNote,
        attachments: body.attachments,
      },
      correlationId,
    );

    return ok(reimbursement as Record<string, unknown>, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
