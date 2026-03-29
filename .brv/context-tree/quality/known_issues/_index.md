---
children_hash: a0b46fc99c839cb590296d1d5dddfd585e01b9f4bbf4656aa16b895037bfd75c
compression_ratio: 0.8758389261744967
condensation_order: 1
covers: [context.md, current_gaps_and_risks.md]
covers_token_total: 596
summary_level: d1
token_count: 522
type: summary
---
## known_issues (from `context.md`)

This topic captures remediation-priority risks across the codebase, centered on four patterns: **placeholder features**, **type drift**, **endpoint duplication**, and **validation maturity**. It is intended as a planning surface: issue identified → risk logged → remediation planned → hardening.

## Structural Summary of Child Entries

### `current_gaps_and_risks.md` (draft)
- **Scope preserved from source files**
  - `docs/context.md`
  - `src/lib/api-client.ts`
  - `src/app/api/_store.ts`
- **Primary architectural risks**
  - **Scaffolded/incomplete feature surfaces** in AI assistant and workflow UIs.
  - **Type-system inconsistency**: API client typing remains numeric-oriented while domain/data models are UUID-oriented (type drift risk).
  - **Route/endpoint overlap**: duplicate health checks at `/api/health` and `/api/healthz`.
  - **Legacy artifact exposure** (notably `_store`) increasing maintenance ambiguity.
  - **Validation gap**: mostly imperative/manual validation rather than schema-first runtime validation (e.g., stronger Zod-style enforcement).
- **Dependency relationships**
  - Mitigation requires coordinated changes across API contracts, UI routes/pages, service validation strategy, and module ownership boundaries.
- **Related drill-down links**
  - `architecture/system_overview/viber_financial_platform_overview.md`
  - `domains/core_modules/core_module_responsibilities.md`

## Key Facts to Retain
- AI assistant API/page are currently placeholders.
- Transactions and approvals UIs are in-progress placeholders.
- Duplicate health endpoints exist: `/api/health` and `/api/healthz`.
- Validation is predominantly manual/imperative, not schema-first.

## Recommended remediation focus (derived structure)
1. Align client/domain typing model (numeric vs UUID) to reduce integration regressions.
2. Consolidate health endpoint surface to one contract.
3. Replace placeholder workflow/AI surfaces with complete implementations.
4. Move validation toward consistent schema-first runtime checks across handlers/services.