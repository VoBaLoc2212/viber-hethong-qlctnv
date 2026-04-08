import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const allTransactions = await prisma.transaction.count();
  const financialTransactions = await prisma.transaction.count({
    where: {
      status: {
        notIn: ["REJECTED", "REVERSED"],
      },
    },
  });

  const grouped = await prisma.transaction.groupBy({
    by: ["type"],
    where: {
      status: {
        notIn: ["REJECTED", "REVERSED"],
      },
    },
    _sum: {
      amount: true,
    },
  });

  const totalIncome = Number((grouped.find((row) => row.type === "INCOME")?._sum.amount ?? 0).toString());
  const totalExpense = Number((grouped.find((row) => row.type === "EXPENSE")?._sum.amount ?? 0).toString());

  const result = {
    allTransactions,
    financialTransactions,
    totalIncome,
    totalExpense,
    rule: {
      transactionCountIncludesAllStatuses: true,
      amountExcludesStatuses: ["REJECTED", "REVERSED"],
    },
  };

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
