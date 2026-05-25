# Customer History Agent — Agent Spec

## Role
Looks up the customer in the fixture database by `customer_id` and populates `CustomerHistorySchema` with lifetime value, order count, return history, and fraud flag — providing downstream agents with the customer risk and value context needed for decisioning.

---

## Input Contract

| Key | Type | Source | Description |
|-----|------|--------|-------------|
| `intake` | `ReturnIntakeSchema` | `BackhaulState` | The structured intake object. Reads `intake["customer_id"]`. |

---

## Output Contract

Writes `state["customer_history"]` as `CustomerHistorySchema`:

| Key | Type | Description |
|-----|------|-------------|
| `customer_id` | `str` | The customer identifier |
| `lifetime_value_cents` | `int` | Total historical spend in cents |
| `order_count` | `int` | Total number of orders placed |
| `return_count` | `int` | Total number of returns initiated |
| `return_rate` | `float` | Computed as `return_count / max(order_count, 1)` |
| `fraud_flag` | `bool` | Whether a prior manual fraud flag exists on this customer |
| `prior_return_reasons` | `list[str]` | List of return reason strings from historical returns |

---

## Model

**No LLM — fixture/rule-based.** Customer history is deterministic lookup from `fixtures/customers.json`. No AI inference needed or appropriate here.

---

## Processing Logic

1. **Read** `customer_id = state["intake"]["customer_id"]`.
2. **Load** `fixtures/customers.json`. This file is loaded once at agent-service startup and cached in memory to avoid repeated disk I/O.
3. **Look up** the customer record by `customer_id`. The fixture file is keyed by `customer_id` at the top level.
4. **If found**:
   a. Extract `lifetime_value_cents`, `order_count`, `return_count`, `fraud_flag`, `prior_return_reasons` directly from the fixture record.
   b. Compute `return_rate = return_count / max(order_count, 1)` — never divide by zero.
   c. Coerce all types: ensure `lifetime_value_cents` and counts are integers, `return_rate` is a float, `fraud_flag` is a bool, `prior_return_reasons` is a list of strings.
5. **If not found** (customer_id is `"unknown"` or not present in fixture):
   a. Emit a warning log: `customer_id not found in fixture: {customer_id}`.
   b. Return neutral defaults (see Fallback section).
6. **Write** the populated `CustomerHistorySchema` to `state["customer_history"]`.

---

## Fixture Data Format

The agent reads from `fixtures/customers.json`. Expected structure:

```json
{
  "cust-001": {
    "customer_id": "cust-001",
    "name": "Jordan Lee",
    "email": "jordan.lee@example.com",
    "lifetime_value_cents": 485000,
    "order_count": 7,
    "return_count": 1,
    "fraud_flag": false,
    "prior_return_reasons": ["damage_in_transit"]
  },
  "cust-002": {
    "customer_id": "cust-002",
    "name": "Priya Kapoor",
    "email": "priya.kapoor@example.com",
    "lifetime_value_cents": 1250000,
    "order_count": 18,
    "return_count": 7,
    "fraud_flag": false,
    "prior_return_reasons": ["buyer_remorse", "buyer_remorse", "not_as_described", "buyer_remorse", "defective", "buyer_remorse", "wrong_item"]
  }
}
```

---

## Acceptance Criteria

1. **Happy path — known customer**: Given `customer_id: "cust-001"` present in the fixture, the agent returns a `CustomerHistorySchema` with all fields correctly populated within 50ms (no LLM call).
2. **Return rate computation**: Given `order_count: 10`, `return_count: 3`, the agent returns `return_rate: 0.3`.
3. **Zero order guard**: Given `order_count: 0`, `return_count: 0`, the agent returns `return_rate: 0.0` (no division by zero).
4. **Unknown customer fallback**: Given `customer_id: "unknown"`, the agent returns neutral defaults without crashing.
5. **Prior return reasons list**: The `prior_return_reasons` field is a list of strings, not a single string. Verify type coercion if fixture has a single string value.
6. **Fraud flag is boolean**: The `fraud_flag` field is always a Python `bool`, not an integer `0`/`1` from the fixture.
7. **Fixture not found fallback**: If `fixtures/customers.json` does not exist at startup, the agent logs an error and returns neutral defaults for every call (does not crash the service).
8. **Return rate accuracy**: `return_rate` is rounded to 4 decimal places. Verify `3/7 = 0.4286`, not `0.42857142857`.
9. **Fixture test passes without live API**: The test in `/evals/customer-history/` loads a stub fixture and verifies the schema output.
10. **LTV over $5,000 correctly surfaced**: A customer with `lifetime_value_cents: 500001` (= $5,000.01) is distinguishable by the Decision Agent from one with `lifetime_value_cents: 499999`. The raw integer is passed through without truncation.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| `customer_id` is `"unknown"` | Return neutral defaults immediately |
| `customer_id` not in fixture | Return neutral defaults, log warning |
| `fixtures/customers.json` missing | Log error, serve neutral defaults for all calls |
| `order_count` is 0 | `return_rate = 0.0` (guard against divide-by-zero) |
| `return_count > order_count` | Allow it — data may reflect multi-item returns. Do not clamp. |
| `fraud_flag` is `null` in fixture | Coerce to `False` |
| `prior_return_reasons` is empty list | Return empty list — valid |
| `lifetime_value_cents` is missing | Default to `0` |
| Fixture has extra fields (e.g., `email`, `name`) | Ignore — only extract schema-defined keys |
| `customer_id` contains special characters | Pass through as-is — it is an opaque identifier |

---

## Cost Target

**$0.00 per call.** No LLM is invoked. The only cost is a dictionary lookup in memory. Fixture loading at startup is a one-time I/O cost shared across all calls.

---

## Fallback

If the customer is not found in the fixture, return these neutral defaults that do not bias the Decision Agent toward any particular disposition:

```python
{
    "customer_id": customer_id,
    "lifetime_value_cents": 0,
    "order_count": 0,
    "return_count": 0,
    "return_rate": 0.0,
    "fraud_flag": False,
    "prior_return_reasons": []
}
```

Neutral defaults mean: unknown LTV (no VIP protection), no return history (no fraud signal), no fraud flag (benefit of the doubt). The Fraud Flag Agent handles its own fraud scoring independently.

---

## Braintrust Span

**Span name**: `backhaul.customer_history_agent`

**Attributes to log**:
| Attribute | Value |
|-----------|-------|
| `customer_id` | from intake |
| `found_in_fixture` | `true \| false` |
| `lifetime_value_cents` | from result |
| `return_rate` | from result |
| `fraud_flag` | from result |
| `order_count` | from result |
| `return_count` | from result |
| `latency_ms` | wall-clock time for lookup |
| `fallback_used` | `true \| false` |
