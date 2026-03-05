# HealthPlus Newcomer Guide

This guide gives you a quick map of the codebase so you can become productive fast.

## 1) What this project is

HealthPlus is a **full-stack TypeScript app** for a simple online pharmacy workflow:

- Browse medicines
- Add items to a cart (client-side)
- Sign in with Google/Facebook OAuth
- Place and view orders
- View/update profile

The app is served by a single Express server that also mounts Vite middleware for the React frontend in development.

## 2) High-level architecture

- **Frontend:** React + Vite + Tailwind (`src/App.tsx`, `src/main.tsx`, `src/index.css`)
- **Backend API:** Express route modules in `src/routes/*.ts`
- **Auth:** Passport with Google/Facebook strategies
- **Data:** SQLite via `better-sqlite3` (`db.ts` + `schema.sql`)
- **Entry point:** `server.ts` boots Express + API + Vite/static serving

## 3) Project structure

```text
.
├── server.ts                # Express app bootstrap + route mounting + Vite/static hosting
├── db.ts                    # SQLite connection + schema initialization
├── schema.sql               # Table creation + medicine seed data
├── src/
│   ├── App.tsx              # Main React UI and client-side state (catalog/cart/modals)
│   ├── main.tsx             # React app entry
│   ├── index.css            # Tailwind import
│   └── routes/
│       ├── auth.ts          # OAuth setup + login/logout callbacks
│       ├── medicines.ts     # Medicine list endpoint with pagination
│       ├── orders.ts        # Order creation + order history by user
│       ├── users.ts         # Fetch/update user profile
│       └── me.ts            # Current authenticated user endpoint
├── package.json             # Scripts and dependencies
└── README.md                # Basic setup instructions
```

## 4) Request/data flow you should understand first

1. Browser loads React app from Vite (dev) or `dist/` static files (prod).
2. React calls API endpoints under `/api/...`.
3. Route handlers query/update SQLite using prepared statements from `db.ts`.
4. Session + Passport determine authenticated user (`/api/me`, protected behaviors in UI).

## 5) Important implementation details

- `db.ts` executes `schema.sql` at startup, so table setup and seed inserts happen automatically.
- `src/App.tsx` is currently a single, large component containing most UI state and behaviors.
- Cart state is stored in `localStorage` and synchronized with React state.
- OAuth routes are conditionally registered only when required env vars exist.
- Orders are stored in `orders` + `order_items` and joined with `medicines` for display.

## 6) Running and checking locally

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Type check: `npm run lint`

You can inspect DB state directly because the SQLite file is local (`health_plus_store.db`).

## 7) Known caveats/newcomer gotchas

- `README.md` still references Gemini API setup; that appears to be generic template text and not the true runtime requirement of this app.
- Current type-checking reports a missing `db` reference in `server.ts` (deserializeUser path).
- `schema.sql` includes plain `INSERT INTO medicines ...` without an idempotent guard; repeated fresh DB initialization strategy should be reviewed if schema execution changes.

## 8) Best things to learn next

If you want to ramp quickly, learn in this order:

1. **Backend boot process** (`server.ts`) to see how middleware and routes are wired.
2. **Schema and route contracts** (`schema.sql`, `src/routes/*.ts`) to understand data model + API shape.
3. **Main UI state machine** (`src/App.tsx`) to follow user flows end-to-end.
4. **Auth/session lifecycle** (`src/routes/auth.ts`, `/api/me`) to understand login and identity handling.

## 9) Good first refactors

- Split `src/App.tsx` into focused components (header, product grid, cart modal, profile modal, orders modal).
- Add a shared API client layer with typed request/response shapes.
- Add route-level validation for request bodies (especially orders/profile updates).
- Move configuration and secrets to a documented `.env` contract.
- Add automated tests for route behavior and key UI flows.

