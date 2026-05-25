# Damage Signal Agent — Agent Spec

## Role
Parses the customer's free-text condition notes into a structured damage assessment, classifying severity (none through total loss), identifying damaged components, and assessing repair feasibility — giving the Decision Agent the physical damage context it needs to route between refund, repair, refurbish, and dispose.

---

## Input Contract

| Key | Type | Source | Description |
|-----|------|--------|-------------|
| `intake` | `ReturnIntakeSchema` | `BackhaulState` | Reads `intake["condition_notes"]` (free-text damage description) and `intake["condition"]` (pre-classified condition enum). |

---

## Output Contract

Writes `state["damage_signal"]` as `DamageSignalSchema`:

| Key | Type | Description |
|-----|------|-------------|
| `has_damage` | `bool` | Whether any damage is present |
| `damage_severity` | `str` | `none \| cosmetic \| functional \| structural \| total_loss` |
| `damage_components` | `list[str]` | Specific named components that are damaged (e.g., `["left armrest", "frame", "motor"]`) |
| `repair_feasibility` | `str` | `feasible \| uncertain \| not_feasible` |
| `raw_signal` | `str` | The original condition notes text, preserved verbatim |

---

## Model

**`claude-haiku-4-5-20251001`** — Damage classification from free text is a natural language understanding task that benefits from LLM-based extraction. Haiku is sufficiently capable for damage classification and costs under $0.001 per call.

---

## Processing Logic

1. **Read** `condition_notes = state["intake"]["condition_notes"]` and `condition = state["intake"]["condition"]`.
2. **Short-circuit check**: If `condition_notes` is empty or blank AND `condition` is `"new"` or `"like_new"`, return the no-damage fallback immediately without calling the LLM (saves cost).
3. **Build the prompt** by injecting `condition_notes` and `condition` into the system prompt template loaded from `prompts/damage_signal_v1.md`.
4. **Call claude-haiku-4-5-20251001** with `max_tokens=384`. The response is expected to be a single JSON object.
5. **Parse the JSON response** using `json.loads()` inside a try/except.
6. **Validate** the parsed object:
   - `damage_severity` must be one of the five valid values. Default to `"cosmetic"` if the condition enum is `"poor"` or `"damaged"`, `"none"` otherwise.
   - `repair_feasibility` must be one of three valid values. Default to `"uncertain"` if invalid.
   - `damage_components` must be a list of strings. Default to `[]` if missing.
   - `has_damage` is derived: `True` if `damage_severity != "none"`.
7. **Preserve** `raw_signal = condition_notes` verbatim.
8. **Write** the validated `DamageSignalSchema` to `state["damage_signal"]`.
9. **Log Braintrust span** with classification result, confidence indicators, and cost.

---

## Severity Scale

| Severity | Definition | Examples |
|----------|-----------|---------|
| `none` | No visible or functional damage. Item appears as new or only shows normal wear. | "Everything looks perfect", "Slight packaging wear but item is fine" |
| `cosmetic` | Surface-level damage that does not affect function. Item works as intended. | "Scratch on the armrest", "Small dent on the side panel", "Scuff marks on legs" |
| `functional` | Damage that impairs intended use. Item may partially work but has a significant defect. | "Recliner mechanism is stuck", "One drawer won't close", "Motor makes grinding noise" |
| `structural` | Core structure is compromised. Item may be unsafe or non-functional. | "Frame is cracked", "Leg is snapped off", "Support beam is bent", "Main weld is broken" |
| `total_loss` | Item is completely destroyed, beyond any economical repair, or poses a safety risk. | "Completely crushed in transit", "Shattered glass panel", "Electrical fire damage", "Sofa completely saturated with water" |

---

## Repair Feasibility Scale

| Feasibility | Definition |
|-------------|-----------|
| `feasible` | Damage is clearly repairable with standard furniture/appliance repair processes. Estimated cost is likely reasonable relative to item value. |
| `uncertain` | Damage may be repairable, but further inspection is needed. Cost estimate has high variance. |
| `not_feasible` | Damage is beyond practical repair — structural integrity compromised, replacement parts unavailable, or repair cost would exceed item value. |

---

## Prompt Strategy

The system prompt (see `prompts/damage_signal_v1.md`) is a structured extraction prompt that:
- Defines all 5 severity levels with examples.
- Defines the 3 repair feasibility levels.
- Instructs the model to extract specific named components (not generic descriptions).
- Provides correlation guidance: `condition` enum anchors the severity assessment (e.g., if `condition: "damaged"`, severity should be `structural` or `total_loss`, not `cosmetic`).
- Instructs the model to output **only valid JSON** — no markdown, no explanation.
- Includes 5 worked examples (one per severity level).

Context injected into the user message:
```
Condition code: <condition>
Customer description: <condition_notes>
```

---

## JSON Output Schema

```json
{
  "has_damage": "boolean",
  "damage_severity": "none | cosmetic | functional | structural | total_loss",
  "damage_components": ["string", "..."],
  "repair_feasibility": "feasible | uncertain | not_feasible",
  "raw_signal": "string (original condition_notes verbatim)"
}
```

---

## Acceptance Criteria

1. **Cosmetic damage classification**: Given `condition_notes: "There's a scratch on the left armrest, maybe 3 inches long. The rest is perfect."`, the agent returns `damage_severity: "cosmetic"`, `has_damage: true`, `damage_components: ["left armrest"]`, `repair_feasibility: "feasible"`.
2. **Structural damage classification**: Given `condition_notes: "The frame is bent and one leg has completely snapped off at the weld. I wouldn't sit on this."`, the agent returns `damage_severity: "structural"`, `has_damage: true`, `repair_feasibility: "uncertain"` or `"not_feasible"`.
3. **No damage short-circuit**: Given `condition: "like_new"`, `condition_notes: ""`, the agent returns the no-damage fallback without calling the LLM.
4. **Component extraction**: Given `condition_notes: "The back right leg is cracked, the seat cushion has a tear, and the armrest fabric is stained."`, `damage_components` contains `["back right leg", "seat cushion", "armrest fabric"]` (or equivalent).
5. **Total loss classification**: Given `condition_notes: "The whole thing was crushed by the forklift. It's completely destroyed."`, the agent returns `damage_severity: "total_loss"`, `repair_feasibility: "not_feasible"`.
6. **Functional damage classification**: Given `condition_notes: "The power recliner motor doesn't work. The rest of the sofa looks fine."`, the agent returns `damage_severity: "functional"`, `repair_feasibility: "feasible"` or `"uncertain"`.
7. **LLM failure fallback**: If the LLM call raises an exception, the agent returns the no-damage fallback without crashing the graph.
8. **Raw signal preserved**: `raw_signal` exactly equals `condition_notes` from the intake — not a paraphrase or summary.
9. **Cost guard**: Total cost per call stays below $0.001.
10. **Fixture test passes without live API**: The test in `/evals/damage-signal/` uses pre-recorded LLM responses and passes in CI.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| `condition_notes` is empty, `condition` is `"damaged"` | Call LLM with minimal context; if LLM returns low-confidence result, default to `damage_severity: "functional"`, `repair_feasibility: "uncertain"` |
| `condition` and `condition_notes` conflict (notes say "perfect", condition says "damaged") | Trust `condition_notes` for severity classification; note the conflict in `raw_signal` |
| Very long condition notes (> 1,000 chars) | Truncate to 800 chars before LLM call to control token cost. Log truncation. |
| Notes describe multiple items (return includes multiple SKUs) | Extract damage for the primary item; note the presence of multi-item language |
| Notes are in a language other than English | Attempt extraction; Haiku handles multilingual input. Fall back to condition-based defaults if parse fails. |
| LLM returns `damage_components` as a string instead of list | Coerce to a single-element list |
| `repair_feasibility` missing from LLM output | Default to `"uncertain"` |
| `damage_severity` is `"none"` but `condition` is `"damaged"` | Upgrade severity to `"cosmetic"` minimum — the condition enum is a hard anchor |

---

## Cost Target

| Item | Estimate |
|------|----------|
| Input tokens (system prompt + condition notes) | ~500 tokens |
| Output tokens (JSON object) | ~80 tokens |
| Model rate (haiku) | $0.80 / 1M input, $4.00 / 1M output |
| **Estimated cost per call** | **~$0.00040 + $0.00032 = ~$0.00072** |
| **Short-circuit calls (no LLM)** | **$0.00** |

---

## Fallback

If the LLM call fails, or if `condition_notes` is empty and `condition` is `"new"` or `"like_new"`:

```python
{
    "has_damage": False,
    "damage_severity": "none",
    "damage_components": [],
    "repair_feasibility": "feasible",
    "raw_signal": condition_notes or ""
}
```

If `condition` is `"poor"` or `"damaged"` and the LLM call fails, use a more informative fallback:

```python
{
    "has_damage": True,
    "damage_severity": "functional",  # conservative non-trivial default
    "damage_components": [],
    "repair_feasibility": "uncertain",
    "raw_signal": condition_notes or ""
}
```

---

## Braintrust Span

**Span name**: `backhaul.damage_signal_agent`

**Attributes to log**:
| Attribute | Value |
|-----------|-------|
| `return_id` | from state |
| `condition_input` | intake condition enum |
| `has_damage` | from result |
| `damage_severity` | from result |
| `damage_components` | from result (as list) |
| `repair_feasibility` | from result |
| `input_tokens` | from LLM response usage |
| `output_tokens` | from LLM response usage |
| `cost_usd` | computed from token counts |
| `latency_ms` | wall-clock time for LLM call |
| `model` | `claude-haiku-4-5-20251001` |
| `prompt_version` | `damage_signal_v1` |
| `short_circuit` | `true` if LLM was not called |
| `fallback_used` | `true \| false` |
