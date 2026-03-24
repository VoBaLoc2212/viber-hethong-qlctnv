# Drizzle ORM Setup and Migrations Guide

## Overview

This project uses **Drizzle ORM** with PostgreSQL. The schema is defined in `lib/db/src/schema/` and managed through Drizzle Kit migrations.

## Database Files

```
lib/db/
├── drizzle.config.ts       # Drizzle configuration
├── package.json
├── src/
│   └── schema/
│       ├── index.ts        # Main schema export
│       ├── departments.ts   # Department table
│       └── transactions.ts  # Transaction tables
```

## Running Migrations

### Generate New Migrations

When you update schema files in `lib/db/src/schema/`:

```bash
# Install drizzle-kit globally (if not already)
npm install -g drizzle-kit

# From root directory
cd lib/db
npx drizzle-kit generate

# From root directory (if you have a script)
npm run drizzle generate
```

This creates migration files in `drizzle/migrations/` with SQL that creates/updates tables.

### Apply Migrations

```bash
# Automatic on startup if using migrate command
npm run drizzle migrate

# Or from lib/db directory
cd lib/db
npx drizzle-kit migrate
```

### View Database Schema

```bash
# Interactive studio UI
npx drizzle-kit studio
# Opens at http://local.drizzle.studio/
```

### Push During Development

```bash
# Directly push schema without creating migration (dev only!)
npx drizzle-kit push
```

## Schema Structure

### Departments Table (departments.ts)

```typescript
import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const departmentsTable = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  budgetAllocated: numeric("budget_allocated", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### Transactions Table (transactions.ts)

```typescript
import { pgEnum } from "drizzle-orm/pg-core";

export const transactionTypeEnum = pgEnum("transaction_type", ["INCOME", "EXPENSE"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["PENDING", "APPROVED", "REJECTED"]);

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  transactionCode: text("transaction_code").notNull().unique(),
  type: transactionTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  departmentId: integer("department_id").references(() => departmentsTable.id),
  date: timestamp("date").notNull(),
  status: transactionStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

## How to Add New Tables

### Step 1: Create Schema File

Create `lib/db/src/schema/budget_allocations.ts`:

```typescript
import { pgTable, serial, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { departmentsTable } from "./departments";

export const budgetAllocationsTable = pgTable("budget_allocations", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id")
    .notNull()
    .references(() => departmentsTable.id),
  amountAllocated: numeric("amount_allocated", { precision: 15, scale: 2 })
    .notNull(),
  fiscalYear: integer("fiscal_year").notNull(),
  quarter: integer("quarter").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBudgetAllocationSchema = createInsertSchema(
  budgetAllocationsTable
).omit({
  id: true,
  createdAt: true,
});

export type InsertBudgetAllocation = z.infer<typeof insertBudgetAllocationSchema>;
export type BudgetAllocation = typeof budgetAllocationsTable.$inferSelect;
```

### Step 2: Export from index.ts

In `lib/db/src/schema/index.ts`:

```typescript
export * from "./departments";
export * from "./transactions";
export * from "./budget_allocations";  // Add this
```

### Step 3: Generate Migration

```bash
cd lib/db
npx drizzle-kit generate
```

This creates a migration SQL file.

### Step 4: Apply Migration

```bash
cd lib/db
npx drizzle-kit migrate
```

## Common Schema Operations

### Add a Column to Existing Table

Edit `lib/db/src/schema/departments.ts`:

```typescript
export const departmentsTable = pgTable("departments", {
  // ... existing columns
  description: text("description"), // ADD THIS
});
```

Generate and migrate:

```bash
cd lib/db
npx drizzle-kit generate
npx drizzle-kit migrate
```

### Create Foreign Relationship

```typescript
export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id")
    .notNull()
    .references(() => departmentsTable.id, { 
      onDelete: "cascade", // Delete transaction if dept deleted
      onUpdate: "cascade"
    }),
  // ... other columns
});
```

### Create Enum Type

```typescript
import { pgEnum } from "drizzle-orm/pg-core";

export const transactionTypeEnum = pgEnum("transaction_type", ["INCOME", "EXPENSE"]);

export const transactionsTable = pgTable("transactions", {
  type: transactionTypeEnum("type").notNull(),
  // ...
});
```

### Create Unique Constraint

```typescript
export const departmentsTable = pgTable("departments", {
  code: text("code").notNull().unique(), // Column level
});

// Or table level:
export const transactionsTable = pgTable(
  "transactions",
  {
    transactionCode: text("transaction_code").notNull(),
    departmentId: integer("department_id").notNull(),
    // ...
  },
  (table) => ({
    // Unique combination of code + department
    uniqueCodeDept: unique().on(table.transactionCode, table.departmentId),
  })
);
```

### Create Index

```typescript
export const transactionsTable = pgTable(
  "transactions",
  {
    date: timestamp("date").notNull(),
    departmentId: integer("department_id"),
    status: text("status"),
    // ...
  },
  (table) => ({
    // Create indexes
    dateIdx: index("idx_transactions_date").on(table.date),
    deptIdx: index("idx_transactions_dept").on(table.departmentId),
    statusIdx: index("idx_transactions_status").on(table.status),
  })
);
```

## Using Drizzle in Backend Code

### Query

```typescript
import { db } from "@workspace/db";
import { departmentsTable, transactionsTable } from "@workspace/db";

// Select all
const departments = await db.select().from(departmentsTable);

// Select with where
const marketing = await db
  .select()
  .from(departmentsTable)
  .where(eq(departmentsTable.code, "MKT"));

// Join
const deptTransactions = await db
  .select()
  .from(transactionsTable)
  .innerJoin(
    departmentsTable,
    eq(transactionsTable.departmentId, departmentsTable.id)
  )
  .where(eq(departmentsTable.code, "MKT"));

// Aggregate
const total = await db
  .select({ total: sum(transactionsTable.amount) })
  .from(transactionsTable)
  .where(eq(transactionsTable.type, "EXPENSE"));
```

### Insert

```typescript
const result = await db
  .insert(departmentsTable)
  .values({
    name: "Marketing",
    code: "MKT",
    budgetAllocated: "500000000",
  })
  .returning();
```

### Update

```typescript
await db
  .update(departmentsTable)
  .set({ budgetAllocated: "600000000" })
  .where(eq(departmentsTable.code, "MKT"));
```

### Delete

```typescript
await db
  .delete(departmentsTable)
  .where(eq(departmentsTable.code, "MKT"));
```

## Development Workflow

```bash
# 1. Edit schema files
nano lib/db/src/schema/departments.ts

# 2. Generate migration
npm run drizzle generate

# 3. Review migration (optional)
cat lib/db/drizzle/migrations/<migration-name>.sql

# 4. Apply migration
npm run drizzle migrate

# OR push directly (dev only)
npm run drizzle push

# 5. Update your TypeScript code to use new field
```

## Troubleshooting

### Migration Failed - Table Already Exists

```sql
-- Manually check table
SELECT * FROM information_schema.tables WHERE table_name = 'departments';

-- Might need to drop and recreate
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
-- Then re-migrate
```

### Can't Connect to Database

```bash
# Check Docker container
docker ps | grep postgres

# Check logs
docker logs budget_postgres

# Verify DATABASE_URL in .env
cat .env | grep DATABASE_URL
```

### Type Conflicts with Generated Schema

```typescript
// If interface doesn't match DB schema, regenerate types
npx drizzle-kit generate
```

## Resources

- Drizzle Docs: https://orm.drizzle.team/
- PostgreSQL Types: https://www.postgresql.org/docs/current/datatype.html
- Drizzle Queries: https://orm.drizzle.team/docs/select
- Drizzle Migrations: https://orm.drizzle.team/docs/migrations

