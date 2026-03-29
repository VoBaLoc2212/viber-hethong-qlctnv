import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RV_DEPARTMENT_NAME = "Runtime Validation Dept";
const RV_CODE_PREFIX = "RV";

function uniq(values: string[]) {
  return [...new Set(values)];
}

function getJsonStringField(value: unknown, field: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>)[field];
  return typeof candidate === "string" ? candidate : null;
}

async function main() {
  const rvDepartments = await prisma.department.findMany({
    where: {
      name: RV_DEPARTMENT_NAME,
      code: { startsWith: RV_CODE_PREFIX },
    },
    select: { id: true },
  });

  const departmentIds = rvDepartments.map((row) => row.id);

  const budgets = await prisma.budget.findMany({
    where: { departmentId: { in: departmentIds } },
    select: { id: true },
  });
  const budgetIds = budgets.map((row) => row.id);

  const recurringRows = await prisma.recurringTransaction.findMany({
    where: {
      OR: [
        { departmentId: { in: departmentIds } },
        { budgetId: { in: budgetIds } },
        { name: { startsWith: "rv recurring" } },
      ],
    },
    select: { id: true },
  });
  const recurringIds = recurringRows.map((row) => row.id);

  const reimbursements = await prisma.reimbursement.findMany({
    where: {
      purpose: { startsWith: "rv reimbursement" },
    },
    select: { id: true },
  });
  const reimbursementIds = reimbursements.map((row) => row.id);

  const reimbursementLedgerRows = await prisma.ledgerEntry.findMany({
    where: {
      referenceType: "REIMBURSEMENT",
      referenceId: { in: reimbursementIds },
    },
    select: { metadata: true },
  });

  const reimbursementTransactionIds = reimbursementLedgerRows
    .map((row) => getJsonStringField(row.metadata, "transactionId"))
    .filter((value): value is string => Boolean(value));

  const transactionRows = await prisma.transaction.findMany({
    where: {
      OR: [
        { departmentId: { in: departmentIds } },
        { budgetId: { in: budgetIds } },
        { recurringSourceId: { in: recurringIds } },
        { description: { startsWith: "rv-approval-" } },
        { description: { startsWith: "Recurring: rv recurring" } },
        { description: { startsWith: "Cashbook reconcile adjustment: runtime-validation" } },
        { code: { startsWith: "TXN-RB-" } },
      ],
    },
    select: { id: true },
  });

  const transactionIds = uniq([
    ...transactionRows.map((row) => row.id),
    ...reimbursementTransactionIds,
  ]);

  const cashbookReconcileLedgerRows = await prisma.ledgerEntry.findMany({
    where: { referenceType: "CASHBOOK_ACCOUNT" },
    select: { id: true, metadata: true },
  });
  const cashbookReconcileLedgerIds = cashbookReconcileLedgerRows
    .filter((row) => {
      const reason = getJsonStringField(row.metadata, "reason");
      return typeof reason === "string" && reason.startsWith("runtime-validation");
    })
    .map((row) => row.id);

  const ledgerIdsToDelete = uniq([
    ...cashbookReconcileLedgerIds,
    ...(await prisma.ledgerEntry.findMany({
      where: {
        OR: [
          { referenceType: "TRANSACTION", referenceId: { in: transactionIds } },
          { referenceType: "REIMBURSEMENT", referenceId: { in: reimbursementIds } },
        ],
      },
      select: { id: true },
    })).map((row) => row.id),
  ]);

  const result = {
    approvals: await prisma.approval.deleteMany({ where: { transactionId: { in: transactionIds } } }),
    cashbookPostings: await prisma.cashbookPosting.deleteMany({ where: { transactionId: { in: transactionIds } } }),
    transactionAttachments: await prisma.transactionAttachment.deleteMany({
      where: { transactionId: { in: transactionIds } },
    }),
    transactionSplits: await prisma.transactionSplit.deleteMany({ where: { transactionId: { in: transactionIds } } }),
    ledgerEntries: await prisma.ledgerEntry.deleteMany({ where: { id: { in: ledgerIdsToDelete } } }),
    transactions: await prisma.transaction.deleteMany({ where: { id: { in: transactionIds } } }),
    recurringTransactions: await prisma.recurringTransaction.deleteMany({ where: { id: { in: recurringIds } } }),
    budgetTransfersByBudget: await prisma.budgetTransfer.deleteMany({
      where: {
        OR: [
          { fromBudgetId: { in: budgetIds } },
          { toBudgetId: { in: budgetIds } },
        ],
      },
    }),
    budgetTransfersByKey: await prisma.budgetTransfer.deleteMany({
      where: { idempotencyKey: { startsWith: "rv-transfer-" } },
    }),
    budgets: await prisma.budget.deleteMany({ where: { id: { in: budgetIds } } }),
    reimbursements: await prisma.reimbursement.deleteMany({ where: { id: { in: reimbursementIds } } }),
    departments: await prisma.department.deleteMany({ where: { id: { in: departmentIds } } }),
  };

  console.log(
    JSON.stringify(
      {
        departmentIds: departmentIds.length,
        budgetIds: budgetIds.length,
        recurringIds: recurringIds.length,
        reimbursementIds: reimbursementIds.length,
        transactionIds: transactionIds.length,
        ledgerIdsToDelete: ledgerIdsToDelete.length,
        deleted: Object.fromEntries(Object.entries(result).map(([k, v]) => [k, v.count])),
        auditLogNote: "AuditLog is immutable by design; runtime cleanup skips audit rows.",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
