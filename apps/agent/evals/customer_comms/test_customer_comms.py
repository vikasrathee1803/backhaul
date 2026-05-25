"""Customer Comms Agent eval tests — no live API."""


def test_damage_gets_empathetic_tone():
    from app.graph.nodes.customer_comms import _determine_tone

    assert _determine_tone("damage_in_transit", "refund") == "empathetic"
    assert _determine_tone("defective", "repair") == "empathetic"
    assert _determine_tone("missing_parts", "repair") == "empathetic"


def test_wrong_item_gets_neutral_tone():
    from app.graph.nodes.customer_comms import _determine_tone

    assert _determine_tone("wrong_item", "replace") == "neutral"


def test_escalation_gets_formal_tone():
    from app.graph.nodes.customer_comms import _determine_tone

    assert _determine_tone("fraud_suspected", "escalate") == "formal"
    assert _determine_tone("buyer_remorse", "escalate") == "formal"


def test_buyer_remorse_gets_neutral_tone():
    from app.graph.nodes.customer_comms import _determine_tone

    assert _determine_tone("buyer_remorse", "refund") == "neutral"


def test_fallback_comms_is_valid():
    from app.graph.nodes.customer_comms import _build_fallback_comms

    result = _build_fallback_comms("ret-001", "refund", "wayfair")
    assert "refund" in result["draft_text"].lower() or len(result["draft_text"]) > 10
    assert result["channel"] == "wayfair"


def test_fallback_comms_all_dispositions():
    from app.graph.nodes.customer_comms import _build_fallback_comms

    dispositions = ["refund", "replace", "repair", "refurbish", "donate", "dispose", "escalate"]
    for disposition in dispositions:
        result = _build_fallback_comms("ret-test", disposition, "amazon_fba")
        assert len(result["draft_text"]) > 20, f"Draft too short for {disposition}"
        assert result["channel"] == "amazon_fba"
        assert result["tone"] in ("empathetic", "neutral", "formal")


def test_fallback_comms_unknown_disposition():
    """Unknown disposition should still return a non-empty draft."""
    from app.graph.nodes.customer_comms import _build_fallback_comms

    result = _build_fallback_comms("ret-test", "unknown_disposition", "shopify")
    assert len(result["draft_text"]) > 10
