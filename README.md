**AI agent that triages and resolves returns for big-ticket marketplace sellers — deciding refund vs. replace vs. repair vs. refurbish vs. dispose for every incoming return across Wayfair, Amazon, Houzz, Overstock, and direct channels.**

![Python](https://img.shields.io/badge/Python-3.11-blue) ![Next.js](https://img.shields.io/badge/Next.js-14-black) ![LangGraph](https://img.shields.io/badge/LangGraph-0.2-orange) ![Tests](https://img.shields.io/badge/tests-76%2F76-brightgreen) ![Cost](https://img.shields.io/badge/cost%2Frun-%240.0082-green)

---

## The problem

I was Director of Business Analytics at Cymax Group, a multi-marketplace seller of furniture and big-ticket goods. I watched the returns ops team manually triage every return across eight channels — printing labels, checking policy PDFs, calculating whether it was cheaper to refurbish or dispose, drafting customer emails, logging everything in spreadsheets. Two people, eight channels, hundreds of returns a month.

I built the system I wished we had.

The math on big-ticket returns is different. When a $1,200 sofa comes back damaged, the decision is not "refund or exchange." It is: what did inbound freight cost? What is the refurb labor estimate? Is there Open Box demand in this region? What does this specific marketplace reimburse for damage? What is this customer's LTV and return history? Answering all of that in parallel and reaching a defensible decision in under a second — for every return — is the product.

---

## What the demo does

**Live demo:** https://backhaul.vercel.app/demo *(login required)*
**Credentials:** `demo@backhaul.app` / `demo1234`

1. The dashboard loads 12 fixture returns across all five channels — a Wayfair sofa with transit damage, an Amazon FBA wrong-item, a Houzz trade return, a fraud-flagged Overstock claim, and more.
2. Click **Run triage**. The graph fires.
3. The Agent Ops view shows nodes activating in real time: Intake parses the return text, five context agents run in parallel (Customer History, SKU Profile, Marketplace Policy, Damage Signal, Fraud Flags), then the Decision Agent synthesizes everything into a disposition with a confidence score and full reasoning chain.
4. Decisions stream in: refund, replace, repair, refurbish-and-resell, donate, dispose, escalate. The escalation queue surfaces the one case that exceeded the confidence threshold for human review.
5. Total cost per decision is displayed live in the top-right panel. Every run in this demo costs under $0.01.

---

## Why not NAVI / Loop / Fini / Claimlane

| Tool | What it actually does | The gap |
|---|---|---|
| **NAVI** | DTC Shopify post-purchase automation | Single channel, small-ticket economics. No freight, no multi-marketplace policy logic. |
| **Loop** | Shopify exchange and credit flows | Exchange-first, Shopify-only. Decisioning is binary: exchange or refund. |
| **Fini** | AI chat layer on top of your helpdesk | Handles the customer conversation. Does not make the disposition decision. |
| **Claimlane** | Image and video analysis of damage evidence | Great at visual intake. No multi-channel decisioning, no freight-aware economics, no refurb/dispose routing. |

**The wedge:** multi-marketplace + big-ticket + freight-aware + refurb/dispose economics. The five marketplaces modeled here each have different return windows, damage allowances, freight subsidies, and restocking fee rules. None of the tools above handle all five simultaneously, and none of them model the refurbish-or-dispose calculation that makes big-ticket returns economically meaningful.

---

## Architecture

Full write-up: [`docs/01a-architecture.md`](docs/01a-architecture.md) and [`docs/01b-graph-topology.md`](docs/01b-graph-topology.md).

```
[START]
  |
[Intake Agent]          claude-haiku: parse raw return text → structured schema
  |
  +-- [Customer History]  [SKU Profile]  [Policy Agent]  [Damage Signal]  [Fraud Flags]
       (parallel fan-out via LangGraph Send API — true concurrency)
       Each branch writes its own state key or records errors[branch_name].
       Fan-in barrier proceeds when all 5 are accounted for — degrade, don't hang.
  |
[Decision Agent]        claude-sonnet: 5-gate economics reasoning → disposition + confidence
  |
  +-- [Refund]  [Replace]  [Repair]  [Refurb]  [Donate/Dispose]  [Escalate]
       (worker executes chosen disposition)
  |
[Customer Comms]        claude-haiku: channel-appropriate message draft → comms queue
  |
[Audit Agent]           append-only decision record: agent, prompt version, input,
                        reasoning, confidence, cost, latency
  |
[END]
```

**Stack:**
- Python 3.11 + LangGraph 0.2 + FastAPI (agent service)
- TypeScript Next.js 14 App Router + React Flow (frontend + BFF)
- Neon Postgres (orders, returns, decisions, audit log, evals)
- Upstash Redis (graph job state)
- Braintrust (traces, eval-gated CI, cost analytics)
- Anthropic API: `claude-haiku-4-5-20251001` for cheap/fast agents, `claude-sonnet-4-6` for Decision Agent
- SSE from FastAPI to Next.js BFF to browser (persisted replay fallback from `decision_steps` table)

The two runtimes share nothing except HTTP — the BFF is a thin SSE proxy. The agent service is the sole writer of `decision_steps` and `audit_log`. Every event is persisted as it streams, so the Agent Ops view has a replay source if the live connection drops mid-demo.

---

## Eval results

| Package | Tests | Result |
|---|---|---|
| Intake Agent | 5 | 5/5 |
| Customer History Agent | 6 | 6/6 |
| SKU Profile Agent | 6 | 6/6 |
| Marketplace Policy Agent | 9 | 9/9 |
| Damage Signal Agent | 7 | 7/7 |
| Fraud Flag Agent | 10 | 10/10 |
| Decision Agent | 9 | 9/9 — all 7 dispositions + all escalation triggers covered |
| Customer Comms Agent | 7 | 7/7 |
| Escalation Agent | 7 | 7/7 |
| Audit Agent | 7 | 7/7 |
| Graph stub (end-to-end) | 3 | 3/3 |
| **Total** | **76** | **76/76** |

Decision Agent covers all 7 dispositions (`refund`, `replace`, `repair`, `refurbish`, `donate`, `dispose`, `escalate`) and all 5 escalation trigger conditions. The rule-based fallback (used when no live API key is present) is exported as its own function and tested independently — 100% accuracy on all golden cases in CI.

**Gate commands (both runtimes):**

```
ruff check .         → All checks passed (0 warnings)
pytest tests/ evals/ → 76 passed in 4.2s
tsc --noEmit         → 0 errors
```

---

## Run locally

**Prerequisites:** Python 3.11+, Node 20+, git.

### 1. Clone and install

```bash
git clone https://github.com/your-username/backhaul.git
cd backhaul

# Agent service
cd apps/agent
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Set ANTHROPIC_API_KEY in .env (minimum required for LLM agents)
# Leave it blank to run in rule-based fallback mode (all 76 tests still pass)

# Frontend
cd ../web
npm install
cp .env.example .env.local
# Set AGENT_SERVICE_URL=http://localhost:8000 in .env.local
```

### 2. Run

```bash
# Terminal 1 — agent service (port 8000)
cd apps/agent
uvicorn app.main:app --reload

# Terminal 2 — frontend (port 3000)
cd apps/web
npm run dev

# Open http://localhost:3000/demo
```

### 3. Run evals (no live API key required)

```bash
cd apps/agent
pytest tests/ evals/ -v
# Expected: 76 passed
```

The eval suite mocks all Anthropic API calls. Every agent that uses an LLM has a `_build_fallback_*` path and a `_rule_based_fallback_decision()` export. CI runs without secrets.

---

## Cost analytics

Measured across Phase 3 implementation against the fixture return set. All token counts are per-return-triage run.

| Agent | Model | Avg input tokens | Avg output tokens | Cost/run |
|---|---|---|---|---|
| Intake Agent | claude-haiku-4-5 | ~300 | ~150 | ~$0.0009 |
| Damage Signal Agent | claude-haiku-4-5 | ~200 | ~100 | ~$0.0006 |
| Decision Agent | claude-sonnet-4-6 | ~800 | ~250 | ~$0.0062 |
| Customer Comms Agent | claude-haiku-4-5 | ~150 | ~100 | ~$0.0005 |
| **Total per run** | | | | **~$0.0082** |

Hard Rule ceiling: $0.10/run. Actual: $0.0082. 12x headroom.

The five context agents (Customer History, SKU Profile, Marketplace Policy, Fraud Flag, Escalation) use no LLM — deterministic lookup against fixtures. The Audit Agent writes a structured record with no model call. Cost is concentrated in three places: intake parsing, disposition reasoning, and customer communication drafting.

---

## Agents

| Agent | Model | Role |
|---|---|---|
| Intake Agent | claude-haiku-4-5 | Parses raw return request text into `ReturnIntakeSchema` |
| Customer History Agent | No LLM | Looks up order history, LTV, prior return rate from fixture cache |
| SKU Profile Agent | No LLM | Retrieves weight, freight class, refurb difficulty score, current stock |
| Marketplace Policy Agent | No LLM | Reads applicable policy from `/config/marketplaces/<name>.yaml` |
| Damage Signal Agent | claude-haiku-4-5 | Classifies damage severity and type from condition codes + free text |
| Fraud Flag Agent | No LLM | Rule-based: return rate threshold, claim pattern, velocity check |
| Decision Agent | claude-sonnet-4-6 | Five-gate economics reasoning → disposition, confidence, ranked candidates |
| Refund Worker | No LLM | Issues refund via Stripe test mode (real if `sk_test_` key present) |
| Replacement Worker | No LLM | Inventory check + fixture shipping booking |
| Repair Worker | No LLM | Schedules 3-business-day pickup, drafts work order |
| Refurb Worker | No LLM | Routes to refurb queue with Grade A/B/C assignment by damage severity |
| Donate/Dispose Worker | No LLM | Regional routing: weight > 50 lbs → dispose, else → donate |
| Customer Comms Agent | claude-haiku-4-5 | Channel-appropriate message draft, tone-routed by marketplace |
| Escalation Agent | No LLM | Five trigger conditions: confidence, value threshold, fraud flag, missing signals, policy ambiguity |
| Audit Agent | No LLM | Writes append-only decision record: agent, prompt version, input, reasoning, confidence, cost, latency |

Every LLM agent has: a spec doc in `/docs/specs/agents/`, a versioned system prompt in `/apps/agent/prompts/`, a typed JSON output contract, a defensive parser, a rule-based fallback, a cost target, a Braintrust span hook, and a fixture-based eval test in `/evals/` that runs in CI without a live API key.

Marketplace policies live in `/config/marketplaces/<name>.yaml` and nowhere else. Adding a channel means adding a YAML file, not modifying agent code.

---

## Marketplaces modeled in v1

| Marketplace | Policy file | Notes |
|---|---|---|
| Wayfair | `wayfair.yaml` | Dominant big-ticket channel; freight subsidy rules, damage allowance |
| Amazon FBA | `amazon_fba.yaml` | FBA reimbursement policy; condition grading |
| Amazon FBM | `amazon_fbm.yaml` | Seller-bears-freight; different return window |
| Houzz | `houzz.yaml` | Designer/trade channel; restocking fee rules |
| Overstock | `overstock.yaml` | Clearance dynamics; liquidation-first disposition preference |
| Shopify D2C | `shopify.yaml` | Simplest policy; comparison baseline |

All fixtures. No live API connections. The connector framework is pluggable — adding a channel is a YAML config addition.

---

## Deploy

**Frontend:** Vercel (Next.js App Router, SSE streaming compatible)
**Agent service:** Render or Railway free tier (Python FastAPI + LangGraph)
**Database:** Neon serverless Postgres
**Cache/queue:** Upstash Redis
**Observability:** Braintrust free tier (traces, eval-gated CI job on main)
**Error monitoring:** Sentry free tier

Full runbook: [`docs/05-deploy.md`](docs/05-deploy.md) (Phase 5).

---

## Fixture data

| Dataset | Count | Location |
|---|---|---|
| Orders | 200+ across 6 channels | `apps/agent/fixtures/orders.json` |
| Returns | 55 (damage, defect, buyer remorse, wrong item, fraud-flagged) | `apps/agent/fixtures/returns.json` |
| SKU catalog | 32 SKUs with freight class + refurb difficulty | `apps/agent/fixtures/skus.json` |
| Customer profiles | 30 with LTV + return history | `apps/agent/fixtures/customers.json` |
| Carrier rates | 14 freight classes | `apps/agent/fixtures/carrier_rates.json` |

---

## What is not in v1

Logged in the Build Ledger, not silently dropped:

- Multi-tenancy, RBAC, workspaces (single-tenant by design)
- Real marketplace API connections (fixtures only)
- Real Stripe charges (test mode intentional)
- Image/video damage analysis (Claimlane's wedge, not ours)
- SMS/email gateway (drafts go to a queue, never sent)
- Mobile (desktop-first operator tool)

---

## Docs

- [`docs/00-discovery.md`](docs/00-discovery.md) — Screen inventory, agent inventory, graph topology sketch, hard decisions
- [`docs/01a-architecture.md`](docs/01a-architecture.md) — Stack decision log, runtime split, SSE protocol, DB choices
- [`docs/01b-graph-topology.md`](docs/01b-graph-topology.md) — Authoritative graph: every node, edge, conditional, checkpoint
- [`docs/01c-design-system.md`](docs/01c-design-system.md) — Operator-grade dense UI: tokens, components, Agent Ops node states
- [`docs/01d-schema.md`](docs/01d-schema.md) — Full Postgres schema: 17 tables, append-only triggers, immutability rules
- [`docs/03-agents.md`](docs/03-agents.md) — Phase 3 agent build log, per-agent compliance checklist
- [`docs/04-polish.md`](docs/04-polish.md) — Agent Ops view polish checklist
- [`docs/BUILD_LEDGER.md`](docs/BUILD_LEDGER.md) — Feature-level build status, phase by phase
- [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md) — Every gap-filling assumption, logged
