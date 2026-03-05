# Spring Boot Backend Migration Plan (Express → Java)

This document explains exactly how to replace the current Express backend with a Spring Boot backend while keeping the React frontend functional with minimal API changes.

## 1) Current backend inventory

### Runtime and server bootstrap
- `server.ts` currently does all backend bootstrapping:
  - Express app creation
  - Session + Passport setup
  - API route mounting under `/api/*`
  - Vite middleware in dev / static serving in prod

### Data access
- `db.ts` initializes a local SQLite DB (`health_plus_store.db`) and executes `schema.sql` at startup.

### Route modules
- `src/routes/auth.ts`:
  - Google and Facebook OAuth with Passport
  - callback handlers and logout endpoint
- `src/routes/me.ts`:
  - returns the current session user (`/api/me`)
- `src/routes/medicines.ts`:
  - paginated list endpoint (`/api/medicines`)
- `src/routes/orders.ts`:
  - `GET /api/orders/:userId`
  - `POST /api/orders` (order + order items insert)
- `src/routes/users.ts`:
  - `GET /api/users/:userId`
  - `PUT /api/users/:userId`

### Database schema and seed data
- `schema.sql` defines:
  - `users`
  - `medicines`
  - `orders`
  - `order_items`
- includes initial medicine seed rows.

## 2) Target architecture with Spring Boot

Recommended architecture:

- **Frontend:** current React/Vite app (keep as-is)
- **Backend:** new Spring Boot service (default `localhost:8080`)
- **Dev integration:** Vite proxy `/api` to Spring Boot
- **Prod options:**
  1. Build/deploy frontend and backend separately, or
  2. Serve built frontend assets from Spring Boot

## 3) Files to replace/remove on backend side

Once migration is complete, these Node backend files are no longer needed:

- `server.ts`
- `db.ts`
- `src/routes/auth.ts`
- `src/routes/me.ts`
- `src/routes/medicines.ts`
- `src/routes/orders.ts`
- `src/routes/users.ts`
- `add_test_user.ts`

> Frontend files (`src/App.tsx`, `src/components/*`) can remain mostly unchanged if API contracts are preserved.

## 4) Spring Boot project skeleton to add

Suggested folder:

```text
backend/
  build.gradle or pom.xml
  src/main/java/com/healthplus/
    HealthPlusApplication.java
    config/
      SecurityConfig.java
      OAuth2LoginSuccessHandler.java
      CorsConfig.java
    controller/
      AuthController.java
      MeController.java
      MedicinesController.java
      OrdersController.java
      UsersController.java
    service/
      MedicinesService.java
      OrdersService.java
      UsersService.java
      AuthUserService.java
    repository/
      UserRepository.java
      MedicineRepository.java
      OrderRepository.java
      OrderItemRepository.java
    entity/
      User.java
      Medicine.java
      Order.java
      OrderItem.java
    dto/
      MedicineListResponse.java
      CreateOrderRequest.java
      CreateOrderItemRequest.java
      UserProfileUpdateRequest.java
      OrderResponse.java
      MeResponse.java
  src/main/resources/
    application.yml
    db/migration/V1__init.sql
```

## 5) API contract mapping (keep frontend compatible)

### Medicines
- Current: `GET /api/medicines?page=&limit=`
- Keep same response shape:

```json
{
  "medicines": [...],
  "total": 123,
  "page": 1,
  "limit": 8
}
```

### Orders
- Current:
  - `GET /api/orders/{userId}`
  - `POST /api/orders` with payload:

```json
{
  "user_id": 1,
  "items": [{ "medicine_id": 1, "quantity": 2, "price": 5.99 }],
  "total_price": 11.98
}
```

- Keep same payload keys initially to avoid frontend changes.

### Users
- Current:
  - `GET /api/users/{userId}`
  - `PUT /api/users/{userId}`

### Me/Auth
- Current:
  - `GET /api/me`
  - OAuth links used directly in frontend:
    - `/api/auth/google`
    - `/api/auth/facebook`
    - `/api/auth/logout`

Keep these paths stable during migration.

## 6) Database migration strategy

Current schema in `schema.sql` should be moved to Spring migrations, e.g. Flyway:

- `backend/src/main/resources/db/migration/V1__init.sql`
- optionally `V2__add_profile_picture.sql` (instead of runtime `ALTER TABLE` behavior)

This makes DB setup deterministic and avoids schema changes inside request handlers.

## 7) Security/OAuth equivalent in Spring

Map Passport session auth to Spring Security:

- add OAuth2 client config in `application.yml`
- configure providers (Google/Facebook)
- set success/failure redirects to mirror current behavior (`/` or `/login`)
- expose `/api/me` based on authenticated principal
- expose `/api/auth/logout` to invalidate session and redirect

## 8) Frontend/dev-server integration updates

Update `vite.config.ts` with API proxy in dev:

```ts
server: {
  hmr: process.env.DISABLE_HMR !== 'true',
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    }
  }
}
```

This allows frontend to keep calling relative `/api/*` URLs.

## 9) Dependency and script cleanup (after parity)

When Spring backend is fully live, remove Node backend dependencies from `package.json`:

- `express`, `express-session`, `passport`, `passport-google-oauth20`, `passport-facebook`, `better-sqlite3`, etc.

Then simplify scripts:

- `npm run dev` → Vite frontend only
- add root docs for running backend separately (`./gradlew bootRun` or `mvn spring-boot:run`)

## 10) Recommended rollout sequence

1. Create Spring app with `GET /api/medicines` first.
2. Add Vite proxy and verify frontend still renders medicine list.
3. Implement users endpoints.
4. Implement orders endpoints with transaction boundary.
5. Implement OAuth/login/me/logout.
6. Remove Express backend files/dependencies.
7. Update docs and CI scripts.

## 11) Risks and compatibility notes

- OAuth provider callback URLs must be updated to Spring endpoints.
- Session cookie settings (SameSite/Secure) may differ between Express and Spring.
- Keep JSON field names (`user_id`, `total_price`, etc.) for backward compatibility during first pass.
- Consider moving from SQLite to PostgreSQL for production once migration is stable.

## 12) Definition of done checklist

- [ ] Spring backend exposes all existing `/api/*` routes.
- [ ] Frontend works without API path changes.
- [ ] OAuth Google/Facebook login + logout works.
- [ ] `/api/me` returns authenticated user.
- [ ] `orders` creation and retrieval parity confirmed.
- [ ] DB migrations are versioned (Flyway/Liquibase).
- [ ] Node backend files removed.
- [ ] README updated with new run instructions.
