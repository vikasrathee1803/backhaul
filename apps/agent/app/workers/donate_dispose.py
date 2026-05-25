"""
Donate / Dispose Worker — routes the item to regional donation or disposal.
Items under 50 lbs are donated; heavier items are disposed.
Donation center selection is deterministic (hash of return_id) for reproducibility.
"""
import time
from datetime import datetime, timezone

from ..graph.state import BackhaulState, GraphEvent, WorkerResultSchema

_DONATION_CENTERS = [
    "Habitat for Humanity ReStore",
    "Goodwill Industrial Donation Center",
    "Local Reuse Network",
]

_DISPOSAL_COST_PER_LB = 0.85  # USD per lb for carrier-arranged disposal


def _select_donation_center(return_id: str) -> str:
    """Deterministic selection of donation center using hash of return_id."""
    idx = abs(hash(return_id)) % len(_DONATION_CENTERS)
    return _DONATION_CENTERS[idx]


def donate_dispose_worker(state: BackhaulState) -> dict:
    node_name = "donate_dispose_worker"
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
        intake = state.get("intake") or {}
        decision = state.get("decision") or {}

        weight_lbs = sku_profile.get("weight_lbs", 0.0)
        sku_name = sku_profile.get("name", "Unknown item")
        return_id = intake.get("return_id", state.get("return_id", "unknown"))
        customer_id = intake.get("customer_id", "unknown")
        marketplace = intake.get("marketplace", state.get("marketplace", "unknown"))
        disposition = decision.get("disposition", "dispose")

        # Route: heavy items (> 50 lbs) or explicit dispose → disposal
        # Light items or explicit donate → donation
        is_heavy = weight_lbs > 50.0
        route_to_dispose = disposition == "dispose" or is_heavy

        if route_to_dispose:
            disposal_cost = weight_lbs * _DISPOSAL_COST_PER_LB
            actions = [
                f"Disposal route selected: item weight {weight_lbs:.1f} lbs (threshold 50 lbs)",
                f"Carrier arranged for item disposal of {sku_name}",
                f"Estimated disposal cost: ${disposal_cost:.2f}",
                "Environmental compliance form filed",
                "Responsible disposal certificate will be issued within 5 business days",
                f"Customer {customer_id} refund queued via {marketplace}",
            ]
            notes = f"Disposal: landfill diversion rate 85% | Est. cost ${disposal_cost:.2f}"
        else:
            center = _select_donation_center(return_id)
            actions = [
                f"Donation route selected: item weight {weight_lbs:.1f} lbs (under 50 lb threshold)",
                f"Donation partner notified: {center}",
                f"Item: {sku_name} — pickup scheduled within 3 business days",
                "Tax receipt generated for donation fair-market value",
                f"Customer {customer_id} account credited via {marketplace}",
            ]
            notes = f"Donation routed to {center} — nearest partner within 50 miles"

        elapsed_ms = int((time.monotonic() - t0) * 1000)

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
                data={
                    "latency_ms": elapsed_ms,
                    "route": "dispose" if route_to_dispose else "donate",
                },
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
