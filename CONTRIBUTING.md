# Contributing to Budget Management System

Thank you for your interest in contributing! This document outlines how to get started.

## Prerequisites

- Node.js 20+
- Docker Desktop 20.10+
- Git
- Code editor (VS Code recommended)
- Basic understanding of TypeScript, React, and databases

## Setup Development Environment

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/budget-management-system.git
cd budget-management-system
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Local Services

```bash
# Using docker-compose
docker-compose up -d

# Or using make
make dev
```

### 4. Verify Setup

```bash
# Check all services are running
docker-compose ps

# Test API health
curl http://localhost:3000/api/health

# Access frontend
# Open http://localhost:5173 in browser
```

## Development Workflow

### 1. Create a Feature Branch

```bash
# Update main
git checkout main
git pull origin main

# Create branch for your feature
git checkout -b feature/your-feature-name
```

**Branch naming conventions:**
- `feature/add-budget-alerts` - New feature
- `fix/transaction-calculation` - Bug fix
- `docs/api-documentation` - Documentation
- `refactor/schema-optimization` - Code improvement
- `test/add-transaction-tests` - Tests

### 2. Make Changes

#### Backend Development

Edit files in `apps/backend/src/`

```bash
# Backend automatically rebuilds on changes (in dev mode)
# View logs
docker-compose logs -f backend

# To manually rebuild
docker-compose build backend
docker-compose up -d backend
```

Example adding a new route:

```typescript
// apps/backend/src/routes/budgets.ts
import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  // Your code here
  res.json({ success: true });
});

export default router;
```

Then add to `apps/backend/src/routes/index.ts`:

```typescript
import budgetsRouter from "./budgets";

router.use("/budgets", budgetsRouter);
```

#### Frontend Development

Edit files in `apps/frontend/src/`

```bash
# Frontend automatically reloads on changes (Vite HMR)
# View logs
docker-compose logs -f frontend

# Open http://localhost:5173
```

Example adding a new page:

```typescript
// apps/frontend/src/pages/budget-status.tsx
import { useQuery } from "@tanstack/react-query";
import { api } from "@workspace/api-client-react";

export default function BudgetStatusPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["budget-status"],
    queryFn: () => api.getDashboardBudgetStatus(),
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {/* Your JSX */}
    </div>
  );
}
```

#### Database Schema Changes

Edit schema files in `lib/db/src/schema/`

```typescript
// lib/db/src/schema/budgets.ts
import { pgTable, serial, numeric } from "drizzle-orm/pg-core";

export const budgetsTable = pgTable("budgets", {
  id: serial("id").primaryKey(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
});
```

Generate migration:

```bash
cd lib/db
npx drizzle-kit generate

# Apply migration
npx drizzle-kit migrate
```

### 3. Type Checking

Before committing, ensure no TypeScript errors:

```bash
# Check all types
npm run typecheck

# Type check specific workspace
npm run typecheck -w apps/backend
npm run typecheck -w apps/frontend
```

### 4. Testing (When Available)

```bash
# Run all tests
npm run test

# Run specific test file
npm run test -- transactions.test.ts

# Watch mode
npm run test -- --watch

# Coverage
npm run test -- --coverage
```

### 5. Code Style

Your code should follow the established style:

```bash
# Format code (Prettier)
npm run format

# Check formatting
npm run format:check

# Lint (if configured)
npm run lint
```

### 6. Commit Changes

```bash
# Stage changes
git add .

# Commit with clear message
git commit -m "feat: add budget allocation feature"

# Push to your fork
git push origin feature/your-feature-name
```

**Commit message format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Build/tooling changes

Example:
```
feat(transactions): add split transaction support

Allow users to split a single invoice across multiple
budget categories. Implements the split transaction feature
from requirements module 2.

Fixes #123
```

### 7. Create Pull Request

1. Go to GitHub
2. Create Pull Request from your fork to main repo
3. Write clear description:

```markdown
## Description
Briefly describe what this PR does

## Type
- [ ] Feature
- [ ] Bug Fix
- [ ] Documentation
- [ ] Refactoring

## Related Issues
Fixes #123

## Testing
Describe how you tested this

## Screenshots (if UI changes)
Add before/after screenshots

## Checklist
- [ ] I have tested this locally
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Code style is correct (`npm run format`)
- [ ] Commit messages are clear
- [ ] Documentation is updated
- [ ] Tests are included
```

## Code Guidelines

### Backend

- Use TypeScript strictly (no `any`)
- Follow Express.js best practices
- Add proper error handling
- Use Drizzle ORM for database access
- Add request logging for debugging
- Return consistent JSON responses

Example endpoint:

```typescript
// Good ✅
router.post("/departments", async (req, res, next) => {
  try {
    const parsed = insertDepartmentSchema.parse(req.body);
    const result = await db.insert(departmentsTable).values(parsed).returning();
    
    res.status(201).json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    next(error);  // Pass to error handler
  }
});

// Bad ❌
router.post("/departments", async (req, res) => {
  const result = await db.insert(departmentsTable).values(req.body);
  res.json(result);  // No error handling
});
```

### Frontend

- Use TypeScript strictly
- Follow React best practices (hooks)
- Use TanStack Query for server state
- Use React Hook Form for forms
- Keep components small and reusable
- Add PropTypes or TypeScript interfaces

Example component:

```typescript
// Good ✅
interface TransactionListProps {
  departmentId: number;
  onSelect?: (id: number) => void;
}

export function TransactionList({ departmentId, onSelect }: TransactionListProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["transactions", departmentId],
    queryFn: () => api.getTransactions(departmentId),
  });

  if (isLoading) return <Skeleton />;

  return (
    <div>
      {data?.map(t => (
        <TransactionRow key={t.id} transaction={t} onSelect={onSelect} />
      ))}
    </div>
  );
}

// Bad ❌
export function TransactionList(props: any) {
  const [data, setData] = useState<any>([]);
  
  useEffect(() => {
    fetch(`/api/transactions/${props.dept}`).then(r => r.json()).then(setData);
  }, []);
  
  return <>{data.map((t: any) => <div>{t.name}</div>)}</>;
}
```

### Database

- Use descriptive table names (plural: users, not user)
- Use snake_case for column names
- Always include created_at, updated_at
- Add indexes for frequently queried columns
- Include comments for complex logic
- Use foreign keys for relationships
- Add constraints (NOT NULL, UNIQUE, etc.)

## Documentation

- Update README.md if adding major features
- Add TSDoc comments to functions
- Document API endpoints in API_DOCS.md
- Update DATABASE_SCHEMA.md if schema changes
- Include examples in comments

Example TSDoc:

```typescript
/**
 * Calculate department budget utilization percentage
 * 
 * @param allocated - Total allocated budget
 * @param spent - Amount already spent
 * @param reserved - Amount reserved but not yet spent
 * @returns Percentage used (0-100)
 * 
 * @example
 * const percentage = calculateUtilization(1000, 300, 200);
 * // returns 50
 */
export function calculateUtilization(
  allocated: number,
  spent: number,
  reserved: number
): number {
  return ((spent + reserved) / allocated) * 100;
}
```

## Testing Guidelines

- Write tests for new features
- Test happy path and error cases
- Test edge cases (empty data, large amounts, etc.)
- Mock API calls in frontend tests

```typescript
// Example backend test
describe("POST /transactions", () => {
  it("should create a transaction with valid data", async () => {
    const res = await request(app)
      .post("/api/transactions")
      .send({
        type: "EXPENSE",
        amount: "5000000",
        departmentId: 1,
        date: new Date(),
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
  });

  it("should reject invalid amount", async () => {
    const res = await request(app)
      .post("/api/transactions")
      .send({
        type: "EXPENSE",
        amount: "-5000000",  // Invalid
        departmentId: 1,
        date: new Date(),
      });

    expect(res.status).toBe(400);
  });
});
```

## Troubleshooting

### TypeScript errors after changes

```bash
npm run typecheck
npm run build
```

### Database not updating

```bash
docker-compose exec postgres psql -U budget_user -d budget_qlctnv
SELECT * FROM your_table;
```

### Changes not reflecting in API

```bash
docker-compose logs -f backend
docker-compose rebuild backend
```

### Frontend not showing updates

```bash
# Very likely HMR works in dev, hard refresh browser
Ctrl+F5 (Windows) or Cmd+Shift+R (macOS)

# Clear browser cache
docker-compose down
docker-compose up -d frontend
```

## Review Process

1. A maintainer will review your PR
2. Address any requested changes
3. Re-request review once updated
4. PR will be merged once approved

## Need Help?

- Check existing issues/discussions
- Read documentation in docs/ folder
- Ask in pull request comments
- Contact team leads

Thank you for contributing! 🎉
