# Decision Agent — Agent Spec

## Role
The headline agent of the Backhaul graph. Takes all upstream context — intake, customer history, SKU profile, marketplace policy, damage signal, and fraud flags — and produces a recommended disposition (refund, replace, repair, refurbish, donate, dispose, or escalate) with full reasoning, confidence score, candidate rankings, and a complete cost/latency audit record.

---

## Input Contract

The Decision Agent reads the following keys from `BackhaulState`:

| Key | Type | Description |
|-----|------|-------------|
| `intake` | `ReturnIntakeSchema` | Parsed return: marketplace, reason, condition, order total, freight cost, SKU, customer |
| `customer_history` | `CustomerHistorySchema` | LTV, order count, return rate, fraud flag, prior reasons |
| `sku_profile` | `SkuProfileSchema` | Weight, freight class, refurb difficulty, open box price, refurb cost, stock |
| `marketplace_policy` | `MarketplacePolicySchema` | Return window, freight subsidy, damage allowance, restocking fee, decisioning window, auto-decide ceiling |
| `damage_signal` | `DamageSignalSchema` | Damage present, severity, affected components, repair feasibility |
| `fraud_flag_result` | `FraudFlagSchema` | Fraud score, flags fired, exceeds_fraud_threshold |

---

## Output Contract

Writes `state["decision"]` as `DispositionDecisionSchema`:

| Key | Type | Description |
|-----|------|-------------|
| `disposition` | `Disposition` | The recommended disposition: `refund \| replace \| repair \| refurbish \| donate \| dispose \| escalate` |
| `confidence` | `float` | Model's confidence in the recommendation (0.0–1.0) |
| `reasoning` | `str` | Plain-English explanation of why this disposition was chosen |
| `prompt_version` | `str` | Prompt version used (e.g., `"decision_v1"`) |
| `model_used` | `str` | Model ID (e.g., `"claude-sonnet-4-6"`) |
| `input_tokens` | `int` | Input token count from API response |
| `output_tokens` | `int` | Output token count from API response |
| `cost_usd` | `float` | Computed cost for this call |
| `latency_ms` | `int` | Wall-clock milliseconds for the LLM call |
| `candidate_dispositions` | `list[dict]` | Ranked list of all considered dispositions with scores |

Also emits a `decision_made` GraphEvent to the SSE stream.

---

## Model

**`claude-sonnet-4-6`** — This is the most complex reasoning task in the graph. It requires multi-factor economic analysis, policy interpretation, fraud gating, and confidence calibration. Sonnet is the correct default. Claude Opus 4 should be evaluated in the eval suite (see Cost vs Quality tradeoff note below).

**Cost vs Quality Note**: Run the 50-case golden eval suite against both `claude-sonnet-4-6` and `claude-opus-4`. Document the accuracy delta and cost delta in `/docs/03-agent-build.md`. If Opus adds fewer than 5 percentage points of accuracy for the price increase, default to Sonnet. If Opus adds more than 5 points, document the tradeoff and let the operator decide.

---

## Decision Framework

The Decision Agent applies the following framework in order. Earlier gates take priority.

### Gate 1 — Fraud Gate
If `fraud_flag_result["exceeds_fraud_threshold"] == true`:
- Recommended disposition: **`escalate`**
- Reasoning must reference the fraud score and specific flags
- Confidence: `0.95` (fraud threshold crossing is a near-certain escalation trigger)
- Skip economic analysis

### Gate 2 — Auto-Decide Ceiling
If `intake["order_total_cents"] > marketplace_policy["auto_decide_ceiling_cents"]`:
- Recommended disposition: **`escalate`**
- High-value orders always require human review
- Confidence: `0.95`

### Gate 3 — Marketplace Policy Window
If the return is outside the return window (requires external date calculation passed in as `days_since_purchase`):
- Consider refusing the return with a `refund: 0` response, or escalate
- For v1 fixture data: assume all returns are within window

### Gate 4 — Economic Analysis
Compute the **net refurb value**:

```
net_refurb_value_cents = (
    sku_profile["open_box_price_estimate_cents"]
    - sku_profile["refurb_cost_estimate_cents"]
    - (intake["inbound_freight_cost_cents"] * (1.0 - marketplace_policy["freight_subsidy_pct"]))
)
```

Compute the **seller net cost of refund**:

```
refund_cost_cents = (
    intake["order_total_cents"]
    - (intake["inbound_freight_cost_cents"] * marketplace_policy["freight_subsidy_pct"])
    + (intake["order_total_cents"] * marketplace_policy["restocking_fee_pct"])  # note: restocking fee is income, not cost
)
```

Actually:
```
# Restocking fee reduces refund obligation:
refund_obligation_cents = intake["order_total_cents"] * (1 - marketplace_policy["restocking_fee_pct"])
# Seller freight net cost:
seller_freight_cost_cents = intake["inbound_freight_cost_cents"] * (1.0 - marketplace_policy["freight_subsidy_pct"])
# Total cost to the seller for a full refund path:
total_refund_path_cost_cents = refund_obligation_cents + seller_freight_cost_cents
```

### Gate 5 — Disposition Ranking

Apply the following decision tree to arrive at a ranked disposition:

| Priority | Condition | Disposition |
|----------|-----------|-------------|
| 1 | Fraud gate or ceiling gate (see above) | `escalate` |
| 2 | `damage_severity == "total_loss"` AND `net_refurb_value_cents < 0` | `dispose` |
| 3 | `damage_severity == "total_loss"` AND `sku_profile.weight_lbs <= 50` | `donate` |
| 4 | `damage_severity in ["structural", "total_loss"]` AND `repair_feasibility == "not_feasible"` AND `net_refurb_value_cents < 0` | `dispose` or `donate` by weight |
| 5 | `damage_severity == "structural"` AND `repair_feasibility == "feasible"` | `repair` |
| 6 | `damage_severity == "functional"` AND `repair_feasibility in ["feasible", "uncertain"]` | `repair` |
| 7 | `net_refurb_value_cents > 0` AND `refurb_difficulty in ["easy", "moderate"]` AND `damage_severity in ["cosmetic", "functional"]` | `refurbish` |
| 8 | `return_reason == "wrong_item"` AND `sku_profile.current_stock > 0` | `replace` |
| 9 | `return_reason == "buyer_remorse"` AND `damage_severity == "none"` | `refund` (no damage) |
| 10 | Default | `refund` |

### Gate 6 — Escalation Override
After computing the disposition, check escalation triggers. If ANY of the following are true, override to `escalate`:
- `confidence < 0.70` (model is not sufficiently certain)
- `intake["order_total_cents"] > 150000` ($1,500 threshold) AND the disposition is not already `escalate`
- `customer_history["lifetime_value_cents"] > 500000` ($5,000 LTV) AND `fraud_flag_result["fraud_score"] > 0.30` (high-value customer with moderate fraud signal — needs human judgment)

---

## Candidate Dispositions

The model must produce a ranked list of all considered dispositions, not just the top choice:

```json
{
  "candidate_dispositions": [
    {
      "disposition": "refurbish",
      "score": 0.82,
      "rationale": "Net refurb value is $423, damage is cosmetic, refurb difficulty is moderate"
    },
    {
      "disposition": "repair",
      "score": 0.65,
      "rationale": "Repair feasibility is uncertain, labor cost estimate high for this SKU"
    },
    {
      "disposition": "refund",
      "score": 0.40,
      "rationale": "Full refund eliminates upside but removes refurb execution risk"
    }
  ]
}
```

---

## Prompt Strategy

The system prompt (see `prompts/decision_v1.md`) is a structured reasoning prompt that:
- States the full decision framework with the economics formula.
- Defines all 7 disposition options with precise conditions for each.
- Instructs the model to show its work: compute `net_refurb_value_cents` explicitly in the reasoning.
- Defines confidence calibration: what makes a high-confidence vs. low-confidence decision.
- Defines escalation triggers clearly.
- Provides a fully worked example with real numbers.
- Instructs the model to output only valid JSON.

Context injected into the user message (all upstream schemas serialized as JSON):
```
Return ID: <return_id>
--- INTAKE ---
<intake JSON>
--- CUSTOMER HISTORY ---
<customer_history JSON>
--- SKU PROFILE ---
<sku_profile JSON>
--- MARKETPLACE POLICY ---
<marketplace_policy JSON>
--- DAMAGE SIGNAL ---
<damage_signal JSON>
--- FRAUD FLAGS ---
<fraud_flag_result JSON>
```

---

## JSON Output Schema

```json
{
  "disposition": "refund | replace | repair | refurbish | donate | dispose | escalate",
  "confidence": "float 0.0-1.0",
  "reasoning": "string - plain English explanation showing the math",
  "candidate_dispositions": [
    {
      "disposition": "string",
      "score": "float 0.0-1.0",
      "rationale": "string"
    }
  ]
}
```

The agent wrapper adds `prompt_version`, `model_used`, `input_tokens`, `output_tokens`, `cost_usd`, and `latency_ms` from the API response metadata.

---

## GraphEvent

After writing `state["decision"]`, the agent emits a `decision_made` event to the SSE stream:

```json
{
  "event": "decision_made",
  "return_id": "<return_id>",
  "disposition": "<disposition>",
  "confidence": "<float>",
  "cost_usd": "<float>"
}
```

This event triggers the in-app Agent Ops view to update the decision card in real time.

---

## Acceptance Criteria

1. **Cosmetic damage → refurbish**: Given a $1,299 sofa with cosmetic damage, `refurb_difficulty: moderate`, positive net refurb value, and no fraud signals, the agent recommends `refurbish` with confidence > 0.75.
2. **Total loss → dispose**: Given `damage_severity: "total_loss"`, `net_refurb_value_cents < 0`, `weight_lbs: 142`, the agent recommends `dispose`.
3. **Fraud gate fires**: Given `exceeds_fraud_threshold: true`, the agent recommends `escalate` regardless of other signals, with the fraud score and flags in the reasoning.
4. **Escalation on low confidence**: Given ambiguous inputs that result in model confidence < 0.70, the agent overrides to `escalate`.
5. **Economics calculation visible in reasoning**: The `reasoning` field shows the computed `net_refurb_value_cents` for any refurbish recommendation.
6. **Candidate dispositions ranked**: The `candidate_dispositions` list contains at least 2 entries, ranked by `score` descending.
7. **Wrong item + stock → replace**: Given `return_reason: "wrong_item"` and `current_stock: 3`, the agent recommends `replace`.
8. **Buyer remorse + no damage → refund**: Given `return_reason: "buyer_remorse"`, `damage_severity: "none"`, the agent recommends `refund`.
9. **Golden eval at 90%+**: The agent passes at least 45 of 50 golden cases in `/evals/decision/`.
10. **Cost guard**: Total cost per call stays below $0.01. A single Decision Agent call exceeding $0.01 is a bug.
11. **LLM failure fallback**: If the LLM call raises an exception, the agent returns `escalate` with `confidence: 0.0` and a fallback reasoning string.
12. **decision_made event emitted**: The SSE stream receives a `decision_made` event within 5 seconds of graph run start.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| All upstream agents returned fallback defaults | Decision Agent still produces a valid disposition (likely `escalate` due to low confidence) |
| LLM returns invalid JSON | Catch parse error, return escalate fallback |
| `net_refurb_value_cents` is exactly 0 | Treat as non-viable refurb — bias toward refund or repair |
| `open_box_price_estimate_cents` is 0 (unknown SKU) | Net refurb value is negative; refurb is never recommended |
| `confidence` in LLM output is > 1.0 | Clamp to 1.0 |
| `confidence` in LLM output is < 0.0 | Clamp to 0.0 |
| Multiple escalation triggers fire simultaneously | Single `escalate` disposition; reasoning lists all triggers |
| Amazon FBA with 100% freight subsidy | Net refurb value is higher; correctly reflects in economics calculation |

---

## Cost Target

| Item | Estimate |
|------|----------|
| Input tokens (system prompt + all upstream schemas) | ~2,000 tokens |
| Output tokens (JSON + reasoning) | ~400 tokens |
| Model rate (sonnet-4-6) | $3.00 / 1M input, $15.00 / 1M output |
| **Estimated cost per call** | **~$0.006 + $0.006 = ~$0.009** |

This is within the $0.10-per-graph-run budget (the Decision Agent is the most expensive node; all others are <$0.001 combined).

---

## Fallback

If the LLM call fails for any reason:

```python
{
    "disposition": "escalate",
    "confidence": 0.0,
    "reasoning": "Decision agent encountered an error and could not complete analysis. Manual review required.",
    "prompt_version": "decision_v1",
    "model_used": "claude-sonnet-4-6",
    "input_tokens": 0,
    "output_tokens": 0,
    "cost_usd": 0.0,
    "latency_ms": 0,
    "candidate_dispositions": []
}
```

Failing safely to `escalate` is the correct behavior. An unreviewed decision is better than a bad auto-decision.

---

## Braintrust Span

**Span name**: `backhaul.decision_agent`

**Attributes to log**:
| Attribute | Value |
|-----------|-------|
| `return_id` | from state |
| `marketplace` | from intake |
| `order_total_cents` | from intake |
| `disposition` | from result |
| `confidence` | from result |
| `fraud_score` | from fraud_flag_result |
| `damage_severity` | from damage_signal |
| `net_refurb_value_cents` | computed value (log for eval correlation) |
| `escalation_triggered` | `true \| false` |
| `escalation_reasons` | list of trigger strings if escalated |
| `input_tokens` | from LLM response |
| `output_tokens` | from LLM response |
| `cost_usd` | from result |
| `latency_ms` | from result |
| `model` | `claude-sonnet-4-6` |
| `prompt_version` | `decision_v1` |
| `fallback_used` | `true \| false` |
