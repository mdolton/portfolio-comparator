# Portfolio Comparator

A full-stack web application for tracking and comparing investment portfolios. Record buy/sell transactions, view holdings with real-time prices, and compare portfolio performance over time with interactive charts.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, React Router, Recharts
- **Backend:** Express 5, TypeScript, better-sqlite3
- **Shared:** TypeScript type definitions used by both client and server

## Prerequisites

- Node.js (v18+)

## Environment variables

| Variable | Required for | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI analysis feature | Anthropic API key. Without it the rest of the app works; only the **Generate Analysis** button on the portfolio detail page will fail. |

In development, set it inline when starting the backend:

```sh
ANTHROPIC_API_KEY=sk-ant-... npm run dev
```

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

## Production Deployment

### Build and push the Docker image

The `Makefile` supports any container registry. Set `REGISTRY` to your registry prefix:

```sh
# Docker Hub
make push REGISTRY=docker.io/myuser

# GitHub Container Registry
make push REGISTRY=ghcr.io/myuser

# AWS ECR
make push REGISTRY=123456789.dkr.ecr.us-east-1.amazonaws.com

# Custom image tag (defaults to "latest")
make push REGISTRY=ghcr.io/myuser IMAGE_TAG=v1.0.0
```

### Deploy with Docker Compose

Use `docker-compose.prod.yml` to run the pre-built image:

```sh
REGISTRY=ghcr.io/myuser docker compose -f docker-compose.prod.yml up -d
```

The app will be available on port 3001. SQLite data is persisted in a named Docker volume (`portfolio-data`).

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/portfolios` | List all portfolios |
| `POST` | `/api/portfolios` | Create a portfolio |
| `GET` | `/api/portfolios/:id` | Get portfolio with holdings |
| `DELETE` | `/api/portfolios/:id` | Delete a portfolio |
| `GET` | `/api/portfolios/:id/analysis` | Get the latest AI analysis for a portfolio (or null) |
| `POST` | `/api/portfolios/:id/analysis` | Generate (and replace) the AI analysis for a portfolio |
| `GET` | `/api/portfolios/:id/transactions` | List transactions for a portfolio |
| `POST` | `/api/portfolios/:id/transactions` | Add a transaction |
| `DELETE` | `/api/transactions/:id` | Delete a transaction |
| `GET` | `/api/market/search?q=` | Search for tickers |
| `GET` | `/api/performance?portfolioIds=&start=&end=` | Get performance data for comparison |
