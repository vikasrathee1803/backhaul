# Marketplace Policy Agent — Agent Spec

## Role
Loads the channel-specific return policy from the YAML configuration file for the originating marketplace, populating `MarketplacePolicySchema` so that downstream agents — especially the Decision Agent — can apply the correct freight subsidy, damage allowance, restocking fee, and decisioning window for each return.

---

## Input Contract

| Key | Type | Source | Description |
|-----|------|--------|-------------|
| `intake` | `ReturnIntakeSchema` | `BackhaulState` | The structured intake object. Reads `intake["marketplace"]`. |

---

## Output Contract

Writes `state["marketplace_policy"]` as `MarketplacePolicySchema`:

| Key | Type | Description |
|-----|------|-------------|
| `marketplace` | `Marketplace` | The marketplace identifier |
| `return_window_days` | `int` | Number of days from delivery within which a return is accepted |
| `freight_subsidy_pct` | `float` | Fraction of inbound freight cost reimbursed by the marketplace (0.0–1.0) |
| `damage_allowance_pct` | `float` | Fraction of order total the marketplace will accept as damage claim (0.0–1.0) |
| `restocking_fee_pct` | `float` | Restocking fee charged to customer as fraction of order total (0.0–1.0) |
| `decisioning_window_days` | `int` | Number of days after return receipt within which the seller must issue a decision |
| `auto_decide_ceiling_cents` | `int` | Order total threshold above which human review is always required, regardless of agent confidence |

---

## Model

**No LLM — YAML file loading.** Marketplace policies are deterministic business rules maintained in YAML configuration files. No AI inference is appropriate here — policy accuracy is a hard correctness requirement, not a probabilistic one.

---

## Policy Configurations

Policies are stored in `config/marketplaces/<marketplace>.yaml`. One file per marketplace:

| Marketplace | File |
|-------------|------|
| `wayfair` | `config/marketplaces/wayfair.yaml` |
| `amazon_fba` | `config/marketplaces/amazon_fba.yaml` |
| `amazon_fbm` | `config/marketplaces/amazon_fbm.yaml` |
| `houzz` | `config/marketplaces/houzz.yaml` |
| `overstock` | `config/marketplaces/overstock.yaml` |
| `shopify` | `config/marketplaces/shopify.yaml` |

### Policy Reference Table

| Marketplace | Return Window | Freight Subsidy | Damage Allowance | Restocking Fee | Decision Window | Auto-Decide Ceiling |
|-------------|--------------|-----------------|------------------|----------------|-----------------|---------------------|
| Wayfair | 30 days | 75% | 15% | 0% | 5 days | $1,500 |
| Amazon FBA | 30 days | 100% | 20% | 0% | 2 days | $1,500 |
| Amazon FBM | 30 days | 50% | 10% | 0% | 3 days | $1,500 |
| Houzz | 45 days | 80% | 20% | 0% | 7 days | $2,000 |
| Overstock | 30 days | 60% | 25% | 15% | 5 days | $1,000 |
| Shopify D2C | 60 days | 0% | 30% | 0% | 10 days | $3,000 |

### Sample YAML File (`config/marketplaces/wayfair.yaml`)

```yaml
marketplace: wayfair
return_window_days: 30
freight_subsidy_pct: 0.75
damage_allowance_pct: 0.15
restocking_fee_pct: 0.00
decisioning_window_days: 5
auto_decide_ceiling_cents: 150000
notes: >
  Wayfair CastleGate sellers receive enhanced freight support.
  Damage claims must be filed within 5 business days of return receipt.
  Large item (LTL) returns require Wayfair-approved carrier.
```

---

## Processing Logic

1. **Read** `marketplace = state["intake"]["marketplace"]`.
2. **Resolve** the YAML file path: `config/marketplaces/{marketplace}.yaml`.
3. **Load and parse** the YAML file using `yaml.safe_load()`. YAML files are loaded at service startup and cached to avoid repeated disk I/O.
4. **Validate** all required keys are present in the parsed YAML:
   - `return_window_days` — positive integer
   - `freight_subsidy_pct` — float 0.0–1.0
   - `damage_allowance_pct` — float 0.0–1.0
   - `restocking_fee_pct` — float 0.0–1.0
   - `decisioning_window_days` — positive integer
   - `auto_decide_ceiling_cents` — positive integer
5. **If any key is missing**, apply the conservative default for that key (see Fallback).
6. **Write** the populated `MarketplacePolicySchema` to `state["marketplace_policy"]`.
7. **Log** the marketplace and the policy values loaded.

---

## Acceptance Criteria

1. **Wayfair policy loads correctly**: Given `marketplace: "wayfair"`, the agent returns `freight_subsidy_pct: 0.75`, `return_window_days: 30`, `restocking_fee_pct: 0.0`.
2. **Amazon FBA policy loads correctly**: Given `marketplace: "amazon_fba"`, the agent returns `freight_subsidy_pct: 1.0` (full subsidy).
3. **Overstock restocking fee**: Given `marketplace: "overstock"`, the agent returns `restocking_fee_pct: 0.15`.
4. **Shopify D2C no freight subsidy**: Given `marketplace: "shopify"`, the agent returns `freight_subsidy_pct: 0.0`.
5. **Missing YAML fallback**: If `config/marketplaces/houzz.yaml` is deleted, the agent returns conservative defaults without crashing.
6. **Policy is isolated to YAML**: No hardcoded policy values exist in agent code. Changing `wayfair.yaml` must be the only change needed to update Wayfair policy.
7. **Adding a marketplace requires only a YAML file**: A new marketplace file `config/marketplaces/wayfair_b2b.yaml` is automatically discoverable if the marketplace enum is extended — no agent code changes required.
8. **Cache behavior**: The YAML file for a given marketplace is not re-read from disk on every call. Loaded once per service instance.
9. **auto_decide_ceiling_cents accuracy**: Given `auto_decide_ceiling_cents: 150000`, the Decision Agent correctly flags any return with `order_total_cents > 150000` for escalation review.
10. **Fixture test passes without live API**: The test in `/evals/marketplace-policy/` verifies all 6 marketplace YAMLs load and return correct schema values.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| YAML file missing for the marketplace | Return conservative defaults, log error |
| YAML file exists but is empty | Return conservative defaults |
| YAML file has malformed YAML syntax | Catch `yaml.YAMLError`, return conservative defaults, log error |
| `freight_subsidy_pct > 1.0` in YAML | Clamp to `1.0` — cannot exceed 100% subsidy |
| `freight_subsidy_pct < 0.0` in YAML | Clamp to `0.0` |
| `return_window_days` is negative | Default to `30` |
| `auto_decide_ceiling_cents` is `0` | Treat as `0` — means every return requires human review (unusual but valid) |
| `marketplace` value not a recognized enum | Log error, use conservative defaults (cannot load YAML if file name is unknown) |
| YAML has extra keys (e.g., `notes`, `sla_notes`) | Ignore — only extract schema-defined keys |

---

## Cost Target

**$0.00 per call.** No LLM is invoked. YAML parsing is a one-time cost at service startup; subsequent calls use the in-memory cache.

---

## Fallback

If the YAML file is missing, malformed, or a key is absent, apply conservative defaults:

```python
{
    "marketplace": marketplace,
    "return_window_days": 30,
    "freight_subsidy_pct": 0.0,      # Worst case: seller bears all freight
    "damage_allowance_pct": 0.0,     # Worst case: no damage allowance
    "restocking_fee_pct": 0.0,       # Benefit of doubt: no restocking fee
    "decisioning_window_days": 3,    # Tight window to be safe
    "auto_decide_ceiling_cents": 100000  # $1,000 ceiling — conservative
}
```

Conservative default rationale: `freight_subsidy_pct: 0.0` ensures the Decision Agent does not over-index refurb economics (net value will be lower than it actually is). This biases toward conservative decisions (escalate rather than auto-approve) which is the safer failure mode.

---

## Braintrust Span

**Span name**: `backhaul.marketplace_policy_agent`

**Attributes to log**:
| Attribute | Value |
|-----------|-------|
| `marketplace` | from intake |
| `yaml_file_path` | resolved file path |
| `yaml_found` | `true \| false` |
| `return_window_days` | from result |
| `freight_subsidy_pct` | from result |
| `damage_allowance_pct` | from result |
| `restocking_fee_pct` | from result |
| `decisioning_window_days` | from result |
| `auto_decide_ceiling_cents` | from result |
| `latency_ms` | wall-clock time |
| `fallback_used` | `true \| false` |
