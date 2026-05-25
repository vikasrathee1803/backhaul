# Repair Worker — Agent Spec

## Role
Schedules a repair pickup and creates a work order for returns where the Decision Agent has recommended `repair`, estimating labor hours based on damage severity, computing a repair cost estimate, and generating a scheduled pickup date 3 business days from today.

---

## Input Contract

| Key | Type | Source | Description |
|-----|------|--------|-------------|
| `decision` | `DispositionDecisionSchema` | `BackhaulState` | Reads `disposition` to confirm this worker should execute. |
| `intake` | `ReturnIntakeSchema` | `BackhaulState` | Reads `return_id`, `customer_id`, `sku_code`, `marketplace`. |
| `damage_signal` | `DamageSignalSchema` | `BackhaulState` | Reads `damage_severity`, `damage_components`, `repair_feasibility`. |
| `sku_profile` | `SkuProfileSchema` | `BackhaulState` | Reads `name`, `weight_lbs`, `freight_class`. |

---

## Output Contract

Writes `state["worker_result"]` as `WorkerResultSchema`:

| Key | Type | Description |
|-----|------|-------------|
| `worker` | `str` | `"repair_worker"` |
| `status` | `str` | `"completed" \| "uncertain_repair" \| "failed" \| "skipped"` |
| `actions_taken` | `list[str]` | Human-readable list of actions performed |
| `notes` | `str` | Work order ID, pickup date, labor estimate, or reason for status |

---

## Model

**No LLM — rule-based scheduling.** Repair scheduling is deterministic: the pickup date is always 3 business days out; labor estimates are based on damage severity; work order IDs are generated from the return ID.

---

## Processing Logic

1. **Guard**: If `state["decision"]["disposition"] != "repair"`, set `status: "skipped"` and return early.

2. **Determine labor estimate** based on `damage_signal["damage_severity"]`:
   ```
   cosmetic    → labor_hours: 2,  labor_cost_cents: 8000   ($80 at $40/hr)
   functional  → labor_hours: 4,  labor_cost_cents: 16000  ($160 at $40/hr)
   structural  → labor_hours: 8,  labor_cost_cents: 32000  ($320 at $40/hr)
   total_loss  → labor_hours: 0,  labor_cost_cents: 0      (should not reach repair worker; flag as uncertain)
   none        → labor_hours: 1,  labor_cost_cents: 4000   ($40 inspection fee minimum)
   ```

3. **Compute pickup date**: Add 3 business days to today's date. Skip Saturdays and Sundays. Use UTC dates.

4. **Generate work order ID**: `WO-{return_id}-{date_yyyymmdd}`.

5. **Create work order record** (write to `state["work_order"]`):
   ```python
   {
       "work_order_id": work_order_id,
       "return_id": return_id,
       "customer_id": customer_id,
       "sku_code": sku_code,
       "sku_name": sku_name,
       "damage_severity": damage_severity,
       "damage_components": damage_components,
       "repair_feasibility": repair_feasibility,
       "labor_hours_estimate": labor_hours,
       "labor_cost_estimate_cents": labor_cost_cents,
       "pickup_scheduled_date": pickup_date,
       "carrier": "freight_partner",  # v1 fixture carrier
       "status": "pending_pickup",
       "created_at": datetime.utcnow().isoformat()
   }
   ```

6. **Build `actions_taken`**:
   - `"Work order created: {work_order_id}"`
   - `"Repair pickup scheduled: {pickup_date}"`
   - `"Labor estimate: {labor_hours}h @ $40/hr = ${labor_cost_cents/100:.2f}"`
   - `"Damaged components: {', '.join(damage_components) or 'not specified'}"`
   - If `repair_feasibility == "uncertain"`: `"Note: repair feasibility is uncertain — inspect on arrival before committing to full repair"`

7. **Set status**:
   - `repair_feasibility == "feasible"` → `status: "completed"`
   - `repair_feasibility == "uncertain"` → `status: "uncertain_repair"` (repair scheduled but with caveat)
   - `repair_feasibility == "not_feasible"` → `status: "failed"`, `notes: "Repair not feasible per damage signal — recommend re-routing to dispose or donate"`

8. **Write** `WorkerResultSchema` to `state["worker_result"]`.

---

## Business Day Calculation

The `next_business_day(date, n)` utility adds `n` business days, skipping Saturday (weekday 5) and Sunday (weekday 6). It does not account for holidays in v1. This is a known limitation logged in `/docs/ASSUMPTIONS.md`.

```python
def add_business_days(start_date: date, days: int) -> date:
    current = start_date
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() < 5:  # Monday=0 through Friday=4
            added += 1
    return current
```

---

## Acceptance Criteria

1. **Happy path — functional damage**: Given `damage_severity: "functional"` and `disposition: "repair"`, the worker creates a work order with `labor_hours: 4`, `labor_cost_cents: 16000`, and a pickup date 3 business days from today.
2. **Business day calculation**: If today is Thursday, the pickup date is the following Tuesday (skipping Saturday and Sunday). If today is Friday, the pickup date is Wednesday.
3. **Cosmetic damage labor**: Given `damage_severity: "cosmetic"`, the worker estimates 2 hours and $80.
4. **Structural damage labor**: Given `damage_severity: "structural"`, the worker estimates 8 hours and $320.
5. **Uncertain repair caveat**: Given `repair_feasibility: "uncertain"`, the worker returns `status: "uncertain_repair"` and includes the inspection caveat in `actions_taken`.
6. **Skip guard**: Given `disposition: "refund"`, the worker returns `status: "skipped"`.
7. **Work order ID includes date**: The work order ID format is `WO-{return_id}-{yyyymmdd}`, making it human-readable and dateable.
8. **Damage components in work order**: The `damage_components` list from `damage_signal` is preserved in the work order for the technician.
9. **not_feasible guard**: Given `repair_feasibility: "not_feasible"` but `disposition: "repair"` (an edge case from Decision Agent), the worker returns `status: "failed"` with re-routing guidance.
10. **Fixture test**: The test in `/evals/repair-worker/` covers cosmetic, functional, structural, and uncertain-feasibility scenarios.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| `damage_severity: "total_loss"` routed to repair | Flag as not feasible, return `status: "failed"`, recommend re-route |
| `damage_components` is empty list | Record "components not specified" in work order |
| Today is Friday | Pickup date is Wednesday (Mon=1, Tue=2, Wed=3 business days) |
| `sku_profile` is fallback defaults | Work order created with `sku_name: "Unknown SKU: {sku_code}"` — flag for manual item identification |
| `damage_severity: "none"` routed to repair | Use minimum inspection fee (1h, $40) — notes that no damage was identified but inspection was requested |

---

## Cost Target

**$0.00 per call.** No LLM. Arithmetic and date calculation only.

---

## Fallback

```python
{
    "worker": "repair_worker",
    "status": "failed",
    "actions_taken": ["Repair scheduling failed"],
    "notes": f"Error: {str(exception)}. Manual repair scheduling required for return {return_id}."
}
```

---

## Braintrust Span

**Span name**: `backhaul.repair_worker`

**Attributes to log**:
| Attribute | Value |
|-----------|-------|
| `return_id` | from intake |
| `damage_severity` | from damage_signal |
| `repair_feasibility` | from damage_signal |
| `labor_hours_estimate` | computed |
| `labor_cost_estimate_cents` | computed |
| `pickup_date` | scheduled date |
| `work_order_id` | generated |
| `status` | from result |
| `latency_ms` | wall-clock time |
