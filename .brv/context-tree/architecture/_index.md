---
children_hash: 51a8c033006a2ab81bbd75116da324234bc798cfd9179229bf2acd002f06d220
compression_ratio: 0.8024948024948025
condensation_order: 2
covers: [context.md, system_overview/_index.md]
covers_token_total: 962
summary_level: d2
token_count: 772
type: summary
---
# architecture — Structural Summary (d2)

## Domain Intent and Boundaries
From **`context.md`**, the `architecture` domain is the high-level map of platform structure and design decisions for the financial management system.

- **Purpose:** explain system composition, boundaries, data flow, architecture style, and cross-cutting controls.
- **Included:** components/boundaries, data flow, auth/audit architectural concerns, core stack decisions.
- **Excluded:** team rituals and detailed endpoint payload contracts.
- **Owner:** Engineering.
- **Usage:** entry point before module-level deep dives.

## Consolidated System Shape
Condensing **`system_overview/_index.md`** (which covers `system_overview/context.md`, `documentation_corpus_inventory.md`, `viber_financial_platform_overview.md`):

- **System style:** modular monolith for project **`viber-hethong-qlctnv`**.
- **Primary request path:**  
  `Client page/component -> /api/* route handler -> domain service -> Prisma -> PostgreSQL -> standardized response`
- **API boundary:** Next.js App Router handlers under `src/app/api`, REST-style pattern `^/api/.+`.
- **Code organization:** domain logic in `src/modules`; UI in `src/app` and `src/components`.
- **Contract anchor:** `src/lib/api-spec/openapi.yaml`.
- **Source anchor:** `docs/context.md`.

## Stack and Cross-Cutting Decisions
From **`viber_financial_platform_overview.md`** (via `system_overview/_index.md`):

- **Runtime:** Next.js 16 + React + TypeScript.
- **Data layer:** Prisma ORM with PostgreSQL.
- **Auth/security:** JWT via cookie `budget-app-token` plus bearer-token support; uses `jsonwebtoken` and Node `crypto`.
- **Shared platform utilities:** HTTP/auth/audit helpers in `src/modules/shared`.
- **Authorization:** RBAC through `requireRole` and route-level mappings.

## Business-Control Architecture Patterns
Also preserved from **`viber_financial_platform_overview.md`**:

- Role-gated finance operations.
- Approval sequencing before execution.
- Reversal-based correction model (avoid destructive financial mutation).
- Correlation/idempotency metadata on critical operations.
- Single codebase supports budgeting, approvals, transactions, ledger, reporting, and audit logging.

## Documentation and Relationship Topology
From **`documentation_corpus_inventory.md`** and relationship links in **`system_overview/_index.md`**:

- Architecture topic acts as cross-reference hub into:
  - `domains/core_modules/core_module_responsibilities.md`
  - `operations/deployment_and_environment/runtime_and_delivery.md`
  - `quality/known_issues/current_gaps_and_risks.md`
- Corpus is tied to `docs/` filesystem stability (updates needed on add/rename/remove).
- Noted discrepancy: inventory states **0 curated markdown files** while simultaneously describing broad docs coverage.

## Drill-Down Targets
- Domain framing: **`context.md`**
- Topic condensation: **`system_overview/_index.md`**
- Full architecture details: **`system_overview/viber_financial_platform_overview.md`**
- Documentation map: **`system_overview/documentation_corpus_inventory.md`**