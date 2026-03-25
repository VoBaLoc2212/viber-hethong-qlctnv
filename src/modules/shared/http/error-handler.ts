import type { NextRequest } from "next/server";

import { AppError } from "@/modules/shared/errors/app-error";

import { getCorrelationId } from "./request";
import { error } from "./response";

const CODE_TO_STATUS: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INVALID_INPUT: 400,
};

export function handleApiError(request: NextRequest, unknownError: unknown) {
  const correlationId = getCorrelationId(request);

  if (unknownError instanceof AppError) {
    const status = CODE_TO_STATUS[unknownError.code] ?? 400;
    return error(status, {
      code: unknownError.code,
      message: unknownError.message,
      details: unknownError.details,
      correlationId,
    });
  }

  if (unknownError instanceof Error && unknownError.message === "INVALID_CONTENT_TYPE") {
    return error(400, {
      code: "INVALID_CONTENT_TYPE",
      message: "Content-Type must be application/json",
      correlationId,
    });
  }

  return error(500, {
    code: "INTERNAL_SERVER_ERROR",
    message:
      process.env.NODE_ENV === "production"
        ? "Unexpected server error"
        : unknownError instanceof Error
          ? unknownError.message
          : "Unexpected server error",
    correlationId,
  });
}
