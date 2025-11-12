# Pulse Backend (Railway)

Services:
- Core API (Express + TypeORM): Auth, Creators, Trends, Content Assets, AI endpoints (/ai/narrative, /ai/score, /ai/recommendations)
- Ingestion (Express): URL/file ingest, metadata extraction, persists Content Assets (planned for production)

Database: PostgreSQL (Railway). Uses RLS via `app.current_user_id` session variable.

AI connection:
- Provider: OpenAI (config via `OPENAI_API_KEY`)
- Model: `MODEL_NAME` (default `gpt-4o-mini`)
- Used for narrative generation and recommendations with framework scores (market/narrative/commercial)

Live datasets / APIs (planned):
- Social trend APIs (TikTok/YouTube/Instagram) for trend/velocity signals
- Creator metrics and platform coverage
- Vector search (pgvector) for RAG over internal knowledge base

RAG knowledge base (internal):
- Admin dashboard exposes a drag‑and‑drop uploader with metadata to categorize briefs, proposals, case studies, industry data, and screengrabs.
- MVP stores metadata client‑side; production will route to Ingestion → storage → vector index.

Quick start (local):
- Prereqs: Node LTS, PostgreSQL, Railway CLI (optional)
- Copy `.env.example` to `.env` in each service and fill values
- Install deps: `npm install` in `backend/` (workspace root)
- Run migrations: `npm run migration:run -w api`
- Dev servers: `npm run dev -w api` and `npm run dev -w ingestion`

Deployment (Railway):
- Create a project, add PostgreSQL plugin, set env vars, deploy both services.

Key environment variables:
- `DATABASE_URL` – Postgres connection
- `JWT_SECRET` – API auth secret (future)
- `INGESTION_URL` – URL of ingestion service (optional in MVP)
- `OPENAI_API_KEY` – AI provider key
- `MODEL_NAME` – Model name (optional)
