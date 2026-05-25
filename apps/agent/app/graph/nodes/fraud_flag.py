from datetime import datetime, timezone

from ..state import BackhaulState, FraudFlagSchema, GraphEvent

# Fraud threshold: return rate above this is flagged
_FRAUD_RETURN_RATE_THRESHOLD = 0.40
_FRAUD_SCORE_THRESHOLD = 0.70


def fraud_flag_agent(state: BackhaulState) -> dict:
    node_name = "fraud_flag_agent"
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
        # STUB: Deterministic rule-based fraud scoring
        customer_history = state.get("customer_history")
        flags: list[str] = []
        fraud_score = 0.0

        if customer_history:
            return_rate = customer_history.get("return_rate", 0.0)
            if return_rate > _FRAUD_RETURN_RATE_THRESHOLD:
                flags.append("high_return_rate")
                fraud_score += 0.4
            if customer_history.get("fraud_flag", False):
                flags.append("prior_fraud_flag")
                fraud_score += 0.5
            if (
                customer_history.get("order_count", 0) < 2
                and customer_history.get("return_count", 0) >= 1
            ):
                flags.append("first_order_return")
                fraud_score += 0.2

        fraud_score = min(fraud_score, 1.0)
        high_return_rate = "high_return_rate" in flags

        fraud_flags: FraudFlagSchema = {
            "fraud_score": round(fraud_score, 3),
            "flags": flags,
            "high_return_rate": high_return_rate,
            "exceeds_fraud_threshold": fraud_score >= _FRAUD_SCORE_THRESHOLD,
        }
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"latency_ms": 12},
                cost_delta_usd=0.0,
                total_cost_usd=0.0,
            )
        )
        return {"fraud_flags": fraud_flags, "events": new_events, "total_cost_usd": 0.0}
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
