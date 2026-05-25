from datetime import datetime, timezone

from ..state import BackhaulState, GraphEvent


def escalation_agent(state: BackhaulState) -> dict:
    node_name = "escalation_agent"
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
        # STUB: In Phase 3, this builds escalation context and writes to the escalation queue
        decision = state.get("decision")
        fraud_flags = state.get("fraud_flags")

        reasons: list[str] = []
        if decision and decision.get("confidence", 1.0) < 0.70:
            reasons.append(f"Low decision confidence: {decision['confidence']:.0%}")
        if fraud_flags and fraud_flags.get("exceeds_fraud_threshold"):
            reasons.append("Fraud threshold exceeded")
        if decision and decision.get("disposition") == "escalate":
            reasons.append("Decision agent flagged for human review")
        if not reasons:
            reasons.append("Stub: escalation triggered by routing")

        escalation_reason = "; ".join(reasons)
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
                data={"latency_ms": 25},
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
