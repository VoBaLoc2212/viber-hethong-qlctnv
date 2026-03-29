---
children_hash: 271f4998c648b88fbf1835f8df12a0bc6ce94ce32ff3da76634cbc9c00552c8e
compression_ratio: 0.4633228840125392
condensation_order: 1
covers: [context.md, documentation_corpus_inventory.md, source_root_path.md, viber_financial_platform_overview.md]
covers_token_total: 1595
summary_level: d1
token_count: 739
type: summary
---
# System Overview (d1 Structural Summary)

## Scope and Positioning
`context.md` defines **system_overview** as the platform’s end-to-end architecture lens: stack, layers, data flow, auth/security posture, and audit semantics.  
Primary related areas: `operations/deployment_and_environment`, `domains/core_modules`, `quality/known_issues`.

## Child Entry Map (for drill-down)
- `viber_financial_platform_overview.md` — canonical architecture summary (layers, flow, constraints, tech stack).
- `documentation_corpus_inventory.md` — index of `docs/` corpus and documentation coverage metadata.
- `source_root_path.md` — trace note recording `src/` as source root from curation input.
- `context.md` — topic-level framing and key concepts.

## Core Architecture (from `viber_financial_platform_overview.md`)
- **Project**: `viber-hethong-qlctnv`
- **Architecture style**: **modular monolith**
- **Primary framework**: **Next.js 16 (App Router)** + React + TypeScript
- **Data layer**: **Prisma ORM + PostgreSQL**
- **Contract artifact**: `src/lib/api-spec/openapi.yaml`
- **Source reference**: `docs/context.md`
- **Endpoint pattern**: `^/api/.+` (Next.js route handlers under `src/app/api`)

### Layering and Flow
- UI/pages: `src/app`
- Reusable UI: `src/components`
- Domain modules: `src/modules/*`
- API handling: `src/app/api/*`
- Data persistence: Prisma → PostgreSQL
- Standard execution flow:
  **Client page/component → `/api/*` route handler → domain service → Prisma → PostgreSQL → standardized response**

## Cross-Cutting Design Decisions
(from `viber_financial_platform_overview.md`)
- JWT auth with `budget-app-token` cookie + Bearer token support.
- RBAC via `requireRole` and route-level mappings.
- Immutable-style financial/audit behavior through **reversal patterns** (no destructive mutation).
- Audit integrity via hash chaining and shared HTTP/auth/audit utilities (`src/modules/shared`).
- Operational rules preserved:
  - Role-gated actions by finance hierarchy
  - Approval sequencing before execution
  - Reversal-based ledger/audit semantics
  - Correlation/idempotency metadata on critical operations

## Documentation and Traceability Notes
- `documentation_corpus_inventory.md` states docs root is `docs/` and lists coverage domains (architecture, business flow, API contract, security, coding standards).
- Same entry currently records `docs_markdown_count: 0` (inventory snapshot metadata should be treated as time-bound and refresh-dependent).
- `source_root_path.md` captures minimal but explicit source-root fact: **`src/`** (timestamped 2026-03-27).

## Relationship Graph (high-level)
- `context.md` (topic frame) is elaborated by `viber_financial_platform_overview.md` (architecture substance).
- `documentation_corpus_inventory.md` acts as a source-index dependency for architecture and governance topics.
- `source_root_path.md` is a lightweight traceability pointer feeding future enrichment of `system_overview`.