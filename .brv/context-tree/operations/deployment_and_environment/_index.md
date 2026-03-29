---
children_hash: 016e8a6cf48eade5264a660f17eb7ef36197ee953b24cb8e4205ad1938b8bd09
compression_ratio: 0.9729272419627749
condensation_order: 1
covers: [context.md, runtime_and_delivery.md]
covers_token_total: 591
summary_level: d1
token_count: 575
type: summary
---
# deployment_and_environment (d1 Structural Summary)

## Scope
From **`context.md`** and **`runtime_and_delivery.md`**, this topic covers end-to-end runtime configuration and release operations: environment setup, containerization, CI/CD, and production delivery posture.

## Core Architecture & Delivery Pattern
- Primary delivery flow (from **`runtime_and_delivery.md`**):  
  **Code push → CI checks/build → deploy on `main` → production Docker Compose rollout**
- Operational model:
  - **Local**: run via npm scripts (`npm run dev`) or `docker-compose`
  - **Production**: `docker-compose.prod.yml` stack behind **Nginx reverse proxy/TLS**
- Related architecture linkage:
  - References **`architecture/system_overview/viber_financial_platform_overview.md`**

## Key Configuration Domains
(derived from **`context.md`** + **`runtime_and_delivery.md`**)
- Environment variable groups include:
  - core runtime
  - database
  - authentication/JWT
  - email/SMTP
  - object storage (S3-compatible)
  - internal contract/auth toggles
- Critical runtime dependency rule:
  - JWT and DB env provisioning is required for auth and persistence paths to function.

## CI/CD and Security Decisions
- Workflows/files explicitly captured in **`runtime_and_delivery.md`**:
  - `.github/workflows/ci.yml`
  - `.github/workflows/deploy.yml`
  - `docker-compose.yml`
  - `docker-compose.prod.yml`
  - `Dockerfile.backend`
  - `Dockerfile.frontend`
  - `nginx.conf`
- Pipeline capabilities:
  - Prisma generate
  - typecheck
  - tests/build
  - image publish to **GHCR**
  - **Trivy** security scanning
- Architectural intent:
  - preserve local-to-prod runtime consistency
  - enforce automated security checks in CI
  - maintain immutable/audit-sensitive environment controls.

## External Service Dependencies
From **`runtime_and_delivery.md`**:
- PostgreSQL
- SMTP provider
- S3-compatible storage
- GHCR (container registry)
- Trivy (security scanning)

## High-Value Facts for Drill-Down
- **`runtime_and_delivery.md`**
  - local dev port: **3001**
  - production stack: Docker Compose + Nginx reverse proxy/TLS
  - CI includes generate/check/test/build/publish/security scan stages
- **`context.md`**
  - top-level concept map: env vars, docker compose, GitHub Actions, Nginx reverse proxy, security scans