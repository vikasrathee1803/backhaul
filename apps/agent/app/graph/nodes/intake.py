from datetime import datetime, timezone

from ..state import BackhaulState, GraphEvent, ReturnIntakeSchema


def intake_agent(state: BackhaulState) -> dict:
    node_name = "intake_agent"
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
        # STUB: In Phase 3, this calls claude-haiku to parse raw_return_text
        intake: ReturnIntakeSchema = {
            "return_id": state["return_id"],
            "marketplace": state["marketplace"],
            "return_reason": "damage_in_transit",
            "condition": "poor",
            "condition_notes": state.get("raw_return_text", ""),
            "order_total_cents": 129900,
            "inbound_freight_cost_cents": 18400,
            "sku_code": "SOF-3SEAT-GRY",
            "customer_id": "cust-001",
        }
        cost_delta = 0.0004  # stub cost
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"latency_ms": 420},
                cost_delta_usd=cost_delta,
                total_cost_usd=cost_delta,
            )
        )
        return {"intake": intake, "events": new_events, "total_cost_usd": cost_delta}
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
