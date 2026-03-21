import { pgTable, serial, text, numeric, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { departmentsTable } from "./departments";

export const transactionTypeEnum = pgEnum("transaction_type", ["INCOME", "EXPENSE"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["PENDING", "APPROVED", "REJECTED"]);

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  transactionCode: text("transaction_code").notNull().unique(),
  type: transactionTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  categoryId: integer("category_id"),
  departmentId: integer("department_id").references(() => departmentsTable.id),
  date: timestamp("date").notNull(),
  description: text("description"),
  status: transactionStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
