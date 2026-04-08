import { beforeEach, describe, expect, it, vi } from "vitest";

import { getReportsOverview } from "./report-service";

const {
  departmentAggregateMock,
  departmentFindFirstMock,
  transactionGroupByMock,
  transactionCountMock,
  transactionFindManyMock,
  splitGroupByMock,
  budgetFindManyMock,
  recurringFindManyMock,
  requireRoleMock,
} = vi.hoisted(() => ({
  departmentAggregateMock: vi.fn(),
  departmentFindFirstMock: vi.fn(),
  transactionGroupByMock: vi.fn(),
  transactionCountMock: vi.fn(),
  transactionFindManyMock: vi.fn(),
  splitGroupByMock: vi.fn(),
  budgetFindManyMock: vi.fn(),
  recurringFindManyMock: vi.fn(),
  requireRoleMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma/client", () => ({
  prisma: {
    department: {
      aggregate: departmentAggregateMock,
      findFirst: departmentFindFirstMock,
    },
    transaction: {
      groupBy: transactionGroupByMock,
      count: transactionCountMock,
      findMany: transactionFindManyMock,
    },
    transactionSplit: {
      groupBy: splitGroupByMock,
    },
    budget: {
      findMany: budgetFindManyMock,
    },
    recurringTransaction: {
      findMany: recurringFindManyMock,
    },
  },
}));

vi.mock("@/modules/shared", () => ({
  requireRole: requireRoleMock,
}));

describe("report-service scope consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    departmentAggregateMock.mockResolvedValue({ _sum: { budgetAllocated: 1000 } });
    departmentFindFirstMock.mockResolvedValue(null);
    transactionGroupByMock.mockResolvedValue([
      { type: "INCOME", _sum: { amount: 800 } },
      { type: "EXPENSE", _sum: { amount: 300 } },
    ]);
    transactionCountMock.mockResolvedValueOnce(2).mockResolvedValueOnce(9);
    transactionFindManyMock.mockResolvedValue([]);
    splitGroupByMock.mockResolvedValue([]);
    budgetFindManyMock.mockResolvedValue([]);
    recurringFindManyMock.mockResolvedValue([]);
  });

  it("returns transaction count including all statuses while financial totals exclude rejected/reversed", async () => {
    const result = await getReportsOverview(
      { userId: "u1", role: "MANAGER", email: "m@example.com" },
      {},
    );

    expect(requireRoleMock).toHaveBeenCalled();
    expect(result.kpis.transactionCount).toBe(9);
    expect(result.kpis.totalIncome).toBe(800);
    expect(result.kpis.totalSpent).toBe(300);
    expect(result.appliedFilters.transactionCountIncludesAllStatuses).toBe(true);
    expect(result.appliedFilters.statusExcludedForFinancialAmounts).toEqual(["REJECTED", "REVERSED"]);
  });

  it("applies department filter when departmentId is a valid UUID", async () => {
    const departmentId = "123e4567-e89b-12d3-a456-426614174000";

    const result = await getReportsOverview(
      { userId: "u1", role: "MANAGER", email: "m@example.com" },
      { departmentId },
    );

    expect(transactionGroupByMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          departmentId,
        }),
      }),
    );
    expect(result.appliedFilters.departmentFilterMode).toBe("DEPARTMENT_APPLIED");
    expect(result.appliedFilters.departmentId).toBe(departmentId);
  });

  it("applies department filter when input is department code", async () => {
    departmentFindFirstMock.mockResolvedValueOnce({ id: "dep-mkt-id" });

    const result = await getReportsOverview(
      { userId: "u1", role: "MANAGER", email: "m@example.com" },
      { departmentId: "MKT" },
    );

    expect(departmentFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          code: {
            equals: "MKT",
            mode: "insensitive",
          },
        },
      }),
    );
    expect(transactionGroupByMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          departmentId: "dep-mkt-id",
        }),
      }),
    );
    expect(result.appliedFilters.departmentFilterMode).toBe("DEPARTMENT_APPLIED");
    expect(result.appliedFilters.departmentId).toBe("dep-mkt-id");
  });

  it("ignores department filter when input is neither UUID nor existing code", async () => {
    departmentFindFirstMock.mockResolvedValueOnce(null);

    const result = await getReportsOverview(
      { userId: "u1", role: "MANAGER", email: "m@example.com" },
      { departmentId: "UNKNOWN" },
    );

    expect(transactionGroupByMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          departmentId: undefined,
        }),
      }),
    );
    expect(result.appliedFilters.departmentFilterMode).toBe("GUID_IGNORED");
    expect(result.appliedFilters.departmentId).toBeNull();
  });
});
