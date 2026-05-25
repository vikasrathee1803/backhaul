# 00 — Discovery & Architecture Sketch

**Phase:** 0 — Discovery and Architecture Sketch
**Roles:** stakeholder + code-auditor + architect (light)
**Status:** Awaiting stakeholder signoff at the Phase 0 exit gate
**Date:** 2026-05-25

---

## Purpose of this document

This is the discovery inventory for Backhaul. It does not lock the architecture — Phase 1 does that. It establishes the surface area: every screen the app needs, every agent in the graph, the graph's shape, the marketplace policy dimensions that drive decisioning, the three hardest decisions, and the risk register. Phase 1 tracks (architecture, design system, schema) consume this document as their input. Nothing here is built until the stakeholder signs off.

### Carried forward from the brief

- **Single-tenant, fixture-driven.** No multi-tenancy, no RBAC, no workspaces, no real marketplace APIs in v1. One Returns Ops Lead persona.
- **The product *is* the agent system.** Every disposition decision is made by an agent in a LangGraph DAG. The in-app Agent Ops view is the hero, not a dev tool.
- **Cost ceiling is a hard gate.** A graph run over $0.10 is a bug. Decisions must come in under $0.01 each in the demo.
- **Eval suite is the source of truth.** 50+ golden cases, 90%+ accuracy in CI, no live API calls in CI.

### Open tension flagged for Phase 1 (do not resolve here)

The project brief (`CLAUDE.md`) specifies a **two-runtime split: Python FastAPI + LangGraph for the agent service, TypeScript Next.js for the frontend/BFF.** The shared `STACK_CONFIG.md` describes a **single-runtime TypeScript stack** (Next.js App Router, Supabase, `@xyflow/react` + dagre for graph rendering, Anthropic SDK `^0.98`, Upstash Redis + QStash). These are not yet reconciled. This is logged as **Hard Decision candidate / Phase 1 Track A deliverable**, not decided here. Model IDs and the graph-rendering library below are taken from `STACK_CONFIG.md` because they are already locked there:

- Default / general agents: `claude-sonnet-4-6`
- Cheap / fast / short-context agents: `claude-haiku-4-5`
- Complex reasoning (Decision Agent candidate): `claude-opus-4-7`
- Graph visualization: `@xyflow/react` + `dagre` (animated SVG edges via the `flow-dash` CSS keyframe)

---

## 1. Screen Inventory

Seven screens. The Agent Ops view is the centerpiece; everything else feeds it or reads from it. All screens are desktop-first, dense, keyboard-navigable, and read against the `STACK_CONFIG.md` design tokens (5-level elevation, Geist + Geist Mono, no rounded-everything SaaS look).

### 1.1 Dashboard
| Field | Detail |
|---|---|
| **Path** | `/` (authenticated) — `/demo` mirror for the public demo |
| **Primary action** | Scan the returns queue; click "Run triage" to fire the graph across pending returns |
| **Key data** | Returns queue table (return ID, marketplace badge, SKU, AOV, age, status, current disposition); KPI cards — returns volume (today / 7d), avg cost per decision, escalation rate %, eval accuracy %; recent-decisions strip |
| **Agent interactions** | "Run triage" is the single entry point that fans returns into the graph. Per-row "triage" for one-off runs. Row click → Return Detail |
| **Empty** | "No returns in queue. Seed fixtures or import a channel." with a seed-data CTA |
| **Loading** | Skeleton rows (`scan-pulse`); KPI cards show shimmer |
| **Error** | Queue fetch failure banner with retry; KPI cards degrade to "—" without blocking the table |

### 1.2 Return Detail
| Field | Detail |
|---|---|
| **Path** | `/returns/[returnId]` |
| **Primary action** | Inspect full return context and the decision record; **override** the disposition (captures into eval dataset) |
| **Key data** | Original order context (customer, LTV, order date, channel, line items); return reason + condition codes; SKU profile (weight, freight class, refurb difficulty, current stock); applicable marketplace policy summary; freight economics block (inbound cost estimate, refurb labor estimate, Open Box resale est.); the full decision record — agent, prompt version, reasoning, confidence, cost, latency; decision history timeline |
| **Agent interactions** | Re-run triage for this return; override button opens override drawer (reason + corrected disposition → eval dataset with label); "View in Agent Ops" deep link |
| **Empty** | N/A (always has a return) — but "Not yet triaged" state if the graph has not run |
| **Loading** | Context panels skeletoned independently so the order summary paints before the decision record |
| **Error** | Per-panel error with retry; decision record failure does not block order context |

### 1.3 Agent Ops View (HERO)
| Field | Detail |
|---|---|
| **Path** | `/agent-ops` (and `/agent-ops/[runId]` for a specific run) |
| **Primary action** | Watch the LangGraph DAG execute live; click any node to open the decision drawer; override from the drawer |
| **Key data** | Live DAG (`@xyflow/react`) with node states (idle / running / complete / failed); animated edges as control flows (`flow-dash`); **cost meter** (running total + per-decision); **eval status badge** (X/Y golden cases passing); decision drawer (full reasoning, confidence, model, prompt version, latency, cost for the selected node); escalation queue rail; drift indicator (rolling-window accuracy delta); prompt-version A/B strip (last week vs this week) |
| **Agent interactions** | This screen *is* the agent system's window. Streams node-activation + decision events live from the agent service. Override UI writes back to the eval dataset |
| **Empty** | Static DAG rendered idle with a "Run triage to see the graph execute" prompt |
| **Loading** | DAG renders immediately in idle state; events stream in. A "connecting…" pill on the live indicator (`pulse-dot`) until the stream opens |
| **Error** | Stream-dropped banner with auto-reconnect; nodes freeze in last-known state rather than blanking; "replay run" fallback reads the persisted decision_steps so the demo never shows an empty graph |

### 1.4 Escalation Queue
| Field | Detail |
|---|---|
| **Path** | `/escalations` |
| **Primary action** | Triage returns the agent declined to auto-decide; resolve (pick a disposition) to release the human-in-the-loop checkpoint |
| **Key data** | Ranked list (urgency = value × age × confidence-gap); per-row reasoning summary ("escalated: confidence 0.61 below 0.75 threshold; AOV $1,420 above auto-decide ceiling"); the candidate dispositions the Decision Agent weighed |
| **Agent interactions** | Resolving feeds the human decision back as an override label into the eval dataset and resumes the graph (Escalation → Audit, then optional comms) |
| **Empty** | "Queue clear. Nothing awaiting review." (a healthy, common state) |
| **Loading** | Skeleton rows |
| **Error** | Fetch error banner + retry |

### 1.5 Eval Results
| Field | Detail |
|---|---|
| **Path** | `/evals` |
| **Primary action** | Read pass/fail across the golden set; drill into a failing case |
| **Key data** | Top-line accuracy (X/Y, %); accuracy trend over time (Recharts); per-agent breakdown table (agent, cases, pass %, last run); failing-case detail (input, expected, actual, diff); link to Braintrust trace |
| **Agent interactions** | Read-only over eval_results. "Re-run evals" triggers the fixture-based suite (never live API in CI; manual re-run may hit the API locally) |
| **Empty** | "No eval runs yet. Run the suite to populate." |
| **Loading** | Chart skeleton + table skeleton |
| **Error** | "Eval run failed — see logs" with link to the run output |

### 1.6 Audit Log
| Field | Detail |
|---|---|
| **Path** | `/audit` |
| **Primary action** | Browse the append-only decision history; filter and export |
| **Key data** | Append-only rows (timestamp, return ID, agent, prompt version, input hash, reasoning excerpt, confidence, cost, latency, outcome, override flag); filters (marketplace, disposition, agent, date range, escalated-only, overridden-only) |
| **Agent interactions** | None — pure read of the immutable audit_log written by the Audit Agent |
| **Empty** | "No audit records yet." |
| **Loading** | Skeleton rows; filters disabled until first page loads |
| **Error** | Fetch error + retry; export disabled on error |

### 1.7 Settings
| Field | Detail |
|---|---|
| **Path** | `/settings` |
| **Primary action** | View marketplace configs; tune model + cost thresholds; reset seed data |
| **Key data** | Marketplace config viewer (read from `/config/marketplaces/*.yaml` — read-only in v1, surfaced for transparency); model selection per agent tier; confidence + value escalation thresholds; cost-per-run ceiling; **seed data reset** control |
| **Agent interactions** | Threshold changes affect the Decision and Escalation agents' branching on the next run |
| **Empty** | N/A — always populated from config/defaults |
| **Loading** | Form skeleton |
| **Error** | Save-failure toast; config-read failure shows "could not load marketplace configs" inline |

---

## 2. Agent Inventory

Fifteen agents. Eight are LLM-powered (call Claude); seven are deterministic workers/lookups that the brief still treats as graph "agents" (nodes) but which run code, not prompts — except the two comms-bearing workers and the Decision/Escalation/Damage/Fraud/Customer-Comms agents, which reason. State keys use a flat namespaced convention (see Hard Decision #2).

Cost estimates assume `claude-haiku-4-5` at ~$1/$5 per Mtok (in/out) and `claude-sonnet-4-6` at ~$3/$15 per Mtok, rounded for planning. Deterministic nodes cost ~$0.

| # | Agent | Type | Model | Est. cost/call |
|---|---|---|---|---|
| 1 | Intake | LLM | `claude-haiku-4-5` | ~$0.0006 |
| 2 | Customer History | Deterministic + light LLM summarize | `claude-haiku-4-5` | ~$0.0005 |
| 3 | SKU Profile | Deterministic lookup | none | ~$0 |
| 4 | Marketplace Policy | Deterministic (YAML read) | none | ~$0 |
| 5 | Damage Signal | LLM | `claude-haiku-4-5` | ~$0.0007 |
| 6 | Fraud Flag | Deterministic + light LLM | `claude-haiku-4-5` | ~$0.0005 |
| 7 | **Decision** | LLM (headline) | `claude-sonnet-4-6` (eval `claude-opus-4-7`) | ~$0.004–0.008 |
| 8 | Refund Worker | Deterministic (Stripe test) | none | ~$0 |
| 9 | Replacement Worker | Deterministic | none | ~$0 |
| 10 | Repair Worker | Deterministic + draft LLM | `claude-haiku-4-5` | ~$0.0004 |
| 11 | Refurb Worker | Deterministic (grading) | none | ~$0 |
| 12 | Donate/Dispose Worker | Deterministic (region route) | none | ~$0 |
| 13 | Customer Comms | LLM | `claude-haiku-4-5` | ~$0.0008 |
| 14 | Escalation | LLM (light) | `claude-haiku-4-5` | ~$0.0004 |
| 15 | Audit | Deterministic (append row) | none | ~$0 |

**Per-run budget check:** worst-case LLM path (Intake + 4 context LLMs + Decision-sonnet + worker draft + Comms + Escalation reasoning) lands roughly **$0.008–0.012** per decision. Well under the $0.10 ceiling, near the $0.01 demo target. Decision Agent on `claude-opus-4-7` would push a single run toward $0.02–0.03 — acceptable only if the eval shows a real quality lift; documented in its ai-feature-spec.

### Per-agent detail

**1. Intake Agent** — *LLM, `claude-haiku-4-5`*
- Purpose: Parse a raw incoming return request into a normalized structured form.
- Reads: `return.raw` (raw payload), `return.channel`.
- Writes: `intake.normalized` (return reason category, condition codes, requested resolution, free-text notes), `intake.confidence`.
- Relationship: **Entry node.** Runs first, alone.

**2. Customer History Agent** — *Deterministic lookup + light LLM summary, `claude-haiku-4-5`*
- Purpose: Pull the customer's order history, lifetime value, and prior return rate, summarized.
- Reads: `order.customerId`.
- Writes: `customer.ltv`, `customer.priorReturnRate`, `customer.orderCount`, `customer.summary`.
- Relationship: **Parallel fan-out group** (after Intake).

**3. SKU Profile Agent** — *Deterministic*
- Purpose: Pull weight, freight class, refurb-difficulty score, and current marketplace stock for the returned SKU.
- Reads: `order.lines[].sku`.
- Writes: `sku.weight`, `sku.freightClass`, `sku.refurbDifficulty`, `sku.currentStock`, `sku.openBoxDemand`.
- Relationship: **Parallel fan-out group.**

**4. Marketplace Policy Agent** — *Deterministic (reads `/config/marketplaces/<name>.yaml`)*
- Purpose: Resolve the applicable policy for the return's channel.
- Reads: `return.channel`.
- Writes: `policy.returnWindow`, `policy.freightSubsidy`, `policy.damageAllowance`, `policy.restockingFee`, `policy.decisioningWindow`, `policy.refundMethod`, `policy.replacementRules`, `policy.special`.
- Relationship: **Parallel fan-out group.**

**5. Damage Signal Agent** — *LLM, `claude-haiku-4-5`*
- Purpose: Parse provided text and condition codes into a structured damage assessment.
- Reads: `intake.normalized`, `return.conditionCodes`, `return.notes`.
- Writes: `damage.severity` (none/cosmetic/functional/destroyed), `damage.resaleViability`, `damage.signals[]`.
- Relationship: **Parallel fan-out group.**

**6. Fraud Flag Agent** — *Deterministic checks + light LLM, `claude-haiku-4-5`*
- Purpose: Detect return-abuse patterns (serial returner, wardrobing, mismatched condition claims).
- Reads: `customer.priorReturnRate`, `intake.normalized`, `damage.severity`, `order` value.
- Writes: `fraud.score`, `fraud.flags[]`, `fraud.recommendHold`.
- Relationship: **Parallel fan-out group.**

**7. Decision Agent** — *LLM (headline), `claude-sonnet-4-6`; eval `claude-opus-4-7`*
- Purpose: Take all upstream context and recommend a disposition with reasoning and a confidence score.
- Reads: everything the five fan-out agents wrote, plus freight economics derived from `sku.*` + `policy.freightSubsidy` + carrier rate fixtures.
- Writes: `decision.disposition` (refund / replace / repair / refurbish / donate / dispose / escalate), `decision.reasoning`, `decision.confidence`, `decision.costMath`, `decision.candidatesWeighed[]`.
- Relationship: **Fan-in node.** Waits for all five parallel agents.

**8. Refund Worker** — *Deterministic (Stripe test mode)*
- Purpose: Issue the refund.
- Reads: `decision.disposition == refund`, `order.payment`, `policy.refundMethod`, `policy.restockingFee`.
- Writes: `execution.refund` (amount, method, stripeRef), `execution.status`.
- Relationship: **Conditional branch target.** → Customer Comms.

**9. Replacement Worker** — *Deterministic*
- Purpose: Check inventory and book a (fixture) replacement shipment.
- Reads: `decision.disposition == replace`, `sku.currentStock`, `order.shipTo`.
- Writes: `execution.replacement` (inventoryHit, shipmentRef), `execution.status`.
- Relationship: **Conditional branch target.** → Customer Comms.

**10. Repair Worker** — *Deterministic + draft LLM, `claude-haiku-4-5`*
- Purpose: Schedule a repair pickup and draft a work order.
- Reads: `decision.disposition == repair`, `damage.signals`, `order.shipTo`.
- Writes: `execution.repair` (pickupSlot, workOrderDraft), `execution.status`.
- Relationship: **Conditional branch target.** → Customer Comms.

**11. Refurb Worker** — *Deterministic (grading)*
- Purpose: Route to the refurb queue with an Open Box grade.
- Reads: `decision.disposition == refurbish`, `damage.severity`, `sku.refurbDifficulty`, `sku.openBoxDemand`.
- Writes: `execution.refurb` (grade A/B/C, queueRef, projectedResale), `execution.status`.
- Relationship: **Conditional branch target.** → Customer Comms.

**12. Donate/Dispose Worker** — *Deterministic (region route)*
- Purpose: Route the item to donation or disposal by region.
- Reads: `decision.disposition in {donate, dispose}`, `order.shipTo.region`, `sku.weight`.
- Writes: `execution.disposal` (route, partner, cost), `execution.status`.
- Relationship: **Conditional branch target.** → Customer Comms.

**13. Customer Comms Agent** — *LLM, `claude-haiku-4-5`*
- Purpose: Draft a channel-appropriate customer message for the executed disposition. Draft goes to a queue, never sent (v1 non-goal).
- Reads: `decision.disposition`, `execution.*`, `return.channel`, `customer.summary`.
- Writes: `comms.draft`, `comms.channelTone`, `comms.queuedAt`.
- Relationship: Runs after any successful worker. → Audit.

**14. Escalation Agent** — *LLM (light), `claude-haiku-4-5`*
- Purpose: When `decision.confidence` is below threshold OR order value above the auto-decide ceiling, package the case for human review.
- Reads: `decision.*`, thresholds from settings, `order` value.
- Writes: `escalation.reason`, `escalation.urgency`, `escalation.candidateDispositions[]`.
- Relationship: **Conditional branch target** from Decision. → Audit (no comms until a human resolves at the HITL checkpoint).

**15. Audit Agent** — *Deterministic (append-only write)*
- Purpose: Write the complete, immutable decision record.
- Reads: the entire final state.
- Writes: one `audit_log` row + one `decision_steps` row per node visited (agent, prompt version, input, reasoning, confidence, cost, latency).
- Relationship: **Terminal node** on every path.

---

## 3. Graph Topology Sketch (LangGraph)

The DAG: a single entry, a five-way parallel fan-out, a fan-in to the headline Decision Agent, a six-way conditional branch, a comms+audit tail, and one human-in-the-loop checkpoint on the escalation path. `[LLM]` = calls Claude; `[DET]` = deterministic node.

```
                         ┌─────────────────────────┐
                         │   START (return queued)  │
                         └────────────┬─────────────┘
                                      │
                              ┌───────▼────────┐
                              │  Intake Agent  │ [LLM]
                              └───────┬────────┘
                                      │  fan-out (parallel)
        ┌────────────────┬───────────┼───────────┬────────────────┐
        ▼                ▼            ▼            ▼                ▼
 ┌────────────┐  ┌────────────┐ ┌──────────┐ ┌────────────┐ ┌────────────┐
 │ Customer   │  │ SKU        │ │Marketplace│ │ Damage     │ │ Fraud Flag │
 │ History    │  │ Profile    │ │ Policy    │ │ Signal     │ │            │
 │ [LLM/DET]  │  │ [DET]      │ │ [DET]     │ │ [LLM]      │ │ [LLM/DET]  │
 └─────┬──────┘  └─────┬──────┘ └────┬──────┘ └─────┬──────┘ └─────┬──────┘
       └────────────────┴───────────┬┴──────────────┴──────────────┘
                                     │  fan-in (barrier: all 5 complete)
                            ┌────────▼─────────┐
                            │  Decision Agent  │ [LLM] ★ headline
                            └────────┬─────────┘
                                     │  conditional branch on decision.disposition
   ┌───────────┬───────────┬────────┼─────────┬───────────────┬──────────────┐
   ▼           ▼           ▼        ▼          ▼               ▼              ▼
┌──────┐  ┌─────────┐ ┌────────┐ ┌────────┐ ┌─────────────┐ ┌────────────┐
│Refund│  │Replace- │ │Repair  │ │Refurb  │ │Donate/      │ │ Escalation │
│Worker│  │ment Wkr │ │Worker  │ │Worker  │ │Dispose Wkr  │ │  Agent     │
│[DET] │  │[DET]    │ │[LLM/DET]│ │[DET]   │ │[DET]        │ │  [LLM]     │
└──┬───┘  └────┬────┘ └───┬────┘ └───┬────┘ └──────┬──────┘ └─────┬──────┘
   └───────────┴──────────┴──────────┴─────────────┘              │
                          │  (any worker succeeded)                │
                  ┌───────▼────────┐                    ┌──────────▼───────────┐
                  │ Customer Comms │ [LLM]              │  HUMAN-IN-THE-LOOP    │
                  │     Agent      │                    │  checkpoint (pause)   │
                  └───────┬────────┘                    │  resolve in           │
                          │                             │  Escalation Queue     │
                          │                             └──────────┬───────────┘
                          │                                        │ (human resolves
                          │                                        │  → may re-enter a
                          │                                        │   worker, then comms)
                          ▼                                        ▼
                  ┌────────────────────────────────────────────────────┐
                  │              Audit Agent  [DET]  (terminal)          │
                  │  append audit_log row + decision_steps per node      │
                  └───────────────────────────┬──────────────────────────┘
                                               ▼
                                            ┌──────┐
                                            │ END  │
                                            └──────┘
```

**Topology rules (carried into `/docs/01b-graph-topology.md`):**
- **Entry:** Intake (LLM) — sole entry.
- **Parallel fan-out:** Customer History, SKU Profile, Marketplace Policy, Damage Signal, Fraud Flag — independent, no shared writes (each owns its namespace), safe to run concurrently.
- **Fan-in barrier:** Decision Agent waits for all five. Partial-failure handling defined in Hard Decision #2 (degrade-with-flag, do not hang).
- **Conditional branch:** Decision routes to exactly one of six targets based on `decision.disposition`. Escalate is a first-class branch, not an error path.
- **Workers → Comms → Audit:** the happy tail.
- **Escalation → HITL checkpoint → Audit:** the graph *pauses* (LangGraph interrupt / persisted checkpoint) until a human resolves in the Escalation Queue; resolution may re-enter the appropriate worker before comms, then audit.
- **Audit is terminal on every path** — including escalation-without-resolution, so even a paused case has an audit trail.

**LLM-powered nodes (8):** Intake, Customer History (summary), Damage Signal, Fraud Flag (reasoning portion), Decision, Repair Worker (work-order draft), Customer Comms, Escalation.
**Deterministic nodes (7+):** SKU Profile, Marketplace Policy, Refund, Replacement, Refurb, Donate/Dispose, Audit.

---

## 4. Marketplace Policy Dimensions

Each marketplace becomes one `/config/marketplaces/<name>.yaml`. Adding a channel is a YAML file, never an agent-code change (CLAUDE.md rule 15). Values below are **fixture-realistic planning targets**, not contractual policy — they exist to make the decisioning math meaningfully different across channels. The Marketplace Policy Agent reads these; the Decision Agent reasons over them.

| Dimension | Wayfair | Amazon FBA | Amazon FBM | Houzz | Overstock | Direct Shopify |
|---|---|---|---|---|---|---|
| **Return window (days)** | 30 | 30 (Amazon-managed) | 30 | 30 | 30 | 30 (seller-set) |
| **Inbound freight subsidy (who pays)** | Marketplace subsidizes for damage/defect; buyer pays remorse | Amazon prepaid label (cost to seller via fees) | Seller provides label | Trade terms; often seller-paid | Buyer pays remorse, seller pays defect | Seller policy (configurable) |
| **Damage allowance (% keep w/o full return)** | up to ~20% concession | low; Amazon favors full refund | seller discretion | negotiated, designer channel | up to ~30% (clearance tolerance) | seller-set (default 0%) |
| **Restocking fee (allowed %)** | up to 20% (non-defective) | generally disallowed | up to 20% | up to 15% | up to 20% | seller-set (default 0–15%) |
| **Decisioning window (days to respond)** | 48h on damage claims | 24–48h (auto-refund risk) | 48h | 72h (trade leniency) | 48h | n/a (real-time) |
| **Refund method** | original payment | original payment | original payment | original or trade credit | original payment / store credit | original payment |
| **Replacement eligibility** | yes if in stock, freight-aware | yes (FBA reships) | yes (seller ships) | yes, white-glove option | limited (clearance = no reship) | yes |
| **Special rules** | **No return-ship for items > ~150 lbs** — refund-or-refurbish-in-place economics dominate; high freight-subsidy on damage | Auto-refund pressure: must decide fast or Amazon refunds anyway; FBA removal fees | Seller bears full reverse logistics | Trade/designer relationships weigh toward concession over hard refund | Clearance items rarely worth reshipping; donate/dispose bias | Simplest policy — the comparison baseline |

**Why this matters to the wedge:** the same damaged $1,200 sofa nets a different optimal disposition per channel. On Wayfair (>150 lb no-return-ship + high damage subsidy) the math favors refurbish-in-place or partial concession. On Overstock clearance, donate/dispose often beats reshipping. On Direct Shopify, the seller eats reverse freight, so refurbish-and-resell-as-Open-Box leads when local demand exists. This per-channel divergence is exactly what no competitor models, and it is the Decision Agent's core job.

---

## 5. Hard Decisions (top 3)

### Hard Decision #1 — Decision Agent confidence calibration

**Decision:** How does the Decision Agent decide when to *decide* versus *escalate*, and how do we set thresholds so the system neither over-escalates (useless — a human still does everything) nor under-escalates (costly — a wrong $1,400 disposition ships)?

**Why it's hard:** LLM-reported confidence is not calibrated probability — a model will happily say 0.9 on a wrong answer. A single global confidence threshold ignores that a wrong call on a $1,400 freight item costs far more than on a $120 accessory. Over-escalation defeats the "2 people doing the work of 10" premise; under-escalation produces the one expensive mistake that kills trust in a demo.

**Options considered:**
1. **Single global confidence threshold** (e.g., escalate if `confidence < 0.75`). Simple, easy to demo, but value-blind.
2. **Value-weighted threshold matrix** — escalate if `confidence < f(orderValue)`, where the bar rises with dollars at risk (a $1,400 item needs 0.9; a $120 item needs 0.6). Plus a hard ceiling: any order over $N always escalates regardless of confidence.
3. **Calibration via the eval set** — derive thresholds empirically from where the golden cases show the model's confidence diverging from correctness, and recalibrate as override data accumulates.

**Lean (Phase 1 locks it):** **Option 2 as the mechanism, tuned by Option 3.** Ship a value-weighted threshold with a hard high-value ceiling (so the demo reliably produces ≥1 escalation — a success-criterion requirement), and feed the override + eval data back to recalibrate the curve over time. Confidence is treated as a *routing signal*, never as a calibrated probability; the audit log records both confidence and the threshold it was compared against, so every escalation is explainable on screen.

---

### Hard Decision #2 — Graph state shape & parallel fan-in

**Decision:** What lives in the LangGraph state object, how do five parallel agents merge their writes into the Decision Agent without a state explosion or write conflicts, and what happens when one parallel branch fails?

**Why it's hard:** LangGraph state is shared and reducer-merged. Five concurrent nodes writing the same dict risks clobbering; a fat state object passed to every node bloats token cost and traces; and a naive fan-in *barrier* will hang the whole run if one branch errors — which in a live demo means the hero screen freezes.

**Options considered:**
1. **One flat state dict, last-write-wins.** Simplest, but concurrent writers can clobber and there is no failure isolation.
2. **Namespaced sub-state per agent with typed reducers** — each parallel agent writes only under its own key (`customer.*`, `sku.*`, `policy.*`, `damage.*`, `fraud.*`); the Decision Agent reads a curated projection, not the whole blob. Fan-in uses a reducer that merges namespaces and tolerates a missing/failed branch by marking it `degraded` rather than blocking.
3. **External context store** — parallel agents write to Redis/Postgres, state holds only references. Maximum decoupling, but more moving parts and harder to trace in Braintrust.

**Lean (Phase 1 locks it):** **Option 2.** Namespaced sub-state with typed reducers, no cross-namespace writes among the parallel five, and a **degrade-don't-hang** fan-in: a failed branch sets `<ns>.status = degraded` with a reason, the Decision Agent receives the degraded flag in its curated projection and lowers its confidence accordingly (which can itself trigger escalation via Hard Decision #1). The Decision Agent never sees raw upstream blobs — it gets a compact, typed projection to keep token cost (and the cost meter) honest.

---

### Hard Decision #3 — Real-time Agent Ops view streaming architecture

**Decision:** SSE vs. WebSocket for streaming graph-execution events to the frontend, and how do we handle reconnection, missed events, and the demo case where the full run completes in under three seconds?

**Why it's hard:** The hero screen's entire value is *watching* the graph execute. If events arrive out of order, drop on a reconnect, or — worse — the whole run finishes in 1.5s so there's nothing to watch, the demo's "60 seconds tells you what it does" criterion fails. There is also the open runtime-split tension (Python agent service vs. TS-only): event transport must work across an HTTP/IPC boundary if the Python path is chosen.

**Options considered:**
1. **WebSocket** — bidirectional, lowest latency, natural for live node-state pushes; but more infra (connection lifecycle, heartbeats), and bidirectionality is unused since the frontend only listens.
2. **SSE (Server-Sent Events)** — one-way server→client, dead-simple over HTTP, native auto-reconnect with `Last-Event-ID`, trivially proxied through the Next.js BFF to the Python service. Fits "stream events to a viewer" exactly.
3. **Poll the persisted `decision_steps` table** — dead simple, demo-proof (it's just reads), but not "live" and feels laggy.

**Lean (Phase 1 locks it):** **SSE as primary, with the persisted `decision_steps` table as the replay/fallback source.** SSE matches the one-way streaming need, auto-reconnects with `Last-Event-ID` to recover missed events, and proxies cleanly through the BFF regardless of which runtime the agent service runs on. Every streamed event is *also* persisted, so reconnection and the `/agent-ops/[runId]` replay both read from the same source of truth — the demo can replay a run on demand and never show an empty graph. For the **sub-3-second-run** problem, the agent service emits paced node-transition events (a small deliberate delay between node activations) so the graph visibly *executes* rather than blinking to done; this pacing is a demo affordance, configurable, and logged as an assumption.

---

## 6. Risks Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **LangGraph streaming-event reliability in the demo** — events drop, arrive out of order, or the stream stalls mid-run | M | H | SSE with `Last-Event-ID` reconnect; **persist every event** to `decision_steps`; `/agent-ops/[runId]` replays from the table; nodes hold last-known state on disconnect rather than blanking. Rehearse the demo against the replay path. |
| 2 | **Claude API latency makes the Agent Ops view feel slow** — node-to-node waits feel laggy | M | M | Haiku for all light agents; parallel fan-out collapses five waits into one; curated state projection keeps prompts short; show per-node spinners + the cost meter so latency reads as "work happening." Pre-warm / cache fixture-deterministic nodes. |
| 3 | **Freight cost estimation accuracy without a real carrier API** | H | M | Carrier rate-sheet fixtures keyed by weight × freight class × region; document as fixture-derived in the README and ASSUMPTIONS; the *relative* economics (refurbish vs. dispose) drive the decision, and relative ordering is robust to absolute-rate error. |
| 4 | **Fixture data doesn't represent edge cases well enough for 90%+ eval accuracy** | M | H | data-fixtures deliberately seeds the hard cases (damage + high-value + clearance channel; serial-returner fraud; >150 lb Wayfair no-return-ship; degraded-branch). Golden set spans all six dispositions and all channels; reviewed by product-owner before the accuracy gate. |
| 5 | **"Demo rot" — graph logic works but the Ops-view animation breaks** | M | H | Treat the visualization as a tested artifact: snapshot/interaction tests on node-state transitions; the replay path (#1) is independent of live execution; a "replay last run" control is always available as the demo safety net. |
| 6 | **Python/TypeScript IPC overhead kills the real-time feel** (if the two-runtime split is chosen) | M | M | This is the Phase-1 runtime decision (open tension above). If two-runtime: keep the BFF→agent hop SSE-passthrough (no re-buffering), co-locate services, and benchmark round-trip in Phase 2 scaffolding. A single-TS-runtime path eliminates the hop entirely — weigh in Phase 1 Track A. |
| 7 | **Eval-suite gaming — golden cases too easy / not representative** | M | H | Eval set must include adversarial and ambiguous cases (low-confidence-by-design, conflicting signals, degraded branches); per-agent breakdown surfaces an agent that's "passing" only on softballs; overrides feed real-world hard cases back in (CLAUDE.md rule 14); product-owner signs off that the set is representative, not just green. |
| 8 | **Cost ceiling breach** — a run exceeds $0.10, or Decision-on-Opus inflates per-decision cost | M | M | Per-run cost logged and asserted in tests; cost meter on the hero screen; Opus used for Decision *only if* the eval shows a real lift, documented in its ai-feature-spec; haiku elsewhere. A run over $0.10 fails CI as a bug, not a warning. |
| 9 | **Unresolved runtime split (Python+TS vs. all-TS) stalls Phase 2 scaffolding** | M | H | Force the decision at the Phase 1 Track A gate with written tradeoffs (CLAUDE.md requires it); `STACK_CONFIG.md` already supplies a complete all-TS path including `@xyflow/react` graph rendering, lowering the cost of choosing single-runtime if LangGraph.js is judged sufficient. |
| 10 | **HITL checkpoint complexity** — pausing/resuming a LangGraph run for human escalation is fiddly and could deadlock the demo | M | M | Use LangGraph's interrupt/checkpoint primitive with state persisted to Postgres; escalation always writes an audit row *before* pausing (#audit-terminal rule), so a paused run is never invisible; resolving from the Escalation Queue is a normal resume, exercised in tests. |

---

## Anti-Drift Checklist (Phase 0 boundary)

1. **Deliverable doc written?** Yes — `C:\Users\test\Backhaul\docs\00-discovery.md` (this file).
2. **BUILD_LEDGER updated?** Not yet created — Phase 0 produces no code. Proposed first row at signoff: `discovery | built | docs/00-discovery.md | n/a | runtime split unresolved (Phase 1)`.
3. **Gate commands run?** N/A — no code in Phase 0.
4. **Deferred items logged?** v1 non-goals carried from the brief (multi-tenancy, real APIs, real Stripe charges, image/video damage analysis, SMS/email sends, mobile, white-label) — to be written to BUILD_LEDGER as `deferred` at Phase 1 start.
5. **Assumptions logged?** To create `/docs/ASSUMPTIONS.md` at Phase 1 start. Open assumptions surfaced here: fixture-derived freight rates; demo event-pacing delay; policy values are fixture-realistic not contractual.
6. **Re-read discovery — anything unaccounted for?** This *is* discovery. All seven screens, fifteen agents, six channels accounted for.
7. **Prior phase commitments carried forward?** N/A — first phase.
8. **Per-agent artifacts (spec / prompt / contract / test / span / cost)?** Inventoried here; produced in Phase 3.
9. **Decision audit row shape defined?** Yes — agent, prompt version, input, reasoning, confidence, cost, latency; append-only; Audit Agent owns it.
10. **Graph topology doc matches actual graph?** Topology sketched here; formal `/docs/01b-graph-topology.md` is a Phase 1 deliverable that must match this DAG.
11. **In-app Agent Ops view renders every node?** Design is a Phase 1/Phase 4 deliverable; node inventory (15) is fixed here.
12. **Cost per run under $0.10?** Projected $0.008–0.012 per decision; budget math in §2.

---

## Phase 0 Exit Gate

**Status: PENDING stakeholder signoff.**

Per CLAUDE.md §8, work stops here. Do not start Phase 1, do not scaffold, do not write code. The three items requiring an explicit Phase 1 decision before scaffolding can begin:

1. **Runtime split** — Python FastAPI + LangGraph vs. all-TypeScript with LangGraph.js (brief vs. `STACK_CONFIG.md` tension).
2. **Persistence** — Neon Postgres (brief) vs. Supabase (`STACK_CONFIG.md`).
3. **Confidence-threshold model** — value-weighted matrix + hard ceiling (leaning) confirmed against the demo's "≥1 escalation" requirement.

On signoff, Phase 1 launches three parallel tracks: Architecture/graph-topology (A), Design system (B), Schema (C).
