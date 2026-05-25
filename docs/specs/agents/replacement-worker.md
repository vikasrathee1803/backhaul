# Replacement Worker — Agent Spec

## Role
Books a replacement shipment for returns where the Decision Agent has recommended `replace`, checking live inventory from the SKU profile and creating a replacement order in the fixture system — falling back to a refund recommendation when stock is unavailable.

---

## Input Contract

| Key | Type | Source | Description |
|-----|------|--------|-------------|
| `decision` | `DispositionDecisionSchema` | `BackhaulState` | Reads `disposition` to confirm this worker should execute. |
| `intake` | `ReturnIntakeSchema` | `BackhaulState` | Reads `sku_code`, `customer_id`, `return_id`, `marketplace`, `order_total_cents`. |
| `sku_profile` | `SkuProfileSchema` | `BackhaulState` | Reads `current_stock`, `name`, `weight_lbs`, `freight_class`. |

---

## Output Contract

Writes `state["worker_result"]` as `WorkerResultSchema`:

| Key | Type | Description |
|-----|------|-------------|
| `worker` | `str` | `"replacement_worker"` |
| `status` | `str` | `"completed" \| "stock_unavailable" \| "failed" \| "skipped"` |
| `actions_taken` | `list[str]` | Human-readable list of actions performed |
| `notes` | `str` | Replacement order ID, tracking reference, or reason for stock unavailability |

---

## Model

**No LLM — inventory lookup and fixture order creation.** Replacement booking is a deterministic inventory and logistics operation.

---

## Processing Logic

1. **Guard**: If `state["decision"]["disposition"] != "replace"`, set `status: "skipped"`, add `"Disposition is {disposition}, not replace — skipped"` to `actions_taken`, and return early.

2. **Check inventory**: Read `current_stock = state["sku_profile"]["current_stock"]`.

3. **Branch A — Stock available** (`current_stock > 0`):
   a. Generate a replacement order ID: `REPL-{return_id}-{timestamp}`.
   b. Create a fixture replacement order in memory (write to `state["replacement_order"]`):
      ```python
      {
          "replacement_order_id": f"REPL-{return_id}",
          "customer_id": customer_id,
          "sku_code": sku_code,
          "sku_name": sku_name,
          "marketplace": marketplace,
          "status": "pending_shipment",
          "created_at": datetime.utcnow().isoformat(),
          "original_return_id": return_id
      }
      ```
   c. Decrement inventory: Update the in-memory SKU catalog to `current_stock - 1` for this SKU.
   d. Estimate ship date: 2 business days from today.
   e. Add to `actions_taken`:
      - `"Replacement order created: {replacement_order_id}"`
      - `"Inventory decremented: {sku_code} stock now {new_stock}"`
      - `"Estimated ship date: {ship_date}"`
   f. Set `status: "completed"`, `notes: f"Replacement order {replacement_order_id} created. Ship by {ship_date}."`.

4. **Branch B — Out of stock** (`current_stock == 0`):
   a. Add to `actions_taken`: `"Replacement not possible: {sku_code} is out of stock (current_stock: 0)"`.
   b. Add: `"Recommend fallback to refund disposition"`.
   c. Set `status: "stock_unavailable"`.
   d. Write a state flag `state["replacement_fallback_to_refund"] = True` so the graph can route to the Refund Worker.

5. **Write** `WorkerResultSchema` to `state["worker_result"]`.

---

## Inventory Management Note

In v1, inventory is managed against the in-memory fixture loaded from `fixtures/skus.json`. Stock decrements during a graph run are reflected in the in-memory cache but are NOT persisted back to the JSON file between service restarts. This is acceptable for the demo. In production, this would write to the `sku_catalog` table in Postgres.

The Replacement Worker must acquire an in-memory lock before decrementing stock to prevent race conditions in concurrent graph runs. Use a `threading.Lock()` or `asyncio.Lock()` on the SKU cache.

---

## Acceptance Criteria

1. **Happy path — stock available**: Given `current_stock: 3` and `disposition: "replace"`, the worker creates a replacement order, decrements stock to 2, and returns `status: "completed"`.
2. **Stock decrement is correct**: After a successful replacement, the SKU's `current_stock` in the cache is exactly `original_stock - 1`.
3. **Out-of-stock fallback**: Given `current_stock: 0`, the worker returns `status: "stock_unavailable"` and sets `state["replacement_fallback_to_refund"] = True`.
4. **Skip guard**: Given `disposition: "refund"`, the worker returns `status: "skipped"` without touching inventory.
5. **Replacement order ID uniqueness**: Two replacements for different returns produce different order IDs.
6. **Ship date estimation**: The estimated ship date is always in the future (2 business days). Verify it accounts for weekends.
7. **Actions list readable**: `actions_taken` can be displayed in the Agent Ops UI.
8. **Concurrent safety**: Two simultaneous replacements for the same SKU do not double-decrement (lock test).
9. **Fixture test**: The test in `/evals/replacement-worker/` covers both the in-stock and out-of-stock branches.
10. **state["replacement_fallback_to_refund"]**: When set to `True`, the graph routes to the Refund Worker. Verify this routing exists in the graph topology.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| `current_stock: 1` (last unit) | Create replacement order, decrement to 0. Next call for same SKU will be out-of-stock. |
| `sku_code: "unknown"` | `current_stock` will be 0 (conservative SKU fallback). Treat as out-of-stock. |
| `current_stock` is negative in fixture | Treat as 0 (data quality guard) |
| `customer_id: "unknown"` | Create replacement order with unknown customer — flag in `notes` for manual address lookup |
| Marketplace is `amazon_fba` | Replacement fulfillment is via Amazon FBA; note this in `actions_taken` (FBA handles the shipment, not the seller) |

---

## Cost Target

**$0.00 per call.** No LLM. In-memory dictionary operations only.

---

## Fallback

If any unexpected exception occurs during order creation:

```python
{
    "worker": "replacement_worker",
    "status": "failed",
    "actions_taken": ["Replacement order creation failed"],
    "notes": f"Error: {str(exception)}. Manual replacement booking required for return {return_id}."
}
```

---

## Braintrust Span

**Span name**: `backhaul.replacement_worker`

**Attributes to log**:
| Attribute | Value |
|-----------|-------|
| `return_id` | from intake |
| `sku_code` | from intake |
| `current_stock` | from sku_profile |
| `stock_available` | `true \| false` |
| `replacement_order_id` | if created |
| `status` | from result |
| `latency_ms` | wall-clock time |
