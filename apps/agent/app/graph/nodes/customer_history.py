from datetime import datetime, timezone

from ..state import BackhaulState, CustomerHistorySchema, GraphEvent


def customer_history_agent(state: BackhaulState) -> dict:
    node_name = "customer_history_agent"
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
        # STUB: In Phase 3, this queries Postgres for customer order + return history
        intake = state.get("intake")
        customer_id = intake["customer_id"] if intake else "cust-001"
        customer_history: CustomerHistorySchema = {
            "customer_id": customer_id,
            "lifetime_value_cents": 425000,
            "order_count": 7,
            "return_count": 1,
            "return_rate": 0.14,
            "fraud_flag": False,
            "prior_return_reasons": ["damage_in_transit"],
        }
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"latency_ms": 55},
                cost_delta_usd=0.0,
                total_cost_usd=0.0,
            )
        )
        return {"customer_history": customer_history, "events": new_events, "total_cost_usd": 0.0}
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
