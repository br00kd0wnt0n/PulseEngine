# Pulse Backend (Railway)

Services:
- `api` (Express + TypeORM): Auth, Creators, Trends, Content Assets, AI endpoints
- `ingestion` (Express): URL/file ingest, metadata extraction, persists Content Assets

Database: PostgreSQL (Railway). Uses RLS via `app.current_user_id` session variable.

Quick start (local):
- Prereqs: Node LTS, PostgreSQL, Railway CLI (optional)
- Copy `.env.example` to `.env` in each service and fill values
- Install deps: `npm install` in `backend/` (workspace root)
- Run migrations: `npm run migration:run -w api`
- Dev servers: `npm run dev -w api` and `npm run dev -w ingestion`

Deployment (Railway):
- Create a project, add PostgreSQL plugin, set env vars, deploy both services.

