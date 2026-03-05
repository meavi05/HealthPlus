<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# HealthPlus

HealthPlus is now structured as:

- **Frontend**: React + Vite (`/`)
- **Backend**: Spring Boot (`/backend`)

## Prerequisites

- Node.js 20+ (Node 22 recommended)
- npm 10+
- Java 21+
- Maven 3.9+

## Run locally

### Terminal 1: Spring Boot backend

```bash
npm run backend:dev
```

Backend runs on `http://localhost:8080`.

### Terminal 2: React frontend

```bash
npm run dev
```

Frontend runs on `http://localhost:5173`.

Vite proxies `/api/*` requests to Spring Boot.

## Useful scripts

- `npm run dev` — start frontend (Vite)
- `npm run backend:dev` — start Spring Boot backend
- `npm run dev:full` — run frontend + backend concurrently
- `npm run build` — build frontend
- `npm run preview` — preview built frontend
- `npm run lint` — TypeScript typecheck for frontend

## Backend migration docs

- Migration plan: `SPRING_BOOT_BACKEND_MIGRATION.md`
- Executed phase report: `MIGRATION_EXECUTION_REPORT.md`
