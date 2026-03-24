# 🚀 Quick Start Guide

Get the Budget Management System running in less than 2 minutes.

## Prerequisites

✅ **Docker Desktop installed?**
- Windows/macOS: https://www.docker.com/products/docker-desktop
- Linux: `sudo apt install docker.io docker-compose`

✅ **Ports available:** 3000, 5173, 5432

## Option A: Maximum Speed (Makefile)

```bash
# 1. Clone and navigate
git clone <repo-url>
cd viber-hethong-qlctnv

# 2. Start with one command
make dev

# 3. Access the app (30 seconds after command)
# Frontend:  http://localhost:5173
# Backend:   http://localhost:3000/api
# Database:  http://localhost:5050 (pgAdmin)
```

**Done!** 🎉

To stop: `make stop`

---

## Option B: Standard Setup (Docker Compose)

```bash
# 1. Clone
git clone <repo-url>
cd viber-hethong-qlctnv

# 2. Create environment file (if needed)
cp .env.example .env

# 3. Start services
docker-compose up -d

# 4. Wait 30 seconds, then access:
# http://localhost:5173
```

**Stop:** `docker-compose down`

---

## Option C: Interactive Setup (start.sh)

```bash
bash start.sh
# Follow the prompts
```

---

## 🌐 URLs After Startup

| What | URL | Login |
|------|-----|-------|
| Frontend | http://localhost:5173 | (none needed) |
| API | http://localhost:3000/api | - |
| Database UI | http://localhost:5050 | admin@example.com / admin |

---

## 📊 Database Access

### Using pgAdmin (Easiest)

1. Go to http://localhost:5050
2. Right-click "Servers" → "Create" → "Server"
3. **Name:** anything (e.g., "Local")
4. Go to **Connection** tab:
   - Host: `postgres`
   - User: `budget_user`
   - Password: `budget_password`
   - Database: `budget_qlctnv`
5. Click **Save**

### Using Command Line

```bash
docker exec -it budget_postgres psql -U budget_user -d budget_qlctnv

# Try a query
SELECT * FROM departments;

# Exit
\q
```

---

## 🐛 Troubleshooting

### "Docker daemon not running"
→ Start Docker Desktop

### "Port 3000/5173/5432 already in use"
```bash
# Find what's using it
lsof -i :3000

# Kill it
kill -9 <PID>

# Then restart
docker-compose down
docker-compose up -d
```

### "Services won't start"
```bash
# Check logs
docker-compose logs

# Force restart
docker-compose down -v
docker-compose up -d
```

### "Can't connect to database"
```bash
# Wait longer (first startup takes ~30s)
sleep 30

# Check database is healthy
docker-compose ps postgres

# Restart database
docker-compose restart postgres
```

---

## ✅ Verification Checklist

After startup, verify everything:

```bash
# ✓ Check all services running
docker-compose ps
# Shows "Up" for all services

# ✓ Test backend API
curl http://localhost:3000/api/health
# Should return: {"status":"ok",...}

# ✓ Test database
docker exec budget_postgres pg_isready -U budget_user
# Should return: "accepting connections"

# ✓ Frontend loads
# Open http://localhost:5173 in browser
# Should see the application
```

---

## 📁 Project Structure

```
apps/
├── backend/    → API server (Express)
└── frontend/   → Web UI (React)

lib/
├── db/         → Database schema (Drizzle)
└── api-spec/   → API documentation

Docker files:
- docker-compose.yml  → Services configuration
- .env               → Environment variables
- init.sql           → Database initialization
```

---

## 📖 Need More Info?

| Question | File |
|----------|------|
| How do I use Docker? | [DOCKER_CHEATSHEET.md](./DOCKER_CHEATSHEET.md) |
| What's the database schema? | [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) |
| How are the transactions stored? | [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) |
| How do I add new database tables? | [DRIZZLE_GUIDE.md](./DRIZZLE_GUIDE.md) |
| What API endpoints exist? | [API_DOCS.md](./API_DOCS.md) |
| How do I contribute? | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| Full Docker guide | [DOCKER_SETUP.md](./DOCKER_SETUP.md) |

---

## 🎮 Common Next Steps

### View Logs in Real-Time

```bash
# All services
docker-compose logs -f

# Just backend
docker-compose logs -f backend

# Just frontend
docker-compose logs -f frontend
```

### Backup Database

```bash
./backup.sh
# Saves to backups/ directory
```

### Stop Services (Without Deleting Data)

```bash
docker-compose stop
# Or with make:
make stop
```

### Stop Services (Delete Everything)

```bash
docker-compose down -v
# Or with make:
make clean
```

---

## 💪 Ready to Code?

1. **Backend?** Check [DRIZZLE_GUIDE.md](./DRIZZLE_GUIDE.md)
2. **Frontend?** Check [API_DOCS.md](./API_DOCS.md)
3. **Database?** Check [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
4. **Contributing?** Check [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## ❓ FAQ

**Q: How long does startup take?**
A: ~30 seconds on first run, immediate on subsequent runs

**Q: Can I use this on Windows?**
A: Yes! Install Docker Desktop for Windows

**Q: How do I make the database persistent?**
A: Data is saved in Docker volumes automatically. `docker-compose down` keeps data. `docker-compose down -v` deletes it.

**Q: Where are my environment variables?**
A: In the `.env` file (don't commit this, it's in .gitignore)

**Q: Can I develop without Docker?**
A: Yes, but setup is more complex. Better to use Docker.

---

**Happy coding! 🚀**

Questions? Check the documentation files or check existing issues.
