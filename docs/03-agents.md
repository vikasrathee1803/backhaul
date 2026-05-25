# Phase 3 — Agents & Decisioning

**Status:** Complete  
**Date:** 2026-05-25  
**Gate:** 76/76 tests passing, ruff clean, tsc clean

---

## What Was Built

All 15 agents in the LangGraph graph are now fully implemented, replacing Phase 2 stubs with real Anthropic API calls (where applicable), defensive parsers, fallback paths, Braintrust-ready span hooks, and fixture-based eval tests.

---

## Agent Inventory

| Agent | Location | Model | Tests |
|---|---|---|---|
| Intake Agent | `app/graph/nodes/intake.py` | claude-haiku-4-5-20251001 | `evals/intake/` (5) |
| Customer History Agent | `app/graph/nodes/customer_history.py` | No LLM | `evals/customer_history/` (6) |
| SKU Profile Agent | `app/graph/nodes/sku_profile.py` | No LLM | `evals/sku_profile/` (6) |
| Marketplace Policy Agent | `app/graph/nodes/marketplace_policy.py` | No LLM | `evals/marketplace_policy/` (9) |
| Damage Signal Agent | `app/graph/nodes/damage_signal.py` | claude-haiku-4-5-20251001 | `evals/damage_signal/` (7) |
| Fraud Flag Agent | `app/graph/nodes/fraud_flag.py` | No LLM | `evals/fraud_flag/` (10) |
| Decision Agent | `app/graph/nodes/decision.py` | claude-sonnet-4-6 | `evals/decision/` (9) |
| Refund Worker | `app/workers/refund.py` | No LLM | — |
| Replacement Worker | `app/workers/replacement.py` | No LLM | — |
| Repair Worker | `app/workers/repair.py` | No LLM | — |
| Refurb Worker | `app/workers/refurb.py` | No LLM | — |
| Donate/Dispose Worker | `app/workers/donate_dispose.py` | No LLM | — |
| Customer Comms Agent | `app/graph/nodes/customer_comms.py` | claude-haiku-4-5-20251001 | `evals/customer_comms/` (7) |
| Escalation Agent | `app/graph/nodes/escalation.py` | No LLM | `evals/escalation/` (7) |
| Audit Agent | `app/graph/nodes/audit.py` | No LLM | `evals/audit/` (7) |

---

## Per-Agent Rule (Hard Rule 11 Compliance)

Every LLM agent has:
- **Spec doc**: `/docs/specs/agents/<name>.md` — input/output contract, acceptance criteria, edge cases, cost target
- **Versioned prompt**: `/apps/agent/prompts/<name>_v1.md` — production-quality system prompt with examples
- **JSON output contract**: Defined in spec + as TypedDict in `state.py`
- **Defensive parser**: `_parse_<agent>_response()` function, importable by tests, handles malformed LLM output
- **Fallback path**: `_build_fallback_<schema>()` or `_rule_based_fallback_decision()` — always returns valid schema
- **Cost estimate**: Documented in spec; tracked via `response.usage` on every call
- **Braintrust span**: Hook present in LLM agents; skips gracefully when `BRAINTRUST_API_KEY` not set
- **Fixture-based eval test**: In `evals/<agent>/test_<agent>.py`, no live API calls

---

## Decision Logic

The Decision Agent uses a 5-gate framework (executed by both the LLM prompt and the deterministic fallback):

1. **Fraud gate** — `fraud_score > 0.60` → escalate
2. **Total loss** — `damage_severity == total_loss` → dispose (or escalate if LTV > $5K)
3. **Economics** — `net_refurb_value = open_box_price - refurb_cost - (inbound_freight × (1 − freight_subsidy_pct))` — if > 30% of order_total AND damage < structural → refurbish
4. **Repair** — cosmetic/functional damage + feasible repair + refurb not impossible → repair
5. **Replace/Refund** — wrong_item + stock available → replace; else → refund
6. **Escalation override** — confidence < 0.70 OR order_total > $1,500 OR (LTV > $5K + fraud_score > 0.30) → escalate

---

## Eval Suite

**76 tests across 11 packages — all passing.**

```
tests/          3  (async graph stub + health)
evals/
  intake/       5
  customer_history/ 6
  sku_profile/  6
  marketplace_policy/ 9
  damage_signal/ 7
  fraud_flag/   10
  decision/     9
  customer_comms/ 7
  escalation/   7
  audit/        7
```

The `_rule_based_fallback_decision()` function in `decision.py` acts as the deterministic golden-case evaluator — it covers all 7 dispositions + all escalation triggers without touching the live API.

---

## Versioned Prompts

| File | Highlights |
|---|---|
| `intake_v1.md` | 9-field extraction, 7 return_reason enums, 6 condition enums, 5 worked examples |
| `damage_signal_v1.md` | 5-level severity scale, repair feasibility guide, 6 worked examples |
| `decision_v1.md` | Full economics formula, 5-gate decision tree, confidence calibration, worked $1,299 sofa example |
| `customer_comms_v1.md` | 3 tone modes, 7 disposition-specific templates, forbidden content list, channel voice notes |

---

## Cost Budget

Estimated per-run cost with real Anthropic calls:

| Agent | Model | Est. Input | Est. Output | Est. Cost |
|---|---|---|---|---|
| Intake | haiku | ~300 tokens | ~150 tokens | ~$0.0009 |
| Damage Signal | haiku | ~200 tokens | ~100 tokens | ~$0.0006 |
| Decision | sonnet | ~800 tokens | ~250 tokens | ~$0.0062 |
| Customer Comms | haiku | ~150 tokens | ~100 tokens | ~$0.0005 |
| All others | No LLM | — | — | $0.0000 |
| **Total** | | | | **~$0.0082** |

Well under the $0.10/run Hard Rule 16 ceiling.

---

## Gate Commands Passed

```
ruff check .          → All checks passed
pytest tests/ evals/  → 76 passed in 2.31s
tsc --noEmit          → 0 errors
```

---

## Phase 4 Preview

Phase 4 builds the in-app Agent Ops view to demo-quality:
- Live graph visualization (ReactFlow + dagre, node state animations)
- Decision drawer with full reasoning display
- Override UI capturing to eval dataset
- Cost meter and eval status badge
- Escalation queue with reasoning summaries
- 60fps performance pass
