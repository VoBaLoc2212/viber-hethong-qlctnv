import { NextResponse } from "next/server";

import { getStore } from "../../_store";

export async function GET() {
  const store = getStore();
  const totalBudget = store.departments.reduce((sum, d) => sum + Number(d.budgetAllocated ?? 0), 0);
  const totalSpent = store.transactions
    .filter((t) => t.type === "EXPENSE" && t.status !== "REJECTED")
    .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
  const totalIncome = store.transactions
    .filter((t) => t.type === "INCOME" && t.status !== "REJECTED")
    .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
  const transactionCount = store.transactions.length;
  const pendingCount = store.transactions.filter((t) => t.status === "PENDING").length;

  return NextResponse.json({
    totalBudget,
    totalSpent,
    remainingBalance: totalBudget - totalSpent,
    totalIncome,
    transactionCount,
    pendingCount,
  });
}
