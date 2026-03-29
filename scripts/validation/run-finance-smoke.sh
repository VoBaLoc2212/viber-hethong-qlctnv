#!/usr/bin/env bash
set -euo pipefail

ROOT="/f/viber-hethong-qlctnv"

echo "[1/8] Install dependencies"
npm --prefix "$ROOT" ci

echo "[2/8] Start postgres"
docker compose -f "$ROOT/docker-compose.yml" up -d postgres

echo "[3/8] Prisma generate"
npm --prefix "$ROOT" run prisma:generate

echo "[4/8] Prisma validate"
npm --prefix "$ROOT" run prisma:validate

echo "[5/8] Prisma migrate deploy"
npm --prefix "$ROOT" run prisma:migrate:deploy

echo "[6/8] Prisma seed"
npm --prefix "$ROOT" run prisma:seed

echo "[7/8] Quality gates"
npm --prefix "$ROOT" run typecheck
npm --prefix "$ROOT" run test
npm --prefix "$ROOT" run build

echo "[8/8] Start dev server (manual)"
echo "Run in separate terminal: npm --prefix '$ROOT' run dev"
echo "Then verify:"
echo "  curl -i http://localhost:3001/api/healthz"
echo "  curl -i http://localhost:3001/api/health"

echo "Smoke runbook completed."
