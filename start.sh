#!/bin/bash

# Quick start script for Budget Management System
# This script helps you get started quickly

set -e

echo "================================"
echo "Budget Management System - Setup"
echo "================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose."
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ .env file created"
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p backups
mkdir -p ssl_certificates

# Check Docker daemon
echo "🐳 Checking Docker daemon..."
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker daemon is not running. Please start Docker Desktop."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Show menu
echo "What would you like to do?"
echo ""
echo "1) Start development environment (app + database)"
echo "2) View logs"
echo "3) Connect to database shell"
echo "4) Backup database"
echo "5) Stop all services"
echo "6) Clean everything (⚠️  DELETES DATA)"
echo ""

read -p "Enter your choice (1-6): " CHOICE

case $CHOICE in
    1)
        echo ""
        echo "Starting development environment..."
        docker-compose up -d
        sleep 5
        echo ""
        echo "✅ Services are starting..."
        docker-compose ps
        echo ""
        echo "📍 Access points:"
        echo "   App:       http://localhost:3001"
        echo "   API:       http://localhost:3001/api"
        echo "   pgAdmin:   http://localhost:5050 (admin@example.com / admin)"
        echo ""
        echo "💾 Database: budget_qlctnv"
        echo "   User:     budget_user"
        echo "   Password: budget_password"
        ;;
    2)
        docker-compose logs -f
        ;;
    3)
        docker exec -it budget_postgres psql -U budget_user -d budget_qlctnv
        ;;
    4)
        ./backup.sh
        ;;
    5)
        echo "Stopping all services..."
        docker-compose down
        echo "✅ All services stopped"
        ;;
    6)
        echo ""
        echo "⚠️  WARNING: This will delete all databases and volumes!"
        read -p "Type 'DELETE ALL' to confirm: " CONFIRM
        if [ "$CONFIRM" = "DELETE ALL" ]; then
            docker-compose down -v
            echo "✅ All services and data removed"
        else
            echo "Cancelled"
        fi
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
