import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

router = APIRouter()


async def _mock_event_generator(run_id: str):
    """Phase 2 stub: yield mock graph execution events."""
    nodes = [
        ("node_started", "intake_agent", 0.0),
        ("node_completed", "intake_agent", 0.0004),
        ("node_completed", "customer_history_agent", 0.0),
        ("node_completed", "sku_profile_agent", 0.0),
        ("node_completed", "marketplace_policy_agent", 0.0),
        ("node_completed", "damage_signal_agent", 0.0006),
        ("node_completed", "fraud_flag_agent", 0.0),
        ("node_started", "decision_agent", 0.0),
        ("node_completed", "decision_agent", 0.0082),
        ("decision_made", "decision_agent", 0.0),
        ("node_completed", "refurb_worker", 0.0),
        ("node_completed", "customer_comms_agent", 0.0005),
        ("node_completed", "audit_agent", 0.0),
        ("run_completed", None, 0.0),
    ]
    total = 0.0
    for event_type, node_name, cost_delta in nodes:
        total += cost_delta
        event = {
            "run_id": run_id,
            "event_type": event_type,
            "node_name": node_name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": {},
            "cost_delta_usd": cost_delta,
            "total_cost_usd": round(total, 6),
        }
        yield {"data": json.dumps(event)}
        await asyncio.sleep(0.4)


@router.get("/graph/stream/{run_id}")
async def stream_graph_run(run_id: str) -> EventSourceResponse:
    return EventSourceResponse(_mock_event_generator(run_id))
