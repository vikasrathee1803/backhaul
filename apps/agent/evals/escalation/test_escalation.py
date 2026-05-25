"""Escalation Agent eval tests."""


def make_state_for_escalation(fraud_score=0.75, order_total=200000, confidence=0.65):
    return {
        "run_id": "run-test",
        "return_id": "ret-test",
        "marketplace": "wayfair",
        "raw_return_text": "test",
        "fraud_flags": {
            "fraud_score": fraud_score,
            "flags": [],
            "high_return_rate": False,
            "exceeds_fraud_threshold": fraud_score > 0.60,
        },
        "decision": {
            "disposition": "escalate",
            "confidence": confidence,
            "reasoning": "test",
            "prompt_version": "v1",
            "model_used": "test",
            "input_tokens": 0,
            "output_tokens": 0,
            "cost_usd": 0.0,
            "latency_ms": 0,
            "candidate_dispositions": [],
        },
        "intake": {
            "return_id": "ret-test",
            "marketplace": "wayfair",
            "return_reason": "buyer_remorse",
            "condition": "fair",
            "condition_notes": "test",
            "order_total_cents": order_total,
            "inbound_freight_cost_cents": 5000,
            "sku_code": "TEST",
            "customer_id": "cust-test",
        },
        "customer_history": {
            "customer_id": "cust-test",
            "lifetime_value_cents": 150000,
            "order_count": 5,
            "return_count": 2,
            "return_rate": 0.40,
            "fraud_flag": False,
            "prior_return_reasons": [],
        },
        "events": [],
        "errors": {},
        "total_cost_usd": 0.0,
        "started_at": "2026-05-25T00:00:00Z",
        "damage_signal": None,
        "sku_profile": None,
        "marketplace_policy": None,
        "worker_result": None,
        "comms_draft": None,
        "audit_written": False,
        "escalation_reason": None,
        "human_override": None,
    }


def test_escalation_reason_contains_fraud():
    from app.graph.nodes.escalation import _build_escalation_reason

    state = make_state_for_escalation(fraud_score=0.75)
    reason = _build_escalation_reason(state)
    assert "fraud" in reason.lower() or "0.75" in reason


def test_escalation_reason_contains_high_value():
    from app.graph.nodes.escalation import _build_escalation_reason

    state = make_state_for_escalation(fraud_score=0.10, order_total=200000, confidence=0.85)
    reason = _build_escalation_reason(state)
    assert (
        "$2000" in reason
        or "2,000" in reason
        or "ceiling" in reason.lower()
        or "order" in reason.lower()
    )


def test_escalation_reason_contains_low_confidence():
    from app.graph.nodes.escalation import _build_escalation_reason

    state = make_state_for_escalation(fraud_score=0.10, order_total=50000, confidence=0.55)
    reason = _build_escalation_reason(state)
    assert "confidence" in reason.lower() or "55%" in reason or "0.55" in reason


def test_escalation_agent_returns_reason_key():
    from app.graph.nodes.escalation import escalation_agent

    state = make_state_for_escalation(fraud_score=0.75)
    result = escalation_agent(state)
    assert "escalation_reason" in result
    assert len(result["escalation_reason"]) > 0


def test_escalation_agent_emits_escalation_event():
    from app.graph.nodes.escalation import escalation_agent

    state = make_state_for_escalation(fraud_score=0.75)
    result = escalation_agent(state)
    event_types = [e["event_type"] for e in result.get("events", [])]
    assert "escalation" in event_types


def test_escalation_reason_total_loss():
    from app.graph.nodes.escalation import _build_escalation_reason

    state = make_state_for_escalation(fraud_score=0.10, order_total=50000, confidence=0.88)
    state["damage_signal"] = {
        "has_damage": True,
        "damage_severity": "total_loss",
        "damage_components": ["frame"],
        "repair_feasibility": "not_feasible",
        "raw_signal": "completely destroyed",
    }
    reason = _build_escalation_reason(state)
    assert "total" in reason.lower() or "loss" in reason.lower()


def test_escalation_fallback_reason_when_no_conditions():
    """When no specific trigger is present, a fallback reason is still returned."""
    from app.graph.nodes.escalation import _build_escalation_reason

    # Build state where no specific trigger fires
    state = make_state_for_escalation(fraud_score=0.10, order_total=50000, confidence=0.90)
    reason = _build_escalation_reason(state)
    assert len(reason) > 0
