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

Secure object storage (Cloudflare R2 / S3 compatible):
- Configure in `backend/services/ingestion` via env:
  - `OBJ_ENDPOINT` – S3 endpoint (e.g., https://<accountid>.r2.cloudflarestorage.com)
  - `OBJ_REGION` – region (R2 uses `auto`)
  - `OBJ_BUCKET` – bucket name
  - `OBJ_ACCESS_KEY` / `OBJ_SECRET_KEY` – credentials
  - `DATA_KEY` or `DATA_KEY_V1` – 32‑byte key (hex or base64) for AES‑256‑GCM
  - `DATA_KEY_ID` – key id (e.g., `v1`) used for rotation
- Uploads are processed in memory and only minimal encrypted metadata is persisted to object storage.
- Generate keys with: `node backend/services/ingestion/scripts/generate-key.mjs`

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
