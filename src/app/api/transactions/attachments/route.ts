import type { NextRequest } from "next/server";

import { extractInvoiceFromAttachment } from "@/modules/ai";
import { created, handleApiError, requireAuth, requireRole } from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN"]);

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      throw new AppError("Invalid content type. multipart/form-data is required", "INVALID_INPUT");
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new AppError("file is required", "INVALID_INPUT");
    }

    const safeName = file.name.trim() || `attachment-${Date.now()}`;
    const fileUrl = `local-upload://${encodeURIComponent(safeName)}`;

    const extraction = await extractInvoiceFromAttachment(file);

    return created(
      {
        fileName: safeName,
        fileUrl,
        fileSize: file.size,
        mimeType: file.type || null,
        extraction,
      },
      {},
    );
  } catch (error) {
    return handleApiError(request, error);
  }
}
