from datetime import datetime, timezone

from ..state import BackhaulState, GraphEvent


def audit_agent(state: BackhaulState) -> dict:
    node_name = "audit_agent"
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
        # STUB: In Phase 3, this writes the full decision record to the append-only audit_log table
        # Records: run_id, return_id, agent, prompt_version, input snapshot, reasoning,
        #          confidence, cost, latency, disposition, worker_result, comms_draft
        decision = state.get("decision")
        audit_record = {
            "run_id": state["run_id"],
            "return_id": state["return_id"],
            "marketplace": state["marketplace"],
            "disposition": decision["disposition"] if decision else None,
            "confidence": decision["confidence"] if decision else None,
            "cost_usd": state.get("total_cost_usd", 0.0),
            "escalation_reason": state.get("escalation_reason"),
            "error_count": len(state.get("errors", {})),
            "audit_written_at": datetime.now(timezone.utc).isoformat(),
        }
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"latency_ms": 30},
                cost_delta_usd=0.0,
                total_cost_usd=0.0,
            )
        )
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="run_completed",
                node_name=None,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data=audit_record,
                cost_delta_usd=0.0,
                total_cost_usd=0.0,
            )
        )
        return {"audit_written": True, "events": new_events, "total_cost_usd": 0.0}
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
