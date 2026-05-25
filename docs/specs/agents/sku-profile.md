# SKU Profile Agent — Agent Spec

## Role
Looks up the product SKU in the fixture catalog by `sku_code` and populates `SkuProfileSchema` with physical characteristics, freight class, refurbishment economics, and current inventory — providing the physical and economic context that drives refurb-or-dispose decisions.

---

## Input Contract

| Key | Type | Source | Description |
|-----|------|--------|-------------|
| `intake` | `ReturnIntakeSchema` | `BackhaulState` | The structured intake object. Reads `intake["sku_code"]`. |

---

## Output Contract

Writes `state["sku_profile"]` as `SkuProfileSchema`:

| Key | Type | Description |
|-----|------|-------------|
| `sku_code` | `str` | The product SKU code |
| `name` | `str` | Human-readable product name |
| `weight_lbs` | `float` | Item weight in pounds (affects freight cost and donate-vs-dispose routing) |
| `freight_class` | `str` | NMFC freight class (e.g., `"70"`, `"85"`, `"100"`, `"125"`) |
| `refurb_difficulty` | `str` | `easy \| moderate \| hard \| not_feasible` |
| `open_box_price_estimate_cents` | `int` | Estimated resale price as open-box / refurbished unit in cents |
| `refurb_cost_estimate_cents` | `int` | Estimated labor + materials cost to refurbish in cents |
| `current_stock` | `int` | Current warehouse inventory count (for replacement routing) |

---

## Model

**No LLM — fixture/rule-based.** SKU characteristics are physical facts about the product. These are pre-populated in the fixture catalog. No inference needed.

---

## Processing Logic

1. **Read** `sku_code = state["intake"]["sku_code"]`.
2. **Load** `fixtures/skus.json`. Loaded once at service startup and cached in memory.
3. **Look up** the SKU record by `sku_code`. The fixture file is keyed by `sku_code` at the top level.
4. **If found**:
   a. Extract all required fields from the fixture record.
   b. Validate `refurb_difficulty` is one of `easy | moderate | hard | not_feasible`. Default to `moderate` if invalid.
   c. Ensure `weight_lbs` is a positive float. Default to `50.0` if missing or zero.
   d. Ensure `open_box_price_estimate_cents` and `refurb_cost_estimate_cents` are non-negative integers. Default to `0` if missing.
   e. Ensure `current_stock` is a non-negative integer. Default to `0` if missing.
5. **If not found** (sku_code is `"unknown"` or not in fixture):
   a. Emit a warning log: `sku_code not found in fixture: {sku_code}`.
   b. Return conservative defaults (see Fallback section).
6. **Write** the populated `SkuProfileSchema` to `state["sku_profile"]`.

---

## Fixture Data Format

The agent reads from `fixtures/skus.json`. Expected structure:

```json
{
  "SOF-3SEAT-GRY": {
    "sku_code": "SOF-3SEAT-GRY",
    "name": "Harbor 3-Seat Sofa in Charcoal Grey",
    "weight_lbs": 142.0,
    "freight_class": "85",
    "refurb_difficulty": "moderate",
    "open_box_price_estimate_cents": 89900,
    "refurb_cost_estimate_cents": 8500,
    "current_stock": 3
  },
  "TBL-DNNG-OAK-6": {
    "sku_code": "TBL-DNNG-OAK-6",
    "name": "Oakwood 6-Person Dining Table",
    "weight_lbs": 210.0,
    "freight_class": "100",
    "refurb_difficulty": "hard",
    "open_box_price_estimate_cents": 149900,
    "refurb_cost_estimate_cents": 22000,
    "current_stock": 1
  },
  "GYM-TRML-PRO": {
    "sku_code": "GYM-TRML-PRO",
    "name": "ProForm Commercial 2450 Treadmill",
    "weight_lbs": 315.0,
    "freight_class": "125",
    "refurb_difficulty": "not_feasible",
    "open_box_price_estimate_cents": 189900,
    "refurb_cost_estimate_cents": 0,
    "current_stock": 0
  }
}
```

---

## Freight Class Reference

The agent uses NMFC freight classes as sourced from the fixture. These are descriptive only — the agent does not compute freight class from dimensions. The fixture is the source of truth.

| Freight Class | Typical Weight Density | Example |
|---------------|------------------------|---------|
| 70 | > 30 lbs/cu ft | Dense machinery |
| 85 | 22.5–30 lbs/cu ft | Heavy furniture |
| 92.5 | 17.5–22.5 lbs/cu ft | Mid-weight furniture |
| 100 | 13.5–17.5 lbs/cu ft | Large tables |
| 125 | 12–13.5 lbs/cu ft | Large appliances |
| 150 | 9–12 lbs/cu ft | Outdoor furniture |
| 175 | 8–9 lbs/cu ft | Very bulky items |

---

## Acceptance Criteria

1. **Happy path — known SKU**: Given `sku_code: "SOF-3SEAT-GRY"` present in the fixture, the agent returns a fully populated `SkuProfileSchema` with correct values within 50ms.
2. **Refurb difficulty enum validation**: If the fixture has `refurb_difficulty: "easy"`, `"moderate"`, `"hard"`, or `"not_feasible"`, these pass through unchanged. Any other value defaults to `"moderate"`.
3. **Unknown SKU conservative defaults**: Given `sku_code: "unknown"`, the agent returns `refurb_difficulty: "not_feasible"`, `current_stock: 0`, and `open_box_price_estimate_cents: 0` — the most conservative possible values.
4. **Zero stock signal**: Given a fixture SKU with `current_stock: 0`, the Replacement Worker downstream will not attempt a replacement booking.
5. **Weight influences donate/dispose routing**: Given a SKU with `weight_lbs: 315.0`, the Donate/Dispose Worker will route to `dispose` (> 50 lbs). The weight value must pass through accurately.
6. **Open box economics accuracy**: The Decision Agent uses `open_box_price_estimate_cents - refurb_cost_estimate_cents` in its economics calculation. Verify these integers are exact (no floating-point rounding).
7. **Missing fixture file graceful degradation**: If `fixtures/skus.json` does not exist, the agent returns conservative defaults for every call without crashing.
8. **Fixture test without live API**: The test in `/evals/sku-profile/` loads a stub fixture and asserts the schema output.
9. **Freight class is a string**: `freight_class` must be a string (e.g., `"85"`), not a number. The Decision Agent formats this in logs and UI as a string.
10. **Name field preserved**: The `name` field is returned verbatim from the fixture for display in the UI and customer comms.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| `sku_code` is `"unknown"` | Return conservative defaults |
| `sku_code` not in fixture | Return conservative defaults, log warning |
| `weight_lbs` is `0` or negative | Default to `50.0` (median freight item weight) |
| `refurb_cost_estimate_cents > open_box_price_estimate_cents` | Allow it — this is valid and the Decision Agent will correctly calculate negative refurb economics |
| `current_stock` is negative | Clamp to `0` |
| Fixture missing `freight_class` | Default to `"100"` (common mid-range class) |
| `refurb_difficulty` is `null` in fixture | Coerce to `"moderate"` |
| `fixtures/skus.json` is malformed JSON | Log error, serve conservative defaults for all calls |
| SKU has extra fields in fixture (e.g., `dimensions`, `color`) | Ignore — extract only schema-defined keys |

---

## Cost Target

**$0.00 per call.** No LLM is invoked. Dictionary lookup in memory. Fixture loading is a one-time I/O cost at service startup.

---

## Fallback

If the SKU is not found in the fixture, return conservative defaults that prevent incorrect routing:

```python
{
    "sku_code": sku_code,
    "name": f"Unknown SKU: {sku_code}",
    "weight_lbs": 50.0,
    "freight_class": "100",
    "refurb_difficulty": "not_feasible",
    "open_box_price_estimate_cents": 0,
    "refurb_cost_estimate_cents": 0,
    "current_stock": 0
}
```

Conservative defaults rationale:
- `refurb_difficulty: "not_feasible"` prevents incorrect refurb routing for unknown items.
- `open_box_price_estimate_cents: 0` means refurb economics will be negative (net loss), biasing toward dispose.
- `current_stock: 0` prevents replacement routing for unknown items.
- `weight_lbs: 50.0` is the median boundary for donate-vs-dispose — the Donate/Dispose Worker threshold is exactly 50 lbs, so this will trigger the weight check.

---

## Braintrust Span

**Span name**: `backhaul.sku_profile_agent`

**Attributes to log**:
| Attribute | Value |
|-----------|-------|
| `sku_code` | from intake |
| `found_in_fixture` | `true \| false` |
| `sku_name` | from result |
| `weight_lbs` | from result |
| `freight_class` | from result |
| `refurb_difficulty` | from result |
| `open_box_price_estimate_cents` | from result |
| `refurb_cost_estimate_cents` | from result |
| `current_stock` | from result |
| `latency_ms` | wall-clock time for lookup |
| `fallback_used` | `true \| false` |
