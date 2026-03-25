import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { AppError } from "@/modules/shared/errors/app-error";

export type InternalServiceContext = {
  serviceId: string;
};

const INTERNAL_SERVICE_HEADER_ID = "x-internal-service-id";
const INTERNAL_SERVICE_HEADER_TS = "x-internal-timestamp";
const INTERNAL_SERVICE_HEADER_NONCE = "x-internal-nonce";
const INTERNAL_SERVICE_HEADER_SIG = "x-internal-signature";

const ALLOWED_TIME_SKEW_SECONDS = 60;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getSecret(): string {
  const secret = process.env.INTERNAL_LOG_SECRET;
  if (!secret) {
    throw new AppError("Internal log secret is not configured", "INTERNAL_SERVER_ERROR", undefined, 500);
  }

  return secret;
}

function parseTimestamp(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new AppError("Invalid internal timestamp", "INVALID_INPUT", undefined, 400);
  }

  return parsed;
}

function verifySkew(timestampSeconds: number) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > ALLOWED_TIME_SKEW_SECONDS) {
    throw new AppError("Internal signature expired", "UNAUTHORIZED", undefined, 401);
  }
}

function normalizeSignature(sig: string) {
  if (sig.startsWith("sha256=")) {
    return sig.slice("sha256=".length);
  }

  return sig;
}

function verifySignature(expectedHex: string, providedRaw: string) {
  const providedHex = normalizeSignature(providedRaw);

  const expectedBuffer = Buffer.from(expectedHex, "hex");
  const providedBuffer = Buffer.from(providedHex, "hex");

  if (expectedBuffer.length !== providedBuffer.length) {
    throw new AppError("Invalid internal signature", "UNAUTHORIZED", undefined, 401);
  }

  if (!timingSafeEqual(expectedBuffer, providedBuffer)) {
    throw new AppError("Invalid internal signature", "UNAUTHORIZED", undefined, 401);
  }
}

function buildSignatureInput(
  method: string,
  pathname: string,
  timestamp: string,
  nonce: string,
  bodyHash: string,
  serviceId: string,
) {
  return [method.toUpperCase(), pathname, timestamp, nonce, bodyHash, serviceId].join("\n");
}

export async function requireInternalServiceAuth(
  request: NextRequest,
  rawBody: string,
): Promise<InternalServiceContext> {
  const serviceId = request.headers.get(INTERNAL_SERVICE_HEADER_ID) ?? "";
  const timestamp = request.headers.get(INTERNAL_SERVICE_HEADER_TS) ?? "";
  const nonce = request.headers.get(INTERNAL_SERVICE_HEADER_NONCE) ?? "";
  const signature = request.headers.get(INTERNAL_SERVICE_HEADER_SIG) ?? "";

  if (!serviceId || !timestamp || !nonce || !signature) {
    throw new AppError("Missing internal auth headers", "UNAUTHORIZED", undefined, 401);
  }

  const timestampSeconds = parseTimestamp(timestamp);
  verifySkew(timestampSeconds);

  const bodyHash = sha256Hex(rawBody);

  const pathname = new URL(request.url).pathname;
  const payloadToSign = buildSignatureInput(request.method, pathname, timestamp, nonce, bodyHash, serviceId);
  const expected = createHmac("sha256", getSecret()).update(payloadToSign).digest("hex");

  verifySignature(expected, signature);

  return {
    serviceId,
  };
}
