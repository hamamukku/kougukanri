# Tool Management API Server

This repository contains a Go backend API for tool warehouse management.

## Stack
- Go 1.22+
- gin-gonic/gin
- PostgreSQL (Docker)
- golang-migrate/migrate
- sqlc
- JWT Bearer auth
- robfig/cron/v3 (06:00 JST daily)
- SMTP mail

## Layout
- `docker-compose.yml`: `db` and `api` services
- `backend/`: API app
  - `cmd/api/main.go`
  - `db/migrations`
  - `db/query`
  - `sqlc.yaml`

## Start
```bash
docker compose up --build
```

Endpoints:
- API: `http://localhost:3000`
- DB: `localhost:5432`
- Health: `GET /health` -> 200

The API applies migrations automatically at startup.

## Seed admin
`docker-compose.yml` sets seed values. If `users` table is empty, one admin is created:
- username: `admin`
- email: `admin@example.com`
- password: `admin123`

## Environment variables
Template: `backend/.env.example`

Main variables:
- `DATABASE_URL`
- `JWT_SECRET`
- `MIGRATIONS_PATH`
- `CRON_ENABLED`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`

## sqlc
```bash
cd backend
sqlc generate
```

sqlc output path is `backend/internal/sqlc`.

## Manual migrate (optional)
The app already runs migrations automatically. CLI example:

```bash
migrate -path backend/db/migrations -database "postgres://postgres:postgres@localhost:5432/kougukanri?sslmode=disable&TimeZone=Asia%2FTokyo" up
```

## Required APIs
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/warehouses`
- `POST /api/admin/warehouses`
- `GET /api/tools`
- `GET /api/admin/tools`
- `POST /api/admin/tools`
- `PATCH /api/admin/tools/:toolId`
- `POST /api/loan-boxes`
- `GET /api/my/loans`
- `POST /api/my/loans/:loanItemId/return-request`
- `GET /api/admin/returns/requests`
- `POST /api/admin/returns/approve-box`
- `POST /api/admin/returns/approve-items`
- `POST /api/admin/users`

## Error format
```json
{
  "error": {
    "code": "RESERVATION_CONFLICT",
    "message": "...",
    "details": {}
  }
}
```

## Minimum flow check
1. Login as seed admin.
2. Create warehouse as admin.
3. Register tools as admin.
4. Create normal user as admin.
5. Login as user and create loan/reservation via `POST /api/loan-boxes`.
6. Request return via `POST /api/my/loans/:loanItemId/return-request`.
7. Approve return as admin (`approve-box` or `approve-items`).
8. Verify tool becomes `AVAILABLE` in `GET /api/tools`.

## Reservation overlap check
Create overlapping period for same tool and confirm `409 RESERVATION_CONFLICT`.

## Cron overdue check
Cron runs every day at `06:00 JST`.

Manual one-shot run:
```bash
docker compose exec api /app/api -run-overdue-once
```

Overdue filter:
- `return_approved_at IS NULL`
- `start_date <= today (JST)`
- `due_date < today (JST)`
