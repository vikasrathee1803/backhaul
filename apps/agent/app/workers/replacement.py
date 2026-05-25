"""
Replacement Worker — checks inventory and books a replacement shipment.
If stock is available, reserves it and generates a fixture tracking number.
If stock is unavailable, records a skip and routes back to refund gracefully.
"""
import time
import uuid
from datetime import datetime, timezone

from ..graph.state import BackhaulState, GraphEvent, WorkerResultSchema


def replacement_worker(state: BackhaulState) -> dict:
    node_name = "replacement_worker"
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

        sku_code = sku_profile.get("sku_code", "UNKNOWN")
        sku_name = sku_profile.get("name", "Unknown item")
        current_stock = sku_profile.get("current_stock", 0)
        customer_id = intake.get("customer_id", "unknown")
        marketplace = intake.get("marketplace", state.get("marketplace", "unknown"))
        return_id = intake.get("return_id", state.get("return_id", "unknown"))

        if current_stock > 0:
            tracking_number = f"TRK-{uuid.uuid4().hex[:10].upper()}"
            order_id = f"ORD-RPL-{uuid.uuid4().hex[:8].upper()}"
            actions = [
                f"Inventory reserved: 1 unit of {sku_code} ({sku_name})",
                f"Replacement order created: {order_id}",
                f"Shipment booked via fixture carrier — tracking: {tracking_number}",
                f"Customer {customer_id} notified via {marketplace}",
            ]
            status = "completed"
            notes = f"Stock remaining after reservation: {current_stock - 1} units"
        else:
            actions = [
                f"No stock available for SKU {sku_code} ({sku_name})",
                f"Replacement for return {return_id} could not be fulfilled",
                "Item flagged for procurement review — routing to refund fallback",
            ]
            status = "skipped"
            notes = "No stock available, routing to refund"

        elapsed_ms = int((time.monotonic() - t0) * 1000)

        worker_result: WorkerResultSchema = {
            "worker": node_name,
            "status": status,
            "actions_taken": actions,
            "notes": notes,
        }
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"latency_ms": elapsed_ms, "status": status},
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
