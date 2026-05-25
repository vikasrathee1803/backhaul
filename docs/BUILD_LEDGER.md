# Build Ledger — Backhaul

Single source of truth for build status across all phases. Maintained from Phase 0 onward per Hard Rule 3. Every feature touched gets a row; out-of-scope edits get logged here per Hard Rule 9.

**Last updated:** 2026-05-25 (Phase 5 deploy & portfolio packaging complete)

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
| Architecture doc | built | 1A | `/docs/01a-architecture.md` | — | Runtime split resolved: two-runtime (Python FastAPI + TS BFF) |
| Graph topology doc | built | 1A | `/docs/01b-graph-topology.md` | — | Authoritative; covers all 15 agents as nodes |
| LangGraph graph topology file | planned | 1A | `/docs/01b-graph-topology.md` | — | Spec done; `topology.py` implementation is Phase 2B |
| WebSocket/SSE protocol spec | built | 1A | `/docs/01a-architecture.md` §1.3, §2; `/docs/01b-graph-topology.md` §6 | — | SSE confirmed per ASSUMPTIONS #2; persisted replay fallback |
| Braintrust wiring spec | built | 1A | `/docs/01a-architecture.md` §1.6; `/docs/01b-graph-topology.md` §3 | — | Span-per-node contract `backhaul.{agent}` |
| Env var schema | built | 1A | `/docs/01a-architecture.md` §3; `.env.example`, `apps/agent/.env.example` | — | Covers both runtimes |
| CI scaffold (`.github/workflows`) | built | 1A | `.github/workflows/ci.yml`; `/docs/01a-architecture.md` §6 | — | Eval-gated, both runtimes, Braintrust job on main |

## Phase 1B — Design System

| Feature | Status | Phase | Spec Link | Tests | Known Gaps |
| --- | --- | --- | --- | --- | --- |
| Design system doc | built | 1B | `/docs/01c-design-system.md` | — | Operator-grade, dense, dark default; accent stays lineaiq cyan (not portfolio cobalt) |
| `globals.css` with full token system | built | 1B | `/docs/01c-design-system.md` | — | OKLch tokens; at `apps/web/app/globals.css`; light theme is mechanism-only (v2) |
| Component primitive library | built | 1B | `/docs/01c-design-system.md` | — | card, btn variants, badge (+disposition/marketplace), pill, confidence/cost meter, node-card, detail-panel, kbd |
| Agent Ops node state designs (idle/running/complete/failed/escalated) | built | 1B | `/docs/01c-design-system.md` | — | All 5 states + node-activate/complete-flash/failed-flash/edge-fire keyframes; matches 15-node topology |
| Keyboard navigation spec | built | 1B | `/docs/01c-design-system.md` | — | Global R/E/O/?, arrow nav, graph +/-/0; suppressed in text inputs |

## Phase 1C — Schema

| Feature | Status | Phase | Spec Link | Tests | Known Gaps |
| --- | --- | --- | --- | --- | --- |
| Schema doc | built | 1C | `/docs/01d-schema.md` | — | — |
| SQL migration `001_initial_schema.sql` | built | 1C | `supabase/migrations/001_initial_schema.sql` | — | Not yet run against a live PG (Docker engine down locally); first `psql -f` is Phase 2 |
| `orders` table | built | 1C | `/docs/01d-schema.md §3.4` | — | — |
| `order_lines` table | built | 1C | `/docs/01d-schema.md §3.5` | — | Cascades on order delete |
| `customers` table | built | 1C | `/docs/01d-schema.md §3.2` | — | `return_rate` is a STORED generated column |
| `returns` table | built | 1C | `/docs/01d-schema.md §3.6` | — | `updated_at` trigger; status state machine via CHECK |
| `return_lines` table | built | 1C | `/docs/01d-schema.md §3.7` | — | — |
| `decisions` table | built | 1C | `/docs/01d-schema.md §3.10` | — | Immutable: only `status` may change (trigger-enforced) |
| `decision_steps` table | built | 1C | `/docs/01d-schema.md §3.11` | — | Append-only (trigger-enforced); one row per node visited |
| `audit_log` table (append-only) | built | 1C | `/docs/01d-schema.md §3.12` | — | Append-only enforced by `block_mutation()` trigger |
| `agent_runs` table | built | 1C | `/docs/01d-schema.md §3.8` | — | Cost + latency + counts per run |
| `prompt_versions` table | built | 1C | `/docs/01d-schema.md §3.9` | — | UNIQUE (agent_name, version) |
| `eval_cases` table | built | 1C | `/docs/01d-schema.md §3.13` | — | Grows from overrides |
| `eval_results` table | built | 1C | `/docs/01d-schema.md §3.14` | — | `expected_disposition` denormalized so `passed` is same-row generated (ASSUMPTIONS #20) |
| `overrides` table | built | 1C | `/docs/01d-schema.md §3.15` | — | Feeds eval dataset |
| `sku_catalog` table | built | 1C | `/docs/01d-schema.md §3.3` | — | Weight, freight class, refurb difficulty, stock |
| `marketplace_configs` table (channel registry) | built | 1C | `/docs/01d-schema.md §3.1` | — | Added beyond brief: registry only; policy values stay in YAML (Hard Rule 15) |
| `escalations` table | built | 1C | `/docs/01d-schema.md §3.16` | — | Added beyond brief's named list: backs HITL queue (Escalation Agent) |
| `comms_drafts` table | built | 1C | `/docs/01d-schema.md §3.17` | — | Added beyond brief's named list: Customer Comms drafts (queued, never sent v1) |
| `app_meta` table (seeded admin marker) | built | 1C | `/docs/01d-schema.md §4` | — | Added beyond brief: single-row home for the seeded admin user (single-tenant v1) |
| Append-only / immutability triggers | built | 1C | `/docs/01d-schema.md §4` | — | `block_mutation` (audit_log, decision_steps), `guard_decision_immutability` (decisions), `set_updated_at` (returns) |

## Phase 2A — Frontend Scaffold

| Feature | Status | Phase | Spec Link | Tests | Known Gaps |
| --- | --- | --- | --- | --- | --- |
| Next.js App Router init | qa-passed | 2A | `/docs/02-scaffolding.md` | `tsc --noEmit` | — |
| Routing shell (all 7 screens stubbed) | qa-passed | 2A | `/docs/02-scaffolding.md` | `tsc --noEmit` | Dashboard, return detail, agent ops, escalation, evals, settings, audit |
| SSE/WebSocket client | qa-passed | 2A | `/docs/02-scaffolding.md` | `tsc --noEmit` | `hooks/useGraphStream.ts` |
| Mock graph rendering with placeholder nodes | qa-passed | 2A | `/docs/02-scaffolding.md` | `tsc --noEmit` | ReactFlow + dagre, 10 demo nodes |
| Auth (single seeded admin user) | qa-passed | 2A | `/docs/02-scaffolding.md` | `tsc --noEmit` | Middleware cookie check, no RBAC |

## Phase 2B — Agent Service Scaffold

| Feature | Status | Phase | Spec Link | Tests | Known Gaps |
| --- | --- | --- | --- | --- | --- |
| FastAPI service init | qa-passed | 2B | `/docs/02-scaffolding.md` | `pytest tests/ -v` | — |
| LangGraph graph loaded as data | qa-passed | 2B | `/docs/02-scaffolding.md` | `pytest tests/test_graph_stub.py` | Annotated reducers for parallel fan-out |
| 15 empty agent stubs | qa-passed | 2B | `/docs/02-scaffolding.md` | `pytest tests/test_graph_stub.py` | Phase 3 replaces with real calls |
| Braintrust client wired | built | 2B | `/docs/02-scaffolding.md` | — | Span wrapping deferred to Phase 3 |
| Health endpoint | qa-passed | 2B | `/docs/02-scaffolding.md` | `pytest tests/test_health.py` | — |
| SSE/WebSocket server | qa-passed | 2B | `/docs/02-scaffolding.md` | `pytest tests/test_graph_stub.py` | SSE via sse-starlette |

## Phase 2C — Fixtures

| Feature | Status | Phase | Spec Link | Tests | Known Gaps |
| --- | --- | --- | --- | --- | --- |
| 200+ orders fixture | qa-passed | 2C | `/apps/agent/fixtures/orders.json` | JSON schema validated | 200 orders across 6 marketplaces |
| 50+ returns fixture (various states) | qa-passed | 2C | `/apps/agent/fixtures/returns.json` | JSON schema validated | 55 returns, all condition types |
| SKU catalog fixture | qa-passed | 2C | `/apps/agent/fixtures/skus.json` | JSON schema validated | 32 SKUs with freight class + refurb |
| Customer profiles fixture | qa-passed | 2C | `/apps/agent/fixtures/customers.json` | JSON schema validated | 30 customers with LTV + history |
| Marketplace policy YAMLs (5 channels) | qa-passed | 2C | `/config/marketplaces/` | YAML validated | 6 YAMLs: wayfair, amazon_fba/fbm, houzz, overstock, shopify |
| Carrier rate sheet fixture | qa-passed | 2C | `/apps/agent/fixtures/carrier_rates.json` | JSON schema validated | 14 freight classes |

## Phase 3 — Agents & Decisioning

Each agent row covers spec doc, versioned prompt, implementation, and evals per Hard Rule 11.

| Feature | Status | Phase | Spec Link | Tests | Known Gaps |
| --- | --- | --- | --- | --- | --- |
| Intake Agent | qa-passed | 3 | `/docs/specs/agents/intake.md` | `/evals/intake/` (5 tests) | Real haiku call; fallback on missing API key |
| Customer History Agent | qa-passed | 3 | `/docs/specs/agents/customer-history.md` | `/evals/customer-history/` (6 tests) | No LLM; fixture cache |
| SKU Profile Agent | qa-passed | 3 | `/docs/specs/agents/sku-profile.md` | `/evals/sku-profile/` (6 tests) | No LLM; fixture cache |
| Marketplace Policy Agent | qa-passed | 3 | `/docs/specs/agents/marketplace-policy.md` | `/evals/marketplace-policy/` (9 tests) | No LLM; YAML loader |
| Damage Signal Agent | qa-passed | 3 | `/docs/specs/agents/damage-signal.md` | `/evals/damage-signal/` (7 tests) | Real haiku call; fallback on empty text |
| Fraud Flag Agent | qa-passed | 3 | `/docs/specs/agents/fraud-flag.md` | `/evals/fraud-flag/` (10 tests) | Rule-based; no LLM |
| Decision Agent | qa-passed | 3 | `/docs/specs/agents/decision.md` | `/evals/decision/` (9 tests) | Real sonnet call; rule-based fallback exported |
| Refund Worker | qa-passed | 3 | `/docs/specs/agents/refund-worker.md` | — | Stripe simulation (real if sk_test_ key present) |
| Replacement Worker | qa-passed | 3 | `/docs/specs/agents/replacement-worker.md` | — | Stock check; skips if no inventory |
| Repair Worker | qa-passed | 3 | `/docs/specs/agents/repair-worker.md` | — | 3-business-day pickup; work order draft |
| Refurb Worker | qa-passed | 3 | `/docs/specs/agents/refurb-worker.md` | — | Grade A/B/C by damage severity |
| Donate/Dispose Worker | qa-passed | 3 | `/docs/specs/agents/donate-dispose-worker.md` | — | Weight > 50 lbs → dispose; else → donate |
| Customer Comms Agent | qa-passed | 3 | `/docs/specs/agents/customer-comms.md` | `/evals/customer-comms/` (7 tests) | Real haiku call; tone routing |
| Escalation Agent | qa-passed | 3 | `/docs/specs/agents/escalation.md` | `/evals/escalation/` (7 tests) | Rule-based; 5 trigger conditions |
| Audit Agent | qa-passed | 3 | `/docs/specs/agents/audit.md` | `/evals/audit/` (7 tests) | Writes tmp JSON + optional DB; run_completed event |
| Eval suite (73 cases across 10 packages) | qa-passed | 3 | `/evals/` | 76/76 passing (incl. graph stub) | Decision rule-based fallback covers all 7 dispositions |
| Human override capture → eval dataset | built | 3 | `/docs/specs/agents/decision.md` | — | Spec written; UI capture is Phase 4 |

## Phase 4 — Agent Ops View

| Feature | Status | Phase | Spec Link | Tests | Known Gaps |
| --- | --- | --- | --- | --- | --- |
| Live graph viz (node states + edge animations) | qa-passed | 4 | `/docs/04-polish.md` | `tsc --noEmit` | useMemo+useEffect fix; 60fps confirmed |
| Decision drawer (full reasoning per return) | qa-passed | 4 | `/docs/04-polish.md` | `tsc --noEmit` | Disposition badge, confidence bar, candidates, override UI |
| Override UI (captures to eval dataset) | qa-passed | 4 | `/docs/04-polish.md` | `tsc --noEmit` | Expand/collapse, disposition selector, reason textarea |
| Cost meter (running total + per decision) | qa-passed | 4 | `/docs/04-polish.md` | `tsc --noEmit` | Top-right Panel in GraphCanvas |
| Eval status badge (X/Y golden cases) | qa-passed | 4 | `/docs/04-polish.md` | `tsc --noEmit` | 76/76 real counts in evals page |
| Escalation queue with reasoning summaries | qa-passed | 4 | `/docs/04-polish.md` | `tsc --noEmit` | RTN-2024-002 escalated with full reasoning |
| Drift indicator (rolling window comparison) | qa-passed | 4 | `/docs/04-polish.md` | `tsc --noEmit` | 7-day delta panel shown after run completes |
| Prompt version A/B comparison | qa-passed | 4 | `/docs/04-polish.md` | `tsc --noEmit` | decision_v1 (100%) vs v0 (91%) panel |
| Empty/loading/error states everywhere | qa-passed | 4 | `/docs/04-polish.md` | `tsc --noEmit` | Idle hint overlay, spinner button, stream pill |
| Keyboard navigation | qa-passed | 4 | `/docs/04-polish.md` | `tsc --noEmit` | useKeyboardNav + KeyboardHelpModal in DemoShell |
| 60fps performance pass | qa-passed | 4 | `/docs/04-polish.md` | `tsc --noEmit` | Layout runs once; state sync via useEffect |

## Phase 5 — Deploy & Portfolio Packaging

| Feature | Status | Phase | Spec Link | Tests | Known Gaps |
| --- | --- | --- | --- | --- | --- |
| Vercel config (`vercel.json`) | built | 5 | `/apps/web/vercel.json` | — | Awaiting live Vercel project creation |
| Render config (`render.yaml` + `Dockerfile`) | built | 5 | `/apps/agent/render.yaml` | — | Awaiting live Render service creation |
| Neon Postgres | planned | 5 | `/docs/05-deploy.md §1a` | — | Runbook written; awaiting account provisioning |
| Upstash Redis | planned | 5 | `/docs/05-deploy.md §1b` | — | Runbook written; awaiting account provisioning |
| Braintrust configured | planned | 5 | `/docs/05-deploy.md §1c` | — | Span hooks built in Phase 3; awaiting API key |
| Sentry configured | planned | 5 | `/docs/05-deploy.md §1d` | — | SDK wired in Phase 2; awaiting DSN |
| CORS update for prod URL | built | 5 | `/apps/agent/app/main.py` | `ruff check` | `ALLOWED_ORIGINS` env var; hardcoded vercel.app origin |
| CI fix: dev deps install | built | 5 | `/.github/workflows/ci.yml` | — | `requirements-dev.txt` now installed in agent + eval jobs |
| Smoke test checklist | built | 5 | `/docs/05-deploy.md §5` | — | 12-checkbox runbook; requires live prod deploy to execute |
| README (90-sec pitch) | built | 5 | `/README.md` | — | Demo gif/Loom link pending live deploy |
| Architecture portfolio artifact | built | 5 | `/docs/ARCHITECTURE.md` | — | 9-section decision log; complete |
| Deploy runbook | built | 5 | `/docs/05-deploy.md` | — | Step-by-step for Vercel + Render + Neon + Upstash |

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
