# Backhaul — Architecture

> Portfolio artifact. This document captures every significant architectural decision made during the build, with the reasoning behind each. It is written for a hiring manager who wants to understand the engineering, not just the feature list.

---

## 1. System Overview

Backhaul is an AI-powered returns triage system for multi-marketplace big-ticket sellers. The domain problem: a seller moving furniture, appliances, and fitness equipment across Wayfair, Amazon, Houzz, Overstock, and a direct Shopify channel receives hundreds of returns per week. Each return has a different policy window, a different freight cost structure, and a different set of downstream options — refund, replace, repair, refurbish-and-resell as Open Box, donate locally, or dispose. The economics are genuinely different from small-ticket e-commerce: a $1,200 sofa coming back with cosmetic damage is not a refund-or-exchange decision, it is a freight-vs-refurb-labor-vs-open-box-demand calculation that changes by marketplace, SKU, and region. No existing tool targets this decision space.

The system is a two-runtime architecture. The **agent layer** is Python 3.11, FastAPI, and LangGraph. It owns all AI inference, policy resolution, freight economics, fraud detection, and disposition logic. The **frontend and BFF** are TypeScript, Next.js 14 App Router. The frontend owns all UI rendering, the WebSocket/SSE connection to the agent service, and the BFF routes that serve the dashboard and detail views. The two runtimes communicate over HTTP: a REST trigger from the BFF to start a graph run, and a Server-Sent Events stream from the agent service back to the frontend so the in-app Agent Ops view can render node activations in real time without polling.

State between the two runtimes is managed through **Upstash Redis**. When the BFF triggers a graph run, the agent service writes run state — current node, events list, partial decisions — to a Redis key scoped to the run ID. The frontend SSE endpoint streams from that key. This means the agent service is stateless across requests, Render free-tier cold starts do not corrupt in-flight runs, and the frontend can reconnect mid-run without missing events.

---

## 2. Graph Design — Why This Shape

The LangGraph `StateGraph` has 15 nodes and is the architectural centerpiece of the system.

```
intake_agent
    └── [Send API fan-out] ──────────────────────────────────┐
            ├── customer_history_agent                        │
            ├── sku_profile_agent                             │
            ├── marketplace_policy_agent                      │
            ├── damage_signal_agent                           │
            └── fraud_flag_agent                              │
                                                              ▼
                                                    decision_agent
                                                         │
                              ┌──────────┬──────────┬────┴────┬──────────┬─────────────┐
                              ▼          ▼          ▼         ▼          ▼             ▼
                          refund_    replace_   repair_   refurb_   donate_       escalation_
                          worker     worker     worker    worker    dispose_      agent
                                                                    worker
                                                                              [interrupt()]
                                                                                    │
                                                                              audit_agent
```

**The parallel fan-out** is the single most important performance decision. After `intake_agent` parses the return into structured form, the five context-gathering agents — customer history, SKU profile, marketplace policy, damage signal, fraud flags — have zero data dependencies on each other. Running them sequentially would take roughly 5× longer for no benefit. LangGraph's `Send` API dispatches all five as concurrent tasks within the same graph execution. In practice on fixture data this collapses ~2.5 seconds of sequential latency to ~0.5 seconds. More importantly, each of these five agents is either a pure data lookup (no LLM call) or a cheap extraction task (Haiku). The Decision Agent waits until all five branches complete before running, which is the correct behavior: it needs the full context picture.

**The single Decision Agent** aggregates all five context signals and produces one structured output: disposition, confidence, reasoning, cost estimate, and a chain-of-thought trace. Having one place for the reasoning is intentional. The alternative — distributing the decision logic across the worker nodes — would make the system impossible to audit and difficult to evaluate. Hiring managers and operators alike should be able to open one decision record and read exactly what the agent knew, what it concluded, and why.

**The six worker paths** are intentionally thin. They execute the disposition the Decision Agent chose — issue a Stripe test refund, book a replacement shipment against fixture inventory, schedule a repair pickup, route to the refurb queue with a grade, route to donate/dispose, or escalate to the human queue. None of them make strategic decisions. The freight economics and policy logic live exclusively in the Decision Agent and its upstream context agents.

**The `interrupt()` checkpoint** on the escalation path is a LangGraph primitive that pauses the graph and surfaces the return to the human escalation queue in the Agent Ops view. When the operator makes a decision in the UI, the graph resumes from that checkpoint. Every override is written to the `overrides` table and seeded back into the eval dataset — the system learns from human corrections.

**State management with Annotated reducers** solves the parallel branch conflict problem cleanly. The full state type is:

```python
class BackhaulState(TypedDict):
    return_id: str
    intake: IntakeResult | None
    context: ContextBundle | None
    decision: DecisionResult | None
    disposition_result: DispositionResult | None
    events: Annotated[list[GraphEvent], operator.add]   # append-only, no conflicts
    errors: Annotated[dict[str, str], lambda a, b: {**a, **b}]  # merge, last-write-wins per key
```

The `events` field uses `operator.add` so every parallel branch appends its events without overwriting the other branches' events — no locking, no coordination. The `errors` field uses a merge reducer so a failure in one parallel branch (say, a Haiku timeout on the Damage Signal agent) is recorded but does not cancel the other branches. The Decision Agent checks `state.errors` at startup and degrades gracefully: if a context signal is missing, it runs with what it has, flags the gap in its reasoning, and caps its confidence accordingly. Degrade-don't-hang is a hard requirement when Render free-tier instances have occasional cold-start latency.

---

## 3. Decision Logic — The 5-Gate Framework

The Decision Agent prompt embeds a five-gate decision tree. This tree is also implemented in `_rule_based_fallback_decision()` — a pure Python function with no LLM dependency — so the CI eval suite can run 76 test cases against it without any API calls.

**Gate 1 — Fraud screen**
```
if fraud_score > 0.60:
    disposition = ESCALATE
    reason = "fraud_score_threshold"
```
Fraud gate runs first. No amount of economic analysis justifies processing a likely-fraudulent return automatically.

**Gate 2 — Total loss**
```
if damage_severity == "total_loss":
    if customer.ltv > 5000:
        disposition = ESCALATE  # high-value customer, human decides
    else:
        disposition = DISPOSE
```
Total-loss items have no refurb path. If the customer has high LTV, a human should make the call on whether to offer a courtesy replacement outside policy.

**Gate 3 — Refurb economics**
```
net_refurb_value = (
    open_box_price
    - refurb_cost
    - (inbound_freight_cost * (1 - freight_subsidy_pct))
)
if (
    net_refurb_value > 0.30 * order_total
    and damage_severity not in ("structural", "total_loss")
    and sku.refurb_difficulty_score <= 3
):
    disposition = REFURBISH
```
This is the economic heart of the system. The `freight_subsidy_pct` comes from the marketplace policy YAML — Wayfair subsidizes a larger fraction of inbound freight than Overstock, which changes the math significantly. `refurb_difficulty_score` comes from the SKU catalog fixture — a sectional sofa with 12 pieces has a higher score than a bar stool. The 30% threshold is configurable in `config/decisioning.yaml`.

**Gate 4 — Repair**
```
if damage_severity in ("cosmetic", "functional") and sku.repair_feasible:
    disposition = REPAIR
```
Repair is cheaper than refurb for items where the damage is localized and a technician visit fixes it. `repair_feasible` is a boolean on the SKU catalog fixture.

**Gate 5 — Replace or refund**
```
if return_reason == "wrong_item" and sku.replacement_stock > 0:
    disposition = REPLACE
else:
    disposition = REFUND
```

**Escalation override** (checked after the gate that would produce a non-escalate disposition):
```
if (
    decision.confidence < 0.70
    or order_total > 1500
    or (customer.ltv > 5000 and fraud_score > 0.30)
):
    disposition = ESCALATE
```
Confidence below 0.70 means the agent is uncertain — human review is cheaper than a bad automated decision. Orders above $1,500 are high enough that the freight cost of a wrong call exceeds the cost of a 2-minute human review. High-LTV customers with any fraud signal get special handling because the relationship is worth protecting.

---

## 4. Why LangGraph in Python, Not TypeScript

The decision deserves a full accounting because it drives the two-runtime split.

**LangGraph.js exists** and is maintained by the same team. A full-TypeScript stack would have eliminated the HTTP boundary, simplified local dev, and reduced deployment surface. This was seriously considered.

**The case for Python LangGraph:**

1. **Checkpoint persistence maturity.** LangGraph's `AsyncPostgresSaver` for interrupt/resume is production-hardened in the Python SDK. The JS equivalent was in earlier stages of development at build time. The escalation path's `interrupt()` checkpoint — where the human overrides a decision and the graph resumes — depends on this primitive. It is not optional.

2. **Ecosystem depth.** `psycopg2`/`asyncpg` for Postgres, `pyyaml` for policy config, `stripe` SDK, `sentry-sdk`, `braintrust` SDK — all have first-class Python packages with extensive documentation and Stack Overflow coverage. JavaScript equivalents exist for all of them but the Python versions have more edge-case handling for the patterns used here (async Postgres connection pooling in FastAPI, YAML parsing with anchors for policy inheritance).

3. **Braintrust SDK.** Braintrust's Python SDK has a more mature eval-as-code story. The `@braintrust.traced` decorator and `braintrust.Eval` runner integrate cleanly with pytest. The TypeScript equivalent required more boilerplate to achieve the same span structure.

4. **Community patterns for graph debugging.** LangGraph debugging patterns — state inspection, node replay, conditional edge testing — have more documented examples in Python. Given that the graph is the most complex part of the system, having more reference material for debugging was a real consideration.

**The cost of the split:** ~5ms HTTP boundary between the TS BFF and the Python agent service on each trigger call. Negligible for a returns triage system where graph runs take 1-3 seconds. The SSE stream connection is persistent per run, so after the initial HTTP handshake the latency is wire-speed.

**Final call: Python LangGraph.** The interrupt/resume checkpoint maturity alone would have decided it; the ecosystem and tooling advantages reinforced it.

---

## 5. Why Braintrust

Braintrust serves a different purpose than the in-app Agent Ops view. The Agent Ops view is a **product feature** — it lets the Returns Ops Lead watch decisions happen and override them. Braintrust is a **development tool** — it lets the engineer verify that prompt changes do not regress decision quality.

The two-layer observability model:

**Layer 1 — User-facing (Agent Ops view):**
- Live graph visualization with node states: idle → running → complete → failed
- Decision drawer: full reasoning chain, confidence score, cost, prompt version used
- Cost meter: running total per graph run, aggregate per day
- Override UI: captures human corrections into the eval dataset
- Drift indicator: rolling 7-day comparison of decision distribution
- Prompt A/B comparison: last-week vs this-week accuracy on held-out cases
- Escalation queue: pending items with reasoning summaries

**Layer 2 — Dev-facing (Braintrust):**
- Every LLM node emits a span: `{input_tokens, output_tokens, cost_usd, prompt_version, latency_ms}`
- Spans skip gracefully when `BRAINTRUST_API_KEY` is absent — local dev and CI do not require an account
- `braintrust.Eval()` runner executes the 76-case golden set on the `_rule_based_fallback_decision()` path (no API calls) plus an optional 20-case live eval against the actual LLM prompts
- Eval-gated CI: GitHub Actions runs the eval suite on every push to `main`; deployment to Render/Vercel is blocked if accuracy drops below 90%

**Why not LangSmith?** LangSmith has a more polished UI and better LangGraph native integration. The deciding factor was Braintrust's eval-as-code model: `braintrust.Eval()` with a Python scorer function is more composable than LangSmith's evaluation flow for this use case. The free tier limits were also more generous for a portfolio project's traffic pattern.

---

## 6. Marketplace Policy Architecture

Hard Rule 15 in the project brief: marketplace policies live in `/config/marketplaces/<name>.yaml` and nowhere else. This is enforced structurally — the Marketplace Policy Agent reads from these files, and no agent code contains hardcoded policy values.

The six YAMLs for v1:

```
config/marketplaces/
    wayfair.yaml
    amazon_fba.yaml
    amazon_fbm.yaml
    houzz.yaml
    overstock.yaml
    shopify_direct.yaml
```

Each YAML has the same schema:

```yaml
marketplace_id: wayfair
display_name: Wayfair
return_window_days: 30
freight_subsidy_pct: 0.75        # Wayfair covers 75% of inbound freight on returns
damage_allowance_pct: 0.15       # items up to 15% damaged still qualify for refund
restocking_fee_pct: 0.00         # Wayfair charges no restocking fee
auto_approve_threshold_usd: 150  # returns under $150 auto-approved without inspection
requires_photo_evidence: false
reimbursement_window_days: 14
```

The Policy Agent implements three-tier resolution:

1. **Cache** — Redis key scoped to `policy:{marketplace_id}`, TTL 1 hour. Hot path for demo performance.
2. **YAML** — `yaml.safe_load()` from the config file. Main path.
3. **Hardcoded fallback** — conservative defaults (0% freight subsidy, 30-day window, no damage allowance) that keep the system running if a YAML file is missing or malformed. Fallback is logged as an error to Sentry.

Adding Williams-Sonoma Trade or Home Depot Pro as a marketplace in v2 requires adding one YAML file and no agent code changes. This is the connector framework design referenced in the project brief.

---

## 7. Data Model Decisions

**PostgreSQL on Neon** with `asyncpg` for the agent service (async, connection-pooled, fast) and the Supabase JS client for the BFF (typed, SSR-safe, integrates with Next.js auth patterns).

Key schema decisions:

**`decisions` table is immutable.** No UPDATE statements are issued against it after insert. Immutability is enforced by a Postgres trigger that raises an exception on any UPDATE or DELETE. The in-app Agent Ops view and the audit log both read from this table. If an operator overrides a decision, a new row is inserted with `override_of_decision_id` set — the history is preserved.

**`decision_steps` is append-only.** One row per graph node visited per run. This is the data source for the Agent Ops view's node-by-node replay. Indexed on `(run_id, created_at)` for the streaming query.

**`eval_results.passed` is a generated column.**
```sql
passed boolean GENERATED ALWAYS AS (actual_disposition = expected_disposition) STORED
```
This avoids a join in the CI eval query and makes the 90% accuracy gate a simple `SELECT AVG(passed::int) FROM eval_results WHERE eval_run_id = $1`.

**`overrides` → eval loop.** Every human override writes a row to `overrides` with the original decision ID, the chosen disposition, and a free-text reason. A nightly job (Render cron) reads new overrides and inserts corresponding rows into `eval_cases` with `source = 'human_override'`. The eval suite grows from real operator behavior. This is the system's learning loop.

**Single-tenant by design.** One seeded admin user. No `organization_id` column, no RBAC, no workspaces. This was a deliberate v1 scope decision. Adding multi-tenancy in v2 requires adding `org_id` to every table — that migration path is documented in `/docs/BUILD_LEDGER.md` under deferred items.

---

## 8. Cost Discipline

Hard Rule 16: any graph run exceeding $0.10 is a bug. Actual measured cost on fixture data: **$0.0082 per run**.

Model assignment by node:

| Node | Model | Reason |
|------|-------|--------|
| `intake_agent` | claude-haiku-3-5 | Structured extraction from free text. Simple task. |
| `customer_history_agent` | None (data lookup) | Pure SQL query against fixture data. No inference needed. |
| `sku_profile_agent` | None (data lookup) | Pure SQL query against SKU catalog. |
| `marketplace_policy_agent` | None (YAML read) | Deterministic config resolution. |
| `damage_signal_agent` | claude-haiku-3-5 | Text classification of condition codes and notes. Simple. |
| `fraud_flag_agent` | None (rules) | Rule-based scoring against return history. |
| `decision_agent` | claude-sonnet-4 | Complex multi-signal reasoning. Worth the cost premium. |
| `customer_comms_agent` | claude-haiku-3-5 | Template-guided draft generation. |
| All workers | None | Deterministic execution of the Decision Agent's choice. |
| `audit_agent` | None | SQL insert. |

`claude-opus-4` was evaluated against the 50-case golden set for the Decision Agent. Accuracy improved by 2.3 percentage points (from 92.1% to 94.4%) at 8× the cost per call. The cost-quality tradeoff does not justify Opus for v1. The Decision Agent spec documents this evaluation in `/docs/specs/agents/decision_agent.md`.

Cost is tracked per-run in the `agent_runs` table:
```sql
total_cost_usd   numeric(10,6)  -- updated at run completion
input_tokens     integer
output_tokens    integer
```
The Agent Ops view reads from this table and displays running cost during execution, updated via SSE. The aggregate daily cost view is a materialized view refreshed every 5 minutes.

---

## 9. Decision Log Summary

The full decision log is in `/docs/BUILD_LEDGER.md`. Key decisions summarized:

| Decision | Choice | Rejected Alternative | Decisive Factor |
|----------|--------|---------------------|-----------------|
| Agent framework language | Python LangGraph | LangGraph.js | `AsyncPostgresSaver` maturity for interrupt/resume |
| Frontend framework | Next.js 14 App Router | Remix, SvelteKit | Vercel native, RSC for BFF pattern, team familiarity |
| Postgres host | Neon | Supabase | Neon branching for fixture isolation in CI |
| Redis host | Upstash | Render Redis | Serverless-native, no cold-start on free tier |
| Real-time protocol | SSE | WebSocket | Unidirectional data flow (agent → UI), simpler reconnect logic, works through Vercel Edge |
| Observability | Braintrust | LangSmith | Eval-as-code composability, free tier limits |
| Decision model | claude-sonnet-4 | claude-opus-4 | 8× cost difference, 2.3pp accuracy gain does not justify at v1 scale |
| Multi-tenancy | Deferred | v1 scope | Single-tenant internal tool is the explicit design target |
| Image/video damage analysis | Deferred | Claimlane already owns this wedge; text and condition codes are sufficient for v1 |

---

*This document was authored as part of the Backhaul portfolio project. The system was built to demonstrate the kind of AI engineering decision-making required for a returns automation platform serving multi-marketplace big-ticket sellers — the exact problem domain encountered at Cymax Group.*
