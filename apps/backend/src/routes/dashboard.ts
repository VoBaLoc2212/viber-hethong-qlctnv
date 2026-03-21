import { Router, type IRouter } from "express";
import { db, transactionsTable, departmentsTable } from "@workspace/db";
import { eq, sql, sum } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/kpis", async (req, res) => {
  try {
    const [spendingResult, incomeResult, deptResult, countResult, pendingResult] = await Promise.all([
      db
        .select({ total: sum(transactionsTable.amount) })
        .from(transactionsTable)
        .where(eq(transactionsTable.type, "EXPENSE")),
      db
        .select({ total: sum(transactionsTable.amount) })
        .from(transactionsTable)
        .where(eq(transactionsTable.type, "INCOME")),
      db
        .select({ total: sum(departmentsTable.budgetAllocated) })
        .from(departmentsTable),
      db
        .select({ count: sql<number>`count(*)` })
        .from(transactionsTable),
      db
        .select({ count: sql<number>`count(*)` })
        .from(transactionsTable)
        .where(eq(transactionsTable.status, "PENDING")),
    ]);

    const totalBudget = Number(deptResult[0]?.total ?? 0);
    const totalSpent = Number(spendingResult[0]?.total ?? 0);
    const totalIncome = Number(incomeResult[0]?.total ?? 0);

    res.json({
      totalBudget,
      totalSpent,
      remainingBalance: totalBudget - totalSpent,
      totalIncome,
      transactionCount: Number(countResult[0]?.count ?? 0),
      pendingCount: Number(pendingResult[0]?.count ?? 0),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch KPIs");
    res.status(500).json({ error: "Failed to fetch KPIs" });
  }
});

router.get("/dashboard/expenses-by-month", async (req, res) => {
  try {
    const rows = await db
      .select({
        month: sql<string>`to_char(date, 'Mon YYYY')`,
        monthOrder: sql<string>`to_char(date, 'YYYY-MM')`,
        type: transactionsTable.type,
        total: sum(transactionsTable.amount),
      })
      .from(transactionsTable)
      .groupBy(
        sql`to_char(date, 'Mon YYYY')`,
        sql`to_char(date, 'YYYY-MM')`,
        transactionsTable.type
      )
      .orderBy(sql`to_char(date, 'YYYY-MM')`);

    const monthMap = new Map<string, { month: string; expenses: number; income: number }>();

    for (const row of rows) {
      const key = row.monthOrder;
      if (!monthMap.has(key)) {
        monthMap.set(key, { month: row.month, expenses: 0, income: 0 });
      }
      const entry = monthMap.get(key)!;
      if (row.type === "EXPENSE") {
        entry.expenses = Number(row.total ?? 0);
      } else {
        entry.income = Number(row.total ?? 0);
      }
    }

    res.json(Array.from(monthMap.values()));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch expenses by month");
    res.status(500).json({ error: "Failed to fetch expenses by month" });
  }
});

export default router;
