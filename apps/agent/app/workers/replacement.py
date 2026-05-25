from datetime import datetime, timezone

from ..graph.state import BackhaulState, GraphEvent, WorkerResultSchema


def replacement_worker(state: BackhaulState) -> dict:
    node_name = "replacement_worker"
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
        # STUB: In Phase 3, checks inventory and books replacement shipment
        sku_profile = state.get("sku_profile")
        sku_code = sku_profile["sku_code"] if sku_profile else "UNKNOWN"
        current_stock = sku_profile["current_stock"] if sku_profile else 0
        if current_stock > 0:
            actions = [
                f"Stub: Inventory reserved for SKU {sku_code}",
                "Stub: Replacement shipment booked via fixture carrier",
                "Stub: Tracking number generated: TRK-STUB-00001",
            ]
            status = "completed"
        else:
            actions = [
                f"Stub: No stock available for SKU {sku_code}",
                "Stub: Backordered — escalating to procurement",
            ]
            status = "backordered"

        worker_result: WorkerResultSchema = {
            "worker": node_name,
            "status": status,
            "actions_taken": actions,
            "notes": f"Stock level at time of decision: {current_stock}",
        }
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"latency_ms": 95},
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
