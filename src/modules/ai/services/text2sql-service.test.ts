import { describe, expect, it } from "vitest";

import { AppError } from "@/modules/shared/errors/app-error";

import { applyRoleScope, ensureSafeSelect, normalizeSql } from "./text2sql-service";

describe("text2sql guardrails", () => {
  it("allows safe select and injects default limit", () => {
    const sql = ensureSafeSelect("SELECT * FROM Transaction");
    expect(sql).toMatch(/LIMIT 100$/i);
  });

  it("blocks destructive keywords", () => {
    expect(() => ensureSafeSelect("DELETE FROM Transaction")).toThrow(AppError);
  });

  it("blocks multiple statements", () => {
    expect(() => ensureSafeSelect("SELECT * FROM Transaction; SELECT * FROM Budget")).toThrow(AppError);
  });

  it("blocks non-allowlisted tables", () => {
    expect(() => ensureSafeSelect("SELECT * FROM User LIMIT 10")).toThrow(AppError);
  });

  it("normalizes markdown sql response", () => {
    expect(normalizeSql("```sql\nSELECT * FROM Transaction LIMIT 5\n```"))
      .toBe("SELECT * FROM Transaction LIMIT 5");
  });

  it("rejects UNSAFE response", () => {
    expect(() => normalizeSql("UNSAFE")).toThrow(AppError);
  });

  it("blocks employee from Text2SQL", () => {
    expect(() =>
      applyRoleScope("SELECT * FROM Transaction LIMIT 10", {
        userId: "u1",
        role: "EMPLOYEE",
        email: "e@x.com",
      }),
    ).toThrow(AppError);
  });

  it("blocks auditor from Text2SQL", () => {
    expect(() =>
      applyRoleScope("SELECT * FROM Transaction LIMIT 10", {
        userId: "u-auditor",
        role: "AUDITOR",
        email: "auditor@x.com",
      }),
    ).toThrow(AppError);
  });

  it("allows manager role pass-through", () => {
    const sql = applyRoleScope("SELECT * FROM Transaction LIMIT 10", {
      userId: "u2",
      role: "MANAGER",
      email: "m@x.com",
    });

    expect(sql).toBe("SELECT * FROM Transaction LIMIT 10");
  });

  it("allows accountant role pass-through", () => {
    const sql = applyRoleScope("SELECT * FROM Transaction LIMIT 10", {
      userId: "u3",
      role: "ACCOUNTANT",
      email: "a@x.com",
    });

    expect(sql).toBe("SELECT * FROM Transaction LIMIT 10");
  });

  it("allows case-insensitive allowlist table match", () => {
    const sql = ensureSafeSelect("select * from budget limit 5");
    expect(sql).toBe("select * from budget limit 5");
  });
});
