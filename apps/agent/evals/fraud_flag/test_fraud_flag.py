"""Eval golden cases for FraudFlagAgent — deterministic rule-based scoring."""
import pytest

from app.graph.nodes.fraud_flag import _compute_fraud_score


def make_customer(
    return_rate=0.0,
    fraud_flag=False,
    return_count=1,
    order_count=5,
    reasons=None,
):
    return {
        "customer_id": "cust-test",
        "lifetime_value_cents": 150000,
        "order_count": order_count,
        "return_count": return_count,
        "return_rate": return_rate,
        "fraud_flag": fraud_flag,
        "prior_return_reasons": reasons or [],
    }


def test_clean_customer_no_flags():
    result = _compute_fraud_score(make_customer(return_rate=0.10))
    assert result["fraud_score"] == 0.0
    assert result["flags"] == []
    assert result["exceeds_fraud_threshold"] is False
    assert result["high_return_rate"] is False


def test_elevated_return_rate():
    result = _compute_fraud_score(make_customer(return_rate=0.25))
    assert result["fraud_score"] == 0.20
    assert "elevated_return_rate" in result["flags"]
    assert result["high_return_rate"] is False
    assert result["exceeds_fraud_threshold"] is False


def test_high_return_rate():
    result = _compute_fraud_score(make_customer(return_rate=0.45))
    # elevated_return_rate (0.20) + high_return_rate (0.20) = 0.40
    assert result["fraud_score"] == 0.40
    assert "elevated_return_rate" in result["flags"]
    assert "high_return_rate" in result["flags"]
    assert result["high_return_rate"] is True
    assert result["exceeds_fraud_threshold"] is False


def test_prior_fraud_flag_triggers_threshold():
    result = _compute_fraud_score(make_customer(return_rate=0.45, fraud_flag=True))
    # elevated (0.20) + high (0.20) + prior_fraud (0.30) = 0.70
    assert result["fraud_score"] > 0.60
    assert result["exceeds_fraud_threshold"] is True
    assert "prior_fraud_flag" in result["flags"]
    assert "high_return_rate" in result["flags"]


def test_extreme_return_rate_at_threshold_boundary():
    result = _compute_fraud_score(make_customer(return_rate=0.65))
    # elevated (0.20) + high (0.20) + extreme (0.20) = 0.60 exactly (after rounding)
    assert result["fraud_score"] == 0.60
    assert "extreme_return_rate" in result["flags"]
    assert "high_return_rate" in result["flags"]
    assert "elevated_return_rate" in result["flags"]
    # Score of exactly 0.60 is NOT > 0.60, so this is a borderline non-exceed
    assert result["exceeds_fraud_threshold"] is False


def test_extreme_return_rate_with_fraud_flag_exceeds_threshold():
    result = _compute_fraud_score(make_customer(return_rate=0.65, fraud_flag=True))
    # elevated (0.20) + high (0.20) + extreme (0.20) + prior_fraud (0.30) = 0.90
    assert result["fraud_score"] == 0.90
    assert result["exceeds_fraud_threshold"] is True


def test_serial_remorse_returns():
    reasons = ["buyer_remorse"] * 4 + ["damage_in_transit"]
    result = _compute_fraud_score(make_customer(return_rate=0.30, reasons=reasons))
    assert "serial_remorse_returns" in result["flags"]
    # elevated (0.20) + serial_remorse (0.10) = 0.30
    assert result["fraud_score"] == pytest.approx(0.30)


def test_high_volume_returner():
    result = _compute_fraud_score(
        make_customer(return_rate=0.10, return_count=6, order_count=60)
    )
    assert "high_volume_returner" in result["flags"]
    assert result["fraud_score"] == 0.05


def test_score_capped_at_one():
    # All flags firing: extreme (0.60) + prior_fraud (0.30) + remorse (0.10) + volume (0.05) = 1.05 → capped
    reasons = ["buyer_remorse"] * 4
    result = _compute_fraud_score(
        make_customer(
            return_rate=0.65,
            fraud_flag=True,
            return_count=6,
            order_count=10,
            reasons=reasons,
        )
    )
    assert result["fraud_score"] == 1.0


def test_zero_return_rate_clean():
    result = _compute_fraud_score(make_customer(return_rate=0.0, return_count=0, order_count=10))
    assert result["fraud_score"] == 0.0
    assert result["flags"] == []
    assert result["high_return_rate"] is False
    assert result["exceeds_fraud_threshold"] is False
