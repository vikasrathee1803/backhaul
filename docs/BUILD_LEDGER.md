# Build Ledger — Backhaul

Single source of truth for build status across all phases. Maintained from Phase 0 onward per Hard Rule 3. Every feature touched gets a row; out-of-scope edits get logged here per Hard Rule 9.

**Last updated:** 2026-05-25

## Status Definitions

| Status | Meaning |
| --- | --- |
| `planned` | Scoped, not started. Spec may or may not exist yet. |
| `in-progress` | Actively being built. |
| `built` | Code/doc complete, not yet QA-verified. |
| `qa-passed` | Verified by qa-engineer against acceptance criteria + gate commands. |
| `deferred` | Out of scope for v1. Logged with reason, not silently dropped. |

## Column Guide

- **Feature** — the unit of work.
- **Status** — one of the values above.
- **Phase** — owning phase (0–5, or "Deferred").
- **Spec Link** — path to the governing spec/doc. `—` if none yet.
- **Tests** — test coverage status. `—` if not applicable yet.
- **Known Gaps** — outstanding issues, shortcuts, or follow-ups.

---

## Phase 0 — Discovery & Architecture Sketch

| Feature | Status | Phase | Spec Link | Tests | Known Gaps |
| --- | --- | --- | --- | --- | --- |
| Discovery document | built | 0 | `/docs/00-discovery.md` | — | Pending stakeholder signoff |
| Build ledger | built | 0 | `/docs/BUILD_LEDGER.md` | — | None |
| Assumptions log | built | 0 | `/docs/ASSUMPTIONS.md` | — | Revisit at each phase boundary |

## Phase 1A — Architecture

| Feature | Status | Phase | Spec Link | Tests | Known Gaps |
| --- | --- | --- | --- | --- | --- |
| Architecture doc | planned | 1A | `/docs/01a-architecture.md` | — | Python vs TS agent runtime to be confirmed |
| Graph topology doc | planned | 1A | `/docs/01b-graph-topology.md` | — | Must cover all 15 agents as nodes |
| LangGraph graph topology file | planned | 1A | — | — | One file, declares every node/edge/conditional |
| WebSocket/SSE protocol spec | planned | 1A | `/docs/01a-architecture.md` | — | SSE leaning per ASSUMPTIONS #2 |
| Braintrust wiring spec | planned | 1A | `/docs/01a-architecture.md` | — | Span-per-node contract |
| Env var schema | planned | 1A | `/docs/01a-architecture.md` | — | Covers both runtimes |
| CI scaffold (`.github/workflows`) | planned | 1A | `/docs/01a-architecture.md` | — | Eval-gated, both runtimes |

## Phase 1B — Design System

| Feature | Status | Phase | Spec Link | Tests | Known Gaps |
| --- | --- | --- | --- | --- | --- |
| Design system doc | planned | 1B | `/docs/01c-design-system.md` | — | Operator-grade, dense, dark default |
| `globals.css` with full token system | planned | 1B | `/docs/01c-design-system.md` | — | OKLch tokens |
| Component primitive library | planned | 1B | `/docs/01c-design-system.md` | — | — |
| Agent Ops node state designs (idle/running/complete/failed/escalated) | planned | 1B | `/docs/01c-design-system.md` | — | Must match topology node set |
| Keyboard navigation spec | planned | 1B | `/docs/01c-design-system.md` | — | Keyboard-first interaction model |

## Phase 1C — Schema

| Feature | Status | Phase | Spec Link | Tests | Known Gaps |
| --- | --- | --- | --- | --- | --- |
| Schema doc | planned | 1C | `/docs/01d-schema.md` | — | — |
| `orders` table | planned | 1C | `/docs/01d-schema.md` | — | — |
| `order_lines` table | planned | 1C | `/docs/01d-schema.md` | — | — |
| `customers` table | planned | 1C | `/docs/01d-schema.md` | — | LTV + prior return rate fields |
| `returns` table | planned | 1C | `/docs/01d-schema.md` | — | State machine for return status |
| `return_lines` table | planned | 1C | `/docs/01d-schema.md` | — | — |
| `decisions` table | planned | 1C | `/docs/01d-schema.md` | — | — |
| `decision_steps` table | planned | 1C | `/docs/01d-schema.md` | — | One row per graph node visited |
| `audit_log` table (append-only) | planned | 1C | `/docs/01d-schema.md` | — | Append-only constraint enforced |
| `agent_runs` table | planned | 1C | `/docs/01d-schema.md` | — | Cost + latency per run |
| `prompt_versions` table | planned | 1C | `/docs/01d-schema.md` | — | Mirrors `/prompts/` registry |
| `eval_cases` table | planned | 1C | `/docs/01d-schema.md` | — | Grows from overrides |
| `eval_results` table | planned | 1C | `/docs/01d-schema.md` | — | — |
| `overrides` table | planned | 1C | `/docs/01d-schema.md` | — | Feeds eval dataset |
| `sku_catalog` table | planned | 1C | `/docs/01d-schema.md` | — | Weight, freight class, refurb difficulty, stock |

## Phase 2A — Frontend Scaffold

| Feature | Status | Phase | Spec Link | Tests | Known Gaps |
| --- | --- | --- | --- | --- | --- |
| Next.js App Router init | planned | 2A | `/docs/02-scaffolding.md` | — | — |
| Routing shell (all 7 screens stubbed) | planned | 2A | `/docs/02-scaffolding.md` | — | Dashboard, return detail, agent ops, escalation, evals, settings, audit |
| SSE/WebSocket client | planned | 2A | `/docs/02-scaffolding.md` | — | — |
| Mock graph rendering with placeholder nodes | planned | 2A | `/docs/02-scaffolding.md` | — | @xyflow/react per ASSUMPTIONS #10 |
| Auth (single seeded admin user) | planned | 2A | `/docs/02-scaffolding.md` | — | No RBAC/multi-tenant per scope |

## Phase 2B — Agent Service Scaffold

| Feature | Status | Phase | Spec Link | Tests | Known Gaps |
| --- | --- | --- | --- | --- | --- |
| FastAPI service init | planned | 2B | `/docs/02-scaffolding.md` | — | — |
| LangGraph graph loaded as data | planned | 2B | `/docs/02-scaffolding.md` | — | Reads topology file from 1A |
| 15 empty agent stubs | planned | 2B | `/docs/02-scaffolding.md` | — | Canned responses for stub run |
| Braintrust client wired | planned | 2B | `/docs/02-scaffolding.md` | — | — |
| Health endpoint | planned | 2B | `/docs/02-scaffolding.md` | — | — |
| SSE/WebSocket server | planned | 2B | `/docs/02-scaffolding.md` | — | — |

## Phase 2C — Fixtures

| Feature | Status | Phase | Spec Link | Tests | Known Gaps |
| --- | --- | --- | --- | --- | --- |
| 200+ orders fixture | planned | 2C | `/docs/02-scaffolding.md` | — | Across all 5 marketplaces |
| 50+ returns fixture (various states) | planned | 2C | `/docs/02-scaffolding.md` | — | Damage, defect, remorse, wrong item, fraud-flagged |
| SKU catalog fixture | planned | 2C | `/docs/02-scaffolding.md` | — | Weight, dims, freight class, refurb difficulty, stock |
| Customer profiles fixture | planned | 2C | `/docs/02-scaffolding.md` | — | Order history + LTV |
| Marketplace policy YAMLs (5 channels) | planned | 2C | `/config/marketplaces/` | — | Wayfair, Amazon FBA, Amazon FBM, Houzz, Overstock, Direct Shopify |
| Carrier rate sheet fixture | planned | 2C | `/docs/02-scaffolding.md` | — | Per freight class + weight + zone |

## Phase 3 — Agents & Decisioning

Each agent row covers spec doc, versioned prompt, implementation, and evals per Hard Rule 11.

| Feature | Status | Phase | Spec Link | Tests | Known Gaps |
| --- | --- | --- | --- | --- | --- |
| Intake Agent | planned | 3 | `/docs/specs/agents/intake.md` | `/evals/intake/` | — |
| Customer History Agent | planned | 3 | `/docs/specs/agents/customer-history.md` | `/evals/customer-history/` | — |
| SKU Profile Agent | planned | 3 | `/docs/specs/agents/sku-profile.md` | `/evals/sku-profile/` | — |
| Marketplace Policy Agent | planned | 3 | `/docs/specs/agents/marketplace-policy.md` | `/evals/marketplace-policy/` | Reads policy from `/config/marketplaces/` only |
| Damage Signal Agent | planned | 3 | `/docs/specs/agents/damage-signal.md` | `/evals/damage-signal/` | Text parse per ASSUMPTIONS #8 |
| Fraud Flag Agent | planned | 3 | `/docs/specs/agents/fraud-flag.md` | `/evals/fraud-flag/` | — |
| Decision Agent | planned | 3 | `/docs/specs/agents/decision.md` | `/evals/decision/` | Headline agent; opus-4-7 eval comparison |
| Refund Worker | planned | 3 | `/docs/specs/agents/refund-worker.md` | `/evals/refund-worker/` | Stripe test mode only |
| Replacement Worker | planned | 3 | `/docs/specs/agents/replacement-worker.md` | `/evals/replacement-worker/` | Inventory check + fixture shipping |
| Repair Worker | planned | 3 | `/docs/specs/agents/repair-worker.md` | `/evals/repair-worker/` | Pickup schedule + work order draft |
| Refurb Worker | planned | 3 | `/docs/specs/agents/refurb-worker.md` | `/evals/refurb-worker/` | Routes to refurb queue with grading |
| Donate/Dispose Worker | planned | 3 | `/docs/specs/agents/donate-dispose-worker.md` | `/evals/donate-dispose-worker/` | Routes by region |
| Customer Comms Agent | planned | 3 | `/docs/specs/agents/customer-comms.md` | `/evals/customer-comms/` | Drafts to queue, no real send |
| Escalation Agent | planned | 3 | `/docs/specs/agents/escalation.md` | `/evals/escalation/` | Confidence/value thresholds |
| Audit Agent | planned | 3 | `/docs/specs/agents/audit.md` | `/evals/audit/` | Writes full append-only decision record |
| Eval suite (50+ golden cases) | planned | 3 | `/evals/` | `/evals/` | 90%+ accuracy gate |
| Human override capture → eval dataset | planned | 3 | `/docs/specs/agents/decision.md` | — | Per Hard Rule 14 |

## Phase 4 — Agent Ops View

| Feature | Status | Phase | Spec Link | Tests | Known Gaps |
| --- | --- | --- | --- | --- | --- |
| Live graph viz (node states + edge animations) | planned | 4 | `/docs/04-polish.md` | — | 60fps target with 20 nodes |
| Decision drawer (full reasoning per return) | planned | 4 | `/docs/04-polish.md` | — | 380px panel per ASSUMPTIONS #11 |
| Override UI (captures to eval dataset) | planned | 4 | `/docs/04-polish.md` | — | — |
| Cost meter (running total + per decision) | planned | 4 | `/docs/04-polish.md` | — | — |
| Eval status badge (X/Y golden cases) | planned | 4 | `/docs/04-polish.md` | — | — |
| Escalation queue with reasoning summaries | planned | 4 | `/docs/04-polish.md` | — | — |
| Drift indicator (rolling window comparison) | planned | 4 | `/docs/04-polish.md` | — | — |
| Prompt version A/B comparison | planned | 4 | `/docs/04-polish.md` | — | Last week vs this week |
| Empty/loading/error states everywhere | planned | 4 | `/docs/04-polish.md` | — | — |
| Keyboard navigation | planned | 4 | `/docs/04-polish.md` | — | — |
| 60fps performance pass | planned | 4 | `/docs/04-polish.md` | — | — |

## Phase 5 — Deploy & Portfolio Packaging

| Feature | Status | Phase | Spec Link | Tests | Known Gaps |
| --- | --- | --- | --- | --- | --- |
| Vercel deploy (Next.js) | planned | 5 | `/docs/05-deploy.md` | — | — |
| Render/Railway deploy (agent service) | planned | 5 | `/docs/05-deploy.md` | — | Free tier |
| Neon Postgres provisioned | planned | 5 | `/docs/05-deploy.md` | — | — |
| Upstash Redis provisioned | planned | 5 | `/docs/05-deploy.md` | — | — |
| Braintrust account configured | planned | 5 | `/docs/05-deploy.md` | — | Free tier |
| Sentry configured | planned | 5 | `/docs/05-deploy.md` | — | Free tier |
| Smoke test on prod | planned | 5 | `/docs/05-deploy.md` | — | Full demo flow end to end |
| README (90-sec pitch + demo gif + architecture) | planned | 5 | `/README.md` | — | — |
| Architecture portfolio artifact | planned | 5 | `/docs/ARCHITECTURE.md` | — | Decision log included |

## Deferred — Non-Goals for V1

Logged per Hard Rule 8, not silently dropped.

| Feature | Status | Phase | Spec Link | Tests | Known Gaps |
| --- | --- | --- | --- | --- | --- |
| Multi-tenancy / RBAC / workspaces | deferred | Deferred | — | — | v2; single-tenant by design |
| Real marketplace API connections | deferred | Deferred | — | — | Fixtures only for v1; Phase 5 stretch |
| Real Stripe charges (test mode only) | deferred | Deferred | — | — | Test mode is intentional |
| Image/video damage analysis | deferred | Deferred | — | — | Claimlane's wedge, not ours |
| SMS/email gateway (drafts queue only) | deferred | Deferred | — | — | Drafts go to queue, no real sends |
| Mobile app | deferred | Deferred | — | — | Desktop-first operator tool |
| White label / admin console | deferred | Deferred | — | — | v2 |
| Real carrier API for freight rates | deferred | Deferred | — | — | Fixture rate sheet for v1 |
