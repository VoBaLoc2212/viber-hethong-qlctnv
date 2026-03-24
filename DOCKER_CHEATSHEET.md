# Docker & Commands Quick Reference

## One-Liner Commands

```bash
# Start everything
docker-compose up -d

# View all logs
docker-compose logs -f

# Stop everything
docker-compose down

# Stop and delete data
docker-compose down -v

# Restart all services
docker-compose restart

# Check service status
docker-compose ps
```

## Service-Specific Logs

```bash
# Backend logs
docker-compose logs -f backend

# Frontend logs
docker-compose logs -f frontend

# Database logs
docker-compose logs -f postgres

# pgAdmin logs
docker-compose logs -f pgadmin

# Last 100 lines
docker-compose logs -f --tail=100 backend
```

## Database Operations

```bash
# Connect to database shell
docker exec -it budget_postgres psql -U budget_user -d budget_qlctnv

# Common queries
# List all tables
\dt

# Show specific table
SELECT * FROM departments;

# Exit psql
\q

# Backup database
docker exec budget_postgres pg_dump -U budget_user -d budget_qlctnv > backup.sql

# Restore database
cat backup.sql | docker exec -i budget_postgres psql -U budget_user -d budget_qlctnv

# Check database size
docker exec budget_postgres psql -U budget_user -d budget_qlctnv \
  -c "SELECT pg_size_pretty(pg_database_size('budget_qlctnv'));"

# Check active connections
docker exec budget_postgres psql -U budget_user -d budget_qlctnv \
  -c "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"
```

## Container Management

```bash
# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# View container details
docker inspect budget_postgres

# Get container IP
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' budget_postgres

# Restart single service
docker-compose restart backend
docker-compose restart frontend
docker-compose restart postgres

# Rebuild service (if Dockerfile changed)
docker-compose build backend
docker-compose up -d backend

# Remove old images
docker image prune

# Remove unused volumes
docker volume prune
```

## Port Mapping

```bash
# Check what's using a port
lsof -i :3000    # Backend
lsof -i :5173    # Frontend
lsof -i :5432    # Database
lsof -i :5050    # pgAdmin

# Kill process
kill -9 <PID>

# On Windows (PowerShell)
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
```

## Building and Pushing Images

```bash
# Build image locally
docker build -f Dockerfile.backend -t budget-backend:latest .
docker build -f Dockerfile.frontend -t budget-frontend:latest .

# Tag image for registry
docker tag budget-backend:latest ghcr.io/username/budget-backend:latest

# Push to registry
docker push ghcr.io/username/budget-backend:latest

# Pull image
docker pull ghcr.io/username/budget-backend:latest
```

## Development Workflow

```bash
# 1. Start services
docker-compose up -d

# 2. View logs (in another terminal)
docker-compose logs -f

# 3. Access services
# Frontend: http://localhost:5173
# Backend: http://localhost:3000/api
# Database: localhost:5432

# 4. Edit code (files auto-reload in dev mode)
# backend auto-rebuilds on changes
# frontend auto-rebuilds on changes

# 5. Test API
curl http://localhost:3000/api/health
curl http://localhost:3000/api/departments

# 6. Stop services when done
docker-compose down
```

## Common Issues and Solutions

```bash
# Issue: "Cannot connect to Docker daemon"
# Solution: Start Docker Desktop

# Issue: "Port already in use"
# Solution: Find and kill process
lsof -i :3000
kill -9 <PID>

# Issue: Database won't start
# Solution: Check logs and reset
docker-compose logs postgres
docker-compose down -v
docker-compose up -d

# Issue: Frontend won't load
# Solution: Rebuild frontend
docker-compose build frontend
docker-compose up -d frontend

# Issue: Backend can't connect to database
# Solution: Check connection string and restart
docker-compose logs backend
docker-compose restart backend postgres
```

## Useful Aliases (Add to ~/.bashrc or ~/.zshrc)

```bash
alias dc='docker-compose'
alias dcup='docker-compose up -d'
alias dcdn='docker-compose down'
alias dcl='docker-compose logs -f'
alias dcps='docker-compose ps'
alias dcrm='docker-compose down -v'
alias dcrestart='docker-compose restart'
alias dcbuild='docker-compose build'
```

Then use:
```bash
dc up -d
dcl
dcps
dcdn
```

## Using Makefile (Linux/macOS)

```bash
make help      # Show all commands
make dev       # Start development
make logs      # View all logs
make logs-backend
make logs-frontend
make db-shell  # Connect to database
make backup    # Backup database
make restore   # Restore database
make stop      # Stop services
make restart   # Restart services
make clean     # Delete everything
make prod      # Start production
```

## Production Deployment

```bash
# Load environment variables
export $(cat .env.production | xargs)

# Start production
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Check status
docker-compose -f docker-compose.prod.yml ps

# Stop production
docker-compose -f docker-compose.prod.yml down

# Scale services (if using load balancing)
docker-compose -f docker-compose.prod.yml up -d --scale backend=3
```

## Docker Compose Syntax Cheat Sheet

```bash
# Basic commands
docker-compose up              # Start (foreground)
docker-compose up -d           # Start (background)
docker-compose down            # Stop
docker-compose down -v         # Stop and remove volumes
docker-compose ps              # Status
docker-compose logs            # View logs
docker-compose logs -f         # Follow logs
docker-compose logs service    # Logs for specific service
docker-compose logs -f --tail=50 service

# Service management
docker-compose start           # Start stopped services
docker-compose stop            # Stop running services
docker-compose restart         # Restart services
docker-compose pause           # Pause services
docker-compose unpause         # Unpause services
docker-compose kill            # Force stop services

# Building and development
docker-compose build           # Build images
docker-compose build --no-cache # Build without cache
docker-compose pull            # Pull images from registry
docker-compose up --build      # Build and start
docker-compose up -d --remove-orphans

# Debugging
docker-compose exec postgres psql -U budget_user -d budget_qlctnv
docker-compose exec backend npm run build
docker-compose exec frontend npm run build

# Cleanup
docker-compose down -v --remove-orphans
docker image prune
docker volume prune
docker network prune
```

## Environment Variable Management

```bash
# Load .env file into current shell
set -a
source .env
set +a

# Use with docker-compose
docker-compose --env-file .env.production up -d

# Pass individual variables
DATABASE_URL=... docker-compose up -d

# View environment variables in running container
docker-compose exec backend env | grep DATABASE
```

## Network Debugging

```bash
# Check if services can communicate
docker-compose exec backend curl http://postgres:5432  # Won't work (postgres is port-based)
docker-compose exec backend curl http://postgres:5432 -v

# Better test
docker-compose exec backend psql -h postgres -U budget_user -d budget_qlctnv -c "SELECT 1;"

# Check DNS resolution
docker-compose exec backend ping postgres
docker-compose exec backend nslookup postgres

# View container IP addresses
docker-compose exec postgres hostname -i
docker-compose exec backend hostname -i
```

## Disk Space Management

```bash
# Check Docker disk usage
docker system df

# Clean up unused resources
docker system prune          # Remove unused images, containers, networks
docker system prune -a       # Also remove unused images
docker system prune --volumes # Also remove unused volumes

# Remove specific items
docker image rm image_id
docker volume rm volume_name
docker network rm network_name
```

