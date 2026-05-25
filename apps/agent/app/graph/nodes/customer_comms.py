"""
Customer Comms Agent — drafts channel-appropriate customer communication.
Uses claude-haiku-4-5-20251001 for cost-effective message generation,
with a template-based fallback when no live API key is configured.
"""
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import anthropic

from ..state import BackhaulState, CommsDraftSchema, GraphEvent

_PROMPT_PATH = Path(__file__).parents[4] / "prompts" / "customer_comms_v1.md"

_SYSTEM_PROMPT_TEMPLATE = (
    "You draft customer communication for furniture and appliance returns. "
    "Write 2-4 sentences for the customer about their return resolution. "
    "Be {tone}. Reference the specific outcome. "
    "Do NOT mention agent names, system details, or costs. "
    "Output message text only."
)

_FALLBACK_TEMPLATES: dict[str, str] = {
    "refund": (
        "We have processed your return and issued a full refund to your original payment method. "
        "Please allow 5-7 business days for the credit to appear on your statement. "
        "We appreciate your patience and apologize for any inconvenience."
    ),
    "replace": (
        "Great news — we are sending you a replacement item right away. "
        "You will receive a shipping confirmation with tracking details within 24 hours. "
        "Thank you for giving us the opportunity to make this right."
    ),
    "repair": (
        "We have scheduled a repair service for your item. "
        "Our logistics team will be in touch within 1 business day to arrange a convenient pickup window. "
        "We appreciate your patience while we get this resolved for you."
    ),
    "refurbish": (
        "Thank you for returning your item. We have received it and our team is processing your return. "
        "A full refund will be issued to your original payment method once our inspection is complete. "
        "You can expect this within 5-7 business days."
    ),
    "donate": (
        "Thank you for your return. We have arranged for your item to be donated locally, "
        "and your account has been credited accordingly. "
        "We appreciate your understanding and are glad the item will find a new home."
    ),
    "dispose": (
        "Thank you for your return. We have arranged for responsible disposal of your item, "
        "and your refund has been processed to your original payment method. "
        "Please allow 5-7 business days for the credit to appear."
    ),
    "escalate": (
        "Thank you for contacting us regarding your return. "
        "A member of our customer care team will personally review your case "
        "and reach out to you within 1 business day with a resolution."
    ),
}


def _determine_tone(return_reason: str, disposition: str) -> str:
    """
    Determine the appropriate communication tone based on return reason and disposition.
    Exported for testing.
    """
    if return_reason in ("damage_in_transit", "defective", "missing_parts"):
        return "empathetic"
    if return_reason == "wrong_item":
        return "neutral"
    if return_reason == "fraud_suspected" or disposition == "escalate":
        return "formal"
    return "neutral"


def _build_fallback_comms(
    return_id: str, disposition: str, marketplace: str
) -> CommsDraftSchema:
    """
    Build a template-based comms draft when the LLM is unavailable.
    Exported for testing.
    """
    draft_text = _FALLBACK_TEMPLATES.get(disposition, _FALLBACK_TEMPLATES["escalate"])
    tone = "neutral"
    return CommsDraftSchema(
        channel=marketplace,
        draft_text=draft_text,
        tone=tone,
    )


def customer_comms_agent(state: BackhaulState) -> dict:
    node_name = "customer_comms_agent"
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
    try:
        decision = state.get("decision") or {}
        intake = state.get("intake") or {}
        sku_profile = state.get("sku_profile") or {}

        disposition = decision.get("disposition", "escalate")
        marketplace = intake.get("marketplace", state.get("marketplace", "wayfair"))
        return_id = intake.get("return_id", state.get("return_id", "unknown"))
        return_reason = intake.get("return_reason", "")
        sku_name = sku_profile.get("name", "your item")

        tone = _determine_tone(return_reason, disposition)

        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        cost_delta = 0.0
        draft_text: str = ""

        if api_key and api_key not in ("sk-ant-test", "sk-placeholder", ""):
            # Dynamically build system prompt with tone injected
            if _PROMPT_PATH.exists():
                system_prompt = _PROMPT_PATH.read_text(encoding="utf-8").replace("{tone}", tone)
            else:
                system_prompt = _SYSTEM_PROMPT_TEMPLATE.format(tone=tone)

            user_message = (
                f"Return {return_id}, item: {sku_name}, marketplace: {marketplace}, "
                f"resolution: {disposition}. Tone: {tone}."
            )
            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=256,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
            )
            draft_text = response.content[0].text.strip()
            # Haiku pricing: $0.80/M input, $4.00/M output
            cost_delta = (
                response.usage.input_tokens * 0.80
                + response.usage.output_tokens * 4.00
            ) / 1_000_000
        else:
            # Fallback to template
            fallback = _build_fallback_comms(return_id, disposition, marketplace)
            draft_text = fallback["draft_text"]

        elapsed_ms = int((time.monotonic() - t0) * 1000)

        comms_draft = CommsDraftSchema(
            channel=marketplace,
            draft_text=draft_text,
            tone=tone,
        )

        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"latency_ms": elapsed_ms, "tone": tone},
                cost_delta_usd=cost_delta,
                total_cost_usd=state.get("total_cost_usd", 0.0) + cost_delta,
            )
        )
        return {"comms_draft": comms_draft, "events": new_events, "total_cost_usd": cost_delta}
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
        return {"errors": {node_name: str(e)}, "events": new_events, "total_cost_usd": 0.0}
