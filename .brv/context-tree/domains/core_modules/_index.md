---
children_hash: 3a26bf5719167b99282ce78bb913051d6efe3b29eb7098fa37bd4e899f7fb481
compression_ratio: 0.9384384384384384
condensation_order: 1
covers: [context.md, core_module_responsibilities.md]
covers_token_total: 666
summary_level: d1
token_count: 625
type: summary
---
## Core Modules (d1 Structural Summary)

Based on **`context.md`** and **`core_module_responsibilities.md`**, this topic defines the platform’s domain-module architecture and coupling model across `src/modules/*`.

### Scope and Module Responsibilities
- **budgeting**: budget CRUD, status/history, hard-stop controls, transfer operations.  
- **transaction**: transaction lifecycle orchestration and state transitions, including approval-linked execution effects.  
- **approval**: approval queue listing and role/step-based action processing.  
- **ledger**: accounting trail queries plus reversal generation with idempotency controls.  
- **security/auth**: authentication and user/log access support.  
- **report**: aggregation/reporting over transaction, budget, and ledger data.  
- **shared**: common contracts/utilities (HTTP envelopes, auth helpers, finance/audit primitives) reused by all modules.

### Architectural Pattern
- Domain logic is split into explicit modules under `src/modules`, each exposing services used by route handlers (see **`core_module_responsibilities.md`**).
- Key design decision: orchestration remains in **service layer code**, not route handlers, to support RBAC consistency, idempotency, and extensibility for future financial workflows.

### Dependency Graph (High-Level)
- **transaction** depends on: budgeting, approval, ledger, security/shared auth, Prisma.
- **approval** depends on: transaction context, auth, Prisma.
- **report** depends on: transaction + budgeting + ledger datasets.
- **shared** is a cross-cutting dependency used by all modules.

### End-to-End Process Relationship
- Primary flow: **Transaction creation → role-based approval steps → execution → ledger entries/reporting → audit logging**.
- This flow expresses how business capabilities map to modules and how execution side effects propagate into accounting and reporting.

### Source/Drill-Down Pointers
- Concept index: **`context.md`**
- Full responsibility/dependency detail: **`core_module_responsibilities.md`**
- Referenced implementation files:
  - `src/modules/budgeting/services/budget-service.ts`
  - `src/modules/transaction/services/transaction-service.ts`
  - `src/modules/approval/services/approval-service.ts`
  - `src/modules/ledger/services/ledger-service.ts`
  - `src/modules/security/services/auth-service.ts`
  - `src/modules/report/services/report-service.ts`
- Related architecture context: `architecture/system_overview/viber_financial_platform_overview.md`