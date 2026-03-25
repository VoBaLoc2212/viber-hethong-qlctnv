import { NextResponse } from "next/server";

import { getStore } from "../../_store";

function formatMonthKey(date: Date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function formatLabel(date: Date) {
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

export async function GET() {
  const store = getStore();

  const byMonth = new Map<string, { month: string; income: number; expenses: number }>();
  for (const tx of store.transactions) {
    if (tx.status === "REJECTED") continue;
    const d = new Date(tx.date);
    const key = formatMonthKey(d);
    if (!byMonth.has(key)) {
      byMonth.set(key, { month: formatLabel(d), income: 0, expenses: 0 });
    }
    const row = byMonth.get(key)!;
    if (tx.type === "INCOME") row.income += Number(tx.amount ?? 0);
    if (tx.type === "EXPENSE") row.expenses += Number(tx.amount ?? 0);
  }

  const sorted = Array.from(byMonth.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, v]) => v);

  return NextResponse.json(sorted.slice(-6));
}
