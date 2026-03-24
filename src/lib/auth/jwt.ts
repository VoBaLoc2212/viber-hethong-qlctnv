export type JwtPayload = {
  sub: string;
  role: "EMPLOYEE" | "MANAGER" | "ACCOUNTANT" | "FINANCE_ADMIN" | "AUDITOR";
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
