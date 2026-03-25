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
        period: "2026-Q1",
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
      period: "2026-Q1",
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
        period: "2026-Q1",
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
      period: "2026-Q1",
      amount: "50000000.00",
      reserved: "2000000.00",
      used: "12000000.00",
      parentBudgetId: null,
    },
  });

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

  await prisma.ledgerEntry.create({
    data: {
      entryCode: `LED-SEED-${Date.now()}`,
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
