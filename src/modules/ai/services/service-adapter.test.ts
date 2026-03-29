import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthContext } from "@/modules/shared";

import { resolveByService } from "./service-adapter";

const {
  listBudgetsMock,
  prismaDepartmentFindManyMock,
  prismaTransactionFindManyMock,
} = vi.hoisted(() => ({
  listBudgetsMock: vi.fn(),
  prismaDepartmentFindManyMock: vi.fn(),
  prismaTransactionFindManyMock: vi.fn(),
}));

vi.mock("@/modules/budgeting", () => ({
  listBudgets: listBudgetsMock,
}));

vi.mock("@/lib/db/prisma/client", () => ({
  prisma: {
    department: {
      findMany: prismaDepartmentFindManyMock,
    },
    transaction: {
      findMany: prismaTransactionFindManyMock,
    },
  },
}));

vi.mock("@/modules/report", () => ({
  getReportsOverview: vi.fn(),
}));

vi.mock("@/modules/transaction", () => ({
  listTransactions: vi.fn(),
}));

vi.mock("@/modules/approval", () => ({
  listApprovals: vi.fn(),
}));

vi.mock("@/modules/security", () => ({
  listLogs: vi.fn(),
}));

const auth: AuthContext = {
  userId: "u1",
  role: "MANAGER",
  email: "manager@example.com",
};

describe("service-adapter budget routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    listBudgetsMock.mockResolvedValue({
      data: [
        {
          id: "b1",
          amount: 100000000,
          used: 32000000,
          reserved: 0,
          period: "2026-03",
          departmentId: "d1",
        },
      ],
    });
    prismaDepartmentFindManyMock.mockResolvedValue([
      { id: "d1", name: "Marketing", code: "MKT", budgetAllocated: 100000000 },
    ]);
    prismaTransactionFindManyMock.mockResolvedValue([{ amount: 32000000 }]);
  });

  it("resolves unaccented Vietnamese budget query via SERVICE", async () => {
    const result = await resolveByService(auth, "QUERY", "ngan sach marketing");

    expect(result?.routeUsed).toBe("SERVICE");
    expect(result?.rawAnswer).toContain("Tổng ngân sách");
    expect(listBudgetsMock).toHaveBeenCalledTimes(1);
  });

  it("resolves typo variant budget query via SERVICE", async () => {
    const result = await resolveByService(auth, "QUERY", "nga sach marketing");

    expect(result?.routeUsed).toBe("SERVICE");
    expect(result?.rawAnswer).toContain("Tổng ngân sách");
  });

  it("resolves English budget query via SERVICE", async () => {
    const result = await resolveByService(auth, "QUERY", "marketing budget");

    expect(result?.routeUsed).toBe("SERVICE");
    expect(result?.rawAnswer).toContain("Tổng ngân sách");
  });

  it("keeps generic non-service query unresolved", async () => {
    const result = await resolveByService(auth, "QUERY", "ban la ai");

    expect(result).toBeNull();
    expect(listBudgetsMock).not.toHaveBeenCalled();
  });
});
