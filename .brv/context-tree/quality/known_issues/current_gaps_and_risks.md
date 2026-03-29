---
title: Current Gaps And Risks
tags: []
related: [architecture/system_overview/viber_financial_platform_overview.md, domains/core_modules/core_module_responsibilities.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-03-27T10:45:59.955Z'
updatedAt: '2026-03-27T10:45:59.955Z'
---
## Raw Concept
**Task:**
Preserve known issues and technical risks explicitly listed in project context

**Changes:**
- Captured placeholder and incomplete areas
- Captured model typing mismatch risk
- Captured route and architecture overlap concerns

**Files:**
- docs/context.md
- src/lib/api-client.ts
- src/app/api/_store.ts

**Flow:**
Known issue identified -> risk logged -> remediation planned -> implementation hardening

**Timestamp:** 2026-03-27

## Narrative
### Structure
The current gap profile includes placeholder capability surfaces, potential legacy remnants, and consistency risks between client types and domain schema. A notable concern is type drift where API client typing remains numeric-oriented while domain/data models are UUID-oriented. There is also overlap in reporting surface and duplicate health endpoints that may create maintenance noise.

### Dependencies
Risk mitigation depends on coordinated updates across API contracts, UI pages, service validation strategy, and module ownership decisions. Addressing validation quality likely requires broader Zod/schema-first adoption paths in services and route handlers.

### Highlights
Key immediate risks include incomplete workflow UIs, legacy artifacts (such as _store), and inconsistent endpoint surfaces. Consolidating health checks and aligning typing models would reduce regression potential and simplify future integrations.

## Facts
- **ai_feature_status**: AI assistant API/page are currently scaffold placeholders [project]
- **workflow_ui_status**: Transactions and approvals UI pages are in-progress placeholders [project]
- **duplicate_health_endpoints**: Duplicate health endpoints exist: /api/health and /api/healthz [project]
- **validation_approach**: Validation is mostly imperative/manual instead of schema-first runtime validation [project]
