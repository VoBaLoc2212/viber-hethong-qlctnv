.PHONY: help dev prod logs stop restart clean backup restore db-shell

help:
	@echo "Budget Management System - Docker Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev              - Start development environment"
	@echo "  make logs             - View logs from all services"
	@echo "  make logs-backend     - View backend logs only"
	@echo "  make logs-frontend    - View frontend logs only"
	@echo "  make logs-db          - View database logs only"
	@echo ""
	@echo "Database:"
	@echo "  make db-shell         - Connect to PostgreSQL shell"
	@echo "  make backup           - Create database backup"
	@echo "  make restore          - Restore from latest backup"
	@echo ""
	@echo "Management:"
	@echo "  make stop             - Stop all services"
	@echo "  make restart          - Restart all services"
	@echo "  make clean            - Stop and remove all data (⚠️  WARNING)"
	@echo ""
	@echo "Production:"
	@echo "  make prod             - Start production environment"
	@echo "  make prod-logs        - View production logs"
	@echo "  make prod-stop        - Stop production services"

# Development
dev:
	@echo "Starting development environment..."
	docker-compose up -d
	@echo "✓ Services started!"
	@echo ""
	@echo "URLs:"
	@echo "  Frontend:  http://localhost:5173"
	@echo "  Backend:   http://localhost:3000/api"
	@echo "  pgAdmin:   http://localhost:5050"
	@echo ""
	@echo "Database credentials:"
	@echo "  Username:  budget_user"
	@echo "  Password:  budget_password"

logs:
	docker-compose logs -f

logs-backend:
	docker-compose logs -f backend

logs-frontend:
	docker-compose logs -f frontend

logs-db:
	docker-compose logs -f postgres

# Database operations
db-shell:
	docker exec -it budget_postgres psql -U budget_user -d budget_qlctnv

backup:
	@./backup.sh

restore:
	@echo "Available backups:"
	@ls -1 backups/budget_db_*.sql 2>/dev/null | head -5 || echo "No backups found"
	@echo ""
	@read -p "Enter backup filename (without path): " BACKUP_FILE; \
	if [ -f "backups/$$BACKUP_FILE" ]; then \
		docker exec -i budget_postgres psql -U budget_user -d budget_qlctnv < backups/$$BACKUP_FILE; \
		echo "✓ Restore completed!"; \
	else \
		echo "✗ Backup file not found!"; \
	fi

# Management
stop:
	@echo "Stopping all services..."
	docker-compose down
	@echo "✓ Services stopped!"

restart: stop dev

clean:
	@echo "⚠️  WARNING: This will delete all data!"
	@read -p "Type 'YES' to continue: " CONFIRM; \
	if [ "$$CONFIRM" = "YES" ]; then \
		docker-compose down -v; \
		echo "✓ All services and data removed!"; \
	else \
		echo "✗ Cancelled"; \
	fi

# Production
prod:
	@echo "Starting production environment..."
	@if [ ! -f ".env.production" ]; then \
		echo "✗ .env.production not found!"; \
		echo "Please copy .env.example to .env.production and update values"; \
		exit 1; \
	fi
	@if [ ! -d "ssl_certificates" ] || [ ! -f "ssl_certificates/cert.pem" ]; then \
		echo "✗ SSL certificates not found!"; \
		echo "Run: mkdir -p ssl_certificates && openssl req -x509 -nodes -days 365"; \
		exit 1; \
	fi
	docker-compose -f docker-compose.prod.yml up -d
	@echo "✓ Production services started!"

prod-logs:
	docker-compose -f docker-compose.prod.yml logs -f

prod-stop:
	docker-compose -f docker-compose.prod.yml down

# Status
status:
	@echo "Service Status:"
	docker-compose ps
	@echo ""
	@echo "Database Info:"
	@docker exec budget_postgres psql -U budget_user -d budget_qlctnv -c "SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database WHERE datname = 'budget_qlctnv';" 2>/dev/null || echo "Database not accessible"
