import type { UserRole } from "@/modules/shared/contracts/domain";

export type JwtPayload = {
  sub: string;
  role: UserRole;
  iat?: number;
  exp?: number;
};

export function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required");
  }

  return "dev-secret-key-change-in-production";
}

export function requireJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN ?? "7d";
}
