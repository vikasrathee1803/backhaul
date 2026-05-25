# Refund Worker — Agent Spec

## Role
Issues a refund for returns where the Decision Agent has recommended `refund`, using the Stripe test-mode API when available or a mock simulation when the API key is absent — producing an auditable record of the refund action including the refund amount, restocking fee deduction, and Stripe payment intent reference.

---

## Input Contract

| Key | Type | Source | Description |
|-----|------|--------|-------------|
| `decision` | `DispositionDecisionSchema` | `BackhaulState` | Reads `disposition` to confirm this worker should execute. |
| `intake` | `ReturnIntakeSchema` | `BackhaulState` | Reads `order_total_cents`, `marketplace`, `customer_id`, `return_id`. |
| `marketplace_policy` | `MarketplacePolicySchema` | `BackhaulState` | Reads `restocking_fee_pct` to compute the net refund amount. |

---

## Output Contract

Writes `state["worker_result"]` as `WorkerResultSchema`:

| Key | Type | Description |
|-----|------|-------------|
| `worker` | `str` | `"refund_worker"` |
| `status` | `str` | `"completed" \| "simulated" \| "failed" \| "skipped"` |
| `actions_taken` | `list[str]` | Human-readable list of actions performed |
| `notes` | `str` | Additional context (Stripe charge ID, simulation reason, error message) |

---

## Model

**No LLM — Stripe API or mock simulation.** Refund issuance is a deterministic payment operation. AI has no role here.

---

## Processing Logic

1. **Guard**: If `state["decision"]["disposition"] != "refund"`, set `status: "skipped"`, add `"Disposition is {disposition}, not refund — skipped"` to `actions_taken`, and return early.

2. **Compute net refund amount**:
   ```python
   restocking_fee_cents = int(
       intake["order_total_cents"] * marketplace_policy["restocking_fee_pct"]
   )
   net_refund_cents = intake["order_total_cents"] - restocking_fee_cents
   ```

3. **Check for Stripe API key** (`STRIPE_API_KEY` environment variable):

   **Branch A — Stripe available** (`STRIPE_API_KEY` is set and non-empty):
   a. Import `stripe` and set `stripe.api_key`.
   b. Look up the Stripe `PaymentIntent` or `Charge` ID from the fixture order record (stored in `fixtures/orders.json` under the return's order reference).
   c. Call `stripe.Refund.create(payment_intent=pi_id, amount=net_refund_cents, reason="customer_complaint")`.
   d. If the Stripe call succeeds, add `"Refund issued: {net_refund_cents} cents via Stripe (ID: {refund.id})"` to `actions_taken`.
   e. Set `status: "completed"`, `notes: f"Stripe refund ID: {refund.id}, charge: {charge_id}"`.

   **Branch B — Stripe not available** (`STRIPE_API_KEY` is unset or empty):
   a. Simulate: generate a fake refund ID `mock-refund-{return_id}-{timestamp}`.
   b. Add `"[SIMULATED] Refund of {net_refund_cents} cents issued for return {return_id}"` to `actions_taken`.
   c. If `restocking_fee_cents > 0`: add `"[SIMULATED] Restocking fee of {restocking_fee_cents} cents deducted"` to `actions_taken`.
   d. Set `status: "simulated"`, `notes: f"Stripe not configured. Mock refund ID: {mock_id}"`.

4. **Write** `WorkerResultSchema` to `state["worker_result"]`.

---

## Refund Amount Computation Detail

The refund calculation applies the marketplace restocking fee as a deduction:

| Marketplace | Restocking Fee | Example ($1,299 order) | Net Refund |
|-------------|---------------|------------------------|------------|
| Wayfair | 0% | $0 deducted | $1,299.00 |
| Amazon FBA | 0% | $0 deducted | $1,299.00 |
| Amazon FBM | 0% | $0 deducted | $1,299.00 |
| Houzz | 0% | $0 deducted | $1,299.00 |
| Overstock | 15% | $194.85 deducted | $1,104.15 |
| Shopify D2C | 0% | $0 deducted | $1,299.00 |

Note: The Overstock restocking fee significantly changes the economics of a refund decision and will influence the Decision Agent's preference for other dispositions on that channel.

---

## Stripe Integration Notes

- **Test mode only in v1**: All Stripe calls use a `sk_test_*` key. No real money moves.
- **PaymentIntent lookup**: The fixture `orders.json` includes a `stripe_payment_intent_id` field for each order. In test mode, use Stripe's test fixture payment intents.
- **Partial refunds**: The Stripe API supports partial refund amounts. The `amount` parameter in `stripe.Refund.create()` takes the net refund in cents — this is how the restocking fee deduction is applied.
- **Idempotency**: In v1, no idempotency key is set. For production, add `idempotency_key=f"backhaul-refund-{return_id}"`.

---

## Acceptance Criteria

1. **Happy path — simulation**: Given `STRIPE_API_KEY` not set and `disposition: "refund"`, the worker produces `status: "simulated"` with a mock refund ID in `notes`.
2. **Restocking fee deduction**: Given `order_total_cents: 129900` and `restocking_fee_pct: 0.15` (Overstock), the worker computes `net_refund_cents: 110415` (i.e., 129900 × 0.85 = 110415).
3. **Zero restocking fee**: Given `restocking_fee_pct: 0.0`, `net_refund_cents` equals `order_total_cents` exactly.
4. **Skip guard**: Given `disposition: "refurbish"`, the worker returns `status: "skipped"` without attempting a refund.
5. **Actions list is human-readable**: `actions_taken` can be displayed in the Agent Ops UI without additional formatting.
6. **Stripe failure handling**: Given a Stripe API error (simulated in tests), the worker returns `status: "failed"` with the error message in `notes` — it does not crash the graph.
7. **Mock refund ID uniqueness**: Two simulated refunds for different returns produce different mock IDs.
8. **Audit trail compatibility**: The `worker_result` output is written to the audit log by the Audit Agent. All required fields are non-null.
9. **Fixture test without live API**: The test in `/evals/refund-worker/` uses mock Stripe responses and asserts correct output.
10. **Integer math**: All currency arithmetic uses integer cents, not floats, to avoid rounding errors.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| `order_total_cents: 0` | Skip refund (nothing to refund), `status: "skipped"`, note the reason |
| `restocking_fee_pct > 1.0` | Clamp to 1.0 before deducting (should not happen in practice) |
| Stripe rate limit error | Return `status: "failed"`, include retry guidance in `notes` |
| Stripe payment intent not found | Return `status: "failed"`, include the lookup key that failed |
| `disposition` is `null` or missing | Treat as non-refund, skip |
| `net_refund_cents` rounds to fractional cents | Use `int()` truncation, not rounding — never over-refund |

---

## Cost Target

**$0.00 per call** (no LLM). Stripe API call in test mode is free. Simulation is in-memory only.

---

## Fallback

If the Stripe call raises any exception:

```python
{
    "worker": "refund_worker",
    "status": "failed",
    "actions_taken": ["Stripe refund attempt failed"],
    "notes": f"Error: {str(exception)}. Manual refund processing required for return {return_id}."
}
```

The failed state is logged to the audit trail and the Escalation Agent is notified to flag for human follow-up.

---

## Braintrust Span

**Span name**: `backhaul.refund_worker`

**Attributes to log**:
| Attribute | Value |
|-----------|-------|
| `return_id` | from intake |
| `order_total_cents` | from intake |
| `restocking_fee_cents` | computed |
| `net_refund_cents` | computed |
| `stripe_used` | `true \| false` |
| `status` | from result |
| `stripe_refund_id` | if available |
| `latency_ms` | wall-clock time |
