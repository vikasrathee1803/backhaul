# Backhaul — Deploy Runbook

> Step-by-step instructions for deploying Backhaul from scratch. Covers infrastructure provisioning, agent service deployment to Render, frontend deployment to Vercel, smoke testing, and rollback.

---

## Prerequisites

### Accounts Required

| Service | Plan | Purpose |
|---------|------|---------|
| [Vercel](https://vercel.com) | Free (Hobby) | Next.js frontend + BFF |
| [Render](https://render.com) | Free tier | Python FastAPI agent service |
| [Neon](https://neon.tech) | Free tier | PostgreSQL (orders, returns, decisions, audit log) |
| [Upstash](https://upstash.com) | Free tier | Redis (run state, policy cache) |
| [Braintrust](https://braintrust.dev) | Free tier | LLM observability + eval runner |
| [Sentry](https://sentry.io) | Free tier | Error monitoring (both runtimes) |
| [Anthropic](https://console.anthropic.com) | Pay-as-you-go | Claude Haiku + Sonnet API |

Estimated monthly cost at demo traffic levels: **$0** (all free tiers). Anthropic API costs approximately **$0.008 per full graph run** on fixture data.

### Tools

- Node.js 20+ and npm
- Python 3.11+
- git
- Vercel CLI: `npm install -g vercel`
- psql (PostgreSQL client): included in PostgreSQL install or `brew install libpq`)

---

## Step 1 — Provision Infrastructure

### 1a. Neon Postgres

1. Go to [neon.tech](https://neon.tech) and create a new project named `backhaul`.
2. Neon creates a default database named `neondb`. Leave that as-is.
3. In the project dashboard, click **Connection Details** and copy the connection string. It looks like:
   ```
   postgres://username:password@ep-something-12345.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Save this as `DATABASE_URL`. You will need it for both the agent service and the migration step.
5. Run the initial schema migration:
   ```bash
   psql "$DATABASE_URL" -f supabase/migrations/001_initial_schema.sql
   ```
6. Run the seed fixtures:
   ```bash
   psql "$DATABASE_URL" -f supabase/migrations/002_seed_fixtures.sql
   ```
7. Verify: `psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM returns;"` should return `52`.

### 1b. Upstash Redis

1. Go to [upstash.com](https://upstash.com) and create a new **Redis** database.
   - Name: `backhaul`
   - Region: `us-east-1` (or nearest to your Render region)
   - Type: Regional (not Global — not needed for this use case)
2. From the database detail page, copy:
   - `UPSTASH_REDIS_REST_URL` — looks like `https://us1-something-12345.upstash.io`
   - `UPSTASH_REDIS_REST_TOKEN` — a long base64 string

### 1c. Braintrust

1. Create an account at [braintrust.dev](https://braintrust.dev).
2. In the dashboard, create a new **Project** named `backhaul`.
3. Go to **Settings → API Keys** and create a new key. Copy it as `BRAINTRUST_API_KEY`.
4. The project slug (used in span routing) is `backhaul` — this matches the value hardcoded in `apps/agent/app/observability/braintrust_client.py`.

### 1d. Sentry

1. Create an account at [sentry.io](https://sentry.io).
2. Create two projects:
   - **Project 1**: Platform = `Next.js`, name = `backhaul-web`. Copy the DSN as `NEXT_PUBLIC_SENTRY_DSN`.
   - **Project 2**: Platform = `Python (FastAPI)`, name = `backhaul-agent`. Copy the DSN as `SENTRY_DSN`.

---

## Step 2 — Deploy Agent Service to Render

### 2a. Push to GitHub

The agent service must be in a GitHub repository for Render to deploy it.

```bash
git init
git remote add origin https://github.com/YOUR_USERNAME/backhaul.git
git add .
git commit -m "initial commit"
git push -u origin main
```

### 2b. Create Render Web Service

1. Go to [render.com](https://render.com) → **New → Web Service**.
2. Connect your GitHub account and select the `backhaul` repository.
3. Configure the service:

   | Setting | Value |
   |---------|-------|
   | **Name** | `backhaul-agent` |
   | **Root Directory** | `apps/agent` |
   | **Environment** | `Python 3` |
   | **Build Command** | `pip install -r requirements.txt` |
   | **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
   | **Instance Type** | Free |

4. Under **Environment Variables**, add all variables from the table in [Step 2c](#2c-agent-service-environment-variables).
5. Click **Create Web Service**.
6. Render will build and deploy. First deploy takes 3-5 minutes (dependency install). Watch the build logs.
7. Note your service URL: `https://backhaul-agent.onrender.com` (Render assigns this; the exact subdomain is random).

### 2c. Agent Service Environment Variables

Set all of these in the Render dashboard under **Environment → Environment Variables**:

| Variable | Required | Where to Get It |
|----------|----------|-----------------|
| `DATABASE_URL` | Yes | Neon connection string from Step 1a |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash dashboard from Step 1b |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash dashboard from Step 1b |
| `ANTHROPIC_API_KEY` | Yes | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `BRAINTRUST_API_KEY` | Optional | Braintrust dashboard from Step 1c. Spans skip gracefully if absent. |
| `SENTRY_DSN` | Optional | Sentry `backhaul-agent` project from Step 1d |
| `ENVIRONMENT` | Yes | Set to `production` |
| `LOG_LEVEL` | Optional | `INFO` (default). Use `DEBUG` for troubleshooting. |
| `CORS_ORIGINS` | Yes | `https://backhaul.vercel.app` (add your actual Vercel URL after Step 3) |
| `STRIPE_SECRET_KEY` | Optional | Stripe test-mode secret key (`sk_test_...`). Refund worker falls back to fixture mode if absent. |

---

## Step 3 — Deploy Frontend to Vercel

### 3a. Import Project

**Option A — Vercel CLI (recommended for first deploy):**
```bash
cd apps/web
vercel --prod
```
Follow the prompts:
- Link to existing project? **No** (first time)
- Project name: `backhaul`
- Root directory: `./` (you are already in `apps/web`)
- Override build settings? **No**

**Option B — Vercel dashboard:**
1. Go to [vercel.com/new](https://vercel.com/new).
2. Import your GitHub repository.
3. Set **Root Directory** to `apps/web`.
4. Vercel auto-detects Next.js. Leave build settings as defaults.

### 3b. Frontend Environment Variables

Set these in the Vercel dashboard under **Project → Settings → Environment Variables**, or pass them during `vercel env add`:

| Variable | Required | Where to Get It |
|----------|----------|-----------------|
| `NEXT_PUBLIC_AGENT_SERVICE_URL` | Yes | Your Render service URL from Step 2 (e.g. `https://backhaul-agent.onrender.com`) |
| `DATABASE_URL` | Yes | Neon connection string from Step 1a (used by BFF route handlers) |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash dashboard from Step 1b |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash dashboard from Step 1b |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | Sentry `backhaul-web` project from Step 1d |
| `SENTRY_AUTH_TOKEN` | Optional | Sentry → Settings → Auth Tokens. Required for source map upload. |
| `NEXTAUTH_SECRET` | Yes | Generate with: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | `https://backhaul.vercel.app` (your production URL) |
| `NEXT_PUBLIC_APP_ENV` | Yes | `production` |

### 3c. Update Render CORS

After Vercel assigns your production URL:
1. Go back to the Render dashboard for `backhaul-agent`.
2. Update `CORS_ORIGINS` to match your exact Vercel URL (e.g. `https://backhaul-v2.vercel.app` if `backhaul` was taken).
3. Render will restart the service automatically.

### 3d. Expected URLs

| Service | URL |
|---------|-----|
| Frontend | `https://backhaul.vercel.app` |
| Agent service | `https://backhaul-agent.onrender.com` |
| Demo page | `https://backhaul.vercel.app/demo` |
| Agent Ops view | `https://backhaul.vercel.app/ops` |

---

## Step 4 — Smoke Test

Run this checklist after both services are deployed. All items must pass before the deployment is considered production-ready.

### Agent Service Health

```bash
curl https://backhaul-agent.onrender.com/
# Expected: {"service":"backhaul-agent","version":"0.1.0","status":"ok"}

curl https://backhaul-agent.onrender.com/health
# Expected: {"status":"ok","database":"connected","redis":"connected"}
```

> Note: Render free tier spins down after 15 minutes of inactivity. The first request after a cold start takes 30-60 seconds. This is expected behavior on the free tier.

### Full Demo Flow

Open `https://backhaul.vercel.app/demo` and verify:

- [ ] **Returns queue loads** — 12 returns visible in the queue with status, marketplace badge, order value, and age
- [ ] **"Run triage" button** is present and enabled
- [ ] **Click "Run triage"** — the Agent Ops graph panel opens, nodes begin activating within 3 seconds
- [ ] **Parallel fan-out visible** — customer history, SKU profile, marketplace policy, damage signal, and fraud flag nodes activate near-simultaneously
- [ ] **Decision node activates** after all 5 context nodes complete
- [ ] **Worker nodes activate** — at least 3 different dispositions appear (refund, refurbish, escalate are the most common in the fixture set)
- [ ] **Cost meter increments** during the run and shows a total under $0.01 after completion
- [ ] **Decision drawer opens** when you click any completed return — shows disposition, confidence score (0-1), reasoning chain, and prompt version
- [ ] **Escalation queue** has at least 1 item (the fixture set includes a high-fraud-score return that should escalate)
- [ ] **Eval badge** shows 76/76 (or ≥69/76 if running against live LLM with prompt variance)
- [ ] **Override UI** — click the override button on any decision, select a different disposition, submit — the override appears in the escalation queue with a reason field

### Error States

- [ ] Navigate to `https://backhaul.vercel.app/returns/nonexistent-id` — verify the 404 page renders (not a crash)
- [ ] If Render agent service is cold (first load), verify the UI shows a loading state, not a blank page

---

## Environment Variables — Full Reference

### Web (Next.js) — `apps/web/.env.local`

```env
# Agent service
NEXT_PUBLIC_AGENT_SERVICE_URL=https://backhaul-agent.onrender.com

# Database (Neon)
DATABASE_URL=postgres://user:pass@ep-something.neon.tech/neondb?sslmode=require

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://us1-something.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token_here

# Auth
NEXTAUTH_SECRET=your_generated_secret_here
NEXTAUTH_URL=http://localhost:3000  # change to https://backhaul.vercel.app in production

# Observability
NEXT_PUBLIC_SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/789
SENTRY_AUTH_TOKEN=sntryu_your_token_here  # only needed for source map upload

# App
NEXT_PUBLIC_APP_ENV=development
```

### Agent Service (Python FastAPI) — `apps/agent/.env`

```env
# Database (Neon)
DATABASE_URL=postgres://user:pass@ep-something.neon.tech/neondb?sslmode=require

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://us1-something.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token_here

# AI
ANTHROPIC_API_KEY=sk-ant-your_key_here

# Observability
BRAINTRUST_API_KEY=your_braintrust_key_here  # optional; spans skip if absent
SENTRY_DSN=https://def456@o123456.ingest.sentry.io/101112

# Stripe (test mode only)
STRIPE_SECRET_KEY=sk_test_your_key_here  # optional; falls back to fixture mode

# Server
ENVIRONMENT=development
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:3000  # change to https://backhaul.vercel.app in production
PORT=8000
```

---

## Step 5 — Rollback

### Vercel Rollback

**Via CLI:**
```bash
vercel rollback
```
This rolls back to the previous production deployment instantly.

**Via dashboard:**
1. Go to `vercel.com/dashboard → backhaul → Deployments`
2. Find the last known-good deployment
3. Click the three-dot menu → **Promote to Production**

Vercel deployments are immutable and instant to promote. There is no downtime during a rollback.

### Render Rollback

1. Go to [render.com](https://render.com) → `backhaul-agent` service → **Deploys** tab
2. Find the last known-good deploy
3. Click **Re-deploy** on that entry

Render re-deploys from the exact same commit and image. Takes 2-3 minutes for the Python service.

### Database Rollback

Backhaul does not run destructive migrations in normal operation. If a bad migration was applied:

```bash
# Connect to Neon
psql "$DATABASE_URL"

# Check migration history
SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 10;

# Roll back the last migration (if a rollback script was generated)
\i supabase/migrations/001_initial_schema.down.sql
```

For the `decisions` and `audit_log` tables specifically: these are append-only by design (enforced by Postgres trigger). No rollback procedure touches these tables. They are the permanent record.

---

## Local Development

To run both services locally for development:

**Agent service:**
```bash
cd apps/agent
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env  # fill in your values
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd apps/web
npm install
cp .env.example .env.local  # fill in your values, set NEXT_PUBLIC_AGENT_SERVICE_URL=http://localhost:8000
npm run dev
```

Open `http://localhost:3000`.

**Running evals (no API key required):**
```bash
cd apps/agent
pytest evals/ -v --tb=short
# Runs 76 fixture-based tests against _rule_based_fallback_decision()
# No Anthropic API calls. Should complete in < 30 seconds.
```

---

*Last updated: Phase 5 deploy. See `/docs/BUILD_LEDGER.md` for deferred items (real Stripe wire-up, real marketplace API connections).*
