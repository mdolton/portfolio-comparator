# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev (frontend + backend):** `npm run dev` — runs Vite dev server and Express backend concurrently
- **Build:** `npm run build` — TypeScript check then Vite production build
- **Lint:** `npm run lint` — ESLint with TypeScript rules
- **Server only:** `npm run dev --prefix server` — runs backend with tsx watch on port 3001

There are no tests configured yet.

## Architecture

Full-stack TypeScript monorepo: React 19 frontend (Vite) + Express 5 backend (better-sqlite3).

### Three-layer structure

```
src/          → React frontend (Vite dev server)
server/src/   → Express API (port 3001, proxied via /api in dev)
shared/       → TypeScript types shared between client and server
```

### Backend: routes → services → database

Routes (`server/src/routes/`) are thin HTTP handlers that delegate to services (`server/src/services/`). Services contain business logic and database queries. `db.ts` initializes SQLite with WAL mode and foreign keys.

Key services:
- **marketService** — proxies Yahoo Finance APIs for ticker search, quotes, and historical prices
- **performanceService** — calculates portfolio value over time using forward-filled cached prices
- **transactionService** — manages buy/sell transactions with share balance validation (prevents negative positions)

### Frontend: pages → hooks → API client

Two pages (`DashboardPage`, `PortfolioPage`) use custom hooks (`src/hooks/`) for data fetching and state. Hooks call the typed API client (`src/api/client.ts`) which provides generic `api.get<T>()`, `api.post<T>()`, `api.delete<T>()` methods.

### Path aliases

Both frontend and backend use `@shared/*` to import from the `shared/` directory. Configured in `tsconfig.app.json`, `server/tsconfig.json`, and `vite.config.ts`.

### Database

SQLite with three tables: `portfolios`, `transactions`, `price_cache`. Database file lives at `server/data/portfolio.db` (gitignored). Schema is auto-created in `server/src/db.ts`.
