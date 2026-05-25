# 01b — Graph Topology Specification

**Phase:** 1 — Architecture, Graph Design, Design System
**Track:** A — Architecture and graph topology
**Role:** architect
**Status:** Built — pending Phase 1 exit gate
**Date:** 2026-05-25

---

## Purpose

This is the **authoritative specification** of the Backhaul LangGraph graph. The implementation file `apps/agent/app/graph/topology.py` must match this document exactly — every node, every edge, every conditional, every checkpoint declared here and nowhere else (Hard Rule 12). The in-app Agent Ops visualization config derives its node set and edge set from this spec. No node is added to the graph without updating this document first.

Carried forward from `/docs/00-discovery.md §3` (the topology sketch) and `/docs/01a-architecture.md §1.2` (state management decision: namespaced sub-state, degrade-don't-hang fan-in).

---

## 1. Topology Overview

```
[START]
   │
   ▼
[intake_agent]  ── LLM (claude-haiku): parse raw_return_text → ReturnIntakeSchema
   │
   │  PARALLEL FAN-OUT via LangGraph Send API (5 branches, true concurrency)
   ├───────────────┬───────────────┬────────────────┬───────────────┐
   ▼               ▼               ▼                ▼               ▼
[customer_      [sku_profile_   [marketplace_    [damage_signal_  [fraud_flag_
 history_agent]  agent]          policy_agent]    agent]           agent]
  LLM(haiku)+     DET lookup      DET YAML read    LLM(haiku)       DET rules +
  DET lookup                                       classify         light LLM(haiku)
   │               │               │                │               │
   └───────────────┴───────────────┴────────────────┴───────────────┘
                                   │
                       FAN-IN BARRIER: _all_parallel_complete(state)
                       (each branch wrote its key OR recorded errors[branch];
                        proceed when all 5 accounted for — degrade, don't hang)
                                   │
                                   ▼
                          [decision_agent]  ── LLM (claude-sonnet-4-6 default;
                                                  claude-opus-4-7 in eval suite)
                                   │            reads curated projection of all 5
                                   │            → DispositionDecisionSchema
                                   │
            CONDITIONAL ROUTE on state.decision.disposition
   ┌──────────┬──────────┬──────────┬───────────┬───────────────────┬─────────────┐
   │ refund   │ replace  │ repair   │ refurbish │ donate / dispose  │ escalate    │
   ▼          ▼          ▼          ▼           ▼                   ▼
[refund_   [replacement_ [repair_  [refurb_   [donate_dispose_   [escalation_agent]
 worker]    worker]       worker]   worker]    worker]             LLM(haiku):
 DET:Stripe DET:inventory DET +     DET:grade  DET:regional        summarize for human
 test mode  + fixture     LLM(haiku) + route    routing             │
            shipping      draft WO                                  ▼
   │          │           │          │           │          [HUMAN_IN_THE_LOOP
   │          │           │          │           │           checkpoint: interrupt()]
   └──────────┴───────────┴──────────┴───────────┘                 │
                          │  (worker paths rejoin)        human resolves in
                          │                                Escalation Queue
                          │                                → Command(resume=...)
                          │                                → re-enters appropriate
                          │                                  worker, then rejoins
                          ▼                                        │
                  [customer_comms_agent] ◄─────────────────────────┘
                   LLM (claude-haiku): draft channel-appropriate message → queue
                          │
                          ▼
                  [audit_agent]  ── DET: write decision_steps rows + decisions record
                          │
                          ▼
                       [END]
```

**Invariants.**

- **Single entry:** `intake_agent`.
- **Five-way parallel fan-out** via the `Send` API for true concurrency; each branch owns a disjoint state namespace, so there are no concurrent-write conflicts.
- **Degrade-don't-hang fan-in:** the barrier proceeds once every parallel branch has either written its key or recorded an error. A failed branch never blocks the run.
- **Six-way conditional branch** from `decision_agent`; `escalate` is a first-class branch, not an error path.
- **Audit is terminal on every path** — including an escalation that is never resolved, so even a paused case has an audit row.

---

## 2. State Schema (Python `TypedDict`)

The complete graph state. Implemented in `apps/agent/app/graph/state.py`; mirrored as TypeScript interfaces in `packages/types`. Each sub-schema below is the JSON output contract for its agent.

```python
from typing import TypedDict, Literal, Optional

Marketplace = Literal["wayfair", "amazon_fba", "amazon_fbm", "houzz", "overstock", "shopify"]
Disposition = Literal["refund", "replace", "repair", "refurbish", "donate", "dispose", "escalate"]

class BackhaulState(TypedDict):
    run_id: str
    return_id: str
    marketplace: Marketplace
    raw_return_text: str

    # Entry
    intake: Optional["ReturnIntakeSchema"]

    # Parallel fan-out (each branch owns exactly one of these keys)
    customer_history: Optional["CustomerHistorySchema"]
    sku_profile: Optional["SkuProfileSchema"]
    marketplace_policy: Optional["MarketplacePolicySchema"]
    damage_signal: Optional["DamageSignalSchema"]
    fraud_flags: Optional["FraudFlagSchema"]

    # Headline
    decision: Optional["DispositionDecisionSchema"]

    # Execution + tail
    worker_result: Optional["WorkerResultSchema"]
    comms_draft: Optional["CommsDraftSchema"]
    audit_written: bool

    # Escalation / HITL
    escalation_reason: Optional[str]
    human_override: Optional["HumanOverrideSchema"]

    # Cross-cutting
    errors: dict[str, str]          # keyed by agent name — partial-failure tracking
    events: list["GraphEvent"]      # append-only event log (SSE source)
    total_cost_usd: float
    started_at: str                 # ISO8601
```

### Sub-schemas (JSON output contracts)

```python
class ReturnIntakeSchema(TypedDict):
    reason_category: Literal["damage", "defect", "buyer_remorse", "wrong_item", "not_as_described", "other"]
    condition_codes: list[str]            # normalized condition codes parsed from text
    requested_resolution: Literal["refund", "replace", "repair", "exchange", "unspecified"]
    item_skus: list[str]
    free_text_notes: str
    confidence: float                     # 0..1, model self-reported

class CustomerHistorySchema(TypedDict):
    customer_id: str
    ltv_usd: float
    order_count: int
    prior_return_rate: float              # 0..1
    months_active: int
    summary: str                          # one-line LLM summary

class SkuProfileSchema(TypedDict):
    sku: str
    weight_lb: float
    freight_class: str                    # e.g. "85", "150"
    dims_in: list[float]                  # [L, W, H]
    refurb_difficulty: int                # 1 (easy) .. 5 (hard)
    current_stock: int
    open_box_demand: Literal["none", "low", "medium", "high"]

class MarketplacePolicySchema(TypedDict):
    marketplace: Marketplace
    return_window_days: int
    freight_subsidy: str                  # who pays inbound freight, by reason
    damage_allowance_pct: float           # % keep without full return
    restocking_fee_pct: float
    decisioning_window_hours: int
    refund_method: Literal["original_payment", "store_credit", "trade_credit"]
    replacement_eligible: bool
    special_rules: list[str]              # e.g. "no_return_ship_over_150lb"

class DamageSignalSchema(TypedDict):
    severity: Literal["none", "cosmetic", "functional", "destroyed"]
    resale_viability: Literal["resellable_new", "open_box", "refurbish_only", "scrap"]
    signals: list[str]                    # extracted damage signals
    confidence: float

class FraudFlagSchema(TypedDict):
    score: float                          # 0..1 abuse likelihood
    flags: list[str]                      # e.g. "serial_returner", "wardrobing", "condition_mismatch"
    recommend_hold: bool

class FreightEconomics(TypedDict):
    inbound_freight_usd: float            # from carrier rate fixture
    refurb_labor_usd: float
    projected_open_box_resale_usd: float
    disposal_cost_usd: float

class DispositionDecisionSchema(TypedDict):
    disposition: Disposition
    reasoning: str
    confidence: float                     # 0..1, routing signal (not calibrated prob)
    cost_math: FreightEconomics
    candidates_weighed: list[dict]        # [{disposition, est_net_usd, rationale}]
    threshold_compared_against: float     # value-weighted escalation threshold used
    degraded_signals: list[str]           # which upstream keys were unknown/degraded

class WorkerResultSchema(TypedDict):
    worker: Literal["refund", "replacement", "repair", "refurb", "donate_dispose"]
    status: Literal["executed", "queued", "failed"]
    detail: dict                          # worker-specific payload (stripe_ref, shipment_ref, grade, etc.)
    cost_usd: float

class CommsDraftSchema(TypedDict):
    channel: Marketplace
    tone: str
    subject: str
    body: str
    queued_at: str                        # ISO8601 — drafted to queue, never sent (v1 non-goal)

class HumanOverrideSchema(TypedDict):
    resolved_by: str
    chosen_disposition: Disposition
    reason: str
    resolved_at: str                      # ISO8601
    eval_label: Disposition               # captured into the eval dataset

class GraphEvent(TypedDict):
    run_id: str
    event_type: Literal["node_started", "node_completed", "node_failed",
                        "decision_made", "escalation", "cost_update",
                        "run_completed", "run_failed"]
    node_name: Optional[str]
    timestamp: str                        # ISO8601
    data: dict
    cost_delta_usd: float
    total_cost_usd: float
```

---

## 3. Node Definitions

Token and cost estimates assume `claude-haiku-4-5` at ~$1/$5 per Mtok (in/out) and `claude-sonnet-4-6` at ~$3/$15 per Mtok. Deterministic nodes cost ~$0. On any failure an LLM node writes `errors[node_name]` and leaves its state key `None`; execution continues (degrade-don't-hang).

| # | Node (Python fn) | Type | Model | Reads (state keys) | Writes (state keys) | Tokens in/out | Cost/call | Braintrust span |
|---|---|---|---|---|---|---|---|---|
| 1 | `intake_agent` | LLM | `claude-haiku-4-5` | `raw_return_text`, `marketplace` | `intake` | ~600 / ~250 | ~$0.0019 | `backhaul.intake` |
| 2 | `customer_history_agent` | LLM + DET | `claude-haiku-4-5` | `intake`, `return_id` | `customer_history` | ~400 / ~150 | ~$0.0012 | `backhaul.customer_history` |
| 3 | `sku_profile_agent` | DET | — | `intake` | `sku_profile` | — | ~$0 | `backhaul.sku_profile` |
| 4 | `marketplace_policy_agent` | DET | — | `marketplace` | `marketplace_policy` | — | ~$0 | `backhaul.marketplace_policy` |
| 5 | `damage_signal_agent` | LLM | `claude-haiku-4-5` | `intake`, `raw_return_text` | `damage_signal` | ~500 / ~200 | ~$0.0015 | `backhaul.damage_signal` |
| 6 | `fraud_flag_agent` | DET + LLM | `claude-haiku-4-5` | `customer_history`, `intake`, `damage_signal` | `fraud_flags` | ~350 / ~120 | ~$0.0010 | `backhaul.fraud_flag` |
| 7 | `decision_agent` | LLM | `claude-sonnet-4-6` (eval `claude-opus-4-7`) | `intake`, `customer_history`, `sku_profile`, `marketplace_policy`, `damage_signal`, `fraud_flags`, `errors` | `decision` | ~1500 / ~600 | ~$0.0135 (sonnet) | `backhaul.decision` |
| 8 | `refund_worker` | DET | — (Stripe test) | `decision`, `marketplace_policy` | `worker_result` | — | ~$0 | `backhaul.refund_worker` |
| 9 | `replacement_worker` | DET | — | `decision`, `sku_profile` | `worker_result` | — | ~$0 | `backhaul.replacement_worker` |
| 10 | `repair_worker` | DET + LLM | `claude-haiku-4-5` | `decision`, `damage_signal` | `worker_result` | ~300 / ~250 | ~$0.0016 | `backhaul.repair_worker` |
| 11 | `refurb_worker` | DET | — | `decision`, `damage_signal`, `sku_profile` | `worker_result` | — | ~$0 | `backhaul.refurb_worker` |
| 12 | `donate_dispose_worker` | DET | — | `decision`, `sku_profile` | `worker_result` | — | ~$0 | `backhaul.donate_dispose_worker` |
| 13 | `customer_comms_agent` | LLM | `claude-haiku-4-5` | `decision`, `worker_result`, `marketplace`, `customer_history` | `comms_draft` | ~500 / ~350 | ~$0.0023 | `backhaul.customer_comms` |
| 14 | `escalation_agent` | LLM | `claude-haiku-4-5` | `decision`, `customer_history`, `marketplace_policy` | `escalation_reason` | ~450 / ~200 | ~$0.0015 | `backhaul.escalation` |
| 15 | `audit_agent` | DET | — | entire final state | `audit_written` (+ DB rows) | — | ~$0 | `backhaul.audit` |

**Fallback per node.** LLM nodes: on parse failure or API error, run the defensive parser's fallback (a schema-valid default with `confidence: 0.0`), write `errors[node_name]`, and continue. Deterministic nodes: on lookup miss, write a `degraded` marker into their key plus `errors[node_name]`, and continue. The Decision Agent reads `errors` and `degraded_signals` and lowers confidence, which can route to escalation.

---

## 4. Edge Definitions and Conditionals

Every edge, explicitly:

| From | To | Type | Condition |
|---|---|---|---|
| `START` | `intake_agent` | normal | always |
| `intake_agent` | `customer_history_agent`, `sku_profile_agent`, `marketplace_policy_agent`, `damage_signal_agent`, `fraud_flag_agent` | **parallel fan-out** | `Send` API — emit one `Send` per branch for true concurrency |
| each of the 5 parallel nodes | (fan-in barrier) | conditional | barrier proceeds when `_all_parallel_complete(state)` is true |
| (fan-in barrier) | `decision_agent` | normal | once barrier satisfied |
| `decision_agent` | `refund_worker` | conditional | `state["decision"]["disposition"] == "refund"` |
| `decision_agent` | `replacement_worker` | conditional | `== "replace"` |
| `decision_agent` | `repair_worker` | conditional | `== "repair"` |
| `decision_agent` | `refurb_worker` | conditional | `== "refurbish"` |
| `decision_agent` | `donate_dispose_worker` | conditional | `in {"donate", "dispose"}` |
| `decision_agent` | `escalation_agent` | conditional | `== "escalate"` |
| `refund_worker` | `customer_comms_agent` | normal | always |
| `replacement_worker` | `customer_comms_agent` | normal | always |
| `repair_worker` | `customer_comms_agent` | normal | always |
| `refurb_worker` | `customer_comms_agent` | normal | always |
| `donate_dispose_worker` | `customer_comms_agent` | normal | always |
| `escalation_agent` | `audit_agent` | normal | after `interrupt()` (audit row written before pause) |
| `customer_comms_agent` | `audit_agent` | normal | always |
| `audit_agent` | `END` | normal | always |

**Parallel fan-out implementation.** The router after `intake_agent` returns a list of `Send("customer_history_agent", state)`, `Send("sku_profile_agent", state)`, … one per branch. LangGraph's `Send` API schedules them concurrently. Because each branch writes only its own namespaced key, no reducer conflict arises.

**Fan-in barrier.** A conditional edge guards entry to `decision_agent` with `_all_parallel_complete(state)`, defined as: for each of the five branch names, either its state key is non-`None` or `errors[branch]` exists. The barrier therefore never waits on a failed branch — it proceeds with whatever is present.

**Conditional routing from Decision.** `route_from_decision(state)` returns the worker node name keyed off `state["decision"]["disposition"]`, mapping `donate`/`dispose` to the single `donate_dispose_worker` and `escalate` to `escalation_agent`.

**Escalation resumption.** After a human resolves at the HITL checkpoint, `Command(resume=HumanOverrideSchema)` re-enters the graph. The resume target is the worker corresponding to `human_override.chosen_disposition` (or straight to `customer_comms_agent` if the human chose a no-execution outcome), then the normal `→ comms → audit` tail.

---

## 5. Human-in-the-Loop Checkpoint

The escalation path uses LangGraph's `interrupt` / `Command(resume=...)` mechanism, backed by the Redis checkpointer.

1. **Pause.** Inside `escalation_agent`, after writing the escalation summary to `escalation_reason` and emitting an `escalation` `GraphEvent`, the node calls `interrupt({...})`. The audit row is written *before* the pause is finalized (audit-terminal rule), so a paused case is never invisible.
2. **Persist.** LangGraph checkpoints the full graph state to Redis under `graph:run:{run_id}:checkpoint`. The live run state at `graph:run:{run_id}:state` is marked `awaiting_human`.
3. **Review.** The case appears in the Escalation Queue screen (`/escalations`), ranked by urgency (value × age × confidence-gap), showing the reason summary and the `candidates_weighed` from the Decision Agent.
4. **Resolve.** The operator submits a disposition. `POST /api/graph/override` → `POST /graph/override` resumes the graph with `Command(resume=HumanOverrideSchema)`.
5. **Re-enter.** The graph re-enters at the worker matching `chosen_disposition`, runs the normal tail (`worker → customer_comms_agent → audit_agent → END`).
6. **Learn.** The override is captured into the `overrides` table with `eval_label = chosen_disposition` and fed into the eval dataset (Hard Rule 14).

This directly mitigates Phase 0 Risk #10: the interrupt/checkpoint primitive is exercised by tests, and every paused run already has an audit trail.

---

## 6. SSE Event Schema

Every event the graph emits for the Agent Ops view. Each is persisted to `decision_steps` as it streams (replay source) and forwarded over SSE by the agent service (live source).

```python
from dataclasses import dataclass
from typing import Literal, Optional

@dataclass
class GraphEvent:
    run_id: str
    event_type: Literal[
        "node_started",     # node entered;          data = {node_name}
        "node_completed",   # node wrote its key;    data = {node_name, output_summary}
        "node_failed",      # node errored+degraded; data = {node_name, error}
        "decision_made",    # decision agent done;   data = {disposition, confidence}
        "escalation",       # HITL pause begins;     data = {reason, urgency, candidates}
        "cost_update",      # incremental cost tick; data = {node_name}
        "run_completed",    # END reached;           data = {final_disposition}
        "run_failed",       # unrecoverable error;   data = {error}
    ]
    node_name: Optional[str]
    timestamp: str          # ISO8601
    data: dict              # event-type-specific payload (see comments above)
    cost_delta_usd: float   # incremental cost since the last event
    total_cost_usd: float   # running total for the run
```

**SSE framing.** Each event is sent as `id: <monotonic-seq>\nevent: <event_type>\ndata: <GraphEvent JSON>\n\n`. The `id` field backs `Last-Event-ID` reconnection. The browser keys node-state rendering off `node_started`/`node_completed`/`node_failed` and the cost meter off `cost_update`/`total_cost_usd`.

---

## 7. Cost Budget

Worst-case full-LLM-path run (Intake + 4 LLM context agents + Decision-sonnet + Repair draft + Comms + Escalation reasoning is mutually exclusive with workers, so the realistic worst case is Decision → one worker → comms). The table below sums a representative expensive path: Intake + all 5 fan-out (4 LLM, 1 DET) + Decision (sonnet) + Repair worker (the only LLM worker) + Comms.

| Node | Model | In tok | Out tok | Cost/call |
|---|---|---|---|---|
| `intake_agent` | haiku | 600 | 250 | $0.0019 |
| `customer_history_agent` | haiku | 400 | 150 | $0.0012 |
| `sku_profile_agent` | — | — | — | $0.0000 |
| `marketplace_policy_agent` | — | — | — | $0.0000 |
| `damage_signal_agent` | haiku | 500 | 200 | $0.0015 |
| `fraud_flag_agent` | haiku | 350 | 120 | $0.0010 |
| `decision_agent` | sonnet | 1500 | 600 | $0.0135 |
| `repair_worker` (LLM worker) | haiku | 300 | 250 | $0.0016 |
| `customer_comms_agent` | haiku | 500 | 350 | $0.0023 |
| `escalation_agent` (only on escalate path) | haiku | 450 | 200 | $0.0015 |
| **Total — worker path (no escalation)** | | | | **~$0.0230** |
| **Total — escalation path** | | | | **~$0.0214** |

Both well under the **$0.10 ceiling** (Hard Rule 16). The common path (Decision routes to a deterministic worker, not Repair) lands closer to **~$0.021**. If the Decision Agent is run on `claude-opus-4-7` in the eval suite, its per-call cost rises to roughly $0.05–0.07, pushing a single run toward $0.07–0.09 — still under the ceiling but only justified if the eval shows a real quality lift, documented in the Decision Agent's ai-feature-spec (Phase 3).

---

## 8. Prompt Registry

The authoritative prompt registry. Prompt files live at `apps/agent/prompts/{agent}/v{N}.md`; the `prompt_versions` table records which version produced which decision (Hard Rules 11, 13).

| Agent (LLM) | Prompt file | Current version | Output schema |
|---|---|---|---|
| Intake | `prompts/intake/v1.md` | v1 | `ReturnIntakeSchema` |
| Customer History | `prompts/customer_history/v1.md` | v1 | `CustomerHistorySchema` (summary field) |
| Damage Signal | `prompts/damage_signal/v1.md` | v1 | `DamageSignalSchema` |
| Fraud Flag | `prompts/fraud_flag/v1.md` | v1 | `FraudFlagSchema` (reasoning portion) |
| Decision | `prompts/decision/v1.md` | v1 | `DispositionDecisionSchema` |
| Repair Worker | `prompts/repair_worker/v1.md` | v1 | `WorkerResultSchema` (work-order draft) |
| Customer Comms | `prompts/customer_comms/v1.md` | v1 | `CommsDraftSchema` |
| Escalation | `prompts/escalation/v1.md` | v1 | `escalation_reason` (string + urgency) |

Deterministic nodes (`sku_profile`, `marketplace_policy`, `refund_worker`, `replacement_worker`, `refurb_worker`, `donate_dispose_worker`, `audit`) have no prompt file; they run code, not prompts.
