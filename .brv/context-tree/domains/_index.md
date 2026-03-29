---
children_hash: b0b231c5cd4abc7277f031d14024e0ae1ca2a2088d64c62eed53500ac92e5ece
compression_ratio: 0.8281829419035847
condensation_order: 2
covers: [context.md, core_modules/_index.md]
covers_token_total: 809
summary_level: d2
token_count: 670
type: summary
---
## Domain `domains` (d2 Structural Summary)

### Purpose, Boundaries, Ownership
From **`context.md`**, this domain captures business-module ownership and cross-domain service dependencies so feature/incident routing can map quickly to responsible modules.

- **Included:** module responsibilities, service-level dependencies, business workflow boundaries  
- **Excluded:** low-level UI styling concerns  
- **Ownership:** Backend + Platform Engineering  
- **Usage intent:** operational map from request/incident → owning module

### Topic: `core_modules` Consolidation
From **`core_modules/_index.md`** (covering `core_modules/context.md` + `core_module_responsibilities.md`), the platform is organized by explicit domain services under `src/modules/*`:

- **budgeting**: budget CRUD, status/history, hard-stop controls, transfers  
- **transaction**: lifecycle orchestration, state transitions, approval-linked execution effects  
- **approval**: queue listing, role/step-based approval actions  
- **ledger**: accounting trail queries, reversal generation, idempotency handling  
- **security/auth**: authentication and access/log support  
- **report**: aggregation across transaction, budget, ledger datasets  
- **shared**: reusable contracts/utilities (HTTP envelopes, auth helpers, finance/audit primitives)

### Architectural Decisions and Coupling Pattern
Key decision (from **`core_module_responsibilities.md`**): orchestration remains in **service layer**, not route handlers, to preserve RBAC consistency, idempotency, and extensibility for financial workflows.

High-level dependency relationships:
- **transaction →** budgeting, approval, ledger, security/shared auth, Prisma  
- **approval →** transaction context, auth, Prisma  
- **report →** transaction + budgeting + ledger data  
- **shared →** cross-cutting dependency for all modules

### End-to-End Business Flow Mapping
Primary capability chain (documented in **`core_modules/_index.md`**):
**Transaction creation → role-based approvals → execution → ledger posting/reporting → audit logging**.

### Drill-Down Entry Map
- Domain boundary/intent: **`context.md`**  
- Module responsibilities + dependencies: **`core_module_responsibilities.md`**  
- Related system-level context: `architecture/system_overview/viber_financial_platform_overview.md`  
- Service implementations:
  - `src/modules/budgeting/services/budget-service.ts`
  - `src/modules/transaction/services/transaction-service.ts`
  - `src/modules/approval/services/approval-service.ts`
  - `src/modules/ledger/services/ledger-service.ts`
  - `src/modules/security/services/auth-service.ts`
  - `src/modules/report/services/report-service.ts`