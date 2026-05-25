from datetime import datetime, timezone

from ..state import BackhaulState, CommsDraftSchema, GraphEvent


def customer_comms_agent(state: BackhaulState) -> dict:
    node_name = "customer_comms_agent"
    new_events: list[GraphEvent] = []
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
        # STUB: In Phase 3, this calls claude-haiku to draft channel-appropriate comms
        decision = state.get("decision")
        marketplace = state.get("marketplace", "wayfair")
        disposition = decision["disposition"] if decision else "escalate"

        draft_texts = {
            "refund": (
                "We have processed your refund. You should see the credit within 5-7 business days."
            ),
            "replace": (
                "Great news! We're sending you a replacement. "
                "You'll receive tracking information within 24 hours."
            ),
            "repair": (
                "We've scheduled a pickup for your item. "
                "Our repair team will contact you to arrange a convenient time."
            ),
            "refurbish": (
                "Thank you for your return. We've received your item and are processing it. "
                "Your refund will be issued once inspection is complete."
            ),
            "donate": (
                "Thank you for your return. We've arranged for local donation. "
                "Your account has been credited."
            ),
            "dispose": (
                "Thank you for your return. We've arranged for responsible disposal. "
                "Your refund has been processed."
            ),
            "escalate": (
                "Thank you for contacting us. A member of our team will review your case "
                "and reach out within 1 business day."
            ),
        }

        comms_draft: CommsDraftSchema = {
            "channel": marketplace,
            "draft_text": draft_texts.get(disposition, draft_texts["escalate"]),
            "tone": "professional",
        }
        cost_delta = 0.0005  # stub cost for haiku comms draft
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"latency_ms": 380},
                cost_delta_usd=cost_delta,
                total_cost_usd=cost_delta,
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
