# Intake Agent — Agent Spec

## Role
Parses a raw, unstructured return request text into the structured `ReturnIntakeSchema`, serving as the entry point for every return in the Backhaul graph.

---

## Input Contract

| Key | Type | Source | Description |
|-----|------|--------|-------------|
| `raw_return_text` | `str` | `BackhaulState` | The raw, unstructured text describing the return (customer message, ops note, or API payload). |
| `return_id` | `str` | `BackhaulState` | Pre-populated return identifier (may also exist in the text). |
| `marketplace` | `Marketplace` | `BackhaulState` | The channel this return came from (used as fallback if not parseable from text). |

The agent reads `state["raw_return_text"]`, `state["return_id"]`, and `state["marketplace"]`.

---

## Output Contract

Writes `state["intake"]` as `ReturnIntakeSchema`:

| Key | Type | Description |
|-----|------|-------------|
| `return_id` | `str` | Return identifier (from text or state fallback) |
| `marketplace` | `Marketplace` | `wayfair \| amazon_fba \| amazon_fbm \| houzz \| overstock \| shopify` |
| `return_reason` | `str` | `damage_in_transit \| defective \| wrong_item \| buyer_remorse \| missing_parts \| not_as_described \| fraud_suspected` |
| `condition` | `str` | `new \| like_new \| good \| fair \| poor \| damaged` |
| `condition_notes` | `str` | Customer's own description of item condition (preserve verbatim where possible) |
| `order_total_cents` | `int` | Order total in integer cents |
| `inbound_freight_cost_cents` | `int` | Estimated or stated inbound return freight cost in cents |
| `sku_code` | `str` | Product SKU code |
| `customer_id` | `str` | Customer identifier |

---

## Model

**`claude-haiku-4-5-20251001`** — Fast, cheap extraction. This agent does not reason about the return; it only parses and classifies. Haiku is sufficient and keeps cost below $0.001 per call.

---

## Processing Logic

1. **Read inputs** from `state["raw_return_text"]`, `state["return_id"]`, `state["marketplace"]`.
2. **Build the prompt** by injecting `raw_return_text` into the system prompt template loaded from `prompts/intake_v1.md`.
3. **Call claude-haiku-4-5-20251001** with `max_tokens=512`. The response is expected to be a single JSON object.
4. **Parse the JSON response.** Use `json.loads()` inside a try/except.
5. **Validate the parsed object** against `ReturnIntakeSchema`:
   - `marketplace` must be one of the six valid values; default to `state["marketplace"]` if invalid.
   - `return_reason` must be one of the seven valid values; default to `"not_as_described"` if invalid.
   - `condition` must be one of the six valid values; default to `"fair"` if invalid.
   - `order_total_cents` must be a non-negative integer; default to `0` if missing or invalid.
   - `inbound_freight_cost_cents` must be a non-negative integer; default to `0` if missing.
   - `sku_code` and `customer_id` must be non-empty strings; default to `"unknown"` if missing.
6. **Merge with state defaults**: if `return_id` is missing from parsed output, use `state["return_id"]`.
7. **Write** the validated `ReturnIntakeSchema` to `state["intake"]`.
8. **Log Braintrust span** with input tokens, output tokens, cost, latency, and parsed fields.

---

## Prompt Strategy

The system prompt (see `prompts/intake_v1.md`) is a strict extraction prompt that:
- States the exact 9 fields to extract with their types and valid enum values.
- Provides inference rules for ambiguous inputs (e.g., "arrived broken" → `damage_in_transit`).
- Provides condition inference rules (e.g., "scratched" → `poor`, "like new" → `like_new`).
- Provides dollar-to-cents conversion instructions.
- Instructs the model to output **only valid JSON** — no markdown, no explanation, no preamble.
- Includes 2 worked examples (one simple, one ambiguous) in the prompt.

Context injected into the user message:
```
Return text: <raw_return_text>
Known return ID: <return_id>
Known marketplace: <marketplace>
```

Output format: single JSON object matching `ReturnIntakeSchema`.

---

## JSON Output Schema

```json
{
  "return_id": "string",
  "marketplace": "wayfair | amazon_fba | amazon_fbm | houzz | overstock | shopify",
  "return_reason": "damage_in_transit | defective | wrong_item | buyer_remorse | missing_parts | not_as_described | fraud_suspected",
  "condition": "new | like_new | good | fair | poor | damaged",
  "condition_notes": "string (preserve customer's original wording)",
  "order_total_cents": "integer >= 0",
  "inbound_freight_cost_cents": "integer >= 0",
  "sku_code": "string",
  "customer_id": "string"
}
```

---

## Acceptance Criteria

1. **Happy path — complete text**: Given a fully detailed return text containing all 9 fields, the agent returns a `ReturnIntakeSchema` with all 9 fields correctly extracted within 3 seconds.
2. **Return reason inference**: Given "the couch arrived with the leg completely broken off and the fabric torn," the agent classifies `return_reason` as `damage_in_transit` and `condition` as `damaged`.
3. **Buyer remorse inference**: Given "I changed my mind, the color doesn't match my room, otherwise it's fine," the agent classifies `return_reason` as `buyer_remorse` and `condition` as `like_new` or `good`.
4. **Dollar-to-cents conversion**: Given "Order total: $1,299.00, freight: $184.50," the agent returns `order_total_cents: 129900` and `inbound_freight_cost_cents: 18450`.
5. **Fallback on LLM failure**: If the LLM call raises an exception, the agent returns a valid `ReturnIntakeSchema` populated from `state["return_id"]`, `state["marketplace"]`, and safe defaults — the graph does not crash.
6. **Invalid enum coercion**: If the LLM returns `"marketplace": "amazon"` (not a valid enum), the agent coerces to `state["marketplace"]` and logs a warning. The output is still a valid schema.
7. **Missing freight cost**: If the text contains no freight cost information, `inbound_freight_cost_cents` defaults to `0` and the agent does not error.
8. **Condition notes preservation**: The `condition_notes` field preserves the customer's verbatim language, not a paraphrase.
9. **Fixture test passes without live API**: The fixture test in `/evals/intake/` uses a pre-recorded LLM response and passes in CI without calling the Anthropic API.
10. **Cost guard**: Total cost per call stays below $0.001 at typical input lengths (< 500 tokens).

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| `raw_return_text` is empty string | Fall back to state defaults immediately without calling LLM |
| LLM returns malformed JSON (e.g., truncated) | Catch `json.JSONDecodeError`, attempt partial extraction via regex for `return_id`, fall back to defaults for remaining fields |
| LLM returns JSON with extra fields | Ignore extra fields; only extract known keys |
| `return_reason` value not in enum | Default to `"not_as_described"`, log warning |
| `condition` value not in enum | Default to `"fair"`, log warning |
| `order_total_cents` is negative | Clamp to `0`, log warning |
| `marketplace` in text conflicts with `state["marketplace"]` | Prefer `state["marketplace"]` (it is the authoritative channel context) |
| Text is in a language other than English | Attempt extraction anyway; haiku handles multilingual input. If extraction fails entirely, use fallback |
| SKU code not found in text | Set `sku_code: "unknown"` — downstream SKU Profile Agent handles the unknown-SKU case |
| Customer ID not found in text | Set `customer_id: "unknown"` — downstream Customer History Agent handles the unknown-customer case |

---

## Cost Target

| Item | Estimate |
|------|----------|
| Input tokens (system prompt + return text) | ~600 tokens |
| Output tokens (JSON object) | ~120 tokens |
| Model rate (haiku) | $0.80 / 1M input, $4.00 / 1M output |
| **Estimated cost per call** | **~$0.00048 + $0.00048 = ~$0.001** |
| **Monthly cost at 1,000 returns/day** | **~$30** |

This is well within the $0.10-per-graph-run budget.

---

## Fallback

If the LLM call fails for any reason (network error, timeout, invalid JSON, rate limit), the agent constructs a `ReturnIntakeSchema` using:
- `return_id`: from `state["return_id"]`
- `marketplace`: from `state["marketplace"]`
- `return_reason`: `"not_as_described"` (conservative default)
- `condition`: `"fair"` (conservative default)
- `condition_notes`: `state.get("raw_return_text", "")[:500]` (raw text truncated)
- `order_total_cents`: `0`
- `inbound_freight_cost_cents`: `0`
- `sku_code`: `"unknown"`
- `customer_id`: `"unknown"`

The fallback is logged to the audit trail with `fallback_reason: "intake_llm_failure"`.

---

## Braintrust Span

**Span name**: `backhaul.intake_agent`

**Attributes to log**:
| Attribute | Value |
|-----------|-------|
| `return_id` | from state |
| `marketplace` | from parsed intake |
| `return_reason` | from parsed intake |
| `condition` | from parsed intake |
| `input_tokens` | from LLM response usage |
| `output_tokens` | from LLM response usage |
| `cost_usd` | computed from token counts |
| `latency_ms` | wall-clock time for LLM call |
| `model` | `claude-haiku-4-5-20251001` |
| `prompt_version` | `intake_v1` |
| `fallback_used` | `true \| false` |
| `parse_error` | error message if JSON parse failed |
