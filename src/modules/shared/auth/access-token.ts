import jwt, { type SignOptions } from "jsonwebtoken";

import type { UserRole } from "@/modules/shared/contracts/domain";

import { AppError } from "@/modules/shared/errors/app-error";

export type AccessTokenPayload = {
  sub: string;
  role: UserRole;
};

export function signAccessToken(payload: AccessTokenPayload, secret: string, expiresIn: string): string {
  const signOptions: SignOptions = {
    expiresIn: expiresIn as SignOptions["expiresIn"],
  };

  return jwt.sign(payload, secret, signOptions);
}

export function verifyAccessToken(token: string, secret: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, secret);
    if (!decoded || typeof decoded !== "object") {
      throw new AppError("Invalid token", "UNAUTHORIZED");
    }

    const sub = decoded.sub;
    const role = decoded.role;

    if (typeof sub !== "string" || typeof role !== "string") {
      throw new AppError("Invalid token payload", "UNAUTHORIZED");
    }

    return {
      sub,
      role: role as UserRole,
    };
  } catch {
    throw new AppError("Unauthorized", "UNAUTHORIZED");
  }
}
