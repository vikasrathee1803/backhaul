# Refurb Worker — Agent Spec

## Role
Routes a returned item to the refurbishment queue with a graded condition assessment (A, B, or C), estimated refurb timeline, and resale price target — setting up the refurbishment operations team to process and relist the item as Open Box inventory.

---

## Input Contract

| Key | Type | Source | Description |
|-----|------|--------|-------------|
| `decision` | `DispositionDecisionSchema` | `BackhaulState` | Reads `disposition` to confirm this worker should execute. |
| `intake` | `ReturnIntakeSchema` | `BackhaulState` | Reads `return_id`, `sku_code`, `marketplace`, `customer_id`. |
| `damage_signal` | `DamageSignalSchema` | `BackhaulState` | Reads `damage_severity`, `damage_components`. |
| `sku_profile` | `SkuProfileSchema` | `BackhaulState` | Reads `name`, `refurb_difficulty`, `open_box_price_estimate_cents`, `refurb_cost_estimate_cents`. |

---

## Output Contract

Writes `state["worker_result"]` as `WorkerResultSchema`:

| Key | Type | Description |
|-----|------|-------------|
| `worker` | `str` | `"refurb_worker"` |
| `status` | `str` | `"completed" \| "not_feasible" \| "failed" \| "skipped"` |
| `actions_taken` | `list[str]` | Human-readable list of actions performed |
| `notes` | `str` | Refurb queue entry ID, grade, estimated timeline, resale price target |

---

## Model

**No LLM — rule-based grading.** Condition grading from damage severity is deterministic. The grade rules are simple, auditable, and must be consistent across all refurb queue entries.

---

## Processing Logic

1. **Guard**: If `state["decision"]["disposition"] != "refurbish"`, set `status: "skipped"` and return early.

2. **Guard — not feasible**: If `sku_profile["refurb_difficulty"] == "not_feasible"`, set `status: "not_feasible"`, add `"Refurb not feasible for SKU {sku_code} per SKU profile"` to `actions_taken`, and return.

3. **Determine Open Box grade** from `damage_signal["damage_severity"]`:
   ```
   none      → Grade A ("Like New / Open Box")
   cosmetic  → Grade A ("Open Box — Minor Cosmetic Wear")
   functional → Grade B ("Refurbished — Functional Repair Required")
   structural → Grade C ("As-Is / For Parts")
   total_loss → Grade C ("As-Is / For Parts") — should not normally reach refurb worker
   ```

4. **Compute refurb economics**:
   ```python
   resale_price_cents = sku_profile["open_box_price_estimate_cents"]
   refurb_cost_cents = sku_profile["refurb_cost_estimate_cents"]
   net_refurb_value_cents = resale_price_cents - refurb_cost_cents
   ```

5. **Estimate refurb timeline** based on `refurb_difficulty`:
   ```
   easy     → 1 business day
   moderate → 3 business days
   hard     → 7 business days
   ```

6. **Generate refurb queue entry ID**: `REFURB-{return_id}-{grade}-{date_yyyymmdd}`.

7. **Create refurb queue record** (write to `state["refurb_queue_entry"]`):
   ```python
   {
       "refurb_entry_id": refurb_entry_id,
       "return_id": return_id,
       "sku_code": sku_code,
       "sku_name": sku_name,
       "grade": grade,
       "grade_description": grade_description,
       "damage_severity": damage_severity,
       "damage_components": damage_components,
       "refurb_difficulty": refurb_difficulty,
       "estimated_completion_days": timeline_days,
       "resale_price_target_cents": resale_price_cents,
       "refurb_cost_estimate_cents": refurb_cost_cents,
       "net_refurb_value_cents": net_refurb_value_cents,
       "status": "queued",
       "created_at": datetime.utcnow().isoformat()
   }
   ```

8. **Build `actions_taken`**:
   - `"Routed to refurb queue: {refurb_entry_id}"`
   - `"Grade assigned: {grade} — {grade_description}"`
   - `"Estimated timeline: {timeline_days} business day(s)"`
   - `"Resale target: ${resale_price_cents/100:.2f} (net after refurb: ${net_refurb_value_cents/100:.2f})"`
   - If `damage_components`: `"Components for attention: {', '.join(damage_components)}"`

9. **Write** `WorkerResultSchema` to `state["worker_result"]`.

---

## Grade Definitions

| Grade | Damage Severity | Description | Typical Discount from New |
|-------|----------------|-------------|--------------------------|
| A | none, cosmetic | Like New / Open Box: item is fully functional with no visible damage or only minor cosmetic wear. Box may be opened or damaged. | 10–20% |
| B | functional | Refurbished: item has been repaired and is fully functional. May have visible cosmetic imperfections. | 25–40% |
| C | structural, total_loss | As-Is / For Parts: item has significant structural damage. Sold at deep discount to buyers who want parts or can perform major repairs. | 50–70% |

---

## Acceptance Criteria

1. **Grade A for cosmetic damage**: Given `damage_severity: "cosmetic"`, the worker assigns Grade A.
2. **Grade B for functional damage**: Given `damage_severity: "functional"`, the worker assigns Grade B.
3. **Grade C for structural damage**: Given `damage_severity: "structural"`, the worker assigns Grade C.
4. **No damage → Grade A**: Given `damage_severity: "none"`, the worker assigns Grade A with "Like New / Open Box" description.
5. **not_feasible guard**: Given `refurb_difficulty: "not_feasible"`, the worker returns `status: "not_feasible"` without creating a queue entry.
6. **Economics in actions_taken**: The `actions_taken` list includes the resale target price and net refurb value in human-readable dollar format.
7. **Skip guard**: Given `disposition: "repair"`, the worker returns `status: "skipped"`.
8. **Timeline accuracy**: Given `refurb_difficulty: "hard"`, the timeline is 7 business days (not 1 or 3).
9. **Refurb entry ID contains grade**: The generated ID includes the grade letter (e.g., `REFURB-RET-042-A-20260201`).
10. **Fixture test**: The test in `/evals/refurb-worker/` covers Grade A, B, and C scenarios, plus the not_feasible guard.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| `refurb_difficulty: "not_feasible"` but `disposition: "refurbish"` | Return `status: "not_feasible"` — log the inconsistency. The Decision Agent should not have recommended refurbish for a not_feasible SKU, but the worker defends itself. |
| `open_box_price_estimate_cents: 0` (unknown SKU) | `net_refurb_value_cents` will be negative. Still create the queue entry with the negative economics prominently noted. A human will review. |
| `damage_severity: "total_loss"` routed to refurb | Assign Grade C. Include warning in notes: "Total loss item routed to refurb — verify before proceeding." |
| `damage_components` is empty | Omit the component line from `actions_taken`. Queue entry still created. |
| `refurb_difficulty: "easy"` with `damage_severity: "structural"` | Grade C still applies — grade is determined by damage, not refurb difficulty. |

---

## Cost Target

**$0.00 per call.** No LLM. In-memory rule evaluation only.

---

## Fallback

```python
{
    "worker": "refurb_worker",
    "status": "failed",
    "actions_taken": ["Refurb queue routing failed"],
    "notes": f"Error: {str(exception)}. Manual refurb queue entry required for return {return_id}."
}
```

---

## Braintrust Span

**Span name**: `backhaul.refurb_worker`

**Attributes to log**:
| Attribute | Value |
|-----------|-------|
| `return_id` | from intake |
| `sku_code` | from intake |
| `grade` | assigned grade |
| `damage_severity` | from damage_signal |
| `refurb_difficulty` | from sku_profile |
| `net_refurb_value_cents` | computed |
| `timeline_days` | estimated |
| `status` | from result |
| `latency_ms` | wall-clock time |
