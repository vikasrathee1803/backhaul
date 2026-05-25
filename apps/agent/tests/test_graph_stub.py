"""
End-to-end stub graph test. Runs the full graph with all stubs.
No live API calls. Verifies topology executes without error.
"""
from datetime import datetime, timezone

import pytest

from app.graph.state import BackhaulState
from app.graph.topology import graph


@pytest.mark.asyncio
async def test_stub_graph_run_completes() -> None:
    """Full stub graph run should complete and produce a decision."""
    run_id = "test-run-001"
    initial_state: BackhaulState = {
        "run_id": run_id,
        "return_id": "RTN-TEST-001",
        "marketplace": "wayfair",
        "raw_return_text": "Sofa damaged in transit, corner frame broken.",
        "intake": None,
        "customer_history": None,
        "sku_profile": None,
        "marketplace_policy": None,
        "damage_signal": None,
        "fraud_flags": None,
        "decision": None,
        "worker_result": None,
        "comms_draft": None,
        "audit_written": False,
        "escalation_reason": None,
        "human_override": None,
        "errors": {},
        "events": [],
        "total_cost_usd": 0.0,
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    config = {"configurable": {"thread_id": run_id}}
    result = await graph.ainvoke(initial_state, config=config)

    assert result is not None
    assert result.get("audit_written") is True
    assert result.get("decision") is not None
    assert result["decision"]["disposition"] in [
        "refund",
        "replace",
        "repair",
        "refurbish",
        "donate",
        "dispose",
        "escalate",
    ]
    assert result.get("total_cost_usd", 0) < 0.10  # Hard cost ceiling


@pytest.mark.asyncio
async def test_stub_graph_emits_events() -> None:
    """Graph should emit SSE events for each node visited."""
    run_id = "test-run-002"
    initial_state: BackhaulState = {
        "run_id": run_id,
        "return_id": "RTN-TEST-002",
        "marketplace": "amazon_fba",
        "raw_return_text": "Treadmill motor defective.",
        "intake": None,
        "customer_history": None,
        "sku_profile": None,
        "marketplace_policy": None,
        "damage_signal": None,
        "fraud_flags": None,
        "decision": None,
        "worker_result": None,
        "comms_draft": None,
        "audit_written": False,
        "escalation_reason": None,
        "human_override": None,
        "errors": {},
        "events": [],
        "total_cost_usd": 0.0,
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    config = {"configurable": {"thread_id": run_id}}
    result = await graph.ainvoke(initial_state, config=config)

    events = result.get("events", [])
    assert len(events) > 0, "Graph should emit at least one event"
    event_types = {e["event_type"] for e in events}
    assert "node_started" in event_types or "node_completed" in event_types
