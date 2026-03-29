---
title: Viber Financial Platform Overview
tags: []
related: [domains/core_modules/core_module_responsibilities.md, operations/deployment_and_environment/runtime_and_delivery.md, quality/known_issues/current_gaps_and_risks.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-03-27T10:45:59.911Z'
updatedAt: '2026-03-27T10:45:59.911Z'
---
## Raw Concept
**Task:**
Document platform-level architecture, major layers, and cross-cutting design constraints

**Changes:**
- Captured high-level component map from docs/context.md
- Captured API-to-service-to-database data flow
- Captured cross-cutting security and audit semantics

**Files:**
- docs/context.md
- src/lib/api-spec/openapi.yaml

**Flow:**
Client page/component -> /api/* route handler -> domain service -> Prisma -> PostgreSQL -> standardized response

**Timestamp:** 2026-03-27

**Patterns:**
- `^/api/.+` - REST-style Next.js route handler endpoint pattern

## Narrative
### Structure
The system is organized as a modular monolith where UI routing lives in src/app and reusable UI in src/components, while domain logic is separated into feature modules under src/modules. API access is exposed through Next.js route handlers in src/app/api and delegated to domain services. Persistence is centralized through Prisma over PostgreSQL with contract artifacts in src/lib/api-spec/openapi.yaml.

### Dependencies
Core runtime depends on Next.js, React, TypeScript, Prisma, and PostgreSQL. Cross-cutting dependencies include jsonwebtoken and Node crypto for auth and internal signed log flows, plus shared HTTP/auth/audit utilities under src/modules/shared.

### Highlights
As of 2026-03-27, the platform supports budgeting, approvals, transactions, ledger, reporting, and audit logging in one codebase. RBAC is enforced via requireRole and route-level mappings, and immutable-style behavior is applied through reversal patterns and audit hash chaining.

### Rules
Role-gated actions by finance hierarchy.
Approval step sequencing before execution.
Immutable-style audit/ledger semantics (reversal, not destructive mutation).
Correlation/idempotency metadata for critical operations.

### Examples
Example endpoints include /api/auth/login, /api/budgets/{id}/transfer, /api/approvals/{id}/action, /api/ledger/{id}/reversal, and /api/reports.

## Facts
- **project_name**: Project name is viber-hethong-qlctnv [project]
- **architecture_style**: Architecture style is modular monolith [project]
- **frontend_backend_framework**: Primary framework is Next.js 16 with App Router [project]
- **database_stack**: Database is PostgreSQL accessed through Prisma ORM [project]
- **authentication_mode**: Auth uses JWT with budget-app-token cookie and bearer token support [project]
