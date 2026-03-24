# Database Schema Documentation

## Table Structure

### Core Tables

#### departments
Stores department/organization unit information
```sql
id: PRIMARY KEY
name: VARCHAR(255) - Department name
code: VARCHAR(50) - Department code (unique)
description: TEXT - Department description
budget_allocated: NUMERIC(15,2) - Total allocated budget
budget_used: NUMERIC(15,2) - Amount spent
created_at: TIMESTAMP - Creation time
updated_at: TIMESTAMP - Last update
```

#### budget_categories
Transaction categories for organization
```sql
id: PRIMARY KEY
name: VARCHAR(255) - Category name (Salary, Equipment, etc.)
code: VARCHAR(50) - Category code
description: TEXT - Category description
department_id: FK → departments - Optional specific department
created_at: TIMESTAMP
updated_at: TIMESTAMP
```

Example categories:
- Salary (SAL) - Lương nhân viên
- Office Supplies (VPP) - Văn phòng phẩm
- Office Rent (RENT) - Tiền thuê văn phòng
- Utilities (UTIL) - Điện, nước, gas
- Equipment (EQU) - Mua máy tính
- Travel (TRV) - Công tác/Di chuyển
- Entertainment (ENT) - Tiếp khách/Liên hoan

#### budget_allocations
Quarterly budget allocations for departments
```sql
id: PRIMARY KEY
department_id: FK → departments
category_id: FK → budget_categories (optional)
amount_allocated: NUMERIC(15,2) - Budget amount
fiscal_year: INTEGER - Fiscal year (e.g., 2026)
quarter: INTEGER - Quarter (1-4)
notes: TEXT
created_at, updated_at: TIMESTAMP
UNIQUE(department_id, category_id, fiscal_year, quarter)
```

Example:
- Marketing Department Q1 2026: 500,000,000 VND
- Operations Q1 2026 for Rent: 75,000,000 VND

#### transactions
Income/Expense transaction records
```sql
id: PRIMARY KEY
transaction_code: VARCHAR(100) - Unique code (e.g., CHI-2026-001)
type: ENUM(INCOME, EXPENSE) - Transaction type
amount: NUMERIC(15,2) - Amount in VND
category_id: FK → budget_categories
department_id: FK → departments
date: TIMESTAMP - Transaction date
description: TEXT - Transaction description
status: ENUM(PENDING, APPROVED, REJECTED, COMPLETED)
attachment_url: TEXT - Invoice image URL
notes: TEXT
created_at, updated_at: TIMESTAMP
```

Statuses:
- PENDING: Created but not yet submitted for approval
- APPROVED: Approved by manager, awaiting payment
- REJECTED: Rejected during approval
- COMPLETED: Actually paid/received

#### budget_transfers
Budget movement between allocations (with audit trail)
```sql
id: PRIMARY KEY
from_allocation_id: FK → budget_allocations
to_allocation_id: FK → budget_allocations
amount: NUMERIC(15,2)
reason: TEXT - Why transfer (e.g., "Shift 10M from entertainment to supplies")
status: ENUM(PENDING, APPROVED, REJECTED)
approved_by: INTEGER - User ID
approved_at: TIMESTAMP
created_at, updated_at: TIMESTAMP
```

#### approval_workflows
Approval process tracking (PENDING → APPROVED/REJECTED)
```sql
id: PRIMARY KEY
transaction_id: FK → transactions
status: ENUM(PENDING, APPROVED, REJECTED)
approved_by: INTEGER - Manager/Approver user ID
approval_date: TIMESTAMP
rejection_reason: TEXT - Why rejected, if applicable
notes: TEXT
created_at, updated_at: TIMESTAMP
```

#### reserved_budgets
Encumbrance - amounts approved but not yet paid
```sql
id: PRIMARY KEY
allocation_id: FK → budget_allocations
amount: NUMERIC(15,2) - Reserved amount
related_transaction_id: FK → transactions
reason: TEXT - Description
status: ENUM(PENDING, APPROVED, REJECTED)
created_at: TIMESTAMP
expires_at: TIMESTAMP - When this reservation becomes invalid
```

Example:
- Budget: Q1 Marketing 500M
- When transaction approved: Reserve 50M
- When transaction completed: Remove from reserved

#### cashbooks
Daily cash flow record (immutable ledger)
```sql
id: PRIMARY KEY
transaction_date: TIMESTAMP
transaction_type: ENUM(INCOME, EXPENSE)
amount: NUMERIC(15,2)
transaction_id: FK → transactions
balance_before: NUMERIC(15,2) - Balance before transaction
balance_after: NUMERIC(15,2) - Balance after transaction
description: TEXT
created_at: TIMESTAMP
```

#### reconciliations
Bank reconciliation records
```sql
id: PRIMARY KEY
reconciliation_date: TIMESTAMP
status: ENUM(NOT_RECONCILED, RECONCILED, VARIANCE)
system_balance: NUMERIC(15,2) - Balance in system
actual_balance: NUMERIC(15,2) - Actual bank balance
variance: NUMERIC(15,2) - Difference
variance_reason: TEXT - Explanation of difference
notes: TEXT
reconciled_by: INTEGER - User ID
reconciled_at: TIMESTAMP
created_at, updated_at: TIMESTAMP
```

#### recurring_transactions
Templates for auto-generated recurring transactions
```sql
id: PRIMARY KEY
name: VARCHAR(255) - Name (e.g., "Monthly Rent")
description: TEXT
amount: NUMERIC(15,2)
type: ENUM(INCOME, EXPENSE)
category_id: FK → budget_categories
department_id: FK → departments
frequency: ENUM(DAILY, WEEKLY, MONTHLY, QUARTERLY, ANNUALLY)
start_date: DATE
end_date: DATE (optional)
day_of_month: INTEGER - If MONTHLY, which day?
is_active: BOOLEAN
last_generated: TIMESTAMP
created_at, updated_at: TIMESTAMP
```

#### audit_logs
Immutable change log for compliance
```sql
id: PRIMARY KEY
entity_type: VARCHAR(100) - Table name
entity_id: INTEGER - Record ID
action: VARCHAR(50) - INSERT, UPDATE, DELETE
changes: JSONB - Old vs new values
user_id: INTEGER - Who made the change
ip_address: VARCHAR(45)
user_agent: TEXT
created_at: TIMESTAMP
```

## Workflow Examples

### 1. Simple Expense Request

```
1. Employee creates transaction (PENDING)
   - Reference: CHI-2026-001
   - Amount: 5,000,000
   - Status: PENDING

2. Manager reviews in approval_workflows
   - Status changes to APPROVED
   - Reserved assets from budget

3. Accountant marks as COMPLETED
   - Actually pays
   - Removes from reserved
   - Updates budget_used
   - Creates cashbook entry
```

### 2. Budget Transfer (Current requirement)

```
Current state:
- Department: Marketing Q1 2026 = 500M
- Allocated Entertainment: 100M
- Allocated Supplies: 30M

Request: Move 10M from Entertainment to Supplies

Process:
1. Create budget_transfer (PENDING)
   - from: Entertainment allocation (100M) → 90M
   - to: Supplies allocation (30M) → 40M
   - reason: "Support to office expansion"

2. Manager approves
   - status → APPROVED
   - Create audit_log entry "Transferred 10M Entertainment→Supplies"

3. Update allocations
   - Entertainment: 100M → 90M
   - Supplies: 30M → 40M
```

### 3. Budget Alert Scenario

```
Department: Marketing, Q1 2026, Budget: 500M

Step by step:
1. Nov: Spend 400M → utilization = 80% → SEND EMAIL ALERT
2. Dec: Spend 490M → 98% → SEND CRITICAL ALERT
3. Jan: Try to create expense 20M → REJECT or REQUIRE OVERRIDE
```

### 4. Recurring Monthly Rent

```
Setup:
- Recurring transaction: "Monthly Rent"
- Department: Operations
- Category: Office Rent
- Amount: 75,000,000
- Frequency: MONTHLY
- Day: 1 (first of month)

Monthly process (automatic):
- System detects it's the 1st
- Queries generate_recurring_transactions()
- Creates transaction (PENDING)
- Employee confirms/approves
- Accountant processes
```

## Views for Reporting

### department_budget_status
Shows real-time budget utilization:
```sql
SELECT
  department_name,
  budget_allocated,
  amount_spent,
  amount_reserved,
  amount_available = budget - spent - reserved,
  utilization_percentage = (spent / budget) * 100
FROM department_budget_status
```

### daily_cash_balance
Daily cash flow summary:
```sql
SELECT
  date,
  closing_balance,
  daily_income,
  daily_expense,
  net_flow = daily_income - daily_expense
FROM daily_cash_balance
```

## Key Features

### 1. Immutable Ledger
- Transactions can't be deleted/edited once COMPLETED
- Changes recorded in audit_logs
- Reversal entries for corrections (standard accounting)

### 2. Encumbrance (Reserved Budget)
- When approved: amount reserved immediately
- Prevents double-spending
- Removes reserve when paid

### 3. Split Transactions
- One invoice split across multiple items
- Could be stored as:
  - One transaction + JSONB details, OR
  - Multiple transactions linked by reference

### 4. Multi-approval Workflow
- Employee → Manager approval → Accountant payment
- Each step: approval_workflows entry
- Serial or parallel approvals possible

### 5. Audit Trail
- audit_logs tracks ALL changes
- Immutable timestamps
- For compliance/investigation

## Indexes

Optimized for:
- Transaction lookups by date, department, status
- Budget allocation queries
- Audit queries by date
- Text search on descriptions

## Growth Considerations

- **Data volume**: Millions of transactions → partition by year/month
- **Multi-currency**: Add currency code to transactions
- **Multi-entity**: Support multi-company setups
- **Advanced workflows**: More complex approval chains
- **Real-time dashboards**: Event streaming
