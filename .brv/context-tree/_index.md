---
children_hash: 4a7e4af9f619efb5f280010ca5c113238659fa50c817393e6e961771e33713cb
compression_ratio: 0.45038167938931295
condensation_order: 3
covers: [architecture/_index.md, domains/_index.md, operations/_index.md, quality/_index.md]
covers_token_total: 2882
summary_level: d3
token_count: 1298
type: summary
---
# Context Tree Structural Summary (d3)

## 1) Platform Macro-Architecture (`architecture/_index.md`)
- **System style:** modular monolith for `viber-hethong-qlctnv`.
- **Primary execution path:** `Client page/component -> /api/* route handler -> domain service -> Prisma -> PostgreSQL -> standardized response`.
- **API boundary + contract anchors:**
  - App Router handlers in `src/app/api`
  - REST-style route pattern `^/api/.+`
  - Contract source: `src/lib/api-spec/openapi.yaml`
  - Documentation source anchor: `docs/context.md`
- **Cross-cutting architectural decisions (from `system_overview/viber_financial_platform_overview.md`):**
  - Next.js 16 + React + TypeScript
  - Prisma + PostgreSQL
  - JWT in cookie `budget-app-token` + bearer-token support
  - RBAC via `requireRole` and route-level mapping
  - Financial controls: approval sequencing, reversal-based correction, correlation/idempotency metadata
- **Drill-down entries:** `system_overview/_index.md`, `system_overview/viber_financial_platform_overview.md`, `system_overview/documentation_corpus_inventory.md`.

## 2) Domain Responsibility Graph (`domains/_index.md`)
- **Purpose:** ownership and dependency map for business modules under `src/modules/*`.
- **Core module responsibilities (`core_modules/_index.md`):**
  - `budgeting`: budget lifecycle, controls, transfers
  - `transaction`: orchestration + state transitions + execution effects
  - `approval`: queue + role/step approvals
  - `ledger`: trail queries, reversals, idempotency
  - `security/auth`: auth + access/log support
  - `report`: cross-module aggregation
  - `shared`: common contracts/utilities (HTTP/auth/finance/audit primitives)
- **Key architectural rule:** orchestration belongs in **service layer**, not route handlers, to preserve RBAC consistency and idempotent financial behavior.
- **Dependency pattern:**
  - `transaction -> budgeting/approval/ledger/security/shared/Prisma`
  - `approval -> transaction context/auth/Prisma`
  - `report -> transaction + budgeting + ledger`
  - `shared -> used by all`
- **Drill-down entries:** `core_module_responsibilities.md`, plus service files:
  - `src/modules/budgeting/services/budget-service.ts`
  - `src/modules/transaction/services/transaction-service.ts`
  - `src/modules/approval/services/approval-service.ts`
  - `src/modules/ledger/services/ledger-service.ts`
  - `src/modules/security/services/auth-service.ts`
  - `src/modules/report/services/report-service.ts`

## 3) Runtime and Delivery Plane (`operations/_index.md`)
- **Operational lifecycle:** `Code push -> CI checks/build -> deploy on main -> production rollout via Docker Compose`.
- **Environment topology (`deployment_and_environment/_index.md`):**
  - Local: `npm run dev` or `docker-compose.yml`
  - Production: `docker-compose.prod.yml` + `nginx.conf` (reverse proxy/TLS)
- **Operational control artifacts:**
  - `.github/workflows/ci.yml`
  - `.github/workflows/deploy.yml`
  - `Dockerfile.backend`, `Dockerfile.frontend`
- **Pipeline/security capabilities:** Prisma generate, typecheck, test/build, GHCR publish, Trivy scanning.
- **Config domains:** runtime core, DB, JWT/auth, SMTP, S3-compatible storage, internal auth/contract toggles.
- **Hard dependency rule:** DB + JWT env provisioning are mandatory.
- **External dependencies:** PostgreSQL, SMTP provider, S3-compatible storage, GHCR, Trivy.
- **Drill-down entry:** `deployment_and_environment/runtime_and_delivery.md` (includes concrete values such as local port `3001`).

## 4) Quality and Risk Topology (`quality/_index.md`)
- **Function:** centralized gap/risk registry for remediation prioritization.
- **Risk classes (`known_issues/_index.md`):**
  1. Placeholder surfaces
  2. Type drift
  3. Endpoint duplication
  4. Validation maturity gaps
- **Evidence anchors (`current_gaps_and_risks.md`):**
  - `docs/context.md`
  - `src/lib/api-client.ts`
  - `src/app/api/_store.ts`
- **Current key risks:**
  - Placeholder AI assistant and in-progress transactions/approvals UIs
  - Duplicate health endpoints: `/api/health` and `/api/healthz`
  - Mostly manual/imperative validation (not schema-first)
  - Numeric-oriented API client typing vs UUID-oriented domain models
  - Legacy `_store` artifacts causing ownership ambiguity
- **Remediation order:** unify type model -> consolidate health contract -> replace placeholders -> standardize schema-first validation.
- **Drill-down entries:** `known_issues/_index.md`, `known_issues/current_gaps_and_risks.md`.

## 5) Cross-Entry Relationship Pattern
- `architecture/_index.md` defines the **system contract and control model**.
- `domains/_index.md` maps **who owns what** and **service dependency directions**.
- `operations/_index.md` defines **how the system is built/released/run securely**.
- `quality/_index.md` tracks **where architecture/domain/ops drift from target state** and sets remediation priority.
- Shared cross-links explicitly connect:
  - `architecture/system_overview/viber_financial_platform_overview.md`
  - `domains/core_modules/core_module_responsibilities.md`
  - `operations/deployment_and_environment/runtime_and_delivery.md`
  - `quality/known_issues/current_gaps_and_risks.md`