import { describe, expect, it } from "vitest";

import type { UserRole } from "@/modules/shared/contracts/domain";
import { AppError } from "@/modules/shared/errors/app-error";

import { assertNotAuditorForMutation, isRoleAllowed, requireRole, type AuthContext } from "./authorization";

function createAuth(role: UserRole): AuthContext {
  return {
    userId: "test-user-id",
    role,
    email: "test@example.com",
  };
}

describe("authorization guards", () => {
  it("allows non-auditor roles for mutation guard", () => {
    const roles: UserRole[] = ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN"];

    for (const role of roles) {
      expect(() => assertNotAuditorForMutation(createAuth(role))).not.toThrow();
    }
  });

  it("blocks auditor role for mutation guard", () => {
    expect(() => assertNotAuditorForMutation(createAuth("AUDITOR"))).toThrow(AppError);
    expect(() => assertNotAuditorForMutation(createAuth("AUDITOR"))).toThrow("Forbidden");
  });

  it("requireRole allows role in allowed list", () => {
    expect(() => requireRole(createAuth("ACCOUNTANT"), ["ACCOUNTANT", "FINANCE_ADMIN"]))
      .not.toThrow();
  });

  it("requireRole blocks role not in allowed list", () => {
    expect(() => requireRole(createAuth("EMPLOYEE"), ["ACCOUNTANT", "FINANCE_ADMIN"]))
      .toThrow(AppError);
  });

  it("isRoleAllowed returns expected booleans", () => {
    expect(isRoleAllowed("MANAGER", ["MANAGER", "FINANCE_ADMIN"])).toBe(true);
    expect(isRoleAllowed("AUDITOR", ["ACCOUNTANT", "FINANCE_ADMIN"])).toBe(false);
  });
});
