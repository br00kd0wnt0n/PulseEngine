# PulseEngine Development Roadmap

This document outlines the development phases, objectives, and technical implementation plan for PulseEngine.

## Phase 1 Key Objectives

### Story Input Mechanism
- Simple text/idea submission interface
- Initial narrative potential assessment
- Basic AI-generated context

### Multi-Format Content Upload
**Supported Formats:**
- Text documents (.txt, .docx)
- PDFs
- Images
- URLs
- Social media post links

### AI-Powered Analysis
- Initial narrative potential scoring
- Contextual trend mapping
- Basic creator/audience alignment

### Proprietary Ralph Scoring
- Narrative adaptability metric
- Cross-platform potential indicator
- Cultural relevance assessment

### Initial 3rd Party Data Integration
- Limited social media trend data
- Basic platform engagement metrics
- Minimal external API connections

### Technical MVP Scope
- Core PostgreSQL database
- Basic AI narrative generation
- Simplified dashboard
- Minimal viable upload/processing pipeline

### Deliberate Limitations
- No complex creator profiles
- Basic AI model (OpenAI)
- Limited trend historical data
- Simplified user authentication

### Success Metrics
- Functional story input
- Meaningful AI-generated insights
- Stable multi-format upload
- Basic proprietary scoring implementation

## Expansion Roadmap

### Phase 2 (Future)
- Enhanced creator profiles
- More sophisticated AI models
- Deeper trend analysis
- Expanded 3rd party integrations

---

## Implementation Plan

### Phase 0 — Enable OpenAI + Wire Frontend (1 day)

**Configure envs (API service)**
- Set `OPENAI_API_KEY` and optionally `MODEL_NAME` (default: `gpt-4o-mini`)

**Swap mock AI service for OpenAI**
- Replace the mock in AI service to call the OpenAI SDK for narratives
- Keep a fallback if key missing
- Add simple output caching (e.g., hash of inputs) to avoid repeat spend

**Frontend routing**
- Ensure `VITE_API_BASE` points to the deployed API
- Hook existing Narrative UI to backend `/ai/narrative`

**Acceptance Criteria:**
- Narrative Snapshot on the dashboard generates from the API with a real model
- Admin `/admin` shows preflight OK (envs set, DB up, ingestion reachable if configured)

---

### Phase 1 — Seed Realistic Demo Data (1–2 days)

**Seed script**
- Create a minimal seed script to populate Users, Creators, Trends, Content Assets with plausible cross-links (50–100 records total)
- Add trend linkages and simple metrics so the Trend Map and counts feel alive

**"Stories/Projects" model**
- Add a `projects` table to save a Story Prompt (concept), persona, and outputs (narrative, scores)
- Create endpoints: `POST /projects`, `GET /projects/:id`, `GET /projects`

**Acceptance Criteria:**
- Dashboard seeds produce meaningful graph/metrics
- Saving a Story Prompt creates a Project and reloads insights from saved data

---

### Phase 2 — Ingestion That Feels Real (2–3 days)

**URL ingest improvements**
- Enhance `/ingest/url` to fetch page metadata (title/description/og tags)
- Detect platform (TikTok/YouTube/IG)
- Normalize into `content_assets` with tags: platform, format, duration?, topic? (best-effort)

**File upload enrichment**
- For text/PDF: extract text (basic PDF metadata; full OCR optional later)
- For images/video: store metadata (filename, type, size) and create tags from filename heuristics

**Scoring pipeline (lightweight)**
- On asset create, run a quick scoring/tagging pass
- Keyword match + simple heuristics to update `trends.metrics` and `content_assets.tags`

**Acceptance Criteria:**
- Drag/drop + URL paste immediately surfaces richer metadata
- Adds links to related trends/creators
- Updates the Trend Ecosystem visualization

---

### Phase 3 — AI Insights That Drive the Demo (3–5 days)

**Narrative generation v2**
- Use structured prompt templates that reference: current trends, creator resonance, and concept text
- Output: short narrative, "why now", "hooks", "predicted time to peak"

**Predictive scoring**
- Add an `/ai/score` endpoint that takes a concept and returns:
  - `audiencePotential`
  - `narrativeStrength`
  - `timeToPeak`
  - `collaborationOpportunity`
- Cache by concept hash
- Render in the Project Potential Calculator

**Embeddings for smarter recommendations (optional)**
- Create embeddings for trend labels + creator tags (OpenAI `text-embedding-3-small`)
- Use cosine similarity to recommend creators and related trends beyond keyword overlaps

**Acceptance Criteria:**
- A new concept paste produces narrative + scores + creator recs that feel coherent and consistent when repeated

---

### Phase 4 — Persistence + Preferences (1–2 days)

**Save the Story Prompt (Projects)**
- The conversational prompt persists as a Project
- User can revisit + re-run

**Preferences (mock → saved)**
- Persist persona/platform/area settings per user
- Apply to narrative and scoring prompts

**Acceptance Criteria:**
- Returning users see their saved Project and tailored overview (no reset to mocks)

---

### Phase 5 — Observability + Guardrails (1 day)

**Rate limiting/circuit breaker**
- Rate-limit `/ai/*` and add exponential backoff on the client (avoid unexpected spend)

**Logging and metrics**
- Log inputs/outputs (safely) and errors to help tune prompts and catch failures

**Admin preflight + health checks**
- `/status/preflight` in admin shows env, DB, RLS, ingestion health
- Add a "Run Preflight" button on `/admin`

**Acceptance Criteria:**
- API/AI errors surface helpful messages
- Admin can verify health at a glance

---

## Data Model Additions

### New Tables

**projects**
```sql
id, ownerId, concept text, persona, platforms, areasOfInterest,
narrative text, scores jsonb, createdAt
```

**ai_cache**
```sql
id, key hash, payload jsonb, createdAt
```
Purpose: Avoid re-generating same outputs

**embeddings (Optional)**
```sql
entityType, entityId, vector
```
Purpose: If adopting embeddings for recommendations

---

## Backend Endpoints (Minimal Set)

### Authentication
- `POST /auth/register`
- `POST /auth/login`

### AI
- `POST /ai/narrative`
- `POST /ai/score` *(new)*

### Projects
- `POST /projects`
- `GET /projects/:id`
- `GET /projects`

### Ingestion
- `POST /ingest/url` *(enriched)*
- `POST /ingest/upload` *(enriched)*
- `POST /ingest/pdf` *(enriched)*

### Status
- `GET /status/overview`
- `GET /status/preflight`

---

## Frontend Updates

### Story Prompt Hero
- On submit, `POST /projects`, then render from saved project (narrative + scores)

### Project Potential Calculator
- Wire to `/ai/score` with caching
- Show recs using embeddings-based or improved heuristic matching

### Trend Ecosystem Map
- Color rings based on live `trends.metrics.potential` from DB
- Reflect ingestion updates

---

## OpenAI Integration Practices

### Model Selection
Use small, fast models where possible:
- **Narratives:** `gpt-4o-mini`
- **Embeddings:** `text-embedding-3-small`

### Caching Strategy
Cache aggressively:
- Hash input (graph snapshot + concept + persona)
- Store for 1–6 hours

### Cost Control
- Clamp context size
- Summarize trend graph before sending to models
- Add a daily call cap
- Feature flag to fall back to mock output if limit exceeded

---

## Seeding & Demo Playbook

### Seed Script Populates
- 20–30 trends with believable labels + platform signals
- 30–50 creators with tags (category, platform) and resonance/collab scores
- 50–100 content assets linked to trends/creators

### Preset "Story Prompt" Examples
1. Dance challenge + AI music + retro gaming angle
2. Tutorial-to-trend pipeline with creator collab
3. Fashion microtrend accelerated by IG Reels

### Demo Flow
1. Paste a concept
2. See narrative, scores, top creators, ecosystem lighting up
3. Tweak concept
4. Verify consistent result

---

## Security & Privacy

- Keep `OPENAI_API_KEY` as service env only; never expose to frontend
- Sanitize and log selectively
- Allow "redact PII" toggle for ingestion content

---

## Rough Timeline

| Timeline | Phase | Description |
|----------|-------|-------------|
| **Day 1** | Phase 0 | OpenAI wired, frontend connected |
| **Days 2–3** | Phase 1 | Seed data + projects model |
| **Days 4–6** | Phase 2 | Ingestion enrichment |
| **Days 7–10** | Phase 3 | AI narratives v2, scoring, recs |
| **Day 11** | Phase 4–5 | Persistence polish, admin checks, rate limiting |

---

## Current Status

### ✅ Completed
- Backend API deployed on Railway
- PostgreSQL database with RLS policies
- Frontend deployed and connected
- Admin dashboard functional
- Consolidated ingestion service into API
- Basic health checks and status monitoring

### 🚧 In Progress
- Phase 0: OpenAI integration setup

### 📋 Next Steps
1. Add `OPENAI_API_KEY` to Railway environment
2. Implement OpenAI-powered narrative generation
3. Create Projects model and endpoints
4. Build seed data script

---

## Architecture & Technical Stack

### Current MVP Architecture

**Database: PostgreSQL on Railway**
- Users, Creators, Trends, ContentAssets, Projects tables
- Row-Level Security (RLS) for multi-tenant isolation
- TypeORM for entity management and migrations

**Backend: Monolithic Node.js/Express API**
- TypeScript for type safety
- Single API service (`backend/services/api`)
- Routes: `/auth`, `/ai`, `/projects`, `/creators`, `/trends`, `/assets`, `/ingest`, `/status`
- Multer for in-memory file uploads (temporary storage)

**Frontend: React + Vite + TypeScript**
- Tailwind CSS with custom design system
- Context-based state management
- Progressive disclosure UI pattern
- Deployed to Railway

**AI Integration: OpenAI**
- Model: `gpt-4o-mini` (cost-effective, fast)
- Embeddings: `text-embedding-3-small` (optional, Phase 3)
- Caching strategy with hash-based deduplication

**Authentication**
- JWT-based authentication
- bcryptjs for password hashing
- Row-Level Security enforcement per user

**Deployment**
- Railway (single region)
- Automatic deployments from GitHub
- Environment-based configuration

---

### Content Processing Pipeline (MVP)

**Multiformat Content Ingestion**
- **Direct uploads:** Text, PDFs, images via multer
- **URL parsing:** Fetch metadata (title, description, og:tags) from web links
- **Platform detection:** TikTok, YouTube, Instagram, Twitter/X
- **Metadata storage:** All stored in PostgreSQL `content_assets` table

**Content Assessment Service**
- **Phase 2:** Basic keyword matching and tagging
- **Phase 3:** AI-powered content analysis using OpenAI
  - Extract topics and themes
  - Generate contextual tags
  - Calculate narrative potential
  - Link to relevant trends and creators

**Text Extraction (Phase 2+)**
- **PDFs:** Basic metadata extraction initially, full text extraction in Phase 2
- **Images:** Filename-based tagging initially, OCR/vision models later
- **Documents:** Direct text extraction for .txt, .docx support in Phase 2

---

### AI Integration Layer (Phase 0-3)

**Model Selection Framework**
- **Primary:** OpenAI GPT-4o-mini (narrative generation, content analysis)
- **Embeddings:** OpenAI text-embedding-3-small (similarity search, recommendations)
- **Future consideration:** Anthropic Claude, Google Gemini (multi-model support)

**Narrative Generation Service (Phase 3)**
- Structured prompts with context from:
  - Current trends from database
  - Creator profiles and resonance scores
  - User's concept text and preferences
- Output: Narrative, "why now", hooks, time-to-peak prediction
- Caching by input hash to reduce API costs

**Content Analysis Service (Phase 3)**
- `/ai/score` endpoint for predictive scoring:
  - `audiencePotential`: Target audience size and engagement likelihood
  - `narrativeStrength`: Story coherence and cultural relevance
  - `timeToPeak`: Predicted timeline to maximum virality
  - `collaborationOpportunity`: Recommended creator partnerships

**Smart Recommendations (Phase 3 - Optional)**
- Embeddings-based similarity for:
  - Trend-to-trend connections
  - Creator-to-concept matching
  - Content-to-audience alignment
- Cosine similarity search beyond simple keyword matching

---

### Authentication & User Management

**Current Implementation**
- JWT tokens with expiry
- bcryptjs password hashing (cost factor: 12)
- Row-Level Security (RLS) enforces data isolation per user
- Simple role field (`user` | `admin`)

**Creator Profile System (Phase 2+)**
- Extended user profiles with creator-specific metadata
- Portfolio/work showcase references
- Social media integration for verification

**Future: Social Authentication**
- OAuth integration (Google, Twitter, TikTok)
- Social media profile import
- Creator verification badges

---

### Data Processing Pipelines (Phase 1-3)

**Trend Mapping Service (Phase 1-2)**
- Cross-platform trend correlation via `platform_metrics` table
- Temporal trend analysis (createdAt, updatedAt tracking)
- Narrative potential scoring in `trends.metrics` JSONB field

**Creator Matching Engine (Phase 3)**
- Skill-based matching using creator tags
- Collaboration potential assessment from historical data
- Dynamic recommendations via embeddings similarity

**Ingestion Pipeline (Phase 2)**
- URL scraping with metadata extraction
- Platform detection and normalization
- Automatic tagging and trend linkage
- Update trend metrics when new content is added

---

### Monitoring & Observability (Phase 5)

**Logging**
- Pino structured logging (JSON format)
- Request/response logging via pino-http
- Error tracking with stack traces
- AI API call logging (inputs/outputs for prompt tuning)

**Performance Metrics**
- Database query performance (TypeORM logging)
- API endpoint response times
- AI API latency and cost tracking
- User interaction analytics (future)

**Health Checks**
- `/health` endpoint for service availability
- `/status/overview` for dashboard monitoring
- `/status/preflight` for comprehensive system checks

**Rate Limiting & Cost Control (Phase 5)**
- Rate limit AI endpoints to prevent abuse
- Daily API call caps with feature flags
- Exponential backoff on client for retries
- Cache-first strategy to minimize repeat calls

---

### Security & Compliance

**Data Security**
- PostgreSQL RLS for multi-tenant isolation
- JWT tokens for stateless authentication
- bcryptjs for secure password storage
- Environment variables for secrets (never in code)

**API Security**
- Helmet.js for HTTP security headers
- CORS configuration for frontend origin
- Input validation with Zod schemas
- SQL injection prevention via TypeORM parameterization

**Privacy Considerations**
- User data belongs to user (enforced by RLS)
- Optional PII redaction for ingested content
- GDPR/CCPA compliance considerations for future

**OpenAI Security**
- API key stored as server-side environment variable only
- Never exposed to frontend
- Content sanitization before sending to API
- Audit logging of AI requests

---

### Storage Strategy

**Current (MVP): Database-Only Storage**
- Content metadata in PostgreSQL `content_assets` table
- File uploads stored in-memory (Multer) then discarded
- URLs referenced, not downloaded/stored

**Phase 2: Persistent File Storage**
- Consider Railway Volume for uploaded files
- Or integrate AWS S3/CloudFlare R2 for scalable object storage
- Store references in database, actual files in object storage
- Tiered storage: hot (recent), cold (archived)

**Future: Content Processing Bucket**
- Temporary staging for AI processing jobs
- Queue-based processing for heavy operations (PDF OCR, video analysis)
- Webhook notifications when processing completes

---

### Future Architecture Considerations (Post-MVP)

**Scalability Path**
- Horizontal scaling: Deploy multiple API instances behind load balancer
- Database read replicas for high-traffic scenarios
- Redis caching layer for frequently accessed data
- Message queue (RabbitMQ/BullMQ) for async processing

**Microservices Decomposition (if needed)**
- Auth service (authentication/authorization)
- Ingestion service (content upload/processing)
- AI service (narrative generation, scoring)
- Analytics service (metrics, trends)

**Infrastructure Evolution**
- **Phase 1-3:** Monolith on Railway (current)
- **Phase 4+:** Consider containerization (Docker)
- **Scale phase:** Kubernetes orchestration (if traffic warrants)
- **Multi-region:** CDN for static assets, regional database replicas

**Advanced AI Features**
- Multi-model ensemble (OpenAI + Anthropic + Google)
- Fine-tuned models for domain-specific narrative generation
- RAG (Retrieval-Augmented Generation) with vector database
- Real-time trend prediction models

---

### Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Database** | PostgreSQL | Relational data with RLS |
| **Backend** | Node.js + Express + TypeScript | API server |
| **ORM** | TypeORM | Database entity management |
| **Frontend** | React + Vite + TypeScript | User interface |
| **Styling** | Tailwind CSS | Design system |
| **Authentication** | JWT + bcryptjs | User auth |
| **AI** | OpenAI (gpt-4o-mini) | Narrative generation |
| **File Upload** | Multer | In-memory processing |
| **Logging** | Pino | Structured logs |
| **Deployment** | Railway | Hosting + CI/CD |
| **Version Control** | Git + GitHub | Source control |

---

## Evolution Notes

**MVP → Phase 2 Transition:**
- Add persistent file storage (Railway Volume or S3)
- Implement content processing queue
- Enhance metadata extraction

**Phase 3 → Scaling:**
- Add Redis caching layer
- Implement embeddings for smart recommendations
- Optimize database queries with indexes

**Post-MVP Considerations:**
- Microservices architecture (if complexity grows)
- Message queue for async jobs
- Multiple AI model support
- Advanced analytics and monitoring

