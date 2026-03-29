import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/modules/shared/errors/app-error";

import { changeTransactionStatus } from "./transaction-service";

const {
  prismaTransactionMock,
  transactionFindUniqueMock,
  budgetFindUniqueMock,
  approvalFindUniqueMock,
  approvalFindFirstMock,
  approvalUpdateMock,
  budgetUpdateMock,
  transactionUpdateMock,
  auditLogCreateMock,
} = vi.hoisted(() => ({
  prismaTransactionMock: vi.fn(),
  transactionFindUniqueMock: vi.fn(),
  budgetFindUniqueMock: vi.fn(),
  approvalFindUniqueMock: vi.fn(),
  approvalFindFirstMock: vi.fn(),
  approvalUpdateMock: vi.fn(),
  budgetUpdateMock: vi.fn(),
  transactionUpdateMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma/client", () => ({
  prisma: {
    $transaction: prismaTransactionMock,
    transaction: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/modules/fx", () => ({
  convertUsdToVndByDate: vi.fn(),
}));

vi.mock("@/modules/shared", () => ({
  requireRole: vi.fn(),
  writeAuditLog: vi.fn(),
  addMoney: (left: string, right: string) => (Number(left) + Number(right)).toFixed(2),
  compareMoney: (left: string, right: string) => {
    const delta = Number(left) - Number(right);
    if (delta > 0) return 1;
    if (delta < 0) return -1;
    return 0;
  },
  calculateAvailable: (amount: string, reserved: string, used: string) =>
    (Number(amount) - Number(reserved) - Number(used)).toFixed(2),
}));

describe("transaction-service reject invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const db = {
      transaction: {
        findUnique: transactionFindUniqueMock,
        update: transactionUpdateMock,
      },
      budget: {
        findUnique: budgetFindUniqueMock,
        update: budgetUpdateMock,
      },
      approval: {
        findUnique: approvalFindUniqueMock,
        findFirst: approvalFindFirstMock,
        update: approvalUpdateMock,
      },
      auditLog: {
        create: auditLogCreateMock,
      },
    };

    prismaTransactionMock.mockImplementation(async (runner: (dbArg: typeof db) => unknown) => runner(db));

    budgetFindUniqueMock.mockResolvedValue({
      id: "b-1",
      amount: { toFixed: () => "1000.00" },
      reserved: { toFixed: () => "300.00" },
      used: { toFixed: () => "100.00" },
    });

    transactionUpdateMock.mockResolvedValue({
      id: "tx-1",
      code: "TXN-1",
      type: "EXPENSE",
      status: "REJECTED",
      amount: { toFixed: () => "200.00" },
      currency: "VND",
      date: new Date("2026-03-30T00:00:00.000Z"),
      description: null,
      budgetId: "b-1",
      departmentId: "d-1",
      recurringSourceId: null,
      fxCurrency: null,
      fxAmount: null,
      fxRate: null,
      baseCurrency: null,
      baseAmount: null,
      fxRateProvider: null,
      fxRateFetchedAt: null,
      createdAt: new Date("2026-03-30T00:00:00.000Z"),
    });

    approvalUpdateMock.mockResolvedValue({});
    budgetUpdateMock.mockResolvedValue({});
    auditLogCreateMock.mockResolvedValue({});
  });

  it("rejects APPROVED transaction via APPROVED approval and releases reserved budget", async () => {
    transactionFindUniqueMock.mockResolvedValue({
      id: "tx-1",
      code: "TXN-1",
      type: "EXPENSE",
      status: "APPROVED",
      amount: { toFixed: () => "200.00" },
      currency: "VND",
      budgetId: "b-1",
    });

    approvalFindUniqueMock.mockResolvedValue({
      id: "a-1",
      transactionId: "tx-1",
      status: "APPROVED",
    });

    await changeTransactionStatus(
      { userId: "u-acc", role: "ACCOUNTANT", email: "acc@example.com" },
      "tx-1",
      {
        action: "reject",
        approvalId: "a-1",
        reason: "not executed",
      },
      "corr-1",
    );

    expect(approvalUpdateMock).toHaveBeenCalledWith({
      where: { id: "a-1" },
      data: expect.objectContaining({
        status: "REJECTED",
        approverId: "u-acc",
      }),
    });

    expect(budgetUpdateMock).toHaveBeenCalledWith({
      where: { id: "b-1" },
      data: { reserved: "100.00" },
    });

    expect(transactionUpdateMock).toHaveBeenCalledWith({
      where: { id: "tx-1" },
      data: { status: "REJECTED" },
    });
  });

  it("throws conflict when approval status does not match reject expectation", async () => {
    transactionFindUniqueMock.mockResolvedValue({
      id: "tx-1",
      code: "TXN-1",
      type: "EXPENSE",
      status: "APPROVED",
      amount: { toFixed: () => "200.00" },
      currency: "VND",
      budgetId: "b-1",
    });

    approvalFindUniqueMock.mockResolvedValue({
      id: "a-1",
      transactionId: "tx-1",
      status: "PENDING",
    });

    await expect(
      changeTransactionStatus(
        { userId: "u-acc", role: "ACCOUNTANT", email: "acc@example.com" },
        "tx-1",
        {
          action: "reject",
          approvalId: "a-1",
        },
        "corr-1",
      ),
    ).rejects.toMatchObject({
      message: "Approval status is invalid for reject action",
      code: "CONFLICT",
    });

    expect(transactionUpdateMock).not.toHaveBeenCalled();
    expect(budgetUpdateMock).not.toHaveBeenCalled();
  });
});
