from datetime import datetime, timezone

from ..graph.state import BackhaulState, GraphEvent, WorkerResultSchema


def repair_worker(state: BackhaulState) -> dict:
    node_name = "repair_worker"
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
        # STUB: In Phase 3, schedules freight pickup and creates repair work order
        damage_signal = state.get("damage_signal")
        components = damage_signal["damage_components"] if damage_signal else []
        worker_result: WorkerResultSchema = {
            "worker": node_name,
            "status": "completed",
            "actions_taken": [
                "Stub: Freight pickup scheduled for next business day",
                f"Stub: Repair work order created for components: {', '.join(components) or 'TBD'}",
                "Stub: Customer notified of pickup window",
            ],
            "notes": "Repair facility: fixture-warehouse-01",
        }
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"latency_ms": 75},
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
