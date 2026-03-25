import type { Prisma, TransactionStatus, TransactionType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";
import {
  addMoney,
  calculateAvailable,
  compareMoney,
  type AuthContext,
  requireRole,
  writeAuditLog,
} from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";

function decimalToString(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

function ensureExpenseStatus(status: TransactionStatus) {
  if (status !== "PENDING") {
    throw new AppError("New expense request must start at PENDING status", "INVALID_INPUT");
  }
}

function ensureIncomeStatus(status: TransactionStatus) {
  const allowed: TransactionStatus[] = ["APPROVED", "EXECUTED"];
  if (!allowed.includes(status)) {
    throw new AppError("Income status must be APPROVED or EXECUTED", "INVALID_INPUT");
  }
}

type ApprovalStatusCompat = "PENDING" | "APPROVED" | "REJECTED";

function effectiveApprovalStatus(status: string, statusV2: ApprovalStatusCompat | null): ApprovalStatusCompat {
  return statusV2 ?? (status as ApprovalStatusCompat);
}

async function getPolicyForBudgetTx(tx: Prisma.TransactionClient, budgetId: string) {
  const scoped = await tx.budgetControlPolicy.findUnique({ where: { budgetId } });
  if (scoped) return scoped;

  const globalPolicy = await tx.budgetControlPolicy.findFirst({
    where: { budgetId: null },
    orderBy: { createdAt: "asc" },
  });

  return globalPolicy ?? { hardStopEnabled: true, warningThresholdPct: 80 };
}

async function createCashbookPostingForExecution(
  tx: Prisma.TransactionClient,
  transactionId: string,
  amount: string,
  direction: "IN" | "OUT",
) {
  const account = await tx.cashbookAccount.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, balance: true },
  });

  if (!account) {
    throw new AppError("No cashbook account available for execution", "CONFLICT");
  }

  const nextBalance = direction === "IN" ? addMoney(decimalToString(account.balance), amount) : addMoney(decimalToString(account.balance), `-${amount}`);

  await tx.cashbookAccount.update({
    where: { id: account.id },
    data: { balance: nextBalance },
  });

  const posting = await tx.cashbookPosting.create({
    data: {
      accountId: account.id,
      transactionId,
      direction,
      amount,
    },
  });

  return {
    postingId: posting.id,
    accountId: account.id,
  };
}

function toTransactionView(row: {
  id: string;
  code: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: Prisma.Decimal;
  currency: string;
  date: Date;
  description: string | null;
  budgetId: string | null;
  departmentId: string | null;
  recurringSourceId: string | null;
  fxCurrency: string | null;
  fxAmount: Prisma.Decimal | null;
  fxRate: Prisma.Decimal | null;
  baseCurrency: string | null;
  baseAmount: Prisma.Decimal | null;
  fxRateProvider: string | null;
  fxRateFetchedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    transactionCode: row.code,
    type: row.type,
    status: row.status,
    amount: decimalToString(row.amount),
    currency: row.currency,
    date: row.date.toISOString(),
    description: row.description,
    budgetId: row.budgetId,
    departmentId: row.departmentId,
    recurringSourceId: row.recurringSourceId,
    fxCurrency: row.fxCurrency,
    fxAmount: row.fxAmount ? decimalToString(row.fxAmount) : null,
    fxRate: row.fxRate ? row.fxRate.toFixed(6) : null,
    baseCurrency: row.baseCurrency,
    baseAmount: row.baseAmount ? decimalToString(row.baseAmount) : null,
    fxRateProvider: row.fxRateProvider,
    fxRateFetchedAt: row.fxRateFetchedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

type ListTransactionsFilter = {
  page: number;
  limit: number;
  type?: TransactionType;
  status?: TransactionStatus;
  departmentId?: string;
  budgetId?: string;
};

export async function listTransactions(auth: AuthContext, filter: ListTransactionsFilter) {
  requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

  const page = Number.isFinite(filter.page) && filter.page > 0 ? filter.page : 1;
  const limit = Number.isFinite(filter.limit) && filter.limit > 0 ? Math.min(filter.limit, 100) : 20;
  const skip = (page - 1) * limit;

  const where: Prisma.TransactionWhereInput = {
    type: filter.type,
    status: filter.status,
    departmentId: filter.departmentId,
    budgetId: filter.budgetId,
  };

  const [total, rows] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
  ]);

  return {
    data: rows.map(toTransactionView),
    meta: { total, page, limit },
  };
}

type TransactionSplitPayload = {
  amount: string;
  categoryCode?: string | null;
  note?: string | null;
};

type TransactionAttachmentPayload = {
  fileName: string;
  fileUrl: string;
  fileSize?: number | null;
  mimeType?: string | null;
};

type CreateTransactionPayload = {
  type?: TransactionType;
  amount?: string;
  budgetId?: string | null;
  departmentId?: string | null;
  date?: string;
  description?: string | null;
  status?: TransactionStatus;
  recurringSourceId?: string | null;
  fxCurrency?: string | null;
  fxAmount?: string | null;
  fxRate?: string | null;
  baseCurrency?: string | null;
  baseAmount?: string | null;
  fxRateProvider?: string | null;
  fxRateFetchedAt?: string | null;
  splits?: TransactionSplitPayload[];
  attachments?: TransactionAttachmentPayload[];
};

export async function createTransaction(auth: AuthContext, payload: CreateTransactionPayload, correlationId: string) {
  requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN"]);

  if (!payload.type) {
    throw new AppError("type is required", "INVALID_INPUT");
  }

  if (!payload.amount || compareMoney(payload.amount, "0.00") <= 0) {
    throw new AppError("amount must be greater than 0", "INVALID_INPUT");
  }

  const txType = payload.type;
  const txAmount = payload.amount;

  const status = payload.status ?? (txType === "EXPENSE" ? "PENDING" : "APPROVED");

  if (txType === "EXPENSE") {
    ensureExpenseStatus(status);
  } else {
    ensureIncomeStatus(status);
  }

  const code = `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const txDate = payload.date ? new Date(payload.date) : new Date();
  if (Number.isNaN(txDate.getTime())) {
    throw new AppError("date is invalid", "INVALID_INPUT");
  }

  const fxRateFetchedAt = payload.fxRateFetchedAt ? new Date(payload.fxRateFetchedAt) : null;
  if (payload.fxRateFetchedAt && (!fxRateFetchedAt || Number.isNaN(fxRateFetchedAt.getTime()))) {
    throw new AppError("fxRateFetchedAt is invalid", "INVALID_INPUT");
  }

  if (payload.splits && payload.splits.length > 0) {
    const splitTotal = payload.splits.reduce((acc, split) => addMoney(acc, split.amount), "0.00");
    if (compareMoney(splitTotal, txAmount) !== 0) {
      throw new AppError("Sum of splits must equal transaction amount", "INVALID_INPUT");
    }
  }

  const created = await prisma.$transaction(async (db) => {
    if (txType === "EXPENSE") {
      if (!payload.budgetId) {
        throw new AppError("budgetId is required for EXPENSE transaction", "INVALID_INPUT");
      }

      const budget = await db.budget.findUnique({ where: { id: payload.budgetId } });
      if (!budget) {
        throw new AppError("Budget not found", "NOT_FOUND");
      }

      const amount = decimalToString(budget.amount);
      const reserved = decimalToString(budget.reserved);
      const used = decimalToString(budget.used);
      const available = calculateAvailable(amount, reserved, used);

      if (compareMoney(available, "0.00") <= 0) {
        const policy = await getPolicyForBudgetTx(db, budget.id);
        if (policy.hardStopEnabled) {
          throw new AppError("Hard stop is enabled and budget is exhausted", "UNPROCESSABLE_ENTITY");
        }
      }

      if (compareMoney(available, txAmount) < 0) {
        throw new AppError("Insufficient available budget", "UNPROCESSABLE_ENTITY");
      }

      const policy = await getPolicyForBudgetTx(db, budget.id);
      const nextReserved = addMoney(reserved, txAmount);
      const usagePercent =
        Number(amount) > 0 ? Number((((Number(used) + Number(nextReserved)) / Number(amount)) * 100).toFixed(2)) : 0;
      const warningTriggered = usagePercent >= policy.warningThresholdPct;

      const transaction = await db.transaction.create({
        data: {
          code,
          type: txType,
          status,
          amount: txAmount,
          currency: "VND",
          date: txDate,
          description: payload.description ?? null,
          recurringSourceId: payload.recurringSourceId ?? null,
          fxCurrency: payload.fxCurrency ?? null,
          fxAmount: payload.fxAmount ?? null,
          fxRate: payload.fxRate ?? null,
          baseCurrency: payload.baseCurrency ?? null,
          baseAmount: payload.baseAmount ?? null,
          fxRateProvider: payload.fxRateProvider ?? null,
          fxRateFetchedAt,
          budgetId: budget.id,
          departmentId: payload.departmentId ?? budget.departmentId,
          createdById: auth.userId,
        },
      });

      await db.budget.update({
        where: { id: budget.id },
        data: { reserved: nextReserved },
      });

      if (payload.splits && payload.splits.length > 0) {
        await db.transactionSplit.createMany({
          data: payload.splits.map((split) => ({
            transactionId: transaction.id,
            amount: split.amount,
            categoryCode: split.categoryCode ?? null,
            note: split.note ?? null,
          })),
        });
      }

      if (payload.attachments && payload.attachments.length > 0) {
        await db.transactionAttachment.createMany({
          data: payload.attachments.map((attachment) => ({
            transactionId: transaction.id,
            fileName: attachment.fileName,
            fileUrl: attachment.fileUrl,
            fileSize: attachment.fileSize ?? null,
            mimeType: attachment.mimeType ?? null,
            uploadedById: auth.userId,
          })),
        });
      }

      await db.auditLog.create({
        data: {
          actorId: auth.userId,
          action: "TRANSACTION_CREATE",
          entityType: "TRANSACTION",
          entityId: transaction.id,
          correlationId,
          payload: {
            type: transaction.type,
            status: transaction.status,
            amount: txAmount,
            budgetId: budget.id,
            warningTriggered,
            warningThresholdPct: policy.warningThresholdPct,
            hardStopEnabled: policy.hardStopEnabled,
          },
        },
      });

      if (warningTriggered) {
        await db.auditLog.create({
          data: {
            actorId: auth.userId,
            action: "BUDGET_WARNING",
            entityType: "BUDGET",
            entityId: budget.id,
            correlationId,
            payload: {
              budgetId: budget.id,
              transactionId: transaction.id,
              usagePercent,
              warningThresholdPct: policy.warningThresholdPct,
              availableAfterReserve: calculateAvailable(amount, nextReserved, used),
            },
          },
        });
      }

      return { transaction, warningTriggered, warningThresholdPct: policy.warningThresholdPct, usagePercent };
    }

    const transaction = await db.transaction.create({
      data: {
        code,
        type: txType,
        status,
        amount: txAmount,
        currency: "VND",
        date: txDate,
        description: payload.description ?? null,
        recurringSourceId: payload.recurringSourceId ?? null,
        fxCurrency: payload.fxCurrency ?? null,
        fxAmount: payload.fxAmount ?? null,
        fxRate: payload.fxRate ?? null,
        baseCurrency: payload.baseCurrency ?? null,
        baseAmount: payload.baseAmount ?? null,
        fxRateProvider: payload.fxRateProvider ?? null,
        fxRateFetchedAt,
        budgetId: payload.budgetId ?? null,
        departmentId: payload.departmentId ?? null,
        createdById: auth.userId,
      },
    });

    if (payload.splits && payload.splits.length > 0) {
      await db.transactionSplit.createMany({
        data: payload.splits.map((split) => ({
          transactionId: transaction.id,
          amount: split.amount,
          categoryCode: split.categoryCode ?? null,
          note: split.note ?? null,
        })),
      });
    }

    if (payload.attachments && payload.attachments.length > 0) {
      await db.transactionAttachment.createMany({
        data: payload.attachments.map((attachment) => ({
          transactionId: transaction.id,
          fileName: attachment.fileName,
          fileUrl: attachment.fileUrl,
          fileSize: attachment.fileSize ?? null,
          mimeType: attachment.mimeType ?? null,
          uploadedById: auth.userId,
        })),
      });
    }

    await db.auditLog.create({
      data: {
        actorId: auth.userId,
        action: "TRANSACTION_CREATE",
        entityType: "TRANSACTION",
        entityId: transaction.id,
        correlationId,
        payload: {
          type: transaction.type,
          status: transaction.status,
          amount: txAmount,
          budgetId: transaction.budgetId,
        },
      },
    });

    if (status === "EXECUTED") {
      const entry = await db.ledgerEntry.create({
        data: {
          entryCode: `LED-INCOME-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          type: "INCOME",
          amount: txAmount,
          currency: "VND",
          referenceType: "TRANSACTION",
          referenceId: transaction.id,
          createdById: auth.userId,
          metadata: {
            transactionCode: transaction.code,
          },
        },
      });

      const posting = await createCashbookPostingForExecution(db, transaction.id, txAmount, "IN");

      await writeAuditLog({
        actorId: auth.userId,
        action: "TRANSACTION_EXECUTE",
        entityType: "TRANSACTION",
        entityId: transaction.id,
        correlationId,
        payload: {
          ledgerEntryId: entry.id,
          cashbookPostingId: posting.postingId,
          cashbookAccountId: posting.accountId,
        },
      });
    }

    return { transaction, warningTriggered: false, warningThresholdPct: null, usagePercent: null };
  });

  return {
    ...toTransactionView(created.transaction),
    warning: created.warningTriggered,
    warningThresholdPct: created.warningThresholdPct,
    usagePercent: created.usagePercent,
  };
}

export async function getTransactionById(auth: AuthContext, id: string) {
  requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

  const row = await prisma.transaction.findUnique({ where: { id } });
  if (!row) {
    throw new AppError("Transaction not found", "NOT_FOUND");
  }

  return toTransactionView(row);
}

type StatusAction = "manager_approve" | "accountant_approve" | "reject" | "execute";

type ChangeStatusPayload = {
  action?: StatusAction;
  note?: string;
  reason?: string;
  approvalId?: string;
};

export async function changeTransactionStatus(
  auth: AuthContext,
  id: string,
  payload: ChangeStatusPayload,
  correlationId: string,
) {
  if (!payload.action) {
    throw new AppError("action is required", "INVALID_INPUT");
  }

  return prisma.$transaction(async (db) => {
    const tx = await db.transaction.findUnique({ where: { id } });
    if (!tx) {
      throw new AppError("Transaction not found", "NOT_FOUND");
    }

    if (tx.status === "EXECUTED" || tx.status === "REVERSED") {
      throw new AppError("Closed transaction is immutable", "CONFLICT");
    }

    if (tx.type !== "EXPENSE") {
      throw new AppError("Only EXPENSE transactions are in approval flow", "UNPROCESSABLE_ENTITY");
    }

    if (!tx.budgetId) {
      throw new AppError("Missing budget reference", "CONFLICT");
    }

    const budget = await db.budget.findUnique({ where: { id: tx.budgetId } });
    if (!budget) {
      throw new AppError("Budget not found", "NOT_FOUND");
    }

    const amount = decimalToString(budget.amount);
    const reserved = decimalToString(budget.reserved);
    const used = decimalToString(budget.used);

    let nextStatus: TransactionStatus;

    switch (payload.action) {
      case "manager_approve": {
        requireRole(auth, ["MANAGER", "FINANCE_ADMIN"]);
        if (tx.status !== "PENDING") {
          throw new AppError("Only PENDING transaction can be manager-approved", "UNPROCESSABLE_ENTITY");
        }

        const currentApproval = payload.approvalId
          ? await db.approval.findUnique({
              where: { id: payload.approvalId },
              select: { id: true, transactionId: true, step: true, status: true, statusV2: true },
            })
          : await db.approval.findFirst({
              where: {
                transactionId: tx.id,
                step: 1,
                OR: [{ status: "PENDING" }, { statusV2: "PENDING" }],
              },
              orderBy: { createdAt: "desc" },
              select: { id: true, transactionId: true, step: true, status: true, statusV2: true },
            });

        if (!currentApproval || currentApproval.transactionId !== tx.id) {
          throw new AppError("Approval not found", "NOT_FOUND");
        }
        if (currentApproval.step !== 1) {
          throw new AppError("Invalid approval step for manager action", "UNPROCESSABLE_ENTITY");
        }
        if (effectiveApprovalStatus(currentApproval.status, currentApproval.statusV2) !== "PENDING") {
          throw new AppError("Approval is already finalized", "CONFLICT");
        }

        nextStatus = "APPROVED";

        await db.approval.update({
          where: { id: currentApproval.id },
          data: {
            approverId: auth.userId,
            status: "APPROVED",
            statusV2: "APPROVED",
            note: payload.note ?? null,
            approvedAt: new Date(),
            rejectedAt: null,
          },
        });

        const accountant = await db.user.findFirst({
          where: { role: "ACCOUNTANT", isActive: true },
          select: { id: true },
        });
        if (!accountant) {
          throw new AppError("No active ACCOUNTANT found for approval step 2", "CONFLICT");
        }

        const existingStep2 = await db.approval.findFirst({
          where: { transactionId: tx.id, step: 2 },
          select: { id: true },
        });
        if (existingStep2) {
          throw new AppError("Step 2 approval already exists", "CONFLICT");
        }

        await db.approval.create({
          data: {
            transactionId: tx.id,
            approverId: accountant.id,
            step: 2,
            status: "PENDING",
            statusV2: "PENDING",
          },
        });

        break;
      }
      case "accountant_approve": {
        requireRole(auth, ["ACCOUNTANT", "FINANCE_ADMIN"]);
        if (tx.status !== "APPROVED") {
          throw new AppError("Only manager-approved transaction can be accountant-approved", "UNPROCESSABLE_ENTITY");
        }

        const managerApproval = await db.approval.findFirst({
          where: {
            transactionId: tx.id,
            step: 1,
            OR: [{ status: "APPROVED" }, { statusV2: "APPROVED" }],
          },
          select: { id: true },
        });
        if (!managerApproval) {
          throw new AppError("Step 1 approval is required", "UNPROCESSABLE_ENTITY");
        }

        const currentApproval = payload.approvalId
          ? await db.approval.findUnique({
              where: { id: payload.approvalId },
              select: { id: true, transactionId: true, step: true, status: true, statusV2: true },
            })
          : await db.approval.findFirst({
              where: {
                transactionId: tx.id,
                step: 2,
                OR: [{ status: "PENDING" }, { statusV2: "PENDING" }],
              },
              orderBy: { createdAt: "desc" },
              select: { id: true, transactionId: true, step: true, status: true, statusV2: true },
            });
        if (!currentApproval || currentApproval.transactionId !== tx.id) {
          throw new AppError("Approval not found", "NOT_FOUND");
        }
        if (currentApproval.step !== 2) {
          throw new AppError("Invalid approval step for accountant action", "UNPROCESSABLE_ENTITY");
        }
        if (effectiveApprovalStatus(currentApproval.status, currentApproval.statusV2) !== "PENDING") {
          throw new AppError("Approval is already finalized", "CONFLICT");
        }

        nextStatus = "APPROVED";

        await db.approval.update({
          where: { id: currentApproval.id },
          data: {
            approverId: auth.userId,
            status: "APPROVED",
            statusV2: "APPROVED",
            note: payload.note ?? null,
            approvedAt: new Date(),
            rejectedAt: null,
          },
        });

        break;
      }
      case "reject": {
        requireRole(auth, ["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN"]);
        if (tx.status !== "PENDING" && tx.status !== "APPROVED") {
          throw new AppError("Only PENDING/APPROVED transaction can be rejected", "UNPROCESSABLE_ENTITY");
        }

        const currentApproval = payload.approvalId
          ? await db.approval.findUnique({
              where: { id: payload.approvalId },
              select: { id: true, transactionId: true, step: true, status: true, statusV2: true },
            })
          : await db.approval.findFirst({
              where: {
                transactionId: tx.id,
                step: tx.status === "PENDING" ? 1 : 2,
                OR: [{ status: "PENDING" }, { statusV2: "PENDING" }],
              },
              orderBy: { createdAt: "desc" },
              select: { id: true, transactionId: true, step: true, status: true, statusV2: true },
            });
        if (!currentApproval || currentApproval.transactionId !== tx.id) {
          throw new AppError("Approval not found", "NOT_FOUND");
        }
        if (effectiveApprovalStatus(currentApproval.status, currentApproval.statusV2) !== "PENDING") {
          throw new AppError("Approval is already finalized", "CONFLICT");
        }

        if (tx.status === "PENDING" && currentApproval.step !== 1) {
          throw new AppError("Invalid approval step for reject action", "UNPROCESSABLE_ENTITY");
        }
        if (tx.status === "APPROVED" && currentApproval.step !== 2) {
          throw new AppError("Invalid approval step for reject action", "UNPROCESSABLE_ENTITY");
        }

        nextStatus = "REJECTED";

        await db.approval.update({
          where: { id: currentApproval.id },
          data: {
            approverId: auth.userId,
            status: "REJECTED",
            statusV2: "REJECTED",
            note: payload.reason ?? payload.note ?? null,
            approvedAt: null,
            rejectedAt: new Date(),
          },
        });

        const nextReserved = addMoney(reserved, `-${decimalToString(tx.amount)}`);
        await db.budget.update({
          where: { id: budget.id },
          data: { reserved: nextReserved },
        });
        break;
      }
      case "execute": {
        requireRole(auth, ["ACCOUNTANT", "FINANCE_ADMIN"]);
        if (tx.status !== "APPROVED") {
          throw new AppError("Only APPROVED transaction can be executed", "UNPROCESSABLE_ENTITY");
        }

        const approvedSteps = await db.approval.findMany({
          where: { transactionId: tx.id, status: "APPROVED" },
          select: { step: true },
        });

        const stepSet = new Set(approvedSteps.map((item) => item.step));
        if (!stepSet.has(1) || !stepSet.has(2)) {
          throw new AppError("Two-step approval is required before execute", "UNPROCESSABLE_ENTITY");
        }

        const available = calculateAvailable(amount, reserved, used);
        if (compareMoney(available, decimalToString(tx.amount)) < 0) {
          throw new AppError("Insufficient available budget at execute", "UNPROCESSABLE_ENTITY");
        }

        const nextReserved = addMoney(reserved, `-${decimalToString(tx.amount)}`);
        const nextUsed = addMoney(used, decimalToString(tx.amount));

        await db.budget.update({
          where: { id: budget.id },
          data: {
            reserved: nextReserved,
            used: nextUsed,
          },
        });

        const ledger = await db.ledgerEntry.create({
          data: {
            entryCode: `LED-EXPENSE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            type: "EXPENSE",
            amount: decimalToString(tx.amount),
            currency: tx.currency,
            referenceType: "TRANSACTION",
            referenceId: tx.id,
            createdById: auth.userId,
            metadata: {
              transactionCode: tx.code,
              budgetId: budget.id,
            },
          },
        });

        const posting = await createCashbookPostingForExecution(db, tx.id, decimalToString(tx.amount), "OUT");

        await db.auditLog.create({
          data: {
            actorId: auth.userId,
            action: "TRANSACTION_EXECUTE",
            entityType: "TRANSACTION",
            entityId: tx.id,
            correlationId,
            payload: {
              ledgerEntryId: ledger.id,
              cashbookPostingId: posting.postingId,
              cashbookAccountId: posting.accountId,
            },
          },
        });

        nextStatus = "EXECUTED";
        break;
      }
      default:
        throw new AppError("Unsupported action", "INVALID_INPUT");
    }

    const updated = await db.transaction.update({
      where: { id: tx.id },
      data: { status: nextStatus },
    });

    await db.auditLog.create({
      data: {
        actorId: auth.userId,
        action: "TRANSACTION_STATUS_CHANGE",
        entityType: "TRANSACTION",
        entityId: tx.id,
        correlationId,
        payload: {
          fromStatus: tx.status,
          toStatus: updated.status,
          action: payload.action,
          reason: payload.reason ?? null,
          note: payload.note ?? null,
        },
      },
    });

    return toTransactionView(updated);
  });
}
