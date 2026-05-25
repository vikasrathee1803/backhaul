# Fraud Flag Agent — Agent Spec

## Role
Scores the fraud risk of a return using rule-based analysis of customer return history, computing a `fraud_score` between 0.0 and 1.0 and setting `exceeds_fraud_threshold` when the score crosses 0.60 — giving the Decision Agent a deterministic, auditable fraud signal rather than a probabilistic AI guess.

---

## Input Contract

| Key | Type | Source | Description |
|-----|------|--------|-------------|
| `customer_history` | `CustomerHistorySchema` | `BackhaulState` | Reads `return_rate`, `fraud_flag`, `prior_return_reasons`, `order_count`, `return_count`. |
| `intake` | `ReturnIntakeSchema` | `BackhaulState` | Reads `return_reason` (to detect serial buyer-remorse returns). |

---

## Output Contract

Writes `state["fraud_flag"]` as `FraudFlagSchema`:

| Key | Type | Description |
|-----|------|-------------|
| `fraud_score` | `float` | Composite fraud risk score from 0.0 (no risk) to 1.0 (maximum risk) |
| `flags` | `list[str]` | Human-readable list of rules that fired (for audit display) |
| `high_return_rate` | `bool` | Whether return_rate exceeds 0.20 (the first threshold) |
| `exceeds_fraud_threshold` | `bool` | Whether `fraud_score > 0.60` |

---

## Model

**No LLM — rule-based scoring.** Fraud detection for this domain must be deterministic and auditable. A human operator reviewing an escalated case needs to see exactly which rules fired. An LLM score would be opaque and untestable. Rule-based scoring is also instantaneous (< 1ms) and free.

---

## Processing Logic

1. **Read** inputs from `state["customer_history"]` and `state["intake"]`.
2. **Initialize** `fraud_score = 0.0` and `flags = []`.
3. **Apply scoring rules in order** (rules are additive; multiple rules can fire):

   **Rule 1 — High return rate (first tier)**: `return_rate > 0.20`
   - Add `+0.20` to `fraud_score`
   - Append `"return_rate_high: {return_rate:.2%}"` to `flags`

   **Rule 2 — High return rate (second tier)**: `return_rate > 0.40`
   - Add `+0.20` more to `fraud_score` (cumulative with Rule 1)
   - Append `"return_rate_very_high: {return_rate:.2%}"` to `flags`

   **Rule 3 — High return rate (third tier)**: `return_rate > 0.60`
   - Add `+0.20` more to `fraud_score` (cumulative with Rules 1 and 2)
   - Append `"return_rate_extreme: {return_rate:.2%}"` to `flags`

   **Rule 4 — Prior fraud flag**: `customer_history["fraud_flag"] == True`
   - Add `+0.30` to `fraud_score`
   - Append `"prior_fraud_flag: true"` to `flags`

   **Rule 5 — Serial buyer remorse**: Count of `"buyer_remorse"` in `prior_return_reasons >= 3`
   - Add `+0.10` to `fraud_score`
   - Append `"serial_buyer_remorse: {count} instances"` to `flags`

   **Rule 6 — High volume**: `return_count > 5`
   - Add `+0.05` to `fraud_score`
   - Append `"high_volume_returner: {return_count} returns"` to `flags`

4. **Clamp** `fraud_score = min(fraud_score, 1.0)`.
5. **Set** `high_return_rate = return_rate > 0.20`.
6. **Set** `exceeds_fraud_threshold = fraud_score > 0.60`.
7. **Write** the populated `FraudFlagSchema` to `state["fraud_flag_result"]`.

Note: The output key is `state["fraud_flag_result"]` to avoid collision with the `fraud_flag` boolean in `CustomerHistorySchema`.

---

## Scoring Examples

### Example 1 — No fraud signals
- `return_rate: 0.10`, `fraud_flag: false`, `prior_return_reasons: ["damage_in_transit"]`, `return_count: 1`
- Rules fired: none
- `fraud_score: 0.0`, `flags: []`, `exceeds_fraud_threshold: false`

### Example 2 — Moderate concern
- `return_rate: 0.30`, `fraud_flag: false`, `prior_return_reasons: ["buyer_remorse", "buyer_remorse", "buyer_remorse"]`, `return_count: 3`
- Rules fired: Rule 1 (+0.20), Rule 5 (+0.10)
- `fraud_score: 0.30`, `flags: ["return_rate_high: 30.00%", "serial_buyer_remorse: 3 instances"]`, `exceeds_fraud_threshold: false`

### Example 3 — High fraud risk
- `return_rate: 0.65`, `fraud_flag: true`, `prior_return_reasons: ["buyer_remorse", "buyer_remorse", "buyer_remorse", "not_as_described"]`, `return_count: 7`
- Rules fired: Rule 1 (+0.20), Rule 2 (+0.20), Rule 3 (+0.20), Rule 4 (+0.30), Rule 5 (+0.10), Rule 6 (+0.05) = 1.05 → clamped to 1.0
- `fraud_score: 1.0`, `exceeds_fraud_threshold: true`
- `flags: ["return_rate_high: 65.00%", "return_rate_very_high: 65.00%", "return_rate_extreme: 65.00%", "prior_fraud_flag: true", "serial_buyer_remorse: 3 instances", "high_volume_returner: 7 returns"]`

### Example 4 — Just above threshold
- `return_rate: 0.42`, `fraud_flag: false`, `prior_return_reasons: ["buyer_remorse", "buyer_remorse", "buyer_remorse", "buyer_remorse"]`, `return_count: 4`
- Rules fired: Rule 1 (+0.20), Rule 2 (+0.20), Rule 5 (+0.10)
- `fraud_score: 0.50`, `exceeds_fraud_threshold: false` (below 0.60 threshold — Decision Agent can still auto-decide)

---

## Acceptance Criteria

1. **Zero fraud signals**: A customer with `return_rate: 0.10`, no fraud flag, and 1 return gets `fraud_score: 0.0` and `exceeds_fraud_threshold: false`.
2. **Rule 1 fires at 0.21**: A customer with `return_rate: 0.21` gets `fraud_score: 0.20` and the `return_rate_high` flag.
3. **Rule 1 does not fire at 0.20**: `return_rate: 0.20` is exactly at the boundary; the rule fires only when `> 0.20`. Verify the strict `>` not `>=`.
4. **Prior fraud flag adds 0.30**: A customer with only a prior fraud flag (no return rate issues) gets `fraud_score: 0.30`.
5. **Score clamped to 1.0**: A customer hitting every rule cannot exceed `fraud_score: 1.0`.
6. **exceeds_fraud_threshold boundary**: `fraud_score: 0.60` exactly does not trigger (strict `>`). `fraud_score: 0.61` does trigger.
7. **Serial buyer remorse requires exactly 3**: A customer with 2 prior buyer_remorse returns does not trigger Rule 5. A customer with 3 does.
8. **Flags list is human-readable**: Each flag string is readable by a human operator in the escalation queue without needing a legend.
9. **Fixture test**: The test in `/evals/fraud-flag/` covers all 6 rules individually and in combination.
10. **Deterministic**: Given identical inputs, the agent always returns identical outputs. No randomness.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| `customer_history` is the neutral default (all zeros) | `fraud_score: 0.0`, no flags |
| `return_rate: 0.0` | No return-rate rules fire |
| `return_count` is 0 but `return_rate` is nonzero | Handle gracefully (should not happen with correct upstream logic, but defend) |
| `prior_return_reasons` contains nulls | Filter nulls before counting buyer_remorse occurrences |
| `prior_return_reasons` is an empty list | No buyer_remorse count; Rule 5 does not fire |
| `return_rate > 1.0` (data integrity issue) | Allow — do not clamp. Rules still apply. A return_rate > 1.0 is a data issue, not a fraud scoring issue. |
| `fraud_flag` in customer_history is `None` | Treat as `False` |

---

## Cost Target

**$0.00 per call.** No LLM is invoked. Pure in-memory arithmetic. Execution time is < 1ms.

---

## Fallback

There is no failure mode for this agent — it is pure arithmetic on already-validated inputs. However, if `customer_history` is missing from state (defensive guard):

```python
{
    "fraud_score": 0.0,
    "flags": ["customer_history_missing"],
    "high_return_rate": False,
    "exceeds_fraud_threshold": False
}
```

---

## Braintrust Span

**Span name**: `backhaul.fraud_flag_agent`

**Attributes to log**:
| Attribute | Value |
|-----------|-------|
| `customer_id` | from customer_history |
| `return_rate` | from customer_history |
| `prior_fraud_flag` | from customer_history |
| `fraud_score` | from result |
| `flags` | from result (as list) |
| `exceeds_fraud_threshold` | from result |
| `rules_fired_count` | count of flags |
| `latency_ms` | wall-clock time (expected < 1ms) |
