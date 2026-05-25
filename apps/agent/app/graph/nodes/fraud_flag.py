import time
from datetime import datetime, timezone

from ..state import BackhaulState, CustomerHistorySchema, FraudFlagSchema, GraphEvent

# Scoring threshold — score above this is considered a fraud escalation trigger
_FRAUD_SCORE_THRESHOLD = 0.60


def _compute_fraud_score(customer_history: CustomerHistorySchema) -> FraudFlagSchema:
    """
    Pure rule-based fraud scoring.  No LLM call — deterministic and testable.

    Score accumulation:
      return_rate > 0.20  → +0.20, flag: elevated_return_rate
      return_rate > 0.40  → +0.20 additional, flag: high_return_rate
      return_rate > 0.60  → +0.20 additional, flag: extreme_return_rate
      prior fraud_flag    → +0.30, flag: prior_fraud_flag
      >3 buyer_remorse    → +0.10, flag: serial_remorse_returns
      return_count > 5    → +0.05, flag: high_volume_returner
    Score is capped at 1.0.
    """
    score = 0.0
    flags: list[str] = []

    return_rate = float(customer_history.get("return_rate", 0.0))

    if return_rate > 0.20:
        score += 0.20
        flags.append("elevated_return_rate")
    if return_rate > 0.40:
        score += 0.20
        flags.append("high_return_rate")
    if return_rate > 0.60:
        score += 0.20
        flags.append("extreme_return_rate")

    if customer_history.get("fraud_flag", False):
        score += 0.30
        flags.append("prior_fraud_flag")

    prior_reasons = customer_history.get("prior_return_reasons", [])
    remorse_count = prior_reasons.count("buyer_remorse")
    if remorse_count > 3:
        score += 0.10
        flags.append("serial_remorse_returns")

    if int(customer_history.get("return_count", 0)) > 5:
        score += 0.05
        flags.append("high_volume_returner")

    score = round(min(1.0, score), 3)
    high_return_rate = return_rate > 0.40
    exceeds_threshold = score > _FRAUD_SCORE_THRESHOLD

    return FraudFlagSchema(
        fraud_score=score,
        flags=flags,
        high_return_rate=high_return_rate,
        exceeds_fraud_threshold=exceeds_threshold,
    )


def fraud_flag_agent(state: BackhaulState) -> dict:
    node_name = "fraud_flag_agent"
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
        customer_history = state.get("customer_history")
        if customer_history is None:
            # Build a zero-risk default if upstream agent hasn't run
            customer_history = CustomerHistorySchema(
                customer_id="",
                lifetime_value_cents=0,
                order_count=0,
                return_count=0,
                return_rate=0.0,
                fraud_flag=False,
                prior_return_reasons=[],
            )

        fraud_flags = _compute_fraud_score(customer_history)

        elapsed_ms = int((time.monotonic() - t0) * 1000)
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={
                    "latency_ms": elapsed_ms,
                    "fraud_score": fraud_flags["fraud_score"],
                    "exceeds_threshold": fraud_flags["exceeds_fraud_threshold"],
                },
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
