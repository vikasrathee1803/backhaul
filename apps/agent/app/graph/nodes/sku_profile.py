from datetime import datetime, timezone

from ..state import BackhaulState, GraphEvent, SkuProfileSchema


def sku_profile_agent(state: BackhaulState) -> dict:
    node_name = "sku_profile_agent"
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
        # STUB: In Phase 3, this queries the SKU catalog from Postgres
        intake = state.get("intake")
        sku_code = intake["sku_code"] if intake else "SOF-3SEAT-GRY"
        sku_profile: SkuProfileSchema = {
            "sku_code": sku_code,
            "name": "3-Seat Sofa Grey",
            "weight_lbs": 185.0,
            "freight_class": "125",
            "refurb_difficulty": "medium",
            "open_box_price_estimate_cents": 84900,
            "refurb_cost_estimate_cents": 12500,
            "current_stock": 3,
        }
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"latency_ms": 42},
                cost_delta_usd=0.0,
                total_cost_usd=0.0,
            )
        )
        return {"sku_profile": sku_profile, "events": new_events, "total_cost_usd": 0.0}
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
