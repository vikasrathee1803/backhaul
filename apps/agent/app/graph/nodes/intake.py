import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import anthropic

from ..state import BackhaulState, GraphEvent, ReturnIntakeSchema

# Try to load prompt from versioned file, fall back to inline
_PROMPT_PATH = Path(__file__).parents[4] / "prompts" / "intake_v1.md"

_SYSTEM_PROMPT = """You parse furniture and appliance return requests into structured JSON.

Extract these fields from the text:
- return_id: the return identifier
- marketplace: one of wayfair|amazon_fba|amazon_fbm|houzz|overstock|shopify
- return_reason: one of damage_in_transit|defective|wrong_item|buyer_remorse|missing_parts|not_as_described|fraud_suspected
- condition: one of new|like_new|good|fair|poor|damaged
- condition_notes: customer's description of condition (preserve original wording)
- order_total_cents: integer cents
- inbound_freight_cost_cents: integer cents for return shipping
- sku_code: product SKU
- customer_id: customer identifier

Rules:
- If a field cannot be determined: order_total_cents=0, inbound_freight_cost_cents=0, condition_notes=full text
- Output ONLY valid JSON, no explanation."""


def _get_system_prompt() -> str:
    if _PROMPT_PATH.exists():
        return _PROMPT_PATH.read_text(encoding="utf-8")
    return _SYSTEM_PROMPT


def _parse_intake_response(
    raw: str, return_id: str, marketplace: str, raw_text: str
) -> ReturnIntakeSchema:
    """Parse LLM response into ReturnIntakeSchema. Falls back to defaults on any error."""
    try:
        text = raw.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            lines = text.split("\n")
            # Remove opening fence line and closing fence line
            inner = "\n".join(lines[1:])
            if "```" in inner:
                inner = inner[: inner.rfind("```")]
            text = inner.strip()
        data = json.loads(text)
        return ReturnIntakeSchema(
            return_id=str(data.get("return_id", return_id)),
            marketplace=data.get("marketplace", marketplace),
            return_reason=str(data.get("return_reason", "buyer_remorse")),
            condition=str(data.get("condition", "fair")),
            condition_notes=str(data.get("condition_notes", raw_text)),
            order_total_cents=int(data.get("order_total_cents", 0)),
            inbound_freight_cost_cents=int(data.get("inbound_freight_cost_cents", 0)),
            sku_code=str(data.get("sku_code", "")),
            customer_id=str(data.get("customer_id", "")),
        )
    except Exception:
        return _build_fallback_intake(return_id, marketplace, raw_text)


def _build_fallback_intake(
    return_id: str, marketplace: str, raw_text: str
) -> ReturnIntakeSchema:
    return ReturnIntakeSchema(
        return_id=return_id,
        marketplace=marketplace,
        return_reason="buyer_remorse",
        condition="fair",
        condition_notes=raw_text,
        order_total_cents=0,
        inbound_freight_cost_cents=0,
        sku_code="",
        customer_id="",
    )


def intake_agent(state: BackhaulState) -> dict:
    node_name = "intake_agent"
    new_events: list[GraphEvent] = []
    t0 = time.monotonic()
    new_events.append(
        GraphEvent(
            run_id=state["run_id"],
            event_type="node_started",
            node_name=node_name,
            timestamp=datetime.now(timezone.utc).isoformat(),
            data={},
            cost_delta_usd=0.0,
            total_cost_usd=0.0,
        )
    )

    return_id = state["return_id"]
    marketplace = state["marketplace"]
    raw_text = state.get("raw_return_text", "")

    try:
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        cost_delta = 0.0

        if api_key and api_key not in ("sk-ant-test", "sk-placeholder"):
            client = anthropic.Anthropic(api_key=api_key)
            user_content = (
                raw_text
                or f"Return ID: {return_id}, Marketplace: {marketplace}"
            )
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=512,
                system=_get_system_prompt(),
                messages=[{"role": "user", "content": user_content}],
            )
            raw_output = response.content[0].text
            intake = _parse_intake_response(raw_output, return_id, marketplace, raw_text)
            # Haiku pricing: $0.80/M input, $4.00/M output (tokens)
            cost_delta = (
                response.usage.input_tokens * 0.80
                + response.usage.output_tokens * 4.00
            ) / 1_000_000
        else:
            # No live API key — use fallback without calling the model
            intake = _build_fallback_intake(return_id, marketplace, raw_text)
            cost_delta = 0.0

        # Ensure return_id and marketplace are always authoritative from state
        intake["return_id"] = return_id
        intake["marketplace"] = marketplace

        elapsed_ms = int((time.monotonic() - t0) * 1000)
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={
                    "latency_ms": elapsed_ms,
                    "return_reason": intake["return_reason"],
                },
                cost_delta_usd=cost_delta,
                total_cost_usd=state.get("total_cost_usd", 0.0) + cost_delta,
            )
        )
        return {"intake": intake, "events": new_events, "total_cost_usd": cost_delta}

    except Exception as e:
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_failed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"error": str(e)},
                cost_delta_usd=0.0,
                total_cost_usd=0.0,
            )
        )
        # Still return a valid intake from available state so downstream agents can run
        fallback = _build_fallback_intake(return_id, marketplace, raw_text)
        return {
            "intake": fallback,
            "errors": {node_name: str(e)},
            "events": new_events,
            "total_cost_usd": 0.0,
        }
