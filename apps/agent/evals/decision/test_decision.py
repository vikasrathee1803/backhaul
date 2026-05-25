"""Decision Agent golden case tests using rule-based fallback — no live API."""

from app.graph.nodes.decision import _rule_based_fallback_decision


def test_escalates_on_fraud():
    result = _rule_based_fallback_decision(
        fraud_score=0.75,
        damage_severity="cosmetic",
        repair_feasibility="feasible",
        return_reason="buyer_remorse",
        current_stock=5,
        order_total_cents=89900,
        net_refurb_value=20000.0,
        lifetime_value_cents=150000,
        refurb_difficulty="moderate",
    )
    assert result["disposition"] == "escalate"


def test_refurbish_on_good_economics():
    # net_refurb_value = 45000, order_total = 89900, 30% = 26970 → refurb threshold met
    result = _rule_based_fallback_decision(
        fraud_score=0.05,
        damage_severity="cosmetic",
        repair_feasibility="feasible",
        return_reason="damage_in_transit",
        current_stock=3,
        order_total_cents=89900,
        net_refurb_value=45000.0,
        lifetime_value_cents=200000,
        refurb_difficulty="easy",
    )
    assert result["disposition"] == "refurbish"


def test_dispose_on_total_loss():
    result = _rule_based_fallback_decision(
        fraud_score=0.05,
        damage_severity="total_loss",
        repair_feasibility="not_feasible",
        return_reason="damage_in_transit",
        current_stock=0,
        order_total_cents=129900,
        net_refurb_value=-50000.0,
        lifetime_value_cents=200000,
        refurb_difficulty="not_feasible",
    )
    assert result["disposition"] == "dispose"


def test_repair_on_functional_damage():
    result = _rule_based_fallback_decision(
        fraud_score=0.05,
        damage_severity="functional",
        repair_feasibility="feasible",
        return_reason="defective",
        current_stock=0,
        order_total_cents=89900,
        net_refurb_value=5000.0,
        lifetime_value_cents=150000,
        refurb_difficulty="moderate",
    )
    assert result["disposition"] == "repair"


def test_replace_on_wrong_item_with_stock():
    result = _rule_based_fallback_decision(
        fraud_score=0.05,
        damage_severity="none",
        repair_feasibility="feasible",
        return_reason="wrong_item",
        current_stock=5,
        order_total_cents=89900,
        net_refurb_value=10000.0,
        lifetime_value_cents=150000,
        refurb_difficulty="easy",
    )
    assert result["disposition"] == "replace"


def test_refund_as_default():
    result = _rule_based_fallback_decision(
        fraud_score=0.05,
        damage_severity="none",
        repair_feasibility="feasible",
        return_reason="buyer_remorse",
        current_stock=0,
        order_total_cents=89900,
        net_refurb_value=5000.0,
        lifetime_value_cents=150000,
        refurb_difficulty="not_feasible",
    )
    assert result["disposition"] in ("refund", "escalate")  # either valid


def test_escalate_on_high_order_value():
    # order_total > $1500 always escalates
    result = _rule_based_fallback_decision(
        fraud_score=0.05,
        damage_severity="cosmetic",
        repair_feasibility="feasible",
        return_reason="damage_in_transit",
        current_stock=3,
        order_total_cents=200000,  # $2000
        net_refurb_value=60000.0,
        lifetime_value_cents=200000,
        refurb_difficulty="easy",
    )
    assert result["disposition"] == "escalate"


def test_escalate_on_total_loss_high_ltv():
    """Total loss + high-LTV customer → escalate (not dispose) to protect relationship."""
    result = _rule_based_fallback_decision(
        fraud_score=0.05,
        damage_severity="total_loss",
        repair_feasibility="not_feasible",
        return_reason="damage_in_transit",
        current_stock=0,
        order_total_cents=89900,
        net_refurb_value=-50000.0,
        lifetime_value_cents=600000,  # > $5000
        refurb_difficulty="not_feasible",
    )
    assert result["disposition"] == "escalate"


def test_confidence_present_on_all_paths():
    """Every code path must return a confidence value."""
    cases = [
        dict(fraud_score=0.75, damage_severity="cosmetic", repair_feasibility="feasible",
             return_reason="buyer_remorse", current_stock=0, order_total_cents=50000,
             net_refurb_value=10000.0, lifetime_value_cents=100000, refurb_difficulty="easy"),
        dict(fraud_score=0.05, damage_severity="total_loss", repair_feasibility="not_feasible",
             return_reason="damage_in_transit", current_stock=0, order_total_cents=50000,
             net_refurb_value=-10000.0, lifetime_value_cents=100000, refurb_difficulty="not_feasible"),
        dict(fraud_score=0.05, damage_severity="cosmetic", repair_feasibility="feasible",
             return_reason="damage_in_transit", current_stock=3, order_total_cents=50000,
             net_refurb_value=20000.0, lifetime_value_cents=100000, refurb_difficulty="easy"),
    ]
    for case in cases:
        result = _rule_based_fallback_decision(**case)
        assert 0.0 <= result["confidence"] <= 1.0
        assert result["model_used"] == "fallback_rules"
        assert result["prompt_version"] == "fallback"
