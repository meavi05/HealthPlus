<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# HealthPlus

A full-stack TypeScript app for browsing medicines and placing orders.

## Local development

### Prerequisites

- **Node.js 20+** (Node 22 LTS recommended)
- npm 10+

> Why this matters: this project uses Vite 6, tsx, and better-sqlite3 versions that do not support Node 16.

### 1) Use a supported Node version

If you use `nvm`:

```bash
nvm install 22
nvm use 22
node -v
npm -v
```

If you use `fnm`:

```bash
fnm install 22
fnm use 22
node -v
npm -v
```

### 2) Install dependencies

```bash
npm install
```

### 3) Run the app

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

## Troubleshooting

### `npm WARN EBADENGINE Unsupported engine`

You're on an unsupported Node version (commonly Node 16). Switch to Node 20+ and reinstall.

### `better-sqlite3` build failure on Apple Silicon

This project pins a `better-sqlite3` version that supports modern Node releases. When using Node 16, prebuilt binaries are not available and native build often fails. Upgrading Node to 20+ resolves this in most cases.

### Clean reinstall after switching Node

```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

## Available scripts

- `npm run dev` – start Express + Vite middleware server
- `npm run lint` – TypeScript typecheck (`tsc --noEmit`)
- `npm run build` – frontend production build
- `npm run preview` – preview Vite build output

## Backend migration option

If you want to replace the Express backend with Java Spring Boot, follow `SPRING_BOOT_BACKEND_MIGRATION.md` for a full file-by-file migration plan and rollout checklist.

