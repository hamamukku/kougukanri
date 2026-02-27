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

If `5432` is already used on the host, either stop the existing DB process or change the compose mapping from `"5432:5432"` to `"5433:5432"` and reconnect with port `5433`.

## Seed admin
Seed admin creation runs only when `ENABLE_SEED_ADMIN=true`.

`docker-compose.yml` enables seed for local dev. If `users` table is empty, one admin is created:
- username: `admin`
- email: `admin@example.com`
- password: `admin123`

Operational caution:
- Change the initial password immediately in production.
- Disable seed admin after bootstrap (`ENABLE_SEED_ADMIN=false`).
- Removing `SEED_ADMIN_*` variables after bootstrap is recommended.

## Environment variables
Template: `backend/.env.example`

Main variables:
- `DATABASE_URL`
- `JWT_SECRET`
- `MIGRATIONS_PATH`
- `CRON_ENABLED`
- `ENABLE_SEED_ADMIN`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`
- `NOTIFY_WEBHOOK_URL`
  - empty: notifier is always noop
  - set: notifier is enabled by default
- `NOTIFY_ENABLED` (optional override)
  - `false`: force notifier noop even when webhook URL is set
  - unset: keep default behavior from `NOTIFY_WEBHOOK_URL`

Startup log includes notifier mode for diagnosis:
- `notify_mode=(noop|webhook)`
- `notify_enabled=(true|false)`
- `webhook_configured=(true|false)` (URL value itself is not logged)

## sqlc
```bash
bash backend/scripts/sqlc_generate.sh
```

Recommended version: `sqlc v1.27.0` (recorded in `backend/.sqlc-version.txt`).

Generated query code is stored in `backend/internal/sqlc`.

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
- `GET /api/tools/by-tag/:tagId`
- `GET /api/admin/tools`
- `GET /api/admin/audit-logs`
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

## Error codes
- `NOT_FOUND`
- `INVALID_REQUEST`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `RESERVATION_CONFLICT`
- `TOOL_NOT_AVAILABLE`
- `TOOL_RESERVED_BY_OTHER`
- `ALREADY_REQUESTED`
- `ALREADY_APPROVED`

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

## Reservation policy
予約最優先。開始前でも他人は借りられない。  
If another user has a future reservation for a tool, loans with `startDate <= today` are blocked with `TOOL_RESERVED_BY_OTHER`.

## E2E smoke script
```bash
bash backend/scripts/e2e_smoke.sh
```

Optional environment overrides:
- `BASE_URL` (default: `http://localhost:3000`)
- `ADMIN_LOGIN_ID` (default: `admin`)
- `ADMIN_PASSWORD` (default: `admin123`)
- `SMOKE_USER_PASSWORD` (default: `user12345`)

## Manual API checks
Use an admin token from `POST /api/auth/login`.

Invalid `warehouseId` should return `400 INVALID_REQUEST`:
```bash
curl -i -H "Authorization: Bearer <adminToken>" \
  "http://localhost:3000/api/tools?warehouseId=xxx"
```

`/api/tools` should include `items,page,pageSize,total`:
```bash
curl -s -H "Authorization: Bearer <adminToken>" \
  "http://localhost:3000/api/tools?page=1&pageSize=25"
```

Use a user token from `POST /api/auth/login` for `NOT_FOUND` validation:
```bash
curl -i -H "Authorization: Bearer <userToken>" \
  -X POST \
  "http://localhost:3000/api/my/loans/00000000-0000-0000-0000-000000000000/return-request"
```

Audit log list (admin only, newest first, supports `actorId,targetType,targetId,action,from,to,page,pageSize`):
```bash
curl -s -H "Authorization: Bearer <adminToken>" \
  "http://localhost:3000/api/admin/audit-logs?page=1&pageSize=25"
```
Response includes `items,page,pageSize,total`.

`from` / `to` input rules:
- RFC3339 values are used as-is.
- `YYYY-MM-DD` is interpreted in JST (`Asia/Tokyo`).
  - `from=YYYY-MM-DD` -> JST `00:00:00.000000000`
  - `to=YYYY-MM-DD` -> JST `23:59:59.999999999`

BLT tag linkage:
- `tools.tag_id` is nullable `TEXT` with unique constraint (`NULL` allowed multiple times).
- Admin can update tag by `PATCH /api/admin/tools/:toolId` with `tagId`.
- Authed users can lookup tool by tag: `GET /api/tools/by-tag/:tagId`.

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
