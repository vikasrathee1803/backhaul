from datetime import datetime, timezone

from ..graph.state import BackhaulState, GraphEvent, WorkerResultSchema


def donate_dispose_worker(state: BackhaulState) -> dict:
    node_name = "donate_dispose_worker"
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
        # STUB: In Phase 3, routes to regional donation partner or disposal vendor
        decision = state.get("decision")
        disposition = decision["disposition"] if decision else "dispose"
        if disposition == "donate":
            actions = [
                "Stub: Donation partner notified — Habitat for Humanity ReStore",
                "Stub: Pickup scheduled within 3 business days",
                "Stub: Tax receipt generated for donation value",
            ]
            notes = "Donation routed to nearest partner within 50 miles"
        else:
            actions = [
                "Stub: Disposal vendor notified — EcoDispose Inc.",
                "Stub: Responsible disposal certificate will be issued",
                "Stub: Environmental compliance form filed",
            ]
            notes = "Disposal: landfill diversion rate 85%"

        worker_result: WorkerResultSchema = {
            "worker": node_name,
            "status": "completed",
            "actions_taken": actions,
            "notes": notes,
        }
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"latency_ms": 45},
                cost_delta_usd=0.0,
                total_cost_usd=0.0,
            )
        )
        return {"worker_result": worker_result, "events": new_events, "total_cost_usd": 0.0}
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
