---
title: Core Module Responsibilities
tags: []
related: [architecture/system_overview/viber_financial_platform_overview.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-03-27T10:45:59.948Z'
updatedAt: '2026-03-27T10:45:59.948Z'
---
## Raw Concept
**Task:**
Record module-level responsibilities and inter-module dependencies

**Files:**
- docs/context.md
- src/modules/budgeting/services/budget-service.ts
- src/modules/transaction/services/transaction-service.ts
- src/modules/approval/services/approval-service.ts
- src/modules/ledger/services/ledger-service.ts
- src/modules/security/services/auth-service.ts
- src/modules/report/services/report-service.ts

**Flow:**
Transaction creation -> approval steps by role -> execution -> ledger entries/reporting -> audit logging

**Timestamp:** 2026-03-27

## Narrative
### Structure
The platform splits domain logic into explicit modules in src/modules, with each module exposing services consumed by route handlers. budgeting governs budget control and transfer operations; transaction drives lifecycle and state transitions; approval manages approval queues and action processing. ledger enforces accounting trail behavior, security covers authentication and user/log access, report provides aggregation endpoints, and shared centralizes common contracts/utilities.

### Dependencies
transaction depends on budgeting, approval, ledger, security/shared auth, and Prisma. approval depends on transaction context plus auth and Prisma; report relies on transaction/budget/ledger datasets. shared utilities are reused by all modules for HTTP envelopes, auth helpers, and finance/audit primitives.

### Highlights
Module boundaries align with business capabilities and keep orchestration in service layer code rather than route handlers. This separation supports cleaner RBAC checks, idempotency handling, and extensibility for additional financial workflows.

## Facts
- **budgeting_scope**: Budgeting module manages budget CRUD, status/history, hard-stop controls, and transfers [project]
- **transaction_scope**: Transaction module orchestrates transaction lifecycle and approval-linked execution effects [project]
- **approval_scope**: Approval module handles queue listing and role/step based actions [project]
- **ledger_scope**: Ledger module supports querying and reversal generation with idempotency [project]
