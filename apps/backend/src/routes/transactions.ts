import { Router, type IRouter } from "express";
import { db, transactionsTable, departmentsTable } from "@workspace/db";
import { eq, desc, and, count, type SQL } from "drizzle-orm";
import {
  GetTransactionsQueryParams,
  CreateTransactionBody,
  UpdateTransactionStatusBody,
  GetTransactionParams,
  UpdateTransactionStatusParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function generateTransactionCode(): string {
  const prefix = "TXN";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

router.get("/transactions", async (req, res) => {
  try {
    const query = GetTransactionsQueryParams.parse(req.query) as unknown as {
      page?: number;
      limit?: number;
      type?: "INCOME" | "EXPENSE";
      status?: "PENDING" | "APPROVED" | "REJECTED";
      departmentId?: number;
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (query.type) {
      conditions.push(eq(transactionsTable.type, query.type));
    }
    if (query.status) {
      conditions.push(eq(transactionsTable.status, query.status));
    }
    if (query.departmentId) {
      conditions.push(eq(transactionsTable.departmentId, query.departmentId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [transactions, totalResult] = await Promise.all([
      db
        .select({
          id: transactionsTable.id,
          transactionCode: transactionsTable.transactionCode,
          type: transactionsTable.type,
          amount: transactionsTable.amount,
          categoryId: transactionsTable.categoryId,
          departmentId: transactionsTable.departmentId,
          departmentName: departmentsTable.name,
          date: transactionsTable.date,
          description: transactionsTable.description,
          status: transactionsTable.status,
          createdAt: transactionsTable.createdAt,
        })
        .from(transactionsTable)
        .leftJoin(departmentsTable, eq(transactionsTable.departmentId, departmentsTable.id))
        .where(whereClause)
        .orderBy(desc(transactionsTable.date))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(transactionsTable)
        .where(whereClause),
    ]);

    res.json({
      data: transactions,
      total: Number(totalResult[0]?.count ?? 0),
      page,
      limit,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch transactions");
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

router.post("/transactions", async (req, res) => {
  try {
    const body = CreateTransactionBody.parse(req.body) as unknown as {
      type: "INCOME" | "EXPENSE";
      amount: number;
      description?: string;
      departmentId?: number;
      categoryId?: number;
      date: string;
      status?: "PENDING" | "APPROVED" | "REJECTED";
    };
    const transactionCode = generateTransactionCode();

    const [transaction] = await db
      .insert(transactionsTable)
      .values([
        {
          transactionCode,
          type: body.type,
          amount: String(body.amount),
          description: body.description ?? null,
          departmentId: body.departmentId ?? null,
          categoryId: body.categoryId ?? null,
          date: new Date(body.date),
          status: body.status ?? "PENDING",
        },
      ])
      .returning();

    const [result] = await db
      .select({
        id: transactionsTable.id,
        transactionCode: transactionsTable.transactionCode,
        type: transactionsTable.type,
        amount: transactionsTable.amount,
        categoryId: transactionsTable.categoryId,
        departmentId: transactionsTable.departmentId,
        departmentName: departmentsTable.name,
        date: transactionsTable.date,
        description: transactionsTable.description,
        status: transactionsTable.status,
        createdAt: transactionsTable.createdAt,
      })
      .from(transactionsTable)
      .leftJoin(departmentsTable, eq(transactionsTable.departmentId, departmentsTable.id))
      .where(eq(transactionsTable.id, transaction.id));

    res.status(201).json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to create transaction");
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

router.get("/transactions/:id", async (req, res) => {
  try {
    const { id } = GetTransactionParams.parse({ id: parseInt(req.params.id) });
    const [transaction] = await db
      .select({
        id: transactionsTable.id,
        transactionCode: transactionsTable.transactionCode,
        type: transactionsTable.type,
        amount: transactionsTable.amount,
        categoryId: transactionsTable.categoryId,
        departmentId: transactionsTable.departmentId,
        departmentName: departmentsTable.name,
        date: transactionsTable.date,
        description: transactionsTable.description,
        status: transactionsTable.status,
        createdAt: transactionsTable.createdAt,
      })
      .from(transactionsTable)
      .leftJoin(departmentsTable, eq(transactionsTable.departmentId, departmentsTable.id))
      .where(eq(transactionsTable.id, id));

    if (!transaction) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    res.json(transaction);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch transaction");
    res.status(500).json({ error: "Failed to fetch transaction" });
  }
});

router.patch("/transactions/:id", async (req, res) => {
  try {
    const { id } = UpdateTransactionStatusParams.parse({ id: parseInt(req.params.id) });
    const body = UpdateTransactionStatusBody.parse(req.body) as unknown as {
      status: "PENDING" | "APPROVED" | "REJECTED";
    };

    const [updated] = await db
      .update(transactionsTable)
      .set({ status: body.status })
      .where(eq(transactionsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }

    const [result] = await db
      .select({
        id: transactionsTable.id,
        transactionCode: transactionsTable.transactionCode,
        type: transactionsTable.type,
        amount: transactionsTable.amount,
        categoryId: transactionsTable.categoryId,
        departmentId: transactionsTable.departmentId,
        departmentName: departmentsTable.name,
        date: transactionsTable.date,
        description: transactionsTable.description,
        status: transactionsTable.status,
        createdAt: transactionsTable.createdAt,
      })
      .from(transactionsTable)
      .leftJoin(departmentsTable, eq(transactionsTable.departmentId, departmentsTable.id))
      .where(eq(transactionsTable.id, id));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to update transaction");
    res.status(500).json({ error: "Failed to update transaction" });
  }
});

export default router;
