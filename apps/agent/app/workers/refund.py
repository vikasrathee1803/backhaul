from datetime import datetime, timezone

from ..graph.state import BackhaulState, GraphEvent, WorkerResultSchema


def refund_worker(state: BackhaulState) -> dict:
    node_name = "refund_worker"
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
        # STUB: In Phase 3, this calls Stripe test-mode API to issue refund
        intake = state.get("intake")
        order_total = intake["order_total_cents"] if intake else 0
        worker_result: WorkerResultSchema = {
            "worker": node_name,
            "status": "completed",
            "actions_taken": [
                f"Stub: Stripe refund issued for ${order_total / 100:.2f}",
                "Stub: Refund confirmation email queued",
            ],
            "notes": "Stripe test-mode — no real charge",
        }
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"latency_ms": 210},
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
