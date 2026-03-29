---
title: Runtime And Delivery
tags: []
related: [architecture/system_overview/viber_financial_platform_overview.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-03-27T10:45:59.952Z'
updatedAt: '2026-03-27T10:45:59.952Z'
---
## Raw Concept
**Task:**
Document runtime configuration and deployment workflow

**Changes:**
- Captured required env variable groups
- Captured dev/build/deploy flow
- Captured external service dependencies and CI security scanning

**Files:**
- docs/context.md
- .github/workflows/ci.yml
- .github/workflows/deploy.yml
- docker-compose.yml
- docker-compose.prod.yml
- Dockerfile.backend
- Dockerfile.frontend
- nginx.conf

**Flow:**
Code push -> CI checks/build -> deploy workflow on main -> production compose stack rollout

**Timestamp:** 2026-03-27

## Narrative
### Structure
Environment configuration spans core runtime settings, database, authentication, email, object storage, and internal contract/auth toggles. Local development can run directly with npm scripts or via docker-compose, while production uses compose and Nginx as reverse proxy. CI/CD is defined in GitHub Actions workflows with build and deploy stages tied to main branch progression.

### Dependencies
Operational dependencies include PostgreSQL, SMTP provider, S3-compatible storage, GHCR for images, and Trivy for security scanning in CI. Application runtime requires correctly provisioned JWT and DB environment variables before auth and persistence paths can function.

### Highlights
The delivery path combines application build validation with deployment automation and containerized runtime consistency. This setup supports repeatable local-to-prod behavior while preserving security checks and immutable audit-related environment controls.

## Facts
- **local_dev_port**: Local app runs with npm run dev on port 3001 by script [environment]
- **production_stack**: Production deployment uses Docker Compose with Nginx reverse proxy/TLS [environment]
- **ci_pipeline**: CI includes Prisma generate, typecheck, tests/build, image publish and Trivy scanning [environment]
