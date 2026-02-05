# Portfolio Comparator

A full-stack web application for tracking and comparing investment portfolios. Record buy/sell transactions, view holdings with real-time prices, and compare portfolio performance over time with interactive charts.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, React Router, Recharts
- **Backend:** Express 5, TypeScript, better-sqlite3
- **Shared:** TypeScript type definitions used by both client and server

## Prerequisites

- Node.js (v18+)

## Getting Started

Install dependencies for both the frontend and backend:

```sh
npm install
cd server && npm install
```

Start the development servers (frontend + backend concurrently):

```sh
npm run dev
```

This runs:
- **Frontend** — Vite dev server with HMR (http://localhost:5173)
- **Backend** — Express API with hot reload via tsx (http://localhost:3001)

The Vite dev server proxies all `/api` requests to the backend, so the frontend just fetches from `/api/...` in development.

The SQLite database file (`server/data/portfolio.db`) is created automatically on first run.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start frontend and backend concurrently |
| `npm run build` | Type-check and build frontend for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run dev --prefix server` | Start only the backend server |

## Project Structure

```
src/                → React frontend
  pages/            → Route-level page components
  components/       → UI components
  hooks/            → Custom hooks for data fetching & state
  api/              → Typed HTTP client for the backend API
  utils/            → Formatting helpers
server/src/         → Express backend
  routes/           → API route handlers
  services/         → Business logic and database queries
  middleware/       → Error handling middleware
  db.ts             → SQLite database initialization and schema
shared/             → TypeScript types shared between frontend and backend
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/portfolios` | List all portfolios |
| `POST` | `/api/portfolios` | Create a portfolio |
| `GET` | `/api/portfolios/:id` | Get portfolio with holdings |
| `DELETE` | `/api/portfolios/:id` | Delete a portfolio |
| `GET` | `/api/portfolios/:id/transactions` | List transactions for a portfolio |
| `POST` | `/api/portfolios/:id/transactions` | Add a transaction |
| `DELETE` | `/api/transactions/:id` | Delete a transaction |
| `GET` | `/api/market/search?q=` | Search for tickers |
| `GET` | `/api/performance?portfolioIds=&start=&end=` | Get performance data for comparison |
