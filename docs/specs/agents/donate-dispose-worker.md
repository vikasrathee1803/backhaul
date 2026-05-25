# Donate/Dispose Worker — Agent Spec

## Role
Routes a returned item to either a local donation partner or disposal, based on item weight and the disposition recommended by the Decision Agent — completing the end-of-life path for items that cannot economically be refunded, repaired, or refurbished.

---

## Input Contract

| Key | Type | Source | Description |
|-----|------|--------|-------------|
| `decision` | `DispositionDecisionSchema` | `BackhaulState` | Reads `disposition` to determine donate vs. dispose vs. skip. |
| `intake` | `ReturnIntakeSchema` | `BackhaulState` | Reads `return_id`, `sku_code`, `marketplace`. |
| `sku_profile` | `SkuProfileSchema` | `BackhaulState` | Reads `weight_lbs`, `name`, `freight_class`. |
| `damage_signal` | `DamageSignalSchema` | `BackhaulState` | Reads `damage_severity` (used for donation eligibility check). |

---

## Output Contract

Writes `state["worker_result"]` as `WorkerResultSchema`:

| Key | Type | Description |
|-----|------|-------------|
| `worker` | `str` | `"donate_dispose_worker"` |
| `status` | `str` | `"donated" \| "disposed" \| "skipped" \| "failed"` |
| `actions_taken` | `list[str]` | Human-readable list of actions performed |
| `notes` | `str` | Donation partner name, disposal record ID, or reason for skipping |

---

## Model

**No LLM — rule-based routing.** The donation-vs-disposal decision is a single weight threshold rule. Deterministic and auditable.

---

## Processing Logic

1. **Guard**: If `state["decision"]["disposition"]` is not `"donate"` and not `"dispose"`, set `status: "skipped"` and return early.

2. **Determine routing** based on `sku_profile["weight_lbs"]` AND `decision["disposition"]`:

   **If `decision["disposition"] == "donate"`**:
   - Check eligibility: If `damage_signal["damage_severity"] == "total_loss"`, item is not donation-eligible (too damaged). Override to dispose path.
   - If eligible: route to donation.

   **If `decision["disposition"] == "dispose"`**:
   - Route to disposal directly.

   **Weight-based secondary rule** (applied when `decision["disposition"]` is ambiguous — e.g., the Decision Agent said "dispose" but weight is < 50 lbs):
   - `weight_lbs > 50` → dispose (too heavy to donate economically; freight cost to donation center exceeds value)
   - `weight_lbs <= 50` → donate (worth the effort to donate)

3. **Donate path**:
   a. Select donation partner from the configured list (round-robin from fixture):
      - `"Habitat for Humanity ReStore"`
      - `"Goodwill Industrial"`
      - `"Local Reuse Center"`
   b. Generate donation reference: `DON-{return_id}-{date_yyyymmdd}`.
   c. Compute pickup date: 5 business days from today.
   d. Create donation record (write to `state["donation_record"]`):
      ```python
      {
          "donation_id": donation_id,
          "return_id": return_id,
          "sku_code": sku_code,
          "sku_name": sku_name,
          "partner": selected_partner,
          "pickup_date": pickup_date,
          "weight_lbs": weight_lbs,
          "status": "pending_pickup",
          "created_at": datetime.utcnow().isoformat()
      }
      ```
   e. Add to `actions_taken`:
      - `"Item routed for donation to: {partner}"`
      - `"Donation pickup scheduled: {pickup_date}"`
      - `"Reference: {donation_id}"`
   f. Set `status: "donated"`.

4. **Dispose path**:
   a. Generate disposal record ID: `DISP-{return_id}-{date_yyyymmdd}`.
   b. Determine disposal method based on `sku_profile["weight_lbs"]`:
      - `> 200 lbs` → `"Freight bulk pickup + commercial disposal"`
      - `50–200 lbs` → `"Local junk removal service"`
      - `< 50 lbs` → `"Curbside disposal"` (but weight < 50 means donate path was taken; this branch is defensive)
   c. Create disposal record (write to `state["disposal_record"]`):
      ```python
      {
          "disposal_id": disposal_id,
          "return_id": return_id,
          "sku_code": sku_code,
          "sku_name": sku_name,
          "disposal_method": disposal_method,
          "weight_lbs": weight_lbs,
          "status": "pending_pickup",
          "created_at": datetime.utcnow().isoformat()
      }
      ```
   d. Add to `actions_taken`:
      - `"Item routed for disposal: {disposal_method}"`
      - `"Weight: {weight_lbs} lbs — {freight_class} freight class"`
      - `"Reference: {disposal_id}"`
   e. Set `status: "disposed"`.

5. **Write** `WorkerResultSchema` to `state["worker_result"]`.

---

## Routing Decision Table

| Decision Disposition | Weight | Damage Severity | Routed To |
|---------------------|--------|-----------------|-----------|
| `donate` | ≤ 50 lbs | not total_loss | Donation partner |
| `donate` | > 50 lbs | any | Disposal (weight override) |
| `donate` | any | total_loss | Disposal (ineligible for donation) |
| `dispose` | any | any | Disposal |
| other | any | any | Skipped |

---

## Donation Partners

| Partner | Type | Accepts |
|---------|------|---------|
| Habitat for Humanity ReStore | Nonprofit home goods resale | Furniture, appliances in working condition |
| Goodwill Industrial | Nonprofit | Furniture, general household items |
| Local Reuse Center | Community | Light furniture, small appliances |

In v1, the partner selection is round-robin from the fixture list. In production, partner selection would account for partner capacity, item type, and geographic proximity.

---

## Acceptance Criteria

1. **Heavy item → dispose**: Given `weight_lbs: 142.0` and `disposition: "donate"`, the worker overrides to dispose (weight > 50 lbs) and returns `status: "disposed"`.
2. **Light item → donate**: Given `weight_lbs: 28.0` and `disposition: "donate"`, the worker routes to a donation partner and returns `status: "donated"`.
3. **Dispose disposition respected**: Given `disposition: "dispose"` regardless of weight, the worker routes to disposal.
4. **Total loss ineligible for donation**: Given `damage_severity: "total_loss"` and `disposition: "donate"`, the worker overrides to dispose.
5. **Donation partner is one of three configured partners**: The `notes` field contains exactly one of the three partner names.
6. **Disposal method scales with weight**: Given `weight_lbs: 315.0`, the disposal method is `"Freight bulk pickup + commercial disposal"`.
7. **Skip guard**: Given `disposition: "refund"`, the worker returns `status: "skipped"`.
8. **Reference IDs include date**: Both donation and disposal IDs include the `yyyymmdd` date component.
9. **Pickup date is future-dated**: Donation pickup is 5 business days from today. Verify no past dates.
10. **Fixture test**: The test in `/evals/donate-dispose-worker/` covers donate-by-weight, donate-override-by-weight, dispose-direct, and total-loss scenarios.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| `weight_lbs: 50.0` (exactly at boundary) | Weight is not `> 50`, so donate path applies (strict `>`) |
| `weight_lbs: 0` (unknown SKU fallback) | The conservative SKU fallback is `50.0 lbs`, so it falls exactly at the boundary and donates |
| `damage_severity: "structural"` and `disposition: "donate"` | Allow donation — structural damage does not automatically disqualify. Only total_loss is blocked. |
| All three donation partners are at capacity (v1) | Not modeled in v1. Round-robin regardless. Log to ASSUMPTIONS.md. |
| `sku_code: "unknown"` | Process with whatever weight is known (50.0 lbs from conservative fallback). Note unknown SKU in `actions_taken`. |

---

## Cost Target

**$0.00 per call.** No LLM. In-memory rule evaluation and list selection.

---

## Fallback

```python
{
    "worker": "donate_dispose_worker",
    "status": "failed",
    "actions_taken": ["Donate/dispose routing failed"],
    "notes": f"Error: {str(exception)}. Manual routing required for return {return_id}."
}
```

---

## Braintrust Span

**Span name**: `backhaul.donate_dispose_worker`

**Attributes to log**:
| Attribute | Value |
|-----------|-------|
| `return_id` | from intake |
| `sku_code` | from intake |
| `weight_lbs` | from sku_profile |
| `decision_disposition` | from decision |
| `actual_route` | `"donated" \| "disposed"` |
| `weight_override_applied` | `true` if donate was overridden to dispose due to weight |
| `damage_override_applied` | `true` if donate was overridden due to total_loss |
| `donation_partner` | if donated |
| `disposal_method` | if disposed |
| `status` | from result |
| `latency_ms` | wall-clock time |
