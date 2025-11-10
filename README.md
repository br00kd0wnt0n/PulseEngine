# Pulse: Storytelling Intelligence Platform

Monorepo containing the frontend (Vite + React + Tailwind) and backend (Node + TypeScript + TypeORM) prepared for Railway deployment.

## Apps
- Frontend: `PulseEngine/` (this folder)
- Backend: `backend/` (monorepo with `services/api` and `services/ingestion`)

## Frontend
- Tech: React 18 + TypeScript + Vite + Tailwind
- Dev: `npm install && npm run dev` (port 5173)
- Build: `npm run build` → `dist/`

## Backend
- Workspace root: `backend/`
- Services:
  - `api`: Auth (JWT), creators, trends, assets, AI narrative endpoint; PostgreSQL via TypeORM; RLS enabled
  - `ingestion`: URL/file ingest, metadata extraction, persists Content Assets
- Quick start:
  1. `cd backend && npm install`
  2. Copy `.env.example` to `.env` in `services/api` and `services/ingestion`
  3. Run migrations: `npm run migration:run -w api`
  4. Dev servers: `npm run dev -w api` and `npm run dev -w ingestion`

## Railway Deployment
- Root `railway.json` describes three services:
  - `api` (port 8080)
  - `ingestion` (port 8081)
  - `web` (optional; serves Vite preview on `$PORT`)
- Create a Railway project, add PostgreSQL plugin, set env vars:
  - API: `DATABASE_URL` (from plugin), `JWT_SECRET`, `OPENAI_API_KEY` (optional), `MODEL_NAME`
  - Ingestion: `DATABASE_URL`
  - Web: none required
- Deploy from GitHub repo; Railway will build each service via Nixpacks.

## OpenAPI
- `backend/openapi.yaml` defines core endpoints and JWT security.

## Notes
- DB uses JSONB for flexible metadata; RLS requires `app.set_current_user(uuid)` to be invoked per request (middleware provided).
- AI integration layer mocks output until an API key is provided.
- Frontend uses a conversational, narrative-first dashboard with intent-driven layout.

