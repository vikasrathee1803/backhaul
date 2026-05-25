# Escalation Agent — Agent Spec

## Role
Creates a structured escalation record when the Decision Agent recommends `escalate`, building a human-readable summary of all escalation triggers, the full return context, and a priority level — populating the escalation queue visible in the Agent Ops view for human operator review.

---

## Input Contract

| Key | Type | Source | Description |
|-----|------|--------|-------------|
| `decision` | `DispositionDecisionSchema` | `BackhaulState` | Reads `disposition`, `confidence`, `reasoning`, `candidate_dispositions`. |
| `intake` | `ReturnIntakeSchema` | `BackhaulState` | Reads `return_id`, `marketplace`, `return_reason`, `condition`, `order_total_cents`, `sku_code`, `customer_id`. |
| `customer_history` | `CustomerHistorySchema` | `BackhaulState` | Reads `lifetime_value_cents`, `return_rate`, `fraud_flag`. |
| `fraud_flag_result` | `FraudFlagSchema` | `BackhaulState` | Reads `fraud_score`, `flags`, `exceeds_fraud_threshold`. |
| `damage_signal` | `DamageSignalSchema` | `BackhaulState` | Reads `damage_severity`, `repair_feasibility`. |
| `marketplace_policy` | `MarketplacePolicySchema` | `BackhaulState` | Reads `auto_decide_ceiling_cents`, `decisioning_window_days`. |

---

## Output Contract

Writes `state["escalation_record"]` as a dict (not a separate TypedDict — stored inline in state):

| Key | Type | Description |
|-----|------|-------------|
| `escalation_id` | `str` | Unique escalation record ID: `ESC-{return_id}-{timestamp}` |
| `return_id` | `str` | The return being escalated |
| `escalation_reason` | `str` | Human-readable comma-separated list of all triggers that fired |
| `priority` | `str` | `"critical" \| "high" \| "standard"` |
| `suggested_disposition` | `str` | The top candidate disposition from the Decision Agent (the agent's best guess) |
| `confidence` | `float` | Decision Agent's confidence in the suggested disposition |
| `order_total_cents` | `int` | Order value — context for the operator |
| `lifetime_value_cents` | `int` | Customer LTV — context for the operator |
| `fraud_score` | `float` | Fraud risk score |
| `fraud_flags` | `list[str]` | Specific fraud flags that fired |
| `damage_severity` | `str` | Damage level |
| `agent_reasoning` | `str` | Decision Agent's full reasoning text |
| `created_at` | `str` | ISO timestamp |
| `status` | `str` | `"pending"` (initial state) |

Also writes `state["worker_result"]` as `WorkerResultSchema` for consistency with other workers:

```python
{
    "worker": "escalation_agent",
    "status": "completed",
    "actions_taken": ["Escalation record created: {escalation_id}", "Priority: {priority}", "Reason: {escalation_reason}"],
    "notes": escalation_id
}
```

---

## Model

**No LLM — pure logic.** The escalation reason string is built by inspecting state values against known threshold rules. This is deterministic and must be fully auditable.

---

## Processing Logic

1. **Guard**: If `state["decision"]["disposition"] != "escalate"`, set `worker_result.status: "skipped"` and return early.

2. **Identify escalation triggers** by checking each known trigger condition:

   | Trigger ID | Condition | Human Label |
   |------------|-----------|-------------|
   | `low_confidence` | `decision["confidence"] < 0.70` | `"Low decision confidence ({confidence:.0%})"` |
   | `high_order_value` | `intake["order_total_cents"] > marketplace_policy["auto_decide_ceiling_cents"]` | `"High order value (${order_total:.2f} exceeds ${ceiling:.2f} auto-decide ceiling)"` |
   | `high_value_fraud_risk` | `customer_history["lifetime_value_cents"] > 500000` AND `fraud_flag_result["fraud_score"] > 0.30` | `"High-LTV customer (${ltv:.2f}) with moderate fraud signal ({fraud_score:.2f})"` |
   | `exceeds_fraud_threshold` | `fraud_flag_result["exceeds_fraud_threshold"] == True` | `"Fraud threshold exceeded (score: {fraud_score:.2f}; flags: {flags})"` |
   | `decision_fallback` | `decision["confidence"] == 0.0` AND `decision["reasoning"]` contains "encountered an error" | `"Decision agent fallback — manual review required"` |

3. **Build `escalation_reason`** by joining all triggered labels with `"; "`.

4. **Determine priority**:
   ```
   critical:  exceeds_fraud_threshold == True  OR  confidence == 0.0 (fallback)
   high:      high_order_value  OR  high_value_fraud_risk
   standard:  only low_confidence triggered
   ```

5. **Extract `suggested_disposition`** from `decision["candidate_dispositions"][0]["disposition"]` if available, else `"unknown"`.

6. **Build escalation record** with all fields.

7. **Write** `state["escalation_record"]` and `state["worker_result"]`.

---

## Priority Level Definitions

| Priority | Meaning | Expected Response Time |
|----------|---------|----------------------|
| `critical` | Potential fraud or system failure. Requires immediate human attention. | Same business day |
| `high` | High-value return or high-LTV customer with risk signals. Requires prompt review. | Next business day |
| `standard` | Model was insufficiently confident to auto-decide. Normal review queue. | Within `decisioning_window_days` |

---

## Escalation Queue Display

The escalation record is displayed in the Agent Ops view's escalation queue panel. Each row shows:
- Return ID, marketplace, product name
- Priority badge (color-coded: red/orange/grey)
- Escalation reason (shortened to first trigger if multiple)
- Order value and customer LTV
- Suggested disposition (the agent's best guess)
- Confidence score
- "Review" button that opens the full decision drawer

---

## Acceptance Criteria

1. **Happy path — low confidence**: Given `confidence: 0.65`, the escalation agent creates a record with `priority: "standard"` and `escalation_reason` containing `"Low decision confidence (65%)"`.
2. **High order value trigger**: Given `order_total_cents: 160000` and `auto_decide_ceiling_cents: 150000`, the reason includes the order value escalation label.
3. **Fraud threshold trigger**: Given `exceeds_fraud_threshold: true` and `fraud_score: 0.75`, the reason includes the fraud threshold label and `priority: "critical"`.
4. **Multiple triggers**: Given low confidence AND high order value, both labels appear in `escalation_reason` joined by `"; "`.
5. **Suggested disposition is the top candidate**: The `suggested_disposition` field equals `candidate_dispositions[0]["disposition"]` when candidates exist.
6. **Skip guard**: Given `disposition: "refund"`, the agent returns `status: "skipped"`.
7. **Escalation ID format**: The generated ID matches `ESC-{return_id}-{...}` and is unique across runs.
8. **Agent reasoning preserved**: The full Decision Agent `reasoning` text is in `agent_reasoning` — operators can read the full context.
9. **Fixture test**: The test in `/evals/escalation/` covers all 4 trigger conditions and multi-trigger scenarios.
10. **Priority hierarchy**: `critical` takes precedence over `high` which takes precedence over `standard`. When multiple triggers fire at different levels, the highest level is assigned.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| `decision["candidate_dispositions"]` is empty list | `suggested_disposition: "unknown"` |
| `decision["confidence"]` is exactly 0.70 | `low_confidence` trigger does NOT fire (strict `<`, not `<=`) |
| All triggers fire simultaneously | All labels in `escalation_reason`; priority is `critical` |
| `fraud_flag_result` is missing from state | Skip fraud trigger checks; log warning |
| `marketplace_policy["auto_decide_ceiling_cents"]` is 0 | Every return triggers high_order_value (all values > 0). Treat 0 ceiling as "always escalate" |

---

## Cost Target

**$0.00 per call.** No LLM. Threshold comparisons and string building only. Execution time < 5ms.

---

## Fallback

The Escalation Agent has no failure mode for its core logic (pure comparisons). However, if `state["decision"]` is missing entirely:

```python
{
    "escalation_id": f"ESC-{return_id}-NODECISION",
    "return_id": return_id,
    "escalation_reason": "Decision agent result missing from state",
    "priority": "critical",
    "suggested_disposition": "unknown",
    "confidence": 0.0,
    ...
}
```

---

## Braintrust Span

**Span name**: `backhaul.escalation_agent`

**Attributes to log**:
| Attribute | Value |
|-----------|-------|
| `return_id` | from intake |
| `escalation_id` | generated |
| `priority` | assigned priority |
| `triggers_fired` | list of trigger IDs |
| `trigger_count` | number of triggers |
| `confidence` | from decision |
| `fraud_score` | from fraud_flag_result |
| `order_total_cents` | from intake |
| `latency_ms` | wall-clock time |
