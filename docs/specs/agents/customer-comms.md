# Customer Comms Agent — Agent Spec

## Role
Drafts a concise, channel-appropriate customer-facing message for every return decision, using `claude-haiku-4-5-20251001` to generate tone-matched communication that explains the outcome without exposing internal decision logic, agent names, or cost calculations.

---

## Input Contract

| Key | Type | Source | Description |
|-----|------|--------|-------------|
| `intake` | `ReturnIntakeSchema` | `BackhaulState` | Reads `return_id`, `marketplace`, `return_reason`, `sku_code`, `customer_id`. |
| `decision` | `DispositionDecisionSchema` | `BackhaulState` | Reads `disposition`. |
| `damage_signal` | `DamageSignalSchema` | `BackhaulState` | Reads `damage_severity` (influences tone). |
| `sku_profile` | `SkuProfileSchema` | `BackhaulState` | Reads `name` (for personalized product reference). |
| `worker_result` | `WorkerResultSchema` | `BackhaulState` | Reads `status` and `notes` for any relevant action details (e.g., refund amount, pickup date). |

---

## Output Contract

Writes `state["comms_draft"]` as `CommsDraftSchema`:

| Key | Type | Description |
|-----|------|-------------|
| `channel` | `Marketplace` | The channel this draft is for (matches `intake["marketplace"]`) |
| `draft_text` | `str` | The drafted customer-facing message (2–4 sentences) |
| `tone` | `str` | `"empathetic" \| "neutral" \| "formal"` |

---

## Model

**`claude-haiku-4-5-20251001`** — Communication drafting is a straightforward text generation task. Haiku produces natural, fluent messages and costs under $0.001 per call. The quality bar is "sounds human and correct," not "complex reasoning."

---

## Tone Selection Rules

Tone is determined by `return_reason` and `disposition`:

| Return Reason | Disposition | Tone |
|---------------|-------------|------|
| `damage_in_transit` | any | `empathetic` |
| `defective` | any | `empathetic` |
| `missing_parts` | any | `empathetic` |
| `wrong_item` | any | `neutral` |
| `buyer_remorse` | any | `neutral` |
| `not_as_described` | any | `neutral` |
| `fraud_suspected` | any | `formal` |
| any | `escalate` | `formal` |
| any | `dispose` | `neutral` |
| any | `donate` | `neutral` |

Priority: `return_reason` takes precedence over `disposition` for tone selection, except when `disposition == "escalate"` or `return_reason == "fraud_suspected"` — those always use `formal`.

---

## Processing Logic

1. **Read** all required inputs from state.
2. **Determine tone** using the rules above.
3. **Extract relevant action details** from `worker_result["notes"]` (e.g., refund confirmation, replacement order ID, pickup date). Parse only — do not fabricate details not present in `worker_result`.
4. **Build the prompt** by injecting all context into the system prompt template loaded from `prompts/customer_comms_v1.md`.
5. **Call claude-haiku-4-5-20251001** with `max_tokens=256`. The response is a plain-text message (not JSON).
6. **Post-process the response**:
   - Strip any leading/trailing whitespace.
   - Verify the response does not contain forbidden phrases (see Forbidden Content below).
   - Verify length is 1–6 sentences (split on `.`, `!`, `?`). If too short (< 1 sentence), use the fallback template.
7. **Write** the `CommsDraftSchema` to `state["comms_draft"]`.

---

## Forbidden Content

The agent and its post-processing must ensure the draft does NOT contain:
- Internal agent names (e.g., "Decision Agent", "Fraud Flag Agent")
- Cost figures or economics calculations (e.g., "the refurb cost estimate was $85")
- Confidence scores or probability language (e.g., "we are 82% confident")
- Disposition codes (e.g., "disposition: refurbish")
- Fraud score or fraud flag references
- Model names or AI references (e.g., "our AI system")
- Competitor names

If any forbidden phrase is detected in the LLM output, discard it and use the fallback template.

---

## Disposition-Specific Messaging Guidance

| Disposition | Key Message Points |
|-------------|-------------------|
| `refund` | Refund is being issued, expected timeline, any restocking fee context if applicable, apology for the trouble |
| `replace` | Replacement item is being shipped, expected ship date, apology |
| `repair` | Pickup is being scheduled, expected repair timeline, commitment to quality check before return |
| `refurbish` | Item is being processed, no customer action needed (internal disposition) |
| `donate` | Item will be donated on their behalf, confirmation of disposition (internal — may not need customer message) |
| `dispose` | Disposal confirmed, any refund that accompanies disposal (internal — may not need customer message) |
| `escalate` | A specialist is reviewing the return, expected response time, thank you for patience |

Note: For `refurbish`, `donate`, and `dispose`, the customer message focuses on confirming resolution (e.g., "your return has been received and processed") without detailing the internal routing.

---

## Prompt Strategy

The system prompt (see `prompts/customer_comms_v1.md`) provides:
- Tone definitions with examples for each level.
- Disposition-specific messaging guidance.
- Forbidden content list.
- Length constraint (2–4 sentences).
- Channel-aware guidance (marketplace-specific platform voice nuances).
- Multiple worked examples.

Context injected into the user message:
```
Channel: <marketplace>
Product: <sku_name>
Return reason: <return_reason>
Decision: <disposition>
Tone: <empathetic|neutral|formal>
Action taken: <worker_result notes if relevant>
```

---

## JSON Output Schema

The Comms Agent returns **plain text**, not JSON. The agent wrapper constructs the `CommsDraftSchema`:

```python
{
    "channel": intake["marketplace"],
    "draft_text": llm_response_text.strip(),
    "tone": determined_tone
}
```

---

## Acceptance Criteria

1. **Empathetic tone for damage**: Given `return_reason: "damage_in_transit"` and `disposition: "refund"`, the draft uses empathetic language (e.g., "We're so sorry...", "We sincerely apologize...").
2. **Neutral tone for wrong item**: Given `return_reason: "wrong_item"` and `disposition: "replace"`, the draft uses neutral, professional language.
3. **Formal tone for escalation**: Given `disposition: "escalate"`, the draft uses formal language and mentions a specialist review.
4. **No internal details**: The draft does not mention agent names, cost calculations, fraud scores, confidence values, or model names.
5. **Length 2–4 sentences**: The draft is between 2 and 4 sentences. Verify this with a sentence-count check.
6. **Refund mentions timeline**: Given `disposition: "refund"` and `worker_result.status: "simulated"`, the draft mentions the refund is being processed (does not expose "simulated" status to customer).
7. **Replacement mentions ship date**: Given `disposition: "replace"` and a ship date in `worker_result.notes`, the draft includes an estimated ship timeline.
8. **LLM failure fallback**: If the LLM call fails, the draft uses the fallback template — no empty `draft_text`.
9. **Forbidden content check**: Post-processing catches and rejects any draft containing the word "agent" or "AI".
10. **Fixture test**: The test in `/evals/customer-comms/` covers all 7 disposition types and 3 tone levels.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| `sku_profile.name` is "Unknown SKU: sku-xxx" | Replace with generic "your item" in the message |
| `worker_result` is missing (upstream worker failed) | Draft based on intake and decision only, no action-specific details |
| `disposition: "refurbish"` | Use generic resolution message — do not expose internal routing |
| `disposition: "donate"` | Use generic resolution message — customer does not need to know item was donated |
| LLM response contains forbidden phrase | Discard, use fallback template, log the violation |
| Marketplace is `houzz` | Tone may be slightly more formal overall (designer/trade channel) — prompt notes this |

---

## Cost Target

| Item | Estimate |
|------|----------|
| Input tokens (system prompt + context) | ~700 tokens |
| Output tokens (2–4 sentence draft) | ~80 tokens |
| Model rate (haiku) | $0.80 / 1M input, $4.00 / 1M output |
| **Estimated cost per call** | **~$0.00056 + $0.00032 = ~$0.00088** |

---

## Fallback

If the LLM call fails, or if the output fails the forbidden content check twice, use the disposition-specific template:

```python
FALLBACK_TEMPLATES = {
    "refund": "Thank you for your return request. Your refund is being processed and you will receive a confirmation shortly.",
    "replace": "Thank you for your return request. A replacement item is being arranged and we will send you shipping confirmation soon.",
    "repair": "Thank you for your return request. We are scheduling a pickup for your item and will follow up with details.",
    "refurbish": "Thank you for your return request. Your return has been received and is being processed.",
    "donate": "Thank you for your return request. Your return has been received and is being processed.",
    "dispose": "Thank you for your return request. Your return has been received and is being processed.",
    "escalate": "Thank you for your return request. A member of our returns team is reviewing your case and will be in touch within 2 business days."
}
```

---

## Braintrust Span

**Span name**: `backhaul.customer_comms_agent`

**Attributes to log**:
| Attribute | Value |
|-----------|-------|
| `return_id` | from state |
| `disposition` | from decision |
| `return_reason` | from intake |
| `tone` | determined tone |
| `draft_length_sentences` | sentence count of draft |
| `fallback_used` | `true \| false` |
| `forbidden_content_detected` | `true \| false` |
| `input_tokens` | from LLM response |
| `output_tokens` | from LLM response |
| `cost_usd` | computed |
| `latency_ms` | wall-clock time |
| `model` | `claude-haiku-4-5-20251001` |
| `prompt_version` | `customer_comms_v1` |
