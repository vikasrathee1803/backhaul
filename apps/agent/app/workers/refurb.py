"""
Refurb Worker — grades the returned item and routes it to the refurb queue
with an Open Box listing at the estimated price.
Total-loss items are skipped (should not route here).
"""
import time
import uuid
from datetime import datetime, timezone

from ..graph.state import BackhaulState, GraphEvent, WorkerResultSchema

# Grade definitions aligned with Open Box retail conventions
_GRADE_MAP: dict[str, tuple[str, str]] = {
    "none":      ("Grade A", "Open Box Like New"),
    "cosmetic":  ("Grade A", "Open Box Like New"),
    "functional": ("Grade B", "Open Box Good"),
    "structural": ("Grade C", "Parts/Repair"),
}
_TOTAL_LOSS_SEVERITY = "total_loss"


def refurb_worker(state: BackhaulState) -> dict:
    node_name = "refurb_worker"
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
        sku_profile = state.get("sku_profile") or {}
        damage_signal = state.get("damage_signal") or {}
        intake = state.get("intake") or {}

        damage_severity = damage_signal.get("damage_severity", "cosmetic")
        open_box_price_cents = sku_profile.get("open_box_price_estimate_cents", 0)
        refurb_difficulty = sku_profile.get("refurb_difficulty", "unknown")
        sku_name = sku_profile.get("name", "Unknown item")
        sku_code = sku_profile.get("sku_code", "UNKNOWN")
        return_id = intake.get("return_id", state.get("return_id", "unknown"))

        # Total loss — should not route here
        if damage_severity == _TOTAL_LOSS_SEVERITY:
            worker_result: WorkerResultSchema = {
                "worker": node_name,
                "status": "skipped",
                "actions_taken": [
                    f"Return {return_id} flagged as total loss — refurb is not viable",
                    "Item should be routed to dispose — check routing logic",
                ],
                "notes": "Total loss item should not route to refurb",
            }
            elapsed_ms = int((time.monotonic() - t0) * 1000)
            new_events.append(
                GraphEvent(
                    run_id=state["run_id"],
                    event_type="node_completed",
                    node_name=node_name,
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    data={"latency_ms": elapsed_ms, "status": "skipped"},
                    cost_delta_usd=0.0,
                    total_cost_usd=0.0,
                )
            )
            return {"worker_result": worker_result, "events": new_events, "total_cost_usd": 0.0}

        grade_code, grade_label = _GRADE_MAP.get(damage_severity, ("Grade C", "Parts/Repair"))
        refurb_ticket = f"REF-{uuid.uuid4().hex[:10].upper()}"

        actions = [
            f"Item graded: {grade_code} — {grade_label}",
            f"Open Box listing created for {sku_code} ({sku_name}) at ${open_box_price_cents / 100:.2f}",
            f"Item routed to refurb queue — ticket {refurb_ticket}",
            f"Refurb difficulty on file: {refurb_difficulty}",
            "Quality inspection checklist generated for refurb team",
        ]

        elapsed_ms = int((time.monotonic() - t0) * 1000)

        worker_result = {
            "worker": node_name,
            "status": "completed",
            "actions_taken": actions,
            "notes": (
                f"Grade: {grade_code} — {grade_label} | "
                f"Est. open box price: ${open_box_price_cents / 100:.2f} | "
                f"Refurb difficulty: {refurb_difficulty}"
            ),
        }
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"latency_ms": elapsed_ms, "grade": grade_code},
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
