"""
Escalation Agent — pure logic, no LLM.
Called when decision.disposition == "escalate".
Builds a human-readable escalation reason summarising which conditions triggered,
and records an escalation event for the Agent Ops view.
"""
import time
from datetime import datetime, timezone

from ..state import BackhaulState, GraphEvent


def _build_escalation_reason(state: BackhaulState) -> str:
    """
    Build a plain-English escalation reason by checking every trigger condition.
    Returns a semicolon-separated list of triggered reasons.
    Exported for testing.
    """
    reasons: list[str] = []

    fraud_flags = state.get("fraud_flags") or {}
    fraud_score = fraud_flags.get("fraud_score", 0.0)
    if fraud_score > 0.60:
        reasons.append(f"Fraud score {fraud_score:.2f} exceeds threshold of 0.60")

    intake = state.get("intake") or {}
    order_total_cents = intake.get("order_total_cents", 0)
    if order_total_cents > 150000:
        reasons.append(
            f"Order total ${order_total_cents / 100:.2f} exceeds auto-decide ceiling of $1,500.00"
        )

    decision = state.get("decision") or {}
    confidence = decision.get("confidence", 1.0)
    if confidence < 0.70:
        reasons.append(f"Decision confidence {confidence:.0%} below 70% threshold")

    customer_history = state.get("customer_history") or {}
    lifetime_value_cents = customer_history.get("lifetime_value_cents", 0)
    if lifetime_value_cents > 500000 and fraud_score > 0.30:
        reasons.append(
            f"High-value customer (LTV ${lifetime_value_cents / 100:.2f}) with elevated fraud risk "
            f"(score {fraud_score:.2f})"
        )

    damage_signal = state.get("damage_signal") or {}
    damage_severity = damage_signal.get("damage_severity", "")
    if damage_severity == "total_loss":
        reasons.append("Total loss item requires human assessment")

    if not reasons:
        reasons.append("Decision agent flagged for human review")

    return "; ".join(reasons)


def escalation_agent(state: BackhaulState) -> dict:
    node_name = "escalation_agent"
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
        escalation_reason = _build_escalation_reason(state)

        elapsed_ms = int((time.monotonic() - t0) * 1000)

        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="escalation",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"reason": escalation_reason},
                cost_delta_usd=0.0,
                total_cost_usd=0.0,
            )
        )
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"latency_ms": elapsed_ms},
                cost_delta_usd=0.0,
                total_cost_usd=0.0,
            )
        )
        return {"escalation_reason": escalation_reason, "events": new_events, "total_cost_usd": 0.0}
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
