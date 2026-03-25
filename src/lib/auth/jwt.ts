import type { UserRole } from "@/modules/shared/contracts/domain";

export type JwtPayload = {
  sub: string;
  role: UserRole;
  iat?: number;
  exp?: number;
};

export function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }

  return secret;
}

export function requireJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN ?? "7d";
}
