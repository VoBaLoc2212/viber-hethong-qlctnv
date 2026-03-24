# API Documentation - Budget Management System

## Base URL

```
Development:  http://localhost:3000/api
Production:   https://api.yourdomain.com/api
```

## Authentication

Currently, the API uses basic authentication. Future versions will support JWT tokens.

---

## Endpoints

### Health Check

#### GET /health
Check if the API is running.

**Request:**
```bash
curl http://localhost:3000/api/health
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-03-24T10:30:00Z",
  "database": "connected"
}
```

---

### Departments

#### GET /departments
Get all departments.

**Request:**
```bash
curl http://localhost:3000/api/departments
```

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "Marketing",
    "code": "MKT",
    "budgetAllocated": "500000000",
    "createdAt": "2026-03-24T00:00:00Z"
  },
  {
    "id": 2,
    "name": "Operations",
    "code": "OPS",
    "budgetAllocated": "300000000",
    "createdAt": "2026-03-24T00:00:00Z"
  }
]
```

#### GET /departments/:id
Get a specific department.

**Request:**
```bash
curl http://localhost:3000/api/departments/1
```

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "Marketing",
  "code": "MKT",
  "budgetAllocated": "500000000",
  "createdAt": "2026-03-24T00:00:00Z"
}
```

#### POST /departments
Create a new department.

**Request:**
```bash
curl -X POST http://localhost:3000/api/departments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sales",
    "code": "SALES",
    "budgetAllocated": "250000000"
  }'
```

**Response (201 Created):**
```json
{
  "id": 6,
  "name": "Sales",
  "code": "SALES",
  "budgetAllocated": "250000000",
  "createdAt": "2026-03-24T10:30:00Z"
}
```

#### PUT /departments/:id
Update a department.

**Request:**
```bash
curl -X PUT http://localhost:3000/api/departments/1 \
  -H "Content-Type: application/json" \
  -d '{
    "budgetAllocated": "600000000"
  }'
```

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "Marketing",
  "code": "MKT",
  "budgetAllocated": "600000000",
  "updatedAt": "2026-03-24T10:30:00Z"
}
```

---

### Transactions

#### GET /transactions
Get all transactions with optional filters.

**Query Parameters:**
- `departmentId` - Filter by department
- `status` - Filter by status (PENDING, APPROVED, REJECTED, COMPLETED)
- `type` - Filter by type (INCOME, EXPENSE)
- `startDate` - Filter from date (ISO 8601)
- `endDate` - Filter to date (ISO 8601)
- `limit` - Results per page (default: 20)
- `offset` - Pagination offset (default: 0)

**Request:**
```bash
curl "http://localhost:3000/api/transactions?status=APPROVED&type=EXPENSE&limit=10"
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "transactionCode": "CHI-2026-001",
      "type": "EXPENSE",
      "amount": "5000000",
      "categoryId": 1,
      "departmentId": 1,
      "date": "2026-03-20T00:00:00Z",
      "description": "Office supplies purchase",
      "status": "COMPLETED",
      "createdAt": "2026-03-20T10:00:00Z"
    }
  ],
  "total": 42,
  "limit": 10,
  "offset": 0
}
```

#### GET /transactions/:id
Get a specific transaction.

**Request:**
```bash
curl http://localhost:3000/api/transactions/1
```

**Response (200 OK):**
```json
{
  "id": 1,
  "transactionCode": "CHI-2026-001",
  "type": "EXPENSE",
  "amount": "5000000",
  "categoryId": 1,
  "departmentId": 1,
  "date": "2026-03-20T00:00:00Z",
  "description": "Office supplies purchase",
  "status": "COMPLETED",
  "attachmentUrl": "https://example.com/receipt.jpg",
  "notes": "Received and verified",
  "createdAt": "2026-03-20T10:00:00Z"
}
```

#### POST /transactions
Create a new transaction.

**Request:**
```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "type": "EXPENSE",
    "amount": "3500000",
    "categoryId": 2,
    "departmentId": 1,
    "date": "2026-03-24T10:00:00Z",
    "description": "Monthly office rent"
  }'
```

**Response (201 Created):**
```json
{
  "id": 43,
  "transactionCode": "CHI-2026-043",
  "type": "EXPENSE",
  "amount": "3500000",
  "categoryId": 2,
  "departmentId": 1,
  "date": "2026-03-24T10:00:00Z",
  "description": "Monthly office rent",
  "status": "PENDING",
  "createdAt": "2026-03-24T10:30:00Z"
}
```

#### PUT /transactions/:id
Update a transaction (only if PENDING).

**Request:**
```bash
curl -X PUT http://localhost:3000/api/transactions/1 \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated description",
    "amount": "5500000"
  }'
```

**Response (200 OK):**
```json
{
  "id": 1,
  "transactionCode": "CHI-2026-001",
  "type": "EXPENSE",
  "amount": "5500000",
  "description": "Updated description",
  "status": "PENDING",
  "updatedAt": "2026-03-24T10:30:00Z"
}
```

---

### Dashboard

#### GET /dashboard/summary
Get financial summary.

**Request:**
```bash
curl http://localhost:3000/api/dashboard/summary
```

**Response (200 OK):**
```json
{
  "totalBudgetAllocated": "1250000000",
  "totalBudgetUsed": "450000000",
  "totalBudgetAvailable": "800000000",
  "totalIncome": "100000000",
  "totalExpense": "450000000",
  "utilizationPercentage": 36.0,
  "departmentCount": 5,
  "transactionCount": 127,
  "pendingApprovals": 12
}
```

#### GET /dashboard/budget-status
Get budget status by department (includes reserved budgets).

**Request:**
```bash
curl http://localhost:3000/api/dashboard/budget-status
```

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "departmentName": "Marketing",
    "code": "MKT",
    "budgetAllocated": "500000000",
    "amountSpent": "180000000",
    "amountReserved": "50000000",
    "amountAvailable": "270000000",
    "utilizationPercentage": 36.0
  },
  {
    "id": 2,
    "departmentName": "Operations",
    "code": "OPS",
    "budgetAllocated": "300000000",
    "amountSpent": "150000000",
    "amountReserved": "30000000",
    "amountAvailable": "120000000",
    "utilizationPercentage": 50.0
  }
]
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "Invalid input data",
  "details": {
    "amount": "Must be a positive number"
  }
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "You do not have permission to perform this action"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Resource not found",
  "id": 999
}
```

### 409 Conflict
```json
{
  "error": "Conflict",
  "message": "Budget allocation already exists for this period"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred",
  "requestId": "abc123xyz"
}
```

---

## Data Types

### Transaction Status
- `PENDING` - Submitted but not yet approved
- `APPROVED` - Approved by manager, awaiting payment
- `REJECTED` - Rejected during approval
- `COMPLETED` - Transaction completed

### Transaction Type
- `INCOME` - Money received
- `EXPENSE` - Money spent

### Amounts
All monetary amounts are represented as strings with 2 decimal places (Vietnamese Dong):
- `"500000000"` = 500,000,000 VND
- `"5000000.50"` = 5,000,000.50 VND

### Timestamps
All timestamps use ISO 8601 format:
- `"2026-03-24T10:30:00Z"` - UTC timezone

---

## Rate Limiting

Currently no rate limiting is applied. Future versions may include:
- 100 requests per minute per IP
- 1000 requests per day per user

---

## CORS

CORS is enabled for all origins in development. In production, configure allowed origins in environment variables.

---

## Testing with cURL

### Test Health
```bash
curl -i http://localhost:3000/api/health
```

### Get all departments and save to file
```bash
curl -s http://localhost:3000/api/departments | jq '.' > departments.json
```

### Create transaction and parse response
```bash
curl -s -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"type":"EXPENSE","amount":"1000000","departmentId":1,"date":"2026-03-24T00:00:00Z"}' \
  | jq '.id'
```

### Pretty print response
```bash
curl -s http://localhost:3000/api/departments | jq '.'
```

---

## API Client

For frontend development, use the generated API client:

```typescript
import { api } from "@workspace/api-client-react";

// Get departments
const departments = await api.getDepartments();

// Create transaction
const transaction = await api.createTransaction({
  type: "EXPENSE",
  amount: "5000000",
  departmentId: 1,
  date: new Date(),
});

// Get dashboard summary
const summary = await api.getDashboardSummary();
```

See `lib/api-client-react/` for generated types and functions.

---

## OpenAPI Specification

Full OpenAPI specification available at:
- File: `lib/api-spec/openapi.yaml`
- View in swagger editor: [Swagger Editor](https://editor.swagger.io/)

To view:
1. Go to https://editor.swagger.io/
2. File → Import File
3. Select `lib/api-spec/openapi.yaml`

---

## Changelog

### v0.0.1 (Current)
- ✅ Department management
- ✅ Transaction tracking
- ✅ Basic approval workflow
- ✅ Dashboard summary
- 📋 Authentication (planned)
- 📋 Advanced reports (planned)

