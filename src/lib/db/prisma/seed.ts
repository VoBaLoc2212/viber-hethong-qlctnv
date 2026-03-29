import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../../../modules/shared/auth/password";

const prisma = new PrismaClient();

async function upsertUser(input: {
  username: string;
  email: string;
  fullName: string;
  role: "EMPLOYEE" | "MANAGER" | "ACCOUNTANT" | "FINANCE_ADMIN" | "AUDITOR";
  password: string;
}) {
  return prisma.user.upsert({
    where: { username: input.username },
    update: {
      email: input.email,
      fullName: input.fullName,
      role: input.role,
      isActive: true,
    },
    create: {
      username: input.username,
      email: input.email,
      fullName: input.fullName,
      role: input.role,
      passwordHash: hashPassword(input.password),
      isActive: true,
    },
  });
}

async function main() {
  const financeAdmin = await upsertUser({
    username: "admin",
    email: "admin@company.local",
    fullName: "Finance Admin",
    role: "FINANCE_ADMIN",
    password: "admin123",
  });

  const manager = await upsertUser({
    username: "manager",
    email: "manager@company.local",
    fullName: "Department Manager",
    role: "MANAGER",
    password: "manager123",
  });

  const accountant = await upsertUser({
    username: "accountant",
    email: "accountant@company.local",
    fullName: "Company Accountant",
    role: "ACCOUNTANT",
    password: "accountant123",
  });

  await upsertUser({
    username: "employee",
    email: "employee@company.local",
    fullName: "Staff Employee",
    role: "EMPLOYEE",
    password: "employee123",
  });

  await upsertUser({
    username: "auditor",
    email: "auditor@company.local",
    fullName: "Internal Auditor",
    role: "AUDITOR",
    password: "auditor123",
  });

  const marketingDepartment = await prisma.department.upsert({
    where: { code: "MKT" },
    update: {
      name: "Marketing",
      budgetAllocated: "100000000.00",
    },
    create: {
      code: "MKT",
      name: "Marketing",
      budgetAllocated: "100000000.00",
    },
  });

  const itDepartment = await prisma.department.upsert({
    where: { code: "IT" },
    update: {
      name: "Information Technology",
      budgetAllocated: "50000000.00",
    },
    create: {
      code: "IT",
      name: "Information Technology",
      budgetAllocated: "50000000.00",
    },
  });

  const marketingBudget = await prisma.budget.upsert({
    where: {
      departmentId_period: {
        departmentId: marketingDepartment.id,
        period: "2026-03",
      },
    },
    update: {
      amount: "100000000.00",
      reserved: "10000000.00",
      used: "70000000.00",
      parentBudgetId: null,
    },
    create: {
      departmentId: marketingDepartment.id,
      period: "2026-03",
      amount: "100000000.00",
      reserved: "10000000.00",
      used: "70000000.00",
      parentBudgetId: null,
    },
  });

  const itBudget = await prisma.budget.upsert({
    where: {
      departmentId_period: {
        departmentId: itDepartment.id,
        period: "2026-03",
      },
    },
    update: {
      amount: "50000000.00",
      reserved: "2000000.00",
      used: "12000000.00",
      parentBudgetId: null,
    },
    create: {
      departmentId: itDepartment.id,
      period: "2026-03",
      amount: "50000000.00",
      reserved: "2000000.00",
      used: "12000000.00",
      parentBudgetId: null,
    },
  });

  const budgetSnapshots = [
    { departmentId: marketingDepartment.id, period: "2026-01", amount: "95000000.00", reserved: "7000000.00", used: "62000000.00" },
    { departmentId: marketingDepartment.id, period: "2026-02", amount: "98000000.00", reserved: "8000000.00", used: "68000000.00" },
    { departmentId: marketingDepartment.id, period: "2026-04", amount: "105000000.00", reserved: "9000000.00", used: "31000000.00" },
    { departmentId: itDepartment.id, period: "2026-01", amount: "47000000.00", reserved: "1500000.00", used: "10000000.00" },
    { departmentId: itDepartment.id, period: "2026-02", amount: "49000000.00", reserved: "1800000.00", used: "11500000.00" },
    { departmentId: itDepartment.id, period: "2026-04", amount: "52000000.00", reserved: "2200000.00", used: "14500000.00" },
  ];

  for (const snapshot of budgetSnapshots) {
    await prisma.budget.upsert({
      where: {
        departmentId_period: {
          departmentId: snapshot.departmentId,
          period: snapshot.period,
        },
      },
      update: {
        amount: snapshot.amount,
        reserved: snapshot.reserved,
        used: snapshot.used,
        parentBudgetId: null,
      },
      create: {
        departmentId: snapshot.departmentId,
        period: snapshot.period,
        amount: snapshot.amount,
        reserved: snapshot.reserved,
        used: snapshot.used,
        parentBudgetId: null,
      },
    });
  }

  const globalPolicy = await prisma.budgetControlPolicy.findFirst({
    where: { budgetId: null },
    orderBy: { createdAt: "asc" },
  });

  if (globalPolicy) {
    await prisma.budgetControlPolicy.update({
      where: { id: globalPolicy.id },
      data: {
        hardStopEnabled: true,
        warningThresholdPct: 80,
        updatedById: financeAdmin.id,
      },
    });
  } else {
    await prisma.budgetControlPolicy.create({
      data: {
        budgetId: null,
        hardStopEnabled: true,
        warningThresholdPct: 80,
        createdById: financeAdmin.id,
        updatedById: financeAdmin.id,
      },
    });
  }

  await prisma.budgetControlPolicy.upsert({
    where: { budgetId: marketingBudget.id },
    update: {
      hardStopEnabled: true,
      warningThresholdPct: 80,
      updatedById: financeAdmin.id,
    },
    create: {
      budgetId: marketingBudget.id,
      hardStopEnabled: true,
      warningThresholdPct: 80,
      createdById: financeAdmin.id,
      updatedById: financeAdmin.id,
    },
  });

  await prisma.budgetControlPolicy.upsert({
    where: { budgetId: itBudget.id },
    update: {
      hardStopEnabled: true,
      warningThresholdPct: 80,
      updatedById: financeAdmin.id,
    },
    create: {
      budgetId: itBudget.id,
      hardStopEnabled: true,
      warningThresholdPct: 80,
      createdById: financeAdmin.id,
      updatedById: financeAdmin.id,
    },
  });

  const existingCashbook = await prisma.cashbookAccount.findFirst({
    where: {
      name: "Main Cashbook",
      type: "OPERATING",
    },
    select: { id: true },
  });

  if (!existingCashbook) {
    await prisma.cashbookAccount.create({
      data: {
        name: "Main Cashbook",
        type: "OPERATING",
        balance: "1000000000.00",
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: manager.id,
      action: "SEED_INIT",
      entityType: "SYSTEM",
      entityId: "seed",
      result: "SUCCESS",
      payload: {
        note: "Seed data initialized",
      },
    },
  });

  const now = new Date();

  const recurringRows = [
    {
      name: "Thuê hạ tầng cloud",
      type: "EXPENSE" as const,
      amount: "18000000.00",
      frequency: "MONTHLY" as const,
      nextRunAt: new Date(now.getFullYear(), now.getMonth() + 1, 5),
      budgetId: itBudget.id,
      departmentId: itDepartment.id,
      createdById: financeAdmin.id,
    },
    {
      name: "Ngân sách quảng cáo",
      type: "EXPENSE" as const,
      amount: "22000000.00",
      frequency: "MONTHLY" as const,
      nextRunAt: new Date(now.getFullYear(), now.getMonth() + 1, 3),
      budgetId: marketingBudget.id,
      departmentId: marketingDepartment.id,
      createdById: manager.id,
    },
    {
      name: "Doanh thu subscription",
      type: "INCOME" as const,
      amount: "45000000.00",
      frequency: "MONTHLY" as const,
      nextRunAt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      budgetId: null,
      departmentId: null,
      createdById: accountant.id,
    },
  ];

  await prisma.recurringTransaction.deleteMany({
    where: {
      name: {
        in: recurringRows.map((row) => row.name),
      },
    },
  });

  for (const recurring of recurringRows) {
    await prisma.recurringTransaction.create({
      data: recurring,
    });
  }

  const recentTransactions = [
    {
      code: "TXN-SEED-MKT-01",
      type: "EXPENSE" as const,
      status: "PENDING" as const,
      amount: "12000000.00",
      currency: "VND",
      date: new Date(now.getFullYear(), now.getMonth(), 4),
      description: "Chi chiến dịch social ads",
      budgetId: marketingBudget.id,
      departmentId: marketingDepartment.id,
      createdById: manager.id,
    },
    {
      code: "TXN-SEED-MKT-02",
      type: "EXPENSE" as const,
      status: "APPROVED" as const,
      amount: "9000000.00",
      currency: "VND",
      date: new Date(now.getFullYear(), now.getMonth() - 1, 14),
      description: "Chi KOL campaign",
      budgetId: marketingBudget.id,
      departmentId: marketingDepartment.id,
      createdById: manager.id,
    },
    {
      code: "TXN-SEED-MKT-03",
      type: "EXPENSE" as const,
      status: "REJECTED" as const,
      amount: "15000000.00",
      currency: "VND",
      date: new Date(now.getFullYear(), now.getMonth() - 2, 8),
      description: "Chi event vượt hạn mức",
      budgetId: marketingBudget.id,
      departmentId: marketingDepartment.id,
      createdById: manager.id,
    },
    {
      code: "TXN-SEED-MKT-04",
      type: "EXPENSE" as const,
      status: "EXECUTED" as const,
      amount: "11000000.00",
      currency: "VND",
      date: new Date(now.getFullYear(), now.getMonth() - 3, 22),
      description: "Chi sản xuất nội dung",
      budgetId: marketingBudget.id,
      departmentId: marketingDepartment.id,
      createdById: manager.id,
    },
    {
      code: "TXN-SEED-IT-01",
      type: "EXPENSE" as const,
      status: "EXECUTED" as const,
      amount: "6000000.00",
      currency: "VND",
      date: new Date(now.getFullYear(), now.getMonth() - 1, 18),
      description: "Gia hạn license bảo mật",
      budgetId: itBudget.id,
      departmentId: itDepartment.id,
      createdById: accountant.id,
    },
    {
      code: "TXN-SEED-IT-02",
      type: "EXPENSE" as const,
      status: "PENDING" as const,
      amount: "8500000.00",
      currency: "VND",
      date: new Date(now.getFullYear(), now.getMonth() - 1, 7),
      description: "Nâng cấp server nội bộ",
      budgetId: itBudget.id,
      departmentId: itDepartment.id,
      createdById: accountant.id,
    },
    {
      code: "TXN-SEED-IT-03",
      type: "EXPENSE" as const,
      status: "APPROVED" as const,
      amount: "7200000.00",
      currency: "VND",
      date: new Date(now.getFullYear(), now.getMonth() - 2, 26),
      description: "Mua công cụ monitoring",
      budgetId: itBudget.id,
      departmentId: itDepartment.id,
      createdById: accountant.id,
    },
    {
      code: "TXN-SEED-INC-01",
      type: "INCOME" as const,
      status: "APPROVED" as const,
      amount: "38000000.00",
      currency: "VND",
      date: new Date(now.getFullYear(), now.getMonth() - 2, 20),
      description: "Thu dịch vụ quý",
      budgetId: null,
      departmentId: null,
      createdById: accountant.id,
    },
    {
      code: "TXN-SEED-INC-02",
      type: "INCOME" as const,
      status: "APPROVED" as const,
      amount: "42000000.00",
      currency: "VND",
      date: new Date(now.getFullYear(), now.getMonth() - 1, 25),
      description: "Thu hợp đồng bảo trì",
      budgetId: null,
      departmentId: null,
      createdById: accountant.id,
    },
  ];

  for (const tx of recentTransactions) {
    await prisma.transaction.upsert({
      where: { code: tx.code },
      update: {
        type: tx.type,
        status: tx.status,
        amount: tx.amount,
        currency: tx.currency,
        date: tx.date,
        description: tx.description,
        budgetId: tx.budgetId,
        departmentId: tx.departmentId,
        createdById: tx.createdById,
      },
      create: tx,
    });
  }

  const txMkt1 = await prisma.transaction.findUnique({ where: { code: "TXN-SEED-MKT-01" }, select: { id: true } });
  const txMkt2 = await prisma.transaction.findUnique({ where: { code: "TXN-SEED-MKT-02" }, select: { id: true } });
  const txIt2 = await prisma.transaction.findUnique({ where: { code: "TXN-SEED-IT-02" }, select: { id: true } });

  if (txMkt1 && txMkt2 && txIt2) {
    await prisma.transactionSplit.deleteMany({
      where: {
        transactionId: {
          in: [txMkt1.id, txMkt2.id, txIt2.id],
        },
      },
    });

    await prisma.transactionSplit.createMany({
      data: [
        { transactionId: txMkt1.id, amount: "7000000.00", categoryCode: "ADS", note: "Paid social" },
        { transactionId: txMkt1.id, amount: "5000000.00", categoryCode: "CONTENT", note: "Creative production" },
        { transactionId: txMkt2.id, amount: "6000000.00", categoryCode: "KOL", note: "Influencer" },
        { transactionId: txMkt2.id, amount: "3000000.00", categoryCode: "MEDIA", note: "Media booking" },
        { transactionId: txIt2.id, amount: "4500000.00", categoryCode: "INFRA", note: "Server upgrade" },
        { transactionId: txIt2.id, amount: "4000000.00", categoryCode: "SEC", note: "Security hardening" },
      ],
    });

    await prisma.approval.deleteMany({
      where: {
        transactionId: {
          in: [txMkt1.id, txIt2.id],
        },
      },
    });

    await prisma.approval.createMany({
      data: [
        {
          transactionId: txMkt1.id,
          approverId: manager.id,
          status: "PENDING",
          note: "Waiting manager review",
        },
        {
          transactionId: txIt2.id,
          approverId: accountant.id,
          status: "PENDING",
          note: "Pending accountant finalization",
        },
      ],
    });
  }

  for (let day = 1; day <= 30; day += 1) {
    const rateDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
    const rate = (25250 + day * 3.5).toFixed(6);

    await prisma.fxRate.upsert({
      where: {
        fromCurrency_toCurrency_rateDate_source: {
          fromCurrency: "USD",
          toCurrency: "VND",
          rateDate,
          source: "SEED_MANUAL",
        },
      },
      update: {
        rate,
        fetchedAt: new Date(),
      },
      create: {
        fromCurrency: "USD",
        toCurrency: "VND",
        rateDate,
        rate,
        source: "SEED_MANUAL",
        fetchedAt: new Date(),
      },
    });
  }

  const ledgerCode = `LED-SEED-${Date.now()}`;
  const existingLedger = await prisma.ledgerEntry.findUnique({ where: { entryCode: ledgerCode } });
  if (!existingLedger) {
    await prisma.ledgerEntry.create({
      data: {
        entryCode: ledgerCode,
        type: "TRANSFER",
        amount: "5000000.00",
        currency: "VND",
        referenceType: "BUDGET_TRANSFER",
        referenceId: "seed-transfer",
        createdById: accountant.id,
        metadata: {
          fromBudgetId: marketingBudget.id,
          toBudgetId: itBudget.id,
          reason: "Seed sample transfer",
        },
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: financeAdmin.id,
      action: "BUDGET_WARNING",
      entityType: "BUDGET",
      entityId: marketingBudget.id,
      result: "SUCCESS",
      payload: {
        percentageUsed: 83,
        warningThresholdPct: 80,
        note: "Seed warning event for AI alert testing",
      },
    },
  });

  const chatDb = prisma as unknown as {
    chatSession?: {
      upsert: (args: unknown) => Promise<{ id: string }>;
    };
    chatMessage?: {
      createMany: (args: unknown) => Promise<unknown>;
      deleteMany: (args: unknown) => Promise<unknown>;
    };
  };

  if (chatDb.chatSession && chatDb.chatMessage) {
    const seededSession = await chatDb.chatSession.upsert({
      where: { id: "seed-ai-session-admin" },
      update: {
        userId: financeAdmin.id,
        title: "Seed AI Session - Finance Admin",
        archived: false,
        lastMessageAt: now,
      },
      create: {
        id: "seed-ai-session-admin",
        userId: financeAdmin.id,
        title: "Seed AI Session - Finance Admin",
        archived: false,
        lastMessageAt: now,
      },
      select: { id: true },
    });

    await chatDb.chatMessage.deleteMany({ where: { sessionId: seededSession.id } });
    await chatDb.chatMessage.createMany({
      data: [
        {
          sessionId: seededSession.id,
          role: "USER",
          content: "So sánh chi phí Q1 vs Q2",
          intent: "ANALYSIS",
          routeUsed: "SERVICE",
          citations: null,
          createdAt: new Date(now.getTime() - 120000),
        },
        {
          sessionId: seededSession.id,
          role: "ASSISTANT",
          content: "Đây là hội thoại seed để test lịch sử chat và citation.",
          intent: "ANALYSIS",
          routeUsed: "SERVICE",
          citations: [{ source: "report-service", snippet: "monthlySeries" }],
          createdAt: new Date(now.getTime() - 60000),
        },
      ],
    });
  }

  console.log("Prisma seed completed.");
  console.log("Demo users:");
  console.log("- admin / admin123");
  console.log("- manager / manager123");
  console.log("- accountant / accountant123");
  console.log("- employee / employee123");
  console.log("- auditor / auditor123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
