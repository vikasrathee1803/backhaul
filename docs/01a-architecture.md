# 01a — Architecture

**Phase:** 1 — Architecture, Graph Design, Design System
**Track:** A — Architecture and graph topology
**Role:** architect
**Status:** Built — pending Phase 1 exit gate
**Date:** 2026-05-25

---

## Purpose

This document locks the stack, the runtime split, the service interaction model, the environment-variable schema, the gate commands, the monorepo layout, and the CI strategy for Backhaul. It resolves the three open tensions flagged at the Phase 0 exit gate (runtime split, persistence, streaming transport). The graph topology itself is specified in its own authoritative file, `/docs/01b-graph-topology.md`; this document covers everything around the graph.

**Carried forward from Phase 0 (`/docs/00-discovery.md`):**

- Single-tenant, fixture-driven. One Returns Ops Lead persona. No multi-tenancy, RBAC, or workspaces.
- The product *is* the agent system. The in-app Agent Ops view is the hero, not a dev tool.
- Cost ceiling is a hard gate: a graph run over $0.10 is a bug. Demo target is under $0.01 per decision.
- Eval suite is the source of truth: 50+ golden cases, 90%+ accuracy in CI, no live API calls in CI.
- Model IDs are locked in `STACK_CONFIG.md`: `claude-sonnet-4-6` (default), `claude-haiku-4-5-20251001` (cheap/fast), `claude-opus-4-7` (complex reasoning, Decision Agent eval candidate).

---

## 1. Stack Decision Log

Each decision records: the question, the options weighed, the choice, the reasoning, the tradeoffs accepted, and the downstream consequences.

### 1.1 Runtime split — Two-runtime (Python agent service + TS BFF)

| Field | Detail |
|---|---|
| **Decision** | Two-runtime split: Python FastAPI + LangGraph for the agent service, TypeScript Next.js (App Router) for the frontend and BFF. |
| **Options considered** | (A) **Two-runtime**: Python FastAPI + LangGraph (agents) behind a thin Next.js BFF. (B) **Full TypeScript**: LangGraph.js + Next.js, single runtime, no HTTP hop. |
| **Chosen** | **Option A — two-runtime.** |
| **Reasoning** | LangGraph Python's streaming API (`astream_events`, `stream_mode`) is production-grade and well-documented; the `Send` fan-out API and `interrupt`/`Command(resume=...)` human-in-the-loop primitives are mature. LangGraph.js trails on streaming ergonomics and has thinner Braintrust/LangSmith integration. The BFF is a thin HTTP/SSE proxy, so the runtime boundary is clean and narrow — the only cross-runtime surface is three route handlers. The brief defaults to Python for the agent layer for exactly these reasons. |
| **Tradeoffs accepted** | Two language toolchains (Node + Python) to manage; Docker/process management for the agent service in deploy; Python virtualenv discipline; one extra network hop (BFF → agent) on the critical streaming path. |
| **Consequences** | Monorepo with `apps/web` (Next.js) and `apps/agent` (Python). Deploy splits across Vercel (web) and Render/Railway (agent). The BFF never runs LLM logic — it proxies. The SSE-passthrough design (§2) keeps the extra hop from re-buffering and killing the real-time feel; the hop is benchmarked in Phase 2 scaffolding (Risk #6). |

Resolves Phase 0 open tension #1 and confirms ASSUMPTIONS #1, #3.

### 1.2 Graph state management — Namespaced TypedDict with degrade-don't-hang fan-in

| Field | Detail |
|---|---|
| **Decision** | A single `BackhaulState` `TypedDict` with one namespaced sub-state key per agent. The five parallel agents each write only their own key; the Decision Agent reads a curated projection of all five. Partial failure is tolerated via an `errors` dict keyed by agent name. |
| **Options considered** | (A) Flat dict, last-write-wins. (B) Namespaced sub-state per agent with typed reducers and degrade-on-failure fan-in. (C) External context store (Redis/Postgres), state holds references only. |
| **Chosen** | **Option B.** |
| **Reasoning** | Namespacing eliminates concurrent-write clobbering during the five-way fan-out (each node owns a disjoint key). A curated projection into the Decision Agent keeps the prompt — and therefore the cost meter — honest, rather than serializing a fat blob. The fan-in is a conditional barrier that proceeds once every parallel branch has either written its key or recorded an error, so one failed branch never hangs the run (and therefore never freezes the hero screen). |
| **Partial-failure contract** | Each parallel agent on failure writes `errors[agent_name] = "<reason>"` and leaves its state key `None`. The Decision Agent treats a `None` key as `"unknown"` for that signal, proceeds with available context, and lowers its confidence accordingly — which can itself trip the escalation threshold (Hard Decision #1). The run completes; the gap is visible in the audit trail. |
| **Tradeoffs accepted** | Slightly more boilerplate (one schema per agent); the Decision Agent's projection logic must be kept in sync with the upstream schemas. |
| **Consequences** | The full `BackhaulState` and every sub-schema are specified in `/docs/01b-graph-topology.md §2` and implemented in `apps/agent/app/graph/state.py`. The `errors` dict surfaces as "degraded signal" badges in the Agent Ops decision drawer. |

Resolves Phase 0 Hard Decision #2.

### 1.3 Real-time streaming — SSE, BFF-proxied, with persisted replay

| Field | Detail |
|---|---|
| **Decision** | Server-Sent Events (SSE) emitted by the FastAPI agent service, tunnelled through a Next.js BFF route handler to the browser. Every event is also persisted to `decision_steps` so the Agent Ops view has a replay/fallback source. |
| **Options considered** | (A) WebSocket (bidirectional). (B) SSE (one-way, auto-reconnecting). (C) Poll the persisted `decision_steps` table. |
| **Chosen** | **Option B as primary, with (C) as the replay/fallback source.** |
| **Reasoning** | The Agent Ops view only listens — control flows server→client. SSE matches that exactly, auto-reconnects with `Last-Event-ID`, proxies trivially through a Next.js route handler, and works through Vercel's edge. WebSocket's bidirectionality would go unused while adding connection-lifecycle and heartbeat complexity. |
| **Demo resilience** | All graph execution events are persisted to `decision_steps` as they stream. `/agent-ops/[runId]` has a replay mode that reads persisted steps if the live stream is missed or dropped, so the demo never shows an empty graph. A configurable node-transition pacing delay in the agent service ensures sub-3-second runs still visibly *execute* rather than blinking to done. |
| **Tradeoffs accepted** | One-way only; any future bidirectional need (e.g. live operator-to-agent nudging) requires a WebSocket retrofit — deferred to v2. |
| **Consequences** | Three BFF route handlers: `api/graph/run` (trigger), `api/graph/stream` (SSE proxy), `api/graph/override` (HITL resume). The agent service exposes `POST /graph/run` and `GET /graph/stream/{run_id}`. SSE event schema is specified in `/docs/01b-graph-topology.md §6`. |

Resolves Phase 0 Hard Decision #3 and confirms ASSUMPTIONS #2.

### 1.4 Database — Neon Postgres via Supabase JS client, no ORM, single-tenant

| Field | Detail |
|---|---|
| **Decision** | Neon serverless Postgres as the database. The Next.js side uses the Supabase JS client directly (no ORM). Row-level security is disabled for v1; a single seeded admin user. The Python agent service connects over `DATABASE_URL` (asyncpg / SQLAlchemy core). |
| **Options considered** | Neon Postgres vs Supabase-hosted Postgres. ORM (Prisma/Drizzle) vs direct client. RLS on vs off. |
| **Chosen** | **Neon Postgres; direct Supabase JS client on web; direct SQL on agent; no ORM; RLS off.** |
| **Reasoning** | Neon is Postgres-compatible and serverless (scales to zero, fits a portfolio budget) and is the brief's named target. The Supabase JS client gives a clean typed query surface on the web side without an ORM build step (`STACK_CONFIG.md` mandates no Prisma/Drizzle). RLS adds no value in a single-tenant tool with one user, and turning it off removes a class of "why is my query returning nothing" friction during the build. |
| **Tradeoffs accepted** | Two DB access paths (Supabase JS on web, raw SQL on agent) must agree on schema — the shared `/packages/types` package is the contract. No ORM means hand-written queries. |
| **Consequences** | Schema lives in `/docs/01d-schema.md` (Phase 1C). The agent service is the sole writer of `decision_steps` and `audit_log`; the web app reads them and writes `overrides`. Resolves Phase 0 open tension #2 (Neon, not Supabase-hosted) while keeping the Supabase *client* libraries from `STACK_CONFIG.md`. |

### 1.5 Queue / graph-job state — Upstash Redis, QStash if durable delivery needed

| Field | Detail |
|---|---|
| **Decision** | Upstash Redis (REST) for live graph-run state and the LangGraph checkpoint store. QStash reserved for durable job delivery only if a fire-and-forget queue is needed. |
| **Options considered** | Upstash Redis vs in-process state vs a full broker (Celery/RQ). |
| **Chosen** | **Upstash Redis (REST), QStash on standby.** |
| **Reasoning** | A single demo seller does not need a heavyweight broker. Redis holds the current-node/progress snapshot for fast reads and backs the LangGraph checkpointer that the human-in-the-loop interrupt/resume mechanism requires. Upstash's REST interface works from both the serverless web edge and the Python service. |
| **Key pattern** | `graph:run:{run_id}:state` — current node, progress, status. LangGraph checkpoints under `graph:run:{run_id}:checkpoint`. |
| **Tradeoffs accepted** | Redis is the source of truth for *live* run state but not the durable record — Postgres (`decision_steps`, `agent_runs`) is. A Redis eviction mid-run degrades to the persisted replay path, not data loss. |
| **Consequences** | The HITL checkpoint (Phase 0 Risk #10) persists graph state to Redis under the run_id; `POST /graph/override` resumes from it. Confirms ASSUMPTIONS #4 (Neon scale) is independent of queue choice. |

### 1.6 Observability — Braintrust (evals + traces + cost) and Sentry (errors), plus in-app tables

| Field | Detail |
|---|---|
| **Decision** | Two dev-facing layers plus one user-facing layer. Braintrust for eval-gated CI, per-agent traces, and cost analytics. Sentry for runtime error monitoring on both runtimes. Custom `agent_runs` + `decision_steps` Postgres tables power the in-app Agent Ops view. |
| **Reasoning** | The brief mandates two first-class observability layers: a user-facing Agent Ops view (the Ops Lead lives here) and a dev-facing layer (Braintrust). These are different audiences with different needs, so they get different stores. The Agent Ops view must not depend on Braintrust being reachable — it reads its own Postgres tables — so the demo is resilient if Braintrust is down. |
| **Per-node contract** | Every LLM node opens a Braintrust span named `backhaul.{agent_name}` recording model, prompt version, input projection, output, confidence, tokens, cost, latency. The same facts are written to `decision_steps` for the in-app view. One decision → one `agent_runs` row → N `decision_steps` rows (one per node visited). |
| **Tradeoffs accepted** | Facts are written twice (Braintrust span + Postgres row). Accepted because the two audiences and resilience requirements justify the duplication; a single shared writer helper keeps them in sync. |
| **Consequences** | Braintrust API key is agent-service-only. Eval suite (`apps/agent/evals/`) runs against fixtures in CI without the live API; a separate main-branch CI job runs the Braintrust-backed eval. Confirms ASSUMPTIONS #16, #17. |

### 1.7 Prompt versioning — files in `/prompts/{agent}/v{N}.md`, tracked in `prompt_versions`

| Field | Detail |
|---|---|
| **Decision** | Every prompt is a versioned file at `apps/agent/prompts/{agent_name}/v{N}.md`. The `prompt_versions` table records which version produced which decision. Agent code reads prompts from files; prompts are never hardcoded inline. |
| **Reasoning** | Hard Rule 11 requires a versioned prompt per agent; Hard Rule 13 requires every decision to record its prompt version. Files give clean diffs and reviewability for hiring managers (the brief calls `/prompts/` a portfolio-readable artifact). The A/B comparison feature on the Agent Ops view (last week vs this week) needs a stable version identity, which the `v{N}` filename plus the `prompt_versions` row provides. |
| **Tradeoffs accepted** | A prompt edit is a new file (`v2.md`), not an in-place change, to preserve the audit chain. |
| **Consequences** | A prompt loader in `apps/agent/app/graph/nodes/` resolves the active version per agent from config; CI fails if an LLM node references a prompt file that does not exist. The prompt registry table is in `/docs/01b-graph-topology.md §8`. |

### 1.8 Monorepo structure — single repo, two apps, shared types

| Field | Detail |
|---|---|
| **Decision** | One Git repo. Two apps: `apps/web` (Next.js) and `apps/agent` (Python FastAPI). Shared contracts in `packages/types` (TypeScript interfaces, mirrored as Python dataclasses). Turborepo orchestrates the web side; standard Python tooling (`pip` + `pyproject`/`requirements.txt`, `ruff`, `mypy`, `pytest`) the agent side. |
| **Options considered** | Monorepo vs two separate repos. Turborepo vs npm workspaces alone. |
| **Chosen** | **Monorepo, Turborepo for web, native Python tooling for agent.** |
| **Reasoning** | One repo keeps the cross-runtime contract (`packages/types`) atomic with both consumers and lets one CI workflow gate both runtimes. The state schemas and SSE event shapes are the contract surface; keeping them in one place prevents drift between the TS BFF and the Python graph. Turborepo gives caching and task orchestration on the JS side; Python keeps its own toolchain rather than being forced under a JS task runner. |
| **Tradeoffs accepted** | Two toolchains in one repo; contributors need both Node and Python installed locally. The TS↔Python type mirror in `packages/types` is maintained by hand (kept small and contract-only to limit the surface). |
| **Consequences** | Directory tree in §5. CI has two parallel jobs (web, agent) plus a main-branch eval job. Deploy targets read from their own app directory. |

---

## 2. Service Interaction Diagram

The full request/event flow, from a "Run triage" click to a streamed graph execution rendered live in the Agent Ops view:

```
                            TRIGGER (POST)
Browser ───────────────────────────────────────────────► Next.js BFF
  │  POST /api/graph/run { returnId }                        (route handler)
  │                                                            │
  │                                                            │ forwards w/ AGENT_SERVICE_SECRET header
  │                                                            ▼
  │                                              FastAPI agent service
  │                                                POST /graph/run
  │                                                    │
  │                                                    ▼
  │                                            LangGraph graph runner
  │                                            - creates run_id
  │                                            - persists run state → Upstash Redis
  │                                            - begins async execution
  │                                                    │
  │   ◄──────── { run_id } ◄──────── BFF ◄──────── 202 Accepted { run_id }
  │
  │                            STREAM (SSE, one-way server→client)
  │  GET /api/graph/stream?runId=... (EventSource, Last-Event-ID on reconnect)
  ├───────────────────────────────────────────────────► Next.js BFF
  │                                                        (SSE proxy route handler)
  │                                                            │
  │                                                            │ opens upstream SSE w/ secret header
  │                                                            ▼
  │                                              FastAPI agent service
  │                                              GET /graph/stream/{run_id}
  │                                                    │
  │                                                    │  graph emits GraphEvent per node transition
  │                                                    │  (node_started / node_completed / node_failed /
  │                                                    │   decision_made / escalation / cost_update /
  │                                                    │   run_completed / run_failed)
  │                                                    │  each event ALSO persisted → decision_steps
  │                                                    ▼
  │                                            FastAPI SSE endpoint
  │   ◄── SSE event ◄── BFF passthrough ◄── SSE event (id: <seq>, data: <GraphEvent JSON>)
  │
  ▼
Agent Ops view renders node-state transitions, edge animations, cost meter live.

                            HUMAN-IN-THE-LOOP (escalation resume)
Browser ──► POST /api/graph/override { runId, disposition, reason }
            ──► BFF ──► FastAPI POST /graph/override
                          ──► LangGraph Command(resume=HumanOverride) from Redis checkpoint
                          ──► graph re-enters appropriate worker → comms → audit
                          ──► override captured into eval dataset (overrides table)
```

**How the BFF forwards the SSE stream.** The `api/graph/stream` route handler opens an upstream `fetch` to the FastAPI `GET /graph/stream/{run_id}` endpoint with `AGENT_SERVICE_SECRET` in the header, then pipes the upstream `ReadableStream` straight back to the browser with `Content-Type: text/event-stream`, `Cache-Control: no-cache`, and `Connection: keep-alive`. No re-buffering: each chunk is forwarded as it arrives so the extra hop adds no perceptible latency. The browser's `EventSource` handles auto-reconnect; the BFF forwards the `Last-Event-ID` request header upstream so the agent service can resume from the last delivered sequence number.

**How auth is passed.** v1 is single-tenant with one seeded admin user. The browser carries a single seeded session token (Supabase session cookie). The BFF validates the session, then attaches the shared `AGENT_SERVICE_SECRET` as a bearer/`X-Agent-Secret` header on every BFF→agent request. The agent service rejects any request missing the correct secret. The browser never talks to the agent service directly and never sees the secret or the `ANTHROPIC_API_KEY`.

**How the graph run ID is tracked.** The agent service mints `run_id` (UUID) on `POST /graph/run`, returns it in the 202 response, writes the live state to Redis at `graph:run:{run_id}:state`, and opens an `agent_runs` row keyed by `run_id`. The browser then opens the SSE stream by `run_id`. Every persisted `decision_steps` row and every `GraphEvent` carries the `run_id`, so the live stream, the replay path (`/agent-ops/[runId]`), and the audit trail all key off the same identifier.

---

## 3. Environment Variables

Two runtimes, two env files. No variable appears in both unless it must (e.g. `ANTHROPIC_API_KEY` is needed by the agent service; the BFF holds it only for any direct server-side draft helper and never exposes it to the browser). Anything prefixed `NEXT_PUBLIC_` is browser-exposed by design; everything else is server-only.

### 3.1 Next.js (frontend + BFF) — `apps/web/.env.example`

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Supabase/Neon project URL for the JS client. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Public anon key for the browser Supabase client. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Service-role key for the admin client; never imported in a `"use client"` file. |
| `ANTHROPIC_API_KEY` | Server only (BFF) | Anthropic key; BFF-only, never exposed to the browser. |
| `STRIPE_SECRET_KEY` | Server only | Stripe test-mode secret key. |
| `STRIPE_PUBLISHABLE_KEY` | Browser | Stripe test-mode publishable key. |
| `STRIPE_WEBHOOK_SECRET` | Server only | Verifies inbound Stripe webhook signatures. |
| `UPSTASH_REDIS_REST_URL` | Server only | Upstash Redis REST endpoint. |
| `UPSTASH_REDIS_REST_TOKEN` | Server only | Upstash Redis REST auth token. |
| `AGENT_SERVICE_URL` | Server only | Internal URL of the FastAPI service (e.g. `http://localhost:8000`). |
| `AGENT_SERVICE_SECRET` | Server only | Shared secret the BFF sends to authenticate to the agent service. |
| `NEXT_PUBLIC_POSTHOG_KEY` | Browser | Optional analytics project key. |
| `NEXT_PUBLIC_POSTHOG_HOST` | Browser | Optional analytics host. |
| `SENTRY_DSN` | Server only | Sentry DSN for server-side error capture. |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser | Sentry DSN for browser error capture. |

### 3.2 Python FastAPI agent service — `apps/agent/.env.example`

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string for Neon (the agent service's direct SQL path). |
| `ANTHROPIC_API_KEY` | Anthropic key for all LLM nodes. |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint for live run state + LangGraph checkpoints. |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST auth token. |
| `BRAINTRUST_API_KEY` | Braintrust API key for spans, traces, and eval logging. |
| `STRIPE_SECRET_KEY` | Stripe test-mode key for the Refund Worker. |
| `AGENT_SERVICE_SECRET` | Validates incoming BFF requests; rejects any request missing/mismatching it. |
| `SENTRY_DSN` | Sentry DSN for agent-service error capture. |
| `ENVIRONMENT` | `development` | `production` — toggles pacing delays, log verbosity, and Sentry sampling. |

---

## 4. Gate Commands

These commands must all pass before any phase is declared done. Both runtimes gate. Paste output into the phase deliverable doc per Hard Rule 4.

### 4.1 `apps/web` (Node 20)

```bash
npx tsc --noEmit          # TypeScript strict check, zero errors
npm run lint              # ESLint
npm run build             # Next.js production build, all routes compile
npm run test              # Vitest
```

### 4.2 `apps/agent` (Python 3.11)

```bash
mypy .                    # Static type check
ruff check .              # Lint
pytest                    # All tests, including fixture-based evals (no live API)
```

**Rule:** a graph run that exceeds $0.10 fails `pytest` as a bug, not a warning (Hard Rule 16). The fixture-based eval suite must pass at 90%+ accuracy in CI (Success Criterion 3). CI never calls the live Anthropic API — see §6.

---

## 5. Monorepo Directory Structure

```
backhaul/
├── apps/
│   ├── web/                          # Next.js App Router (frontend + BFF)
│   │   ├── app/
│   │   │   ├── (marketing)/          # public marketing, no auth
│   │   │   ├── demo/                 # public demo mirror of the app
│   │   │   │   ├── _mock/data.ts     # all demo data in one file
│   │   │   │   ├── dashboard/
│   │   │   │   ├── returns/
│   │   │   │   ├── agent-ops/
│   │   │   │   ├── escalations/
│   │   │   │   ├── evals/
│   │   │   │   ├── audit/
│   │   │   │   └── settings/
│   │   │   ├── api/
│   │   │   │   ├── graph/run/route.ts        # POST → triggers a graph run
│   │   │   │   ├── graph/stream/route.ts     # GET → SSE proxy to agent service
│   │   │   │   └── graph/override/route.ts   # POST → human override / HITL resume
│   │   │   ├── globals.css           # single source of design tokens
│   │   │   └── layout.tsx            # root layout (fonts, PostHog, Sentry, metadata)
│   │   ├── components/
│   │   │   ├── shared/               # Sidebar, TopBar
│   │   │   ├── demo/                 # DemoShell, DemoDetailPanel, Tour
│   │   │   └── agent-ops/            # GraphCanvas, NodeCard, DecisionDrawer, CostMeter
│   │   ├── lib/
│   │   │   ├── supabase/             # client.ts, server.ts, admin.ts
│   │   │   └── auth/                 # session helpers (single seeded admin user)
│   │   ├── .env.example
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   └── agent/                        # Python FastAPI + LangGraph (agent service)
│       ├── app/
│       │   ├── main.py               # FastAPI app, health endpoint, error handler
│       │   ├── graph/
│       │   │   ├── topology.py       # THE ONE FILE that defines the graph
│       │   │   ├── state.py          # BackhaulState TypedDict + sub-schemas
│       │   │   └── nodes/            # one file per agent node (15)
│       │   ├── workers/              # refund, replacement, repair, refurb, donate/dispose
│       │   ├── api/
│       │   │   ├── runs.py           # POST /graph/run, POST /graph/override
│       │   │   └── stream.py         # GET /graph/stream/{run_id}  (SSE)
│       │   └── db/                   # Postgres client + queries
│       ├── prompts/                  # versioned prompt files
│       │   └── {agent_name}/v1.md
│       ├── evals/                    # golden test cases + harness
│       ├── fixtures/                 # all fixture data
│       ├── config/
│       │   └── marketplaces/         # one YAML per channel (policy source of truth)
│       ├── .env.example
│       ├── requirements.txt
│       ├── pyproject.toml            # ruff + mypy config
│       └── tests/
├── packages/
│   └── types/                        # shared TS interfaces (mirrored as Python dataclasses)
├── docs/                             # all phase docs
│   ├── 00-discovery.md
│   ├── 01a-architecture.md
│   ├── 01b-graph-topology.md
│   ├── 01c-design-system.md
│   ├── 01d-schema.md
│   ├── BUILD_LEDGER.md
│   └── ASSUMPTIONS.md
├── .github/
│   └── workflows/
│       └── ci.yml
├── turbo.json
└── README.md
```

---

## 6. CI Strategy

CI gates both runtimes on every push and pull request; the live-API eval runs only on `main`. The fixture-based eval suite runs in every job and never calls the Anthropic API (the live key is absent in PR/branch jobs and the harness skips live tests when `SKIP_LIVE_TESTS` is set).

**Trigger:** push to `main`, push to any branch, and `pull_request`.

**Jobs and ordering:**

| Job | Runs on | Runtime | Steps | Caching |
|---|---|---|---|---|
| `web` | every trigger | Node 20 | checkout → `npm ci` (in `apps/web`) → `tsc --noEmit` → `eslint` → `next build` → `vitest run` | `node_modules` keyed by `package-lock.json` |
| `agent` | every trigger | Python 3.11 | checkout → `pip install -r requirements.txt` (in `apps/agent`) → `mypy` → `ruff check` → `pytest` (live tests skipped via `SKIP_LIVE_TESTS=1`) | pip cache keyed by `requirements.txt` |
| `eval` | push to `main` only | Python 3.11 | requires `web` + `agent` green → `pytest evals/` with `BRAINTRUST_API_KEY` secret | pip cache |

**What gates what.**

- `web` and `agent` run in parallel and are independent — a failure in either fails the workflow.
- The fixture-based portion of the eval suite runs *inside* the `agent` job's `pytest`, so every PR is gated on 90%+ golden-case accuracy without touching the live API.
- The `eval` job (Braintrust-backed, may call the live API) only runs after both core jobs pass and only on `main`, so secret usage and API cost are confined to the protected branch.
- A graph run exceeding the $0.10 ceiling fails the `agent` job (cost assertion in `pytest`), consistent with Hard Rule 16.

**Why this shape.** It keeps PRs fast and free (no live API, no secrets), keeps the cost ceiling enforced as a hard test, and reserves the one job that consumes Braintrust quota and API budget for `main`. The eval suite being the merge gate operationalizes Success Criterion 3: hiring managers can read `apps/agent/evals/` and the CI config and see exactly what "the agent works" means.

---

## Anti-Drift Checklist (Phase 1A boundary)

1. **Deliverable doc written?** Yes — this file, plus `/docs/01b-graph-topology.md`, `/apps/web/.env.example` (`.env.example`), `/apps/agent/.env.example`, `/.github/workflows/ci.yml`.
2. **BUILD_LEDGER updated?** Phase 1A rows move `planned → built` (architecture doc, graph topology doc, SSE protocol spec, Braintrust wiring spec, env var schema, CI scaffold).
3. **Gate commands defined?** Yes — §4, both runtimes. No code yet to run them against; first run is Phase 2.
4. **Deferred items?** Unchanged from Phase 0; WebSocket bidirectional, light theme, real APIs remain deferred.
5. **Assumptions logged?** This doc confirms ASSUMPTIONS #1, #2, #3, #4, #16, #17; no new assumptions introduced.
6. **Re-read discovery — anything unaccounted for?** All seven screens map to routes in §5; all fifteen agents map to nodes in `01b`. Six channels map to `config/marketplaces/`.
7. **Prior-phase commitments carried forward?** The three Phase 0 open tensions (runtime split, persistence, streaming) are all resolved here; the three Hard Decisions are honored in §1.2, §1.3, and the topology doc.
8. **Per-agent artifacts?** Prompt-versioning and Braintrust-span contracts defined (§1.6, §1.7); per-agent specs/tests are Phase 3.
9. **Decision audit row shape?** Defined: agent, prompt version, input projection, reasoning, confidence, cost, latency; written to `decision_steps` + Braintrust span.
10. **Graph topology doc matches the intended graph?** `01b` is authoritative and matches the Phase 0 DAG.
11. **Agent Ops view renders every node?** Node set fixed at 15; design is Phase 1B/4.
12. **Cost per run under $0.10?** Budget enforced as a test (§4); per-agent budget table in `01b §7`.
