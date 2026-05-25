"""Audit Agent eval tests."""


def make_test_state():
    return {
        "run_id": "run-test-001",
        "return_id": "ret-test-001",
        "marketplace": "wayfair",
        "raw_return_text": "damaged sofa",
        "intake": None,
        "customer_history": None,
        "sku_profile": None,
        "marketplace_policy": None,
        "damage_signal": None,
        "fraud_flags": None,
        "decision": {
            "disposition": "refund",
            "confidence": 0.85,
            "reasoning": "test",
            "prompt_version": "v1",
            "model_used": "claude-sonnet-4-6",
            "input_tokens": 100,
            "output_tokens": 50,
            "cost_usd": 0.001,
            "latency_ms": 500,
            "candidate_dispositions": [],
        },
        "worker_result": None,
        "comms_draft": None,
        "audit_written": False,
        "escalation_reason": None,
        "human_override": None,
        "errors": {},
        "events": [],
        "total_cost_usd": 0.001,
        "started_at": "2026-05-25T00:00:00Z",
    }


def test_audit_agent_sets_audit_written():
    from app.graph.nodes.audit import audit_agent

    state = make_test_state()
    result = audit_agent(state)
    assert result.get("audit_written") is True


def test_audit_emits_run_completed():
    from app.graph.nodes.audit import audit_agent

    state = make_test_state()
    result = audit_agent(state)
    event_types = [e["event_type"] for e in result.get("events", [])]
    assert "run_completed" in event_types


def test_audit_run_completed_is_last_event():
    from app.graph.nodes.audit import audit_agent

    state = make_test_state()
    result = audit_agent(state)
    events = result.get("events", [])
    assert len(events) > 0
    assert events[-1]["event_type"] == "run_completed"


def test_audit_record_has_disposition():
    from app.graph.nodes.audit import audit_agent

    state = make_test_state()
    result = audit_agent(state)
    events = result.get("events", [])
    run_completed = next(e for e in events if e["event_type"] == "run_completed")
    assert run_completed["data"]["disposition"] == "refund"


def test_audit_with_null_decision():
    """Audit should complete gracefully even when decision is None."""
    from app.graph.nodes.audit import audit_agent

    state = make_test_state()
    state["decision"] = None
    result = audit_agent(state)
    assert result.get("audit_written") is True
    event_types = [e["event_type"] for e in result.get("events", [])]
    assert "run_completed" in event_types


def test_audit_zero_cost():
    """Audit agent itself contributes zero cost to the graph run."""
    from app.graph.nodes.audit import audit_agent

    state = make_test_state()
    result = audit_agent(state)
    assert result.get("total_cost_usd", 0.0) == 0.0


def test_audit_writes_tmp_file():
    """Audit agent writes a JSON file to /tmp for testing."""
    import json
    import tempfile
    from pathlib import Path

    from app.graph.nodes.audit import audit_agent

    state = make_test_state()
    audit_agent(state)
    tmp_path = Path(tempfile.gettempdir()) / f"backhaul_audit_{state['run_id']}.json"
    assert tmp_path.exists()
    data = json.loads(tmp_path.read_text())
    assert data["run_id"] == "run-test-001"
    assert data["return_id"] == "ret-test-001"
