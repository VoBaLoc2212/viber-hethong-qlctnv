#!/bin/bash

# Database backup script for PostgreSQL in Docker
# Usage: ./backup.sh

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/budget_db_${TIMESTAMP}.sql"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Container name
CONTAINER_NAME="budget_postgres"

echo "Starting database backup..."
echo "Backup file: ${BACKUP_FILE}"

# Run pg_dump inside the container
docker exec "${CONTAINER_NAME}" pg_dump -U budget_user -d budget_qlctnv > "${BACKUP_FILE}"

echo "Backup completed successfully!"
echo "File size: $(du -h ${BACKUP_FILE} | cut -f1)"

# Keep only last 7 backups
echo "Cleaning up old backups (keeping last 7)..."
ls -1t ${BACKUP_DIR}/budget_db_*.sql 2>/dev/null | tail -n +8 | xargs -r rm

echo "Done!"
