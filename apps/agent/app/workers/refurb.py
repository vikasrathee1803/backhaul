from datetime import datetime, timezone

from ..graph.state import BackhaulState, GraphEvent, WorkerResultSchema


def refurb_worker(state: BackhaulState) -> dict:
    node_name = "refurb_worker"
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
        # STUB: In Phase 3, grades item and routes to refurb queue with Open Box pricing
        sku_profile = state.get("sku_profile")
        damage_signal = state.get("damage_signal")
        severity = damage_signal["damage_severity"] if damage_signal else "cosmetic"
        open_box_price = sku_profile["open_box_price_estimate_cents"] if sku_profile else 80000
        # Determine grade based on damage severity
        grade_map = {
            "none": "A",
            "cosmetic": "B",
            "functional": "C",
            "structural": "C",
            "total_loss": "D",
        }
        grade = grade_map.get(severity, "C")
        worker_result: WorkerResultSchema = {
            "worker": node_name,
            "status": "completed",
            "actions_taken": [
                f"Stub: Item graded as Open Box Grade {grade}",
                f"Stub: Open Box listing created at ${open_box_price / 100:.2f}",
                "Stub: Item routed to refurb queue — ticket REF-STUB-001",
            ],
            "notes": (
                f"Refurb difficulty: {sku_profile['refurb_difficulty'] if sku_profile else 'unknown'}"
            ),
        }
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"latency_ms": 60},
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
