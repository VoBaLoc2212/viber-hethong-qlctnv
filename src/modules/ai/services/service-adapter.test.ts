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
          reserved: 5000000,
          period: "2026-03",
          departmentId: "d1",
        },
        {
          id: "b2",
          amount: 50000000,
          used: 10000000,
          reserved: 2500000,
          period: "2026-04",
          departmentId: "d2",
        },
      ],
    });
    prismaDepartmentFindManyMock.mockResolvedValue([
      { id: "d1", name: "Marketing", code: "MKT", budgetAllocated: 100000000 },
      { id: "d2", name: "IT", code: "IT", budgetAllocated: 50000000 },
    ]);
    prismaTransactionFindManyMock.mockResolvedValue([{ amount: 32000000 }]);
  });

  it("resolves unaccented Vietnamese budget query via SERVICE", async () => {
    const result = await resolveByService(auth, "QUERY", "ngan sach marketing");

    expect(result?.routeUsed).toBe("SERVICE");
    expect(result?.rawAnswer).toContain("Tổng ngân sách");
    expect(result?.rawAnswer).toContain("đã giữ chỗ");
    expect(result?.rawAnswer).toContain("còn khả dụng");
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

  it("returns count-first answer for quantity budget question", async () => {
    const result = await resolveByService(auth, "QUERY", "Có bao nhiêu ngân sách phòng ban?");

    expect(result?.routeUsed).toBe("SERVICE");
    expect(result?.rawAnswer).toContain("Có 2 ngân sách phù hợp");
    expect(result?.rawAnswer).not.toContain("Tổng ngân sách");
    expect(result?.relatedData?.budgetCount).toBe(2);
    expect(result?.relatedData?.departmentCount).toBe(2);
  });

  it("keeps amount summary for explicit remaining amount question", async () => {
    const result = await resolveByService(auth, "QUERY", "Ngân sách còn bao nhiêu tiền?");

    expect(result?.routeUsed).toBe("SERVICE");
    expect(result?.rawAnswer).toContain("Tổng ngân sách");
    expect(result?.rawAnswer).toContain("đã dùng");
    expect(result?.rawAnswer).toContain("đã giữ chỗ");
    expect(result?.rawAnswer).toContain("còn khả dụng");
  });

  it("keeps generic non-service query unresolved", async () => {
    const result = await resolveByService(auth, "QUERY", "ban la ai");

    expect(result).toBeNull();
    expect(listBudgetsMock).not.toHaveBeenCalled();
  });
});
