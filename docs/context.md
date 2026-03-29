# Project Overview

* Name: viber-hethong-qlctnv
* Purpose: Internal financial management system for budgeting, approvals, transactions, ledger, reporting, and audit logging.
* Tech Stack: Next.js 16 (App Router), React 19, TypeScript, Prisma, PostgreSQL, Tailwind CSS v4, Radix UI, React Query, Zod, Vitest.
* Architecture Style: Modular monolith (feature modules in `src/modules`) with Next.js route-handler API layer (`src/app/api`).

# System Architecture

* High-level components:
  * UI + routing: `src/app`, `src/components`
  * API handlers: `src/app/api/**/route.ts`
  * Domain services: `src/modules/{budgeting,transaction,approval,ledger,security,report,shared}`
  * Data layer: Prisma client/schema/migrations in `src/lib/db/prisma`
  * Contract layer: OpenAPI spec in `src/lib/api-spec/openapi.yaml`
* Data flow:
  * Client page/component -> `/api/*` route handler -> domain service -> Prisma -> PostgreSQL -> standardized response.
  * Security/audit cross-cutting: auth context + role checks + append-only audit log chain.
* Key design patterns:
  * Service-layer business orchestration.
  * Repository/contract separation inside modules.
  * Shared HTTP response/error utilities.
  * RBAC via role-gated service methods (`requireRole`).
  * Idempotency-key enforcement for transfer/reversal operations.

# Folder Structure

* `src/app`: Next.js App Router pages, layouts, providers, and API route handlers.
* `src/components`: Reusable UI system and feature workspaces.
* `src/modules`: Core business domains (budgeting, transaction, approval, ledger, security, report, shared).
* `src/lib`: Infrastructure/utilities (Prisma client, auth helpers, API types/client, OpenAPI spec, storage config).
* `src/hooks`: Frontend hooks.
* `docs`: Architecture, domain, API contract, testing/security guidance.
* `.github/workflows`: CI pipeline and deploy automation.
* `docker-compose.yml`, `docker-compose.prod.yml`, `Dockerfile.*`, `nginx.conf`: local/prod container orchestration and reverse proxy.

# Core Modules

* Name: budgeting
  * Responsibility: Budget CRUD, status/history, hard-stop control checks, budget transfers.
  * Key files: `src/modules/budgeting/services/budget-service.ts`, `src/app/api/budgets/**/route.ts`, `src/app/api/controls/hard-stop/route.ts`
  * Dependencies: `shared`, Prisma, ledger interactions, audit logging.
* Name: transaction
  * Responsibility: Transaction lifecycle (create/list/get/update), approval state transitions, execution effects.
  * Key files: `src/modules/transaction/services/transaction-service.ts`, `src/app/api/transactions/**/route.ts`
  * Dependencies: budgeting, approval, ledger, security/shared auth, Prisma.
* Name: approval
  * Responsibility: Approval queue creation/listing/action processing by role and step.
  * Key files: `src/modules/approval/services/approval-service.ts`, `src/app/api/approvals/**/route.ts`
  * Dependencies: transaction, shared auth, Prisma.
* Name: ledger
  * Responsibility: Ledger entry querying and reversal generation with idempotency.
  * Key files: `src/modules/ledger/services/ledger-service.ts`, `src/app/api/ledger/**/route.ts`
  * Dependencies: shared finance utilities, transaction context, Prisma.
* Name: security
  * Responsibility: Authentication, user administration, immutable logging access.
  * Key files: `src/modules/security/services/{auth-service.ts,user-service.ts,log-service.ts}`, `src/app/api/auth/**/route.ts`, `src/app/api/users/**/route.ts`, `src/app/api/logs/**/route.ts`
  * Dependencies: shared auth/password/JWT, RBAC, audit, Prisma.
* Name: report
  * Responsibility: Report aggregation endpoints and reporting domain logic.
  * Key files: `src/modules/report/services/report-service.ts`, `src/app/api/reports/route.ts`
  * Dependencies: transaction/budget/ledger data via Prisma.
* Name: shared
  * Responsibility: Cross-cutting contracts, auth helpers, HTTP helpers, finance/audit utilities.
  * Key files: `src/modules/shared/{auth,http,finance,audit,contracts}/**`
  * Dependencies: jsonwebtoken, Node crypto, Prisma.

# Database

* DB type: PostgreSQL.
* ORM: Prisma.
* Main entities:
  * `User`, `Department`, `Budget`, `Transaction`, `Approval`, `LedgerEntry`, `BudgetTransfer`, `CashbookAccount`, `CashbookPosting`, `TransactionAttachment`, `TransactionSplit`, `BudgetControlPolicy`, `AuditLog`, `InternalLogNonce`, `RecurringTransaction`, `Reimbursement`.
* Relationships:
  * `Department` 1-N `Budget`, `Transaction`.
  * `Budget` self-hierarchy via parent/child budgets.
  * `Budget` 1-N `Transaction`.
  * `Transaction` 1-N `Approval`, `TransactionAttachment`, `TransactionSplit`.
  * `User` 1-N `Transaction` (creator) and 1-N `Approval` (approver).
  * `LedgerEntry` self-relation for reversal chains.
  * `BudgetTransfer` links from/to budgets.
  * `AuditLog` N-1 `User`.
* Important fields:
  * Identifiers: UUID-oriented IDs in Prisma schema.
  * Security: user role enum, password hash, `isActive`.
  * Workflow: transaction status/type, approval step/status.
  * Integrity: ledger reversal references, audit `prevHash`/`entryHash`, internal nonce/timestamp fields.

# API Layer

* API style (REST/GraphQL/etc): REST-style Next.js route handlers.
* Main endpoints:
  * Auth: `/api/auth/login`, `/api/auth/logout`, `/api/auth/register`, `/api/auth/me`
  * Users: `/api/users`, `/api/users/{id}`
  * Budgets: `/api/budgets`, `/api/budgets/{id}`, `/api/budgets/{id}/status`, `/api/budgets/{id}/history`, `/api/budgets/{id}/transfer`
  * Controls: `/api/controls/hard-stop`
  * Transactions: `/api/transactions`, `/api/transactions/{id}`
  * Approvals: `/api/approvals`, `/api/approvals/{id}/action`
  * Ledger: `/api/ledger`, `/api/ledger/{id}/reversal`
  * Logs: `/api/logs`, `/api/logs/immutable`, `/api/internal/logs/immutable`
  * Reports/Dashboard: `/api/reports`, `/api/dashboard/kpis`, `/api/dashboard/expenses-by-month`
  * Health: `/api/health`, `/api/healthz`
* Auth mechanism: JWT-based auth with bearer token/cookie extraction; session cookie `budget-app-token`.
* Validation:
  * Request body parsing and manual field checks in services/routes.
  * Shared request helpers enforce JSON and typed extraction.
  * Standardized success/error envelope via `src/modules/shared/http/{response.ts,error-handler.ts}`.

# Authentication & Authorization

* Strategy:
  * JWT token generation/verification.
  * HttpOnly auth cookie (`budget-app-token`) + bearer token support.
  * Optional internal-service HMAC auth for internal immutable log endpoint.
* Flow:
  * Login -> credential verify -> JWT issue -> cookie set -> subsequent request auth context extraction -> active-user check.
  * Middleware redirects unauthenticated app routes to `/auth`.
* Roles:
  * `EMPLOYEE`, `MANAGER`, `ACCOUNTANT`, `FINANCE_ADMIN`, `AUDITOR`.
* Permissions:
  * Service-level role enforcement using `requireRole`.
  * Route-level role maps defined in `src/lib/auth/rbac.ts`.

# Business Logic

* Core workflows:
  * Budget lifecycle: create/update/delete, status/history, hard-stop budget control.
  * Expense workflow: transaction creation -> manager/accountant approval steps -> execution.
  * Budget transfer workflow: role-gated transfer + ledger impact with idempotency key.
  * Ledger workflow: append entries, list/filter, generate reversal entries.
  * Reporting workflow: KPI, period and department-based aggregations.
  * Security workflow: auth events + immutable audit logging.
* Rules:
  * Role-gated actions by finance hierarchy.
  * Approval step sequencing before execution.
  * Immutable-style audit/ledger semantics (reversal, not destructive mutation).
  * Correlation/idempotency metadata for critical operations.
* Edge cases:
  * Replay protection for internal signed logging (nonce + timestamp skew checks).
  * Duplicate request handling for transfer/reversal via idempotency headers.
  * User inactive state blocks auth context usage.

# Environment & Config

* Important env variables:
  * Core: `NODE_ENV`, `APP_NAME`, `APP_ENV`, `PORT`, `LOG_LEVEL`, `NEXT_PUBLIC_API_URL`
  * Database: `DATABASE_URL`, `PRISMA_DATABASE_URL`
  * Auth: `JWT_SECRET`, `JWT_EXPIRES_IN`
  * Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SENDER_EMAIL`
  * Storage: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
  * Contracts/Internal: `OPENAPI_PATH`, `INTERNAL_LOG_SECRET`, `ALLOW_LEGACY_IMMUTABLE_LOG_ENDPOINT`
* External services:
  * PostgreSQL
  * GHCR (container image registry in CI)
  * Trivy (security scan in CI)
  * SMTP provider (configured)
  * S3-compatible object storage (configured)

# Dev & Deployment

* How to run:
  * Local app: `npm run dev` (Next.js on port 3001 by script).
  * Containerized local stack: `docker-compose up` / `make dev`.
  * DB lifecycle: Prisma generate/migrate/seed scripts.
* Build process:
  * `npm run typecheck` -> `next build`.
  * CI runs install, Prisma generate, typecheck, lint (if present), tests (if present), build.
* Deployment method:
  * GitHub Actions deploy workflow on `main` after CI success.
  * Production stack uses Docker Compose + Nginx reverse proxy/TLS.

# Known Issues / Notes

* AI assistant capability is scaffold/placeholder (`/api/ai`, `ai-assistant` page).
* Transactions and Approvals UI pages are placeholder/in-progress states.
* Type drift risk: `src/lib/api-client.ts` uses numeric-oriented legacy typing while Prisma/domain model is UUID-oriented.
* Reporting logic surface overlaps between report module and dashboard-specific endpoints.
* `src/app/api/_store.ts` appears legacy/likely unused.
* Duplicate health endpoints exist (`/api/health` and `/api/healthz`).
* Validation is mostly imperative/manual in services/routes; schema-first runtime validation is limited.
