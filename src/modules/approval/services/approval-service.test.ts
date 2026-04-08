import { beforeEach, describe, expect, it, vi } from "vitest";

import { approvalAction, syncExpenseToApprovals } from "./approval-service";

const {
  transactionFindManyMock,
  approvalCreateManyMock,
  prismaTransactionMock,
  approvalFindUniqueMock,
  approvalUpdateMock,
  transactionUpdateMock,
} = vi.hoisted(() => ({
  transactionFindManyMock: vi.fn(),
  approvalCreateManyMock: vi.fn(),
  prismaTransactionMock: vi.fn(),
  approvalFindUniqueMock: vi.fn(),
  approvalUpdateMock: vi.fn(),
  transactionUpdateMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma/client", () => ({
  prisma: {
    transaction: {
      findMany: transactionFindManyMock,
    },
    approval: {
      createMany: approvalCreateManyMock,
    },
    $transaction: prismaTransactionMock,
  },
}));

vi.mock("@/modules/shared", () => ({
  requireRole: vi.fn(),
  assertNotAuditorForMutation: vi.fn(),
}));

describe("approval-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("syncExpenseToApprovals creates pending approvals with null approverId", async () => {
    transactionFindManyMock.mockResolvedValue([
      { id: "t1", status: "PENDING" },
      { id: "t2", status: "APPROVED" },
    ]);
    approvalCreateManyMock.mockResolvedValue({ count: 2 });

    const result = await syncExpenseToApprovals();

    expect(result).toEqual({ synced: 2 });
    expect(approvalCreateManyMock).toHaveBeenCalledWith({
      data: [
        { id: "APR-t1", transactionId: "t1", approverId: null, status: "PENDING" },
        { id: "APR-t2", transactionId: "t2", approverId: null, status: "APPROVED" },
      ],
      skipDuplicates: true,
    });
  });

  it("approvalAction approve sets approverId to actor", async () => {
    const db = {
      approval: {
        findUnique: approvalFindUniqueMock,
        update: approvalUpdateMock,
      },
      transaction: {
        update: transactionUpdateMock,
      },
    };

    prismaTransactionMock.mockImplementation(async (runner: (dbArg: typeof db) => unknown) => runner(db));

    approvalFindUniqueMock
      .mockResolvedValueOnce({
        id: "a1",
        transactionId: "t1",
        status: "PENDING",
        transaction: { id: "t1" },
      })
      .mockResolvedValueOnce({
        id: "a1",
        transaction: { id: "t1", code: "TXN-1", status: "APPROVED", amount: { toFixed: () => "100.00" } },
        approver: { id: "u-manager", fullName: "Manager", role: "MANAGER" },
      });

    approvalUpdateMock.mockResolvedValue({});
    transactionUpdateMock.mockResolvedValue({});

    await approvalAction(
      { userId: "u-manager", role: "MANAGER", email: "m@example.com" },
      "a1",
      "approve",
      "ok",
    );

    expect(approvalUpdateMock).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: expect.objectContaining({
        status: "APPROVED",
        approverId: "u-manager",
      }),
    });
  });

  it("approvalAction reject sets approverId to actor", async () => {
    const db = {
      approval: {
        findUnique: approvalFindUniqueMock,
        update: approvalUpdateMock,
      },
      transaction: {
        update: transactionUpdateMock,
      },
    };

    prismaTransactionMock.mockImplementation(async (runner: (dbArg: typeof db) => unknown) => runner(db));

    approvalFindUniqueMock
      .mockResolvedValueOnce({
        id: "a2",
        transactionId: "t2",
        status: "PENDING",
        transaction: { id: "t2" },
      })
      .mockResolvedValueOnce({
        id: "a2",
        transaction: { id: "t2", code: "TXN-2", status: "REJECTED", amount: { toFixed: () => "200.00" } },
        approver: { id: "u-manager", fullName: "Manager", role: "MANAGER" },
      });

    approvalUpdateMock.mockResolvedValue({});
    transactionUpdateMock.mockResolvedValue({});

    await approvalAction(
      { userId: "u-manager", role: "MANAGER", email: "m@example.com" },
      "a2",
      "reject",
      "no",
    );

    expect(approvalUpdateMock).toHaveBeenCalledWith({
      where: { id: "a2" },
      data: expect.objectContaining({
        status: "REJECTED",
        approverId: "u-manager",
      }),
    });
  });
});
