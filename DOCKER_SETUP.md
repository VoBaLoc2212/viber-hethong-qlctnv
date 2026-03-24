# Docker Setup Guide for Budget Management System

## Prerequisites

- Docker Desktop (version 20.10 or higher)
- Docker Compose (version 2.0 or higher)
- At least 4GB RAM available for Docker
- Optional: pgAdmin for database management

## Environment Files

### `.env` (Development)
Used for local development. Contains default development credentials.

```bash
DATABASE_URL=postgresql://budget_user:budget_password@postgres:5432/budget_qlctnv
PORT=3000
NODE_ENV=development
```

### `.env.production` (Production)
Used for production deployments. **CHANGE ALL SECRETS BEFORE DEPLOYING!**

```bash
DATABASE_URL=postgresql://budget_user:CHANGE_ME_STRONG_PASSWORD@postgres:5432/budget_qlctnv
JWT_SECRET=CHANGE_ME_VERY_LONG_RANDOM_SECRET
```

## Quick Start

### 1. Development Setup

```bash
# Copy example env (if needed)
cp .env.example .env

# Start all services (PostgreSQL, Backend, Frontend, pgAdmin)
docker-compose up -d

# Wait for services to be healthy (about 30 seconds)
docker-compose ps

# Access the application
# Frontend: http://localhost:5173
# Backend: http://localhost:3000/api
# pgAdmin: http://localhost:5050 (admin@example.com / admin)
```

### 2. View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### 3. Database Management

```bash
# Connect to PostgreSQL directly
docker exec -it budget_postgres psql -U budget_user -d budget_qlctnv

# Backup database
./backup.sh

# Restore from backup
docker exec -i budget_postgres psql -U budget_user -d budget_qlctnv < backups/budget_db_YYYYMMDD_HHMMSS.sql

# View database size
docker exec -it budget_postgres psql -U budget_user -d budget_qlctnv -c "SELECT pg_size_pretty(pg_database_size('budget_qlctnv'));"
```

### 4. Stopping Services

```bash
# Stop all services (keeps data)
docker-compose down

# Stop and remove all data (clean slate)
docker-compose down -v

# Stop specific service
docker-compose stop backend
docker-compose restart backend
```

## Production Deployment

### 1. Prepare Production Environment

```bash
# Copy production environment template
cp .env.example .env.production

# Edit and set all production secrets
nano .env.production
```

### 2. Generate SSL Certificates

```bash
# Create SSL directory
mkdir -p ssl_certificates

# Generate self-signed certificate (replace with real certificate in production)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl_certificates/key.pem \
  -out ssl_certificates/cert.pem
```

### 3. Deploy with Docker Compose

```bash
# Load environment variables
export $(cat .env.production | xargs)

# Build and start with production compose file
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 4. Health Checks

```bash
# Check if backend is healthy
curl -s http://localhost:3000/api/health

# Check database connection
docker exec budget_postgres_prod pg_isready -U budget_user

# Check all services
docker-compose -f docker-compose.prod.yml ps
```

## Service Ports

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 5173 | React Dev Server (Dev only) |
| Backend | 3000 | Express API Server |
| PostgreSQL | 5432 | Database |
| pgAdmin | 5050 | Database GUI (Dev only) |
| Nginx | 80, 443 | Reverse Proxy (Prod only) |

## Database Schema

The `init.sql` file automatically creates:

### Tables
- **departments**: Department master data
- **budget_allocations**: Budget assignments by department/category/quarter
- **budget_categories**: Transaction categories (Salary, Equipment, etc.)
- **transactions**: Income/Expense records
- **approval_workflows**: Approval process tracking
- **reserved_budgets**: Encumbrance (approved but not yet paid)
- **cashbooks**: Daily cash records
- **reconciliations**: Bank reconciliation records
- **recurring_transactions**: Templates for monthly transactions
- **budget_transfers**: Budget movement between allocations
- **audit_logs**: All changes for compliance

### Views
- **department_budget_status**: Current budget utilization by department
- **daily_cash_balance**: Daily cash flow summary

### Stored Procedures
- `generate_recurring_transactions()`: Auto-generates monthly/recurring transactions
- `create_budget_transfer()`: Enables budget transfers with validation

## Common Tasks

### Reset Database (WARNING: All data will be lost)

```bash
docker-compose down -v
docker-compose up -d postgres
# Wait for postgres to be healthy
sleep 20
docker-compose up -d
```

### Check Database Size

```bash
docker exec budget_postgres psql -U budget_user -d budget_qlctnv \
  -c "SELECT pg_size_pretty(pg_database_size('budget_qlctnv'));"
```

### Monitor Database Connections

```bash
docker exec budget_postgres psql -U budget_user -d budget_qlctnv \
  -c "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"
```

### Troubleshooting

**Issue: Port already in use**
```bash
# Find process using port 5432
lsof -i :5432
# Kill process
kill -9 <PID>
```

**Issue: Docker volume errors**
```bash
# List volumes
docker volume ls

# Remove unused volumes
docker volume prune
```

**Issue: Backend can't connect to database**
```bash
# Check pg connection from backend
docker exec budget_backend curl -s http://localhost:3000/api/health

# Check database logs
docker-compose logs postgres
```

## File Descriptions

| File | Purpose |
|------|---------|
| `.env` | Development environment variables |
| `.env.example` | Template for environment variables |
| `.env.production` | Production environment variables |
| `docker-compose.yml` | Development services configuration |
| `docker-compose.prod.yml` | Production services configuration |
| `Dockerfile.backend` | Backend application image |
| `Dockerfile.frontend` | Frontend application image |
| `init.sql` | Database schema and initial data |
| `nginx.conf` | Nginx reverse proxy configuration |
| `backup.sh` | Database backup script |
| `.dockerignore` | Docker build exclusions |

## Best Practices

1. **Never commit `.env` file** to version control
2. **Change default passwords** in production
3. **Use strong JWT secrets** (at least 32 characters)
4. **Enable SSL/TLS** in production
5. **Regular database backups** (automated recommended)
6. **Monitor logs** for errors and security issues
7. **Keep Docker images updated** with security patches
8. **Use health checks** to auto-restart failed services

## Support and Documentation

- PostgreSQL: https://www.postgresql.org/docs/
- Docker Compose: https://docs.docker.com/compose/
- Express.js: https://expressjs.com/
- Vite: https://vitejs.dev/
- Drizzle ORM: https://orm.drizzle.team/

---

For more information, refer to the project README.md
