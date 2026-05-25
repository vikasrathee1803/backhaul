"""
Repair Worker — schedules a freight pickup and creates a repair work order.
Labor estimate is derived from damage severity. Pickup is 3 business days out.
Parts needed are inferred from the damage components list.
"""
import time
import uuid
from datetime import datetime, timedelta, timezone

from ..graph.state import BackhaulState, GraphEvent, WorkerResultSchema

# Labor hours by severity — used for scheduling and cost estimation
_LABOR_HOURS: dict[str, int] = {
    "cosmetic": 2,
    "functional": 4,
    "structural": 8,
}
_DEFAULT_LABOR_HOURS = 4

# Hourly labor rate (fixture)
_LABOR_RATE_USD = 75.0


def _pickup_date(from_date: datetime, business_days: int = 3) -> str:
    """Return an ISO date string N business days from from_date."""
    current = from_date
    days_added = 0
    while days_added < business_days:
        current += timedelta(days=1)
        if current.weekday() < 5:  # Monday–Friday
            days_added += 1
    return current.date().isoformat()


def repair_worker(state: BackhaulState) -> dict:
    node_name = "repair_worker"
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
        damage_signal = state.get("damage_signal") or {}
        intake = state.get("intake") or {}
        sku_profile = state.get("sku_profile") or {}

        damage_severity = damage_signal.get("damage_severity", "functional")
        damage_components = damage_signal.get("damage_components", [])
        customer_id = intake.get("customer_id", "unknown")
        marketplace = intake.get("marketplace", state.get("marketplace", "unknown"))
        return_id = intake.get("return_id", state.get("return_id", "unknown"))
        sku_name = sku_profile.get("name", "Unknown item")

        labor_hours = _LABOR_HOURS.get(damage_severity, _DEFAULT_LABOR_HOURS)
        estimated_cost_usd = labor_hours * _LABOR_RATE_USD

        work_order_id = f"WO-{uuid.uuid4().hex[:10].upper()}"
        pickup_date = _pickup_date(datetime.now(timezone.utc), business_days=3)

        parts_needed = damage_components if damage_components else ["TBD — inspection required"]

        actions = [
            f"Freight pickup scheduled for {pickup_date} (3 business days)",
            f"Repair work order created: {work_order_id}",
            f"Item: {sku_name} | Damage severity: {damage_severity}",
            f"Estimated labor: {labor_hours}h @ ${_LABOR_RATE_USD:.0f}/h = ${estimated_cost_usd:.2f}",
            f"Parts needed: {', '.join(parts_needed)}",
            f"Customer {customer_id} notified of pickup window via {marketplace}",
        ]

        elapsed_ms = int((time.monotonic() - t0) * 1000)

        worker_result: WorkerResultSchema = {
            "worker": node_name,
            "status": "completed",
            "actions_taken": actions,
            "notes": f"Repair facility: fixture-warehouse-01 | Return {return_id}",
        }
        new_events.append(
            GraphEvent(
                run_id=state["run_id"],
                event_type="node_completed",
                node_name=node_name,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data={"latency_ms": elapsed_ms, "work_order_id": work_order_id},
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
