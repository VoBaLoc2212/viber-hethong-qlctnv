---
children_hash: 961cd7a88f532c86ecca4a6416aab9efe07828f932b4e626aa8e26a88e5ee92b
compression_ratio: 0.8243064729194187
condensation_order: 2
covers: [context.md, deployment_and_environment/_index.md]
covers_token_total: 757
summary_level: d2
token_count: 624
type: summary
---
# operations (d2 Structural Summary)

## Domain Role
Based on **`context.md`** and child topic summary **`deployment_and_environment/_index.md`**, the **operations** domain defines how the platform is configured, built, secured, and delivered across local and production environments.

## Scope Boundary
- **Included** (from `context.md`): runtime environment variables, deployment mechanisms, CI/CD wiring, external operational dependencies.
- **Excluded**: feature/business-logic design.
- **Ownership**: DevOps / Platform.
- **Primary use**: environment setup, release readiness, and production operations governance.

## Consolidated Delivery Architecture
From **`deployment_and_environment/_index.md`** (drill down to `runtime_and_delivery.md` for detail):
- Canonical flow: **Code push → CI checks/build → deploy on `main` → production rollout via Docker Compose**.
- Runtime topology:
  - **Local**: npm scripts (`npm run dev`) or `docker-compose`
  - **Production**: `docker-compose.prod.yml` + **Nginx reverse proxy/TLS**
- Domain links operationally to architecture baseline in  
  **`architecture/system_overview/viber_financial_platform_overview.md`**.

## Operational Configuration Model
Configuration is organized into stable env domains (from `context.md` + topic summary):
- core runtime
- database
- authentication/JWT
- email/SMTP
- S3-compatible object storage
- internal contract/auth toggles

Key dependency rule: **DB + JWT environment provisioning is mandatory** for persistence and authentication paths.

## CI/CD + Security Control Plane
Documented artifacts (see `runtime_and_delivery.md` via topic summary):
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `Dockerfile.backend`
- `Dockerfile.frontend`
- `nginx.conf`

Pipeline capabilities:
- Prisma generate
- typecheck
- test/build stages
- GHCR image publish
- Trivy security scanning

Operational intent:
- local↔prod runtime consistency
- automated security gates in CI
- controlled, audit-sensitive environment handling.

## External Dependency Set
From **`runtime_and_delivery.md`**:
- PostgreSQL
- SMTP provider
- S3-compatible storage
- GHCR (registry)
- Trivy (security scanning)

## Drill-Down Map
- **Domain policy and boundaries**: `context.md`
- **Execution/runtime/deployment specifics**: `deployment_and_environment/_index.md`
- **Concrete values and flow details** (e.g., local port **3001**, stage sequence): `runtime_and_delivery.md`