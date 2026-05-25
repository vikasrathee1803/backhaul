import json
import time
from datetime import datetime, timezone
from pathlib import Path

from ..state import BackhaulState, CustomerHistorySchema, GraphEvent

# ---------------------------------------------------------------------------
# Module-level fixture cache — loaded once at import time
# ---------------------------------------------------------------------------
_FIXTURE_PATH = Path(__file__).parents[3] / "fixtures" / "customers.json"
_RETURNS_PATH = Path(__file__).parents[3] / "fixtures" / "returns.json"

_CUSTOMERS: dict[str, dict] = {}
_CUSTOMER_RETURN_REASONS: dict[str, list[str]] = {}


def _load_fixtures() -> None:
    """Populate _CUSTOMERS and _CUSTOMER_RETURN_REASONS from fixture files."""
    global _CUSTOMERS, _CUSTOMER_RETURN_REASONS
    if _FIXTURE_PATH.exists():
        raw: list[dict] = json.loads(_FIXTURE_PATH.read_text(encoding="utf-8"))
        _CUSTOMERS = {c["id"]: c for c in raw}

    if _RETURNS_PATH.exists():
        returns_raw: list[dict] = json.loads(_RETURNS_PATH.read_text(encoding="utf-8"))
        reasons: dict[str, list[str]] = {}
        for r in returns_raw:
            cid = r.get("customer_id", "")
            reason = r.get("return_reason", "")
            if cid and reason:
                reasons.setdefault(cid, []).append(reason)
        _CUSTOMER_RETURN_REASONS = reasons


_load_fixtures()


# ---------------------------------------------------------------------------
# Public helpers (exported for tests and downstream agents)
# ---------------------------------------------------------------------------


def _build_fallback_customer_history(customer_id: str) -> CustomerHistorySchema:
    return CustomerHistorySchema(
        customer_id=customer_id,
        lifetime_value_cents=0,
        order_count=0,
        return_count=0,
        return_rate=0.0,
        fraud_flag=False,
        prior_return_reasons=[],
    )


def _lookup_customer(customer_id: str) -> CustomerHistorySchema:
    """Return CustomerHistorySchema for a known customer_id, or fallback."""
    customer = _CUSTOMERS.get(customer_id)
    if customer is None:
        return _build_fallback_customer_history(customer_id)

    order_count = int(customer.get("order_count", 0))
    return_count = int(customer.get("return_count", 0))
    return_rate = float(customer.get("return_rate", 0.0))
    # Recompute return_rate defensively in case fixture has rounding drift
    if order_count > 0:
        return_rate = round(return_count / order_count, 4)

    prior_reasons = _CUSTOMER_RETURN_REASONS.get(customer_id, [])

    return CustomerHistorySchema(
        customer_id=customer_id,
        lifetime_value_cents=int(customer.get("lifetime_value_cents", 0)),
        order_count=order_count,
        return_count=return_count,
        return_rate=return_rate,
        fraud_flag=bool(customer.get("fraud_flag", False)),
        prior_return_reasons=prior_reasons,
    )


# ---------------------------------------------------------------------------
# LangGraph node
# ---------------------------------------------------------------------------


def customer_history_agent(state: BackhaulState) -> dict:
    node_name = "customer_history_agent"
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
        intake = state.get("intake")
        customer_id = intake["customer_id"] if intake else ""
        if not customer_id:
            customer_id = state.get("return_id", "unknown")

        customer_history = _lookup_customer(customer_id)

        elapsed_ms = int((time.monotonic() - t0) * 1000)
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={
                    "latency_ms": elapsed_ms,
                    "return_rate": customer_history["return_rate"],
                    "source": "fixture" if customer_id in _CUSTOMERS else "fallback",
                },
                cost_delta_usd=0.0,
                total_cost_usd=0.0,
            )
        )
        return {
            "customer_history": customer_history,
            "events": new_events,
            "total_cost_usd": 0.0,
        }
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
