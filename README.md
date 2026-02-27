# Tool Management (Backend + Frontend)

This repository contains:
- Go backend API (`backend/`)
- Next.js frontend (new copy under `frontend/`)

## Stack
- Backend: Go 1.22+, gin, PostgreSQL, sqlc, JWT Bearer auth
- Frontend: Next.js App Router, TypeScript

## Layout
- `backend/`: API app
- `frontend/`: migrated frontend app (active frontend target)
- `app/`, `src/`, `public/` (repo root): old frontend copy kept for migration safety
- `docker-compose.yml`: `db` + `api` services

## Backend Start
```bash
docker compose up --build
```

Endpoints:
- API: `http://localhost:3000`
- Health: `GET /health`

### Windows + Docker Desktop Troubleshooting
If startup fails with:
- `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`

Check in order:
1. Start Docker Desktop app (`C:\Program Files\Docker\Docker\Docker Desktop.exe`).
2. Wait until Docker Desktop shows `Engine running`.
3. Confirm in terminal:
   - `docker version` (both Client and Server should be shown)
   - `docker compose ps` (no pipe error)
4. Confirm WSL2 backend:
   - `wsl -l -v`
   - `docker-desktop` and `docker-desktop-data` should be present with `VERSION 2`
5. If still failing:
   - Restart Docker Desktop from UI (`Troubleshoot` -> `Restart Docker Desktop`)
   - Or Windows restart, then launch Docker Desktop first, then run `docker compose up --build`
6. If service is stopped and cannot be started from non-admin terminal:
   - Run Docker Desktop as your normal user first (preferred)
   - If corporate policy blocks service startup, ask local admin to enable Docker Desktop service startup

### Port 5432 Conflict
If `5432` is already used:
1. Stop local PostgreSQL using that port, or
2. Change `docker-compose.yml` DB mapping from `"5432:5432"` to `"5433:5432"`
3. Update backend DB connection to use `5433`

## Frontend Start
1. Move to frontend app directory
```bash
cd frontend
```

2. Install dependencies
```bash
npm i
```

3. Create local env file
```bash
cp .env.local.example .env.local
```
(PowerShell: `Copy-Item .env.local.example .env.local`)

4. Start frontend dev server
```bash
npm run dev
```

Frontend URL:
- `http://localhost:3100`

## Frontend Environment Variables
Template: `frontend/.env.local.example`

- `NEXT_PUBLIC_API_BASE_URL` (default example: `http://localhost:3000`)
- `NEXT_PUBLIC_USE_MOCKS`
  - `0`: use real backend API (default)
  - `1`: enable MSW mocks

## API Routing / CORS Strategy
Frontend uses Next.js rewrites:
- `frontend/next.config.ts`
- `/api/*` on frontend is proxied to `${NEXT_PUBLIC_API_BASE_URL}/api/*`

This allows frontend code to call relative paths (`/api/...`) and avoid browser CORS issues in local development.

## Auth Flow (Frontend)
- Login page calls `POST /api/auth/login`
- Token is stored in cookie (`auth_token`)
- Frontend fetch wrapper sends `Authorization: Bearer <token>`
- User info is synced with `GET /api/auth/me` and reflected in UI
- Redirect policy:
  - `401` -> `/login`
  - `403` -> `/tools`

## Required APIs (P1)
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

## Seed Admin (Local)
When `ENABLE_SEED_ADMIN=true` and users table is empty:
- username: `admin`
- email: `admin@example.com`
- password: `admin123`

## Minimum Flow Check
1. Login as admin.
2. Create warehouse (`/admin/warehouses`).
3. Create tool (`/admin/tools`).
4. Create user (`/admin/users`).
5. Login as created user.
6. Select tool in `/tools`, create loan in `/loan-box`.
7. Request return in `/my-loans`.
8. Approve return in `/admin/returns` (`approve-box` or `approve-items`).
9. Confirm tool returns to `AVAILABLE` in `/tools`.

### Minimum Flow (PowerShell Script)
For Windows local verification (API direct or via frontend rewrite):
```powershell
powershell -ExecutionPolicy Bypass -File .\\e2e_flow_windows.ps1
```

Use frontend rewrite path (`http://localhost:3100/api/*`) instead of backend direct:
```powershell
powershell -ExecutionPolicy Bypass -File .\\e2e_flow_windows.ps1 -BaseUrl http://localhost:3100
```

The script prints each step and exits immediately on failure so you can see where connection broke.

### Rewrite Behavior Checks
When frontend rewrite is enabled (`frontend/next.config.ts`):
1. Backend down check:
   - Stop backend API (`docker compose stop api`)
   - Call `http://localhost:3100/api/auth/login`
   - Expected: `500 Internal Server Error` (proxy target unavailable)
2. 401 check:
   - Call `/api/tools` with invalid bearer token
   - Expected: `401`
3. 403 check:
   - Login as normal user and call `/api/admin/tools`
   - Expected: `403`
4. Page redirects:
   - `GET /tools` without auth cookie -> redirect `/login?next=...`
   - `GET /admin/tools` with `role=user` cookie -> redirect `/tools`

## Backend Env Template
See `backend/.env.example`.

Main variables:
- `DATABASE_URL`
- `JWT_SECRET`
- `MIGRATIONS_PATH`
- `CRON_ENABLED`
- `ENABLE_SEED_ADMIN`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`
- `NOTIFY_WEBHOOK_URL`
- `NOTIFY_ENABLED`

## Utility Scripts
- SQLC generate:
```bash
bash backend/scripts/sqlc_generate.sh
```

- E2E smoke:
```bash
bash backend/scripts/e2e_smoke.sh
```
