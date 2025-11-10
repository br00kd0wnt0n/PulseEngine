# PulseEngine Database Setup Guide

## Overview
PulseEngine uses PostgreSQL with Row-Level Security (RLS) for multi-tenant data isolation.

## Migrations
Two migrations need to be applied:
1. **Initial Migration** - Creates core tables (users, creators, trends, content_assets)
2. **RLS Migration** - Adds Row-Level Security policies

## Setup on Railway

### 1. Verify PostgreSQL Plugin
Railway should have automatically provisioned a PostgreSQL database (configured in `railway.json`).

**Check in Railway Dashboard:**
- Go to your project
- Confirm the "postgres" plugin is added
- Note the DATABASE_URL variable is set

### 2. Set Environment Variables

In Railway dashboard, set these for the **API service**:

**Required:**
- `DATABASE_URL` - (Auto-set by Postgres plugin)
- `JWT_SECRET` - Generate with: `openssl rand -base64 32`
- `PORT` - `8080` (already set in railway.json)
- `NODE_ENV` - `production` (already set in railway.json)

**Optional:**
- `OPENAI_API_KEY` - For AI features
- `MODEL_NAME` - Default: `gpt-4o-mini`

### 3. Run Migrations

**Option A: Using Railway CLI (Recommended)**

```bash
# Install Railway CLI if not installed
npm install -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Run migrations on the API service
railway run --service api npm run migration:run
```

**Option B: Using Railway Dashboard**

1. Go to your API service in Railway
2. Click "Settings" → "Deploy"
3. Add a one-time deployment command:
   ```bash
   node migrate.cjs
   ```
4. After migrations complete, remove this command
5. Redeploy with normal start command: `node dist/src/index.js`

**Option C: Temporary Migration Service**

Add this to your `railway.json` temporarily:

```json
{
  "name": "migration",
  "rootDir": "backend/services/api",
  "build": { "cmd": "npm ci && npm run build" },
  "deploy": {
    "startCommand": "npm run migration:run && sleep 10",
    "restartPolicyType": "never"
  }
}
```

Then remove this service after migrations complete.

### 4. Verify Database Setup

**Check tables were created:**

```bash
# Using Railway CLI
railway run --service postgres psql $DATABASE_URL -c "\dt"
```

You should see:
- `users`
- `creators`
- `trends`
- `content_assets`

**Check RLS policies:**

```bash
railway run --service postgres psql $DATABASE_URL -c "SELECT tablename, policyname FROM pg_policies;"
```

## Database Schema

### Users Table
- Stores authentication and user data
- Fields: `id`, `email`, `passwordHash`, `role`, `createdAt`, `updatedAt`

### Creators Table
- Stores creator/influencer data
- Row-level security: Users can only access their own creators
- Fields: `id`, `name`, `platform`, `category`, `metadata`, `ownerId`

### Trends Table
- Stores trend analysis data
- Row-level security: Users can only access their own trends
- Fields: `id`, `label`, `signals`, `metrics`, `ownerId`

### Content Assets Table
- Stores uploaded content references
- Row-level security: Users can only access their own assets
- Fields: `id`, `name`, `url`, `tags`, `metadata`, `ownerId`

## Troubleshooting

### "Cannot find module '/app/dist/index.js'"
- Migrations need to run AFTER the build completes
- Make sure `npm ci && npm run build` runs before migrations

### "relation 'users' does not exist"
- Migrations haven't been applied yet
- Follow steps in Section 3 above

### Permission Errors
- Ensure DATABASE_URL has proper permissions
- Railway's Postgres plugin should provide full access automatically

## Development

To run migrations locally:

```bash
cd backend/services/api

# Set up environment
cp .env.example .env
# Edit .env with your local database URL

# Install dependencies
npm install

# Run migrations
npm run migration:run
```

## Rolling Back

To rollback migrations (if needed):

```bash
# Manually run down migrations
railway run --service api node -e "
require('reflect-metadata');
const { AppDataSource } = require('./dist/db/data-source');
AppDataSource.initialize()
  .then(() => AppDataSource.undoLastMigration())
  .then(() => AppDataSource.destroy())
  .then(() => console.log('Rolled back'))
  .catch(e => { console.error(e); process.exit(1); });
"
```
